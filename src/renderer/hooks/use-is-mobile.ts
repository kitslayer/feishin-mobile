import { useMediaQuery } from '@mantine/hooks';

import { isNative } from '/@/renderer/features/downloads/utils/offline-storage';

/**
 * This fork targets iOS only, so the installed app is always the mobile UI.
 *
 * Without the native check the layout keyed purely off a 768px width query,
 * which meant rotating the phone to landscape (956px wide) threw the entire
 * desktop layout into a 440px-tall viewport -- desktop playerbar, desktop
 * sidebar and the full crushed column set.
 *
 * The width query is kept so the same bundle still adapts when opened in a
 * browser for development.
 */
export const useIsMobile = () => {
    const isNarrow = useMediaQuery('(max-width: 768px)');
    return isNative() || isNarrow;
};
