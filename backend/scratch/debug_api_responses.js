const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Customer = require('../models/Customer');
const Product = require('../models/Product');

async function debug() {
    await mongoose.connect(process.env.MONGO_URI);
    
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    console.log('Total Customers in DB:', totalCustomers);
    console.log('Total Products in DB:', totalProducts);

    // Mock buildCustomerQuery
    const query = {}; // admin role gets all
    const customers = await Customer.find(query)
        .select('customerName companyName')
        .sort({ createdAt: -1 })
        .limit(10);
    console.log('Sample Customers:', customers.map(c => c.customerName));

    await mongoose.disconnect();
}

debug();
