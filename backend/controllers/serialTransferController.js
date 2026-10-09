const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Customer = require('../models/Customer');
const SerialTransfer = require('../models/SerialTransfer');

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

/** Serial No List: every sold serial with its current customer. */
exports.listSerials = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const query = { status: 'SOLD' };

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
            query.$or = byField[req.query.field] || [...byField.serial, ...byField.product, ...byField.customer];
        }

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
                status: transfers ? 'Transferred' : 'Sold'
            };
        });

        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load serial numbers', error: error.message });
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

const httpError = (status, message) => Object.assign(new Error(message), { status });

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
                throw httpError(400, `Transfer date cannot be before ${new Date(current.transferDate).toLocaleDateString('en-IN')}, when the current customer (${current.companyName || current.customerName || 'previous customer'}) received it.`);
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
        if (req.query.entryType === 'Sold' || req.query.entryType === 'Transferred') query.entryType = req.query.entryType;

        const [data, total] = await Promise.all([
            SerialTransfer.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
            SerialTransfer.countDocuments(query)
        ]);
        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load the transfer history', error: error.message });
    }
};
