const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Asset = require(path.join(__dirname, '../backend/models/Asset'));
const Product = require(path.join(__dirname, '../backend/models/Product'));

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected.');

        const assets = await Asset.find({ serialNumber: /SN-100202/i }).populate('productId').lean();
        console.log(`Found ${assets.length} assets for SN-100202:`);
        assets.forEach((a, i) => {
            console.log(`\n--- Asset #${i+1} ---`);
            console.log(`ID: ${a._id}`);
            console.log(`Serial Number: "${a.serialNumber}"`);
            console.log(`Product Code: "${a.productId?.productCode}" | Product Name: "${a.productId?.productName}"`);
            console.log(`Status: "${a.status}"`);
            console.log(`Customer: "${a.customerNameStr || a.customerId}"`);
            console.log(`Invoice Ref: "${a.invoiceNumber}"`);
            console.log(`Indicator Field: "${a.indicatorField}"`);
            console.log(`Created At: ${a.createdAt}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
