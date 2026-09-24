import React, { useEffect, useState } from 'react';
import { MdAccountTree } from 'react-icons/md';
import { bomService } from '../../services/api';
import BOMComponentsTable from './BOMComponentsTable';

/**
 * Read-only Active BOM for a complaint. Pass `ticketId` for an existing complaint, or
 * `serialNumber` while booking one; the FG item is resolved from the serial number.
 * The BOM cannot be changed from here.
 */
const ComplaintBOMPanel = ({ ticketId, serialNumber }) => {
    const serial = String(serialNumber || '').trim();
    const lookupKey = ticketId ? `ticket:${ticketId}` : serial ? `serial:${serial}` : '';
    const [state, setState] = useState({ key: '', error: '', data: null });

    useEffect(() => {
        if (!lookupKey) return undefined;

        let cancelled = false;
        // Debounce so typing a serial number doesn't fire a lookup per keystroke.
        const timer = setTimeout(() => {
            const request = ticketId
                ? bomService.getForTicket(ticketId)
                : bomService.lookupForComplaint({ serialNumber: serial });
            request
                .then((res) => { if (!cancelled) setState({ key: lookupKey, error: '', data: res.data }); })
                .catch((err) => {
                    if (!cancelled) setState({ key: lookupKey, error: err.response?.data?.message || 'Could not load BOM', data: null });
                });
        }, ticketId ? 0 : 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [lookupKey, ticketId, serial]);

    if (!lookupKey) {
        return <p className="p-4 text-sm font-medium text-slate-400">Enter the product serial number to see its BOM.</p>;
    }
    if (state.key !== lookupKey) {
        return (
            <div className="p-6 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }
    if (state.error) {
        return <p className="p-4 text-sm font-medium text-rose-500">{state.error}</p>;
    }

    const { bom, fgItemCode } = state.data || {};
    if (!bom) {
        return (
            <p className="p-4 text-sm font-medium text-slate-400">
                {fgItemCode
                    ? <>There is no Active BOM for FG item <span className="font-bold text-slate-600">{fgItemCode}</span>.</>
                    : 'The FG item for this serial number could not be identified, so no BOM can be shown.'}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <MdAccountTree className="text-primary-600" size={20} />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">FG Item</p>
                    <p className="text-sm font-bold text-slate-800">
                        {bom.fgItemCode}
                        {bom.fgDescription && <span className="ml-2 font-medium text-slate-500">{bom.fgDescription}</span>}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">BOM No. / Revision</p>
                    <p className="text-sm font-bold text-slate-800">{bom.bomNumber} · {bom.revision}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plant</p>
                    <p className="text-sm font-bold text-slate-800">{bom.plantName || '-'}{bom.alternativeBom ? ` (Alt ${bom.alternativeBom})` : ''}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Components</p>
                    <p className="text-sm font-bold text-slate-800">{bom.components?.length || 0}</p>
                </div>
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400">Read only</span>
            </div>
            <BOMComponentsTable components={bom.components || []} showCost={false} compact />
        </div>
    );
};

export default ComplaintBOMPanel;
