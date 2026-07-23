const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Asset = require('../models/Asset');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function checkAssets() {
    console.log('--- INSPECTING ALL ASSET RECORDS IN DB ---');
    await mongoose.connect(MONGO_URI);
    try {
        const totalCount = await Asset.countDocuments({});
        console.log(`Total Asset documents in DB: ${totalCount}`);

        const soldCount = await Asset.countDocuments({ status: 'SOLD' });
        const inStockCount = await Asset.countDocuments({ status: 'IN_STOCK' });
        const withCustCount = await Asset.countDocuments({ customerId: { $ne: null } });

        console.log(`  SOLD assets: ${soldCount}`);
        console.log(`  IN_STOCK assets: ${inStockCount}`);
        console.log(`  Assets with customerId: ${withCustCount}`);

        const sampleAssets = await Asset.find({})
            .populate('customerId', 'customerName companyName mobile email')
            .populate('productId', 'productName productCode')
            .limit(10)
            .lean();

        console.log('\nSample Asset Records:');
        sampleAssets.forEach((a, i) => {
            console.log(`[${i+1}] Serial: ${a.serialNumber}, Status: ${a.status}, Customer: ${a.customerId?.customerName || a.customerId?.companyName || 'NONE'}, Product: ${a.productId?.productName || 'NONE'}`);
        });

        // Search specifically for serial containing 1002
        const fg1002Assets = await Asset.find({ serialNumber: { $regex: '1002', $options: 'i' } })
            .populate('customerId', 'customerName companyName mobile email')
            .populate('productId', 'productName productCode')
            .lean();

        console.log(`\nAssets matching "1002" (${fg1002Assets.length}):`);
        fg1002Assets.forEach((a, i) => {
            console.log(`[${i+1}] Serial: ${a.serialNumber}, Status: ${a.status}, Customer: ${a.customerId?.customerName || a.customerId?.companyName || 'NONE'}, Product: ${a.productId?.productName || 'NONE'}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkAssets();
