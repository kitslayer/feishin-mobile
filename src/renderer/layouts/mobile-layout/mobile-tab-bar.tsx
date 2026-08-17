import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import styles from './mobile-tab-bar.module.css';

import { AppRoute } from '/@/renderer/router/routes';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';

interface MobileTabBarProps {
    /** Opens the existing drawer, which still holds playlists, radio and settings. */
    onMore: () => void;
}

interface Tab {
    icon: 'home' | 'itemAlbum' | 'playlist' | 'search';
    label: string;
    /** Extra route prefixes that should keep this tab highlighted. */
    matches?: string[];
    to: string;
}

/**
 * Primary navigation. Replaces the floating hamburger button: a phone app puts
 * its top-level destinations one thumb-reach away, not behind a drawer.
 */
export const MobileTabBar = ({ onMore }: MobileTabBarProps) => {
    const { t } = useTranslation();

    const tabs: Tab[] = [
        { icon: 'home', label: t('page.sidebar.home'), to: AppRoute.HOME },
        {
            icon: 'itemAlbum',
            label: t('page.sidebar.albums'),
            matches: ['/library'],
            to: AppRoute.LIBRARY_ALBUMS,
        },
        {
            icon: 'search',
            label: t('page.sidebar.search'),
            to: `/search/${LibraryItem.SONG}`,
        },
        // Downloads is deliberately not a tab: downloaded files are preferred
        // automatically whenever they exist, so the page is for managing them,
        // not for reaching music. Playlists is what gets opened daily.
        {
            icon: 'playlist',
            label: t('page.sidebar.playlists'),
            matches: ['/playlists'],
            to: AppRoute.PLAYLISTS,
        },
    ];

    return (
        <nav className={styles.tabBar}>
            {tabs.map((tab) => (
                <NavLink
                    className={({ isActive }) =>
                        isActive ||
                        tab.matches?.some((prefix) => window.location.hash.includes(prefix))
                            ? `${styles.tab} ${styles.active}`
                            : styles.tab
                    }
                    end={tab.to === AppRoute.HOME}
                    key={tab.to}
                    to={tab.to}
                >
                    <Icon icon={tab.icon} size="lg" />
                    <span className={styles.label}>{tab.label}</span>
                </NavLink>
            ))}
            <button className={styles.tab} onClick={onMore} type="button">
                <Icon icon="menu" size="lg" />
                <span className={styles.label}>
                    {t('common.more', { postProcess: 'titleCase' })}
                </span>
            </button>
        </nav>
    );
};
