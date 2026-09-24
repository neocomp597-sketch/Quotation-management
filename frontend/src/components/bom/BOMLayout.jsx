import React from 'react';
import { STATUS_STYLES } from './bomUi';

// Visual building blocks matching the BOM Creation Form design (blue banner, numbered cards).

export const inputClass = 'w-full rounded-md border border-[#c9d2dc] bg-white px-2.5 py-2 text-sm text-[#263238] outline-none focus:border-[#1f4e78] focus:ring-2 focus:ring-[#1f4e78]/15 disabled:bg-slate-100 disabled:text-slate-500';
export const cellInputClass = 'w-full rounded border border-[#c9d2dc] bg-white px-1.5 py-1.5 text-[13px] outline-none focus:border-[#1f4e78] disabled:bg-slate-100';

export const BOMBanner = ({ title, subtitle, children }) => (
    <div className="flex flex-col gap-3 rounded-t-xl bg-gradient-to-br from-[#173f63] to-[#2f6f9f] px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
        <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm opacity-90">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-2 print:hidden">{children}</div>}
    </div>
);

export const BOMCard = ({ title, right, children, className = '' }) => (
    <section className={`my-4 rounded-[10px] border border-[#d7dee7] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] print:break-inside-avoid ${className}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#eef5fb] pb-2.5">
            <h2 className="m-0 text-[17px] font-semibold text-[#1f4e78]">{title}</h2>
            {right}
        </div>
        {children}
    </section>
);

export const Field = ({ label, required, children, className = '' }) => (
    <div className={className}>
        <label className="mb-1.5 block text-[13px] font-semibold text-[#263238]">
            {label} {required && <span className="text-[#c62828]">*</span>}
        </label>
        {children}
    </div>
);

export const ReadField = ({ label, children }) => (
    <div>
        <p className="mb-1 text-[12px] font-semibold text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-[#263238]">{children || '-'}</p>
    </div>
);

export const StatusBadge = ({ status, stage }) => (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
        {status}{stage ? ` · ${stage}` : ''}
    </span>
);

export const BOMButton = ({ variant = 'secondary', className = '', ...props }) => {
    const variants = {
        primary: 'bg-[#1f4e78] text-white hover:bg-[#173f63]',
        secondary: 'bg-[#e9eef3] text-[#263238] hover:bg-[#dde5ec]',
        success: 'bg-[#2e7d32] text-white hover:bg-[#256628]',
        danger: 'bg-[#fdecec] text-[#b71c1c] hover:bg-[#fbd9d9]',
        light: 'bg-white/15 text-white hover:bg-white/25 border border-white/30'
    };
    return (
        <button
            type="button"
            className={`rounded-md px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
            {...props}
        />
    );
};

// Mirrors the form's message box: a heading plus a numbered list of issues.
export const MessageBox = ({ message, onClose }) => {
    if (!message) return null;
    const tone = message.type === 'error'
        ? 'bg-[#ffebee] text-[#b71c1c] border-[#f5c2c7]'
        : message.type === 'warning'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-[#e8f5e9] text-[#256029] border-[#c3e6cb]';
    return (
        <div className={`my-3 rounded-md border px-4 py-3 text-sm ${tone}`}>
            <div className="flex items-start justify-between gap-4">
                <p className="font-semibold">{message.text}</p>
                {onClose && <button type="button" onClick={onClose} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>}
            </div>
            {message.items?.length > 0 && (
                <ol className="mt-2 list-decimal space-y-0.5 pl-5">
                    {message.items.map((item, index) => <li key={index}>{item}</li>)}
                </ol>
            )}
            {message.warnings?.length > 0 && (
                <>
                    <p className="mt-3 font-semibold text-amber-800">Warnings (do not block submission)</p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-amber-800">
                        {message.warnings.map((item, index) => <li key={index}>{item}</li>)}
                    </ol>
                </>
            )}
        </div>
    );
};

export const CostSummary = ({ cost }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
            ['Material Cost', cost.material],
            ['Scrap Cost', cost.scrap],
            ['Packing / Other Cost', cost.packing],
            ['Estimated BOM Cost', cost.total]
        ].map(([label, value], index) => (
            <div key={label} className={`rounded-lg border border-[#d7dee7] p-3.5 ${index === 3 ? 'bg-[#eef5fb]' : 'bg-[#f7f9fb]'}`}>
                <span className="block text-xs text-slate-500">{label}</span>
                <strong className={`text-[19px] ${index === 3 ? 'text-[#1f4e78]' : ''}`}>
                    ₹ {(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
            </div>
        ))}
    </div>
);
