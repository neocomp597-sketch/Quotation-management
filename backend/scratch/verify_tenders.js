const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Tender = require('../models/Tender');
const User = require('../models/User');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');

const { createTender, getAllTenders, getTenderById, updateTender, getTenderDashboard } = require('../controllers/tenderController');
const { runWithTenant } = require('../middlewares/tenantContext');

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // Find a valid user and client/customer
        const testUser = await User.findOne({}).lean();
        const testCustomer = await Customer.findOne({}).lean();

        if (!testUser || !testCustomer) {
            console.error('Test user or customer not found in DB. Seeding may be incomplete.');
            process.exit(1);
        }

        const companyId = testUser.companyId;
        const userId = testUser._id;
        const customerId = testCustomer._id;

        console.log(`Using companyId: ${companyId}, userId: ${userId}, customerId: ${customerId} for testing.`);

        // Clean up any leftover test data
        await Tender.deleteMany({ title: 'MOCK TEST TENDER' });
        await Counter.deleteOne({ type: 'tender', companyId });

        // 1. Mock Request / Response for createTender
        let createdTenderId = null;
        await runWithTenant(companyId, async () => {
            const req = {
                user: { id: userId, name: testUser.name, companyId },
                body: {
                    title: 'MOCK TEST TENDER',
                    customerId,
                    value: 250000,
                    deadlineDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
                    status: 'Active',
                    description: 'This is a test tender description'
                }
            };
            const res = {
                status: function(code) {
                    this.statusCode = code;
                    return this;
                },
                json: function(data) {
                    this.data = data;
                    return this;
                }
            };

            await createTender(req, res);
            console.log('Tender Create Response Code:', res.statusCode);
            if (res.statusCode !== 251 && res.statusCode !== 201) {
                console.error('Create Tender Error Details:', res.data);
                throw new Error('Create Tender failed, expected code 201');
            }
            console.log('Tender Auto-Generated Number:', res.data.tenderNo);
            if (!res.data.tenderNo.startsWith('TND/')) {
                throw new Error('Tender Number did not auto-generate correctly');
            }
            createdTenderId = res.data._id;
            console.log('SUCCESS: Tender created with ID', createdTenderId);
        });

        // 2. Mock Request / Response for getAllTenders
        await runWithTenant(companyId, async () => {
            const req = {
                user: { id: userId, companyId },
                query: { search: 'MOCK' }
            };
            const res = {
                json: function(data) {
                    this.data = data;
                    return this;
                }
            };

            await getAllTenders(req, res);
            console.log('Tenders list count found with query "MOCK":', res.data.length);
            if (res.data.length === 0) {
                throw new Error('Expected to find the created mock tender by search');
            }
            console.log('SUCCESS: Tenders list fetched successfully.');
        });

        // 3. Mock Request / Response for updateTender (value & status change check)
        await runWithTenant(companyId, async () => {
            const req = {
                user: { id: userId, name: testUser.name, companyId },
                params: { id: createdTenderId },
                body: {
                    status: 'Submitted',
                    value: 300000
                }
            };
            const res = {
                json: function(data) {
                    this.data = data;
                    return this;
                }
            };

            await updateTender(req, res);
            console.log('Updated Tender Status:', res.data.status);
            console.log('Updated Tender Value:', res.data.value);
            console.log('Activities Log Count:', res.data.activities.length);

            if (res.data.status !== 'Submitted' || res.data.value !== 300000) {
                throw new Error('Update failed to apply new status/value');
            }

            // Check that the status change and value change logs were written to activities
            const hasStatusLog = res.data.activities.some(act => act.action.includes('Status changed from'));
            const hasValueLog = res.data.activities.some(act => act.action.includes('Value updated from'));

            if (!hasStatusLog || !hasValueLog) {
                throw new Error('Update activities logs were not written correctly');
            }
            console.log('SUCCESS: Tender updated and activities logged correctly.');
        });

        // 4. Mock Request / Response for getTenderDashboard
        await runWithTenant(companyId, async () => {
            const req = {
                user: { id: userId, companyId }
            };
            const res = {
                json: function(data) {
                    this.data = data;
                    return this;
                }
            };

            await getTenderDashboard(req, res);
            console.log('Dashboard KPIs:', res.data.kpis);
            console.log('Dashboard status distribution chart items count:', res.data.charts.statusDistribution.length);
            
            if (res.data.kpis.totalCount === 0 || res.data.kpis.totalValue === 0) {
                throw new Error('Dashboard stats returned empty/zero values');
            }
            console.log('SUCCESS: Dashboard aggregations computed correctly.');
        });

        // Clean up test data
        await Tender.deleteOne({ _id: createdTenderId });
        await Counter.deleteOne({ type: 'tender', companyId });
        console.log('Cleaned up mock data.');

        console.log('All Tender module tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Test verification failed:', error);
        process.exit(1);
    }
}

run();
