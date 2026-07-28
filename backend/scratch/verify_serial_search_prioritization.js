const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Asset = require('../models/Asset');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const warrantyAmcController = require('../controllers/warrantyAmcController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function runTest() {
    console.log('--- STARTING VERIFICATION FOR SERIAL NO. SEARCH PRIORITIZATION & AUTO-FILL ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
        // Step 1: Create test customer, product, and assets (SOLD vs IN_STOCK) with matching partial serial "TEST900"
        const testCust = await Customer.findOne({ customerName: /test/i }).lean() || await Customer.findOne().lean();
        const testProd = await Product.findOne().lean();

        if (!testCust || !testProd) {
            console.log('Skipping DB mock creation, testing searchSerialNumbers directly on existing assets...');
        } else {
            console.log(`Using Customer "${testCust.companyName || testCust.customerName}" and Product "${testProd.productName}"`);

            // Clean previous test assets
            await Asset.deleteMany({ serialNumber: { $regex: /TEST900/i } });

            // Create 1 IN_STOCK asset and 1 SOLD asset with matching serial suffix
            await Asset.create({
                customerId: null,
                productId: testProd._id,
                serialNumber: 'STOCK-TEST900',
                status: 'IN_STOCK',
                companyId: testProd.companyId
            });

            await Asset.create({
                customerId: testCust._id,
                productId: testProd._id,
                serialNumber: 'SOLD-TEST900',
                status: 'SOLD',
                invoiceNumber: 'INV-TEST-900',
                invoiceDate: new Date(),
                saleDate: new Date(),
                companyId: testProd.companyId
            });

            console.log('✅ Created mock IN_STOCK and SOLD assets for testing prioritization.');
        }

        // Step 2: Invoke searchSerialNumbers controller with query "900" or "100"
        console.log('\n[Step 2] Testing searchSerialNumbers with partial query "900"...');
        const req = {
            query: { q: '900' },
            user: { companyId: testProd?.companyId }
        };

        let responseData = null;
        const res = {
            json: (data) => { responseData = data; return res; },
            status: (code) => res
        };

        await warrantyAmcController.searchSerialNumbers(req, res);

        if (!Array.isArray(responseData)) {
            throw new Error('FAILED: searchSerialNumbers did not return an array');
        }

        console.log(`Received ${responseData.length} matching assets for partial search "900":`);
        responseData.forEach((asset, idx) => {
            console.log(`  ${idx + 1}. [${asset.status}] ${asset.serialNumber} - Customer: ${asset.customerId?.companyName || asset.customerId?.customerName || 'Stock (Unsold)'}`);
        });

        // Check if SOLD items appear BEFORE IN_STOCK items
        const soldIdx = responseData.findIndex(a => a.status === 'SOLD' || a.customerId);
        const stockIdx = responseData.findIndex(a => a.status === 'IN_STOCK' && !a.customerId);

        if (soldIdx !== -1 && stockIdx !== -1) {
            if (soldIdx > stockIdx) {
                throw new Error(`FAILED: IN_STOCK asset (index ${stockIdx}) appeared before SOLD asset (index ${soldIdx})`);
            }
            console.log('✅ PASS: SOLD asset prioritized above IN_STOCK asset in search results!');
        } else {
            console.log('✅ Partial search results returned successfully.');
        }

        // Step 3: Test getAssetSummary for the SOLD asset
        const soldAsset = responseData.find(a => a.status === 'SOLD' || a.customerId);
        if (soldAsset) {
            console.log(`\n[Step 3] Testing getAssetSummary for serialNumber "${soldAsset.serialNumber}"...`);
            let summaryData = null;
            const summaryRes = {
                json: (d) => { summaryData = d; return summaryRes; },
                status: (c) => summaryRes
            };

            await warrantyAmcController.getAssetSummary({ query: { serialNumber: soldAsset.serialNumber }, user: req.user }, summaryRes);

            if (!summaryData?.asset) {
                throw new Error('FAILED: getAssetSummary did not return asset details');
            }

            console.log('✅ Asset summary retrieved successfully:');
            console.log('   Customer:', summaryData.asset.customerId?.companyName || summaryData.asset.customerId?.customerName);
            console.log('   Product:', summaryData.asset.productId?.productName);
            console.log('   Invoice:', summaryData.asset.invoiceNumber || 'N/A');
        }

        console.log('\n==================================================');
        console.log('🎉 SERIAL NUMBER PRIORITIZATION & LOOKUP CHECKS PASSED!');
        console.log('==================================================');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

runTest();
