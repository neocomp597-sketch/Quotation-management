const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Planning = require('../models/Planning');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const MGR = require('../models/MGR');
const { runWithTenant } = require('../middlewares/tenantContext');

async function testSave() {
    console.log('Connecting to Mongo...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const companyId = '6a0b44ab81a41f89dab23668';

    await runWithTenant(companyId, async () => {
        try {
            const customer = await Customer.findOne();
            const product = await Product.findOne();
            const mgr = await MGR.findOne({ mgrType: 'MGR1' });

            if (!customer || !product || !mgr) {
                console.error('Missing master records to create a test planning entry.');
                return;
            }

            const newEntry = new Planning({
                monthYear: 'Apr-26',
                financialYear: '2026-27',
                month: 1,
                customerId: customer._id,
                customerName: customer.companyName || customer.customerName,
                productId: product._id,
                productName: product.productName,
                qty: 10,
                value: 500,
                mgrCode: mgr.code,
                status: 'Firm'
            });

            await newEntry.save();
            console.log('Success saving planning entry:', newEntry._id);
        } catch (error) {
            console.error('Error saving planning entry:');
            console.error(error);
        }
    });

    await mongoose.disconnect();
}

testSave();
