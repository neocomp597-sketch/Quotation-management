import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdOpenInNew } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { resolveImageUrl } from '../utils/helpers';
import MaterialSearchInput from '../components/bom/MaterialSearchInput';
import RowActionsMenu from '../components/bom/RowActionsMenu';
import {
    BOMBanner, BOMButton, BOMCard, CostSummary, Field, MessageBox, StatusBadge, cellInputClass, inputClass
} from '../components/bom/BOMLayout';
import {
    APPROVAL_STAGES, COMPONENT_TYPES, EDITABLE_STATUSES, STAGE_LABELS,
    apiErrorMessage, computeCost, formatDateTime, hasChildren, levelStyle, toInputDate, totalQty
} from '../components/bom/bomUi';

let rowSeq = 0;
const newRowKey = () => `row-${Date.now()}-${rowSeq++}`;

const emptyComponent = (level = 1) => ({
    rowKey: newRowKey(),
    level,
    componentCode: '',
    description: '',
    componentType: level === 1 ? 'Sub-Assembly' : 'Raw Material',
    materialGroup: '',
    qty: 1,
    uom: 'EA',
    scrapPercent: 0,
    operationNo: '',
    mandatory: true,
    rate: 0,
    remarks: '',
    productStatus: ''
});

const emptyOperation = () => ({ rowKey: newRowKey(), operationNo: '', description: '', workCenter: '', backflush: false, manualIssue: false, remarks: '' });

const initialHeader = () => ({
    fgItemCode: '',
    fgDescription: '',
    fgVersion: '',
    productCategory: '',
    plantId: '',
    productionUnit: '',
    baseQty: 1,
    baseUom: 'EA',
    bomType: 'Manufacturing',
    bomUsage: 'Production',
    alternativeBom: '',
    effectiveFrom: toInputDate(new Date()),
    effectiveTo: '',
    department: '',
    remarks: '',
    revisionReason: ''
});

const fromSaved = (bom) => ({
    header: {
        fgItemCode: bom.fgItemCode || '',
        fgDescription: bom.fgDescription || '',
        fgVersion: bom.fgVersion || '',
        productCategory: bom.productCategory || '',
        plantId: bom.plantId || '',
        productionUnit: bom.productionUnit || '',
        baseQty: bom.baseQty ?? '',
        baseUom: bom.baseUom || '',
        bomType: bom.bomType || 'Manufacturing',
        bomUsage: bom.bomUsage || 'Production',
        alternativeBom: bom.alternativeBom || '',
        effectiveFrom: toInputDate(bom.effectiveFrom),
        effectiveTo: toInputDate(bom.effectiveTo),
        department: bom.department || '',
        remarks: bom.remarks || '',
        revisionReason: bom.revisionReason || ''
    },
    components: (bom.components || []).map((component) => ({ ...component, rowKey: newRowKey(), qty: component.qty ?? '', scrapPercent: component.scrapPercent ?? 0, rate: component.rate ?? 0 })),
    operations: (bom.operations || []).map((operation) => ({ ...operation, rowKey: newRowKey() }))
});

// The two file pickers of the original form; other categories are attached from the view page.
const PICKER_CATEGORIES = ['Drawing / Specification', 'Reference Document'];

const AttachmentList = ({ attachments, pending, onRemove, onRemovePending, showCategory = false }) => {
    if (!attachments.length && !pending.length) return null;
    return (
        <ul className="mt-2 space-y-1">
            {attachments.map((attachment) => (
                <li key={attachment._id} className="flex items-center justify-between gap-2 text-[13px]">
                    <a href={resolveImageUrl(attachment.url)} target="_blank" rel="noreferrer" className="truncate font-semibold text-[#1f4e78] hover:underline">
                        {showCategory && <span className="mr-1.5 rounded bg-[#eef5fb] px-1.5 py-0.5 text-[11px] text-[#244c6c]">{attachment.category}</span>}
                        {attachment.fileName} <MdOpenInNew className="inline" size={12} />
                    </a>
                    <button type="button" onClick={() => onRemove(attachment)} className="shrink-0 text-[#b71c1c] hover:underline">Remove</button>
                </li>
            ))}
            {pending.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate text-slate-600">{item.file.name} <span className="text-[11px] text-amber-700">(uploads on save)</span></span>
                    <button type="button" onClick={() => onRemovePending(item.key)} className="shrink-0 text-[#b71c1c] hover:underline">Remove</button>
                </li>
            ))}
        </ul>
    );
};

const BOMForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const isNew = !id;

    const [options, setOptions] = useState({ plants: [], uoms: ['EA', 'KG', 'M', 'SET', 'LTR'], bomTypes: ['Manufacturing'], bomUsages: ['Production'] });
    const [saved, setSaved] = useState(null);
    const [loadedId, setLoadedId] = useState(isNew ? 'new' : null);
    const [header, setHeader] = useState(initialHeader);
    const [components, setComponents] = useState(() => [emptyComponent(1)]);
    const [operations, setOperations] = useState([]);
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState('');
    // Files picked before the BOM has been saved; uploaded right after the first save.
    const [pendingFiles, setPendingFiles] = useState([]);
    const topRef = useRef(null);

    useEffect(() => {
        bomService.getOptions()
            .then((res) => setOptions(res.data))
            .catch((err) => toast.error(apiErrorMessage(err, 'Could not load plants and UOMs')));
    }, []);

    useEffect(() => {
        if (isNew) return undefined;
        let cancelled = false;
        bomService.getById(id)
            .then((res) => {
                if (cancelled) return;
                if (!EDITABLE_STATUSES.includes(res.data.status) || !res.data.allowedActions?.edit) {
                    navigate(`/bom-master/${id}`, { replace: true });
                    return;
                }
                const next = fromSaved(res.data);
                setSaved(res.data);
                setHeader(next.header);
                setComponents(next.components.length ? next.components : [emptyComponent(1)]);
                setOperations(next.operations);
                setLoadedId(id);
            })
            .catch((err) => {
                if (!cancelled) {
                    toast.error(apiErrorMessage(err, 'Failed to load BOM'));
                    navigate('/bom-master');
                }
            });
        return () => { cancelled = true; };
    }, [id, isNew, navigate]);

    const cost = useMemo(() => computeCost(components), [components]);
    // FG, plant and alternative identify the BOM family, so they are fixed after the first revision.
    const familyLocked = Boolean(saved && saved.revisionNo > 1);
    const loading = loadedId !== (isNew ? 'new' : id);

    const showMessage = (next) => {
        setMessage(next);
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const setHeaderField = (field) => (event) => setHeader((prev) => ({ ...prev, [field]: event.target.value }));

    // ----- Component rows -----
    const updateRow = (index, patch) => setComponents((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const applyMaterial = (index, material) => updateRow(index, {
        componentCode: material.code,
        description: material.description,
        uom: material.uom || 'EA',
        materialGroup: material.materialGroup || '',
        rate: material.rate || 0,
        productStatus: material.status,
        ...(material.suggestedType ? { componentType: material.suggestedType } : {})
    });

    const addRow = () => setComponents((rows) => {
        const last = rows[rows.length - 1];
        return [...rows, emptyComponent(last ? last.level : 1)];
    });

    const insertBelow = (index, row) => setComponents((rows) => [...rows.slice(0, index + 1), row, ...rows.slice(index + 1)]);

    const duplicateRow = (index) => {
        const { _id, ...copy } = components[index];
        insertBelow(index, { ...copy, rowKey: newRowKey() });
    };

    const addChild = (index) => insertBelow(index, emptyComponent(Math.min(components[index].level + 1, 9)));

    const deleteRow = (index) => setComponents((rows) => (rows.length === 1 ? [emptyComponent(1)] : rows.filter((_, i) => i !== index)));

    const changeLevel = (index, delta) => setComponents((rows) => rows.map((row, i) => {
        if (i !== index) return row;
        const maxLevel = i === 0 ? 1 : Math.min(rows[i - 1].level + 1, 9);
        return { ...row, level: Math.max(1, Math.min(row.level + delta, maxLevel)) };
    }));

    const setLevel = (index, value) => {
        const level = Math.trunc(Number(value));
        updateRow(index, { level: Number.isFinite(level) ? Math.max(1, Math.min(level, 9)) : 1 });
    };

    const moveRow = (index, delta) => setComponents((rows) => {
        const target = index + delta;
        if (target < 0 || target >= rows.length) return rows;
        const next = [...rows];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
    });

    // ----- Routing rows -----
    const updateOperation = (index, patch) => setOperations((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    const addOperation = () => setOperations((rows) => {
        const lastNo = Number(rows[rows.length - 1]?.operationNo);
        return [...rows, { ...emptyOperation(), operationNo: Number.isFinite(lastNo) && lastNo > 0 ? String(lastNo + 10) : '10' }];
    });
    const operationNos = operations.map((operation) => operation.operationNo).filter(Boolean);

    // ----- Save / validate / submit -----
    const buildPayload = () => ({
        ...header,
        components: components.map(({ rowKey, productStatus, hasChildren: _h, totalQty: _t, amount: _a, ...rest }) => rest), // eslint-disable-line no-unused-vars
        operations: operations.map(({ rowKey, ...rest }) => rest), // eslint-disable-line no-unused-vars
        ...(saved ? { __v: saved.__v } : {})
    });

    const persist = async () => {
        if (!header.fgItemCode.trim() || !header.plantId) {
            showMessage({ type: 'error', text: 'Enter the FG Material Code and select a Plant before saving.' });
            return null;
        }
        const res = saved ? await bomService.update(saved._id, buildPayload()) : await bomService.create(buildPayload());
        let latest = res.data;
        if (pendingFiles.length) {
            latest = (await uploadFiles(latest._id, pendingFiles)) || latest;
            setPendingFiles([]);
        }
        const next = fromSaved(latest);
        setSaved(latest);
        setHeader(next.header);
        setComponents(next.components.length ? next.components : [emptyComponent(1)]);
        setOperations(next.operations);
        if (!saved) {
            setLoadedId(latest._id);
            navigate(`/bom-master/${latest._id}/edit`, { replace: true });
        }
        return latest;
    };

    const handleSaveDraft = async () => {
        setBusy('save');
        try {
            const result = await persist();
            if (result) {
                const issues = result.validation?.errors?.length || 0;
                // The first save moves from /new to /:id/edit, which remounts the form, so confirm with a toast too.
                toast.success(`Draft saved: ${result.bomNumber} ${result.revision}`);
                showMessage({
                    type: 'success',
                    text: `BOM draft saved (${result.bomNumber} ${result.revision}).${issues ? ` ${issues} issue(s) must be fixed before it can be submitted - use Validate BOM to see them.` : ''}`
                });
            }
        } catch (err) {
            showMessage({ type: 'error', text: apiErrorMessage(err, 'Could not save the BOM') });
        } finally {
            setBusy('');
        }
    };

    const handleValidate = async () => {
        setBusy('validate');
        try {
            const res = await bomService.validate(buildPayload());
            const { errors, warnings } = res.data;
            if (errors.length) {
                showMessage({ type: 'error', text: 'Please correct the following:', items: errors, warnings });
            } else {
                showMessage({ type: warnings.length ? 'warning' : 'success', text: 'BOM validation completed successfully.', warnings });
            }
        } catch (err) {
            showMessage({ type: 'error', text: apiErrorMessage(err, 'Validation failed') });
        } finally {
            setBusy('');
        }
    };

    const handleSubmit = async () => {
        setBusy('submit');
        try {
            const result = await persist();
            if (!result) return;
            await bomService.submit(result._id);
            toast.success(`${result.bomNumber} ${result.revision} submitted for approval`);
            navigate(`/bom-master/${result._id}`);
        } catch (err) {
            const data = err.response?.data;
            showMessage({ type: 'error', text: data?.message || 'Could not submit the BOM', items: data?.errors, warnings: data?.warnings });
        } finally {
            setBusy('');
        }
    };

    // ----- Attachments -----
    // Uploads files one by one; returns the BOM after the last successful upload.
    async function uploadFiles(bomId, files) {
        let latest = null;
        for (const { file, category } of files) {
            try {
                latest = (await bomService.addAttachment(bomId, file, category)).data;
            } catch (err) {
                toast.error(`${file.name}: ${apiErrorMessage(err, 'upload failed')}`);
            }
        }
        return latest;
    }

    const handlePickFiles = (category) => async (event) => {
        const files = [...(event.target.files || [])].map((file) => ({ key: newRowKey(), file, category }));
        event.target.value = '';
        if (!files.length) return;
        if (!saved) {
            setPendingFiles((prev) => [...prev, ...files]);
            return;
        }
        setBusy('attach');
        const latest = await uploadFiles(saved._id, files);
        if (latest) setSaved(latest);
        setBusy('');
    };

    const handleRemoveAttachment = async (attachment) => {
        if (!window.confirm(`Remove ${attachment.fileName}?`)) return;
        try {
            const res = await bomService.removeAttachment(saved._id, attachment._id);
            setSaved(res.data);
        } catch (err) {
            toast.error(apiErrorMessage(err, 'Could not remove attachment'));
        }
    };

    if (loading) {
        return (
            <div className="py-24 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1f4e78] border-t-transparent"></div>
            </div>
        );
    }

    const status = saved?.status || 'Draft';
    const otherAttachments = (saved?.attachments || []).filter((attachment) => !PICKER_CATEGORIES.includes(attachment.category));
    const approvalsByStage = Object.fromEntries((saved?.approvals || []).map((approval) => [approval.stage, approval]));

    return (
        <div ref={topRef} className="mx-auto max-w-[1450px] pb-4 text-[#263238]">
            <BOMBanner
                title="BOM Creation Form – Finished Good"
                subtitle={saved?.revisionNo > 1
                    ? `Revision ${saved.revision} of ${saved.bomNumber}. FG, plant and alternative are fixed for revisions.`
                    : 'Create and submit a multi-level Bill of Materials for a Finished Good.'}
            >
                <BOMButton variant="light" onClick={() => navigate(saved ? `/bom-master/${saved._id}` : '/bom-master')}>Back</BOMButton>
            </BOMBanner>

            <MessageBox message={message} onClose={() => setMessage(null)} />

            {/* 1. FG Master Details */}
            <BOMCard title="1. FG Master Details" right={<StatusBadge status={status} />}>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="FG Material Code" required>
                        <MaterialSearchInput
                            value={header.fgItemCode}
                            disabled={familyLocked}
                            placeholder="e.g. FG-10001"
                            className={inputClass}
                            onChange={(value) => setHeader((prev) => ({ ...prev, fgItemCode: value }))}
                            onSelect={(material) => setHeader((prev) => ({
                                ...prev,
                                fgItemCode: material.code,
                                fgDescription: material.description,
                                productCategory: prev.productCategory || material.materialGroup || '',
                                baseUom: material.uom || prev.baseUom
                            }))}
                        />
                    </Field>
                    <Field label="FG Material Description" required>
                        <input className={inputClass} value={header.fgDescription} onChange={setHeaderField('fgDescription')} placeholder="Finished product description" />
                    </Field>
                    <Field label="Revision No." required>
                        <input className={inputClass} value={saved?.revision || 'REV-01'} disabled />
                    </Field>
                    <Field label="FG Version">
                        <input className={inputClass} value={header.fgVersion} onChange={setHeaderField('fgVersion')} placeholder="e.g. V1" />
                    </Field>
                    <Field label="Product Category">
                        <input className={inputClass} value={header.productCategory} onChange={setHeaderField('productCategory')} placeholder="From Product Master" />
                    </Field>
                    <Field label="Plant / Location" required>
                        <select className={inputClass} value={header.plantId} onChange={setHeaderField('plantId')} disabled={familyLocked}>
                            <option value="">Select Plant</option>
                            {options.plants.map((plant) => <option key={plant._id} value={plant._id}>{plant.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Production Unit">
                        <input className={inputClass} value={header.productionUnit} onChange={setHeaderField('productionUnit')} placeholder="e.g. Assembly Line 1" />
                    </Field>
                    <Field label="Alternative BOM">
                        <input className={inputClass} value={header.alternativeBom} onChange={setHeaderField('alternativeBom')} disabled={familyLocked} placeholder="e.g. 01 (blank = main BOM)" />
                    </Field>
                    <Field label="Base Quantity" required>
                        <input className={inputClass} type="number" min="0.001" step="0.001" value={header.baseQty} onChange={setHeaderField('baseQty')} />
                    </Field>
                    <Field label="Base UOM" required>
                        <select className={inputClass} value={header.baseUom} onChange={setHeaderField('baseUom')}>
                            <option value="">Select UOM</option>
                            {options.uoms.map((uom) => <option key={uom}>{uom}</option>)}
                        </select>
                    </Field>
                    <Field label="BOM Type">
                        <select className={inputClass} value={header.bomType} onChange={setHeaderField('bomType')}>
                            {options.bomTypes.map((type) => <option key={type}>{type}</option>)}
                        </select>
                    </Field>
                    <Field label="BOM Usage" required>
                        <select className={inputClass} value={header.bomUsage} onChange={setHeaderField('bomUsage')}>
                            {options.bomUsages.map((usage) => <option key={usage}>{usage}</option>)}
                        </select>
                    </Field>
                    <Field label="Effective From" required>
                        <input className={inputClass} type="date" value={header.effectiveFrom} onChange={setHeaderField('effectiveFrom')} />
                    </Field>
                    <Field label="Effective To">
                        <input className={inputClass} type="date" value={header.effectiveTo} onChange={setHeaderField('effectiveTo')} />
                    </Field>
                    <Field label="Prepared By">
                        <input className={inputClass} value={saved?.preparedByName || user?.name || ''} disabled />
                    </Field>
                    <Field label="Department">
                        <input className={inputClass} value={header.department} onChange={setHeaderField('department')} placeholder="Engineering / Production / IT" />
                    </Field>
                    {saved?.revisionNo > 1 && (
                        <Field label="Reason for Revision" className="sm:col-span-2 lg:col-span-4">
                            <input className={inputClass} value={header.revisionReason} onChange={setHeaderField('revisionReason')} placeholder="What changed compared with the previous revision" />
                        </Field>
                    )}
                </div>
            </BOMCard>

            {/* 2. BOM Component Structure */}
            <BOMCard
                title="2. BOM Component Structure"
                right={<BOMButton variant="primary" onClick={addRow}><MdAdd className="-mt-0.5 mr-1 inline" size={16} />Add Component</BOMButton>}
            >
                <p className="mb-3 text-xs text-slate-500">
                    Search the component code to fill description, UOM, group and rate from Product Master. Set the Level (1 = directly under the FG, 2 = under the sub-assembly above it), or use the ⋯ menu on a row to add a child, duplicate, indent or move it.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1350px] border-collapse text-left">
                        <thead>
                            <tr>
                                {['Level', 'Component Code *', 'Description', 'Component Type', 'Qty *', 'UOM', 'Scrap %', 'Total Qty', 'Operation', 'Mandatory', 'Rate (₹)', 'Amount (₹)', 'Remarks', 'Action'].map((label) => (
                                    <th key={label} className="whitespace-nowrap border border-[#d7dee7] bg-[#eaf2f9] px-2 py-2 text-[11px] font-bold uppercase text-[#244c6c]">{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {components.map((row, index) => {
                                const style = levelStyle(row.level);
                                const parent = hasChildren(components, index);
                                const amount = (Number(row.qty) || 0) * (Number(row.rate) || 0);
                                return (
                                    <tr key={row.rowKey} className={style.row}>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <input
                                                type="number"
                                                min="1"
                                                max="9"
                                                aria-label="Level"
                                                value={row.level}
                                                onChange={(e) => setLevel(index, e.target.value)}
                                                className={`${cellInputClass} min-w-[65px] border-l-4 ${style.border} text-center font-bold`}
                                            />
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <div className={`border-l-4 ${style.border} pl-1.5`} style={{ marginLeft: `${(row.level - 1) * 16}px`, minWidth: '9rem' }}>
                                                <MaterialSearchInput
                                                    value={row.componentCode}
                                                    placeholder="RM-1001"
                                                    className={cellInputClass}
                                                    onChange={(value) => updateRow(index, { componentCode: value, productStatus: '' })}
                                                    onSelect={(material) => applyMaterial(index, material)}
                                                />
                                            </div>
                                            {row.productStatus && row.productStatus !== 'Active' && (
                                                <p className="mt-0.5 text-[11px] font-semibold text-[#c62828]">{row.productStatus} in Product Master</p>
                                            )}
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <input className={`${cellInputClass} min-w-[11rem]`} value={row.description} onChange={(e) => updateRow(index, { description: e.target.value })} placeholder="Component description" />
                                            {row.materialGroup && <p className="mt-0.5 text-[11px] text-slate-500">{row.materialGroup}</p>}
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <select className={`${cellInputClass} min-w-[8.5rem]`} value={row.componentType} onChange={(e) => updateRow(index, { componentType: e.target.value })}>
                                                {COMPONENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                                            </select>
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <input className={`${cellInputClass} min-w-[4.5rem]`} type="number" min="0" step="0.001" value={row.qty} onChange={(e) => updateRow(index, { qty: e.target.value })} />
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <select className={`${cellInputClass} min-w-[4.75rem]`} value={row.uom} onChange={(e) => updateRow(index, { uom: e.target.value })}>
                                                {!options.uoms.includes(row.uom) && row.uom && <option>{row.uom}</option>}
                                                {options.uoms.map((uom) => <option key={uom}>{uom}</option>)}
                                            </select>
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <input className={`${cellInputClass} min-w-[4rem]`} type="number" min="0" max="99.99" step="0.01" value={row.scrapPercent} onChange={(e) => updateRow(index, { scrapPercent: e.target.value })} />
                                        </td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-2 py-1.5 text-right text-sm font-semibold">
                                            {totalQty(row).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            {operationNos.length ? (
                                                <select className={`${cellInputClass} min-w-[4.5rem]`} value={row.operationNo} onChange={(e) => updateRow(index, { operationNo: e.target.value })}>
                                                    <option value="">-</option>
                                                    {!operationNos.includes(row.operationNo) && row.operationNo && <option>{row.operationNo}</option>}
                                                    {operationNos.map((no) => <option key={no}>{no}</option>)}
                                                </select>
                                            ) : (
                                                <input className={`${cellInputClass} min-w-[4rem]`} value={row.operationNo} onChange={(e) => updateRow(index, { operationNo: e.target.value })} placeholder="10" />
                                            )}
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <select className={`${cellInputClass} min-w-[4.25rem]`} value={row.mandatory === false ? 'No' : 'Yes'} onChange={(e) => updateRow(index, { mandatory: e.target.value === 'Yes' })}>
                                                <option>Yes</option>
                                                <option>No</option>
                                            </select>
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <input className={`${cellInputClass} min-w-[5.5rem]`} type="number" min="0" step="0.01" value={row.rate} disabled={parent} title={parent ? 'Assemblies are costed from their components' : ''} onChange={(e) => updateRow(index, { rate: e.target.value })} />
                                        </td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-2 py-1.5 text-right text-sm">
                                            {parent ? <span className="text-xs text-slate-400">from children</span> : amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <input className={`${cellInputClass} min-w-[8rem]`} value={row.remarks} onChange={(e) => updateRow(index, { remarks: e.target.value })} placeholder="Remarks" />
                                        </td>
                                        <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <BOMButton variant="danger" className="!px-2.5 !py-[7px]" onClick={() => deleteRow(index)}>Delete</BOMButton>
                                                <RowActionsMenu
                                                    actions={[
                                                        { label: 'Add component under this one', onClick: () => addChild(index) },
                                                        { label: 'Duplicate', onClick: () => duplicateRow(index) },
                                                        { label: 'Indent (one level down)', onClick: () => changeLevel(index, 1), disabled: index === 0 || row.level > components[index - 1].level },
                                                        { label: 'Outdent (one level up)', onClick: () => changeLevel(index, -1), disabled: row.level <= 1 },
                                                        { label: 'Move up', onClick: () => moveRow(index, -1), disabled: index === 0 },
                                                        { label: 'Move down', onClick: () => moveRow(index, 1), disabled: index === components.length - 1 }
                                                    ]}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </BOMCard>

            {/* 3. Cost Summary */}
            <BOMCard title="3. BOM Cost Summary">
                <CostSummary cost={cost} />
                <p className="mb-0 mt-3 text-xs text-slate-500">
                    Rates default to the Product Master base price and can be changed per row. Assemblies with lower-level components are costed from those components. Packing Material rows count as packing cost; scrap cost is amount × scrap %.
                </p>
            </BOMCard>

            {/* 4. Supporting Documents & Remarks */}
            <BOMCard title="4. Supporting Documents & Remarks">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                    {PICKER_CATEGORIES.map((category) => (
                        <Field key={category} label={category}>
                            <input
                                type="file"
                                multiple
                                aria-label={category}
                                accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.dwg,.dxf"
                                disabled={busy === 'attach'}
                                onChange={handlePickFiles(category)}
                                className={inputClass}
                            />
                            <AttachmentList
                                attachments={(saved?.attachments || []).filter((attachment) => attachment.category === category)}
                                pending={pendingFiles.filter((item) => item.category === category)}
                                onRemove={handleRemoveAttachment}
                                onRemovePending={(key) => setPendingFiles((prev) => prev.filter((item) => item.key !== key))}
                            />
                        </Field>
                    ))}
                    <Field label="Remarks" className="sm:col-span-2">
                        <textarea className={`${inputClass} min-h-[80px] resize-y`} value={header.remarks} onChange={setHeaderField('remarks')} placeholder="Enter engineering, production or approval remarks..." />
                    </Field>
                </div>
                {otherAttachments.length > 0 && (
                    <div className="mt-3">
                        <p className="mb-1.5 text-[13px] font-semibold">Other documents</p>
                        <AttachmentList attachments={otherAttachments} pending={[]} onRemove={handleRemoveAttachment} showCategory />
                    </div>
                )}
                <p className="mb-0 mt-2 text-xs text-slate-500">PDF, XLSX, DOCX, JPG, PNG, DWG - up to 20 MB each.{!saved && ' Files are uploaded when you save the draft.'}</p>
            </BOMCard>

            {/* 5. Approval Workflow */}
            <BOMCard title="5. Approval Workflow">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border border-[#d7dee7] bg-[#f7f9fb] p-3">
                        <p className="text-xs font-semibold text-slate-500">Prepared By</p>
                        <p className="text-sm font-semibold">{saved?.preparedByName || user?.name || '-'}</p>
                    </div>
                    {APPROVAL_STAGES.map((stage) => {
                        const approval = approvalsByStage[stage];
                        return (
                            <div key={stage} className="rounded-lg border border-[#d7dee7] bg-[#f7f9fb] p-3">
                                <p className="text-xs font-semibold text-slate-500">{STAGE_LABELS[stage]}</p>
                                <p className="text-sm font-semibold">{approval ? approval.byName : 'Pending'}</p>
                                {approval && <p className="text-[11px] text-slate-500">{formatDateTime(approval.at)}</p>}
                            </div>
                        );
                    })}
                </div>
                <p className="mb-0 mt-3 text-xs text-slate-500">
                    Draft → Checked → Engineering → Finance / Costing → Management → Release (Active). Approvers act from the BOM view page after you submit.
                    {status === 'Revision Required' && ' This BOM was sent back; fix it and submit again - approvals restart from Checked.'}
                </p>
            </BOMCard>

            {/* 6. Operation / Routing (from the BOM specification; the original form has no routing) */}
            <BOMCard
                title="6. Operation / Routing"
                right={<BOMButton variant="primary" onClick={addOperation}><MdAdd className="-mt-0.5 mr-1 inline" size={16} />Add Operation</BOMButton>}
            >
                {operations.length === 0 ? (
                    <p className="text-sm text-slate-500">No routing yet. Add operations if the BOM is tied to production steps; component rows can then be allocated to an operation.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] border-collapse text-left">
                            <thead>
                                <tr>
                                    {['Operation No.', 'Operation Description', 'Work Center', 'Components Allocated', 'Backflush', 'Manual Issue', 'Remarks', 'Action'].map((label) => (
                                        <th key={label} className="whitespace-nowrap border border-[#d7dee7] bg-[#eaf2f9] px-2 py-2 text-[11px] font-bold uppercase text-[#244c6c]">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {operations.map((operation, index) => {
                                    const allocated = components.filter((c) => c.operationNo && c.operationNo === operation.operationNo).map((c) => c.componentCode || '(blank)');
                                    return (
                                        <tr key={operation.rowKey}>
                                            <td className="border border-[#d7dee7] px-1.5 py-1.5"><input className={`${cellInputClass} min-w-[4.5rem]`} value={operation.operationNo} onChange={(e) => updateOperation(index, { operationNo: e.target.value })} /></td>
                                            <td className="border border-[#d7dee7] px-1.5 py-1.5"><input className={cellInputClass} value={operation.description} onChange={(e) => updateOperation(index, { description: e.target.value })} placeholder="e.g. Cutting" /></td>
                                            <td className="border border-[#d7dee7] px-1.5 py-1.5"><input className={cellInputClass} value={operation.workCenter} onChange={(e) => updateOperation(index, { workCenter: e.target.value })} placeholder="e.g. WC-CUT-01" /></td>
                                            <td className="border border-[#d7dee7] px-2 py-1.5 text-xs text-slate-600">{allocated.join(', ') || '-'}</td>
                                            <td className="border border-[#d7dee7] px-2 py-1.5 text-center"><input type="checkbox" checked={operation.backflush} onChange={(e) => updateOperation(index, { backflush: e.target.checked })} /></td>
                                            <td className="border border-[#d7dee7] px-2 py-1.5 text-center"><input type="checkbox" checked={operation.manualIssue} onChange={(e) => updateOperation(index, { manualIssue: e.target.checked })} /></td>
                                            <td className="border border-[#d7dee7] px-1.5 py-1.5"><input className={cellInputClass} value={operation.remarks} onChange={(e) => updateOperation(index, { remarks: e.target.value })} /></td>
                                            <td className="border border-[#d7dee7] px-1.5 py-1.5">
                                                <BOMButton variant="danger" className="!px-2 !py-1" onClick={() => setOperations((rows) => rows.filter((_, i) => i !== index))}>Delete</BOMButton>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </BOMCard>

            {/* Footer */}
            <div className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-[10px] border border-[#d7dee7] bg-white px-5 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between print:hidden">
                <div className="text-sm">
                    <strong>BOM No.:</strong> {saved ? `${saved.bomNumber} · ${saved.revision}` : 'Will be generated on save'}
                    <span className="ml-4 text-slate-500">Estimated cost: <strong className="text-[#1f4e78]">₹ {cost.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
                <div className="flex flex-wrap justify-end gap-2.5">
                    <BOMButton onClick={handleSaveDraft} disabled={Boolean(busy)}>{busy === 'save' ? 'Saving...' : 'Save Draft'}</BOMButton>
                    <BOMButton onClick={handleValidate} disabled={Boolean(busy)}>{busy === 'validate' ? 'Validating...' : 'Validate BOM'}</BOMButton>
                    <BOMButton variant="success" onClick={handleSubmit} disabled={Boolean(busy)}>{busy === 'submit' ? 'Submitting...' : 'Submit for Approval'}</BOMButton>
                    <BOMButton variant="primary" onClick={() => window.print()}>Print</BOMButton>
                </div>
            </div>
        </div>
    );
};

export default BOMForm;
