import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { MdAdd, MdCloudUpload, MdDelete, MdEdit, MdExpandMore, MdFileDownload, MdSearch } from 'react-icons/md';
import Modal from './Modal';
import { csmService } from '../services/api';
import usePermission from '../hooks/usePermission';

const TYPE_HEADERS = ['type of complaint', 'complaint type', 'type'];
const DETAIL_HEADERS = ['details of complaint', 'detail of complaint', 'complaint details', 'complaint detail', 'details', 'detail'];
const EMPTY_FORM = { name: '', detailsText: '', status: 'Active' };

const fieldClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500';
const labelClass = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1';
const outlineButton = 'flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50';

/** Rows of { type, detail } from an uploaded sheet; a blank type continues the type above it. */
const readComplaintRows = async (file) => {
    const workbook = XLSX.read(await file.arrayBuffer());
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!records.length) return [];
    const headers = Object.keys(records[0]);
    const find = (names) => headers.find((header) => names.includes(header.trim().toLowerCase()));
    const typeHeader = find(TYPE_HEADERS);
    const detailHeader = find(DETAIL_HEADERS);
    if (!typeHeader) throw new Error('The file needs a "Type of Complaint" column. Download the template to see the format.');
    let currentType = '';
    return records.reduce((rows, record) => {
        currentType = String(record[typeHeader] ?? '').trim() || currentType;
        const detail = detailHeader ? String(record[detailHeader] ?? '').trim() : '';
        if (currentType && (detail || String(record[typeHeader] ?? '').trim())) rows.push({ type: currentType, detail });
        return rows;
    }, []);
};

/**
 * CSM Config > Complaint Types: the Type of Complaint list and the Details of Complaint under each
 * type, which the ticket forms offer as two linked dropdowns.
 */
const ComplaintTypesMaster = () => {
    const { canCreate, canModify, canDelete } = usePermission('csm_masters');
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [openIds, setOpenIds] = useState({});
    const [form, setForm] = useState(null); // null: closed; { id?, name, detailsText, status }
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef(null);

    const load = async () => {
        try {
            const res = await csmService.getComplaintTypes();
            setTypes(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load complaint types');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const shown = useMemo(() => {
        const text = search.trim().toLowerCase();
        if (!text) return types;
        return types.filter((type) => type.name.toLowerCase().includes(text)
            || (type.details || []).some((detail) => detail.toLowerCase().includes(text)));
    }, [types, search]);
    const detailCount = types.reduce((sum, type) => sum + (type.details?.length || 0), 0);

    const save = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) {
            toast.error('Type of Complaint is required');
            return;
        }
        const payload = { name: form.name, status: form.status, details: form.detailsText.split('\n') };
        setSaving(true);
        try {
            if (form.id) await csmService.updateComplaintType(form.id, payload);
            else await csmService.createComplaintType(payload);
            toast.success(form.id ? 'Complaint type saved' : 'Complaint type added');
            setForm(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save the complaint type');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (type) => {
        if (!window.confirm(`Delete "${type.name}" and its details? Tickets already raised keep what was selected.`)) return;
        try {
            await csmService.deleteComplaintType(type._id);
            toast.success('Complaint type deleted');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete the complaint type');
        }
    };

    const downloadTemplate = () => {
        const sheet = XLSX.utils.aoa_to_sheet([['Type of Complaint', 'Details of Complaint']]);
        sheet['!cols'] = [{ wch: 36 }, { wch: 48 }];
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, 'Complaint Types');
        XLSX.writeFile(book, 'Complaint_Types_Template.xlsx');
    };

    const upload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const rows = await readComplaintRows(file);
            if (!rows.length) throw new Error('The file has no complaint types.');
            const typeCount = new Set(rows.map((row) => row.type.toLowerCase())).size;
            if (!window.confirm(`Add ${typeCount} type${typeCount === 1 ? '' : 's'} of complaint from ${file.name}? Entries already in the list are kept as they are.`)) return;
            const { data } = await csmService.uploadComplaintTypes(rows);
            toast.success(`${data.typesAdded} type${data.typesAdded === 1 ? '' : 's'} and ${data.detailsAdded} detail${data.detailsAdded === 1 ? '' : 's'} added`);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to upload the file');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search type or details of complaint"
                        className={`${fieldClass} pl-11`}
                    />
                </div>
                <p className="text-xs font-bold text-slate-500 lg:mr-auto">
                    {types.length} type{types.length === 1 ? '' : 's'} · {detailCount} detail{detailCount === 1 ? '' : 's'}
                </p>
                {canCreate && (
                    <div className="grid grid-cols-1 sm:flex gap-2">
                        <button type="button" onClick={downloadTemplate} className={outlineButton}>
                            <MdFileDownload size={16} /> Template
                        </button>
                        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className={outlineButton}>
                            <MdCloudUpload size={16} /> {uploading ? 'Uploading…' : 'Upload Excel'}
                        </button>
                        <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={upload} className="hidden" aria-label="Upload complaint types" />
                        <button
                            type="button"
                            onClick={() => setForm(EMPTY_FORM)}
                            className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all"
                        >
                            <MdAdd size={16} /> Add Type
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Loading…</p>
            ) : !shown.length ? (
                <div className="py-12 text-center">
                    <p className="font-bold text-slate-500">{types.length ? 'No complaint types match the search.' : 'No complaint types yet.'}</p>
                    {!types.length && <p className="mt-1 text-sm text-slate-400">Upload the list from Excel or add them one by one. They then appear on the Raise Ticket form.</p>}
                </div>
            ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                    {shown.map((type) => {
                        const open = Boolean(openIds[type._id]);
                        const details = type.details || [];
                        return (
                            <div key={type._id}>
                                <div className="flex items-center gap-2 px-3 sm:px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => setOpenIds((prev) => ({ ...prev, [type._id]: !prev[type._id] }))}
                                        aria-expanded={open}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                        <MdExpandMore size={20} className={`shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
                                        <span className="min-w-0 break-words text-sm font-bold text-slate-800">{type.name}</span>
                                        <span className="shrink-0 rounded-lg bg-primary-50 px-2 py-0.5 text-[10px] font-black text-primary-700">{details.length}</span>
                                        {type.status === 'Inactive' && <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">Inactive</span>}
                                    </button>
                                    {canModify && (
                                        <button
                                            type="button"
                                            title="Edit"
                                            aria-label={`Edit ${type.name}`}
                                            onClick={() => setForm({ id: type._id, name: type.name, detailsText: details.join('\n'), status: type.status || 'Active' })}
                                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                                        >
                                            <MdEdit size={18} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button type="button" title="Delete" aria-label={`Delete ${type.name}`} onClick={() => remove(type)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                                            <MdDelete size={18} />
                                        </button>
                                    )}
                                </div>
                                {open && (
                                    <div className="px-4 pb-4 pl-10">
                                        {details.length ? (
                                            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
                                                {details.map((detail) => <li key={detail} className="break-words">{detail}</li>)}
                                            </ul>
                                        ) : <p className="text-sm text-slate-400">No details added.</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? 'Edit Complaint Type' : 'Add Complaint Type'}>
                {form && (
                    <form onSubmit={save} className="space-y-4">
                        <div>
                            <label htmlFor="complaintTypeName" className={labelClass}>Type of Complaint *</label>
                            <input id="complaintTypeName" type="text" required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} />
                        </div>
                        <div>
                            <label htmlFor="complaintTypeDetails" className={labelClass}>Details of Complaint (one per line)</label>
                            <textarea id="complaintTypeDetails" rows={8} value={form.detailsText} onChange={(e) => setForm({ ...form, detailsText: e.target.value })} className={fieldClass} />
                        </div>
                        <div>
                            <label htmlFor="complaintTypeStatus" className={labelClass}>Status</label>
                            <select id="complaintTypeStatus" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fieldClass}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive (not offered on new tickets)</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setForm(null)} className={outlineButton}>Cancel</button>
                            <button type="submit" disabled={saving} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ComplaintTypesMaster;
