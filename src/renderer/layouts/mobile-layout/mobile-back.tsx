import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import styles from './mobile-back.module.css';

import { AppRoute } from '/@/renderer/router/routes';
import { Icon } from '/@/shared/components/icon/icon';

/** Tab destinations are roots -- there is nothing to go back to from them. */
const ROOT_ROUTES = new Set<string>([
    AppRoute.HOME,
    AppRoute.LIBRARY_ALBUMS,
    AppRoute.PLAYLISTS,
    AppRoute.DOWNLOADS,
]);

const isRoot = (pathname: string) =>
    ROOT_ROUTES.has(pathname) || pathname.startsWith('/search');

/**
 * Back affordance for detail screens.
 *
 * Detail pages had no way out at all: no back control, and no swipe. Both are
 * provided here once rather than per-page, so any screen reachable by drilling
 * in can be left the same way.
 */
export const MobileBack = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const startX = useRef<null | number>(null);
    const startY = useRef(0);

    // Edge swipe, the iOS way back. Only from the left ~24px so it cannot fight
    // horizontal scrollers or the row controls.
    useEffect(() => {
        const onTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch || touch.clientX > 24) {
                startX.current = null;
                return;
            }
            startX.current = touch.clientX;
            startY.current = touch.clientY;
        };

        const onTouchEnd = (event: TouchEvent) => {
            if (startX.current === null) return;

            const touch = event.changedTouches[0];
            const dx = touch.clientX - startX.current;
            const dy = Math.abs(touch.clientY - startY.current);
            startX.current = null;

            // Mostly-horizontal travel of at least a third of the screen.
            if (dx > window.innerWidth / 3 && dy < 80 && !isRoot(location.pathname)) {
                navigate(-1);
            }
        };

        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [location.pathname, navigate]);

    if (isRoot(location.pathname)) {
        return null;
    }

    return (
        <button
            aria-label="Back"
            className={styles.back}
            onClick={() => navigate(-1)}
            type="button"
        >
            <Icon icon="arrowLeftS" size="lg" />
        </button>
    );
};
