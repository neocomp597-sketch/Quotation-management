const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const Quotation = require('../models/Quotation');

async function run() {
    await connectDB();
    console.log("DB Connected");
    const quotations = await Quotation.find({}).lean();
    console.log(`Found ${quotations.length} quotations:`);
    quotations.forEach(q => {
        console.log(`ID: ${q._id}, quotationNo: ${q.quotationNo}, companyId: ${q.companyId}, status: ${q.status}`);
    });
    mongoose.disconnect();
}
run().catch(console.error);
