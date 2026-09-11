const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Customer = require('../models/Customer');
const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');

async function run() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            console.error('No MONGO_URI found');
            process.exit(1);
        }
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        // Find customer rohit shirsagar or TEST102
        const customers = await Customer.find({
            $or: [
                { companyName: /rohit/i },
                { customerName: /rohit/i },
                { customerName: /TEST102/i },
                { externalCode: /TEST102/i }
            ]
        });

        console.log('Found Customers:', customers.map(c => ({
            id: c._id,
            externalCode: c.externalCode,
            customerName: c.customerName,
            companyName: c.companyName
        })));

        for (const cust of customers) {
            // Fix externalCode if missing or set in customerName
            let newCode = cust.externalCode || '';
            let newCustName = cust.customerName;

            if (cust.customerName === 'TEST102' || !newCode) {
                newCode = 'TEST102';
                newCustName = cust.companyName || 'rohit shirsagar';
            }

            cust.externalCode = newCode;
            cust.customerName = newCustName;
            await cust.save();
            console.log(`Updated Customer ${cust._id}: externalCode="${cust.externalCode}", customerName="${cust.customerName}"`);

            // Update matching Assets
            const assetRes = await Asset.updateMany(
                { customerId: cust._id },
                { $set: { customerCode: newCode } }
            );
            console.log(`Updated ${assetRes.modifiedCount} Assets for Customer ${cust._id}`);

            // Update matching AssetHistories
            const histRes = await AssetHistory.updateMany(
                { customerId: cust._id },
                { $set: { customerCode: newCode } }
            );
            console.log(`Updated ${histRes.modifiedCount} AssetHistories for Customer ${cust._id}`);
        }

        // Also fix any assets directly having customerNameStr rohit shirsagar
        const directAssets = await Asset.find({
            $or: [
                { customerNameStr: /rohit/i },
                { serialNumber: '1234Test' }
            ]
        });
        console.log('Direct Assets found:', directAssets.map(a => ({
            id: a._id,
            serialNumber: a.serialNumber,
            customerCode: a.customerCode,
            customerNameStr: a.customerNameStr,
            customerId: a.customerId
        })));

        for (const a of directAssets) {
            if (a.customerId) {
                const c = await Customer.findById(a.customerId);
                if (c && c.externalCode) {
                    a.customerCode = c.externalCode;
                    await a.save();
                    console.log(`Updated Asset ${a.serialNumber} customerCode to ${c.externalCode}`);
                }
            } else if (!a.customerCode || a.customerCode.toLowerCase().includes('rohit')) {
                a.customerCode = 'TEST102';
                await a.save();
                console.log(`Updated Asset ${a.serialNumber} customerCode to TEST102`);
            }
        }

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
