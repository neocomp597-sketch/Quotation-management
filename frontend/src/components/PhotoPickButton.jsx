import React from 'react';

/**
 * A button that picks a photo, either straight from the camera (`fromCamera`) or from the phone's
 * gallery / files. A file input with `capture` opens the camera only, with no gallery choice, so a
 * screen offering both shows one of each. `onChange` receives the input's change event.
 */
const PhotoPickButton = ({ fromCamera = false, disabled = false, onChange, className = '', children }) => (
    <label className={`${className} ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`} aria-disabled={disabled}>
        {children}
        <input
            type="file"
            accept="image/*"
            {...(fromCamera ? { capture: 'environment' } : {})}
            disabled={disabled}
            onChange={onChange}
            className="hidden"
        />
    </label>
);

export default PhotoPickButton;
