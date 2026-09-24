import { useLayoutEffect, useState } from 'react';

/**
 * Viewport position for a pop-up anchored to `anchorRef`, for use with `position: fixed`.
 * The BOM tables scroll horizontally, which would clip an absolutely positioned pop-up.
 * `align: 'right'` lines the pop-up's right edge up with the anchor's right edge.
 */
const useAnchoredPosition = (anchorRef, open, { align = 'left', gap = 4, estimatedHeight = 280 } = {}) => {
    const [style, setStyle] = useState(null);

    useLayoutEffect(() => {
        if (!open) return undefined;
        const update = () => {
            const rect = anchorRef.current?.getBoundingClientRect();
            if (!rect) return;
            const openAbove = window.innerHeight - rect.bottom < estimatedHeight && rect.top > window.innerHeight - rect.bottom;
            setStyle({
                position: 'fixed',
                zIndex: 60,
                ...(openAbove ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
                ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left })
            });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [anchorRef, open, align, gap, estimatedHeight]);

    return open ? style : null;
};

export default useAnchoredPosition;
