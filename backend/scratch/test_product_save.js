const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Product = require('../models/Product');
const { runWithTenant } = require('../middlewares/tenantContext');

async function testSave() {
    console.log('Connecting to Mongo...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const companyId = '6a0b44ab81a41f89dab23668';

    await runWithTenant(companyId, async () => {
        try {
            const newProduct = new Product({
                productCode: 'TEST_PROD_123',
                productName: 'Test Product Name',
                hsnCode: '123456',
                gstPercentage: 18,
                basePrice: 100,
                mrp: 150,
                uom: 'Nos',
                status: 'Active',
            });

            await newProduct.save();
            console.log('Success saving product:', newProduct._id);
        } catch (error) {
            console.error('Error saving product:');
            console.error(error);
        }
    });

    await mongoose.disconnect();
}

testSave();
