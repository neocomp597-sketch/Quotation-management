const mongoose = require('mongoose');
const Ticket = require('../../../models/Ticket');
const Priority = require('../../../models/Priority');
const TicketCategory = require('../../../models/TicketCategory');
const TicketType = require('../../../models/TicketType');
const Asset = require('../../../models/Asset');
const { getActiveBranchId } = require('../../../middlewares/tenantContext');
const { reserveSequence } = require('../../../utils/importBatch');
const shared = require('./csmShared');

// Support Tickets import (CSM Tickets screen). Column names, lookups and defaults are those of
// the original importer (importController.importTickets). Every row adds a new ticket; a row is
// never matched to an existing ticket.

const TICKET_STATUSES = Ticket.schema.path('status').enumValues;
const TICKET_PREFIX = 'CSM';
const HOUR_MS = 60 * 60 * 1000;

const FIELDS = [
    {
        key: 'ticketNo', label: 'Ticket No',
        aliases: ['Ticket No', 'Ticket Number', 'ticketNo', 'ticketNumber'],
        description: 'Leave blank to number the ticket automatically (CSM-2026-0001...).'
    },
    {
        key: 'customer', label: 'Customer Code', required: true,
        aliases: ['Customer Code', 'Customer Name', 'customerId', 'customer'],
        requiredMessage: 'Customer is missing.',
        requiredHint: 'Fill in the customer code (or the customer name) from Customer Master.',
        description: 'Customer code, customer name or company name from Customer Master.'
    },
    {
        key: 'contactPhone', label: 'Contact Phone', type: 'phone',
        aliases: ['Contact Phone *', 'Contact Phone', 'Mobile Number', 'Mobile No', 'contactPhone', 'mobileNumber', 'mobile'],
        description: '10-digit mobile number. Blank = the mobile of the customer in Customer Master.'
    },
    {
        key: 'contactAlternatePhone', label: 'Alternate Mobile Number', type: 'phone',
        aliases: ['Alternate Mobile Number', 'Alternate Phone', 'contactAlternatePhone', 'alternateMobile']
    },
    {
        key: 'pincode', label: 'Pincode', type: 'pincode',
        aliases: ['Pincode', 'Pin Code', 'PIN Code', 'Postal Code', 'pincode', 'pinCode'],
        description: 'Blank = the pincode of the customer in Customer Master.'
    },
    {
        key: 'product', label: 'Product Code',
        aliases: ['Product Code', 'Product Name', 'productId', 'product'],
        description: 'Needed only for a serial number that is not in Invoice Bulk Upload yet.'
    },
    {
        key: 'serialNumber', label: 'Product Serial No.',
        aliases: ['Product Serial No.', 'Product Serial No', 'Serial Number', 'serialNumber', 'serial'],
        description: 'A serial number that is not in Invoice Bulk Upload yet is added there.'
    },
    {
        key: 'issueTitle', label: 'Issue Title', required: true,
        aliases: ['Issue Title', 'issueTitle', 'title', 'subject', 'Subject'],
        requiredMessage: 'Issue title is missing.',
        requiredHint: 'Fill in a short title for the complaint.'
    },
    { key: 'description', label: 'Description', aliases: ['Description', 'description'], default: '' },
    {
        key: 'priority', label: 'Priority', aliases: ['Priority', 'priority'],
        description: 'A priority that does not exist yet is added (response 4 h, resolution 24 h). Blank = the first priority.'
    },
    {
        key: 'category', label: 'Category', aliases: ['Category', 'category'],
        description: 'A category that does not exist yet is added. Blank = the first category.'
    },
    {
        key: 'type', label: 'Ticket Type', aliases: ['Ticket Type', 'Type', 'type'],
        description: 'A ticket type that does not exist yet is added. Blank = the first ticket type.'
    },
    {
        key: 'status', label: 'Status', type: 'option', options: TICKET_STATUSES, default: 'Open',
        aliases: ['Status', 'status']
    },
    {
        key: 'issueDate', label: 'Issue Date', type: 'date',
        aliases: ['Issue Date', 'Created At', 'issueDate', 'createdAt'],
        description: 'The date the complaint was raised; the SLA due dates count from it. Blank = today.'
    }
];

/** A mobile number as 10 digits: spaces, dashes and a +91 / 0 prefix are dropped. */
const normalizePhone = (value) => {
    const compact = String(value ?? '').replace(/[\s\-().]/g, '');
    const match = /^(?:\+?91|0)?(\d{10})$/.exec(compact);
    return match ? match[1] : null;
};

/**
 * Priority, category and ticket type are picked by name. As in the original importer, a name
 * that is not in the master yet is added, and a blank cell takes the first record of the master
 * (which is created when the master is still empty).
 */
const MASTERS = [
    {
        field: 'priority',
        model: Priority,
        initial: { name: 'Medium', responseSlaHours: 4, resolutionSlaHours: 24, color: '#3b82f6' },
        added: (name) => ({ name, responseSlaHours: 4, resolutionSlaHours: 24, color: '#3b82f6' })
    },
    {
        field: 'category',
        model: TicketCategory,
        initial: { name: 'General', description: 'General Tickets' },
        added: (name) => ({ name, description: 'Created during tickets import' })
    },
    {
        field: 'type',
        model: TicketType,
        initial: { name: 'Incident', description: 'Incident Reports' },
        added: (name) => ({ name, description: 'Created during tickets import' })
    }
];

/** Returns name -> record for one master, adding the names of this batch that are missing. */
const prepareMaster = async (master, plans) => {
    // Scoped to the company by tenantPlugin; natural order, so [0] is the record findOne gives.
    const records = await master.model.find({}).lean();
    const byName = new Map();
    records.forEach((record) => {
        const key = shared.keyOf(record.name);
        if (key && !byName.has(key)) byName.set(key, record);
    });
    let first = records[0];
    if (!first) {
        first = (await master.model.create(master.initial)).toObject();
        byName.set(shared.keyOf(first.name), first);
    }
    for (const plan of plans) {
        const name = plan.data[master.field];
        if (!name || byName.has(shared.keyOf(name))) continue;
        byName.set(shared.keyOf(name), (await master.model.create(master.added(name))).toObject());
    }
    return (name) => (name ? byName.get(shared.keyOf(name)) : first);
};

/**
 * `count` new ticket numbers from the same counter as the ticket form (CSM-<year>-0001...), in
 * one write. Numbers already used by a ticket (for example typed in an earlier file) or by a row
 * of this batch are skipped, so a generated number never collides.
 */
const nextTicketNumbers = async (companyId, count, taken) => {
    const year = new Date().getFullYear();
    const filter = { type: 'ticket', companyId, prefix: TICKET_PREFIX, year };
    const numbers = [];
    for (let attempt = 0; numbers.length < count && attempt < 20; attempt++) {
        const wanted = count - numbers.length;
        const first = await reserveSequence(filter, wanted);
        const candidates = Array.from({ length: wanted }, (_, i) => `${TICKET_PREFIX}-${year}-${String(first + i).padStart(4, '0')}`);
        const used = await Ticket.find({ ticketNo: { $in: candidates } }).select('ticketNo').lean();
        const usedKeys = new Set(used.map((ticket) => shared.keyOf(ticket.ticketNo)));
        candidates.forEach((candidate) => {
            const key = shared.keyOf(candidate);
            if (!usedKeys.has(key) && !taken.has(key)) numbers.push(candidate);
        });
    }
    if (numbers.length < count) throw new Error('Could not reserve ticket numbers.');
    return numbers;
};

module.exports = {
    key: 'tickets',
    label: 'Support Tickets',
    recordLabel: 'ticket',
    recordLabelPlural: 'tickets',
    permissionKey: 'csm_tickets',
    permissions: [['csm_tickets', 'create']],
    model: Ticket,
    fields: FIELDS,
    // Every row is a new ticket.
    modes: ['create'],

    /** Two rows with the same typed ticket number are duplicates (blank numbers are generated). */
    identityKeys(data) {
        return data.ticketNo ? [{ key: `ticket:${shared.keyOf(data.ticketNo)}`, field: 'ticketNo', label: 'ticket number' }] : [];
    },

    async loadContext({ rows }) {
        const ticketNos = shared.distinctValues(rows, 'ticketNo');
        const [customers, products, assets, tickets] = await Promise.all([
            shared.loadCustomers(shared.distinctValues(rows, 'customer')),
            shared.loadProducts(shared.distinctValues(rows, 'product')),
            shared.loadAssets(rows.map((row) => row.serialNumber)),
            // Tickets are one company-wide register (not branch-scoped).
            ticketNos.length ? shared.findByValues(Ticket, ['ticketNo'], ticketNos, { select: 'ticketNo' }) : []
        ]);
        return {
            customers,
            products,
            assets,
            ticketNumbers: new Set(tickets.map((ticket) => shared.keyOf(ticket.ticketNo))),
            // New serial numbers met so far in this pass (rows are checked in file order).
            newSerials: new Map()
        };
    },

    validate(data, { context, issues: found = [] }) {
        const issues = [];
        const hasIssue = (field) => found.some((issue) => issue.field === field);

        if (data.ticketNo && context.ticketNumbers.has(shared.keyOf(data.ticketNo))) {
            issues.push({
                field: 'ticketNo',
                code: 'ALREADY_EXISTS',
                message: `Ticket No ${data.ticketNo} already exists.`,
                hint: 'Leave Ticket No blank to number the ticket automatically, or use a number that is not taken.'
            });
        }

        const { customer } = shared.resolveCustomerAndProduct(data, context, issues);

        // Serial number: an existing entry gives the product when the row has none; a new one
        // is added to Invoice Bulk Upload, which needs the product.
        if (data.serialNumber) {
            const key = shared.serialKey(data.serialNumber);
            const asset = context.assets.get(key);
            const pending = context.newSerials.get(key);
            if (asset) {
                if (!data.product && asset.productId) data.productId = asset.productId;
            } else if (!data.product) {
                if (pending) data.productId = pending.productId;
                else {
                    issues.push({
                        field: 'product',
                        code: 'REQUIRED',
                        message: `Product is needed for the new serial number ${data.serialNumber}.`,
                        hint: `Serial number ${data.serialNumber} is not in Invoice Bulk Upload yet. Fill in its product code so it can be added, or check the serial number.`
                    });
                }
            } else if (data.productId && !pending) {
                context.newSerials.set(key, { productId: data.productId });
            }
        }

        // Contact phone: the column, else the customer's mobile; 10 digits either way.
        if (data.contactPhone !== undefined) {
            const phone = normalizePhone(data.contactPhone);
            if (phone) data.contactPhone = phone;
            else {
                issues.push({
                    field: 'contactPhone',
                    code: 'INVALID_PHONE',
                    message: 'Contact phone must be a 10-digit mobile number.',
                    hint: `"${data.contactPhone}" is not a 10-digit number. Example: 9876543210.`
                });
            }
        } else if (customer) {
            const phone = normalizePhone(customer.mobile);
            if (phone) data.contactPhone = phone;
            else {
                issues.push({
                    field: 'contactPhone',
                    code: 'REQUIRED',
                    message: 'Contact phone is missing.',
                    hint: customer.mobile
                        ? `Fill in a 10-digit mobile number. The mobile of this customer in Customer Master ("${customer.mobile}") is not a 10-digit number.`
                        : 'Fill in a 10-digit mobile number. This customer has no mobile number in Customer Master.'
                });
            }
        }

        // Pincode: the column, else the customer's pincode.
        if (data.pincode === undefined && !hasIssue('pincode') && customer) {
            const stored = shared.cleanText(customer.billingAddress?.pincode || customer.pincode);
            if (stored) data.pincode = stored;
            else {
                issues.push({
                    field: 'pincode',
                    code: 'REQUIRED',
                    message: 'Pincode is missing.',
                    hint: 'Fill in the Pincode column, or add the pincode to this customer in Customer Master.'
                });
            }
        }
        return issues;
    },

    /**
     * Custom saving: priorities / categories / types named in the file are added first, then new
     * serial numbers (Invoice Bulk Upload), then the tickets. Ticket numbers are reserved only for
     * rows whose ticket passed validation, all at once, so a batch never gets two equal numbers.
     */
    async write(plans, { user, companyId }) {
        const errors = new Map();
        const now = new Date();
        const branchId = getActiveBranchId() || null;
        const userId = user?.id || null;

        const masters = {};
        for (const master of MASTERS) masters[master.field] = await prepareMaster(master, plans);

        // Serial numbers, looked up again: an earlier batch may have added them.
        const assets = await shared.loadAssets(plans.map((plan) => plan.data.serialNumber));
        const newAssets = new Map();
        plans.forEach((plan) => {
            const { data } = plan;
            if (!data.serialNumber) return;
            const key = shared.serialKey(data.serialNumber);
            const existing = assets.get(key);
            if (existing) {
                plan.asset = existing;
                return;
            }
            if (!newAssets.has(key)) {
                newAssets.set(key, {
                    plans: [],
                    doc: {
                        _id: new mongoose.Types.ObjectId(),
                        companyId,
                        customerId: data.customerId,
                        // New serial entries belong to the branch selected in the header.
                        branchId,
                        productId: data.productId,
                        serialNumber: data.serialNumber,
                        serialNumberKey: key,
                        installationDate: data.issueDate ? new Date(data.issueDate) : now,
                        createdBy: userId
                    }
                });
            }
            newAssets.get(key).plans.push(plan);
        });
        const assetErrors = await shared.insertDocs(
            Asset,
            [...newAssets.entries()].map(([key, entry]) => ({ id: key, doc: entry.doc })),
            'serial number entry'
        );
        newAssets.forEach((entry, key) => {
            entry.plans.forEach((plan) => {
                if (assetErrors.has(key)) errors.set(plan.rowId, `Serial number ${plan.data.serialNumber} could not be added: ${assetErrors.get(key)}`);
                else plan.asset = entry.doc;
            });
        });

        // Ticket documents, checked before any number is reserved.
        const ready = [];
        plans.forEach((plan) => {
            if (errors.has(plan.rowId)) return;
            const { data } = plan;
            const priority = masters.priority(data.priority);
            const category = masters.category(data.category);
            const type = masters.type(data.type);
            const createdAt = data.issueDate ? new Date(data.issueDate) : now;
            const doc = {
                _id: plan.recordId,
                companyId,
                ticketNo: data.ticketNo || 'PENDING',
                customerId: data.customerId,
                contactPhone: data.contactPhone,
                contactAlternatePhone: data.contactAlternatePhone || '',
                pincode: data.pincode,
                productId: data.productId || plan.asset?.productId || null,
                assetId: plan.asset?._id || null,
                serialNumber: plan.asset?.serialNumber || '',
                issueTitle: data.issueTitle,
                description: data.description || '',
                categoryId: category?._id || null,
                typeId: type?._id || null,
                priorityId: priority._id,
                status: data.status || 'Open',
                source: 'Excel Import',
                branchId,
                createdBy: userId,
                createdAt,
                updatedAt: now,
                slaResponseDue: new Date(createdAt.getTime() + priority.responseSlaHours * HOUR_MS),
                slaResolutionDue: new Date(createdAt.getTime() + priority.resolutionSlaHours * HOUR_MS),
                timeline: [{
                    activityType: 'Created',
                    description: 'Ticket imported from Excel',
                    performedBy: userId,
                    createdAt
                }]
            };
            // Built once: the same document is numbered below and then saved.
            const ticket = new Ticket(doc);
            const invalid = ticket.validateSync();
            if (invalid) errors.set(plan.rowId, shared.describeError(invalid, 'ticket'));
            else ready.push({ plan, doc: ticket });
        });

        const typed = new Set(ready.filter(({ plan }) => plan.data.ticketNo).map(({ plan }) => shared.keyOf(plan.data.ticketNo)));
        const toNumber = ready.filter(({ plan }) => !plan.data.ticketNo);
        if (toNumber.length) {
            const numbers = await nextTicketNumbers(companyId, toNumber.length, typed);
            toNumber.forEach((entry, index) => {
                entry.doc.ticketNo = numbers[index];
            });
        }

        const ticketErrors = await shared.insertDocs(Ticket, ready.map(({ plan, doc }) => ({ id: plan.rowId, doc })), 'ticket');
        ticketErrors.forEach((message, rowId) => errors.set(rowId, message));
        return errors;
    }
};
