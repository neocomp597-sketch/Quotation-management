const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Customer = require('../models/Customer');
const Asset = require('../models/Asset');
const Voucher = require('../models/Voucher');

async function check() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected!');

        console.log('\n--- CUSTOMERS ---');
        const custs = await Customer.find({
            $or: [
                { companyName: /BUDANIA/i },
                { customerName: /BUDANIA/i },
                { customerName: /Gautam/i }
            ]
        }).lean();
        console.log('Customers count:', custs.length);
        custs.forEach(c => console.log({ _id: String(c._id), companyName: c.companyName, customerName: c.customerName, code: c.externalCode }));

        console.log('\n--- ASSET 53262474 ---');
        const assets = await Asset.find({ serialNumber: /53262474/i }).lean();
        console.log('Assets count:', assets.length);
        assets.forEach(a => console.log({
            _id: String(a._id),
            serialNumber: a.serialNumber,
            customerId: a.customerId,
            customerNameStr: a.customerNameStr,
            customerMobile: a.customerMobile,
            invoiceNumber: a.invoiceNumber
        }));

        console.log('\n--- VOUCHERS / INVOICES ---');
        const vouchers = await Voucher.find({
            $or: [
                { partyName: /BUDANIA/i },
                { 'items.serialNumbers': /53262474/i },
                { voucherNumber: /53262474/i }
            ]
        }).lean();
        console.log('Vouchers count:', vouchers.length);
        vouchers.forEach(v => console.log({
            _id: String(v._id),
            voucherNumber: v.voucherNumber,
            partyName: v.partyName,
            customerId: v.customerId
        }));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
