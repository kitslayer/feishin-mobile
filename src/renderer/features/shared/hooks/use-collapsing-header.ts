import { useEffect, useState } from 'react';

/**
 * Collapses a detail page's header once the list beneath it is scrolled.
 *
 * The header is a sibling of the list, and the list virtualises inside its own
 * scroll container, so the header can never scroll away on its own -- on a phone
 * that left roughly four rows visible under a permanently stuck header.
 *
 * Scroll events do not bubble, but they do fire on ancestors during the capture
 * phase, so a single document-level listener sees the inner container without
 * needing a ref into the virtualiser.
 */
export const useCollapsingHeader = (threshold = 48) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        let frame = 0;

        const onScroll = (event: Event) => {
            const target = event.target as HTMLElement | null;
            if (!target || typeof target.scrollTop !== 'number') return;

            // Ignore horizontal-only scrollers (the header action row).
            if (target.scrollHeight <= target.clientHeight) return;

            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                setIsCollapsed(target.scrollTop > threshold);
            });
        };

        document.addEventListener('scroll', onScroll, true);

        return () => {
            document.removeEventListener('scroll', onScroll, true);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [threshold]);

    return isCollapsed;
};
