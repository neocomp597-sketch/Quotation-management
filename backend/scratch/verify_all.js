const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const voucherController = require('../controllers/voucherController');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const Voucher = require('../models/Voucher');
const { runWithTenant } = require('../middlewares/tenantContext');

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to DB');

        let product = await Product.findOne({ productName: /Mixer/i });
        if (!product) {
            product = await Product.create({
                productCode: 'ABKSM',
                productName: 'Arm Brass Kitchen Sink Mixer',
                hsnCode: '8481',
                gstPercentage: 18,
                basePrice: 1500,
                mrp: 2000,
                uom: 'Nos',
                catalogType: 'Product',
                companyId: new mongoose.Types.ObjectId('660e1d82cc7862f1bc2bc129')
            });
            console.log('Created test product:', product.productName);
        }

        // Find customer with matching companyId
        let customer = await Customer.findOne({ customerName: /Sonali/i, companyId: product.companyId });
        if (!customer) {
            customer = await Customer.create({
                customerName: 'Sonali Enterprises',
                companyName: 'Sonali Enterprises',
                gstin: '27AABCS1234F1Z1',
                billingAddress: 'Mumbai',
                mobile: '9876543210',
                email: 'test@sonali.com',
                companyId: product.companyId
            });
            console.log('Created test customer with matching companyId:', customer.customerName);
        }

        // Run verification within tenant context
        await runWithTenant(product.companyId, async () => {
            // Check stock count
            const stockCountBefore = await Asset.countDocuments({
                productId: product._id,
                status: 'IN_STOCK'
            });
            console.log(`Unsold assets for ${product.productName} in stock: ${stockCountBefore}`);

            // Mock req, res
            const testVoucherNum = `INV-TEST-${Date.now()}`;
            const req = {
                user: { id: '660e1d82cc7862f1bc2bc120', companyId: product.companyId },
                body: {
                    voucherType: 'Invoice',
                    voucherNumber: testVoucherNum,
                    date: new Date(),
                    customerId: customer._id,
                    customerName: customer.customerName,
                    totalQty: 2,
                    totalAmount: 3000,
                    totalTax: 540,
                    grandTotal: 3540,
                    items: [
                        {
                            srNumber: 1,
                            productId: product._id,
                            productName: product.productName,
                            qty: 2,
                            uom: 'Nos',
                            price: 1500,
                            amount: 3000,
                            taxPercentage: 18,
                            taxAmount: 540
                        }
                    ]
                }
            };

            const res = {
                statusCode: 200,
                status: function(code) {
                    this.statusCode = code;
                    return this;
                },
                json: function(data) {
                    this.data = data;
                    console.log('Response:', data);
                }
            };

            await voucherController.createVoucher(req, res);

            // Fetch the invoice
            const savedVoucher = await Voucher.findOne({ voucherNumber: testVoucherNum });
            console.log('\n--- Saved Invoice Details ---');
            console.log('Voucher Number:', savedVoucher.voucherNumber);
            console.log('Item 1 Serials:', savedVoucher.items[0].serialNumbers);

            // Fetch the assets
            const updatedAssets = await Asset.find({ invoiceNumber: testVoucherNum });
            console.log('\n--- Updated Assets Details ---');
            updatedAssets.forEach(a => {
                console.log(`Serial: ${a.serialNumber}, Status: ${a.status}, CustomerId: ${a.customerId}, InvoiceId: ${a.invoiceId}`);
            });

            // Run Lookup test
            const testSerial = savedVoucher.items[0].serialNumbers[0].serialNumber;
            console.log(`\nTesting Customer Service lookup for Serial: ${testSerial}`);
            
            const warrantyAmcController = require('../controllers/warrantyAmcController');
            const lookupReq = {
                user: req.user,
                query: { serialNumber: testSerial }
            };
            const lookupRes = {
                statusCode: 200,
                status: function(code) {
                    this.statusCode = code;
                    return this;
                },
                json: function(data) {
                    this.data = data;
                    console.log('Lookup Result:', JSON.stringify(data, null, 2));
                }
            };

            await warrantyAmcController.getAssetSummary(lookupReq, lookupRes);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

test();
