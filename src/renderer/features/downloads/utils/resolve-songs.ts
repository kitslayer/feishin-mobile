import { api } from '/@/renderer/api';
import { LibraryItem, Song, SongListSort, SortOrder } from '/@/shared/types/domain-types';

/** Nothing sane downloads more than this from a single action. */
const MAX_SONGS_PER_ACTION = 2000;

/**
 * Expands whatever a context menu was opened on into the actual songs to store
 * offline. Context menus pass the id of the item they belong to -- an album menu
 * passes album ids, not song ids -- so downloading an album has to fan out to
 * its tracks first.
 */
export const resolveSongsForDownload = async (
    ids: string[],
    itemType: LibraryItem,
    serverId: string,
): Promise<Song[]> => {
    if (!ids.length) return [];

    const listSongs = async (query: Record<string, unknown>) => {
        const result = await api.controller.getSongList({
            apiClientProps: { serverId },
            query: {
                limit: MAX_SONGS_PER_ACTION,
                sortBy: SongListSort.ALBUM,
                sortOrder: SortOrder.ASC,
                startIndex: 0,
                ...query,
            } as never,
        });

        return result?.items ?? [];
    };

    switch (itemType) {
        case LibraryItem.ALBUM:
            return listSongs({ albumIds: ids });

        case LibraryItem.ALBUM_ARTIST:
            return listSongs({ albumArtistIds: ids });

        case LibraryItem.ARTIST:
            return listSongs({ artistIds: ids });

        case LibraryItem.GENRE:
            return listSongs({ genreIds: ids });

        case LibraryItem.PLAYLIST: {
            const results = await Promise.all(
                ids.map((id) =>
                    api.controller
                        .getPlaylistSongList({
                            apiClientProps: { serverId },
                            query: { id },
                        })
                        .then((result) => result?.items ?? [])
                        .catch(() => []),
                ),
            );

            return results.flat();
        }

        default: {
            const results = await Promise.all(
                ids.map((id) =>
                    api.controller
                        .getSongDetail({ apiClientProps: { serverId }, query: { id } })
                        .catch(() => null),
                ),
            );

            return results.filter((song): song is Song => Boolean(song));
        }
    }
};
