// Lists customers that share a customer code within a company (ignoring case and spaces), with
// how many records point at each, so the team can decide which one to keep. Customer codes are
// unique per company (models/Customer.js); MongoDB cannot build that index while duplicates exist.
//
//   node scripts/checkCustomerCodeDuplicates.js                 report only (changes nothing)
//   node scripts/checkCustomerCodeDuplicates.js --company <id>  one company
//   node scripts/checkCustomerCodeDuplicates.js --create-index  build the index once the report is empty
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Customer = require('../models/Customer');
const Company = require('../models/Company');
const Branch = require('../models/Branch');

// Records that point at a customer (all use customerId).
const REFERENCING_MODELS = [
    'Quotation', 'SalesOrder', 'Voucher', 'Enquiry', 'Deal', 'Planning', 'Contract', 'Ticket',
    'Asset', 'AssetHistory', 'Warranty', 'AMC', 'Site', 'CustomerContact'
];

const argValue = (name) => {
    const index = process.argv.indexOf(name);
    return index > -1 ? process.argv[index + 1] : null;
};

const codeKey = (code) => String(code || '').replace(/\s+/g, ' ').trim().toLowerCase();

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const companyFilter = argValue('--company') ? { companyId: new mongoose.Types.ObjectId(argValue('--company')) } : {};

    // Raw collection reads: no tenant context here, every company is checked.
    const customers = await Customer.collection.find(
        { ...companyFilter, externalCode: { $type: 'string', $gt: '' } },
        { projection: { companyId: 1, externalCode: 1, companyName: 1, customerName: 1, branchId: 1, createdAt: 1 } }
    ).toArray();

    const groups = new Map();
    customers.forEach((customer) => {
        const key = `${customer.companyId}|${codeKey(customer.externalCode)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(customer);
    });
    const duplicates = [...groups.values()].filter((group) => group.length > 1);

    if (!duplicates.length) {
        console.log(`No duplicate customer codes (${customers.length} customers with a code checked).`);
    } else {
        const ids = duplicates.flat().map((customer) => customer._id);
        const references = new Map(ids.map((id) => [String(id), {}]));
        for (const name of REFERENCING_MODELS) {
            const model = require(`../models/${name}`);
            const counts = await model.collection.aggregate([
                { $match: { customerId: { $in: ids } } },
                { $group: { _id: '$customerId', count: { $sum: 1 } } }
            ]).toArray();
            counts.forEach(({ _id, count }) => { references.get(String(_id))[name] = count; });
        }
        const companies = new Map((await Company.collection.find({ _id: { $in: duplicates.map((group) => group[0].companyId) } }).toArray())
            .map((company) => [String(company._id), company.name]));
        const branches = new Map((await Branch.collection.find({}).project({ name: 1 }).toArray())
            .map((branch) => [String(branch._id), branch.name]));

        console.log(`${duplicates.length} customer codes are used by more than one customer:\n`);
        duplicates.forEach((group) => {
            console.log(`${companies.get(String(group[0].companyId)) || group[0].companyId} - code "${group[0].externalCode}"`);
            group.forEach((customer) => {
                const refs = Object.entries(references.get(String(customer._id)))
                    .map(([name, count]) => `${name} ${count}`).join(', ') || 'no linked records';
                console.log(`   ${customer._id}  ${customer.companyName || customer.customerName}  [${branches.get(String(customer.branchId)) || 'all branches'}]  created ${customer.createdAt ? new Date(customer.createdAt).toISOString().slice(0, 10) : '?'}  -> ${refs}`);
            });
        });
        console.log('\nGive each of these customers its own code (or merge them), then run again with --create-index.');
    }

    if (process.argv.includes('--create-index')) {
        try {
            await Customer.createIndexes();
            console.log('Customer code index is in place: codes are now unique per company.');
        } catch (error) {
            console.log(error.code === 11000
                ? 'The index could not be built yet: some customers still share a code (see above).'
                : `The index could not be built yet: ${error.message}`);
            process.exitCode = 1;
        }
    }
    await mongoose.disconnect();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
