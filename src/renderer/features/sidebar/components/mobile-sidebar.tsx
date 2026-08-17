import clsx from 'clsx';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import styles from './mobile-sidebar.module.css';

import { ServerSelector } from '/@/renderer/features/sidebar/components/server-selector';
import { getCollectionTo } from '/@/renderer/features/sidebar/components/sidebar-collection-list';
import { SidebarIcon } from '/@/renderer/features/sidebar/components/sidebar-icon';
import { AppRoute } from '/@/renderer/router/routes';
import { useCollections } from '/@/renderer/store';
import { SidebarItemType, useSidebarItems } from '/@/renderer/store/settings.store';
import { Icon } from '/@/shared/components/icon/icon';
import { Text } from '/@/shared/components/text/text';
import { LibraryItem, SavedCollection } from '/@/shared/types/domain-types';

// These are already one tap away in the tab bar (and Now Playing opens from the
// player bar). Keeping them here made the More drawer a second, worse tab bar.
const TAB_DESTINATIONS = new Set(['Albums', 'Home', 'Now Playing', 'Playlists', 'Search']);

const MobileSidebarItem = ({ item }: { item: SidebarItemType }) => (
    <NavLink
        className={({ isActive }) => clsx(styles.row, { [styles.active]: isActive })}
        to={item.route}
    >
        <SidebarIcon route={item.route} />
        <Text fw={600} size="sm">
            {item.label}
        </Text>
        <Icon className={styles.disclosure} icon="arrowRightS" size="sm" />
    </NavLink>
);

const MobileCollectionItem = ({ collection }: { collection: SavedCollection }) => {
    const route =
        collection.type === LibraryItem.ALBUM ? AppRoute.LIBRARY_ALBUMS : AppRoute.LIBRARY_SONGS;

    return (
        <NavLink className={styles.row} to={getCollectionTo(collection)}>
            <SidebarIcon route={route} />
            <Text fw={600} size="sm" truncate>
                {collection.name}
            </Text>
            <Icon className={styles.disclosure} icon="arrowRightS" size="sm" />
        </NavLink>
    );
};

/**
 * Phone-only secondary navigation. The desktop sidebar's accordion, browser
 * history buttons and full playlist tree were mouse-first chrome; a mobile
 * drawer needs concise, full-width rows and must keep Settings reachable.
 */
export const MobileSidebar = () => {
    const { t } = useTranslation();
    const sidebarItems = useSidebarItems();
    const collections = useCollections();

    const { libraryItems, settingsItem } = useMemo(() => {
        const visibleItems = (sidebarItems ?? []).filter(
            (item) =>
                !item.disabled &&
                Boolean(item.route) &&
                !TAB_DESTINATIONS.has(item.id) &&
                item.id !== 'Collections' &&
                item.id !== 'Settings',
        );
        const configuredSettings = (sidebarItems ?? []).find((item) => item.id === 'Settings');

        return {
            libraryItems: visibleItems,
            // Settings is intentionally hidden from the configurable desktop sidebar,
            // but it is a required phone destination. Do not mutate persisted desktop
            // settings merely to render it here.
            settingsItem: {
                disabled: false,
                id: 'Settings',
                label: t('page.sidebar.settings'),
                route: configuredSettings?.route ?? AppRoute.SETTINGS,
            } as SidebarItemType,
        };
    }, [sidebarItems, t]);

    return (
        <aside
            aria-label={t('common.more', { postProcess: 'titleCase' })}
            className={styles.container}
            id="mobile-sidebar"
        >
            <header className={styles.header}>
                <Text fw={700} size="xl">
                    {t('common.more', { postProcess: 'titleCase' })}
                </Text>
            </header>
            <section className={styles.section}>
                <Text className={styles.sectionLabel} fw={700} size="xs" variant="secondary">
                    Library source
                </Text>
                <div className={styles.sourceGroup}>
                    <ServerSelector position="bottom-start" withinPortal />
                </div>
            </section>
            <nav className={styles.list}>
                {libraryItems.length > 0 && (
                    <section className={styles.section}>
                        <Text
                            className={styles.sectionLabel}
                            fw={700}
                            size="xs"
                            variant="secondary"
                        >
                            {t('page.sidebar.myLibrary')}
                        </Text>
                        <div className={styles.group}>
                            {libraryItems.map((item) => (
                                <MobileSidebarItem item={item} key={`mobile-sidebar-${item.id}`} />
                            ))}
                        </div>
                    </section>
                )}
                {collections.length > 0 && (
                    <section className={styles.section}>
                        <Text
                            className={styles.sectionLabel}
                            fw={700}
                            size="xs"
                            variant="secondary"
                        >
                            {t('page.sidebar.collections')}
                        </Text>
                        <div className={styles.group}>
                            {collections.map((collection) => (
                                <MobileCollectionItem
                                    collection={collection}
                                    key={`mobile-collection-${collection.id}`}
                                />
                            ))}
                        </div>
                    </section>
                )}
                <section className={styles.section}>
                    <Text className={styles.sectionLabel} fw={700} size="xs" variant="secondary">
                        {t('page.sidebar.settings')}
                    </Text>
                    <div className={styles.group}>
                        <MobileSidebarItem item={settingsItem} />
                    </div>
                </section>
            </nav>
        </aside>
    );
};
