const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Planning = require('../models/Planning');
const User = require('../models/User');

async function testUpdate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find an arbitrary planning entry
        const entry = await Planning.findOne();
        if (!entry) {
            console.log('No planning entries found');
            return;
        }

        console.log('Found planning entry:', entry);

        // Try to update it with the same values but running validators, just like the controller does
        const updateData = {
            monthYear: entry.monthYear,
            financialYear: entry.financialYear,
            customerId: entry.customerId,
            productId: entry.productId,
            productName: entry.productName,
            customerName: entry.customerName,
            qty: entry.qty,
            value: entry.value,
            mgrCode: entry.mgrCode,
            mgrCode2: entry.mgrCode2,
            status: entry.status,
            month: entry.month
        };

        console.log('Attempting findByIdAndUpdate...');
        const updated = await Planning.findByIdAndUpdate(entry._id, updateData, {
            new: true,
            runValidators: true
        });
        console.log('Update success!', updated);
    } catch (err) {
        console.error('Update failed with error:');
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

testUpdate();
