const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Asset = require('../models/Asset');

async function cleanupStockSerials() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to MongoDB');

        const products = await Product.find({}).lean();
        console.log(`Found ${products.length} products to check.`);

        for (const product of products) {
            // Skip non-physical items
            if (['Service', 'Subscription'].includes(product.catalogType)) {
                console.log(`Skipping service/subscription product: "${product.productName}"`);
                continue;
            }

            // Determine stock quantity: fallback to 5 if stock is 0/undefined for testing
            let stock = Number(product.inventory?.currentStock || 0);
            if (stock <= 0) {
                stock = 5; // Default stock for testing so all products have serials
            }

            // Check existing assets in stock
            const existingCount = await Asset.countDocuments({
                productId: product._id,
                status: 'IN_STOCK'
            });

            const missing = stock - existingCount;
            if (missing <= 0) {
                console.log(`Product "${product.productName}" has sufficient serials in stock (${existingCount}/${stock}). Skipping.`);
                continue;
            }

            console.log(`Generating ${missing} serials for product: "${product.productName}" (Stock: ${stock}, Existing: ${existingCount})`);

            // Generate unique serial numbers
            let prefix = 'SN';
            const prodCode = product.productCode;
            const prodName = product.productName;
            if (prodCode) {
                prefix = prodCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
            }
            if (prefix.length < 2 && prodName) {
                prefix = prodName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
            }
            if (prefix.length < 2) {
                prefix = 'DH';
            }

            const regex = new RegExp(`^${prefix}\\d+$`);
            const latestAsset = await Asset.findOne({
                companyId: product.companyId,
                serialNumber: regex
            })
            .sort({ serialNumber: -1 })
            .lean();

            let startIndex = 1;
            if (latestAsset) {
                const numPart = latestAsset.serialNumber.slice(prefix.length);
                const parsed = parseInt(numPart, 10);
                if (!isNaN(parsed)) {
                    startIndex = parsed + 1;
                }
            }

            for (let i = 0; i < missing; i++) {
                const serialNumber = `${prefix}${String(startIndex + i).padStart(3, '0')}`;
                await Asset.create({
                    companyId: product.companyId,
                    productId: product._id,
                    serialNumber,
                    status: 'IN_STOCK',
                    location: 'Main Warehouse'
                });
            }
            console.log(`Generated ${missing} serials for "${product.productName}".`);
        }
        console.log('Cleanup migration complete.');

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

cleanupStockSerials();
