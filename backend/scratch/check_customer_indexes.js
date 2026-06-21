const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Customer = require('../models/Customer');
const { runWithTenant } = require('../middlewares/tenantContext');

async function run() {
    try {
        console.log('Connecting to MONGO_URI:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');
        
        await runWithTenant(undefined, async () => {
            try {
                const newCustomer = new Customer({
                    customerName: 'Test Customer SuperAdmin',
                    companyName: 'SuperAdmin Co',
                    mobile: '1234567890',
                    email: 'superadmin_test@test.com'
                });
                
                await newCustomer.save();
                console.log('Successfully saved!');
                // Cleanup
                await Customer.deleteOne({ _id: newCustomer._id });
            } catch (saveErr) {
                console.error('Save failed with error:', saveErr.message);
                console.error(saveErr);
            }
        }, { bypassTenant: true });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

run();
