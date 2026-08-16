import isElectron from 'is-electron';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '/@/renderer/api';
import { downloadManager } from '/@/renderer/features/downloads/services/download-manager';
import { isNative } from '/@/renderer/features/downloads/utils/offline-storage';
import { resolveSongsForDownload } from '/@/renderer/features/downloads/utils/resolve-songs';
import { useCurrentServer } from '/@/renderer/store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

interface DownloadActionProps {
    ids: string[];
    /**
     * What the ids refer to. Context menus pass the id of their own item type,
     * so an album menu hands over album ids that must be expanded to tracks.
     */
    itemType?: LibraryItem;
    /**
     * Full song records, when the caller has them. Required for offline
     * downloads because the container decides whether the original file can be
     * stored as-is or has to be transcoded to something WKWebView can decode.
     */
    songs?: Song[];
}

const utils = isElectron() ? window.api.utils : null;

export const DownloadAction = ({ ids, itemType, songs }: DownloadActionProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();

    const onSelect = useCallback(async () => {
        try {
            // In the native app "download" means save for offline playback,
            // not hand a URL to the browser -- iOS has nowhere to put it.
            if (isNative()) {
                const resolved: Song[] =
                    songs?.length === ids.length
                        ? songs
                        : await resolveSongsForDownload(
                              ids,
                              itemType ?? LibraryItem.SONG,
                              server.id,
                          );

                await downloadManager.enqueue(resolved, server.id);
                return;
            }

            for (const id of ids) {
                const downloadUrl = api.controller.getDownloadUrl({
                    apiClientProps: { serverId: server.id },
                    query: { id },
                });

                if (isElectron()) {
                    utils?.download(downloadUrl);
                } else {
                    window.open(downloadUrl, '_blank');
                }
            }
        } catch (error) {
            console.error('Failed to download items:', error);
        }
    }, [ids, itemType, server, songs]);

    return (
        // Only the browser path is limited to a single item -- offline
        // downloads queue an entire album or playlist happily.
        <ContextMenu.Item
            disabled={!isNative() && ids.length > 1}
            leftIcon="download"
            onSelect={onSelect}
        >
            {t('page.contextMenu.download')}
        </ContextMenu.Item>
    );
};
