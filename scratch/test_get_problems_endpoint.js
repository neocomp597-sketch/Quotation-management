const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/tally/Quotations/backend/.env' });

const Product = require('../backend/models/Product');
const MGR = require('../backend/models/MGR');
const Problem = require('../backend/models/Problem');

async function test() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tally_quotations';
        await mongoose.connect(mongoUri);
        console.log('Connected to Mongo DB');

        const prods = await Product.find({}).populate('mgr1 mgr2 mgr3 mgr4 mgr5').lean();
        console.log(`Found ${prods.length} products`);
        prods.forEach(p => {
            console.log(`Product: "${p.productName}", Code: "${p.productCode}", MGR4:`, p.mgr4);
        });

        const mgrs = await MGR.find({ mgrType: 'MGR4' }).lean();
        console.log(`Found ${mgrs.length} MGR4 items:`);
        mgrs.forEach(m => {
            console.log(`MGR4 Code: "${m.code}", Desc: "${m.description}", ProblemList:`, m.problemList);
        });

        const problems = await Problem.find({}).lean();
        console.log(`Found ${problems.length} Problem documents in Problem collection:`);
        problems.forEach(pr => {
            console.log(`Problem: "${pr.name}", mgr4Cat: "${pr.mgr4Category}", productId: "${pr.productId}"`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error('Test error:', err);
    }
}

test();
