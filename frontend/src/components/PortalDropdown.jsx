import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const PortalDropdown = ({ isOpen, anchorRef, children }) => {
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        if (isOpen && anchorRef.current) {
            const updatePosition = () => {
                const rect = anchorRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            };
            
            updatePosition();
            window.addEventListener('resize', updatePosition);
            
            // Listen to scroll on all scrollable ancestors for precision
            const handleScroll = () => updatePosition();
            window.addEventListener('scroll', handleScroll, true);
            
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', handleScroll, true);
            };
        }
    }, [isOpen, anchorRef]);

    if (!isOpen || !anchorRef.current) return null;

    return createPortal(
        <div 
            style={{ 
                position: 'absolute', 
                top: `${coords.top + 4}px`, 
                left: `${coords.left}px`, 
                width: `${Math.max(coords.width, 320)}px`,
                zIndex: 9999 
            }}
        >
            {children}
        </div>,
        document.body
    );
};

export default PortalDropdown;
