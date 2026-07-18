import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const PortalDropdown = ({ isOpen, anchorRef, children }) => {
    const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, showAbove: false });

    useEffect(() => {
        if (isOpen && anchorRef.current) {
            const updatePosition = () => {
                const rect = anchorRef.current.getBoundingClientRect();
                const dropdownHeight = 320;
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

                setCoords({
                    top: rect.top + window.scrollY,
                    bottom: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    showAbove
                });
            };
            
            updatePosition();
            window.addEventListener('resize', updatePosition);
            
            const handleScroll = () => updatePosition();
            window.addEventListener('scroll', handleScroll, true);
            
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', handleScroll, true);
            };
        }
    }, [isOpen, anchorRef]);

    if (!isOpen || !anchorRef.current) return null;

    const topPosition = coords.showAbove ? coords.top - 4 : coords.bottom + 4;
    const transform = coords.showAbove ? 'translateY(-100%)' : 'none';

    return createPortal(
        <div 
            style={{ 
                position: 'absolute', 
                top: `${topPosition}px`, 
                left: `${coords.left}px`, 
                width: `${Math.max(coords.width, 360)}px`,
                transform: transform,
                zIndex: 9999 
            }}
        >
            {children}
        </div>,
        document.body
    );
};

export default PortalDropdown;
