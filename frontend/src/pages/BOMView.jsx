import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MdAttachFile, MdCheckCircle, MdOpenInNew, MdRadioButtonUnchecked, MdSchedule } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';
import Modal from '../components/Modal';
import BOMComponentsTable from '../components/bom/BOMComponentsTable';
import {
    BOMBanner, BOMButton, BOMCard, CostSummary, Field, MessageBox, ReadField, StatusBadge, inputClass
} from '../components/bom/BOMLayout';
import {
    APPROVAL_STAGES, ATTACHMENT_CATEGORIES, STAGE_LABELS, apiErrorMessage, formatDate, formatDateTime
} from '../components/bom/bomUi';

// Actions that open the remarks dialog. `required` = remarks must be entered.
const ACTIONS = {
    approve: { label: 'Approve', variant: 'success', required: false, call: bomService.approve, done: 'Approved' },
    sendBack: { label: 'Send Back for Revision', variant: 'secondary', required: true, call: bomService.sendBack, done: 'Sent back to the preparer' },
    reject: { label: 'Reject', variant: 'danger', required: true, call: bomService.reject, done: 'Rejected' },
    release: { label: 'Release BOM', variant: 'success', required: false, call: bomService.release, done: 'Released - this revision is now Active' },
    obsolete: { label: 'Make Obsolete', variant: 'danger', required: true, call: bomService.obsolete, done: 'Marked obsolete' },
    revise: { label: 'Create Revision', variant: 'primary', required: false, call: bomService.revise, done: 'New revision created', field: 'Reason for revision' },
    submit: { label: 'Submit for Approval', variant: 'success', required: false, call: bomService.submit, done: 'Submitted for approval' }
};

const BOMView = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [result, setResult] = useState({ id: null, bom: null, error: '' });
    const [dialog, setDialog] = useState(null);
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [attachmentCategory, setAttachmentCategory] = useState('Approval Document');
    const fileInputRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        bomService.getById(id)
            .then((res) => { if (!cancelled) setResult({ id, bom: res.data, error: '' }); })
            .catch((err) => { if (!cancelled) setResult({ id, bom: null, error: apiErrorMessage(err, 'Failed to load BOM') }); });
        return () => { cancelled = true; };
    }, [id]);

    const { bom } = result;
    const setBom = (next) => setResult({ id, bom: next, error: '' });

    const openDialog = (key) => {
        setRemarks('');
        setDialog(key);
    };

    const runAction = async () => {
        const action = ACTIONS[dialog];
        if (action.required && !remarks.trim()) {
            toast.error('Please enter the reason in remarks');
            return;
        }
        setBusy(true);
        try {
            const res = await action.call(bom._id, remarks.trim());
            toast.success(action.done);
            setDialog(null);
            setMessage(null);
            if (dialog === 'revise') {
                navigate(`/bom-master/${res.data._id}/edit`);
            } else {
                setBom(res.data);
            }
        } catch (err) {
            const data = err.response?.data;
            setDialog(null);
            setMessage({ type: 'error', text: data?.message || 'Action failed', items: data?.errors, warnings: data?.warnings });
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete draft ${bom.bomNumber} ${bom.revision}? This cannot be undone.`)) return;
        try {
            await bomService.delete(bom._id);
            toast.success('Draft deleted');
            navigate('/bom-master');
        } catch (err) {
            toast.error(apiErrorMessage(err, 'Could not delete'));
        }
    };

    const handleAttach = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const res = await bomService.addAttachment(bom._id, file, attachmentCategory);
            setBom(res.data);
            toast.success(`${file.name} attached`);
        } catch (err) {
            toast.error(apiErrorMessage(err, 'Upload failed'));
        }
    };

    if (result.id !== id) {
        return (
            <div className="py-24 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1f4e78] border-t-transparent"></div>
            </div>
        );
    }
    if (result.error) {
        return <p className="rounded-xl bg-white p-8 text-center text-sm font-medium text-rose-500">{result.error}</p>;
    }

    const allowed = bom.allowedActions || {};
    const approvalsByStage = Object.fromEntries((bom.approvals || []).map((approval) => [approval.stage, approval]));
    const inReview = ['Submitted', 'Under Review'].includes(bom.status);
    const stageIndex = APPROVAL_STAGES.indexOf(bom.currentStage);

    return (
        <div className="mx-auto max-w-[1450px] pb-6 text-[#263238]">
            <BOMBanner
                title={`${bom.fgItemCode} – ${bom.fgDescription || 'BOM'}`}
                subtitle={`${bom.bomNumber} · ${bom.revision} · ${bom.plantName}${bom.alternativeBom ? ` · Alt ${bom.alternativeBom}` : ''}`}
            >
                <BOMButton variant="light" onClick={() => navigate('/bom-master')}>Back to list</BOMButton>
                <BOMButton variant="light" onClick={() => window.print()}>Print</BOMButton>
            </BOMBanner>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2.5 border-x border-b border-[#d7dee7] bg-white px-5 py-3 print:hidden">
                <StatusBadge status={bom.status} stage={inReview ? `Waiting: ${STAGE_LABELS[bom.currentStage]}` : ''} />
                <div className="ml-auto flex flex-wrap gap-2">
                    {allowed.edit && <BOMButton variant="primary" onClick={() => navigate(`/bom-master/${bom._id}/edit`)}>Edit</BOMButton>}
                    {allowed.submit && <BOMButton variant="success" onClick={() => openDialog('submit')}>Submit for Approval</BOMButton>}
                    {allowed.approve && <BOMButton variant="success" onClick={() => openDialog('approve')}>Approve ({STAGE_LABELS[bom.currentStage]})</BOMButton>}
                    {allowed.sendBack && <BOMButton onClick={() => openDialog('sendBack')}>Send Back</BOMButton>}
                    {allowed.reject && <BOMButton variant="danger" onClick={() => openDialog('reject')}>Reject</BOMButton>}
                    {allowed.release && <BOMButton variant="success" onClick={() => openDialog('release')}>Release BOM</BOMButton>}
                    {allowed.revise && <BOMButton variant="primary" onClick={() => openDialog('revise')}>Create Revision</BOMButton>}
                    {allowed.obsolete && <BOMButton variant="danger" onClick={() => openDialog('obsolete')}>Make Obsolete</BOMButton>}
                    {allowed.delete && <BOMButton variant="danger" onClick={handleDelete}>Delete Draft</BOMButton>}
                </div>
            </div>
            {inReview && !allowed.approve && (
                <p className="border-x border-b border-[#d7dee7] bg-[#f7f9fb] px-5 py-2 text-xs text-slate-500 print:hidden">
                    Waiting for {STAGE_LABELS[bom.currentStage]}. You can't act on this stage: it needs that approval right, and the preparer can't approve their own BOM.
                </p>
            )}

            <MessageBox message={message} onClose={() => setMessage(null)} />
            {bom.validation?.errors?.length > 0 && !message && (
                <MessageBox message={{ type: 'warning', text: 'This draft is not ready to submit yet:', items: bom.validation.errors }} />
            )}

            <BOMCard title="1. FG Master Details" right={<StatusBadge status={bom.status} />}>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <ReadField label="FG Material Code">{bom.fgItemCode}</ReadField>
                    <ReadField label="FG Material Description">{bom.fgDescription}</ReadField>
                    <ReadField label="BOM No. / Revision">{bom.bomNumber} · {bom.revision}</ReadField>
                    <ReadField label="FG Version">{bom.fgVersion}</ReadField>
                    <ReadField label="Product Category">{bom.productCategory}</ReadField>
                    <ReadField label="Plant / Location">{bom.plantName}</ReadField>
                    <ReadField label="Production Unit">{bom.productionUnit}</ReadField>
                    <ReadField label="Alternative BOM">{bom.alternativeBom || 'Main'}</ReadField>
                    <ReadField label="Base Quantity">{bom.baseQty} {bom.baseUom}</ReadField>
                    <ReadField label="BOM Type / Usage">{bom.bomType} / {bom.bomUsage}</ReadField>
                    <ReadField label="Effective From">{formatDate(bom.effectiveFrom)}</ReadField>
                    <ReadField label="Effective To">{bom.effectiveTo ? formatDate(bom.effectiveTo) : 'Open'}</ReadField>
                    <ReadField label="Prepared By">{bom.preparedByName} · {formatDate(bom.createdAt)}</ReadField>
                    <ReadField label="Department">{bom.department}</ReadField>
                    {bom.revisionReason && <ReadField label="Reason for Revision">{bom.revisionReason}</ReadField>}
                </div>
            </BOMCard>

            <BOMCard title="2. BOM Component Structure" right={<span className="text-sm text-slate-500">{bom.components.length} components</span>}>
                <BOMComponentsTable components={bom.components} />
            </BOMCard>

            <BOMCard title="3. BOM Cost Summary">
                <CostSummary cost={bom.cost || {}} />
            </BOMCard>

            <BOMCard title="4. Supporting Documents & Remarks">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                        {(bom.attachments || []).length === 0 && <p className="text-sm text-slate-500">No documents attached.</p>}
                        <ul className="space-y-1.5">
                            {(bom.attachments || []).map((attachment) => (
                                <li key={attachment._id} className="rounded-md border border-[#d7dee7] px-3 py-2 text-sm">
                                    <a href={resolveImageUrl(attachment.url)} target="_blank" rel="noreferrer" className="font-semibold text-[#1f4e78] hover:underline">
                                        <span className="mr-2 rounded bg-[#eef5fb] px-1.5 py-0.5 text-[11px] text-[#244c6c]">{attachment.category}</span>
                                        {attachment.fileName} <MdOpenInNew className="inline" size={13} />
                                    </a>
                                    <span className="ml-2 text-xs text-slate-500">{attachment.uploadedByName} · {formatDateTime(attachment.uploadedAt)}</span>
                                </li>
                            ))}
                        </ul>
                        {allowed.addAttachment && (
                            <div className="mt-3 flex flex-wrap items-end gap-2 print:hidden">
                                <select className={`${inputClass} w-52`} value={attachmentCategory} onChange={(e) => setAttachmentCategory(e.target.value)}>
                                    {ATTACHMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                                </select>
                                <BOMButton variant="primary" onClick={() => fileInputRef.current?.click()}><MdAttachFile className="-mt-0.5 mr-1 inline" size={16} />Upload File</BOMButton>
                                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.dwg,.dxf" onChange={handleAttach} />
                            </div>
                        )}
                    </div>
                    <ReadField label="Remarks">{bom.remarks}</ReadField>
                </div>
            </BOMCard>

            <BOMCard title="5. Approval Workflow">
                <ol className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <li className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><MdCheckCircle /> Prepared By</p>
                        <p className="text-sm font-semibold">{bom.preparedByName || '-'}</p>
                        <p className="text-[11px] text-slate-500">{formatDateTime(bom.submittedAt || bom.createdAt)}</p>
                    </li>
                    {APPROVAL_STAGES.map((stage, index) => {
                        const approval = approvalsByStage[stage];
                        const isCurrent = inReview && index === stageIndex;
                        const tone = approval ? 'border-emerald-200 bg-emerald-50' : isCurrent ? 'border-[#1f4e78] bg-[#eef5fb]' : 'border-[#d7dee7] bg-[#f7f9fb]';
                        return (
                            <li key={stage} className={`rounded-lg border p-3 ${tone}`}>
                                <p className={`flex items-center gap-1 text-xs font-semibold ${approval ? 'text-emerald-700' : isCurrent ? 'text-[#1f4e78]' : 'text-slate-500'}`}>
                                    {approval ? <MdCheckCircle /> : isCurrent ? <MdSchedule /> : <MdRadioButtonUnchecked />} {STAGE_LABELS[stage]}
                                </p>
                                <p className="text-sm font-semibold">{approval ? approval.byName : isCurrent ? 'Waiting' : 'Pending'}</p>
                                {approval && <p className="text-[11px] text-slate-500">{formatDateTime(approval.at)}</p>}
                                {approval?.remarks && <p className="mt-1 text-xs italic text-slate-600">"{approval.remarks}"</p>}
                            </li>
                        );
                    })}
                    <li className={`rounded-lg border p-3 ${bom.status === 'Active' ? 'border-emerald-200 bg-emerald-50' : 'border-[#d7dee7] bg-[#f7f9fb]'}`}>
                        <p className={`flex items-center gap-1 text-xs font-semibold ${bom.releasedAt ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {bom.releasedAt ? <MdCheckCircle /> : <MdRadioButtonUnchecked />} Released (Active)
                        </p>
                        <p className="text-sm font-semibold">{bom.releasedAt ? formatDate(bom.releasedAt) : 'Not released'}</p>
                    </li>
                </ol>
            </BOMCard>

            {bom.operations?.length > 0 && (
                <BOMCard title="6. Operation / Routing">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                            <thead>
                                <tr>
                                    {['Operation No.', 'Description', 'Work Center', 'Components', 'Backflush', 'Manual Issue', 'Remarks'].map((label) => (
                                        <th key={label} className="border border-[#d7dee7] bg-[#eaf2f9] px-3 py-2 text-[11px] font-bold uppercase text-[#244c6c]">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bom.operations.map((operation) => (
                                    <tr key={operation._id}>
                                        <td className="border border-[#d7dee7] px-3 py-2 font-semibold">{operation.operationNo}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{operation.description}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{operation.workCenter}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2 text-xs">
                                            {bom.components.filter((c) => c.operationNo === operation.operationNo).map((c) => c.componentCode).join(', ') || '-'}
                                        </td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{operation.backflush ? 'Yes' : 'No'}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{operation.manualIssue ? 'Yes' : 'No'}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{operation.remarks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </BOMCard>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BOMCard title="Revisions" className="!my-0">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr>
                                {['Revision', 'Status', 'Effective From', 'Effective To'].map((label) => (
                                    <th key={label} className="border border-[#d7dee7] bg-[#eaf2f9] px-3 py-2 text-[11px] font-bold uppercase text-[#244c6c]">{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(bom.revisions || []).map((revision) => (
                                <tr key={revision._id} className={String(revision._id) === String(bom._id) ? 'bg-[#eef5fb]' : ''}>
                                    <td className="border border-[#d7dee7] px-3 py-2">
                                        {String(revision._id) === String(bom._id)
                                            ? <strong>{revision.revision} (this)</strong>
                                            : <Link to={`/bom-master/${revision._id}`} className="font-semibold text-[#1f4e78] hover:underline">{revision.revision}</Link>}
                                    </td>
                                    <td className="border border-[#d7dee7] px-3 py-2"><StatusBadge status={revision.status} /></td>
                                    <td className="border border-[#d7dee7] px-3 py-2">{formatDate(revision.effectiveFrom)}</td>
                                    <td className="border border-[#d7dee7] px-3 py-2">{revision.effectiveTo ? formatDate(revision.effectiveTo) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </BOMCard>

                <BOMCard title="History" className="!my-0">
                    <ol className="max-h-80 space-y-2 overflow-auto">
                        {[...(bom.history || [])].reverse().map((entry, index) => (
                            <li key={index} className="border-l-2 border-[#1f4e78] pl-3 text-sm">
                                <p className="font-semibold">
                                    {entry.action}
                                    {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus && (
                                        <span className="ml-2 text-xs font-normal text-slate-500">{entry.fromStatus} → {entry.toStatus}</span>
                                    )}
                                </p>
                                <p className="text-xs text-slate-500">{entry.byName} · {formatDateTime(entry.at)}</p>
                                {entry.remarks && <p className="text-xs italic text-slate-600">"{entry.remarks}"</p>}
                            </li>
                        ))}
                    </ol>
                </BOMCard>
            </div>

            <Modal
                isOpen={Boolean(dialog)}
                onClose={() => !busy && setDialog(null)}
                title={dialog ? `${ACTIONS[dialog].label} – ${bom.bomNumber} ${bom.revision}` : ''}
                maxWidth="max-w-lg"
            >
                {dialog && (
                    <div className="space-y-4">
                        {dialog === 'release' && <p className="text-sm text-slate-600">This revision becomes the Active BOM. Any currently Active revision of this BOM becomes Obsolete.</p>}
                        {dialog === 'revise' && <p className="text-sm text-slate-600">A new Draft revision is created as a copy of {bom.revision}. It goes through approval again before it replaces the Active BOM.</p>}
                        {dialog === 'reject' && <p className="text-sm text-slate-600">Rejecting closes this revision. Use Send Back instead if the preparer should correct and resubmit it.</p>}
                        <Field label={ACTIONS[dialog].field || 'Remarks'} required={ACTIONS[dialog].required}>
                            <textarea className={`${inputClass} min-h-[90px]`} value={remarks} onChange={(e) => setRemarks(e.target.value)} autoFocus />
                        </Field>
                        <div className="flex justify-end gap-2">
                            <BOMButton onClick={() => setDialog(null)} disabled={busy}>Cancel</BOMButton>
                            <BOMButton variant={ACTIONS[dialog].variant === 'secondary' ? 'primary' : ACTIONS[dialog].variant} onClick={runAction} disabled={busy}>
                                {busy ? 'Please wait...' : ACTIONS[dialog].label}
                            </BOMButton>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default BOMView;
