import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import { useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';

import styles from './mobile-layout.module.css';

import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { FullScreenVisualizer } from '/@/renderer/features/player/components/full-screen-visualizer';
import { MobileFullscreenPlayer } from '/@/renderer/features/player/components/mobile-fullscreen-player';
import { MobileSidebar } from '/@/renderer/features/sidebar/components/mobile-sidebar';
import { MobileBack } from '/@/renderer/layouts/mobile-layout/mobile-back';
import { MobileTabBar } from '/@/renderer/layouts/mobile-layout/mobile-tab-bar';
import { PlayerBar } from '/@/renderer/layouts/default-layout/player-bar';
import { WindowBar } from '/@/renderer/layouts/window-bar';
import { useFullScreenPlayerOverlayState, useWindowBarStyle } from '/@/renderer/store';
import { Drawer } from '/@/shared/components/drawer/drawer';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { useDisclosure } from '/@/shared/hooks/use-disclosure';
import { Platform } from '/@/shared/types/types';

interface MobileLayoutProps {
    shell?: boolean;
}

export const MobileLayout = ({ shell }: MobileLayoutProps) => {
    const [sidebarOpened, { close: closeSidebar, open: openSidebar }] = useDisclosure(false);
    const location = useLocation();

    // Close the drawer whenever navigation happens. Without this a tap on a
    // playlist (or any drawer entry) navigated correctly but left the drawer
    // covering the result, so it read as "the tap did nothing".
    useEffect(() => {
        closeSidebar();
    }, [closeSidebar, location.pathname]);
    const {
        expanded: isFullScreenPlayerExpanded,
        visualizerExpanded: isFullScreenVisualizerExpanded,
    } = useFullScreenPlayerOverlayState();
    const windowBarStyle = useWindowBarStyle();

    return (
        <>
            <div
                className={clsx(styles.layout, {
                    [styles.macos]: windowBarStyle === Platform.MACOS,
                    [styles.windows]: windowBarStyle === Platform.WINDOWS,
                })}
                id="mobile-layout"
            >
                {!shell && <WindowBar />}
                {!shell && <MobileBack />}
                <main className={styles.mainContent}>
                    <Suspense fallback={<Spinner container />}>
                        <Outlet />
                    </Suspense>
                </main>
                <PlayerBar />
                {!shell && (
                    <div className={styles.tabBarArea}>
                        <MobileTabBar onMore={openSidebar} />
                    </div>
                )}
            </div>
            {!shell && (
                <Drawer
                    onClose={closeSidebar}
                    opened={sidebarOpened}
                    position="left"
                    size="320px"
                    styles={{
                        body: {
                            height: '100%',
                            padding: 0,
                        },
                        content: {
                            height: '100%',
                            width: '100%',
                        },
                    }}
                    withCloseButton={false}
                >
                    <MobileSidebar />
                </Drawer>
            )}
            <AnimatePresence initial={false}>
                {isFullScreenPlayerExpanded && (
                    <div className={styles.fullScreenPlayerOverlay}>
                        <MobileFullscreenPlayer />
                    </div>
                )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
                {isFullScreenVisualizerExpanded && (
                    <div className={styles.fullScreenPlayerOverlay}>
                        <FullScreenVisualizer />
                    </div>
                )}
            </AnimatePresence>
            <ContextMenuController.Root />
        </>
    );
};
