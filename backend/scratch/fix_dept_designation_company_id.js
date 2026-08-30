require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');

async function fixCompanyIds() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        console.log('[CompanyId Fix] Connected to DB');

        const superUser = await User.findOne({ email: 'super@gmail.com' });
        let companyId = superUser?.companyId;
        if (!companyId) {
            const company = await CompanySettings.findOne({});
            companyId = company?._id;
        }

        console.log('[CompanyId Fix] Using companyId:', companyId);

        const deptResult = await Department.updateMany(
            { companyId: { $exists: false } },
            { $set: { companyId } }
        );
        console.log(`[CompanyId Fix] Departments updated: ${deptResult.modifiedCount}`);

        const desResult = await Designation.updateMany(
            { companyId: { $exists: false } },
            { $set: { companyId } }
        );
        console.log(`[CompanyId Fix] Designations updated: ${desResult.modifiedCount}`);

        return {
            departmentsUpdated: deptResult.modifiedCount,
            designationsUpdated: desResult.modifiedCount
        };
    } catch (err) {
        console.error('[CompanyId Fix Error]:', err);
    }
}

module.exports = fixCompanyIds;

if (require.main === module) {
    fixCompanyIds().then(() => process.exit(0));
}
