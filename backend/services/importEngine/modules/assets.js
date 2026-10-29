const mongoose = require('mongoose');
const Asset = require('../../../models/Asset');
const AssetHistory = require('../../../models/AssetHistory');
const Branch = require('../../../models/Branch');
const Customer = require('../../../models/Customer');
const Product = require('../../../models/Product');
const { getActiveBranchId, getTenantId } = require('../../../middlewares/tenantContext');
const { loadProductIndex } = require('../../../utils/productUniqueness');
const { loadDivisionSegmentLookup, resolveDivisionSegment } = require('../../../utils/divisionSegment');
const { chunk, insertRows, writeRows, describeWriteError } = require('../../../utils/importBatch');
const { invalidateCustomerCaches, invalidateProductCaches, invalidateAssetCaches } = require('../../../utils/cacheInvalidation');
const { allowedProductIdSet } = require('../../../utils/mgrAccess');
const { ImportJobError } = require('../errors');

/*
 * Invoice Bulk Upload (Serial No Master) import: one row per serial number, usually a SAP sales
 * register (Serial No, Product Name, Product Code, Status, Customer Code, Customer Name, Mobile
 * Number, Invoice Ref No, Sale Date, ProjectCode, Project Name). Same rules as the original
 * importer (importController.importAssets):
 *
 *   - The import belongs to the branch selected in the header (the job keeps it): new serials
 *     and new customers get that branch, a blank Location becomes the branch name.
 *   - A serial number is unique in the company. A serial that already exists in this branch is
 *     updated (a returned one is sold again, with an IMPORT_RESELL history entry); one that
 *     exists in another branch is not imported. New serials get an IMPORT history entry.
 *   - The product is found by Product Code only (in this company; products saved before
 *     companies existed may be reused, another company's never), or by name when the row has
 *     no code. A new code is added to the Product Master, unless its name already belongs to
 *     another code: product names are unique. The sheet's name renames the product when no
 *     other product has that name.
 *   - The customer is found by code anywhere in the company (codes are unique per company), or
 *     by name in this branch; one that is missing is added from the sheet. A blank mobile is
 *     taken from the Customer Master; a mobile on the sheet fills a customer that has none.
 *   - MGR 1-5 are never copied: every read derives them from the product.
 */

const STATUS_RULES = [['STOCK', 'IN_STOCK'], ['ALLOCAT', 'ALLOCATED'], ['SOLD', 'SOLD'], ['RETURN', 'RETURN'], ['SCRAP', 'SCRAPPED']];
const RETURNED = ['RETURN', 'RETURNED'];
const INDICATOR_MAX = 20;
const LOOKUP_CHUNK = 1000;
const CODE_COLLATION = Customer.CUSTOMER_CODE_COLLATION || { locale: 'en', strength: 2 };
const NAME_COLLATION = { locale: 'en', strength: 2 };

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const upper = (value) => clean(value).toUpperCase();
const serialKeyOf = (value) => upper(value);
const isReturned = (asset) => RETURNED.includes(asset.status);
const sameId = (a, b) => String(a || '') === String(b || '');

const mapStatus = (text) => {
    const key = String(text).toUpperCase().replace(/[\s\-_]+/g, '');
    const rule = STATUS_RULES.find(([part]) => key.includes(part));
    return rule ? rule[1] : null;
};

const companyOf = (user) => getTenantId() || user?.companyId || null;

const FIELDS = [
    {
        key: 'serialNumber', label: 'Serial Number', required: true,
        aliases: ['Serial Number', 'serialNumber', 'Serial No', 'serialNo', 'Serial', 'SN', 'Serial Num'],
        requiredMessage: 'Serial number is missing.',
        requiredHint: 'Every row needs the serial number of the item. Fill it in, or skip this row.',
        description: 'A serial number that is already saved in this branch is updated.'
    },
    {
        key: 'productName', label: 'Product Name',
        aliases: ['Product Name', 'productName', 'Name', 'ProductName', 'Item Name', 'ItemName', 'Description', 'Product Description'],
        description: 'Renames the product in the Product Master when no other product has this name.'
    },
    {
        key: 'productCode', label: 'Product Code',
        aliases: ['Product Code', 'productCode', 'Code', 'ProductCode', 'Item Code', 'ItemCode'],
        description: 'Finds the product. A new code is added to the Product Master.'
    },
    {
        key: 'status', label: 'Status', default: 'IN_STOCK', aliases: ['Status'],
        description: 'In Stock, Allocated, Sold, Return or Scrapped. Blank: In Stock for a new serial.'
    },
    {
        key: 'customerCode', label: 'Customer Code',
        aliases: ['Customer Code', 'customerCode', 'Customer External Code', 'externalCode'],
        description: 'A code that is not in the Customer Master adds the customer.'
    },
    { key: 'customerName', label: 'Customer Name', aliases: ['Customer Name', 'customerName', 'Company Name', 'companyName', 'Customer'] },
    {
        key: 'mobile', label: 'Mobile Number', type: 'phone',
        aliases: ['Mobile Number *', 'Mobile Number', 'mobileNumber', 'Mobile No', 'mobileNo', 'Phone Number', 'phoneNumber', 'Mobile', 'Phone'],
        description: 'Optional. Blank: the mobile from the Customer Master.'
    },
    {
        key: 'invoiceNumber', label: 'Invoice Ref',
        aliases: ['Invoice Ref', 'invoiceRef', 'Invoice Ref No', 'Invoice Number', 'invoiceNumber', 'Invoice No', 'Invoice']
    },
    { key: 'saleDate', label: 'Sale Date', type: 'date', aliases: ['Sale Date', 'saleDate', 'Invoice Date', 'invoiceDate'] },
    {
        key: 'location', label: 'Location', aliases: ['Location', 'Branch'],
        description: 'Blank: the name of the branch you import into.'
    },
    { key: 'divisionCode', label: 'Division Code', type: 'upperText', aliases: ['Division_Code', 'Division Code', 'DivisionCode', 'Division'] },
    { key: 'segmentCode', label: 'Segment Code', type: 'upperText', aliases: ['Segment_Code', 'Segment Code', 'SegmentCode', 'Segment'] },
    { key: 'projectCode', label: 'Project Code', aliases: ['Project Code', 'ProjectCode', 'projectCode'] },
    { key: 'projectName', label: 'Project Name', aliases: ['Project Name', 'ProjectName', 'projectName'] },
    {
        key: 'indicatorField', label: 'Indicator', aliases: ['Indicator_Field', 'indicator_field', 'indicatorField', 'Indicator'],
        description: `Up to ${INDICATOR_MAX} characters; longer text is cut.`
    }
];

// ── Products ────────────────────────────────────────────────────────────────

/**
 * Products saved before companies existed carry no companyId and may be reused. Each value is
 * looked up once (prefetch) and kept: Map "field:VALUE" -> product or null.
 */
const createLegacyProducts = () => {
    const cache = new Map();
    const legacy = new Set();
    const keyOf = (field, value) => `${field}:${upper(value)}`;
    return {
        has: (product) => legacy.has(product),
        get: (field, value) => cache.get(keyOf(field, value)) || null,
        async prefetch(pairs) {
            const missing = { productCode: new Set(), productName: new Set() };
            pairs.forEach(([field, value]) => {
                const cleaned = clean(value);
                if (cleaned && !cache.has(keyOf(field, cleaned))) missing[field].add(cleaned);
            });
            for (const field of Object.keys(missing)) {
                const values = [...missing[field]];
                values.forEach((value) => cache.set(keyOf(field, value), null));
                for (const part of chunk(values, LOOKUP_CHUNK)) {
                    const docs = await Product.find({ $or: [{ companyId: null }, { companyId: { $exists: false } }], [field]: { $in: part } })
                        .collation(NAME_COLLATION)
                        .setOptions({ bypassTenant: true })
                        .lean();
                    docs.forEach((doc) => {
                        const key = keyOf(field, doc[field]);
                        if (cache.get(key) === null) {
                            cache.set(key, doc);
                            legacy.add(doc);
                        }
                    });
                }
            }
        }
    };
};

/** The legacy (pre-company) values a list of rows may need: codes / names the catalog lacks. */
const legacyPairs = (index, list) => list.flatMap((data) => {
    const code = clean(data.productCode);
    const name = clean(data.productName);
    if (code) return index.findByCode(code) ? [] : [['productCode', code]];
    if (name) return index.findByName(name) ? [] : [['productName', name]];
    return [];
});

/**
 * Which product a row uses, without changing anything: { product } for an existing one,
 * { create } for a new code, plus { rename } when the sheet's name should replace the stored
 * one; or { issue } when the row cannot be imported. productCode / productName are the values
 * the row records (as the original importer resolved them).
 */
const resolveProduct = (index, legacy, data) => {
    const code = clean(data.productCode);
    let name = clean(data.productName);
    const product = code
        ? index.findByCode(code) || legacy.get('productCode', code)
        : index.findByName(name) || legacy.get('productName', name);

    if (!product) {
        const newName = name || code;
        const sameName = newName ? index.findDuplicate('productName', newName) : null;
        const owner = sameName ? `product code ${sameName.productCode}${sameName.addedByFile ? ' (added by an earlier row of this file)' : ''}` : '';
        if (!code) {
            return {
                issue: {
                    field: 'productName',
                    code: 'PRODUCT_NOT_FOUND',
                    message: `Product "${name}" is not in the Product Master.`,
                    hint: sameName
                        ? `A product with almost the same name has ${owner}. Fill in the Product Code.`
                        : 'Fill in the Product Code so the product can be found or added.'
                }
            };
        }
        if (sameName) {
            return {
                issue: {
                    field: 'productCode',
                    code: 'PRODUCT_NAME_TAKEN',
                    message: `Product code ${code} is new, but its name is already used by ${owner}.`,
                    hint: `Product names must be unique. Use code ${sameName.productCode} in this row, or first add product ${code} to the Product Master with a different name.`
                }
            };
        }
        return { create: { productCode: code, productName: newName }, productCode: code, productName: newName };
    }

    let rename = null;
    if (name) {
        const stored = product.productName || '';
        if (!stored || stored === product.productCode || stored === 'General Product' || stored.trim().toLowerCase() !== name.trim().toLowerCase()) {
            if (!index.findDuplicate('productName', name, product._id)) rename = name;
        }
    } else {
        name = product.productName || product.productCode || '';
    }
    const productCode = product.productCode || code;
    if (!name || name === productCode) name = (rename || product.productName) || name || productCode;
    return { product, rename, productCode, productName: name };
};

/**
 * The issue of a row whose product is outside the importing user's MGR access (`allowed`: product
 * ids, or null when the user is not limited; utils/mgrAccess.js). A new product has no MGR yet.
 */
const mgrAccessIssue = (allowed, resolution) => {
    if (!allowed) return null;
    if (resolution.create) {
        return {
            field: 'productCode',
            code: 'MGR_ACCESS',
            message: `Product code ${resolution.productCode} is new, and your MGR access does not allow new products.`,
            hint: 'Ask an administrator to add the product with its MGR first, or skip this row.'
        };
    }
    if (allowed.has(String(resolution.product._id))) return null;
    return {
        field: 'productCode',
        code: 'MGR_ACCESS',
        message: `Product ${resolution.productCode} is outside your MGR access.`,
        hint: 'Ask an administrator to give you access to its MGR, or skip this row.'
    };
};

/** Applies a resolution to the index (and legacy cache): later rows see the new or renamed product. */
const applyProduct = (index, legacy, resolution, newProduct) => {
    if (resolution.create) {
        resolution.product = index.add(newProduct);
        return;
    }
    if (resolution.rename) {
        if (legacy.has(resolution.product)) resolution.product.productName = resolution.rename;
        else index.update(resolution.product, { productName: resolution.rename });
    }
};

// ── Customers ───────────────────────────────────────────────────────────────

const CUSTOMER_SELECT = '_id externalCode customerName companyName mobile pincode billingAddress.pincode branchId';

/** Customers by code in the whole company (codes are unique per company, ignoring case). */
const findCustomersByCode = async (companyId, values) => {
    const found = new Map();
    for (const part of chunk([...new Set(values)], LOOKUP_CHUNK)) {
        const docs = await Customer.find({ companyId, externalCode: { $in: part } })
            .collation(CODE_COLLATION)
            .select(CUSTOMER_SELECT)
            .setOptions({ bypassBranch: true })
            .lean();
        docs.forEach((doc) => {
            const key = upper(doc.externalCode);
            if (key && !found.has(key)) found.set(key, doc);
        });
    }
    return found;
};

/** Customers of the branch whose customer or company name is one of the values. */
const findCustomersByName = async (companyId, branchId, values) => {
    const found = new Map();
    for (const part of chunk([...new Set(values)], LOOKUP_CHUNK)) {
        const docs = await Customer.find({
            companyId,
            branchId,
            $or: [{ customerName: { $in: part } }, { companyName: { $in: part } }]
        })
            .collation(NAME_COLLATION)
            .select(CUSTOMER_SELECT)
            .setOptions({ bypassBranch: true })
            .lean();
        const wanted = new Set(part.map((value) => value.toUpperCase()));
        docs.forEach((doc) => {
            ['customerName', 'companyName'].forEach((field) => {
                const key = String(doc[field] ?? '').toUpperCase();
                if (wanted.has(key) && !found.has(key)) found.set(key, doc);
            });
        });
    }
    return found;
};

// ── Serials ─────────────────────────────────────────────────────────────────

const ASSET_SELECT = '_id serialNumber serialNumberKey status branchId productId productCode customerId saleDate';

/** Saved serials of the company (every branch), grouped by key. */
const findAssetsBySerial = async (companyId, keys) => {
    const byKey = new Map();
    for (const part of chunk([...new Set(keys)], LOOKUP_CHUNK)) {
        const docs = await Asset.find({ companyId, serialNumberKey: { $in: part } })
            .select(ASSET_SELECT)
            .setOptions({ bypassBranch: true })
            .lean();
        docs.forEach((doc) => {
            const list = byKey.get(doc.serialNumberKey) || [];
            list.push(doc);
            byKey.set(doc.serialNumberKey, list);
        });
    }
    return byKey;
};

/** The saved record a serial number refers to: the current one, else the returned one. */
const savedSerial = (byKey, serialNumber) => {
    const list = byKey.get(serialKeyOf(serialNumber)) || [];
    return list.find((asset) => !isReturned(asset)) || list.find(isReturned) || null;
};

const loadBranch = async (companyId, branchId) => (
    Branch.findOne({ _id: branchId, companyId }).select('name').setOptions({ bypassBranch: true }).lean()
);

const divisionFields = (lookup, data) => {
    const { division, segment } = resolveDivisionSegment(lookup, { divisionCode: data.divisionCode, segmentCode: data.segmentCode });
    return division || segment ? { divisionId: division ? division._id : null, segmentId: segment ? segment._id : null } : {};
};

// ── Saving ──────────────────────────────────────────────────────────────────

/** Lookups kept for the whole run, so a product added by one batch is found by the next ones. */
const writeStateOf = async (context, companyId) => {
    if (!context.writeState) {
        context.writeState = { products: await loadProductIndex({ companyId }), legacy: createLegacyProducts() };
    }
    return context.writeState;
};

const productLabel = (code) => (code ? `product ${code}` : 'the product');

/**
 * Saves a batch the way the original importer did: products first (new codes, renames), then
 * customers, then the serials and their history entries. Rows are handled in file order, so a
 * product or customer added by one row is the one the rows after it use.
 */
const write = async (plans, { user, companyId, params, context }) => {
    const errors = new Map();
    const branchId = String(params.branchId);
    const branchName = context.branchName || '';
    const userId = user?.id || null;
    const fail = (plan, message) => {
        if (!errors.has(plan.rowId)) errors.set(plan.rowId, message);
    };
    const live = () => plans.filter((plan) => !errors.has(plan.rowId));

    // Products
    const state = await writeStateOf(context, companyId);
    await state.legacy.prefetch(legacyPairs(state.products, plans.map((plan) => plan.data)));
    const newProducts = [];
    const renamed = new Map();
    plans.forEach((plan) => {
        const resolution = resolveProduct(state.products, state.legacy, plan.data);
        if (resolution.issue) {
            fail(plan, `${resolution.issue.message} ${resolution.issue.hint}`);
            return;
        }
        let doc = null;
        if (resolution.create) {
            doc = {
                _id: new mongoose.Types.ObjectId(),
                companyId,
                productCode: resolution.create.productCode,
                productName: resolution.create.productName || 'General Product',
                hsnCode: 'N/A',
                gstPercentage: 18,
                basePrice: 0,
                mrp: 0,
                uom: 'Nos',
                status: 'Active',
                updatedAt: new Date()
            };
            newProducts.push(doc);
        }
        applyProduct(state.products, state.legacy, resolution, doc);
        if (resolution.rename && !newProducts.includes(resolution.product)) renamed.set(String(resolution.product._id), resolution.product);
        plan.resolved = resolution;
    });

    const productErrors = new Map();
    (await insertRows(Product, newProducts)).forEach((error, index) => {
        const product = newProducts[index];
        state.products.remove(product);
        productErrors.set(product, `${productLabel(product.productCode)} could not be added to the Product Master: ${describeWriteError(error, 'product')}`);
    });
    const renames = [...renamed.values()];
    (await writeRows(Product, renames.map((product) => ({
        updateOne: {
            filter: { _id: product._id, companyId: state.legacy.has(product) ? null : companyId },
            update: { $set: { productName: product.productName } }
        }
    })))).forEach((error, index) => {
        productErrors.set(renames[index], `The name of ${productLabel(renames[index].productCode)} could not be changed: ${describeWriteError(error, 'product')}`);
    });
    live().forEach((plan) => {
        if (productErrors.has(plan.resolved.product)) fail(plan, productErrors.get(plan.resolved.product));
    });

    // Customers
    const targetOf = (plan) => clean(plan.data.customerCode) || clean(plan.data.customerName);
    const targets = live().map(targetOf).filter(Boolean);
    const dbByCode = await findCustomersByCode(companyId, targets);
    const dbByName = await findCustomersByName(companyId, branchId, targets.filter((target) => !dbByCode.has(target.toUpperCase())));
    const newByCode = new Map();
    const newByName = new Map();
    const newCustomers = [];
    const customerUpdates = new Map();
    const changesOf = (customer) => {
        const id = String(customer._id);
        if (!customerUpdates.has(id)) customerUpdates.set(id, { customer, set: {} });
        return customerUpdates.get(id).set;
    };
    live().forEach((plan) => {
        const target = targetOf(plan);
        const code = clean(plan.data.customerCode);
        let mobile = clean(plan.data.mobile);
        plan.customer = null;
        plan.customerCode = code;
        plan.customerPostalCode = '';
        if (target) {
            const key = target.toUpperCase();
            let customer = dbByCode.get(key) || newByCode.get(key) || dbByName.get(key) || newByName.get(key) || null;
            if (!customer) {
                const name = clean(plan.data.customerName) || target;
                customer = {
                    _id: new mongoose.Types.ObjectId(),
                    companyId,
                    branchId,
                    externalCode: target,
                    customerName: name,
                    companyName: name,
                    mobile: mobile || '',
                    createdBy: userId
                };
                newCustomers.push(customer);
                newByCode.set(key, customer);
                [customer.customerName, customer.companyName].forEach((value) => {
                    const nameKey = upper(value);
                    if (nameKey && !newByName.has(nameKey)) newByName.set(nameKey, customer);
                });
            } else if (mobile && !customer.mobile) {
                customer.mobile = mobile;
                if (!newCustomers.includes(customer)) changesOf(customer).mobile = mobile;
            }
            if (!mobile && customer.mobile) mobile = String(customer.mobile).trim();
            if (!customer.externalCode && code) {
                customer.externalCode = code;
                if (!newCustomers.includes(customer)) changesOf(customer).externalCode = code;
                if (!newByCode.has(code.toUpperCase())) newByCode.set(code.toUpperCase(), customer);
            }
            plan.customer = customer;
            plan.customerCode = customer.externalCode || code || target;
            plan.customerPostalCode = customer.billingAddress?.pincode || customer.pincode || '';
        }
        plan.mobile = mobile;
    });

    const customerErrors = new Map();
    (await insertRows(Customer, newCustomers)).forEach((error, index) => {
        const customer = newCustomers[index];
        customerErrors.set(customer, `Customer ${customer.externalCode} could not be added to the Customer Master: ${describeWriteError(error, 'customer')}`);
    });
    const updates = [...customerUpdates.values()];
    (await writeRows(Customer, updates.map(({ customer, set }) => ({
        updateOne: { filter: { _id: customer._id, companyId }, update: { $set: set } }
    })))).forEach((error, index) => {
        customerErrors.set(updates[index].customer, `Customer ${updates[index].customer.externalCode || ''} could not be updated: ${describeWriteError(error, 'customer')}`);
    });
    live().forEach((plan) => {
        if (plan.customer && customerErrors.has(plan.customer)) fail(plan, customerErrors.get(plan.customer));
    });

    // Serials: checked again here, the database may have changed since the rows were checked.
    const saved = await findAssetsBySerial(companyId, live().map((plan) => serialKeyOf(plan.data.serialNumber)));
    const assetUpdates = [];
    const assetInserts = [];
    const now = new Date();
    live().forEach((plan) => {
        const { data, customer, resolved: { product, productCode, productName } } = plan;
        const serialNumber = clean(data.serialNumber);
        const existing = savedSerial(saved, serialNumber);
        let division;
        try {
            division = divisionFields(context.divisions, data);
        } catch (error) {
            fail(plan, error.message);
            return;
        }
        const customerNameStr = customer ? (customer.companyName || customer.customerName) : '';
        const indicatorField = clean(data.indicatorField).slice(0, INDICATOR_MAX);

        if (plan.action === 'create') {
            if (existing) {
                fail(plan, `Serial number ${serialNumber} was saved by someone else while this import was running. Import again to update it.`);
                return;
            }
            const status = data.status || 'IN_STOCK';
            const saleDate = data.saleDate || (status === 'SOLD' ? now : null);
            const location = clean(data.location) || branchName;
            assetInserts.push({
                plan,
                doc: {
                    _id: plan.recordId,
                    companyId,
                    branchId,
                    productId: product._id,
                    productCode: product.productCode || productCode || '',
                    productName: product.productName || productName || '',
                    serialNumber,
                    status,
                    customerId: customer ? customer._id : null,
                    customerCode: plan.customerCode,
                    customerNameStr,
                    customerPostalCode: plan.customerPostalCode,
                    customerMobile: plan.mobile || '',
                    invoiceNumber: clean(data.invoiceNumber),
                    saleDate,
                    location,
                    indicatorField,
                    ...division,
                    projectCode: clean(data.projectCode),
                    projectName: clean(data.projectName),
                    createdBy: userId
                },
                history: {
                    companyId,
                    assetId: plan.recordId,
                    serialNumber,
                    productCode,
                    productName,
                    branchId,
                    productId: product._id,
                    customerId: customer ? customer._id : null,
                    customerCode: plan.customerCode,
                    customerName: customerNameStr,
                    customerPostalCode: plan.customerPostalCode,
                    customerMobile: plan.mobile || '',
                    invoiceNumber: clean(data.invoiceNumber),
                    saleDate,
                    location,
                    indicatorField,
                    projectCode: clean(data.projectCode),
                    projectName: clean(data.projectName),
                    transactionType: 'IMPORT',
                    status,
                    createdBy: userId
                }
            });
            return;
        }

        if (!existing || !sameId(existing._id, plan.recordId)) {
            fail(plan, `Serial number ${serialNumber} was deleted or changed while this import was running. Import again to retry this row.`);
            return;
        }
        if (!sameId(existing.branchId, branchId)) {
            fail(plan, `Serial number ${serialNumber} was moved to another branch while this import was running.`);
            return;
        }

        if (isReturned(existing)) {
            // A returned serial on a new invoice is sold again: the row replaces the earlier
            // sale's details, as a new sale does, and the resale is recorded in its history.
            const sheetStatus = data.status || 'IN_STOCK';
            const status = sheetStatus === 'RETURN' ? 'SOLD' : sheetStatus;
            const saleDate = data.saleDate || now;
            const location = clean(data.location) || branchName;
            const set = {
                branchId,
                productId: product._id,
                productCode: productCode || product.productCode || '',
                productName: productName || product.productName || '',
                status,
                customerId: customer ? customer._id : null,
                customerCode: plan.customerCode,
                customerNameStr,
                customerPostalCode: plan.customerPostalCode,
                customerMobile: plan.mobile || '',
                invoiceNumber: clean(data.invoiceNumber),
                saleDate,
                location,
                indicatorField,
                ...division,
                projectCode: clean(data.projectCode),
                projectName: clean(data.projectName),
                returnReason: '',
                returnedAt: null
            };
            assetUpdates.push({
                plan,
                op: { updateOne: { filter: { _id: existing._id, companyId }, update: { $set: set } } },
                history: {
                    companyId,
                    assetId: existing._id,
                    serialNumber,
                    productCode: product.productCode,
                    productName: product.productName,
                    branchId,
                    productId: product._id,
                    customerId: customer ? customer._id : null,
                    customerCode: plan.customerCode,
                    customerName: customerNameStr,
                    customerPostalCode: plan.customerPostalCode,
                    customerMobile: plan.mobile || '',
                    invoiceNumber: clean(data.invoiceNumber),
                    saleDate,
                    location,
                    indicatorField,
                    projectCode: clean(data.projectCode),
                    projectName: clean(data.projectName),
                    transactionType: 'IMPORT_RESELL',
                    status,
                    createdBy: userId
                }
            });
            return;
        }

        // An ordinary update (the same file uploaded again, a corrected register): only the
        // values the row has are changed, a blank cell keeps what is saved. No history entry.
        const set = {
            branchId,
            productId: product._id,
            productCode: product.productCode || productCode || '',
            productName: product.productName || productName || ''
        };
        if (data.status) set.status = data.status;
        if (customer) {
            set.customerId = customer._id;
            set.customerCode = plan.customerCode;
            set.customerNameStr = customerNameStr;
            set.customerPostalCode = plan.customerPostalCode;
        }
        if (plan.mobile) set.customerMobile = plan.mobile;
        else if (customer && !sameId(existing.customerId, customer._id)) set.customerMobile = '';
        if (data.invoiceNumber !== undefined) set.invoiceNumber = clean(data.invoiceNumber);
        if (data.saleDate) set.saleDate = data.saleDate;
        else if ((set.status || existing.status) === 'SOLD' && !existing.saleDate) set.saleDate = now;
        if (data.location !== undefined) set.location = clean(data.location);
        if (data.indicatorField !== undefined) set.indicatorField = indicatorField;
        Object.assign(set, division);
        if (data.projectCode !== undefined) set.projectCode = clean(data.projectCode);
        if (data.projectName !== undefined) set.projectName = clean(data.projectName);
        assetUpdates.push({ plan, op: { updateOne: { filter: { _id: existing._id, companyId }, update: { $set: set } } } });
    });

    (await writeRows(Asset, assetUpdates.map(({ op }) => op))).forEach((error, index) => {
        fail(assetUpdates[index].plan, `Serial number ${clean(assetUpdates[index].plan.data.serialNumber)} could not be updated: ${describeWriteError(error, 'serial number')}`);
    });
    (await insertRows(Asset, assetInserts.map(({ doc }) => doc))).forEach((error, index) => {
        const { plan } = assetInserts[index];
        const duplicate = (error?.code ?? error?.err?.code) === 11000;
        fail(plan, duplicate
            ? `Serial number ${clean(plan.data.serialNumber)} was saved by someone else while this import was running. Import again to update it.`
            : `Serial number ${clean(plan.data.serialNumber)} could not be saved: ${describeWriteError(error, 'serial number')}`);
    });

    // History of the serials that were saved. The serial itself is saved either way, as before.
    const histories = [...assetInserts, ...assetUpdates].filter((item) => item.history && !errors.has(item.plan.rowId));
    (await insertRows(AssetHistory, histories.map((item) => item.history))).forEach((error, index) => {
        console.error(`Invoice Bulk Upload: history of serial ${histories[index].history.serialNumber} was not recorded:`, describeWriteError(error, 'history entry'));
    });

    return errors;
};

module.exports = {
    key: 'assets',
    label: 'Invoice Bulk Upload',
    recordLabel: 'serial number',
    recordLabelPlural: 'serial numbers',
    permissions: [['master_serials', 'create']],
    model: Asset,
    fields: FIELDS,
    // Every upload adds new serials and updates the ones already saved, as it always has.
    modes: ['upsert'],

    /** The branch selected in the header; the import keeps it even if the header changes. */
    async resolveParams(raw, { user }) {
        const branchId = String(getActiveBranchId() || user?.activeBranchId || '').trim();
        if (!/^[a-f\d]{24}$/i.test(branchId)) {
            throw new ImportJobError(
                'NO_BRANCH',
                'Select a branch before importing invoices.',
                'Choose the branch at the top of the screen, then upload the file again.',
                400
            );
        }
        const branch = await loadBranch(companyOf(user), branchId);
        if (!branch) {
            throw new ImportJobError('BRANCH_INVALID', 'The selected branch does not belong to this company.', 'Choose the branch again at the top of the screen.', 400);
        }
        return { branchId, branchName: clean(branch.name) };
    },

    describeParams(params) {
        return params.branchName ? `Branch: ${params.branchName}` : '';
    },

    identityKeys(data) {
        const key = serialKeyOf(data.serialNumber);
        return key ? [{ key: `serial:${key}`, field: 'serialNumber', label: 'serial number' }] : [];
    },

    async loadContext({ params, user, rows }) {
        const companyId = companyOf(user);
        const branch = await loadBranch(companyId, params.branchId);
        if (!branch) {
            throw new ImportJobError('BRANCH_INVALID', 'The branch of this import no longer exists.', 'Upload the file again from an existing branch.', 400);
        }
        const assetsByKey = await findAssetsBySerial(companyId, rows.map((data) => serialKeyOf(data.serialNumber)).filter(Boolean));
        const otherBranchIds = new Set();
        assetsByKey.forEach((list) => list.forEach((asset) => {
            if (asset.branchId && !sameId(asset.branchId, params.branchId)) otherBranchIds.add(String(asset.branchId));
        }));
        const branches = otherBranchIds.size
            ? await Branch.find({ _id: { $in: [...otherBranchIds] }, companyId }).select('name').setOptions({ bypassBranch: true }).lean()
            : [];
        const products = await loadProductIndex({ companyId });
        const legacy = createLegacyProducts();
        await legacy.prefetch(legacyPairs(products, rows));
        return {
            companyId,
            branchId: String(params.branchId),
            branchName: clean(branch.name),
            branchNames: new Map(branches.map((item) => [String(item._id), clean(item.name)])),
            assetsByKey,
            products,
            legacy,
            divisions: await loadDivisionSegmentLookup(companyId),
            mgrAllowed: await allowedProductIdSet(user),
            seenSerials: new Set()
        };
    },

    /**
     * Runs in file order, once per check of the whole file. The products that earlier rows add
     * or rename are applied to this check's copy of the catalog, so a later row whose new code
     * reuses their name is caught here, before anything is saved.
     */
    validate(data, { context, issues: earlier = [] }) {
        const issues = [];
        const serialKey = serialKeyOf(data.serialNumber);

        if (data.status !== undefined) {
            const status = mapStatus(data.status);
            if (status) data.status = status;
            else {
                issues.push({
                    field: 'status',
                    code: 'INVALID_OPTION',
                    message: `Status "${data.status}" is not one the system knows.`,
                    hint: 'Use In Stock, Allocated, Sold, Return or Scrapped, or leave it blank.'
                });
            }
        }

        if (data.mobile !== undefined && !/^\d{10}$/.test(data.mobile)) {
            issues.push({
                field: 'mobile',
                code: 'INVALID_MOBILE',
                message: 'Mobile Number must be 10 digits.',
                hint: `The file has "${data.mobile}". Leave it blank to use the mobile from the Customer Master.`
            });
        }

        if (data.indicatorField !== undefined) data.indicatorField = data.indicatorField.slice(0, INDICATOR_MAX);

        if (data.divisionCode !== undefined || data.segmentCode !== undefined) {
            try {
                divisionFields(context.divisions, data);
            } catch (error) {
                issues.push({
                    field: /^Segment/.test(error.message) ? 'segmentCode' : 'divisionCode',
                    code: 'NOT_FOUND',
                    message: error.message,
                    hint: 'Use the codes of the Division and Segment Masters, or leave both blank.'
                });
            }
        }

        const saved = serialKey ? savedSerial(context.assetsByKey, data.serialNumber) : null;
        if (saved && !sameId(saved.branchId, context.branchId)) {
            const branchName = saved.branchId ? context.branchNames.get(String(saved.branchId)) : '';
            issues.push({
                field: 'serialNumber',
                code: 'OTHER_BRANCH',
                message: saved.branchId
                    ? `Serial number ${data.serialNumber} is already saved in ${branchName ? `branch ${branchName}` : 'another branch'}.`
                    : `Serial number ${data.serialNumber} is already saved without a branch.`,
                hint: 'A serial number belongs to one branch only. Import this row from that branch, or skip it.'
            });
        }
        if (saved && context.mgrAllowed && !context.mgrAllowed.has(String(saved.productId || ''))) {
            issues.push({
                field: 'serialNumber',
                code: 'MGR_ACCESS',
                message: `Serial number ${data.serialNumber} is already saved under a product outside your MGR access.`,
                hint: 'Ask an administrator to import this row, or skip it.'
            });
        }

        if (!data.productCode && !data.productName) {
            issues.push({
                field: 'productCode',
                code: 'REQUIRED',
                message: 'Product Code or Product Name is missing.',
                hint: 'Fill in the product code (or the product name exactly as in the Product Master).'
            });
        } else {
            const resolution = resolveProduct(context.products, context.legacy, data);
            const mgrIssue = resolution.issue ? null : mgrAccessIssue(context.mgrAllowed, resolution);
            if (resolution.issue) issues.push(resolution.issue);
            else if (mgrIssue) issues.push(mgrIssue);
            else if (!earlier.length && !issues.length && !(serialKey && context.seenSerials.has(serialKey))) {
                // Only a row that will be imported adds or renames a product.
                applyProduct(context.products, context.legacy, resolution, resolution.create
                    ? { _id: new mongoose.Types.ObjectId(), ...resolution.create, addedByFile: true }
                    : null);
            }
        }

        if (serialKey) context.seenSerials.add(serialKey);
        return issues;
    },

    /** The serial a row updates: one saved in this branch (another branch is an issue above). */
    match(data, context) {
        const saved = data.serialNumber ? savedSerial(context.assetsByKey, data.serialNumber) : null;
        if (!saved || !sameId(saved.branchId, context.branchId)) return null;
        return { record: saved, by: 'serial number', field: 'serialNumber' };
    },

    describe(record) {
        return [record.serialNumber, record.productCode].filter(Boolean).join(' · ');
    },

    write,

    async afterImport({ user, run }) {
        const companyId = companyOf(user);
        await Promise.all([invalidateCustomerCaches(), invalidateProductCaches(), invalidateAssetCaches(companyId)]);
        const saved = run.created + run.updated;
        if (!saved) return;
        const { createCompanyNotifications } = require('../../../utils/notificationHelper');
        await createCompanyNotifications({
            companyId,
            title: 'Invoice Bulk Upload Complete',
            message: `Successfully imported ${saved} serial asset records (created: ${run.created}, updated: ${run.updated}, failed: ${run.failed}).`,
            type: 'Reminder',
            excludeUserId: user?.id
        });
    }
};
