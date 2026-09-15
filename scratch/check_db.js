const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');

async function testConnection() {
    console.log('Connecting to:', process.env.MONGO_URI);
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000
        });
        console.log('Connected successfully!');

        const db = mongoose.connection.db;

        // List collections
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        // 1. Inspect mgrs collection
        const mgrs = await db.collection('mgrs').find({ mgrType: 'MGR4' }).toArray();
        console.log('\n--- MGR4 COLLECTION (count: ' + mgrs.length + ') ---');
        console.log(JSON.stringify(mgrs, null, 2));

        // Also check all MGRs with problemList
        const mgrsWithProblems = await db.collection('mgrs').find({ problemList: { $exists: true, $not: { $size: 0 } } }).toArray();
        console.log('\n--- ALL MGRs WITH PROBLEMS (count: ' + mgrsWithProblems.length + ') ---');
        console.log(JSON.stringify(mgrsWithProblems, null, 2));

        // 2. Inspect products collection
        const products = await db.collection('products').find({}).toArray();
        console.log('\n--- PRODUCTS COLLECTION (count: ' + products.length + ') ---');
        console.log(JSON.stringify(products.map(p => ({
            _id: p._id,
            productCode: p.productCode,
            productName: p.productName,
            mgr4: p.mgr4
        })), null, 2));

        // 3. Inspect problems collection
        const problems = await db.collection('problems').find({}).toArray();
        console.log('\n--- PROBLEMS COLLECTION (count: ' + problems.length + ') ---');
        console.log(JSON.stringify(problems, null, 2));

        // 4. Inspect assets collection
        const assets = await db.collection('assets').find({}).toArray();
        console.log('\n--- ASSETS COLLECTION (count: ' + assets.length + ') ---');
        console.log(JSON.stringify(assets.map(a => ({
            _id: a._id,
            serialNumber: a.serialNumber,
            productName: a.productName,
            productId: a.productId,
            mgr4: a.mgr4
        })), null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testConnection();
