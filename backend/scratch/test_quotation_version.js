const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm_db';

const Quotation = require('../models/Quotation');
const QuotationVersion = require('../models/QuotationVersion');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const quotationController = require('../controllers/quotationController');

async function testQuotationSave() {
    console.log('--- Testing Quotation Save / Update ---');
    await mongoose.connect(MONGO_URI);

    const quote = await Quotation.findOne({}).lean();
    if (!quote) {
        console.log('No quotation found in DB to test.');
        await mongoose.disconnect();
        return;
    }

    console.log('Found quote ID:', quote._id);

    let statusCode = 200;
    let resData = null;
    const req = {
        params: { id: quote._id.toString() },
        body: {
            customerId: quote.customerId.toString(),
            status: quote.status || 'draft',
            items: quote.items || []
        },
        user: { id: 'test_user', companyId: quote.companyId ? quote.companyId.toString() : null }
    };

    const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { resData = data; return res; }
    };

    await quotationController.updateQuotation(req, res);
    console.log('Response Status:', statusCode);
    if (statusCode >= 400) {
        console.error('Error Response:', resData);
        throw new Error(`Quotation update failed with status ${statusCode}`);
    } else {
        console.log('✅ PASS: Quotation updated successfully without QuotationVersion error!');
    }

    await mongoose.disconnect();
}

testQuotationSave().catch(err => {
    console.error('❌ Test failed:', err);
    mongoose.disconnect();
    process.exit(1);
});
