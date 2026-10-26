import React, { useEffect, useRef, useState } from 'react';
import { MdCheckCircle, MdErrorOutline } from 'react-icons/md';
import { stockAuditService } from '../../../services/api';
import DateInput from '../../../components/DateInput';
import { INPUT, LABEL, AUDIT_TYPES } from './shared';

// Batch details. The name is checked against existing batches as it is typed; while the
// user has not typed a name of their own, it follows the audit type
// (perpetual_audit_22.OCT.2026, cycle_audit_..., with _2, _3 when taken).
const BatchFields = ({ form, setForm, batchId = null, onNameStatus }) => {
    // Result of the last name check, tagged with the name + type it was made for.
    const [checked, setChecked] = useState({ key: '', state: 'idle', message: '', suggestion: '' });
    const nameEdited = useRef(Boolean(batchId));
    const name = form.name.trim();
    const checkKey = `${name}|${form.auditType}`;
    const check = !name
        ? { state: 'invalid', message: 'Batch name is required.', suggestion: '' }
        : checked.key === checkKey ? checked : { state: 'checking', message: '', suggestion: '' };

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    // Default name for the chosen type, until the user types one.
    useEffect(() => {
        if (nameEdited.current) return;
        stockAuditService.checkName({ auditType: form.auditType })
            .then(res => { if (!nameEdited.current) setForm(prev => ({ ...prev, name: res.data.suggestion })); })
            .catch(() => {});
    }, [form.auditType, setForm]);

    useEffect(() => {
        if (!name) return undefined;
        let cancelled = false;
        const t = setTimeout(() => {
            stockAuditService.checkName({ name, auditType: form.auditType, exceptId: batchId || undefined })
                .then(res => {
                    if (!cancelled) setChecked({ key: checkKey, state: res.data.available ? 'ok' : 'invalid', message: res.data.message, suggestion: res.data.suggestion });
                })
                .catch(() => { if (!cancelled) setChecked({ key: checkKey, state: 'idle', message: '', suggestion: '' }); });
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [name, checkKey, form.auditType, batchId]);

    useEffect(() => { onNameStatus?.(check.state); }, [check.state, onNameStatus]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label htmlFor="audit-name" className={LABEL}>Batch name *</label>
                <input
                    id="audit-name"
                    value={form.name}
                    onChange={(e) => { nameEdited.current = true; set('name')(e); }}
                    className={`${INPUT} font-mono`}
                    maxLength={80}
                    autoComplete="off"
                />
                <div className="mt-1 min-h-[18px] text-xs font-semibold">
                    {check.state === 'checking' && <span className="text-slate-400">Checking name…</span>}
                    {check.state === 'ok' && <span className="inline-flex items-center gap-1 text-emerald-600"><MdCheckCircle /> Name is available</span>}
                    {check.state === 'invalid' && (
                        <span className="inline-flex flex-wrap items-center gap-1 text-rose-600">
                            <MdErrorOutline /> {check.message}
                            {check.suggestion && check.suggestion !== form.name && (
                                <button type="button" className="underline text-teal-700" onClick={() => setForm(prev => ({ ...prev, name: check.suggestion }))}>
                                    Use {check.suggestion}
                                </button>
                            )}
                        </span>
                    )}
                </div>
            </div>
            <div>
                <label htmlFor="audit-type" className={LABEL}>Audit type</label>
                <select id="audit-type" value={form.auditType} onChange={set('auditType')} className={INPUT}>
                    {AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="audit-sapref" className={LABEL}>SAP B1 reference</label>
                <input id="audit-sapref" value={form.sapReference} onChange={set('sapReference')} className={INPUT} placeholder="Company DB / report / query name" />
            </div>
            <div>
                <label className={LABEL}>SAP stock as of</label>
                <DateInput type="datetime-local" value={form.sapSnapshotAt} onChange={set('sapSnapshotAt')} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={LABEL}>Planned start</label>
                    <DateInput value={form.plannedStart} onChange={set('plannedStart')} className={INPUT} />
                </div>
                <div>
                    <label className={LABEL}>Planned end</label>
                    <DateInput value={form.plannedEnd} min={form.plannedStart || undefined} onChange={set('plannedEnd')} className={INPUT} />
                </div>
            </div>
            <div className="md:col-span-2">
                <label htmlFor="audit-desc" className={LABEL}>Description / scope notes</label>
                <textarea id="audit-desc" value={form.description} onChange={set('description')} rows={2} className={INPUT} placeholder="Warehouses, item groups or instructions for the counting team" />
            </div>
        </div>
    );
};

export default BatchFields;
