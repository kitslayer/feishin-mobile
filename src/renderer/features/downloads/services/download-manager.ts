/**
 * Serial download queue for offline playback.
 *
 * Deliberately serial (one transfer at a time): these are large files over a
 * home LAN, and running several in parallel mostly just makes each one slower
 * while multiplying the chance of a partial write.
 *
 * Partial writes are guarded by downloading to `<name>.part` and renaming on
 * success, so an app kill mid-transfer can never leave a truncated file that
 * would later play as a corrupt track.
 */
import { FileTransfer } from '@capacitor/file-transfer';

import {
    downloadsActions,
    getDownloadedArt,
    getDownloadedTrack,
    trackKey,
    useDownloadsStore,
} from '/@/renderer/features/downloads/store/downloads.store';
import {
    artPathFor,
    audioPathFor,
    deleteFile,
    ensureDir,
    extensionFor,
    fileSize,
    getUri,
    isNative,
    isPlayableContainer,
    renameFile,
    toPlayableUrl,
} from '/@/renderer/features/downloads/utils/offline-storage';
import { api } from '/@/renderer/api';
import { logger } from '/@/renderer/utils/logger';
import { LibraryItem, QueueSong, Song } from '/@/shared/types/domain-types';

type DownloadableSong = QueueSong | Song;

interface QueueEntry {
    serverId: string;
    song: DownloadableSong;
}

const pending: QueueEntry[] = [];
let running = false;

/** Bitrate used when a container has to be transcoded to be playable on iOS. */
const TRANSCODE_BITRATE = 320;
const TRANSCODE_FORMAT = 'mp3';

const resolveSourceUrl = async (song: DownloadableSong, serverId: string) => {
    // Prefer the untouched original: getDownloadUrl is synchronous and embeds
    // credentials in the query string, so the transfer needs no auth headers.
    if (isPlayableContainer(song.container)) {
        return {
            ext: extensionFor(song.container),
            url: api.controller.getDownloadUrl({
                apiClientProps: { serverId },
                query: { id: song.id },
            }),
        };
    }

    // Container WKWebView cannot decode (opus/ogg/wma/...). Ask the server to
    // transcode rather than storing a file that would never play.
    const url = await api.controller.getStreamUrl({
        apiClientProps: { serverId },
        query: {
            bitrate: TRANSCODE_BITRATE,
            format: TRANSCODE_FORMAT,
            id: song.id,
            transcode: true,
        },
    });

    return { ext: TRANSCODE_FORMAT, url };
};

/** Evicts least-recently-used tracks until the catalog fits under the cap. */
export const enforceStorageCap = async () => {
    const { catalog, maxBytes } = useDownloadsStore.getState();
    if (!maxBytes) return;

    const tracks = Object.values(catalog);
    let total = tracks.reduce((sum, track) => sum + track.bytes, 0);
    if (total <= maxBytes) return;

    const byLeastRecentlyUsed = [...tracks].sort((a, b) => a.usedAt - b.usedAt);

    for (const track of byLeastRecentlyUsed) {
        if (total <= maxBytes) break;
        await deleteFile(track.path);
        downloadsActions.forget(track.serverId, track.songId);
        total -= track.bytes;
        logger.info(`[downloads] evicted ${track.songId} to stay under the storage cap`);
    }
};

/**
 * Caches the album cover next to the audio. Without this the lock screen shows
 * nothing offline, since MediaSession artwork resolves through the same image
 * URL helper as the rest of the UI.
 */
const downloadArt = async (song: DownloadableSong, serverId: string) => {
    const imageId = song.imageUrl ? undefined : (song.imageId ?? undefined);
    const remoteUrl =
        song.imageUrl ??
        (imageId
            ? api.controller.getImageUrl({
                  apiClientProps: { serverId },
                  query: { id: imageId, itemType: LibraryItem.SONG },
              })
            : null);

    const cacheId = imageId ?? song.albumId ?? song.id;
    if (!remoteUrl || !cacheId) return;
    if (getDownloadedArt(serverId, cacheId)) return;

    try {
        const path = artPathFor(serverId, cacheId);
        await ensureDir(path.slice(0, path.lastIndexOf('/')));

        const uri = await getUri(path);
        if (!uri) return;

        await FileTransfer.downloadFile({ path: uri, url: remoteUrl });
        downloadsActions.setArt(serverId, cacheId, toPlayableUrl(uri));
    } catch (error) {
        // Artwork is a nicety; never fail a track download over it.
        logger.warn(`[downloads] cover art failed for ${song.name}: ${String(error)}`);
    }
};

const downloadOne = async ({ serverId, song }: QueueEntry) => {
    const existing = getDownloadedTrack(serverId, song.id);
    if (existing) return;

    downloadsActions.setJob({
        progress: 0,
        serverId,
        songId: song.id,
        status: 'downloading',
        title: song.name,
    });

    try {
        const { ext, url } = await resolveSourceUrl(song, serverId);
        const path = audioPathFor(serverId, song.id, ext);
        const partPath = `${path}.part`;

        await ensureDir(path.slice(0, path.lastIndexOf('/')));

        const partUri = await getUri(partPath);
        if (!partUri) {
            throw new Error('could not resolve a destination path');
        }

        await FileTransfer.downloadFile({ path: partUri, progress: true, url });
        await renameFile(partPath, path);

        const uri = await getUri(path);
        if (!uri) {
            throw new Error('file vanished immediately after download');
        }

        downloadsActions.upsert({
            bytes: await fileSize(path),
            ext,
            localUrl: toPlayableUrl(uri),
            path,
            savedAt: Date.now(),
            serverId,
            songId: song.id,
            usedAt: Date.now(),
        });

        await downloadArt(song, serverId);
        await enforceStorageCap();
    } catch (error) {
        logger.error(`[downloads] failed for ${song.name}: ${String(error)}`);
        downloadsActions.setJob({
            error: String(error),
            progress: 0,
            serverId,
            songId: song.id,
            status: 'error',
            title: song.name,
        });
    }
};

const drain = async () => {
    if (running) return;
    running = true;

    try {
        while (pending.length) {
            const next = pending.shift();
            if (next) {
                await downloadOne(next);
            }
        }
    } finally {
        running = false;
    }
};

let progressListenerAttached = false;

const attachProgressListener = async () => {
    if (progressListenerAttached || !isNative()) return;
    progressListenerAttached = true;

    await FileTransfer.addListener('progress', (event) => {
        const { jobs } = useDownloadsStore.getState();
        // The plugin reports per-URL progress, not per-song, so update whichever
        // job is currently downloading.
        const active = Object.values(jobs).find((job) => job.status === 'downloading');
        if (!active) return;

        const total = event.lengthComputable ? event.contentLength : 0;
        downloadsActions.setJob({
            ...active,
            progress: total ? Math.min(1, event.bytes / total) : 0,
        });
    });
};

export const downloadManager = {
    /** Queues songs that are not already downloaded or in flight. */
    enqueue: async (songs: DownloadableSong[], serverId: string) => {
        if (!isNative()) {
            logger.warn('[downloads] offline downloads require the native app');
            return;
        }

        await attachProgressListener();

        const { jobs } = useDownloadsStore.getState();

        for (const song of songs) {
            const key = trackKey(serverId, song.id);
            if (getDownloadedTrack(serverId, song.id) || jobs[key]) continue;
            if (pending.some((entry) => entry.song.id === song.id)) continue;

            pending.push({ serverId, song });
            downloadsActions.setJob({
                progress: 0,
                serverId,
                songId: song.id,
                status: 'queued',
                title: song.name,
            });
        }

        void drain();
    },

    /** Deletes a downloaded track from disk and the catalog. */
    remove: async (serverId: string, songId: string) => {
        const track = getDownloadedTrack(serverId, songId);
        if (!track) return;

        await deleteFile(track.path);
        downloadsActions.remove(serverId, songId);
    },

    removeAll: async () => {
        const { catalog } = useDownloadsStore.getState();

        for (const track of Object.values(catalog)) {
            await deleteFile(track.path);
        }

        downloadsActions.reset();
    },

    /** Re-queues everything that previously errored. */
    retryFailed: async () => {
        const { jobs } = useDownloadsStore.getState();
        const failed = Object.values(jobs).filter((job) => job.status === 'error');

        for (const job of failed) {
            downloadsActions.clearJob(job.serverId, job.songId);
        }

        void drain();
    },
};
