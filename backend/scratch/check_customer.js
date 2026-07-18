const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Customer = require('../models/Customer');
const Product = require('../models/Product');

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    
    const customers = await Customer.find({
        $or: [
            { customerName: /rajshri/i },
            { companyName: /rajshri/i }
        ]
    });
    console.log('Matching Customers:', customers.map(c => ({ id: c._id, name: c.customerName, company: c.companyName, code: c.externalCode })));

    const products = await Product.find({
        productName: /Elbow/i
    });
    console.log('Matching Products:', products.map(p => ({ id: p._id, name: p.productName, code: p.productCode })));

    await mongoose.disconnect();
}

check();
