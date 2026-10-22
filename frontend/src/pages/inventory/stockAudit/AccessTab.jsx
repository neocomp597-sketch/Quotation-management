import React, { useEffect, useState } from 'react';
import { MdInfoOutline, MdSave } from 'react-icons/md';
import { toast } from 'react-toastify';
import { stockAuditService } from '../../../services/api';
import EmailListInput from './EmailListInput';
import { PANEL, H2, LABEL, NOTICE, PRIMARY, ROLE_LABEL, errorMessage } from './shared';
import { Badge } from './ui';

const ROLE_HELP = [
    ['owner', 'Edits the batch and its scope, manages access, starts / submits / completes the audit and resolves mismatches. Company admins have the same rights.'],
    ['auditor', 'Sees everything, records and corrects counts, requests recounts and follows up mismatches.'],
    ['viewer', 'Sees the dashboard, lines, mismatches and audit trail, and can export. Cannot change anything.']
];

// Who can open the batch. The owner edits the lists; everyone else sees them.
const AccessTab = ({ batch, onChanged }) => {
    const [members, setMembers] = useState(null);
    const [auditors, setAuditors] = useState(batch.auditorEmails || []);
    const [viewers, setViewers] = useState(batch.viewerEmails || []);
    const [saving, setSaving] = useState(false);
    const canEdit = batch.access?.canManageAccess;

    useEffect(() => {
        let cancelled = false;
        stockAuditService.getAccess(batch._id)
            .then(res => { if (!cancelled) setMembers(res.data.members); })
            .catch(() => { if (!cancelled) setMembers([]); });
        return () => { cancelled = true; };
    }, [batch._id]);

    const dirty = JSON.stringify(auditors) !== JSON.stringify(batch.auditorEmails || [])
        || JSON.stringify(viewers) !== JSON.stringify(batch.viewerEmails || []);

    const save = async () => {
        setSaving(true);
        try {
            const res = await stockAuditService.updateAccess(batch._id, { auditorEmails: auditors, viewerEmails: viewers });
            setMembers(res.data.members);
            toast.success('Access updated');
            onChanged?.();
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to update access'));
        } finally {
            setSaving(false);
        }
    };

    const byEmail = new Map((members || []).map(m => [m.email, m]));
    const noAccount = (members || []).filter(m => !m.hasAccount).map(m => m.email);

    return (
        <div className="space-y-4">
            <div className={PANEL}>
                <h2 className={`${H2} mb-3`}>Owner</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <b className="text-slate-800">{batch.createdBy?.name || '—'}</b>
                    <span className="text-sm text-slate-500">{batch.createdBy?.email}</span>
                    <Badge value="owner">{ROLE_LABEL.owner}</Badge>
                </div>
            </div>

            {canEdit ? (
                <div className={PANEL}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="acc-auditors" className={LABEL}>Auditors — view, edit and count ({auditors.length})</label>
                            <EmailListInput id="acc-auditors" value={auditors} onChange={setAuditors} exclude={viewers} />
                        </div>
                        <div>
                            <label htmlFor="acc-viewers" className={LABEL}>Viewers — view only ({viewers.length})</label>
                            <EmailListInput id="acc-viewers" value={viewers} onChange={setViewers} exclude={auditors} />
                        </div>
                    </div>
                    {noAccount.length > 0 && (
                        <p className="mt-3 text-xs font-semibold text-amber-700">
                            No portal account yet for: {noAccount.join(', ')}. Access starts once an account with that email exists.
                        </p>
                    )}
                    <div className="mt-4 flex justify-end">
                        <button type="button" onClick={save} disabled={!dirty || saving} className={PRIMARY}>
                            <MdSave size={18} /> {saving ? 'Saving…' : 'Save access'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className={PANEL}>
                    <h2 className={`${H2} mb-3`}>People with access</h2>
                    {[...(batch.auditorEmails || []).map(e => [e, 'auditor']), ...(batch.viewerEmails || []).map(e => [e, 'viewer'])].map(([email, role]) => (
                        <div key={email} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
                            <span className="text-sm font-bold text-slate-700">{byEmail.get(email)?.name || email}</span>
                            {byEmail.get(email)?.name && <span className="text-xs text-slate-500">{email}</span>}
                            <Badge value={role}>{ROLE_LABEL[role]}</Badge>
                        </div>
                    ))}
                    {!batch.auditorEmails?.length && !batch.viewerEmails?.length && <p className="text-sm text-slate-400">Only the owner.</p>}
                </div>
            )}

            <div className={NOTICE}>
                <MdInfoOutline size={18} className="flex-shrink-0 mt-0.5" />
                <ul className="space-y-1">
                    {ROLE_HELP.map(([role, text]) => <li key={role}><b>{ROLE_LABEL[role]}:</b> {text}</li>)}
                </ul>
            </div>
        </div>
    );
};

export default AccessTab;
