const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

require('../models/Customer');
require('../models/Product');
require('../models/Voucher');
const Asset = require('../models/Asset');
const warrantyAmcController = require('../controllers/warrantyAmcController');

async function testFix() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db');
    console.log('--- TESTING SERIAL NUMBER SEARCH FIX ---');

    // Find a sold asset to test companyId
    const soldSample = await Asset.findOne({ $or: [{ status: 'SOLD' }, { customerId: { $ne: null } }] }).lean();
    console.log('Sample Sold Asset in DB:', soldSample ? { serial: soldSample.serialNumber, status: soldSample.status, companyId: soldSample.companyId } : 'None');

    const req = {
        query: { q: '1002' },
        user: soldSample ? { companyId: soldSample.companyId } : {}
    };

    let result = null;
    const res = {
        json: (data) => { result = data; return res; },
        status: (code) => res
    };

    await warrantyAmcController.searchSerialNumbers(req, res);

    console.log(`Search result count for "1002": ${result ? result.length : 0}`);
    if (result && result.length > 0) {
        let hasInStock = false;
        const serials = [];
        result.forEach((item, idx) => {
            console.log(`[${idx + 1}] Serial: ${item.serialNumber}, Status: ${item.status}, Customer: ${item.customerId?.companyName || item.customerId?.customerName || 'None'}`);
            if (item.status === 'IN_STOCK' && !item.customerId) {
                hasInStock = true;
            }
            serials.push(item.serialNumber);
        });

        const uniqueSerials = new Set(serials);
        console.log(`Total items: ${serials.length}, Unique serials: ${uniqueSerials.size}`);

        if (hasInStock) {
            console.error('❌ FAILED: IN_STOCK products were found in search results!');
        } else {
            console.log('✅ PASSED: No IN_STOCK / Unsold products found.');
        }

        if (serials.length !== uniqueSerials.size) {
            console.error('❌ FAILED: Duplicate serial numbers were found in search results!');
        } else {
            console.log('✅ PASSED: All returned serial numbers are unique.');
        }
    } else {
        console.log('No matching SOLD products found for "1002".');
    }

    await mongoose.disconnect();
}

testFix();
