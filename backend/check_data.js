const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Product = require('./models/Product');
const Enquiry = require('./models/Enquiry');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        
        // Find products with extremely large base prices or weird values
        const expensiveProducts = await Product.find({ basePrice: { $gt: 1000000 } });
        console.log("Expensive Products Count:", expensiveProducts.length);
        if (expensiveProducts.length > 0) {
            console.log("Sample Expensive Products:", expensiveProducts.slice(0, 5).map(p => ({
                code: p.productCode,
                name: p.productName,
                price: p.basePrice
            })));
        }

        // Find recent enquiries
        const recentEnquiries = await Enquiry.find().sort({ createdAt: -1 }).limit(5);
        console.log("Recent Enquiries:", recentEnquiries.map(e => ({
            id: e._id,
            no: e.enquiryNo,
            subtotal: e.subtotal,
            grandTotal: e.grandTotal,
            itemsCount: e.items?.length
        })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
