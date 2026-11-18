import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { MdAdd, MdCheck, MdClose, MdDelete, MdEdit, MdExpandMore, MdSearch } from 'react-icons/md';
import Modal from './Modal';
import { csmService } from '../services/api';
import usePermission from '../hooks/usePermission';

const EMPTY_FORM = { name: '', status: 'Active' };

const fieldClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500';
const labelClass = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1';
const outlineButton = 'flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50';
const primaryButton = 'flex shrink-0 items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all disabled:opacity-50';
const iconButton = 'rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600';
const messageOf = (err, fallback) => err.response?.data?.message || fallback;

/**
 * The Details of Complaint of one type: listed in order, each edited or deleted on its own, and a
 * box to add the next one. The box stays ready after each detail, so many can be added in a row.
 */
const TypeDetails = ({ type, focusOnOpen, canCreate, canModify, canDelete, onChanged }) => {
    const [text, setText] = useState('');
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(null); // { from, to }
    const [saving, setSaving] = useState(false);
    const addInput = useRef(null);
    const details = type.details || [];

    useEffect(() => {
        if (focusOnOpen) addInput.current?.focus();
    }, [focusOnOpen]);

    const add = async (event) => {
        event.preventDefault();
        if (!text.trim() || adding) return;
        setAdding(true);
        try {
            await csmService.addComplaintDetail(type._id, text);
            setText('');
            await onChanged();
        } catch (err) {
            toast.error(messageOf(err, 'Failed to add the detail'));
        } finally {
            setAdding(false);
            addInput.current?.focus();
        }
    };

    const saveEdit = async (event) => {
        event.preventDefault();
        if (!editing.to.trim() || saving) return;
        setSaving(true);
        try {
            await csmService.updateComplaintDetail(type._id, editing.from, editing.to);
            setEditing(null);
            await onChanged();
        } catch (err) {
            toast.error(messageOf(err, 'Failed to save the detail'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (detail) => {
        if (!window.confirm(`Delete this detail?\n\n${detail}\n\nTickets already raised keep what was selected.`)) return;
        try {
            await csmService.deleteComplaintDetail(type._id, detail);
            await onChanged();
        } catch (err) {
            toast.error(messageOf(err, 'Failed to delete the detail'));
        }
    };

    return (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-3 py-3 sm:px-4 sm:pl-10">
            <p className={labelClass.replace(' mb-1', '')}>Details of Complaint</p>
            {details.length ? (
                <ol className="space-y-1">
                    {details.map((detail, index) => (
                        <li key={detail} className="rounded-xl border border-slate-100 bg-white">
                            {editing?.from === detail ? (
                                <form onSubmit={saveEdit} className="flex items-center gap-1 p-1">
                                    <input
                                        autoFocus
                                        aria-label="Edit detail"
                                        value={editing.to}
                                        maxLength={200}
                                        onChange={(e) => setEditing({ ...editing, to: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <button type="submit" disabled={saving} title="Save" aria-label="Save detail" className={iconButton}><MdCheck size={18} /></button>
                                    <button type="button" title="Cancel" aria-label="Cancel" onClick={() => setEditing(null)} className={iconButton}><MdClose size={18} /></button>
                                </form>
                            ) : (
                                <div className="flex items-center gap-1 py-1 pl-3 pr-1">
                                    <span className="w-6 shrink-0 text-xs font-bold text-slate-400">{index + 1}.</span>
                                    <span className="min-w-0 flex-1 break-words text-sm text-slate-700">{detail}</span>
                                    {canModify && (
                                        <button type="button" title="Edit detail" aria-label={`Edit detail ${detail}`} onClick={() => setEditing({ from: detail, to: detail })} className={iconButton}>
                                            <MdEdit size={16} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button type="button" title="Delete detail" aria-label={`Delete detail ${detail}`} onClick={() => remove(detail)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                                            <MdDelete size={16} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            ) : <p className="text-sm text-slate-400">No details yet.</p>}
            {canCreate && (
                <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
                    <input
                        ref={addInput}
                        value={text}
                        maxLength={200}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type a detail and press Enter"
                        aria-label={`Add a detail to ${type.name}`}
                        className={`${fieldClass} bg-white`}
                    />
                    <button type="submit" disabled={adding || !text.trim()} className={primaryButton}>
                        <MdAdd size={16} /> {adding ? 'Adding…' : 'Add Detail'}
                    </button>
                </form>
            )}
        </div>
    );
};

/**
 * CSM Config > Complaint Types: the Type of Complaint list and the Details of Complaint under each
 * type, which the ticket forms offer as two linked dropdowns. Added one at a time.
 */
const ComplaintTypesMaster = () => {
    const { canCreate, canModify, canDelete } = usePermission('csm_masters');
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [openIds, setOpenIds] = useState({});
    const [focusId, setFocusId] = useState(null);
    const [form, setForm] = useState(null); // null: closed; { id?, name, status }
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const res = await csmService.getComplaintTypes();
            setTypes(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            toast.error(messageOf(err, 'Failed to load complaint types'));
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
        const payload = { name: form.name, status: form.status };
        setSaving(true);
        try {
            if (form.id) {
                await csmService.updateComplaintType(form.id, payload);
                toast.success('Complaint type saved');
            } else {
                const { data } = await csmService.createComplaintType(payload);
                toast.success('Type added. Now add its details.');
                // Opens the new type, ready for its first detail.
                setSearch('');
                setOpenIds((prev) => ({ ...prev, [data._id]: true }));
                setFocusId(data._id);
            }
            setForm(null);
            await load();
        } catch (err) {
            toast.error(messageOf(err, 'Failed to save the complaint type'));
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
            toast.error(messageOf(err, 'Failed to delete the complaint type'));
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
                    <button type="button" onClick={() => setForm(EMPTY_FORM)} className={primaryButton}>
                        <MdAdd size={16} /> Add Type
                    </button>
                )}
            </div>

            {loading ? (
                <p className="py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Loading…</p>
            ) : !shown.length ? (
                <div className="py-12 text-center">
                    <p className="font-bold text-slate-500">{types.length ? 'No complaint types match the search.' : 'No complaint types yet.'}</p>
                    {!types.length && <p className="mt-1 text-sm text-slate-400">Press Add Type, then add its details one by one. They appear on the Raise Ticket form.</p>}
                </div>
            ) : (
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
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
                                            title="Edit type"
                                            aria-label={`Edit ${type.name}`}
                                            onClick={() => setForm({ id: type._id, name: type.name, status: type.status || 'Active' })}
                                            className={iconButton}
                                        >
                                            <MdEdit size={18} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button type="button" title="Delete type" aria-label={`Delete ${type.name}`} onClick={() => remove(type)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                                            <MdDelete size={18} />
                                        </button>
                                    )}
                                </div>
                                {open && (
                                    <TypeDetails
                                        type={type}
                                        focusOnOpen={focusId === type._id}
                                        canCreate={canCreate}
                                        canModify={canModify}
                                        canDelete={canDelete}
                                        onChanged={load}
                                    />
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
                            <input id="complaintTypeName" type="text" required autoFocus maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} />
                            {!form.id && <p className="mt-1 text-xs text-slate-400">After saving, add its details one by one.</p>}
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
                            <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ComplaintTypesMaster;
