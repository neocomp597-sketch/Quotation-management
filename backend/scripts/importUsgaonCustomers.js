const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const { invalidateCustomerCaches } = require('../utils/cacheInvalidation');

const workbookPath = 'C:\\Users\\wagho\\Downloads\\Customer.xlsx';
const clean = (value) => String(value ?? '').trim();
const key = (value) => clean(value).replace(/\s+/g, ' ').toUpperCase();

const customerFromRow = (row) => {
    const externalCode = clean(row['Customer Code']);
    const companyName = clean(row['Customer Name']);
    if (!externalCode || !companyName) return null;

    return {
        externalCode,
        customerName: companyName,
        companyName,
        gstin: clean(row['Bill to GSTIN']).toUpperCase(),
        billingAddress: {
            line1: clean(row['Bill To Address']),
            line2: '',
            city: '',
            state: clean(row['Bill to State']),
            pincode: clean(row['Bill to PinCode']).replace(/\D/g, '').slice(0, 6)
        },
        shippingAddress: {
            line1: clean(row['Shift To Address']),
            line2: '',
            city: '',
            state: clean(row['Place Of Supply']),
            pincode: clean(row['Ship to PinCode']).replace(/\D/g, '').slice(0, 6)
        },
        industry: clean(row.GroupName) || 'Other',
        status: 'Prospect',
        segment: 'Retail'
    };
};

const loadUniqueCustomers = () => {
    const workbook = xlsx.readFile(workbookPath);
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const unique = new Map();
    for (const row of rows) {
        const customer = customerFromRow(row);
        if (customer && !unique.has(key(customer.externalCode))) unique.set(key(customer.externalCode), customer);
    }
    return { sourceRows: rows.length, customers: [...unique.values()] };
};

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const branch = await Branch.findOne({ name: /^usgoan$/i })
            .setOptions({ bypassTenant: true, bypassBranch: true })
            .lean();
        if (!branch) throw new Error('USGOAN branch was not found.');

        const { sourceRows, customers } = loadUniqueCustomers();
        const existing = await Customer.find({ companyId: branch.companyId })
            .setOptions({ bypassTenant: true, bypassBranch: true })
            .lean();
        const byCode = new Map();
        const byGstin = new Map();
        const byName = new Map();
        for (const customer of existing) {
            if (customer.externalCode) byCode.set(key(customer.externalCode), customer);
            if (customer.gstin) byGstin.set(key(customer.gstin), customer);
            if (customer.companyName) byName.set(key(customer.companyName), customer);
        }

        const summary = { sourceRows, uniqueCustomers: customers.length, created: 0, updated: 0, movedToUsgaon: 0 };
        const operations = [];
        for (const customer of customers) {
            const match = byCode.get(key(customer.externalCode))
                || (customer.gstin ? byGstin.get(key(customer.gstin)) : null)
                || byName.get(key(customer.companyName));
            const document = { ...customer, companyId: branch.companyId, branchId: branch._id };
            if (match) {
                operations.push({ updateOne: { filter: { _id: match._id }, update: { $set: document } } });
                summary.updated += 1;
                if (String(match.branchId || '') !== String(branch._id)) summary.movedToUsgaon += 1;
            } else {
                operations.push({ insertOne: { document } });
                summary.created += 1;
            }
        }

        if (!dryRun && operations.length) {
            await Customer.bulkWrite(operations, { ordered: false });
            await invalidateCustomerCaches();
        }
        console.log(JSON.stringify({ branch: branch.name, dryRun, ...summary }, null, 2));
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
