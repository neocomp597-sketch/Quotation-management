import React, { useEffect, useState } from 'react';
import { MdAccountTree } from 'react-icons/md';
import { bomService } from '../../services/api';
import BOMComponentsTable from './BOMComponentsTable';

/**
 * Read-only BOM shown while booking a complaint, looked up through the FG serial number.
 * The BOM cannot be changed here.
 */
const ComplaintBOMPanel = ({ serialNumber }) => {
    const serial = String(serialNumber || '').trim();
    const [state, setState] = useState({ key: '', error: '', bom: null, serial: '' });

    useEffect(() => {
        if (!serial) return undefined;

        let cancelled = false;
        // Debounce so typing a serial number doesn't fire a lookup per keystroke.
        const timer = setTimeout(() => {
            bomService.getBySerial(serial)
                .then((res) => {
                    if (cancelled) return;
                    setState({ key: serial, error: '', bom: res.data?.bom || null, serial: res.data?.serialNumber ?? serial });
                })
                .catch((err) => {
                    if (cancelled) return;
                    setState({ key: serial, error: err.response?.data?.message || 'Could not load BOM', bom: null, serial });
                });
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [serial]);

    const loading = state.key !== serial;
    const { error, bom } = state;

    if (!serial) {
        return <p className="p-4 text-sm font-medium text-slate-400">Enter the product serial number to see its BOM.</p>;
    }
    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }
    if (error) {
        return <p className="p-4 text-sm font-medium text-rose-500">{error}</p>;
    }
    if (!bom) {
        return (
            <p className="p-4 text-sm font-medium text-slate-400">
                No BOM has been entered for serial number <span className="font-bold text-slate-600">{state.serial}</span>.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <MdAccountTree className="text-primary-600" size={20} />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Parent Item Code</p>
                    <p className="text-sm font-bold text-slate-800">
                        {bom.fgItemCode}
                        {bom.fgItemDescription && <span className="ml-2 font-medium text-slate-500">{bom.fgItemDescription}</span>}
                    </p>
                </div>
                {String(bom.fgSerialNumber || '').toUpperCase() !== String(bom.fgItemCode || '').toUpperCase() && (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">FG Serial No</p>
                        <p className="text-sm font-bold text-slate-800">{bom.fgSerialNumber}</p>
                    </div>
                )}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Components</p>
                    <p className="text-sm font-bold text-slate-800">{bom.items?.length || 0}</p>
                </div>
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400">Read only</span>
            </div>
            <div className="rounded-2xl border border-slate-100">
                <BOMComponentsTable items={bom.items || []} compact />
            </div>
        </div>
    );
};

export default ComplaintBOMPanel;
