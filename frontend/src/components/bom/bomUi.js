// Shared display helpers for the BOM screens. Cost logic mirrors backend/services/bomService.js computeCost.

export const APPROVAL_STAGES = ['Checked', 'Engineering', 'Finance', 'Management'];
export const STAGE_LABELS = {
    Checked: 'Checked By',
    Engineering: 'Engineering Approval',
    Finance: 'Finance / Costing Review',
    Management: 'Management Approval'
};
export const COMPONENT_TYPES = ['Raw Material', 'Bought Out', 'Sub-Assembly', 'Consumable', 'Packing Material', 'Semi-Finished', 'Service', 'Other'];
export const ATTACHMENT_CATEGORIES = ['Drawing / Specification', 'Reference Document', 'Datasheet', 'Engineering Document', 'Approval Document', 'Other'];
export const EDITABLE_STATUSES = ['Draft', 'Revision Required'];

export const STATUS_STYLES = {
    Draft: 'bg-amber-100 text-amber-800',
    Submitted: 'bg-sky-100 text-sky-800',
    'Under Review': 'bg-indigo-100 text-indigo-800',
    Approved: 'bg-teal-100 text-teal-800',
    Active: 'bg-emerald-100 text-emerald-800',
    Rejected: 'bg-rose-100 text-rose-800',
    'Revision Required': 'bg-orange-100 text-orange-800',
    Obsolete: 'bg-slate-200 text-slate-600'
};

// Each level gets its own colour so the structure reads at a glance.
export const LEVEL_STYLES = [
    { badge: 'bg-[#1f4e78] text-white', row: 'bg-[#eef5fb]', border: 'border-l-[#1f4e78]' },
    { badge: 'bg-emerald-600 text-white', row: 'bg-white', border: 'border-l-emerald-500' },
    { badge: 'bg-amber-500 text-white', row: 'bg-white', border: 'border-l-amber-400' },
    { badge: 'bg-violet-500 text-white', row: 'bg-white', border: 'border-l-violet-400' },
    { badge: 'bg-slate-500 text-white', row: 'bg-white', border: 'border-l-slate-400' }
];
export const levelStyle = (level) => LEVEL_STYLES[Math.min(Math.max((Number(level) || 1) - 1, 0), LEVEL_STYLES.length - 1)];

export const formatCurrency = (value) => `₹ ${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
export const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : '-');
export const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const totalQty = (component) => num(component.qty) * (1 + num(component.scrapPercent) / 100);

// Rows followed by a deeper level are assemblies; their cost is their children's cost.
export const hasChildren = (components, index) => index + 1 < components.length
    && num(components[index + 1].level) > num(components[index].level);

export const computeCost = (components) => {
    const cost = { material: 0, scrap: 0, packing: 0, total: 0 };
    components.forEach((component, index) => {
        if (hasChildren(components, index)) return;
        const amount = num(component.qty) * num(component.rate);
        if (component.componentType === 'Packing Material') cost.packing += amount;
        else cost.material += amount;
        cost.scrap += amount * num(component.scrapPercent) / 100;
    });
    cost.total = cost.material + cost.scrap + cost.packing;
    return cost;
};

export const apiErrorMessage = (err, fallback) => err?.response?.data?.message || fallback;
