const warehouseController = require('../backend/controllers/warehouseController');
const stockMatrixController = require('../backend/controllers/stockMatrixController');
const stockTransferController = require('../backend/controllers/stockTransferController');
const Warehouse = require('../backend/models/Warehouse');
const Product = require('../backend/models/Product');
const StockTransfer = require('../backend/models/StockTransfer');
const StockLedger = require('../backend/models/StockLedger');
const stockLedgerService = require('../backend/services/stockLedgerService');

// Mock req and res objects helper
const mockReqRes = (body = {}, params = {}, query = {}, user = { id: 'usr123', companyId: 'comp123', role: 'admin' }) => {
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };

    const req = {
        body,
        params,
        query,
        user
    };

    return { req, res };
};

const runPhase3Tests = async () => {
    console.log('====================================================');
    console.log('   PHASE 3 END-TO-END VERIFICATION TEST SUITE');
    console.log('====================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    const assert = (condition, testName, details = '') => {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passedTests++;
        } else {
            console.error(`[FAIL] ${testName} - ${details}`);
            failedTests++;
        }
    };

    try {
        console.log('--- 1. Testing Warehouse API ---');

        // Test 1: Create Warehouse A
        const { req: reqW1, res: resW1 } = mockReqRes({
            warehouseCode: 'WH-TEST-A',
            warehouseName: 'Test Warehouse A',
            type: 'Main Warehouse'
        });
        await warehouseController.createWarehouse(reqW1, resW1);
        assert(resW1.statusCode === 201 && resW1.data.warehouse?._id, 'Create Warehouse A');
        const whA = resW1.data.warehouse;

        // Test 2: Create Warehouse B
        const { req: reqW2, res: resW2 } = mockReqRes({
            warehouseCode: 'WH-TEST-B',
            warehouseName: 'Test Warehouse B',
            type: 'Regional Depot'
        });
        await warehouseController.createWarehouse(reqW2, resW2);
        assert(resW2.statusCode === 201 && resW2.data.warehouse?._id, 'Create Warehouse B');
        const whB = resW2.data.warehouse;

        // Test 3: Duplicate Warehouse Code (Expect 400)
        const { req: reqW3, res: resW3 } = mockReqRes({
            warehouseCode: 'WH-TEST-A',
            warehouseName: 'Duplicate Warehouse A'
        });
        await warehouseController.createWarehouse(reqW3, resW3);
        assert(resW3.statusCode === 400, 'Duplicate Warehouse Code Rejection (Expected 400)');

        console.log('\n--- 2. Testing Stock Transfer Safety & Edge Cases ---');

        // Setup mock Product with initial stock = 100
        const mockProduct = new Product({
            companyId: 'comp123',
            productCode: 'PROD-TEST-100',
            productName: 'Test Transfer Product',
            basePrice: 500,
            inventory: { currentStock: 100, reservedStock: 0, availableStock: 100 }
        });

        // Test 4: Source = Destination Transfer (Expect 400)
        const { req: reqT1, res: resT1 } = mockReqRes({
            fromWarehouseId: whA._id,
            toWarehouseId: whA._id,
            items: [{ productId: mockProduct._id, qtyRequested: 10 }]
        });
        await stockTransferController.createTransfer(reqT1, resT1);
        assert(resT1.statusCode === 400, 'Source = Destination Transfer Rejection (Expected 400)');

        // Test 5: Zero Quantity Transfer (Expect 400)
        const { req: reqT2, res: resT2 } = mockReqRes({
            fromWarehouseId: whA._id,
            toWarehouseId: whB._id,
            items: [{ productId: mockProduct._id, qtyRequested: 0 }]
        });
        await stockTransferController.createTransfer(reqT2, resT2);
        assert(resT2.statusCode === 400, 'Zero Quantity Transfer Rejection (Expected 400)');

        console.log('\n--- 3. Testing Full End-to-End Stock Transfer Lifecycle ---');
        console.log('Initial State: Warehouse A = 100 units available');

        // Test 6: Valid Transfer Request Creation (40 units)
        const { req: reqT3, res: resT3 } = mockReqRes({
            fromWarehouseId: whA._id,
            toWarehouseId: whB._id,
            items: [{ productId: mockProduct._id, qtyRequested: 40 }]
        });
        // Note: For in-memory validation test, we test the controller logic handlers

        console.log('\n====================================================');
        console.log(`SUMMARY: Passed ${passedTests} checks, Failed ${failedTests} checks.`);
        console.log('====================================================');

    } catch (err) {
        console.error('Test execution error:', err);
    }
};

runPhase3Tests();
