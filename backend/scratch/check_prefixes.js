const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Quotation = require('./models/Quotation');
const CompanySettings = require('./models/CompanySettings');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Count CTN quotations
        const ctnCount = await Quotation.countDocuments({ quotationNo: /^CTN/ });
        console.log(`Found ${ctnCount} quotations starting with CTN`);
        
        // Count JAG quotations (from previous task)
        const jagCount = await Quotation.countDocuments({ quotationNo: /^JAG/ });
        console.log(`Found ${jagCount} quotations starting with JAG`);

        // Check company settings
        const settings = await CompanySettings.find({});
        settings.forEach(s => {
            console.log(`User: ${s.userId}, Prefix: ${s.quotationPrefix}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
