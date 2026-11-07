import React from 'react';
import { assetEntryFields, assetMgrFields, assetIndicator, assetLinkedProductCode } from '../utils/assetEntryFields';

// The look of the Invoice Bulk Upload Add Single Entry form (pages/SerialNoMaster.jsx), read-only.
const LABEL = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';
const BOX = 'w-full min-h-[44px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 break-words';

const Value = ({ value, mono = false }) => (
    <div className={`${BOX} ${mono ? 'font-mono' : ''}`}>
        {value || <span className="font-normal italic text-slate-400">Not entered</span>}
    </div>
);

/**
 * A saved Invoice Bulk Upload entry with the fields, labels and look of its entry form, so what was
 * entered there reads the same here. `asset` is getAssetSummary's asset.
 */
const AssetEntryDetails = ({ asset }) => {
    if (!asset) return null;
    const mgrs = assetMgrFields(asset);
    const productCode = assetLinkedProductCode(asset);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs font-bold text-slate-700">
            {assetEntryFields(asset).map(({ key, label, value }) => (
                <div key={key}>
                    <span className={LABEL}>{label}</span>
                    <Value value={value} mono={key === 'serialNumber'} />
                </div>
            ))}
            <div className="col-span-full p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">MGR 1 – 5 (from Product Master)</span>
                    {productCode && <span className="text-[10px] font-semibold text-slate-400">Linked to {productCode}</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {mgrs.map(({ key, label, value }) => (
                        <div key={key}>
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</span>
                            <span className={`block text-xs truncate ${value ? 'font-bold text-slate-900' : 'font-normal italic text-slate-400'}`} title={value || 'Not assigned'}>
                                {value || 'Not assigned'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <span className={LABEL}>Indicator Field (Max 20 chars)</span>
                <Value value={assetIndicator(asset)} />
            </div>
        </div>
    );
};

export default AssetEntryDetails;
