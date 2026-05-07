const mongoose = require('mongoose');
const Planning = require('../models/Planning');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
require('dotenv').config();

const FY = process.argv[2] || '2025-26';

const pickRotating = (items, index, step = 1) => {
    if (!items.length) return null;
    return items[(index * step) % items.length];
};

const run = async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI or MONGODB_URI is required');
    }

    await mongoose.connect(mongoUri);

    const [entries, customers, products] = await Promise.all([
        Planning.find({ financialYear: FY }).sort({ monthYear: 1, createdAt: 1, _id: 1 }),
        Customer.find({}).sort({ companyName: 1, customerName: 1, _id: 1 }),
        Product.find({}).sort({ productName: 1, _id: 1 })
    ]);

    if (!entries.length) {
        console.log(`No planning entries found for FY ${FY}`);
        return;
    }
    if (!customers.length || !products.length) {
        throw new Error('At least one customer and one product are required');
    }

    let updated = 0;
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const customer = pickRotating(customers, index, 3);
        const product = pickRotating(products, index, 5);

        entry.customerId = customer._id;
        entry.customerName = customer.companyName || customer.customerName;
        entry.productId = product._id;
        entry.productName = product.productName;
        entry.status = 'Invoice';
        entry.totalValue = Number(entry.qty || 0) * Number(entry.value || 0);

        await entry.save();
        updated += 1;
    }

    console.log(`Updated ${updated} planning entries for FY ${FY}`);
};

run()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close().catch(() => {});
    });
