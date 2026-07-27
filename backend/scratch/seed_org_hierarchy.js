const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const EmployeeProfile = require('../models/EmployeeProfile');

async function seedOrgHierarchy() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tally-quotations');
        console.log('Connected to DB');

        const employees = await EmployeeProfile.find({}).lean();
        console.log(`Found ${employees.length} employees`);

        if (employees.length === 0) {
            console.log('No employees found.');
            process.exit(0);
        }

        // 1. Pick or create CEO (e.g. Manoj Singh or Tim Cook style CEO)
        let ceo = employees.find(e => (e.designation || '').toLowerCase().includes('ceo') || (e.name || '').toLowerCase().includes('manoj')) || employees[0];
        
        await EmployeeProfile.findByIdAndUpdate(ceo._id, {
            designation: 'CEO / Managing Director',
            department: 'Executive Board',
            reportingTo: null
        });
        console.log(`CEO set to: ${ceo.name}`);

        // 2. Set Direct Reports (HODs / VPs) under CEO
        const remaining = employees.filter(e => String(e._id) !== String(ceo._id));
        
        if (remaining.length > 0) {
            // First 2-3 report to CEO
            const level1Emps = remaining.slice(0, Math.min(3, remaining.length));
            const level2Emps = remaining.slice(3);

            for (let i = 0; i < level1Emps.length; i++) {
                const emp = level1Emps[i];
                const depts = ['Sales & Operations', 'Engineering & Tech', 'HR & Administration'];
                const desigs = ['Vice President - Sales', 'Chief Technology Officer', 'Head of Operations'];
                await EmployeeProfile.findByIdAndUpdate(emp._id, {
                    reportingTo: ceo._id,
                    department: depts[i % depts.length],
                    designation: desigs[i % desigs.length]
                });
                console.log(`Set ${emp.name} -> reports to ${ceo.name} (${desigs[i % desigs.length]})`);
            }

            // Next employees report under the level 1 managers to form vertical stacks!
            for (let i = 0; i < level2Emps.length; i++) {
                const emp = level2Emps[i];
                const manager = level1Emps[i % level1Emps.length];
                await EmployeeProfile.findByIdAndUpdate(emp._id, {
                    reportingTo: manager._id,
                    department: manager.department,
                    designation: 'Senior Executive'
                });
                console.log(`Set ${emp.name} -> reports to ${manager.name}`);
            }
        }

        console.log('Org Hierarchy successfully seeded!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding org hierarchy:', err);
        process.exit(1);
    }
}

seedOrgHierarchy();
