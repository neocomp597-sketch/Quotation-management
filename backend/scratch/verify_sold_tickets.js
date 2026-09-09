const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Asset = require('../models/Asset');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Priority = require('../models/Priority');
const CustomerContact = require('../models/CustomerContact');
const Ticket = require('../models/Ticket');
const warrantyAmcController = require('../controllers/warrantyAmcController');
const ticketController = require('../controllers/ticketController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function runVerification() {
    console.log('===========================================================');
    console.log('--- STARTING VERIFICATION: SOLD PRODUCTS ONLY FOR TICKETS ---');
    console.log('===========================================================');

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    try {
        const testCust = await Customer.findOne().lean();
        const testProd = await Product.findOne().lean();
        const testPriority = await Priority.findOne().lean();

        if (!testCust || !testProd || !testPriority) {
            throw new Error('Missing prerequisite test data (Customer, Product, or Priority)');
        }

        const companyId = testCust.companyId;

        // Cleanup test assets and tickets
        await Asset.deleteMany({ serialNumber: { $regex: /SOLD-TEST-VERIFY|STOCK-TEST-VERIFY/i } });
        await Ticket.deleteMany({ serialNumber: { $regex: /SOLD-TEST-VERIFY|STOCK-TEST-VERIFY/i } });

        // 1. Create 1 SOLD asset and 1 IN_STOCK asset
        const soldAsset = await Asset.create({
            companyId,
            customerId: testCust._id,
            productId: testProd._id,
            serialNumber: 'SOLD-TEST-VERIFY-001',
            status: 'SOLD',
            saleDate: new Date(),
            invoiceNumber: 'INV-VERIFY-001'
        });

        const stockAsset = await Asset.create({
            companyId,
            customerId: null,
            productId: testProd._id,
            serialNumber: 'STOCK-TEST-VERIFY-002',
            status: 'IN_STOCK'
        });

        console.log(`✅ Created SOLD asset (${soldAsset.serialNumber}) and IN_STOCK asset (${stockAsset.serialNumber})`);

        // TEST 1: searchSerialNumbers should return SOLD asset but NOT IN_STOCK asset
        console.log('\n[TEST 1] Testing searchSerialNumbers API...');
        let searchResult = null;
        const searchRes = {
            json: (data) => { searchResult = data; return searchRes; },
            status: () => searchRes
        };

        await warrantyAmcController.searchSerialNumbers(
            { query: { q: 'TEST-VERIFY' }, user: { companyId } },
            searchRes
        );

        const foundStock = searchResult.some(a => a.serialNumber === stockAsset.serialNumber);
        const foundSold = searchResult.some(a => a.serialNumber === soldAsset.serialNumber);

        if (foundStock) {
            throw new Error(`FAILED: searchSerialNumbers returned IN_STOCK asset (${stockAsset.serialNumber})`);
        }
        if (!foundSold) {
            throw new Error(`FAILED: searchSerialNumbers did NOT return SOLD asset (${soldAsset.serialNumber})`);
        }
        console.log('✅ TEST 1 PASSED: searchSerialNumbers returned ONLY the SOLD product.');

        // TEST 2: Attempt ticket creation for IN_STOCK (unsold) asset -> MUST FAIL (HTTP 400)
        console.log('\n[TEST 2] Testing createTicket with IN_STOCK (unsold) asset...');
        let createErrStatus = null;
        let createErrMsg = null;

        const mockReqStock = {
            user: { companyId, id: testCust.createdBy || new mongoose.Types.ObjectId() },
            body: {
                customerId: testCust._id,
                productId: testProd._id,
                assetId: stockAsset._id,
                serialNumber: stockAsset.serialNumber,
                priorityId: testPriority._id,
                issueTitle: 'Unsold item issue test',
                pincode: '400001',
                description: 'Testing unsold ticket rejection'
            }
        };

        const mockResStock = {
            status: (code) => { createErrStatus = code; return mockResStock; },
            json: (data) => { createErrMsg = data.message; return mockResStock; }
        };

        await ticketController.createTicket(mockReqStock, mockResStock);

        if (createErrStatus !== 400 || !createErrMsg?.includes('only be generated for SOLD products')) {
            throw new Error(`FAILED: Expected 400 rejection for IN_STOCK product, got status ${createErrStatus}: "${createErrMsg}"`);
        }
        console.log(`✅ TEST 2 PASSED: Ticket creation correctly REJECTED with message: "${createErrMsg}"`);

        const TicketCategory = require('../models/TicketCategory');
        const TicketType = require('../models/TicketType');
        const testCategory = await TicketCategory.findOne({ companyId }).lean() || await TicketCategory.findOne().lean();
        const testType = await TicketType.findOne({ companyId }).lean() || await TicketType.findOne().lean();

        // TEST 3: Create ticket for SOLD asset -> MUST SUCCEED
        console.log('\n[TEST 3] Testing createTicket with SOLD asset...');
        let createSuccessTicket = null;

        const mockReqSold = {
            user: { companyId, id: testCust.createdBy || new mongoose.Types.ObjectId() },
            body: {
                customerId: testCust._id,
                productId: testProd._id,
                assetId: soldAsset._id,
                serialNumber: soldAsset.serialNumber,
                priorityId: testPriority._id,
                categoryId: testCategory?._id,
                typeId: testType?._id,
                issueTitle: 'Valid sold item issue test',
                pincode: '400001',
                description: 'Testing sold ticket creation'
            }
        };

        const mockResSold = {
            status: (code) => mockResSold,
            json: (data) => { createSuccessTicket = data; return mockResSold; }
        };

        await ticketController.createTicket(mockReqSold, mockResSold);

        if (!createSuccessTicket?._id || !createSuccessTicket?.ticketNo) {
            throw new Error('FAILED: Ticket creation for SOLD asset failed');
        }
        console.log(`✅ TEST 3 PASSED: Ticket created successfully (${createSuccessTicket.ticketNo}) for SOLD product.`);

        // Cleanup test data
        await Asset.deleteMany({ serialNumber: { $regex: /SOLD-TEST-VERIFY|STOCK-TEST-VERIFY/i } });
        await Ticket.deleteMany({ serialNumber: { $regex: /SOLD-TEST-VERIFY|STOCK-TEST-VERIFY/i } });

        console.log('\n===========================================================');
        console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! ONLY SOLD PRODUCTS ALLOWED!');
        console.log('===========================================================');

    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

runVerification();
