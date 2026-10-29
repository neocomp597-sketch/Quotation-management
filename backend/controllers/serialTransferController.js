const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const Branch = require('../models/Branch');
const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
require('../models/MGR'); // populated through Product mgr1..mgr5
const SerialTransfer = require('../models/SerialTransfer');
const SerialBranchTransfer = require('../models/SerialBranchTransfer');
const { MGR_KEYS, formatMgrVal } = require('../utils/productMgr');
const { formatDate } = require('../utils/dateFormat');
const { getActiveBranchId } = require('../middlewares/tenantContext');
const { limitedBranchIds, canMoveFrom, visibleTransfersCondition } = require('../utils/serialBranchAccess');

/**
 * Serial No Transfer: the serial numbers of Invoice Bulk Upload (Asset), read straight from
 * the Asset records so nothing is copied and every status (sold, in stock, allocated, return,
 * scrapped) is listed as Invoice Bulk Upload shows it.
 *
 * Customer history is kept for serials of any status, and recording a customer never changes the
 * status. The first customer is the one on the invoice row, written from the invoice data the
 * first time a record is saved for the serial (a serial whose row names no customer starts with
 * the first customer recorded here): the original sale ("Sold") of a sold, returned or scrapped
 * serial, or an allocation ("Allocated") of an allocated or in-stock one. A new customer of a sold
 * serial is a transfer ("Transferred"); of any other serial an assignment ("Assigned"), so an
 * unsold serial is never recorded as sold. A returned serial's return is saved as its own record
 * ("Returned") before its next customer. A scrapped serial keeps its history but cannot be given a
 * new customer. Each new customer switches the current record off and adds a new active one, so
 * history is never overwritten and only the latest customer is active. The Asset's customer is
 * moved to the new customer as well, so complaints, AMC and the Invoice Bulk Upload list show the
 * current holder.
 *
 * Branch transfers (bottom of this file) move serials of any status to another branch.
 */

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const toKey = (value) => cleanText(value).toUpperCase();
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const activeBranchFilter = () => {
    const branchId = getActiveBranchId();
    return branchId && mongoose.Types.ObjectId.isValid(branchId)
        ? { branchId: new mongoose.Types.ObjectId(branchId) }
        : null;
};

const addActiveBranchFilter = (query) => {
    const branchFilter = activeBranchFilter();
    return branchFilter ? { $and: [query, branchFilter] } : query;
};

// From/To dates are calendar days as users see them in India (UTC+05:30); both ends are inclusive.
// Sale dates are stored as UTC midnight of the day and transfer dates as the chosen day at the
// time of saving, so day boundaries in this offset put both on the day the screens show.
const BUSINESS_UTC_OFFSET_MS = 330 * 60000;
const DAY_MS = 86400000;
const parseDay = (value, label) => {
    const text = cleanText(value);
    if (!text) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const day = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (!day || day.getUTCDate() !== Number(match[3])) throw httpError(400, `${label} is not a valid date.`);
    return day;
};
const dayStart = (day, addDays = 0) => new Date(day.getTime() + addDays * DAY_MS - BUSINESS_UTC_OFFSET_MS);

/** A Mongo range for the fromDate/toDate query parameters, or null when neither is set. */
const dateRange = (query) => {
    const from = parseDay(query.fromDate, 'From Date');
    const to = parseDay(query.toDate, 'To Date');
    if (from && to && from > to) throw httpError(400, 'From Date cannot be later than To Date.');
    if (!from && !to) return null;
    const range = {};
    if (from) range.$gte = dayStart(from);
    if (to) range.$lt = dayStart(to, 1);
    return range;
};

// The sale date shown in the Serial No List: saleDate, else invoiceDate, else (sold serials only) createdAt.
const saleDateCondition = (range) => ({
    $or: [
        { saleDate: range },
        { saleDate: null, invoiceDate: range },
        { saleDate: null, invoiceDate: null, status: 'SOLD', createdAt: range }
    ]
});

/**
 * Product filter for ?mgr1..?mgr5 (an MGR id from MGR Master): `{ $in: product ids }` of the
 * products that have that MGR in Product Master, or null when no MGR filter is set.
 */
const mgrProductFilter = async (query) => {
    const conditions = {};
    for (const key of MGR_KEYS) {
        const value = cleanText(query[key]);
        if (!value) continue;
        if (!mongoose.Types.ObjectId.isValid(value)) throw httpError(400, `Invalid ${key.toUpperCase()} filter.`);
        conditions[key] = value;
    }
    if (!Object.keys(conditions).length) return null;
    const ids = await Product.find(conditions).setOptions({ bypassBranch: true }).distinct('_id');
    return { $in: ids };
};

// Invoice Bulk Upload statuses offered by the status filters. Return covers both spellings
// (Invoice Bulk Upload counts RETURN and RETURNED together); records saved without a status
// are shown as In Stock, so they are found under it.
const ASSET_STATUSES = {
    SOLD: 'SOLD',
    IN_STOCK: { $in: ['IN_STOCK', null] },
    ALLOCATED: 'ALLOCATED',
    RETURN: { $in: ['RETURN', 'RETURNED'] },
    SCRAPPED: 'SCRAPPED'
};

/** Asset.status condition for a ?status filter value, or null when no status is chosen. */
const assetStatusCondition = (value) => {
    const key = cleanText(value).toUpperCase();
    if (!key) return null;
    if (!ASSET_STATUSES[key]) throw httpError(400, 'Unknown status filter.');
    return ASSET_STATUSES[key];
};

const statusOf = (asset) => asset?.status || 'IN_STOCK';

const branchPopulate = { path: 'branchId', select: 'name code', options: { bypassTenant: true } };
const branchLabel = (branch) => cleanText(branch?.name) || cleanText(branch?.code);
const idOf = (value) => value?._id || value || null;

const sendError = (res, error, message) => {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message, error: error.message });
};

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const CUSTOMER_SELECT = 'customerName companyName externalCode mobile gstin billingAddress';
const customerPopulate = { path: 'customerId', select: CUSTOMER_SELECT, options: { bypassTenant: true } };

const customerLabel = (customer, fallback = '') => cleanText(customer?.companyName) || cleanText(customer?.customerName) || fallback;

// Customer fields copied onto a history record.
const customerSnapshot = (customer, fallback = {}) => ({
    customerId: customer?._id || null,
    customerCode: cleanText(customer?.externalCode) || cleanText(fallback.customerCode),
    customerName: cleanText(customer?.customerName) || cleanText(fallback.customerName),
    companyName: customerLabel(customer, cleanText(fallback.customerName)),
    customerMobile: cleanText(customer?.mobile) || cleanText(fallback.customerMobile),
    customerGstin: cleanText(customer?.gstin),
    customerCity: cleanText(customer?.billingAddress?.city),
    customerState: cleanText(customer?.billingAddress?.state),
    customerPincode: cleanText(customer?.billingAddress?.pincode) || cleanText(fallback.customerPostalCode)
});

const saleDateOf = (asset) => asset.saleDate || asset.invoiceDate || asset.createdAt || new Date();
// The Invoice Date of an Invoice Bulk Upload row, as its form shows it.
const invoiceDateOf = (asset) => asset?.saleDate || asset?.invoiceDate || null;

// The invoice a history record shows. Sold and Transferred records saved before transfers carried
// the invoice over have none of their own, and show the serial's invoice they were sold on.
const withInvoice = (entry, asset) => {
    if (entry.entryType === 'Past Entry' || !asset) return entry;
    const invoiceNumber = entry.invoiceNumber || asset.invoiceNumber || '';
    const sameInvoice = invoiceNumber === (asset.invoiceNumber || '');
    return { ...entry, invoiceNumber, invoiceDate: entry.invoiceDate || (sameInvoice ? invoiceDateOf(asset) : null) };
};

// Whether the invoice row gives the serial a first customer (always true for a sold serial).
const hasSaleCustomer = (asset) => asset.status === 'SOLD' || Boolean(asset.customerId || cleanText(asset.customerNameStr));

const isReturned = (asset) => asset.status === 'RETURN' || asset.status === 'RETURNED';
// The invoice row's customer of an allocated or in-stock serial is an allocation, not a sale.
const originType = (asset) => (['ALLOCATED', 'IN_STOCK'].includes(statusOf(asset)) ? 'Allocated' : 'Sold');
// A new customer recorded here: a transfer of a sold serial (or of one sold by this change), else
// an assignment.
const changeType = (asset, sells = false) => (sells || asset.status === 'SOLD' ? 'Transferred' : 'Assigned');
// Statuses whose serial can be sold to the new customer by a transfer (Transfer, not Assign).
const SELLABLE_STATUSES = ['ALLOCATED', 'IN_STOCK'];
// The entries that give a serial to a new customer (counted as its transfers).
const CHANGE_TYPES = ['Transferred', 'Assigned'];
const ENTRY_TYPES = SerialTransfer.schema.path('entryType').enumValues;

// The first customer, as a history record built from the Invoice Bulk Upload row.
const saleRecord = (asset) => ({
    assetId: asset._id,
    serialNumber: asset.serialNumber,
    serialKey: toKey(asset.serialNumber),
    productId: asset.productId?._id || asset.productId || null,
    productCode: asset.productCode || '',
    productName: asset.productName || '',
    ...customerSnapshot(asset.customerId && typeof asset.customerId === 'object' ? asset.customerId : null, {
        customerCode: asset.customerCode,
        customerName: asset.customerNameStr,
        customerMobile: asset.customerMobile,
        customerPostalCode: asset.customerPostalCode
    }),
    customerId: asset.customerId?._id || asset.customerId || null,
    entryType: originType(asset),
    transferDate: saleDateOf(asset),
    invoiceNumber: asset.invoiceNumber || '',
    invoiceDate: invoiceDateOf(asset),
    isActive: true,
    branchId: idOf(asset.branchId)
});

const CUSTOMER_FIELDS = ['customerId', 'customerCode', 'customerName', 'companyName', 'customerMobile', 'customerGstin', 'customerCity', 'customerState', 'customerPincode'];

// The return of a returned serial, as an inactive record of the customer who gave it back.
const returnRecord = (asset, holder, date) => {
    const invoice = withInvoice(holder, asset);
    return {
        assetId: asset._id,
        serialNumber: asset.serialNumber,
        serialKey: toKey(asset.serialNumber),
        productId: holder.productId || null,
        productCode: holder.productCode || '',
        productName: holder.productName || '',
        ...Object.fromEntries(CUSTOMER_FIELDS.map((key) => [key, holder[key]])),
        entryType: 'Returned',
        transferDate: date,
        isActive: false,
        endedAt: date,
        invoiceNumber: invoice.invoiceNumber || '',
        invoiceDate: invoice.invoiceDate || null,
        remarks: cleanText(asset.returnReason),
        branchId: idOf(asset.branchId) || holder.branchId || null
    };
};

/**
 * The record of the customer who returned a returned serial, while that return is not in its
 * history yet (it is saved with the serial's next customer); else null. A return made before the
 * current customer received the serial was an earlier holder's and is not recorded for them.
 */
const unrecordedReturn = (asset, records) => {
    if (!isReturned(asset)) return null;
    const since = asset.returnedAt ? startOfDay(asset.returnedAt) : null;
    if (records.some((record) => record.entryType === 'Returned' && (!since || record.transferDate >= since))) return null;
    const holder = records.find((record) => record.isActive);
    if (!holder || (since && since < startOfDay(holder.transferDate))) return null;
    return holder;
};

// The date of a return: the sales return's, else (a status set by an upload, with no return date)
// the fallback; never before the returning customer received the serial.
const returnDateOf = (asset, holder, fallback) => {
    const date = asset.returnedAt || fallback;
    if (!date) return null;
    return holder.transferDate && date < holder.transferDate ? holder.transferDate : date;
};

// The serial's saved records, inside a transaction. The first time, the invoice row's customer is
// saved as the first record.
const savedHistory = async (asset, user, session) => {
    const records = await SerialTransfer.find({ assetId: asset._id }).session(session).lean();
    if (records.length || !hasSaleCustomer(asset)) return records;
    const [first] = await SerialTransfer.create([{ ...saleRecord(asset), ...user }], { session });
    return [first.toObject()];
};

const historyOf = (assetId) => SerialTransfer.find(addActiveBranchFilter({ assetId }))
    .sort({ transferDate: 1, createdAt: 1 })
    .lean();

// ?ownership=Sold: sold serials still with the customer they were sold to; Transferred: serials
// that have been transferred or assigned to a new customer at least once.
const ownershipFilter = async (ownership) => {
    if (ownership !== 'Transferred' && ownership !== 'Sold') return null;
    const rows = await SerialTransfer.aggregate([
        { $match: { entryType: { $in: CHANGE_TYPES } } },
        { $group: { _id: '$assetId' } }
    ]);
    const ids = rows.map((row) => row._id);
    return ownership === 'Transferred' ? { $in: ids } : { $nin: ids };
};

/**
 * Serial No List: every Invoice Bulk Upload serial, of every status, with its current branch and
 * current customer (?status filters by status). The list follows the same branch rule as Invoice
 * Bulk Upload. `transfers` counts the new customers recorded for the serial (transfers and
 * assignments); `transferred` says whether it has any.
 */
exports.listSerials = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const query = {};
        const and = [];
        const status = assetStatusCondition(req.query.status);
        if (status) and.push({ status });
        if (req.query.ownership === 'Sold') and.push({ status: 'SOLD' });

        const search = cleanText(req.query.search);
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            const byField = {
                serial: [{ serialNumber: pattern }],
                product: [{ productCode: pattern }, { productName: pattern }],
                customer: [{ customerNameStr: pattern }, { customerCode: pattern }]
            };
            if (req.query.field === 'customer') {
                // The customer master name can differ from the name stored on the invoice row.
                const customers = await Customer.find({ $or: [{ companyName: pattern }, { customerName: pattern }, { externalCode: pattern }] })
                    .select('_id').limit(500).lean();
                byField.customer.push({ customerId: { $in: customers.map((c) => c._id) } });
            }
            and.push({ $or: byField[req.query.field] || [...byField.serial, ...byField.product, ...byField.customer] });
        }

        const range = dateRange(req.query);
        if (range) and.push(saleDateCondition(range));
        if (and.length) query.$and = and;
        const products = await mgrProductFilter(req.query);
        if (products) query.productId = products;

        const assetFilter = await ownershipFilter(req.query.ownership);
        if (assetFilter) query._id = assetFilter;
        const scopedQuery = addActiveBranchFilter(query);

        const [assets, total] = await Promise.all([
            Asset.find(scopedQuery)
                .select('serialNumber productId productCode productName status branchId customerId customerCode customerNameStr saleDate invoiceDate invoiceNumber createdAt')
                .populate(customerPopulate)
                .populate(branchPopulate)
                .sort({ saleDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Asset.countDocuments(scopedQuery)
        ]);

        const counts = assets.length
            ? await SerialTransfer.aggregate([
                { $match: addActiveBranchFilter({ assetId: { $in: assets.map((asset) => asset._id) } }) },
                {
                    $group: {
                        _id: '$assetId',
                        transfers: { $sum: { $cond: [{ $in: ['$entryType', CHANGE_TYPES] }, 1, 0] } },
                        lastTransferDate: { $max: '$transferDate' }
                    }
                }
            ])
            : [];
        const countById = new Map(counts.map((row) => [String(row._id), row]));

        const data = assets.map((asset) => {
            const transfer = countById.get(String(asset._id));
            const transfers = transfer?.transfers || 0;
            return {
                _id: asset._id,
                serialNumber: asset.serialNumber,
                productCode: asset.productCode,
                productName: asset.productName,
                customerId: asset.customerId?._id || null,
                customerCode: cleanText(asset.customerId?.externalCode) || asset.customerCode,
                customerName: customerLabel(asset.customerId, asset.customerNameStr),
                // A serial that is not sold has a sale date only if its invoice gave one.
                saleDate: asset.status === 'SOLD' ? saleDateOf(asset) : asset.saleDate || asset.invoiceDate || null,
                invoiceNumber: asset.invoiceNumber,
                transfers,
                lastTransferDate: transfers ? transfer.lastTransferDate : null,
                transferred: transfers > 0,
                status: statusOf(asset),
                branchId: idOf(asset.branchId),
                branchName: branchLabel(asset.branchId)
            };
        });

        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load serial numbers');
    }
};

const loadSerial = async (assetId) => {
    const asset = await Asset.findOne(addActiveBranchFilter({ _id: assetId })).populate(customerPopulate).populate(branchPopulate).lean();
    if (!asset) return null;

    let history = (await historyOf(asset._id)).map((entry) => withInvoice(entry, asset));
    // Nothing saved yet: the invoice row's customer is shown until the first record saves it.
    if (!history.length && hasSaleCustomer(asset)) history = [{ ...saleRecord(asset), _id: null, pending: true }];
    // A return not saved yet is shown as it will be saved with the next customer.
    const returning = unrecordedReturn(asset, history);
    if (returning) {
        const date = returnDateOf(asset, returning, null);
        history = [
            ...history.map((entry) => (entry === returning ? { ...entry, isActive: false, endedAt: date } : entry)),
            { ...returnRecord(asset, returning, date), _id: null, pending: true }
        ];
    }

    return {
        asset: {
            _id: asset._id,
            serialNumber: asset.serialNumber,
            productCode: asset.productCode,
            productName: asset.productName,
            status: statusOf(asset),
            branchId: idOf(asset.branchId),
            branchName: branchLabel(asset.branchId),
            invoiceNumber: asset.invoiceNumber,
            invoiceDate: invoiceDateOf(asset),
            saleDate: saleDateOf(asset),
            customerId: asset.customerId?._id || null,
            customerCode: cleanText(asset.customerId?.externalCode) || asset.customerCode,
            customerName: customerLabel(asset.customerId, asset.customerNameStr)
        },
        history
    };
};

// The serial a customer transfer or past entry is saved for, of any status.
const loadTransferSerial = async (assetId) => {
    const asset = await Asset.findOne(addActiveBranchFilter({ _id: assetId })).populate(customerPopulate).lean();
    if (!asset) throw httpError(404, 'Serial number not found');
    return asset;
};

/** One serial number (any status) with its complete customer history, oldest first. */
exports.getSerial = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.assetId)) {
            return res.status(400).json({ message: 'Invalid serial record' });
        }
        const result = await loadSerial(req.params.assetId);
        if (!result) return res.status(404).json({ message: 'Serial number not found' });
        return res.json(result);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load the serial number', error: error.message });
    }
};

// The chosen day at the time the transfer is recorded, so the history has a date and a time.
const transferMoment = (value) => {
    const now = new Date();
    if (!value) return now;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), now.getHours(), now.getMinutes(), now.getSeconds())
        : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => new Date(new Date(value).setHours(0, 0, 0, 0));

/**
 * Assigns a serial number to another customer. In one transaction: the invoice row's customer is
 * saved as the first record if this is the first change, a returned serial's return is saved, the
 * current record becomes inactive, a new active record is added for the new customer and the
 * asset moves to that customer. Either all of it is saved or none of it. Nothing earlier is
 * changed or removed. Scrapped serials are refused.
 *
 * The serial's status stays as it is (Assign), unless `sale: true` is sent for an allocated or
 * in-stock serial (Transfer): it is then sold to the new customer, its status becomes SOLD and the
 * record is a Transferred one. A returned serial is re-sold with Add Single Entry instead.
 *
 * The form sends a requestId with each save; repeating a request returns the record it already
 * created instead of adding a second one.
 */
exports.transferSerial = async (req, res) => {
    const { assetId } = req.params;
    const requestId = cleanText(req.body.requestId).slice(0, 100) || undefined;
    let session;
    try {
        if (!mongoose.Types.ObjectId.isValid(assetId)) throw httpError(400, 'Invalid serial record');
        const customerId = req.body.customerId;
        if (!mongoose.Types.ObjectId.isValid(customerId)) throw httpError(400, 'Select the new customer.');
        const transferDate = transferMoment(req.body.transferDate);
        if (!transferDate) throw httpError(400, 'Transfer date is not a valid date.');
        if (startOfDay(transferDate) > startOfDay(new Date())) throw httpError(400, 'Transfer date cannot be in the future.');

        if (requestId && await SerialTransfer.exists({ requestId })) {
            return res.json(await loadSerial(assetId));
        }

        const asset = await loadTransferSerial(assetId);
        if (asset.status === 'SCRAPPED') {
            throw httpError(400, `${asset.serialNumber} is scrapped. Its customer history is kept, but a scrapped serial number cannot be assigned or transferred to a customer.`);
        }
        const sells = req.body.sale === true && asset.status !== 'SOLD';
        if (sells && !SELLABLE_STATUSES.includes(statusOf(asset))) {
            throw httpError(400, `${asset.serialNumber} is ${statusOf(asset)}. Only an allocated or in-stock serial number can be sold by a transfer; use Assign, or re-sell a returned serial with Add Single Entry in Invoice Bulk Upload.`);
        }
        const customer = await Customer.findById(customerId).select(CUSTOMER_SELECT).lean();
        if (!customer) throw httpError(404, 'Customer not found in Customer Master.');
        const user = { createdBy: req.user?.id || null, createdByName: req.user?.name || '' };

        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            const records = await savedHistory(asset, user, session);
            let current = records.find((record) => record.isActive) || null;
            // A returned serial: the return ends the current record and is saved before the new customer.
            let returned = null;
            const returning = unrecordedReturn(asset, records);
            if (returning) {
                const date = returnDateOf(asset, returning, transferDate);
                await SerialTransfer.updateOne({ _id: returning._id }, { $set: { isActive: false, endedAt: date } }, { session });
                const [saved] = await SerialTransfer.create([{ ...returnRecord(asset, returning, date), ...user }], { session });
                returned = saved.toObject();
                current = null;
            }
            const previous = current || returned;
            if (current?.customerId && String(current.customerId) === String(customer._id)) {
                throw httpError(400, `${customerLabel(customer)} is already the current customer of ${asset.serialNumber}.`);
            }
            if (previous && transferDate < startOfDay(previous.transferDate)) {
                const holder = previous.companyName || previous.customerName || 'previous customer';
                throw httpError(400, returned
                    ? `Transfer date cannot be before ${formatDate(previous.transferDate)}, when ${holder} returned it.`
                    : `Transfer date cannot be before ${formatDate(previous.transferDate)}, when the current customer (${holder}) received it.`);
            }

            if (current) {
                await SerialTransfer.updateOne({ _id: current._id }, { $set: { isActive: false, endedAt: transferDate } }, { session });
            }
            // The invoice flows to the new customer: the previous record's, else the serial's own.
            const invoice = withInvoice(previous || { entryType: 'Sold' }, asset);
            const snapshot = customerSnapshot(customer);
            await SerialTransfer.create([{
                assetId: asset._id,
                serialNumber: asset.serialNumber,
                serialKey: toKey(asset.serialNumber),
                productId: asset.productId?._id || asset.productId || null,
                productCode: asset.productCode || '',
                productName: asset.productName || '',
                ...snapshot,
                previousCustomerId: previous?.customerId || null,
                previousCustomerCode: previous?.customerCode || '',
                previousCustomerName: previous?.companyName || previous?.customerName || '',
                entryType: changeType(asset, sells),
                transferDate,
                isActive: true,
                invoiceNumber: invoice.invoiceNumber || '',
                invoiceDate: invoice.invoiceDate || null,
                remarks: cleanText(req.body.remarks),
                requestId,
                ...user,
                branchId: asset.branchId || previous?.branchId || null
            }], { session });

            await Asset.updateOne({ _id: asset._id }, {
                $set: {
                    customerId: customer._id,
                    customerCode: snapshot.customerCode,
                    customerNameStr: snapshot.companyName,
                    customerMobile: snapshot.customerMobile,
                    customerPostalCode: snapshot.customerPincode,
                    // Sold by this transfer; a serial with no invoice date was sold on the transfer date.
                    ...(sells ? { status: 'SOLD', ...(invoiceDateOf(asset) ? {} : { saleDate: transferDate }) } : {})
                }
            }, { session });
        });

        return res.status(201).json(await loadSerial(asset._id));
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.code === 11000) {
            // Same request sent twice: the first one saved it.
            if (requestId && await SerialTransfer.exists({ requestId })) return res.json(await loadSerial(assetId));
            return res.status(409).json({ message: 'This serial number was just changed by someone else. Reload the page and try again.' });
        }
        console.error('Serial transfer failed:', error);
        return res.status(500).json({ message: `Failed to transfer the serial number: ${error.message}` });
    } finally {
        if (session) await session.endSession();
    }
};

/**
 * Records an earlier customer of a serial number (Add Past Entry). The record is inactive and
 * dated on or before the current customer's date; the current customer and the asset are not
 * changed. The invoice row's customer is saved as the first record if the serial has no history
 * yet. Allowed for every status, scrapped included: it adds history, not a current customer.
 */
exports.addPastEntry = async (req, res) => {
    const { assetId } = req.params;
    const requestId = cleanText(req.body.requestId).slice(0, 100) || undefined;
    let session;
    try {
        if (!mongoose.Types.ObjectId.isValid(assetId)) throw httpError(400, 'Invalid serial record');
        if (!mongoose.Types.ObjectId.isValid(req.body.customerId)) throw httpError(400, 'Select the customer.');
        if (!req.body.entryDate) throw httpError(400, 'Enter the date of the past entry.');
        const entryDate = transferMoment(req.body.entryDate);
        if (!entryDate) throw httpError(400, 'Date is not a valid date.');
        if (startOfDay(entryDate) > startOfDay(new Date())) throw httpError(400, 'A past entry cannot be dated in the future.');

        if (requestId && await SerialTransfer.exists({ requestId })) {
            return res.json(await loadSerial(assetId));
        }

        const asset = await loadTransferSerial(assetId);
        const customer = await Customer.findById(req.body.customerId).select(CUSTOMER_SELECT).lean();
        if (!customer) throw httpError(404, 'Customer not found in Customer Master.');
        const user = { createdBy: req.user?.id || null, createdByName: req.user?.name || '' };

        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            const current = (await savedHistory(asset, user, session)).find((record) => record.isActive);
            if (current && startOfDay(entryDate) > startOfDay(current.transferDate)) {
                throw httpError(400, `A past entry must be dated on or before ${formatDate(current.transferDate)}, when the current customer (${current.companyName || current.customerName || 'current customer'}) received it. Use Transfer Serial No for a newer customer.`);
            }
            await SerialTransfer.create([{
                assetId: asset._id,
                serialNumber: asset.serialNumber,
                serialKey: toKey(asset.serialNumber),
                productId: asset.productId?._id || asset.productId || null,
                productCode: asset.productCode || '',
                productName: asset.productName || '',
                ...customerSnapshot(customer),
                entryType: 'Past Entry',
                transferDate: entryDate,
                isActive: false,
                remarks: cleanText(req.body.remarks),
                requestId,
                ...user,
                branchId: asset.branchId || current?.branchId || null
            }], { session });
        });

        return res.status(201).json(await loadSerial(asset._id));
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.code === 11000 && requestId && await SerialTransfer.exists({ requestId })) {
            return res.json(await loadSerial(assetId));
        }
        console.error('Serial past entry failed:', error);
        return res.status(500).json({ message: `Failed to save the past entry: ${error.message}` });
    } finally {
        if (session) await session.endSession();
    }
};

/** Transfer History: every saved record, newest first, with search and Active/Inactive filter. */
exports.listHistory = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const query = activeBranchFilter() || {};
        const search = cleanText(req.query.search);
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { serialNumber: pattern }, { productCode: pattern }, { productName: pattern },
                { companyName: pattern }, { customerName: pattern }, { customerCode: pattern }
            ];
        }
        if (req.query.flag === 'Active') query.isActive = true;
        if (req.query.flag === 'Inactive') query.isActive = false;
        if (ENTRY_TYPES.includes(req.query.entryType)) query.entryType = req.query.entryType;
        const range = dateRange(req.query);
        if (range) query.transferDate = range;
        const products = await mgrProductFilter(req.query);
        if (products) query.productId = products;

        const [records, total] = await Promise.all([
            SerialTransfer.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
            SerialTransfer.countDocuments(query)
        ]);
        const assets = records.length
            ? await Asset.find({ _id: { $in: [...new Set(records.map((r) => String(r.assetId)))] } })
                .select('invoiceNumber invoiceDate saleDate').lean()
            : [];
        const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));
        const data = records.map((record) => withInvoice(record, assetById.get(String(record.assetId))));
        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load the transfer history');
    }
};

/*
 * Customer Activity Log: one row per customer ownership of a serial number.
 *
 * Active: the current owner of every sold serial, and of every serial of another status that has
 * been transferred to a customer. A transferred serial's owner is its active history record; a
 * sold serial never transferred has no history record yet, so its owner is read from the Invoice
 * Bulk Upload row (nothing is written for it). Inactive: every history record that is
 * no longer current (owners before a transfer, and Past Entries). Each row is exactly one history
 * record or one asset, so the product/customer lookups below never multiply rows.
 *
 * "Active"/"Inactive" here is the ownership flag of the history, not the customer's status in
 * Customer Master. The date filter is the date the customer received the serial.
 */
const OWNERSHIPS = ['Active', 'Inactive'];

const activeOwners = async ({ search, range, assetId, products, skip, limit }) => {
    // Serials with an active history record have a current owner whatever their status.
    const owned = await SerialTransfer.find({ isActive: true }).select('assetId').lean();
    const match = { $and: [{ $or: [{ status: 'SOLD' }, { _id: { $in: owned.map((record) => record.assetId) } }] }] };
    const branchFilter = activeBranchFilter();
    if (branchFilter) Object.assign(match, branchFilter);
    // Aggregation does not cast, so the ids must already be ObjectIds (distinct returns ObjectIds).
    if (assetId) match._id = new mongoose.Types.ObjectId(String(assetId));
    if (products) match.productId = products;
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        match.$and.push({
            $or: [
                { serialNumber: pattern }, { productCode: pattern }, { productName: pattern },
                { customerNameStr: pattern }, { customerCode: pattern }
            ]
        });
    }
    const page = [{ $sort: { ownerSince: -1, _id: -1 } }];
    if (skip) page.push({ $skip: skip });
    if (limit) page.push({ $limit: limit });

    const [result] = await Asset.aggregate([
        { $match: match },
        {
            $lookup: {
                from: SerialTransfer.collection.name,
                let: { assetId: '$_id', companyId: '$companyId' },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ['$companyId', '$$companyId'] }, { $eq: ['$assetId', '$$assetId'] }] }, isActive: true } },
                    { $limit: 1 }
                ],
                as: 'current'
            }
        },
        { $addFields: { current: { $arrayElemAt: ['$current', 0] } } },
        { $addFields: { ownerSince: { $ifNull: ['$current.transferDate', { $ifNull: ['$saleDate', { $ifNull: ['$invoiceDate', '$createdAt'] }] }] } } },
        ...(range ? [{ $match: { ownerSince: range } }] : []),
        { $facet: { rows: page, total: [{ $count: 'count' }] } }
    ]);

    const rows = (result?.rows || []).map((asset) => {
        const current = asset.current;
        return {
            _id: current?._id || asset._id,
            assetId: asset._id,
            ownership: 'Active',
            entryType: current?.entryType || 'Sold',
            serialNumber: asset.serialNumber,
            productId: current?.productId || asset.productId,
            productCode: current?.productCode || asset.productCode,
            productName: current?.productName || asset.productName,
            customerId: current ? current.customerId : asset.customerId,
            customerCode: current ? current.customerCode : asset.customerCode,
            customerName: current ? (current.companyName || current.customerName) : asset.customerNameStr,
            customerPincode: current ? current.customerPincode : asset.customerPostalCode,
            indicatorField: asset.indicatorField || '',
            invoiceNumber: asset.invoiceNumber || current?.invoiceNumber || '',
            invoiceDate: asset.invoiceDate || asset.saleDate || null,
            ownerSince: asset.ownerSince,
            ownerUntil: null
        };
    });
    return { rows, total: result?.total?.[0]?.count || 0 };
};

const inactiveOwners = async ({ search, range, assetId, products, skip, limit }) => {
    const query = { isActive: false };
    const branchFilter = activeBranchFilter();
    if (branchFilter) Object.assign(query, branchFilter);
    if (assetId) query.assetId = assetId;
    if (products) query.productId = products;
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        query.$or = [
            { serialNumber: pattern }, { productCode: pattern }, { productName: pattern },
            { companyName: pattern }, { customerName: pattern }, { customerCode: pattern }
        ];
    }
    if (range) query.transferDate = range;

    let find = SerialTransfer.find(query).sort({ transferDate: -1, _id: -1 });
    if (skip) find = find.skip(skip);
    if (limit) find = find.limit(limit);
    const [records, total] = await Promise.all([find.lean(), SerialTransfer.countDocuments(query)]);

    const assets = records.length
        ? await Asset.find({ _id: { $in: [...new Set(records.map((r) => String(r.assetId)))] } })
            .select('invoiceNumber invoiceDate saleDate indicatorField').lean()
        : [];
    const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));

    const rows = records.map((record) => {
        const asset = assetById.get(String(record.assetId));
        return {
            _id: record._id,
            assetId: record.assetId,
            ownership: 'Inactive',
            entryType: record.entryType,
            serialNumber: record.serialNumber,
            productId: record.productId,
            productCode: record.productCode,
            productName: record.productName,
            customerId: record.customerId,
            customerCode: record.customerCode,
            customerName: record.companyName || record.customerName,
            customerPincode: record.customerPincode,
            invoiceNumber: asset?.invoiceNumber || record.invoiceNumber || '',
            invoiceDate: asset?.invoiceDate || asset?.saleDate || null,
            indicatorField: asset?.indicatorField || '',
            ownerSince: record.transferDate,
            ownerUntil: record.endedAt
        };
    });
    return { rows, total };
};

// Adds MGR 1-5 (from Product Master) and customer email and fallback code/pincode (from
// Customer Master) to activity rows.
const withMasterData = async (rows) => {
    const idsOf = (key) => [...new Set(rows.map((row) => row[key]).filter(Boolean).map(String))];
    const [products, customers] = await Promise.all([
        Product.find({ _id: { $in: idsOf('productId') } })
            .select(['productName productCode', ...MGR_KEYS].join(' '))
            .populate(MGR_KEYS.map((key) => ({ path: key, select: 'code description', options: { bypassTenant: true } })))
            .setOptions({ bypassTenant: true })
            .lean(),
        Customer.find({ _id: { $in: idsOf('customerId') } })
            .select('customerName companyName externalCode email billingAddress')
            .setOptions({ bypassTenant: true })
            .lean()
    ]);
    const productById = new Map(products.map((p) => [String(p._id), p]));
    const customerById = new Map(customers.map((c) => [String(c._id), c]));

    return rows.map((row) => {
        const product = productById.get(String(row.productId));
        const customer = customerById.get(String(row.customerId));
        const mgrs = Object.fromEntries(MGR_KEYS.map((key) => [key, product ? formatMgrVal(product[key]) : '']));
        return {
            ...row,
            productName: cleanText(product?.productName) || cleanText(row.productName),
            productCode: cleanText(product?.productCode) || cleanText(row.productCode),
            ...mgrs,
            customerName: cleanText(row.customerName) || customerLabel(customer),
            customerCode: cleanText(row.customerCode) || cleanText(customer?.externalCode),
            email: cleanText(customer?.email),
            // A current owner shows the Customer Master pincode as it is now; a past owner keeps
            // the one recorded at the time.
            pincode: row.ownership === 'Active'
                ? cleanText(customer?.billingAddress?.pincode) || cleanText(row.customerPincode)
                : cleanText(row.customerPincode) || cleanText(customer?.billingAddress?.pincode)
        };
    });
};

// ?assetId limits the log to one serial number (the serial's details page).
const activitySerial = async (assetId) => {
    if (!assetId) return null;
    if (!mongoose.Types.ObjectId.isValid(assetId)) throw httpError(400, 'Invalid serial record');
    const asset = await Asset.findOne(addActiveBranchFilter({ _id: assetId })).select('serialNumber').lean();
    if (!asset) throw httpError(404, 'Serial number not found');
    return asset;
};

const loadActivity = async (query, paging = {}) => {
    const ownership = OWNERSHIPS.includes(query.ownership) ? query.ownership : 'Active';
    const serial = await activitySerial(query.assetId);
    const options = {
        search: cleanText(query.search),
        range: dateRange(query),
        assetId: serial?._id,
        products: await mgrProductFilter(query),
        ...paging
    };
    const { rows, total } = await (ownership === 'Active' ? activeOwners(options) : inactiveOwners(options));
    return { ownership, serial, rows: await withMasterData(rows), total };
};

/** Customer Activity Log, one page (?ownership=Active|Inactive&assetId&search&fromDate&toDate). */
exports.listActivity = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const { rows, total } = await loadActivity(req.query, { skip, limit });
        return res.json({ data: rows, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load the customer activity log');
    }
};

// A date as the calendar day it is in India (used for the export's file name).
const excelDay = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;
    const local = new Date(time + BUSINESS_UTC_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
};

const ACTIVITY_COLUMNS = [
    { header: 'Product Name', key: 'productName', width: 40 },
    { header: 'Product Code', key: 'productCode', width: 16, text: true },
    { header: 'Serial Number', key: 'serialNumber', width: 18, text: true },
    { header: 'Indicator_Field', key: 'indicatorField', width: 16, text: true },
    { header: 'Product MGR 1', key: 'mgr1', width: 20 },
    { header: 'Product MGR 2', key: 'mgr2', width: 20 },
    { header: 'Product MGR 3', key: 'mgr3', width: 20 },
    { header: 'Product MGR 4', key: 'mgr4', width: 20 },
    { header: 'Product MGR 5', key: 'mgr5', width: 20 },
    { header: 'Customer Name', key: 'customerName', width: 36 },
    { header: 'Customer Code', key: 'customerCode', width: 16, text: true },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Pincode', key: 'pincode', width: 10, text: true },
    { header: 'Invoice Number', key: 'invoiceNumber', width: 20, text: true },
    { header: 'Invoice Date', key: 'invoiceDate', width: 14, date: true }
];

/** Customer Activity Log as .xlsx: every row matching the filters, not just one page. */
exports.exportActivity = async (req, res) => {
    try {
        const { ownership, serial, rows } = await loadActivity(req.query);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`${ownership} Customers`);
        sheet.columns = ACTIVITY_COLUMNS.map(({ header, key, width, text, date }) => ({
            header, key, width,
            // Codes and serial numbers stay text so Excel keeps leading zeros and long digits.
            // Dates are text in the ARCRM format (13.OCT.26); Excel date formats cannot upper-case the month.
            style: text || date ? { numFmt: '@' } : {}
        }));
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        for (const row of rows) {
            sheet.addRow(Object.fromEntries(ACTIVITY_COLUMNS.map(({ key, date }) => [
                key,
                date ? formatDate(row[key], '') : String(row[key] ?? '')
            ])));
        }

        const today = excelDay(new Date()).toISOString().slice(0, 10).replace(/-/g, '');
        const serialPart = serial ? `${String(serial.serialNumber).replace(/[^A-Za-z0-9._-]+/g, '-')}_` : '';
        const fileName = `Customer_Activity_${ownership}_${serialPart}${today}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('X-Total-Count', String(rows.length));
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Total-Count');
        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        return sendError(res, error, 'Failed to export the customer activity log');
    }
};

/*
 * Branch Transfer: moves serial numbers from one branch to another.
 *
 * The serial's Asset record takes the destination branch, so Invoice Bulk Upload and the Serial
 * No List show it there from then on; its status, customer and invoice data are not touched. Its
 * customer history (SerialTransfer) and Invoice Bulk Upload history (AssetHistory) move with it,
 * since a serial's records belong to the branch that holds it. Every serial moved gets a
 * SerialBranchTransfer record keeping both branches, which together form its branch history.
 *
 * These routes run across branches (acrossBranches in the routes); utils/serialBranchAccess.js
 * decides which branches a user may move serials out of and which transfers they see.
 */
const MAX_SERIALS_PER_BRANCH_TRANSFER = 200;

const loadBranch = async (req, branchId, label) => {
    if (!mongoose.Types.ObjectId.isValid(branchId)) throw httpError(400, `Select the ${label}.`);
    const branch = await Branch.findOne({ _id: branchId, companyId: req.user.companyId }).select('name code status').lean();
    if (!branch) throw httpError(404, `The ${label} was not found.`);
    return branch;
};

const assertCanMoveFrom = (req, branch) => {
    if (!canMoveFrom(req, branch._id)) throw httpError(403, `You cannot move serial numbers out of ${branchLabel(branch)}.`);
};

const serialList = (assets) => {
    const names = assets.slice(0, 5).map((asset) => asset.serialNumber).join(', ');
    return assets.length > 5 ? `${names} and ${assets.length - 5} more` : names;
};

// The Indian financial year (April to March) a date falls in, as its first calendar year.
const financialYearOf = (date) => {
    const local = new Date(date.getTime() + BUSINESS_UTC_OFFSET_MS);
    return local.getUTCMonth() >= 3 ? local.getUTCFullYear() : local.getUTCFullYear() - 1;
};

// BT/2026-27/0001: one number per branch transfer, counted per financial year. Taken inside the
// transfer's transaction, so a transfer that fails does not use up a number.
const nextBranchTransferNo = async (companyId, date, session) => {
    const year = financialYearOf(date);
    const counter = await Counter.findOneAndUpdate(
        { companyId, type: 'serial_branch_transfer', prefix: 'BT', year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    return `BT/${year}-${String(year + 1).slice(-2)}/${String(counter.seq).padStart(4, '0')}`;
};

// A saved branch transfer (all serials of one transferNo or requestId), or null.
const branchTransferResult = async (filter) => {
    const records = await SerialBranchTransfer.find(filter).sort({ serialKey: 1 }).lean();
    if (!records.length) return null;
    const [first] = records;
    return {
        transferNo: first.transferNo,
        transferDate: first.transferDate,
        fromBranchId: first.fromBranchId,
        fromBranchName: first.fromBranchName,
        toBranchId: first.toBranchId,
        toBranchName: first.toBranchName,
        reference: first.reference,
        remarks: first.remarks,
        createdByName: first.createdByName,
        serials: records.map((record) => ({
            assetId: record.assetId,
            serialNumber: record.serialNumber,
            productCode: record.productCode,
            productName: record.productName,
            status: record.status
        }))
    };
};

/** Branches for the Branch Transfer form and filters; `canMoveFrom` marks the possible source branches. */
exports.listTransferBranches = async (req, res) => {
    try {
        const branches = await Branch.find({ companyId: req.user.companyId }).select('name code status').sort({ name: 1 }).lean();
        return res.json({
            branches: branches.map((branch) => ({
                _id: branch._id,
                name: branchLabel(branch),
                code: branch.code || '',
                active: branch.status !== 'Inactive',
                canMoveFrom: canMoveFrom(req, branch._id)
            })),
            activeBranchId: req.user.activeBranchId || null,
            branchLevel: Boolean(limitedBranchIds(req))
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load branches');
    }
};

/** Serial numbers of the source branch for the Branch Transfer form (?fromBranchId&search&status). */
exports.searchBranchSerials = async (req, res) => {
    try {
        const branch = await loadBranch(req, cleanText(req.query.fromBranchId), 'source branch');
        assertCanMoveFrom(req, branch);
        const query = { companyId: req.user.companyId, branchId: branch._id };
        const status = assetStatusCondition(req.query.status);
        if (status) query.status = status;
        const search = cleanText(req.query.search);
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            query.$or = [{ serialNumber: pattern }, { productCode: pattern }, { productName: pattern }, { invoiceNumber: pattern }, { customerNameStr: pattern }];
        }
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const [assets, total] = await Promise.all([
            Asset.find(query)
                .select('serialNumber productCode productName status customerNameStr invoiceNumber')
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit)
                .lean(),
            Asset.countDocuments(query)
        ]);
        return res.json({
            data: assets.map((asset) => ({
                _id: asset._id,
                serialNumber: asset.serialNumber,
                productCode: asset.productCode,
                productName: asset.productName,
                status: statusOf(asset),
                customerName: asset.customerNameStr || '',
                invoiceNumber: asset.invoiceNumber || '',
                branchId: branch._id,
                branchName: branchLabel(branch)
            })),
            total
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load serial numbers');
    }
};

/**
 * Moves the selected serials (body.assetIds) from fromBranchId to toBranchId. Everything is
 * checked first and then saved in one transaction, so either every serial moves or none does.
 * A serial moves only if it is still in the source branch at that moment, so two people moving
 * the same serial at once cannot both succeed. The form sends a requestId with each save;
 * repeating a request returns the transfer it already saved instead of moving anything again.
 */
exports.createBranchTransfer = async (req, res) => {
    const requestId = cleanText(req.body.requestId).slice(0, 100) || undefined;
    let session;
    try {
        const assetIds = Array.isArray(req.body.assetIds) ? req.body.assetIds.map((id) => String(id)) : [];
        if (!assetIds.length) throw httpError(400, 'Select at least one serial number.');
        if (assetIds.length > MAX_SERIALS_PER_BRANCH_TRANSFER) {
            throw httpError(400, `A branch transfer can move up to ${MAX_SERIALS_PER_BRANCH_TRANSFER} serial numbers at a time.`);
        }
        if (!assetIds.every((id) => mongoose.Types.ObjectId.isValid(id))) throw httpError(400, 'Invalid serial record.');
        if (new Set(assetIds).size !== assetIds.length) throw httpError(400, 'A serial number is selected more than once.');

        if (requestId) {
            const saved = await branchTransferResult({ requestId });
            if (saved) return res.json(saved);
        }

        const [from, to] = await Promise.all([
            loadBranch(req, req.body.fromBranchId, 'source branch'),
            loadBranch(req, req.body.toBranchId, 'destination branch')
        ]);
        if (String(from._id) === String(to._id)) throw httpError(400, 'Source and destination branches must be different.');
        assertCanMoveFrom(req, from);
        if (to.status === 'Inactive') throw httpError(400, `${branchLabel(to)} is inactive. Serial numbers cannot be moved into it.`);

        const companyId = req.user.companyId;
        const assets = await Asset.find({ _id: { $in: assetIds }, companyId })
            .select('serialNumber productId productCode productName status branchId')
            .lean();
        if (assets.length !== assetIds.length) {
            throw httpError(404, 'Some of the selected serial numbers no longer exist. Reload and select them again.');
        }
        const elsewhere = assets.filter((asset) => String(asset.branchId || '') !== String(from._id));
        if (elsewhere.length) {
            throw httpError(400, `${serialList(elsewhere)} ${elsewhere.length === 1 ? 'is' : 'are'} not in ${branchLabel(from)}. Only serial numbers of the source branch can be transferred.`);
        }

        const transferDate = new Date();
        const reference = cleanText(req.body.reference).slice(0, 100);
        const remarks = cleanText(req.body.remarks).slice(0, 500);
        let transferNo;
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            transferNo = await nextBranchTransferNo(companyId, transferDate, session);
            const moved = await Asset.updateMany(
                { _id: { $in: assetIds }, companyId, branchId: from._id },
                { $set: { branchId: to._id } },
                { session }
            );
            if (moved.matchedCount !== assetIds.length) {
                throw httpError(409, 'Some of these serial numbers were just moved by someone else. Reload and try again.');
            }
            await SerialTransfer.updateMany({ assetId: { $in: assetIds } }, { $set: { branchId: to._id } }, { session });
            await AssetHistory.updateMany({ assetId: { $in: assetIds } }, { $set: { branchId: to._id } }, { session });
            await SerialBranchTransfer.insertMany(assets.map((asset) => ({
                transferNo,
                assetId: asset._id,
                serialNumber: asset.serialNumber,
                serialKey: toKey(asset.serialNumber),
                productId: asset.productId || null,
                productCode: asset.productCode || '',
                productName: asset.productName || '',
                status: statusOf(asset),
                fromBranchId: from._id,
                fromBranchName: branchLabel(from),
                toBranchId: to._id,
                toBranchName: branchLabel(to),
                transferDate,
                reference,
                remarks,
                createdBy: req.user?.id || null,
                createdByName: req.user?.name || '',
                requestId
            })), { session });
        });

        return res.status(201).json(await branchTransferResult({ transferNo }));
    } catch (error) {
        if (requestId && (error.status === 409 || error.code === 11000)) {
            // The same request sent twice at once: the first one saved it.
            const saved = await branchTransferResult({ requestId });
            if (saved) return res.json(saved);
        }
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.code === 11000) {
            return res.status(409).json({ message: 'These serial numbers were just changed by someone else. Reload and try again.' });
        }
        console.error('Serial branch transfer failed:', error);
        return res.status(500).json({ message: `Failed to transfer the serial numbers: ${error.message}` });
    } finally {
        if (session) await session.endSession();
    }
};

const assetLookup = [
    {
        $lookup: {
            from: Asset.collection.name,
            localField: 'assetId',
            foreignField: '_id',
            pipeline: [{ $project: { status: 1, branchId: 1 } }],
            as: 'asset'
        }
    },
    { $addFields: { asset: { $arrayElemAt: ['$asset', 0] } } }
];

/**
 * Branch Transfer tab: every serial moved, newest first, with where it is and its status now
 * (?search&fromBranchId&toBranchId&status&fromDate&toDate; status is the serial's current status).
 */
exports.listBranchTransfers = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const and = [{ companyId: new mongoose.Types.ObjectId(String(req.user.companyId)) }];
        const visible = visibleTransfersCondition(req);
        if (visible) and.push(visible);
        for (const key of ['fromBranchId', 'toBranchId']) {
            const value = cleanText(req.query[key]);
            if (!value) continue;
            if (!mongoose.Types.ObjectId.isValid(value)) throw httpError(400, 'Invalid branch filter.');
            and.push({ [key]: new mongoose.Types.ObjectId(value) });
        }
        const search = cleanText(req.query.search);
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            and.push({
                $or: [
                    { serialNumber: pattern }, { productCode: pattern }, { productName: pattern }, { transferNo: pattern },
                    { reference: pattern }, { remarks: pattern }, { createdByName: pattern }
                ]
            });
        }
        const range = dateRange(req.query);
        if (range) and.push({ transferDate: range });
        const status = assetStatusCondition(req.query.status);

        const pageStages = [{ $sort: { transferDate: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
        // The current status lives on the Asset; look it up for every match only when filtering by it.
        const [result] = await SerialBranchTransfer.aggregate(status
            ? [{ $match: { $and: and } }, ...assetLookup, { $match: { 'asset.status': status } }, { $facet: { rows: pageStages, total: [{ $count: 'count' }] } }]
            : [{ $match: { $and: and } }, { $facet: { rows: [...pageStages, ...assetLookup], total: [{ $count: 'count' }] } }]);

        const rows = result?.rows || [];
        const branchIds = [...new Set(rows.map((row) => row.asset?.branchId).filter(Boolean).map(String))];
        const branches = branchIds.length
            ? await Branch.find({ _id: { $in: branchIds }, companyId: req.user.companyId }).select('name code').lean()
            : [];
        const branchName = new Map(branches.map((branch) => [String(branch._id), branchLabel(branch)]));

        const data = rows.map(({ asset, requestId: _requestId, serialKey: _serialKey, status: statusAtTransfer, ...row }) => ({
            ...row,
            statusAtTransfer,
            status: asset ? statusOf(asset) : statusAtTransfer,
            currentBranchId: asset?.branchId || null,
            currentBranchName: asset?.branchId ? branchName.get(String(asset.branchId)) || '' : ''
        }));
        const total = result?.total?.[0]?.count || 0;
        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load branch transfers');
    }
};

/** One serial's complete branch history, oldest first, and where it is now (the transfer details view). */
exports.getSerialBranchHistory = async (req, res) => {
    try {
        const { assetId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(assetId)) throw httpError(400, 'Invalid serial record');
        const asset = await Asset.findOne({ _id: assetId, companyId: req.user.companyId })
            .select('serialNumber productCode productName status branchId customerNameStr invoiceNumber')
            .populate(branchPopulate)
            .lean();
        if (!asset) throw httpError(404, 'Serial number not found');

        const transfers = await SerialBranchTransfer.find({ assetId: asset._id }).sort({ transferDate: 1, _id: 1 }).lean();
        // Under branch-level access the serial must be in, or have passed through, one of the user's branches.
        const limited = limitedBranchIds(req);
        const branchesSeen = [idOf(asset.branchId), ...transfers.flatMap((t) => [t.fromBranchId, t.toBranchId])].filter(Boolean).map(String);
        if (limited && !branchesSeen.some((id) => limited.includes(id))) throw httpError(404, 'Serial number not found');

        return res.json({
            asset: {
                _id: asset._id,
                serialNumber: asset.serialNumber,
                productCode: asset.productCode,
                productName: asset.productName,
                status: statusOf(asset),
                branchId: idOf(asset.branchId),
                branchName: branchLabel(asset.branchId),
                customerName: asset.customerNameStr || '',
                invoiceNumber: asset.invoiceNumber || ''
            },
            transfers: transfers.map(({ requestId: _requestId, serialKey: _serialKey, ...transfer }) => transfer)
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load the branch history');
    }
};
