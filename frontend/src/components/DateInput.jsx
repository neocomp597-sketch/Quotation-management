import React, { forwardRef, useState } from 'react';
import { MdCalendarToday } from 'react-icons/md';
import { formatDate, formatDateTime } from '../utils/helpers';

/**
 * Date field that shows dates the ARCRM way (13.OCT.26, or 13.OCT.26, 02:30 PM for
 * type="datetime-local") instead of the browser's own dd-mm-yyyy.
 *
 * It is a drop-in for <input type="date"> / <input type="datetime-local">: `value` is still
 * 'YYYY-MM-DD' (or 'YYYY-MM-DDTHH:mm'), `onChange` still gets the native change event, and
 * name, id, min, max, required, disabled work as before. The native input lies invisibly over
 * the field, so a click opens the browser's calendar and the keyboard still edits the date;
 * the formatted text is what shows. `className` styles the visible field.
 */
const DateInput = forwardRef(({ type = 'date', className = '', value, defaultValue, onChange, onClick, disabled, placeholder, style, ...props }, ref) => {
    // Uncontrolled use (defaultValue) keeps its own copy so the text follows the picker.
    const [ownValue, setOwnValue] = useState(defaultValue ?? '');
    const current = value !== undefined ? value : ownValue;
    const withTime = type === 'datetime-local';
    const text = current ? (withTime ? formatDateTime(current, '') : formatDate(current, '')) : '';

    const handleChange = (event) => {
        if (value === undefined) setOwnValue(event.target.value);
        onChange?.(event);
    };

    const openPicker = (event) => {
        onClick?.(event);
        if (disabled || event.defaultPrevented) return;
        try { event.currentTarget.showPicker?.(); } catch { /* older browsers: focusing is enough */ }
    };

    // The field is always a flex row; display classes from the old <input> (block, w-full) only
    // decide whether it takes its own line.
    const classes = className.split(/\s+/).filter(Boolean);
    const ownLine = classes.some((c) => ['block', 'flex', 'w-full'].includes(c));
    const rest = classes.filter((c) => !['block', 'inline-block', 'flex', 'inline-flex', 'inline'].includes(c)).join(' ');

    return (
        <div
            className={`relative ${ownLine ? 'flex' : 'inline-flex'} items-center gap-2 min-w-[9.5rem] focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${rest}`}
            style={style}
        >
            <span className={`flex-1 truncate ${text ? '' : 'text-slate-400 font-medium'}`}>
                {text || placeholder || (withTime ? 'DD.MMM.YY, --:--' : 'DD.MMM.YY')}
            </span>
            <MdCalendarToday className="shrink-0 text-slate-400" size={16} aria-hidden="true" />
            <input
                ref={ref}
                type={type}
                value={value !== undefined ? value : undefined}
                defaultValue={value === undefined ? defaultValue : undefined}
                onChange={handleChange}
                onClick={openPicker}
                disabled={disabled}
                aria-label={props['aria-label'] || placeholder || (withTime ? 'Date and time' : 'Date')}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                {...props}
            />
        </div>
    );
});

DateInput.displayName = 'DateInput';

export default DateInput;
