const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Asset = require('../models/Asset');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
require('../models/MGR'); // populated through Product mgr1..mgr5
const SerialTransfer = require('../models/SerialTransfer');
const { MGR_KEYS, formatMgrVal } = require('../utils/productMgr');
const { formatDate } = require('../utils/dateFormat');

/**
 * Serial No Transfer: the customer-wise ownership history of sold serial numbers.
 *
 * The serials are the SOLD records of Invoice Bulk Upload (Asset). The first customer is the
 * one the serial was sold to; that "Sold" record is written the first time the serial is
 * transferred, from the invoice data. Each transfer switches the current record off and adds
 * a new active one, so history is never overwritten and only the latest customer is active.
 * The Asset's customer is moved to the new customer as well, so complaints, AMC and the
 * Invoice Bulk Upload list show the current holder.
 */

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const toKey = (value) => cleanText(value).toUpperCase();
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const httpError = (status, message) => Object.assign(new Error(message), { status });

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

// The sale date shown in the Serial No List: saleDate, else invoiceDate, else createdAt (see saleDateOf).
const saleDateCondition = (range) => ({
    $or: [
        { saleDate: range },
        { saleDate: null, invoiceDate: range },
        { saleDate: null, invoiceDate: null, createdAt: range }
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

// The original sale, as a history record built from the Invoice Bulk Upload row.
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
    entryType: 'Sold',
    transferDate: saleDateOf(asset),
    invoiceNumber: asset.invoiceNumber || '',
    isActive: true,
    branchId: asset.branchId || null
});

const historyOf = (assetId) => SerialTransfer.find({ assetId })
    .sort({ transferDate: 1, createdAt: 1 })
    .lean();

const statusFilter = async (status) => {
    if (status !== 'Transferred' && status !== 'Sold') return null;
    const rows = await SerialTransfer.aggregate([
        { $match: { entryType: 'Transferred' } },
        { $group: { _id: '$assetId' } }
    ]);
    const ids = rows.map((row) => row._id);
    return status === 'Transferred' ? { $in: ids } : { $nin: ids };
};

/**
 * Serial No List: every sold serial with its current customer. The current customer is the
 * serial's Active owner, so every row is Active; `transferred` says whether it has changed hands
 * since the sale. The asset's own status stays SOLD, which is its inventory/invoice status.
 */
exports.listSerials = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const query = { status: 'SOLD' };
        const and = [];

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

        const assetFilter = await statusFilter(req.query.status);
        if (assetFilter) query._id = assetFilter;

        const [assets, total] = await Promise.all([
            Asset.find(query)
                .select('serialNumber productId productCode productName customerId customerCode customerNameStr saleDate invoiceDate invoiceNumber createdAt')
                .populate(customerPopulate)
                .sort({ saleDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Asset.countDocuments(query)
        ]);

        const counts = assets.length
            ? await SerialTransfer.aggregate([
                { $match: { assetId: { $in: assets.map((asset) => asset._id) } } },
                {
                    $group: {
                        _id: '$assetId',
                        transfers: { $sum: { $cond: [{ $eq: ['$entryType', 'Transferred'] }, 1, 0] } },
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
                saleDate: saleDateOf(asset),
                invoiceNumber: asset.invoiceNumber,
                transfers,
                lastTransferDate: transfers ? transfer.lastTransferDate : null,
                transferred: transfers > 0,
                status: 'Active'
            };
        });

        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load serial numbers');
    }
};

const loadSerial = async (assetId) => {
    const asset = await Asset.findOne({ _id: assetId, status: 'SOLD' }).populate(customerPopulate).lean();
    if (!asset) return null;

    let history = await historyOf(asset._id);
    // Not transferred yet: the sale is shown from the invoice row until the first transfer saves it.
    if (!history.length) history = [{ ...saleRecord(asset), _id: null, pending: true }];

    return {
        asset: {
            _id: asset._id,
            serialNumber: asset.serialNumber,
            productCode: asset.productCode,
            productName: asset.productName,
            invoiceNumber: asset.invoiceNumber,
            saleDate: saleDateOf(asset),
            customerId: asset.customerId?._id || null,
            customerCode: cleanText(asset.customerId?.externalCode) || asset.customerCode,
            customerName: customerLabel(asset.customerId, asset.customerNameStr)
        },
        history
    };
};

/** One serial number with its complete customer history, oldest first. */
exports.getSerial = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.assetId)) {
            return res.status(400).json({ message: 'Invalid serial record' });
        }
        const result = await loadSerial(req.params.assetId);
        if (!result) return res.status(404).json({ message: 'Sold serial number not found' });
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
 * Assigns a serial number to another customer. In one transaction: the original sale is saved
 * as the first record if this is the first change, the current record becomes inactive, a new
 * active record is added for the new customer and the asset moves to that customer. Either all
 * of it is saved or none of it. Nothing earlier is changed or removed.
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

        const asset = await Asset.findOne({ _id: assetId, status: 'SOLD' }).populate(customerPopulate).lean();
        if (!asset) throw httpError(404, 'Sold serial number not found');
        const customer = await Customer.findById(customerId).select(CUSTOMER_SELECT).lean();
        if (!customer) throw httpError(404, 'Customer not found in Customer Master.');
        const user = { createdBy: req.user?.id || null, createdByName: req.user?.name || '' };

        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            let current = await SerialTransfer.findOne({ assetId: asset._id, isActive: true }).session(session).lean();
            if (!current && !(await SerialTransfer.exists({ assetId: asset._id }).session(session))) {
                // The original sale becomes the first record of the history.
                [current] = await SerialTransfer.create([{ ...saleRecord(asset), ...user }], { session });
            }
            if (current?.customerId && String(current.customerId) === String(customer._id)) {
                throw httpError(400, `${customerLabel(customer)} is already the current customer of ${asset.serialNumber}.`);
            }
            if (current && transferDate < startOfDay(current.transferDate)) {
                throw httpError(400, `Transfer date cannot be before ${formatDate(current.transferDate)}, when the current customer (${current.companyName || current.customerName || 'previous customer'}) received it.`);
            }

            if (current) {
                await SerialTransfer.updateOne({ _id: current._id }, { $set: { isActive: false, endedAt: transferDate } }, { session });
            }
            const snapshot = customerSnapshot(customer);
            await SerialTransfer.create([{
                assetId: asset._id,
                serialNumber: asset.serialNumber,
                serialKey: toKey(asset.serialNumber),
                productId: asset.productId?._id || asset.productId || null,
                productCode: asset.productCode || '',
                productName: asset.productName || '',
                ...snapshot,
                previousCustomerId: current?.customerId || null,
                previousCustomerCode: current?.customerCode || '',
                previousCustomerName: current?.companyName || current?.customerName || '',
                entryType: 'Transferred',
                transferDate,
                isActive: true,
                remarks: cleanText(req.body.remarks),
                requestId,
                ...user,
                branchId: asset.branchId || current?.branchId || null
            }], { session });

            await Asset.updateOne({ _id: asset._id }, {
                $set: {
                    customerId: customer._id,
                    customerCode: snapshot.customerCode,
                    customerNameStr: snapshot.companyName,
                    customerMobile: snapshot.customerMobile,
                    customerPostalCode: snapshot.customerPincode
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
 * changed. The original sale is saved as a record first if the serial has no history yet.
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

        const asset = await Asset.findOne({ _id: assetId, status: 'SOLD' }).populate(customerPopulate).lean();
        if (!asset) throw httpError(404, 'Sold serial number not found');
        const customer = await Customer.findById(req.body.customerId).select(CUSTOMER_SELECT).lean();
        if (!customer) throw httpError(404, 'Customer not found in Customer Master.');
        const user = { createdBy: req.user?.id || null, createdByName: req.user?.name || '' };

        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            let current = await SerialTransfer.findOne({ assetId: asset._id, isActive: true }).session(session).lean();
            if (!current && !(await SerialTransfer.exists({ assetId: asset._id }).session(session))) {
                [current] = await SerialTransfer.create([{ ...saleRecord(asset), ...user }], { session });
            }
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
        const query = {};
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
        if (['Sold', 'Transferred', 'Past Entry'].includes(req.query.entryType)) query.entryType = req.query.entryType;
        const range = dateRange(req.query);
        if (range) query.transferDate = range;
        const products = await mgrProductFilter(req.query);
        if (products) query.productId = products;

        const [data, total] = await Promise.all([
            SerialTransfer.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
            SerialTransfer.countDocuments(query)
        ]);
        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load the transfer history');
    }
};

/*
 * Customer Activity Log: one row per customer ownership of a serial number.
 *
 * Active: the current owner of every sold serial. A transferred serial's owner is its active
 * history record; a serial never transferred has no history record yet, so its owner is read from
 * the Invoice Bulk Upload row (nothing is written for it). Inactive: every history record that is
 * no longer current (owners before a transfer, and Past Entries). Each row is exactly one history
 * record or one asset, so the product/customer lookups below never multiply rows.
 *
 * "Active"/"Inactive" here is the ownership flag of the history, not the customer's status in
 * Customer Master. The date filter is the date the customer received the serial.
 */
const OWNERSHIPS = ['Active', 'Inactive'];

const activeOwners = async ({ search, range, assetId, products, skip, limit }) => {
    const match = { status: 'SOLD' };
    // Aggregation does not cast, so the ids must already be ObjectIds (distinct returns ObjectIds).
    if (assetId) match._id = new mongoose.Types.ObjectId(String(assetId));
    if (products) match.productId = products;
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        match.$or = [
            { serialNumber: pattern }, { productCode: pattern }, { productName: pattern },
            { customerNameStr: pattern }, { customerCode: pattern }
        ];
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
            pincode: cleanText(row.customerPincode) || cleanText(customer?.billingAddress?.pincode)
        };
    });
};

// ?assetId limits the log to one serial number (the serial's details page).
const activitySerial = async (assetId) => {
    if (!assetId) return null;
    if (!mongoose.Types.ObjectId.isValid(assetId)) throw httpError(400, 'Invalid serial record');
    const asset = await Asset.findOne({ _id: assetId, status: 'SOLD' }).select('serialNumber').lean();
    if (!asset) throw httpError(404, 'Sold serial number not found');
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
