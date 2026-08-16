import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { useEffect } from 'react';

import {
    downloadsActions,
    useDownloadsStore,
} from '/@/renderer/features/downloads/store/downloads.store';
import { scrobbleOutbox } from '/@/renderer/features/downloads/services/scrobble-outbox';
import { fileExists, isNative } from '/@/renderer/features/downloads/utils/offline-storage';
import { logger } from '/@/renderer/utils/logger';

/**
 * Loads the offline catalog into memory and keeps the offline flag current.
 *
 * Must run before playback can resolve a local file, since the catalog lookup
 * in useSongUrl is synchronous and only sees what has been hydrated.
 */
export const useDownloadsBootstrap = () => {
    useEffect(() => {
        let disposed = false;

        const reconcile = async () => {
            await downloadsActions.hydrate();

            if (!isNative() || disposed) return;

            // A reinstall (which happens every 7 days on a free signing cert)
            // can leave catalog entries whose files are gone. Drop them so the
            // player doesn't try to play a missing file instead of streaming.
            const { catalog } = useDownloadsStore.getState();
            for (const track of Object.values(catalog)) {
                if (disposed) return;
                if (!(await fileExists(track.path))) {
                    logger.warn(`[downloads] missing on disk, forgetting ${track.songId}`);
                    downloadsActions.forget(track.serverId, track.songId);
                }
            }
        };

        void reconcile();

        return () => {
            disposed = true;
        };
    }, []);

    useEffect(() => {
        if (!isNative()) return;

        let removeNetwork: (() => void) | undefined;
        let removeResume: (() => void) | undefined;

        const attach = async () => {
            // navigator.onLine is unreliable in a WKWebView, so use the native
            // reachability signal instead.
            const status = await Network.getStatus();
            downloadsActions.setOffline(!status.connected);
            if (status.connected) {
                void scrobbleOutbox.flush();
            }

            const networkHandle = await Network.addListener('networkStatusChange', (next) => {
                downloadsActions.setOffline(!next.connected);
                if (next.connected) {
                    void scrobbleOutbox.flush();
                }
            });
            removeNetwork = () => void networkHandle.remove();

            const resumeHandle = await App.addListener('resume', async () => {
                const current = await Network.getStatus();
                downloadsActions.setOffline(!current.connected);
                if (current.connected) {
                    void scrobbleOutbox.flush();
                }
            });
            removeResume = () => void resumeHandle.remove();
        };

        void attach();

        return () => {
            removeNetwork?.();
            removeResume?.();
        };
    }, []);
};
