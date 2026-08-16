import type {
    PopoverDropdownProps as MantinePopoverDropdownProps,
    PopoverProps as MantinePopoverProps,
} from '@mantine/core';

import { Popover as MantinePopover } from '@mantine/core';

import styles from './popover.module.css';

export interface PopoverDropdownProps extends MantinePopoverDropdownProps {}
export interface PopoverProps extends MantinePopoverProps {}

const getTransition = (position?: string) => {
    if (position?.includes('top')) {
        return 'fade-up';
    }

    if (position?.includes('bottom')) {
        return 'fade-down';
    }

    if (position?.includes('left')) {
        return 'fade-left';
    }

    if (position?.includes('right')) {
        return 'fade-right';
    }

    return 'fade';
};

// Keep overlays clear of the phone's rounded corners, Dynamic Island and home
// indicator, and clamp them to the viewport so long menus stay scrollable.
const EDGE_PADDING = { bottom: 28, left: 12, right: 12, top: 12 };
export const FLOATING_MIDDLEWARES = {
    flip: true,
    shift: { padding: EDGE_PADDING },
    size: { padding: EDGE_PADDING },
} as const;

export const Popover = ({ children, ...props }: PopoverProps) => {
    return (
        <MantinePopover
            classNames={{
                dropdown: styles.dropdown,
            }}
            closeOnClickOutside={true}
            closeOnEscape={true}
            // Mantine's default is shift({ padding: 5 }) and it never enables
            // the size middleware at all, so dropdowns clamp 5px from the bezel
            // (under the Dynamic Island / home indicator) and nothing limits
            // their height. Combined with html/body overflow:hidden, anything
            // taller than the screen is simply unreachable.
            middlewares={FLOATING_MIDDLEWARES}
            offset={10}
            transitionProps={{ transition: getTransition(props.position) }}
            withArrow={false}
            withinPortal
            {...props}
        >
            {children}
        </MantinePopover>
    );
};

Popover.Target = MantinePopover.Target;
Popover.Dropdown = MantinePopover.Dropdown;
