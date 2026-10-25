const mongoose = require('mongoose');
const Product = require('../../../models/Product');
const Vendor = require('../../../models/Vendor');
const { getTenantId } = require('../../../middlewares/tenantContext');
const { createProductIndex, normalizeProductKey } = require('../../../utils/productUniqueness');
const cacheInvalidation = require('../../../utils/cacheInvalidation');
const { ImportJobError } = require('../errors');

// Product Master import (was importController.importProducts). The column names each field
// accepts are the ones the original importer read, in the same order, so the template and
// older files keep matching.
//
// Which product a row updates (same rules as before):
//   - a row with a code updates the product with that code (ignoring case); a new code
//     creates a product - unless its name already belongs to another product, which is
//     refused: product codes AND names are unique per company (utils/productUniqueness.js)
//   - a row without a code gets a code made from the name ("Ball Valve" -> "ball-valve");
//     a product with that code is updated, else the product with that name, else a new
//     product is created with the made-up code
//   - a row without a name takes the code as the name (new products only)

const FIELDS = [
    {
        key: 'productCode', label: 'Product Code',
        aliases: ['Product Code', 'productCode', 'code', 'Code'],
        description: 'A code that already exists updates that product. Leave it empty to update the product with the same name; a new product then gets a code made from its name.'
    },
    {
        key: 'productName', label: 'Product Name',
        aliases: ['Product Name', 'productName', 'name', 'Name'],
        description: 'Must not belong to another product. A new product without a name is named after its code.'
    },
    { key: 'hsnCode', label: 'HSN Code', default: 'N/A', aliases: ['HSN Code', 'hsnCode', 'hsn', 'Hsn'] },
    {
        key: 'gstPercentage', label: 'GST %', type: 'number', min: 0, max: 100, default: 18,
        aliases: ['GST %', 'GST Percentage', 'gstPercentage', 'gst'],
        description: 'New products without a GST % get 18.'
    },
    { key: 'basePrice', label: 'Base Price', type: 'number', min: 0, default: 0, aliases: ['Base Price', 'basePrice', 'price'] },
    {
        key: 'mrp', label: 'MRP', type: 'number', min: 0, aliases: ['MRP', 'mrp', 'M.R.P.'],
        description: 'New products without an MRP get the base price.'
    },
    { key: 'uom', label: 'UOM', default: 'Nos', aliases: ['UOM', 'uom', 'Unit', 'unit'] },
    {
        key: 'vendorName', label: 'Vendor Name', aliases: ['Vendor Name', 'vendorName'],
        description: 'A vendor from the Vendor Master. It becomes the vendor of the product.'
    },
    { key: 'vendorPrice', label: 'Vendor Price', type: 'number', min: 0, aliases: ['Vendor Price', 'vendorPrice'] },
    { key: 'vendorStock', label: 'Vendor Stock', type: 'number', min: 0, aliases: ['Vendor Stock', 'vendorStock', 'stock'] },
    { key: 'isPrimary', label: 'Is Primary', type: 'boolean', aliases: ['Is Primary', 'isPrimary'], description: 'Yes when empty.' },
    { key: 'productImageUrl', label: 'Image URL', default: '', aliases: ['Image URL', 'productImageUrl', 'imageUrl', 'image'] },
    {
        key: 'status', label: 'Status', type: 'option', options: ['Active', 'Inactive', 'Discontinued'], default: 'Active',
        aliases: ['Status', 'status']
    },
    {
        key: 'applicableForTypeTest', label: 'Test Type', type: 'boolean',
        aliases: ['Test Type', 'Applicable for Test Type', 'testType'],
        description: 'Yes lists the product in the Type Test product list. Empty keeps the current setting (No for new products).'
    }
];

// Values a row may change on an existing product. The code is what finds the product, so it
// is never rewritten (not even its capitals).
const UPDATE_FIELDS = ['productName', 'hsnCode', 'gstPercentage', 'basePrice', 'mrp', 'uom', 'productImageUrl', 'status', 'applicableForTypeTest'];

/** The code the original importer made from a name: "Ball Valve 2\"" -> "ball-valve-2-". */
const codeFromName = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);

const nameKey = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

const isVendorUser = (user) => String(user?.role || '').toLowerCase() === 'vendor';

const companyOf = (user) => getTenantId() || user?.companyId || null;

const describeProduct = (product) => [product.productCode, product.productName].filter(Boolean).join(' · ');

/** The product a row describes, and anything that stops it from being saved. */
const resolveRow = (data, context) => {
    const { index } = context;
    const codeSupplied = data.productCode !== undefined;
    const name = data.productName !== undefined ? data.productName : data.productCode;
    const code = codeSupplied ? data.productCode : codeFromName(data.productName);

    if (!codeSupplied && !/[a-z0-9]/.test(code)) {
        return {
            issue: {
                field: 'productCode', code: 'NO_CODE',
                message: 'A product code cannot be made from this name.',
                hint: 'Fill in the product code for this row.'
            }
        };
    }

    // Same code ignoring capitals; codes differing only in capitals can both exist (the unique
    // index is exact), so the one written exactly like the file wins, and otherwise it must be
    // the only one.
    const variants = context.byUpperCode.get(nameKey(code)) || [];
    let existing = variants.find((product) => product.productCode === code) || (variants.length === 1 ? variants[0] : null);
    if (!existing && variants.length > 1) {
        return {
            issue: {
                field: 'productCode', code: 'AMBIGUOUS_CODE',
                message: `More than one product has the code "${code}" in different capitals (${variants.slice(0, 3).map((product) => product.productCode).join(', ')}).`,
                hint: 'Write the code exactly as the product to update has it.'
            }
        };
    }
    let by = existing ? (codeSupplied ? 'product code' : 'code made from the name') : '';
    if (!existing) {
        const sameName = index.findDuplicate('productName', name);
        if (sameName && codeSupplied) {
            return {
                issue: {
                    field: 'productName', code: 'NAME_TAKEN',
                    message: `Product name "${name}" already belongs to product ${sameName.productCode}.`,
                    hint: 'Product names must be unique. Use that product\'s code to update it, or give this product a different name.'
                }
            };
        }
        if (sameName) {
            // Products saved before names had to be unique may share one: which one is meant?
            const other = index.findDuplicate('productName', name, sameName._id);
            if (other) {
                return {
                    issue: {
                        field: 'productCode', code: 'AMBIGUOUS_NAME',
                        message: `More than one product is named "${name}" (codes ${sameName.productCode}, ${other.productCode}).`,
                        hint: 'Fill in the product code of the product to update.'
                    }
                };
            }
            existing = sameName;
            by = 'product name';
        }
    }

    if (existing) {
        // A renamed product must not take the name of another product.
        if (data.productName !== undefined && normalizeProductKey(existing.productName) !== normalizeProductKey(data.productName)) {
            const taken = index.findDuplicate('productName', data.productName, existing._id);
            if (taken) {
                return {
                    issue: {
                        field: 'productName', code: 'NAME_TAKEN',
                        message: `Product name "${data.productName}" already belongs to product ${taken.productCode}.`,
                        hint: 'Product names must be unique. Keep the current name, or choose another one.'
                    }
                };
            }
        }
        return { existing, by, code: existing.productCode };
    }

    // A new product: its code must not be another product's code written with other spacing.
    const taken = index.findDuplicate('productCode', code);
    if (taken) {
        return {
            issue: {
                field: 'productCode', code: 'CODE_TAKEN',
                message: `Product code "${code}" is already used by product ${describeProduct(taken)}.`,
                hint: 'Product codes must be unique. Use that exact code to update it, or choose another code.'
            }
        };
    }
    return { existing: null, code, name };
};

module.exports = {
    key: 'products',
    label: 'Products',
    recordLabel: 'product',
    recordLabelPlural: 'products',
    permissionKey: 'master_products',
    permissions: [['master_products', 'create']],
    model: Product,
    fields: FIELDS,

    /**
     * A vendor login imports into its own catalog: every product gets that vendor. Taken from
     * the login, never from the request, and kept with the import so it holds whoever presses
     * Import (an admin can open the vendor's import).
     */
    async resolveParams(raw, { user }) {
        if (!isVendorUser(user) || !user.vendorId) return {};
        const companyId = companyOf(user);
        const vendor = companyId && mongoose.isValidObjectId(String(user.vendorId))
            ? await Vendor.findOne({ _id: user.vendorId, companyId }).select('_id name').lean()
            : null;
        if (!vendor) {
            throw new ImportJobError(
                'VENDOR_NOT_FOUND',
                'Your vendor record was not found.',
                'Ask the administrator to check the vendor linked to your login.',
                400
            );
        }
        return { vendorId: String(vendor._id), vendorName: vendor.name || '' };
    },

    describeParams(params) {
        return params?.vendorId ? `Vendor catalog: ${params.vendorName || 'your vendor'}` : '';
    },

    /**
     * The company's whole Product Master (code, name and prices only), so codes and names
     * are checked with the uniqueness rules of utils/productUniqueness.js without a query
     * per row, plus the vendors named in the file.
     */
    async loadContext({ user, rows }) {
        const companyId = companyOf(user);
        // Never without a company: { companyId: null } would match products of no company.
        if (!companyId) throw new Error('Product import needs a company context');
        // Oldest first, so "the first product" never depends on the index MongoDB picks.
        const products = await Product.find({ companyId })
            .select('_id productCode productName basePrice mrp')
            .sort({ _id: 1 })
            .lean();
        const byId = new Map(products.map((product) => [String(product._id), product]));
        const byUpperCode = new Map();
        products.forEach((product) => {
            const key = String(product.productCode ?? '').toUpperCase();
            if (!byUpperCode.has(key)) byUpperCode.set(key, []);
            byUpperCode.get(key).push(product);
        });

        // Vendor Name: the vendor's name, ignoring capitals (as before).
        const vendorNames = [...new Set(rows.map((row) => row.vendorName).filter(Boolean))];
        const vendorsByName = new Map();
        if (vendorNames.length) {
            const vendors = await Vendor.find({
                companyId,
                $or: [{ name: { $in: vendorNames } }, { vendorName: { $in: vendorNames } }]
            })
                .collation({ locale: 'en', strength: 2 })
                .select('_id name vendorName')
                .sort({ _id: 1 })
                .lean();
            vendors.forEach((vendor) => {
                new Set([vendor.name, vendor.vendorName].map((value) => String(value ?? '').toUpperCase())).forEach((key) => {
                    if (!key) return;
                    if (!vendorsByName.has(key)) vendorsByName.set(key, []);
                    vendorsByName.get(key).push(vendor);
                });
            });
        }
        return { index: createProductIndex(products), byId, byUpperCode, vendorsByName };
    },

    validate(data, { context, params }) {
        if (data.productCode === undefined && data.productName === undefined) {
            return [{
                field: 'productName', code: 'REQUIRED',
                message: 'Product code and product name are both empty.',
                hint: 'Fill in the product code or the product name (one is enough).'
            }];
        }

        const resolved = resolveRow(data, context);
        if (resolved.issue) return [resolved.issue];

        const issues = [];
        const { existing } = resolved;
        data.productCode = resolved.code;
        if (existing) {
            data.productId = String(existing._id);
            data.matchedBy = resolved.by;
        } else {
            data.productName = resolved.name;
        }

        // The vendor of the product: a vendor user's own catalog, else the Vendor Name column.
        const basePrice = data.basePrice ?? (existing ? existing.basePrice : 0) ?? 0;
        const mrp = data.mrp ?? (existing ? existing.mrp : basePrice) ?? 0;
        if (params.vendorId) {
            data.vendorLink = {
                vendorId: params.vendorId,
                price: data.vendorPrice || basePrice || mrp || 1,
                stock: data.vendorStock ?? 0,
                isPrimary: true
            };
        } else if (data.vendorName !== undefined) {
            const candidates = context.vendorsByName.get(nameKey(data.vendorName)) || [];
            // Several vendors with this name: only one written exactly like the file will do.
            const exact = candidates.filter((candidate) => candidate.name === data.vendorName || candidate.vendorName === data.vendorName);
            const vendor = candidates.length === 1 ? candidates[0] : exact.length === 1 ? exact[0] : null;
            if (!candidates.length) {
                issues.push({
                    field: 'vendorName', code: 'NOT_FOUND',
                    message: `Vendor "${data.vendorName}" was not found.`,
                    hint: 'Check the name in the Vendor Master, or leave Vendor Name empty.'
                });
            } else if (!vendor) {
                issues.push({
                    field: 'vendorName', code: 'AMBIGUOUS_VENDOR',
                    message: `More than one vendor is named "${data.vendorName}".`,
                    hint: 'Write the name exactly as the vendor to use has it, or rename one of them in the Vendor Master.'
                });
            } else {
                const price = data.vendorPrice || basePrice;
                if (!(price > 0)) {
                    issues.push({
                        field: 'vendorPrice', code: 'REQUIRED',
                        message: `Vendor price is missing for vendor "${data.vendorName}".`,
                        hint: 'Fill in Vendor Price (or Base Price) with an amount above 0.'
                    });
                } else {
                    data.vendorLink = {
                        vendorId: String(vendor._id),
                        price,
                        stock: data.vendorStock ?? 0,
                        isPrimary: data.isPrimary ?? true
                    };
                }
            }
        }
        return issues;
    },

    /** Two rows for the same code or the same name: only the first one is imported. */
    identityKeys(data) {
        const keys = [];
        const code = normalizeProductKey(data.productCode);
        const name = normalizeProductKey(data.productName);
        if (code) keys.push({ key: `code:${code}`, field: 'productCode', label: 'product code' });
        if (name) keys.push({ key: `name:${name}`, field: 'productName', label: 'product name' });
        return keys;
    },

    match(data, context) {
        const record = data.productId ? context.byId.get(data.productId) : null;
        if (!record) return null;
        return {
            record,
            by: data.matchedBy || 'product code',
            field: data.matchedBy === 'product name' ? 'productName' : 'productCode'
        };
    },

    describe: describeProduct,

    toCreate(data) {
        const doc = {
            productCode: data.productCode,
            productName: data.productName,
            hsnCode: data.hsnCode,
            gstPercentage: data.gstPercentage,
            basePrice: data.basePrice,
            mrp: data.mrp ?? data.basePrice,
            uom: data.uom,
            productImageUrl: data.productImageUrl,
            status: data.status
        };
        if (data.applicableForTypeTest !== undefined) doc.applicableForTypeTest = data.applicableForTypeTest;
        return { ...doc, ...vendorFields(data) };
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        const set = { updatedAt: new Date() };
        UPDATE_FIELDS.forEach((field) => {
            if (data[field] !== undefined) set[field] = data[field];
        });
        return { ...set, ...vendorFields(data) };
    },

    async afterImport({ user, run }) {
        await cacheInvalidation.invalidateProductCaches();
        const saved = run.created + run.updated;
        if (!saved) return;
        const { createCompanyNotifications } = require('../../../utils/notificationHelper');
        await createCompanyNotifications({
            companyId: user?.companyId,
            title: 'Products Master Imported',
            message: `Successfully imported/updated ${saved} products (created: ${run.created}, updated: ${run.updated}, failed: ${run.failed}).`,
            type: 'Reminder',
            excludeUserId: user?.id
        });
    }
};

/**
 * The vendor list of the product, as the original importer saved it: the vendor of the row
 * becomes the product's only (primary unless "Is Primary" says No) vendor.
 */
function vendorFields(data) {
    if (!data.vendorLink) return {};
    const vendorId = new mongoose.Types.ObjectId(String(data.vendorLink.vendorId));
    return {
        vendorId,
        vendors: [{
            vendorId,
            price: data.vendorLink.price,
            stock: data.vendorLink.stock,
            isPrimary: data.vendorLink.isPrimary
        }]
    };
}
