const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const Quotation = require('./backend/models/Quotation');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const quotations = await Quotation.find({}, { quotationNo: 1, createdAt: 1 }).sort({ quotationNo: 1 });
        console.log("Quotations in DB:");
        quotations.forEach(q => {
            console.log(`- ${q.quotationNo} (Created: ${q.createdAt})`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
