/**
 * Backfills `branchId` on records that are linked to a branch only indirectly.
 *
 * Branch scoping (tenantPlugin) filters on `branchId`. Records without one are
 * not owned by any branch and stay visible from every branch context, so legacy
 * data created before branches existed shows up everywhere. This script gives
 * those records the branch of the record they belong to:
 *
 *   - enquiries, tickets, quotations, planning entries, customer contacts,
 *     warranties, AMCs, assets
 *       -> the branch of their customer
 *   - service visits, RCA reports
 *       -> the branch of their ticket
 *   - asset history
 *       -> the branch of its asset
 *   - field attendance
 *       -> the primary branch of the engineer (user) who checked in
 *   - stock ledger / transfers / adjustments / counts / alerts
 *       -> the branch of their warehouse
 *
 * Only records with no branch are touched; a branch set explicitly is kept.
 * Sources without a branch (customer / warehouse not assigned) are skipped.
 *
 * Usage:
 *   node scripts/backfillBranchIds.js            # apply
 *   node scripts/backfillBranchIds.js --dry-run  # report only
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

const Customer = require('../models/Customer');
const Warehouse = require('../models/Warehouse');
const Ticket = require('../models/Ticket');
const Asset = require('../models/Asset');
const User = require('../models/User');

const BY_CUSTOMER = [
    { model: Ticket, field: 'customerId' },
    { model: Asset, field: 'customerId' },
    { model: require('../models/Enquiry'), field: 'customerId' },
    { model: require('../models/Quotation'), field: 'customerId' },
    { model: require('../models/Planning'), field: 'customerId' },
    { model: require('../models/CustomerContact'), field: 'customerId' },
    { model: require('../models/Warranty'), field: 'customerId' },
    { model: require('../models/AMC'), field: 'customerId' },
];

// Resolved after assets have been backfilled, so history follows its asset's branch.
const BY_ASSET = [
    { model: require('../models/AssetHistory'), field: 'assetId' },
];

// Attendance is keyed by the engineer's user id; it takes that user's primary branch.
const BY_USER = [
    { model: require('../models/FieldAttendance'), field: 'engineerId' },
];

// Resolved after tickets have been backfilled, so visits follow their ticket's branch.
const BY_TICKET = [
    { model: require('../models/ServiceVisit'), field: 'ticketId' },
    { model: require('../models/CSMRcaReport'), field: 'ticketNo', sourceKey: 'ticketNo' },
];

const BY_WAREHOUSE = [
    { model: require('../models/StockLedger'), field: 'warehouseId' },
    { model: require('../models/StockAlert'), field: 'warehouseId' },
    { model: require('../models/StockAdjustment'), field: 'warehouseId' },
    { model: require('../models/StockCount'), field: 'warehouseId' },
    { model: require('../models/StockTransfer'), field: 'fromWarehouseId' },
];

const NO_BRANCH = { $or: [{ branchId: null }, { branchId: { $exists: false } }] };

const chunk = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
};

/**
 * Sets branchId on every record of `model` whose `field` points at one of the
 * given sources, taking the source's branch. Returns how many records changed.
 */
const backfillFromSources = async (model, field, sources, sourceKey = '_id') => {
    if (!model.schema.path(field)) {
        console.log(`  ${model.modelName}: no field "${field}", skipped`);
        return 0;
    }

    let changed = 0;
    for (const group of chunk(sources, BATCH_SIZE)) {
        if (DRY_RUN) {
            for (const source of group) {
                changed += await model.countDocuments({ [field]: source[sourceKey], ...NO_BRANCH }).setOptions({ bypassTenant: true });
            }
            continue;
        }

        const operations = group.map((source) => ({
            updateMany: {
                filter: { [field]: source[sourceKey], ...NO_BRANCH },
                update: { $set: { branchId: source.branchId } },
            },
        }));
        const result = await model.bulkWrite(operations, { ordered: false, bypassTenant: true });
        changed += result.modifiedCount || 0;
    }

    console.log(`  ${model.modelName}.${field}: ${DRY_RUN ? 'would update' : 'updated'} ${changed}`);
    return changed;
};

(async () => {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI is not set.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected. ${DRY_RUN ? 'DRY RUN - nothing will be written.' : 'Applying changes.'}`);

    try {
        const customers = await Customer.find({ branchId: { $ne: null } })
            .select('_id branchId')
            .setOptions({ bypassTenant: true })
            .lean();
        console.log(`\nCustomers with a branch: ${customers.length}`);
        let total = 0;
        for (const { model, field } of BY_CUSTOMER) {
            total += await backfillFromSources(model, field, customers);
        }

        const tickets = await Ticket.find({ branchId: { $ne: null } })
            .select('_id ticketNo branchId')
            .setOptions({ bypassTenant: true })
            .lean();
        console.log(`\nTickets with a branch: ${tickets.length}`);
        for (const { model, field, sourceKey } of BY_TICKET) {
            total += await backfillFromSources(model, field, tickets, sourceKey);
        }

        const assets = await Asset.find({ branchId: { $ne: null } })
            .select('_id branchId')
            .setOptions({ bypassTenant: true })
            .lean();
        console.log(`\nAssets with a branch: ${assets.length}`);
        for (const { model, field } of BY_ASSET) {
            total += await backfillFromSources(model, field, assets);
        }

        const usersWithBranch = await User.find({ branchId: { $ne: null } })
            .select('_id branchId')
            .lean();
        console.log(`\nUsers with a primary branch: ${usersWithBranch.length}`);
        for (const { model, field } of BY_USER) {
            total += await backfillFromSources(model, field, usersWithBranch);
        }

        const warehouses = await Warehouse.find({ branchId: { $ne: null } })
            .select('_id branchId')
            .setOptions({ bypassTenant: true })
            .lean();
        console.log(`\nWarehouses with a branch: ${warehouses.length}`);
        for (const { model, field } of BY_WAREHOUSE) {
            total += await backfillFromSources(model, field, warehouses);
        }

        console.log(`\nDone. ${DRY_RUN ? 'Would update' : 'Updated'} ${total} record(s) in total.`);
    } finally {
        await mongoose.disconnect();
    }
})().catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
