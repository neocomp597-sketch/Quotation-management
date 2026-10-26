import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdInfoOutline, MdSave } from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import BatchFields from './BatchFields';
import EmailListInput from './EmailListInput';
import { PANEL, PRIMARY, SECONDARY, LABEL, NOTICE, H2, errorMessage, emptyBatchForm, batchPayload } from './shared';

// New batch: details and who may open it. The SAP stock is imported on the batch's Scope tab,
// which opens right after saving.
const StockAuditCreate = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState(emptyBatchForm);
    const [auditors, setAuditors] = useState([]);
    const [viewers, setViewers] = useState([]);
    const [nameState, setNameState] = useState('idle');
    const [saving, setSaving] = useState(false);
    const onNameStatus = useCallback((state) => setNameState(state), []);

    const save = async (e) => {
        e.preventDefault();
        if (nameState === 'invalid') {
            toast.error('Choose another batch name.');
            return;
        }
        setSaving(true);
        try {
            const res = await stockAuditService.create({ ...batchPayload(form), auditorEmails: auditors, viewerEmails: viewers });
            toast.success('Audit batch created. Import the SAP stock to set its scope.');
            navigate(`/inventory/stock-audit/${res.data._id}?tab=scope`, { replace: true });
        } catch (error) {
            const suggestion = error.response?.data?.suggestion;
            if (suggestion) setForm(prev => ({ ...prev, name: suggestion }));
            toast.error(errorMessage(error, 'Failed to create the audit batch'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={save} className="space-y-5 max-w-4xl min-w-0">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => navigate('/inventory/stock-audit')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500" aria-label="Back">
                    <MdArrowBack size={22} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">New audit batch</h1>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Step 1 of 2 · details and access</p>
                </div>
            </div>

            <section className={PANEL}>
                <h2 className={`${H2} mb-4`}>Batch details</h2>
                <BatchFields form={form} setForm={setForm} onNameStatus={onNameStatus} />
            </section>

            <section className={PANEL}>
                <h2 className={`${H2} mb-1`}>Who can open this batch</h2>
                <p className="text-xs font-semibold text-slate-500 mb-4">You manage the batch as its owner. Add colleagues by email; you can change this later.</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="audit-auditors" className={LABEL}>Auditors — view, edit and count</label>
                        <EmailListInput id="audit-auditors" value={auditors} onChange={setAuditors} exclude={viewers} />
                    </div>
                    <div>
                        <label htmlFor="audit-viewers" className={LABEL}>Viewers — view only</label>
                        <EmailListInput id="audit-viewers" value={viewers} onChange={setViewers} exclude={auditors} />
                    </div>
                </div>
                <div className={`${NOTICE} mt-4`}>
                    <MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                    <span>People get an in-app notification and can open the batch from Inventory › SAP Stock Audit, on the portal or on their phone. An email without a portal account takes effect once that account exists.</span>
                </div>
            </section>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button type="button" onClick={() => navigate('/inventory/stock-audit')} className={SECONDARY}>Cancel</button>
                <button type="submit" disabled={saving || nameState === 'checking'} className={PRIMARY}>
                    <MdSave size={18} /> {saving ? 'Creating…' : 'Create batch & import SAP stock'}
                </button>
            </div>
        </form>
    );
};

export default StockAuditCreate;
