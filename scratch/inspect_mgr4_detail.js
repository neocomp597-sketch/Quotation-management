const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');

async function inspectMGR4() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const mgr4s = await db.collection('mgrs').find({ mgrType: 'MGR4' }).toArray();
    console.log('=== MGR4 RECORDS ===');
    console.log(JSON.stringify(mgr4s, null, 2));

    const problems = await db.collection('problems').find({}).toArray();
    console.log('\n=== PROBLEMS RECORDS ===');
    console.log(JSON.stringify(problems, null, 2));

    const product = await db.collection('products').findOne({ _id: new mongoose.Types.ObjectId('6aa84031913fb85df081ba7e') });
    console.log('\n=== TARGET PRODUCT (water purifier with RO + UV 12) ===');
    console.log(JSON.stringify(product, null, 2));

    await mongoose.disconnect();
}

inspectMGR4().catch(console.error);
