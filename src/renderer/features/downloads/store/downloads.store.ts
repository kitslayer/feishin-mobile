/**
 * Offline download catalog and queue state.
 *
 * The catalog has to be readable *synchronously* during render: the player
 * resolves a track's URL while rendering, and if the lookup were async there
 * would be a frame where src is undefined and the engine falls back to an empty
 * source (i.e. the track silently fails to start). So the catalog lives in
 * zustand (in memory) and is mirrored to IndexedDB for durability.
 */
import { del, get, set } from 'idb-keyval';

import { QueueSong, Song } from '/@/shared/types/domain-types';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface DownloadedTrack {
    /** Bytes on disk. */
    bytes: number;
    /**
     * Enough of the song to browse and play it with no network. Without this
     * the downloads list can only show opaque ids, and nothing can be queued
     * while offline because the queue needs real song records.
     */
    song: QueueSong | Song;
    /** File extension actually written (may differ from the source container). */
    ext: string;
    /** capacitor://localhost/... URL, ready to hand to the audio element. */
    localUrl: string;
    /** Path relative to the offline directory. */
    path: string;
    serverId: string;
    songId: string;
    /** Epoch ms, used for LRU eviction. */
    savedAt: number;
    /** Epoch ms of last playback, used for LRU eviction. */
    usedAt: number;
}

export type DownloadStatus = 'done' | 'downloading' | 'error' | 'queued';

export interface DownloadJob {
    error?: string;
    /** 0..1 */
    progress: number;
    serverId: string;
    songId: string;
    status: DownloadStatus;
    title: string;
}

interface DownloadsState {
    /** key -> local art URL. Keyed `${serverId}:${imageId}`. */
    art: Record<string, string>;
    /** key -> track. Keyed `${serverId}:${songId}`. */
    catalog: Record<string, DownloadedTrack>;
    hydrated: boolean;
    jobs: Record<string, DownloadJob>;
    /** Bytes. 0 disables the cap. */
    maxBytes: number;
    /** True when the device reports no connectivity. */
    offline: boolean;
}

const CATALOG_IDB_KEY = 'feishin-offline-catalog';
const ART_IDB_KEY = 'feishin-offline-art';
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024 * 1024;

export const trackKey = (serverId: string, songId: string) => `${serverId}:${songId}`;

export const useDownloadsStore = create<DownloadsState>()(
    devtools(
        subscribeWithSelector(
            immer(() => ({
                art: {},
                catalog: {},
                hydrated: false,
                jobs: {},
                maxBytes: DEFAULT_MAX_BYTES,
                offline: false,
            })),
        ),
        { name: 'downloads' },
    ),
);

const persistCatalog = () => {
    const { catalog } = useDownloadsStore.getState();
    // Fire and forget: the in-memory copy is authoritative for this session.
    void set(CATALOG_IDB_KEY, catalog).catch(() => {});
};

const persistArt = () => {
    void set(ART_IDB_KEY, useDownloadsStore.getState().art).catch(() => {});
};

export const downloadsActions = {
    setArt: (serverId: string, imageId: string, localUrl: string) => {
        useDownloadsStore.setState((state) => {
            state.art[trackKey(serverId, imageId)] = localUrl;
        });
        persistArt();
    },

    /** Reconcile after a filesystem check finds a file missing. */
    forget: (serverId: string, songId: string) => {
        useDownloadsStore.setState((state) => {
            delete state.catalog[trackKey(serverId, songId)];
        });
        persistCatalog();
    },

    hydrate: async () => {
        const [stored, storedArt] = await Promise.all([
            get<Record<string, DownloadedTrack>>(CATALOG_IDB_KEY).catch(() => undefined),
            get<Record<string, string>>(ART_IDB_KEY).catch(() => undefined),
        ]);

        useDownloadsStore.setState((state) => {
            state.art = storedArt ?? {};
            state.catalog = stored ?? {};
            state.hydrated = true;
        });
    },

    remove: (serverId: string, songId: string) => {
        downloadsActions.forget(serverId, songId);
    },

    reset: () => {
        useDownloadsStore.setState((state) => {
            state.art = {};
            state.catalog = {};
            state.jobs = {};
        });
        void del(CATALOG_IDB_KEY).catch(() => {});
        void del(ART_IDB_KEY).catch(() => {});
    },

    setJob: (job: DownloadJob) => {
        useDownloadsStore.setState((state) => {
            state.jobs[trackKey(job.serverId, job.songId)] = job;
        });
    },

    setMaxBytes: (maxBytes: number) => {
        useDownloadsStore.setState((state) => {
            state.maxBytes = maxBytes;
        });
    },

    setOffline: (offline: boolean) => {
        useDownloadsStore.setState((state) => {
            state.offline = offline;
        });
    },

    /** Records a completed download and drops any job entry for it. */
    upsert: (track: DownloadedTrack) => {
        useDownloadsStore.setState((state) => {
            state.catalog[trackKey(track.serverId, track.songId)] = track;
            delete state.jobs[trackKey(track.serverId, track.songId)];
        });
        persistCatalog();
    },

    /** Bumps LRU recency when a downloaded track is played. */
    touch: (serverId: string, songId: string) => {
        const key = trackKey(serverId, songId);
        if (!useDownloadsStore.getState().catalog[key]) return;

        useDownloadsStore.setState((state) => {
            if (state.catalog[key]) {
                state.catalog[key].usedAt = Date.now();
            }
        });
        persistCatalog();
    },

    clearJob: (serverId: string, songId: string) => {
        useDownloadsStore.setState((state) => {
            delete state.jobs[trackKey(serverId, songId)];
        });
    },
};

/** Synchronous lookup -- safe to call during render. */
export const getDownloadedTrack = (
    serverId: null | string | undefined,
    songId: null | string | undefined,
): DownloadedTrack | undefined => {
    if (!serverId || !songId) return undefined;
    return useDownloadsStore.getState().catalog[trackKey(serverId, songId)];
};

export const useDownloadedTrack = (
    serverId: null | string | undefined,
    songId: null | string | undefined,
) =>
    useDownloadsStore((state) =>
        serverId && songId ? state.catalog[trackKey(serverId, songId)] : undefined,
    );

export const useDownloadJob = (
    serverId: null | string | undefined,
    songId: null | string | undefined,
) =>
    useDownloadsStore((state) =>
        serverId && songId ? state.jobs[trackKey(serverId, songId)] : undefined,
    );

export const useIsOffline = () => useDownloadsStore((state) => state.offline);

export const useDownloadsUsage = () =>
    useDownloadsStore((state) => {
        const tracks = Object.values(state.catalog);
        return {
            bytes: tracks.reduce((sum, track) => sum + track.bytes, 0),
            count: tracks.length,
        };
    });

/** Synchronous local cover-art lookup -- safe during render. */
export const getDownloadedArt = (
    serverId: null | string | undefined,
    imageId: null | string | undefined,
): string | undefined => {
    if (!serverId || !imageId) return undefined;
    return useDownloadsStore.getState().art[trackKey(serverId, imageId)];
};
