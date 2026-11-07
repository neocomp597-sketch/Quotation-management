import { formatDate } from './helpers';

/**
 * The fields of an Invoice Bulk Upload entry, in the order and with the labels of its Add Single
 * Entry form (pages/SerialNoMaster.jsx), read from a saved asset as getAssetSummary sends it
 * (customer, product with MGR, division and segment populated). Used wherever an entry is shown
 * outside that screen, so it reads the same: Raise Ticket's Asset Information and the Call Sheet.
 */

export const ASSET_MGR_FIELDS = [
    { key: 'mgr1', label: 'MGR 1' },
    { key: 'mgr2', label: 'MGR 2' },
    { key: 'mgr3', label: 'MGR 3' },
    { key: 'mgr4', label: 'MGR 4' },
    { key: 'mgr5', label: 'MGR 5' }
];

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

// "CODE - Description", as the Invoice Bulk Upload screen shows MGR values.
const mgrText = (mgr) => {
    if (!mgr) return '';
    if (typeof mgr === 'string') return mgr;
    if (mgr.code && mgr.description && mgr.code.toLowerCase() !== mgr.description.toLowerCase()) {
        return `${mgr.code} - ${mgr.description}`;
    }
    return mgr.description || mgr.code || '';
};

// Division / Segment as "CODE - Description".
const codeLabel = (doc) => (doc && typeof doc === 'object' ? [doc.code, doc.description].filter(Boolean).join(' - ') : '');

const objectOrNull = (value) => (value && typeof value === 'object' ? value : null);

/** [{ key, label, value }] of the entry's form fields, MGR and Indicator excepted. */
export const assetEntryFields = (asset) => {
    if (!asset) return [];
    const product = objectOrNull(asset.productId);
    const customer = objectOrNull(asset.customerId);
    const saleDate = asset.saleDate || asset.invoiceDate;
    return [
        { key: 'serialNumber', label: 'Serial Number', value: text(asset.serialNumber) },
        { key: 'productCode', label: 'Product Code', value: text(product?.productCode || asset.productCode) },
        { key: 'productName', label: 'Product Name', value: text(product?.productName || asset.productName) },
        { key: 'status', label: 'Status', value: text(asset.status) },
        { key: 'customer', label: 'Customer Name', value: text(customer?.companyName || customer?.customerName || asset.customerNameStr) },
        { key: 'customerCode', label: 'Customer Code', value: text(customer?.externalCode || asset.customerCode) },
        { key: 'division', label: 'Division', value: codeLabel(asset.divisionId) },
        { key: 'segment', label: 'Segment', value: codeLabel(asset.segmentId) },
        { key: 'customerPostalCode', label: 'Customer Postal Code', value: text(asset.customerPostalCode || customer?.billingAddress?.pincode) },
        { key: 'invoiceNumber', label: 'Invoice Number', value: text(asset.invoiceNumber || objectOrNull(asset.invoiceId)?.voucherNumber) },
        { key: 'saleDate', label: 'Invoice Date', value: saleDate ? formatDate(saleDate, '') : '' },
        { key: 'location', label: 'Location', value: text(asset.location) }
    ];
};

/** [{ key, label, value }] of MGR 1 - 5, from the product (Product Master), else the entry's copy. */
export const assetMgrFields = (asset) => {
    const product = objectOrNull(asset?.productId);
    return ASSET_MGR_FIELDS.map(({ key, label }) => ({
        key,
        label,
        value: product && product[key] !== undefined ? mgrText(product[key]) : mgrText(asset?.[key])
    }));
};

/** The product code the MGR come from, for the "Linked to ..." note. */
export const assetLinkedProductCode = (asset) => text(objectOrNull(asset?.productId)?.productCode || asset?.productCode);

export const assetIndicator = (asset) => text(asset?.indicatorField);
