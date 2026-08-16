/**
 * Filesystem layer for offline downloads.
 *
 * Everything lives under Library/NoCloud rather than Cache: iOS purges Cache
 * under storage pressure, which would silently delete a user's downloads, and
 * NoCloud is additionally excluded from iCloud backup (a music library has no
 * business in someone's iCloud quota).
 *
 * All functions no-op safely off-native so the same bundle still runs in a
 * browser for development.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

export const OFFLINE_ROOT = 'offline';
export const AUDIO_DIR = `${OFFLINE_ROOT}/audio`;
export const ART_DIR = `${OFFLINE_ROOT}/art`;

/** iOS purges Directory.Cache; NoCloud survives and is excluded from backup. */
export const OFFLINE_DIRECTORY = Directory.LibraryNoCloud;

export const isNative = () => Capacitor.isNativePlatform();

/**
 * WKWebView cannot load a bare file:// path. convertFileSrc rewrites it to
 * capacitor://localhost/_capacitor_file_/..., which Capacitor's asset handler
 * serves -- and that handler implements HTTP Range, so seeking works.
 */
export const toPlayableUrl = (uri: string) => Capacitor.convertFileSrc(uri);

export const audioPathFor = (serverId: string, songId: string, ext: string) =>
    `${AUDIO_DIR}/${serverId}/${songId}.${ext}`;

export const artPathFor = (serverId: string, imageId: string) =>
    `${ART_DIR}/${serverId}/${imageId}.jpg`;

export const ensureDir = async (path: string) => {
    if (!isNative()) return;

    try {
        await Filesystem.mkdir({ directory: OFFLINE_DIRECTORY, path, recursive: true });
    } catch {
        // Already exists. mkdir has no "exist_ok", so this is the normal path.
    }
};

export const getUri = async (path: string): Promise<null | string> => {
    if (!isNative()) return null;

    try {
        const { uri } = await Filesystem.getUri({ directory: OFFLINE_DIRECTORY, path });
        return uri;
    } catch {
        return null;
    }
};

export const fileExists = async (path: string): Promise<boolean> => {
    if (!isNative()) return false;

    try {
        await Filesystem.stat({ directory: OFFLINE_DIRECTORY, path });
        return true;
    } catch {
        return false;
    }
};

export const fileSize = async (path: string): Promise<number> => {
    if (!isNative()) return 0;

    try {
        const stat = await Filesystem.stat({ directory: OFFLINE_DIRECTORY, path });
        return stat.size ?? 0;
    } catch {
        return 0;
    }
};

export const deleteFile = async (path: string) => {
    if (!isNative()) return;

    try {
        await Filesystem.deleteFile({ directory: OFFLINE_DIRECTORY, path });
    } catch {
        // Already gone.
    }
};

export const renameFile = async (from: string, to: string) => {
    if (!isNative()) return;

    await Filesystem.rename({
        directory: OFFLINE_DIRECTORY,
        from,
        to,
        toDirectory: OFFLINE_DIRECTORY,
    });
};

/**
 * Best-effort extension for a track. The Capacitor iOS asset handler only
 * resolves a real audio MIME for a known set of extensions -- anything else is
 * served as application/octet-stream and will not play -- so an unrecognised
 * container is deliberately reported as unplayable, which makes the caller
 * fetch a transcode instead.
 */
const PLAYABLE_EXTENSIONS = new Set([
    'aac',
    'aiff',
    'au',
    'flac',
    'm4a',
    'm4v',
    'mov',
    'mp3',
    'mp4',
    'wav',
]);

export const isPlayableContainer = (container: null | string | undefined) =>
    Boolean(container && PLAYABLE_EXTENSIONS.has(container.toLowerCase()));

export const extensionFor = (container: null | string | undefined, transcodedTo?: string) => {
    if (transcodedTo) return transcodedTo;
    const normalized = container?.toLowerCase();
    return normalized && PLAYABLE_EXTENSIONS.has(normalized) ? normalized : 'mp3';
};

export const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};
