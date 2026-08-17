import { lazy, Suspense, useMemo } from 'react';

import { usePlaylistListFilters } from '/@/renderer/features/playlists/hooks/use-playlist-list-filters';
import { useIsMobile } from '/@/renderer/hooks/use-is-mobile';
import { ItemListSettings, useCurrentServer, useListSettings } from '/@/renderer/store';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { PlaylistListQuery } from '/@/shared/types/domain-types';
import { ItemListKey, ListDisplayType, ListPaginationType } from '/@/shared/types/types';

const PlaylistListInfiniteGrid = lazy(() =>
    import('/@/renderer/features/playlists/components/playlist-list-infinite-grid').then(
        (module) => ({
            default: module.PlaylistListInfiniteGrid,
        }),
    ),
);

const PlaylistListPaginatedGrid = lazy(() =>
    import('/@/renderer/features/playlists/components/playlist-list-paginated-grid').then(
        (module) => ({
            default: module.PlaylistListPaginatedGrid,
        }),
    ),
);

const PlaylistListInfiniteTable = lazy(() =>
    import('/@/renderer/features/playlists/components/playlist-list-infinite-table').then(
        (module) => ({
            default: module.PlaylistListInfiniteTable,
        }),
    ),
);

const PlaylistListPaginatedTable = lazy(() =>
    import('/@/renderer/features/playlists/components/playlist-list-paginated-table').then(
        (module) => ({
            default: module.PlaylistListPaginatedTable,
        }),
    ),
);

export const PlaylistListContent = () => {
    const { display, grid, itemsPerPage, pagination, table } = useListSettings(
        ItemListKey.PLAYLIST,
    );
    const isMobile = useIsMobile();
    // Playlists are visual destinations on the phone. Do not inherit a desktop
    // table preference here: preserve that setting for desktop, but surface
    // playlist artwork in a predictable two-column grid on iPhone.
    const resolvedGrid = isMobile
        ? {
              ...grid,
              itemGap: 'sm' as const,
              itemsPerRow: 2,
              itemsPerRowEnabled: true,
              size: 'large' as const,
          }
        : grid;

    return (
        <Suspense fallback={<Spinner container />}>
            <PlaylistListView
                display={isMobile ? ListDisplayType.GRID : display}
                grid={resolvedGrid}
                itemsPerPage={itemsPerPage}
                pagination={pagination}
                table={table}
            />
        </Suspense>
    );
};

export const PlaylistListView = ({
    display,
    grid,
    itemsPerPage,
    overrideQuery,
    pagination,
    table,
}: ItemListSettings & { overrideQuery?: Omit<PlaylistListQuery, 'limit' | 'startIndex'> }) => {
    const server = useCurrentServer();

    const { query } = usePlaylistListFilters();

    const mergedQuery = useMemo(() => {
        if (!overrideQuery) {
            return query;
        }

        return {
            ...query,
            ...overrideQuery,
            sortBy: overrideQuery.sortBy || query.sortBy,
            sortOrder: overrideQuery.sortOrder || query.sortOrder,
        };
    }, [query, overrideQuery]);

    switch (display) {
        case ListDisplayType.GRID: {
            switch (pagination) {
                case ListPaginationType.INFINITE: {
                    return (
                        <PlaylistListInfiniteGrid
                            gap={grid.itemGap}
                            itemsPerPage={itemsPerPage}
                            itemsPerRow={grid.itemsPerRowEnabled ? grid.itemsPerRow : undefined}
                            query={mergedQuery}
                            serverId={server.id}
                            size={grid.size}
                        />
                    );
                }
                case ListPaginationType.PAGINATED: {
                    return (
                        <PlaylistListPaginatedGrid
                            gap={grid.itemGap}
                            itemsPerPage={itemsPerPage}
                            itemsPerRow={grid.itemsPerRowEnabled ? grid.itemsPerRow : undefined}
                            query={mergedQuery}
                            serverId={server.id}
                            size={grid.size}
                        />
                    );
                }
                default:
                    return null;
            }
        }
        case ListDisplayType.TABLE: {
            switch (pagination) {
                case ListPaginationType.INFINITE: {
                    return (
                        <PlaylistListInfiniteTable
                            autoFitColumns={table.autoFitColumns}
                            columns={table.columns}
                            enableAlternateRowColors={table.enableAlternateRowColors}
                            enableHeader={table.enableHeader}
                            enableHorizontalBorders={table.enableHorizontalBorders}
                            enableRowHoverHighlight={table.enableRowHoverHighlight}
                            enableVerticalBorders={table.enableVerticalBorders}
                            itemsPerPage={itemsPerPage}
                            query={mergedQuery}
                            serverId={server.id}
                            size={table.size}
                        />
                    );
                }
                case ListPaginationType.PAGINATED: {
                    return (
                        <PlaylistListPaginatedTable
                            autoFitColumns={table.autoFitColumns}
                            columns={table.columns}
                            enableAlternateRowColors={table.enableAlternateRowColors}
                            enableHeader={table.enableHeader}
                            enableHorizontalBorders={table.enableHorizontalBorders}
                            enableRowHoverHighlight={table.enableRowHoverHighlight}
                            enableVerticalBorders={table.enableVerticalBorders}
                            itemsPerPage={itemsPerPage}
                            query={mergedQuery}
                            serverId={server.id}
                            size={table.size}
                        />
                    );
                }
                default:
                    return null;
            }
        }
    }

    return null;
};
