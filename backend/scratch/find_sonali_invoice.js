const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const Customer = require('../models/Customer');

async function findInvoice() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to MongoDB');

        const sonali = await Customer.findOne({ customerName: /Sonali/i });
        console.log('Sonali Customer:', sonali);

        const query = { voucherType: 'Invoice' };
        if (sonali) {
            query.customerId = sonali._id;
        } else {
            query.$or = [
                { customerName: /Sonali/i },
                { 'items.productName': /ARM BRASS KITCHEN SINK MIXER/i }
            ];
        }

        const invoices = await Voucher.find(query).lean();
        console.log('Found Invoices:', invoices.length);
        invoices.forEach(inv => {
            console.log(`Invoice #: ${inv.voucherNumber}, Date: ${inv.date}, Customer: ${inv.customerName || inv.customerId}`);
            inv.items.forEach(item => {
                console.log(`  - ${item.productName}: ${item.qty} qty`);
            });
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findInvoice();
