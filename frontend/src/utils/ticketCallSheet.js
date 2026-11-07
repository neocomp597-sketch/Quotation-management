import { formatDate } from './helpers';
import { assetEntryFields, assetMgrFields, assetIndicator, assetLinkedProductCode } from './assetEntryFields';

/**
 * Call Sheet: a service ticket printed for the engineer. It has the fields, labels, order and look of
 * the Raise Support Ticket form (pages/CSMTickets.jsx) filled in from the saved ticket, and adds one
 * thing, the Ticket Number. A ticket linked to a serial also shows that serial's Asset Information as
 * the form does (the Invoice Bulk Upload entry, utils/assetEntryFields.js).
 */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const obj = (value) => (value && typeof value === 'object' ? value : null);

const customerLabel = (customer) => {
    if (!customer) return '';
    return customer.companyName && customer.companyName !== customer.customerName
        ? `${customer.companyName} (${customer.customerName})`
        : customer.companyName || customer.customerName || '';
};

/** The Raise Support Ticket form's fields with the ticket's values, in form order. */
export const callSheetFields = (ticket) => {
    const customer = obj(ticket.customerId);
    const product = obj(ticket.productId);
    const invoice = obj(ticket.invoiceId);
    const branch = obj(ticket.branchId);
    const contact = obj(ticket.contactId);
    const designation = obj(ticket.contactDesignationId);
    const priority = obj(ticket.priorityId);
    return {
        serialNumber: ticket.serialNumber || obj(ticket.assetId)?.serialNumber || '',
        customer: customerLabel(customer),
        customerDetails: customer ? [
            ['GSTIN', customer.gstin || 'N/A'],
            ['Phone', customer.mobile || 'N/A'],
            ['Email', customer.email || 'N/A']
        ] : [],
        before: [
            { label: 'Link Product *', value: product ? (product.productCode ? `${product.productName} (${product.productCode})` : product.productName) : '' },
            { label: 'Link Invoice', value: invoice ? `${invoice.voucherNumber || ''}${invoice.date ? ` (${formatDate(invoice.date)})` : ''}` : '' },
            { label: 'Pincode *', value: ticket.pincode || '' }
        ],
        after: [
            { label: 'Branch *', value: branch ? (branch.code ? `${branch.name} (${branch.code})` : branch.name) : '' },
            { label: 'Ticket Source', value: ticket.source || '' },
            { label: 'Contact Person Name (optional)', value: ticket.contactName || contact?.contactName || '' },
            { label: 'Designation', value: ticket.contactDesignation || designation?.name || '' },
            { label: 'Contact Phone', value: ticket.contactPhone || '' },
            { label: 'Alternate Mobile Number', value: ticket.contactAlternatePhone || '' },
            { label: 'Contact Email', value: ticket.contactEmail || '' },
            { label: 'MGR4 Category', value: ticket.mgr4Category || '' },
            { label: 'Problem List', value: ticket.problemName || obj(ticket.problemId)?.name || '' },
            { label: 'Priority *', value: priority?.name || '' }
        ],
        subject: ticket.issueTitle || '',
        description: ticket.description || ''
    };
};

const field = (label, value, extraClass = '') => `
    <div class="field ${extraClass}">
        <div class="label">${esc(label)}</div>
        <div class="box">${value ? esc(value) : '<span class="empty">&nbsp;</span>'}</div>
    </div>`;

const assetSection = (summary) => {
    const asset = summary?.asset;
    if (!asset) return '';
    const covered = summary.warranty?.status === 'Active' || summary.amc?.status === 'Active';
    const mgrs = assetMgrFields(asset).map(({ label, value }) => `
        <div><div class="mgr-label">${esc(label)}</div><div class="mgr-value ${value ? '' : 'empty'}">${esc(value || 'Not assigned')}</div></div>`).join('');
    const code = assetLinkedProductCode(asset);
    return `
    <section class="asset">
        <div class="asset-head">
            <span>Asset Information (Invoice Bulk Upload Entry)</span>
            <span class="chips">
                <span class="chip">Status: ${esc(asset.status || 'IN_STOCK')}</span>
                <span class="chip ${covered ? 'ok' : 'bad'}">${covered ? 'Covered' : 'Out of Warranty/AMC'}</span>
            </span>
        </div>
        <div class="grid">
            ${assetEntryFields(asset).map(({ label, value }) => field(label, value)).join('')}
            <div class="mgr span-all">
                <div class="mgr-head"><span>MGR 1 – 5 (from Product Master)</span>${code ? `<span>Linked to ${esc(code)}</span>` : ''}</div>
                <div class="mgr-grid">${mgrs}</div>
            </div>
            ${field('Indicator Field (Max 20 chars)', assetIndicator(asset))}
        </div>
        <div class="service">
            <div><div class="mgr-label">Warranty Status</div><div>${summary.warranty?.status === 'Active' ? `Active (Expires ${esc(formatDate(summary.warranty.expiryDate))})` : 'Inactive / Expired'}</div></div>
            <div><div class="mgr-label">AMC Status</div><div>${summary.amc?.status === 'Active' ? `Active (${esc(summary.amc.contractNo)})` : 'Inactive / Expired'}</div></div>
            <div><div class="mgr-label">Last Service Date</div><div>${esc(formatDate(summary.lastServiceDate, 'No service record'))}</div></div>
        </div>
    </section>`;
};

/** The Call Sheet page (a whole HTML document) of `ticket`, as getTicketById sends it. */
export const buildCallSheetHtml = (ticket, assetSummary = null) => {
    const f = callSheetFields(ticket);
    const customerDetails = f.customerDetails.length ? `
        <div class="cust">${f.customerDetails.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : '';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Call Sheet ${esc(ticket.ticketNo || '')}</title>
<style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #fff; color: #0f172a; font-family: 'Segoe UI', Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
    .toolbar button { border: 0; border-radius: 12px; padding: 10px 18px; font-weight: 800; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; background: #0d9488; color: #fff; }
    .toolbar button.ghost { background: #f1f5f9; color: #475569; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 18px; }
    .eyebrow { font-size: 11px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: #0d9488; }
    h1 { margin: 2px 0 0; font-size: 24px; font-weight: 900; letter-spacing: -.01em; text-transform: uppercase; }
    .ticket-no { border: 2px solid #0d9488; border-radius: 16px; padding: 8px 16px; text-align: right; }
    .ticket-no .label { margin: 0; color: #0f766e; }
    .ticket-no b { display: block; font-size: 22px; font-weight: 900; font-family: Consolas, 'Courier New', monospace; letter-spacing: .02em; }
    .card { border: 1px solid #e2e8f0; border-radius: 24px; padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 16px; }
    .span-all { grid-column: 1 / -1; }
    .span-2 { grid-column: span 2; }
    .label { font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 5px; }
    .box { min-height: 40px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 13px; font-weight: 600; white-space: pre-wrap; word-break: break-word; }
    .box .empty { color: #cbd5e1; }
    .serial { padding: 14px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 16px; }
    .serial .label { color: #134e4a; font-size: 12px; }
    .serial .label small { color: #0d9488; font-weight: 700; text-transform: none; letter-spacing: 0; font-size: 10px; }
    .serial .box { background: #fff; border-color: #99f6e4; font-weight: 800; font-family: Consolas, 'Courier New', monospace; }
    .cust { margin-top: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 14px; font-size: 11px; }
    .cust div { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .cust span { font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; }
    .cust b { color: #334155; word-break: break-all; text-align: right; }
    .desc .box { min-height: 72px; }
    .asset { margin: 2px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 20px; }
    .field, .serial, .mgr, .service, .asset-head { break-inside: avoid; }
    .asset-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #334155; }
    .chips { display: flex; gap: 6px; }
    .chip { padding: 2px 10px; border: 1px solid #e2e8f0; border-radius: 999px; font-size: 9px; }
    .chip.ok { color: #0d9488; border-color: #99f6e4; background: #f0fdfa; }
    .chip.bad { color: #e11d48; border-color: #fecdd3; background: #fff1f2; }
    .mgr { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
    .mgr-head { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
    .mgr-head span + span { font-weight: 600; text-transform: none; letter-spacing: 0; }
    .mgr-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .mgr-label { font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
    .mgr-value { font-size: 12px; font-weight: 700; word-break: break-word; }
    .mgr-value.empty { font-weight: 400; font-style: italic; color: #94a3b8; }
    .service { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #f1f5f9; font-size: 12px; font-weight: 600; }
    @media (max-width: 640px) {
        body { padding: 16px; }
        .grid { grid-template-columns: 1fr; }
        .span-2 { grid-column: auto; }
        .mgr-grid, .service { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .head { flex-direction: column; align-items: stretch; }
    }
    @media print {
        body { padding: 0; }
        .toolbar { display: none; }
        /* Tighter on paper, so a ticket fits on about one A4 page. */
        .head { margin-bottom: 8px; }
        h1 { font-size: 18px; }
        .ticket-no { padding: 5px 12px; border-radius: 12px; }
        .ticket-no b { font-size: 18px; }
        .card { padding: 12px; border-radius: 16px; }
        .grid { gap: 6px 12px; }
        .label { font-size: 8.5px; margin-bottom: 3px; }
        .box { min-height: 26px; padding: 5px 10px; border-radius: 8px; font-size: 11.5px; }
        .serial { padding: 8px 10px; border-radius: 12px; }
        .serial .label { font-size: 10px; }
        .cust { margin-top: 5px; padding: 6px 10px; border-radius: 10px; font-size: 10px; }
        .desc .box { min-height: 48px; }
        .asset { padding: 8px 12px; border-radius: 14px; }
        .asset-head { padding-bottom: 6px; margin-bottom: 8px; font-size: 10px; }
        .mgr { padding: 8px 10px; border-radius: 8px; }
        .mgr-head { margin-bottom: 4px; font-size: 8.5px; }
        .mgr-value { font-size: 11px; }
        .service { margin-top: 8px; padding-top: 6px; font-size: 11px; }
    }
</style>
</head>
<body>
    <div class="toolbar">
        <button type="button" class="ghost" onclick="window.close()">Close</button>
        <button type="button" onclick="window.print()">Print Call Sheet</button>
    </div>
    <div class="head">
        <div>
            <div class="eyebrow">Call Sheet</div>
            <h1>Raise Support Ticket</h1>
        </div>
        <div class="ticket-no">
            <div class="label">Ticket No.</div>
            <b>${esc(ticket.ticketNo || '')}</b>
        </div>
    </div>
    <div class="card">
        <div class="grid">
            <div class="serial span-all">
                <div class="label">Product Serial No. * <small>(Primary Field – enter or search serial no. to auto-fill product &amp; customer details)</small></div>
                <div class="box">${f.serialNumber ? esc(f.serialNumber) : '<span class="empty">&nbsp;</span>'}</div>
            </div>
            <div class="field">
                <div class="label">Customer *</div>
                <div class="box">${f.customer ? esc(f.customer) : '<span class="empty">&nbsp;</span>'}</div>
                ${customerDetails}
            </div>
            ${f.before.map(({ label, value }) => field(label, value)).join('')}
            ${assetSummary?.asset ? `<div class="span-all">${assetSection(assetSummary)}</div>` : ''}
            ${f.after.map(({ label, value }) => field(label, value)).join('')}
            ${field('Subject *', f.subject, 'span-2')}
            ${field('Description / Notes', f.description, 'span-2 desc')}
        </div>
    </div>
    <script>
        window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
    </script>
</body>
</html>`;
};

/**
 * Opens the print window at once (a browser lets a click open a window only before any wait), so call
 * it first in the click handler and pass the window to printTicketCallSheet. null when it was blocked.
 */
export const openCallSheetWindow = () => {
    const win = window.open('', '_blank');
    if (win) {
        win.document.write('<!doctype html><title>Call Sheet</title><p style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#475569">Preparing the call sheet…</p>');
    }
    return win;
};

/**
 * Writes the Call Sheet of `ticket` into `win` (from openCallSheetWindow), which prints it. The serial's
 * Asset Information comes from `loadAssetSummary(assetId)`, and is left out when it cannot be read.
 */
export const printTicketCallSheet = async (win, ticket, loadAssetSummary) => {
    if (!win || win.closed) return false;
    let summary = null;
    const assetId = obj(ticket.assetId)?._id || ticket.assetId;
    if (assetId && loadAssetSummary) {
        try {
            summary = await loadAssetSummary(String(assetId));
        } catch {
            summary = null;
        }
    }
    win.document.open();
    win.document.write(buildCallSheetHtml(ticket, summary));
    win.document.close();
    win.focus();
    return true;
};
