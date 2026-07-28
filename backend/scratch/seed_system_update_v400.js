const mongoose = require('mongoose');
const SystemUpdate = require('../models/SystemUpdate');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotations';

async function seedV400Update() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        const doc = await SystemUpdate.findOneAndUpdate(
            { version: "v4.0.0-emp-service-enhancements" },
            {
                version: "v4.0.0-emp-service-enhancements",
                title: "Auto User Account Creation, Employee Reporting To & Partial Serial No. Search",
                message: "We have implemented auto user account creation on employee addition, 'Reporting To' supervisor selection in Employee Master, and partial serial number search with auto-fill in the Service Module.",
                releaseNotes: [
                    "Auto User Account Creation: Adding a new employee in Employee Master automatically creates a User account using their Email ID as Login ID and '123456' as default password.",
                    "First Login Password Enforcement: New user accounts created with default password '123456' are prompted to update their password upon first login.",
                    "Reporting To Field in Employee Master: Added a 'Reporting To' supervisor dropdown in Basic Info between Employee Name and Email Address, listing active employees excluding self.",
                    "Partial Serial No. Search: Service Ticket registration now supports partial serial number search (e.g. typing '1002' displays matching serial numbers like CE1002, JH1002, FV1002).",
                    "Auto-Fill Ticket Information: Selecting a Serial No from the search dropdown automatically populates Customer Name, Linked Invoice, Pincode, Linked Product, and Contact details."
                ],
                detailedChanges: [
                    { date: "2026-07-23", module: "Payroll & HR", submodule: "Employee Master", changes: "Added Auto User Account creation with default password 123456 and Reporting To supervisor dropdown field." },
                    { date: "2026-07-23", module: "Authentication", submodule: "User Login & Password", changes: "Enforced first login password change modal for accounts with default password." },
                    { date: "2026-07-23", module: "CSM Support", submodule: "Ticket Registration", changes: "Implemented partial serial number search with auto-completion and full ticket details auto-fill." }
                ],
                deployedBy: "Super Admin",
                deployedAt: new Date(),
                isActive: true
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        console.log('✅ Successfully seeded SystemUpdate v4.0.0:', doc.title);
    } catch (err) {
        console.error('❌ Failed to seed SystemUpdate:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seedV400Update();
