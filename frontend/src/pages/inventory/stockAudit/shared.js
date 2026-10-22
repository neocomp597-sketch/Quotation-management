import * as XLSX from 'xlsx';

// Styles shared by the stock audit screens (same look as the Type Test Register).
export const INPUT = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white disabled:opacity-60';
export const LABEL = 'block text-xs font-bold text-slate-500 mb-1 uppercase';
export const PANEL = 'min-w-0 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm';
export const TH = 'py-3 px-3 text-left text-xs font-bold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100 whitespace-nowrap';
export const TD = 'py-2.5 px-3 align-top border-b border-slate-50 text-sm font-semibold text-slate-600';
export const TDN = `${TD} whitespace-nowrap`;
export const TDR = `${TDN} text-right tabular-nums`;
export const PRIMARY = 'flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-black rounded-xl shadow-md hover:shadow-lg transition-all';
export const SECONDARY = 'flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-sm font-black rounded-xl transition-all disabled:opacity-60';
export const DANGER = 'flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-black rounded-xl transition-all disabled:opacity-60';
export const SMALL = 'whitespace-nowrap px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 rounded-lg text-xs font-bold text-slate-600 transition disabled:opacity-50';
export const NOTICE = 'flex items-start gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-[13px] font-semibold';
export const H2 = 'text-sm font-black text-slate-800 uppercase tracking-wide';

export const ROLE_LABEL = { owner: 'Owner', auditor: 'Auditor', viewer: 'Viewer' };

const qtyFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
// ₹35.3L / ₹1.2Cr, for small KPI tiles (the full amount goes in the tooltip).
const moneyShortFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
// U+2212 minus: a line never breaks between it and the number, unlike "-".
const minus = (text) => text.replace(/^-/, '−');
const isBlank = (n) => n === null || n === undefined || n === '';
export const fmtQty = (n) => (isBlank(n) ? '—' : minus(qtyFormat.format(Number(n))));
export const fmtMoney = (n) => (isBlank(n) ? '—' : minus(moneyFormat.format(Number(n))));
export const fmtMoneyShort = (n) => (isBlank(n) ? '—' : minus(moneyShortFormat.format(Number(n))));
export const fmtSigned = (n, format = fmtQty) => {
    if (isBlank(n)) return '—';
    const v = Number(n);
    return v > 0 ? `+${format(v)}` : format(v);
};
export const varianceTone = (n) => (Number(n) < 0 ? 'text-rose-600' : Number(n) > 0 ? 'text-violet-600' : 'text-emerald-600');
export const pct = (n) => (n === null || n === undefined ? '—' : `${n}%`);

export const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

// Where the line sits: warehouse · bin · batch/serial.
export const locationText = (line) => [line.warehouseCode, line.binLocation && `Bin ${line.binLocation}`, line.batchNumber && `Batch ${line.batchNumber}`]
    .filter(Boolean).join(' · ');

export const downloadBlob = (data, fileName) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

// Columns of the import template. SAP B1 exports work as they are: the server also accepts
// ItemCode / ItemName / WhsCode / OnHand / AvgPrice / BinCode / DistNumber and similar captions.
export const TEMPLATE_COLUMNS = ['Item Code', 'Item Name', 'Item Group', 'UoM', 'Warehouse Code', 'Warehouse Name', 'Bin Location', 'Batch Number', 'SAP Qty', 'Unit Price'];

export const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
        TEMPLATE_COLUMNS,
        ['FG-1001', 'AIS VCB Panel 33KV', 'Finished Goods', 'NOS', 'USG-FG', 'Usgaon FG Store', 'R1-A2', '', 4, 285000],
        ['RM-2040', 'CT 100/5A', 'Raw Material', 'NOS', 'USG-RM', 'Usgaon RM Store', 'R3-B1', 'B2410-07', 120, 1450]
    ]);
    sheet['!cols'] = [14, 30, 16, 8, 16, 20, 14, 14, 10, 12].map(wch => ({ wch }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'SAP Stock');
    XLSX.writeFile(book, 'stock_audit_scope_template.xlsx');
};

const headerKey = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CODE_HEADERS = ['itemcode', 'itemno', 'itemnumber', 'sku', 'productcode', 'materialcode', 'code', 'item'];
const QTY_HEADERS = ['sapqty', 'sapquantity', 'instock', 'onhand', 'bookqty', 'systemqty', 'stockqty', 'quantity', 'qty', 'stock'];

/**
 * Reads the first sheet of an SAP B1 export (or our template). SAP reports often print a
 * title or filter lines above the column header, so the header is the first of the top 15
 * rows that names both an item code column and a quantity column. Each row comes back
 * keyed by its column caption, with `_row` = its row number in the sheet.
 */
export const readScopeWorkbook = async (file) => {
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new Error('The file has no sheets.');
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: true });
    const headerIndex = grid.slice(0, 15).findIndex(row => {
        const keys = row.map(headerKey);
        return keys.some(k => CODE_HEADERS.includes(k)) && keys.some(k => QTY_HEADERS.includes(k));
    });
    if (headerIndex === -1) {
        throw new Error('Could not find the column header. The sheet needs an Item Code column and a quantity column (SAP Qty / In Stock / OnHand).');
    }
    const headers = grid[headerIndex].map(h => String(h ?? '').trim());
    const rows = [];
    for (let i = headerIndex + 1; i < grid.length; i += 1) {
        const cells = grid[i];
        if (!cells || cells.every(c => String(c ?? '').trim() === '')) continue;
        const row = { _row: i + 1 };
        headers.forEach((h, col) => { if (h) row[h] = cells[col]; });
        rows.push(row);
    }
    return { headers: headers.filter(Boolean), rows, sheetName: book.SheetNames[0] };
};

// Batch details form <-> API.
export const AUDIT_TYPES = ['Perpetual', 'Cycle Count', 'Full Physical', 'Spot Check'];

const toInputDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');
const toInputDateTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const emptyBatchForm = () => ({
    name: '', auditType: 'Perpetual', description: '', sapReference: '', sapSnapshotAt: '', plannedStart: '', plannedEnd: ''
});

export const batchFormFrom = (batch) => ({
    name: batch.name || '',
    auditType: batch.auditType || 'Perpetual',
    description: batch.description || '',
    sapReference: batch.sapReference || '',
    sapSnapshotAt: toInputDateTime(batch.sapSnapshotAt),
    plannedStart: toInputDate(batch.plannedStart),
    plannedEnd: toInputDate(batch.plannedEnd)
});

export const batchPayload = (form) => ({
    ...form,
    name: form.name.trim(),
    sapSnapshotAt: form.sapSnapshotAt ? new Date(form.sapSnapshotAt).toISOString() : null,
    plannedStart: form.plannedStart || null,
    plannedEnd: form.plannedEnd || null
});
