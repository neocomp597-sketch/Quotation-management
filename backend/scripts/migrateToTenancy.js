const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Company = require('../models/Company');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');

const tenantModels = [
    require('../models/Attribute'),
    require('../models/CompanySettings'),
    require('../models/Counter'),
    require('../models/Customer'),
    require('../models/Enquiry'),
    require('../models/MGR'),
    require('../models/Notification'),
    require('../models/Planning'),
    require('../models/Product'),
    require('../models/ProductAttribute'),
    require('../models/Quotation'),
    require('../models/QuotationDraft'),
    require('../models/RolePermission'),
    require('../models/Salesperson'),
    require('../models/Site'),
    require('../models/Status'),
    require('../models/TermsTemplate'),
    require('../models/Territory'),
    require('../models/Vendor'),
    require('../models/Voucher'),
];

const legacyUniqueIndexes = [
    [require('../models/Attribute'), 'mgr3Id_1_code_1_description_1'],
    [require('../models/Counter'), 'type_1_prefix_1_year_1'],
    [require('../models/Enquiry'), 'enquiryNo_1'],
    [require('../models/MGR'), 'mgrType_1_code_1'],
    [require('../models/Product'), 'productCode_1'],
    [require('../models/Quotation'), 'quotationNo_1'],
    [require('../models/RolePermission'), 'role_1'],
    [require('../models/Status'), 'name_1'],
    [require('../models/Voucher'), 'voucherNumber_1'],
    [CompanySettings, 'userId_1'],
];

const dropIndexIfExists = async (Model, indexName) => {
    try {
        await Model.collection.dropIndex(indexName);
        console.log(`Dropped legacy index ${Model.modelName}.${indexName}`);
    } catch (error) {
        if (error.codeName !== 'IndexNotFound' && error.code !== 27) {
            throw error;
        }
    }
};

const main = async () => {
    await connectDB();

    const existingSettings = await CompanySettings.findOne().setOptions({ bypassTenant: true }).lean();
    const companyName = process.env.DEFAULT_COMPANY_NAME
        || existingSettings?.companyName
        || 'Default Company';

    const company = await Company.findOneAndUpdate(
        { slug: companyName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') },
        { $setOnInsert: { name: companyName, isActive: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`Using company ${company.name} (${company._id})`);

    const users = await User.updateMany(
        { $or: [{ companyId: { $exists: false } }, { companyId: null }] },
        { $set: { companyId: company._id } }
    );
    console.log(`Backfilled users: ${users.modifiedCount}`);

    for (const Model of tenantModels) {
        const result = await Model.updateMany(
            { $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: { $ne: company._id } }] },
            { $set: { companyId: company._id } }
        ).setOptions({ bypassTenant: true });
        console.log(`Backfilled ${Model.modelName}: ${result.modifiedCount}`);
    }

    for (const [Model, indexName] of legacyUniqueIndexes) {
        await dropIndexIfExists(Model, indexName);
    }

    await Promise.all([
        ...tenantModels.map((Model) => Model.syncIndexes()),
        User.syncIndexes(),
        Company.syncIndexes(),
    ]);

    console.log('Tenancy migration complete');
    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
