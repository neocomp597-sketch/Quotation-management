const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const DealSource = require('../models/DealSource');
const User = require('../models/User');
const { runWithTenant } = require('../middlewares/tenantContext');

async function debugSources() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to MongoDB');

        // Let's find a user to see what companyId they have
        const user = await User.findOne({ role: 'admin' }).lean();
        if (!user) {
            console.log('No admin user found to test with.');
            return;
        }

        console.log('Testing with User:', { name: user.name, email: user.email, role: user.role, companyId: user.companyId });
        const companyId = user.companyId ? user.companyId.toString() : null;

        if (!companyId) {
            console.log('WARNING: User has no companyId!');
        }

        // Test running getSources equivalent
        await runWithTenant(companyId, async () => {
            console.log('Running getSources in tenant context...');
            try {
                let sources = await DealSource.find({ isActive: true }).sort({ name: 1 }).lean();
                console.log(`Found ${sources.length} sources in DB.`);
                if (sources.length === 0) {
                    console.log('Attempting to seed default sources...');
                    const defaults = [
                        { name: 'Website' },
                        { name: 'Referral' },
                        { name: 'Email Campaign' },
                        { name: 'Cold Call' },
                        { name: 'Social Media' },
                        { name: 'Trade Show' },
                        { name: 'Partner' },
                        { name: 'Other' }
                    ];
                    await DealSource.insertMany(defaults);
                    sources = await DealSource.find({ isActive: true }).sort({ name: 1 }).lean();
                    console.log(`Seeded and found ${sources.length} sources.`);
                } else {
                    console.log('Sources list:', sources);
                }
            } catch (err) {
                console.error('getSources query failed:', err);
            }

            console.log('Running createSource in tenant context...');
            try {
                const newName = 'Test Source ' + Date.now();
                const existing = await DealSource.findOne({ name: { $regex: new RegExp(`^${newName.trim()}$`, 'i') } }).lean();
                if (existing) {
                    console.log('Source already exists:', existing);
                } else {
                    const source = await DealSource.create({ name: newName });
                    console.log('Source created successfully:', source);
                }
            } catch (err) {
                console.error('createSource failed:', err);
            }
        });

    } catch (err) {
        console.error('Database connection failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

debugSources();
