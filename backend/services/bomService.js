const Product = require('../models/Product');
const Asset = require('../models/Asset');

const MGR_FIELDS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const toKey = (value) => cleanText(value).toUpperCase();
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const masterDescription = (product) => cleanText(product?.productName) || cleanText(product?.description);

// Case-insensitive product lookup by code without a regex scan per row.
const findProductsByCode = async (codes) => {
    const variants = new Set();
    codes.filter(Boolean).forEach((code) => {
        variants.add(code);
        variants.add(code.toUpperCase());
        variants.add(code.toLowerCase());
    });
    if (!variants.size) return new Map();

    const products = await Product.find({ productCode: { $in: [...variants] } })
        .select(`productCode productName description ${MGR_FIELDS.join(' ')}`)
        .lean();

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
        .select(`productCode productName description ${MGR_FIELDS.join(' ')}`)
        .populate(MGR_FIELDS.map((path) => ({ path, select: 'code description' })))
        .sort({ productCode: 1 })
        .limit(limit)
        .lean();
    return products.map((product) => ({
        productId: product._id,
        code: product.productCode,
        description: masterDescription(product),
        ...Object.fromEntries(MGR_FIELDS.map((field) => [field, product[field] ? { code: product[field].code, description: product[field].description } : null]))
    }));
};

/**
 * Validates and resolves a BOM entered on the form. Description comes from Product Master when
 * the item code is found, otherwise the entered description is kept; MGR1-MGR5 come from
 * Product Master. Returns { errors, master, items }.
 */
const prepareBOM = async (body) => {
    const errors = [];
    const fgItemCode = cleanText(body.fgItemCode);
    const fgSerialNumber = cleanText(body.fgSerialNumber);
    if (!fgItemCode) errors.push('FG Item Code is required.');
    if (!fgSerialNumber) errors.push('FG Serial Number is required.');

    const rows = (Array.isArray(body.items) ? body.items : [])
        .map((row) => ({
            itemCode: cleanText(row.itemCode),
            itemDescription: cleanText(row.itemDescription),
            qtyText: cleanText(row.qty),
            componentSerialNumber: cleanText(row.componentSerialNumber),
            batchNumber: cleanText(row.batchNumber),
            remarks: cleanText(row.remarks)
        }))
        // Rows left completely empty on the form are ignored.
        .filter((row) => row.itemCode || row.itemDescription || row.qtyText || row.componentSerialNumber || row.batchNumber || row.remarks);
    if (!rows.length) errors.push('Add at least one component.');

    const productsByCode = await findProductsByCode([fgItemCode, ...rows.map((row) => row.itemCode)]);
    const seen = new Map();

    const items = rows.map((row, index) => {
        const label = `Row ${index + 1}${row.itemCode ? ` (${row.itemCode})` : ''}`;
        const product = productsByCode.get(toKey(row.itemCode));
        const qty = Number(row.qtyText);

        if (!row.itemCode) errors.push(`${label}: Item Code is required.`);
        if (row.qtyText === '') errors.push(`${label}: Qty is required.`);
        else if (!Number.isFinite(qty)) errors.push(`${label}: Qty "${row.qtyText}" is not a number.`);
        else if (qty <= 0) errors.push(`${label}: Qty must be greater than 0.`);
        if (row.itemCode && !product && !row.itemDescription) {
            errors.push(`${label}: Description is required because the item code is not in Product Master.`);
        }

        const duplicateKey = [row.itemCode, row.componentSerialNumber, row.batchNumber].map(toKey).join('|');
        if (row.itemCode && seen.has(duplicateKey)) {
            errors.push(`${label}: same Item Code, Serial No and Batch as row ${seen.get(duplicateKey)}.`);
        } else if (row.itemCode) {
            seen.set(duplicateKey, index + 1);
        }

        const item = {
            lineNo: index + 1,
            itemCode: product ? product.productCode : row.itemCode,
            itemDescription: masterDescription(product) || row.itemDescription,
            enteredDescription: row.itemDescription,
            productId: product?._id || null,
            qty,
            componentSerialNumber: row.componentSerialNumber,
            batchNumber: row.batchNumber,
            remarks: row.remarks
        };
        MGR_FIELDS.forEach((field) => { item[field] = product?.[field] || null; });
        return item;
    });

    const fgProduct = productsByCode.get(toKey(fgItemCode));
    const asset = await findAssetBySerial(fgSerialNumber);

    return {
        errors,
        master: {
            fgItemCode: fgProduct ? fgProduct.productCode : fgItemCode,
            fgItemDescription: masterDescription(fgProduct),
            fgProductId: fgProduct?._id || null,
            fgSerialNumber,
            fgSerialKey: toKey(fgSerialNumber),
            assetId: asset?._id || null,
            componentCount: items.length
        },
        items
    };
};

module.exports = { prepareBOM, searchMaterials, findAssetBySerial, toKey, cleanText, escapeRegex };
