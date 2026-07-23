const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Asset = require('../models/Asset');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function testQuery() {
    console.log('--- TESTING MONGO SORT QUERY FOR SEARCH SERIAL NUMBERS ---');
    await mongoose.connect(MONGO_URI);
    try {
        const filter = { serialNumber: { $regex: '1002', $options: 'i' } };

        const assets = await Asset.find(filter)
            .sort({ customerId: -1, status: -1, serialNumber: 1 })
            .limit(30)
            .populate('customerId', 'customerName companyName mobile email')
            .populate('productId', 'productName productCode')
            .lean();

        console.log(`Query returned ${assets.length} results:`);
        assets.forEach((a, i) => {
            console.log(`[${i+1}] Serial: ${a.serialNumber}, Status: ${a.status}, Customer: ${a.customerId?.customerName || a.customerId?.companyName || 'NONE'}, Product: ${a.productId?.productName || 'NONE'}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

testQuery();
