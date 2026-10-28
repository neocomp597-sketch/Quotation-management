// Phone view of the Invoice Bulk Upload and Serial No Transfer tables. Below 768px the table
// (its wrapper has `serial-desktop-table`) is hidden and every row is one of these cards
// instead. The serial-mobile-* classes in index.css lay them out; colours use the same
// utility classes as the tables, so the dark theme covers both.

const TONES = {
    default: 'bg-white border-slate-100',
    active: 'bg-emerald-50 border-emerald-200',
    selected: 'bg-primary-50 border-primary-200',
};

export const MobileCardList = ({ children }) => <div className="serial-mobile-list">{children}</div>;

/** One row as a card; `onClick` makes the whole card open the row, like clicking the table row. */
export const MobileCard = ({ onClick, tone = 'default', children }) => (
    <div
        onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(e); } : undefined}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={`serial-mobile-card border ${TONES[tone] || TONES.default}${onClick ? ' is-clickable' : ''}`}
    >
        {children}
    </div>
);

/** Card title line (usually the serial number) with an optional badge or button on the right. */
export const MobileCardHead = ({ title, subtitle, aside }) => (
    <div className="serial-mobile-head">
        <div className="min-w-0">
            <div className="serial-mobile-title text-slate-900">{title}</div>
            {subtitle && <div className="serial-mobile-subtitle text-slate-500">{subtitle}</div>}
        </div>
        {aside && <div className="serial-mobile-aside">{aside}</div>}
    </div>
);

/** Label / value pairs, two to a row; `wide` gives a field the whole row. */
export const MobileFields = ({ children }) => <dl className="serial-mobile-fields border-slate-100">{children}</dl>;

export const MobileField = ({ label, wide = false, children }) => (
    <div className={`serial-mobile-field${wide ? ' is-wide' : ''}`}>
        <dt className="serial-mobile-label text-slate-400">{label}</dt>
        <dd className="serial-mobile-value text-slate-700">{children}</dd>
    </div>
);

/** Row buttons; a tap on them does not also open the card. */
export const MobileCardActions = ({ children }) => (
    <div className="serial-mobile-actions" onClick={(e) => e.stopPropagation()}>{children}</div>
);

export const MobileEmpty = ({ children }) => <p className="serial-mobile-empty text-slate-400">{children}</p>;
