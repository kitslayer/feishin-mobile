import isElectron from 'is-electron';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { useAppTracker } from '/@/renderer/features/analytics/hooks/use-app-tracker';
import { useDownloadsBootstrap } from '/@/renderer/features/downloads/hooks/use-downloads-bootstrap';
import { CommandPalette } from '/@/renderer/features/search/components/command-palette';
import { useGarbageCollection } from '/@/renderer/hooks/use-garbage-collection';
import { HotkeyItem, useHotkeys } from '/@/renderer/hooks/use-hotkeys';
import { useIsMobile } from '/@/renderer/hooks/use-is-mobile';
import { DefaultLayout } from '/@/renderer/layouts/default-layout';
import { MobileLayout } from '/@/renderer/layouts/mobile-layout/mobile-layout';
import { AppRoute } from '/@/renderer/router/routes';
import {
    useCommandPaletteState,
    useLayoutHotkeyBindings,
    useSettingsStoreActions,
    useZoomFactor,
} from '/@/renderer/store';

interface ResponsiveLayoutProps {
    shell?: boolean;
}

const ResponsiveLayoutBase = ({ shell }: ResponsiveLayoutProps) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return <MobileLayout shell={shell} />;
    }

    return <DefaultLayout shell={shell} />;
};

/**
 * Flags the document as a coarse (touch) pointer so CSS can escalate rules that
 * are otherwise hover-only. A lot of this UI hides controls behind `:hover`,
 * which on a phone means they can never be revealed at all -- row actions,
 * favourite/rating buttons, radio station edit/delete and so on.
 */
const usePointerTypeFlag = () => {
    useEffect(() => {
        const query = window.matchMedia('(pointer: coarse)');

        const apply = () => {
            document.documentElement.dataset.pointer = query.matches ? 'coarse' : 'fine';
        };

        apply();
        query.addEventListener('change', apply);

        return () => query.removeEventListener('change', apply);
    }, []);
};

export const ResponsiveLayout = ({ shell }: ResponsiveLayoutProps) => {
    useAppTracker();
    usePointerTypeFlag();
    useDownloadsBootstrap();

    return (
        <>
            <ResponsiveLayoutBase shell={shell} />
            <LayoutHotkeys />
            <GarbageCollection />
        </>
    );
};

const localSettings = isElectron() ? window.api.localSettings : null;

const LayoutHotkeys = () => {
    const navigate = useNavigate();
    const zoomFactor = useZoomFactor();
    const { setSettings } = useSettingsStoreActions();
    const bindings = useLayoutHotkeyBindings();
    const { close, open, opened, toggle } = useCommandPaletteState();

    const handlers = useMemo(
        () => ({
            close,
            open,
            toggle,
        }),
        [close, open, toggle],
    );

    const updateZoom = useCallback(
        (increase: number) => {
            const newVal = zoomFactor + increase;
            if (newVal > 300 || newVal < 50 || !localSettings) return;

            setSettings({
                general: {
                    zoomFactor: newVal,
                },
            });
            localSettings?.setZoomFactor(newVal);
        },
        [setSettings, zoomFactor],
    );

    useEffect(() => {
        if (localSettings) {
            localSettings?.setZoomFactor(zoomFactor);
        }
    }, [zoomFactor]);

    const hotkeys = useMemo<HotkeyItem[]>(
        () => [
            [bindings.globalSearch.hotkey, open],
            [bindings.browserBack.hotkey, () => navigate(-1)],
            [bindings.browserForward.hotkey, () => navigate(1)],
            [bindings.navigateHome.hotkey, () => navigate(AppRoute.HOME)],
            ...(localSettings
                ? ([
                      [bindings.zoomIn.hotkey, () => updateZoom(5)],
                      [bindings.zoomOut.hotkey, () => updateZoom(-5)],
                  ] as HotkeyItem[])
                : []),
        ],
        [bindings, navigate, open, updateZoom],
    );

    const modalProps = useMemo(
        () => ({
            handlers,
            opened,
        }),
        [handlers, opened],
    );

    useHotkeys(hotkeys);

    return <CommandPalette modalProps={modalProps} />;
};

const GarbageCollection = () => {
    useGarbageCollection();
    return null;
};
