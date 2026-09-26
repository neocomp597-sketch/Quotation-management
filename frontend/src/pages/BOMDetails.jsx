import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdDelete, MdEdit, MdFileDownload } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import BOMComponentsTable from '../components/bom/BOMComponentsTable';

const Field = ({ label, children }) => (
    <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-800">{children || '-'}</p>
    </div>
);

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : '');

const BOMDetails = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [result, setResult] = useState({ id: null, bom: null, error: '' });
    const loading = result.id !== id;
    const { bom, error } = result;

    useEffect(() => {
        let cancelled = false;
        bomService.getById(id)
            .then((res) => { if (!cancelled) setResult({ id, bom: res.data, error: '' }); })
            .catch((err) => {
                if (!cancelled) setResult({ id, bom: null, error: err.response?.data?.message || 'Failed to load BOM' });
            });
        return () => { cancelled = true; };
    }, [id]);

    const handleExport = async () => {
        try {
            const res = await bomService.exportToExcel(bom._id);
            const url = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `BOM_${bom.fgSerialNumber || bom._id}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Could not export the BOM.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete the BOM for FG serial ${bom.fgSerialNumber}? This cannot be undone.`)) return;
        try {
            await bomService.delete(bom._id);
            toast.success('BOM deleted');
            navigate('/bom-master');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not delete the BOM');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <button
                    type="button"
                    onClick={() => navigate('/bom-master')}
                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                >
                    <MdArrowBack size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-slate-900">BOM Details</h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {bom ? `FG serial ${bom.fgSerialNumber}` : 'Finished-good bill of materials'}
                    </p>
                </div>
                {bom && (
                    <div className="ml-auto flex gap-3">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                        >
                            <MdFileDownload size={18} /> Export to Excel
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-rose-200 text-rose-600 font-black uppercase text-xs tracking-widest hover:bg-rose-50 transition-all"
                        >
                            <MdDelete size={18} /> Delete
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/bom-master/${bom._id}/edit`)}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                        >
                            <MdEdit size={18} /> Edit
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="py-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : error ? (
                <p className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-rose-500">{error}</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:grid-cols-4">
                        <Field label="FG Item Code">
                            {bom.fgItemCode}
                            {bom.fgItemDescription && <span className="block text-xs font-medium text-slate-500">{bom.fgItemDescription}</span>}
                        </Field>
                        <Field label="FG Serial Number">{bom.fgSerialNumber}</Field>
                        <Field label="Components">{String(bom.items?.length || 0)}</Field>
                        <Field label="Status">{bom.status}</Field>
                        <Field label="Created">
                            {formatDateTime(bom.createdAt)}
                            {bom.createdBy?.name && <span className="block text-xs font-medium text-slate-500">{bom.createdBy.name}</span>}
                        </Field>
                        <Field label="Last Updated">
                            {formatDateTime(bom.updatedAt)}
                            {bom.updatedBy?.name && <span className="block text-xs font-medium text-slate-500">{bom.updatedBy.name}</span>}
                        </Field>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">BOM Components</h2>
                        </div>
                        <BOMComponentsTable items={bom.items || []} />
                    </div>
                </>
            )}
        </div>
    );
};

export default BOMDetails;
