const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
require('../models/Customer');
require('../models/Site');
require('../models/Product');
require('../models/Vendor');
require('../models/Territory');
require('../models/TermsTemplate');
require('../models/User');
const Quotation = require('../models/Quotation');

async function run() {
    await connectDB();
    console.log("DB Connected");
    try {
        const id = '6a5675144c4edfc90c941c1d';
        const quotation = await Quotation.findById(id)
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email logoUrl defaultDiscount')
            .populate('siteId', 'siteName address')
            .populate('items.siteId', 'siteName address')
            .populate('items.productId', 'productName productCode hsnCode gstPercentage uom productImageUrl')
            .populate('items.vendorId', 'name')
            .populate('territory', 'name type')
            .populate('termsTemplateId', 'templateName content isDefault')
            .populate('createdBy', 'name email')
            .lean();
        console.log("Fetched quotation:", JSON.stringify(quotation, null, 2));
    } catch (err) {
        console.error("Error fetching quotation by ID:", err);
    }
    mongoose.disconnect();
}
run().catch(console.error);
