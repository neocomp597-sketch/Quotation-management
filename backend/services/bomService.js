const Product = require('../models/Product');
const Asset = require('../models/Asset');

const MGR_FIELDS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const toKey = (value) => cleanText(value).toUpperCase();
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const masterDescription = (product) => cleanText(product?.productName) || cleanText(product?.description);

// Case-insensitive product lookup by code without a regex scan per row.
// withMgrs is used when the caller needs MGR1-MGR5 spelled out rather than as ids.
const findProductsByCode = async (codes, { withMgrs = false } = {}) => {
    const variants = new Set();
    codes.filter(Boolean).forEach((code) => {
        variants.add(code);
        variants.add(code.toUpperCase());
        variants.add(code.toLowerCase());
    });
    if (!variants.size) return new Map();

    let query = Product.find({ productCode: { $in: [...variants] } })
        .select(`productCode productName description uom ${MGR_FIELDS.join(' ')}`);
    if (withMgrs) query = query.populate(MGR_FIELDS.map((path) => ({ path, select: 'code description' })));
    const products = await query.lean();

    const byKey = new Map();
    products.forEach((product) => {
        const key = toKey(product.productCode);
        if (!byKey.has(key)) byKey.set(key, product);
    });
    return byKey;
};

const findAssetBySerial = async (serialNumber) => {
    const serial = cleanText(serialNumber);
    if (!serial) return null;
    return Asset.findOne({ serialNumber: { $in: [...new Set([serial, serial.toUpperCase(), serial.toLowerCase()])] } })
        .select('serialNumber productId productCode')
        .lean();
};

// Product Master search for the item-code boxes on the form.
const searchMaterials = async (term, limit = 20) => {
    const q = cleanText(term);
    const query = q
        ? { $or: [{ productCode: new RegExp(`^${escapeRegex(q)}`, 'i') }, { productName: new RegExp(escapeRegex(q), 'i') }] }
        : {};
    const products = await Product.find(query)
        .select(`productCode productName description uom ${MGR_FIELDS.join(' ')}`)
        .populate(MGR_FIELDS.map((path) => ({ path, select: 'code description' })))
        .sort({ productCode: 1 })
        .limit(limit)
        .lean();
    return products.map((product) => ({
        productId: product._id,
        code: product.productCode,
        description: masterDescription(product),
        uom: cleanText(product.uom),
        ...Object.fromEntries(MGR_FIELDS.map((field) => [field, product[field] ? { code: product[field].code, description: product[field].description } : null]))
    }));
};

/**
 * Validates and resolves a BOM. A BOM belongs to a Parent Item Code (fgItemCode) and lists its
 * components as Item Code, Item Name, UOM and Quantity, the layout of the BOM relationship
 * sheet. Item Name comes from Product Master when the code is found, otherwise the entered
 * name is kept; UOM falls back to Product Master; MGR1-MGR5 always come from Product Master.
 *
 * The FG serial number is optional: a BOM without one is an item-level BOM and is keyed by
 * its parent item code (fgSerialNumber = parent item code), which is how the BOM sheet is
 * imported. A BOM tied to a real serial keeps that serial.
 *
 * The same item may appear on more than one line (BOM sheets repeat parts).
 *
 * options.lenient (bulk import): a component line that cannot be used is skipped and reported
 * in `warnings` instead of failing the whole BOM.
 *
 * Returns { errors, warnings, master, items }.
 */
const prepareBOM = async (body, { lenient = false } = {}) => {
    const errors = [];
    const warnings = [];
    const fgItemCode = cleanText(body.fgItemCode);
    const fgSerialNumber = cleanText(body.fgSerialNumber) || fgItemCode;
    if (!fgItemCode) errors.push('Parent Item Code is required.');

    const rows = (Array.isArray(body.items) ? body.items : [])
        .map((row) => ({
            rowLabel: row.rowNumber ? `Row ${row.rowNumber}` : '',
            itemCode: cleanText(row.itemCode),
            itemDescription: cleanText(row.itemDescription),
            uom: cleanText(row.uom),
            qtyText: cleanText(row.qty).replace(/,/g, ''),
            componentSerialNumber: cleanText(row.componentSerialNumber),
            batchNumber: cleanText(row.batchNumber),
            remarks: cleanText(row.remarks),
            drawingNo: cleanText(row.drawingNo),
            revisionNo: cleanText(row.revisionNo)
        }))
        // Rows left completely empty on the form are ignored.
        .filter((row) => row.itemCode || row.itemDescription || row.qtyText || row.uom);

    const productsByCode = await findProductsByCode([fgItemCode, ...rows.map((row) => row.itemCode)]);

    const items = [];
    rows.forEach((row, index) => {
        const label = `${row.rowLabel || `Row ${index + 1}`}${row.itemCode ? ` (${row.itemCode})` : ''}`;
        const product = productsByCode.get(toKey(row.itemCode));
        const qty = Number(row.qtyText);
        const rowErrors = [];

        if (!row.itemCode) rowErrors.push('Item Code is required.');
        if (row.qtyText === '') rowErrors.push('Quantity is required.');
        else if (!Number.isFinite(qty)) rowErrors.push(`Quantity "${row.qtyText}" is not a number.`);
        else if (qty <= 0) rowErrors.push('Quantity must be greater than 0.');
        if (!lenient && row.itemCode && !product && !row.itemDescription) {
            rowErrors.push('Item Name is required because the item code is not in Product Master.');
        }

        if (rowErrors.length) {
            const message = `${label}: ${rowErrors.join(' ')}`;
            if (lenient) warnings.push(`${message} Line skipped.`);
            else errors.push(message);
            return;
        }

        const item = {
            lineNo: items.length + 1,
            itemCode: product ? product.productCode : row.itemCode,
            itemDescription: masterDescription(product) || row.itemDescription,
            enteredDescription: row.itemDescription,
            productId: product?._id || null,
            uom: row.uom || cleanText(product?.uom),
            qty,
            componentSerialNumber: row.componentSerialNumber,
            batchNumber: row.batchNumber,
            remarks: row.remarks,
            drawingNo: row.drawingNo,
            revisionNo: row.revisionNo
        };
        MGR_FIELDS.forEach((field) => { item[field] = product?.[field] || null; });
        items.push(item);
    });

    if (!items.length && !errors.length) errors.push('Add at least one component.');

    const fgProduct = productsByCode.get(toKey(fgItemCode));
    // Only a real serial is looked up in Invoice Bulk Upload; an item-level BOM has none.
    const asset = toKey(fgSerialNumber) !== toKey(fgItemCode) ? await findAssetBySerial(fgSerialNumber) : null;

    return {
        errors,
        warnings,
        master: {
            fgItemCode: fgProduct ? fgProduct.productCode : fgItemCode,
            fgItemDescription: masterDescription(fgProduct) || cleanText(body.fgItemDescription),
            fgProductId: fgProduct?._id || null,
            fgSerialNumber,
            fgSerialKey: toKey(fgSerialNumber),
            assetId: asset?._id || null,
            componentCount: items.length
        },
        items
    };
};

/**
 * One BOM per product: the BOM saved for this parent item code, if any (case-insensitive).
 * Where old data still holds more than one, the item-level BOM (keyed by the code) wins.
 */
const PRODUCT_TAKEN_MESSAGE = 'A BOM already exists for this product.';

const findBOMForProduct = async (fgItemCode, { excludeId = null } = {}) => {
    const BOMMaster = require('../models/BOMMaster');
    const key = toKey(fgItemCode);
    if (!key) return null;
    const query = { fgItemCode: new RegExp(`^${escapeRegex(cleanText(fgItemCode))}$`, 'i') };
    if (excludeId) query._id = { $ne: excludeId };
    const matches = await BOMMaster.find(query).select('_id fgItemCode fgItemDescription fgSerialKey status').lean();
    return matches.find((bom) => bom.fgSerialKey === key) || matches[0] || null;
};

module.exports = {
    findBOMForProduct, PRODUCT_TAKEN_MESSAGE,
    prepareBOM, searchMaterials, findAssetBySerial, findProductsByCode, masterDescription,
    MGR_FIELDS, toKey, cleanText, escapeRegex
};
