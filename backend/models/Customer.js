const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CustomerSchema = new mongoose.Schema({
    externalCode: { type: String, default: '', index: true },
        customerName: { type: String, required: true },
    companyName: { type: String, required: true },
    gstin: { type: String, default: '' },
    billingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
    },
    shippingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
    },
    mobile: String,
    email: String,
    logoUrl: String,
    defaultDiscount: Number,
    territory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory' },
    pan: { type: String, default: '' },
    outstanding: { type: Number, default: 0 },
    industry: { type: String, default: 'Other' },
    status: { type: String, default: 'Prospect' },
    segment: { type: String, default: 'Retail' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

CustomerSchema.index({ mobile: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ gstin: 1 });
CustomerSchema.index({ customerName: 1 });
CustomerSchema.index({ companyName: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ createdBy: 1, createdAt: -1 });
CustomerSchema.index({ companyId: 1, mobile: 1 });
CustomerSchema.index({ companyId: 1, email: 1 });
CustomerSchema.index({ territory: 1 });
CustomerSchema.index({ territory: 1, createdAt: -1 });
CustomerSchema.index({ owner: 1 });
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ segment: 1 });
CustomerSchema.index({ industry: 1 });
// A customer code identifies one customer in the whole company (every branch), ignoring case.
// Customers without a code are not affected. Queries that check a code must use the same
// collation (CUSTOMER_CODE_COLLATION) and look across branches.
const CUSTOMER_CODE_COLLATION = { locale: 'en', strength: 2 };
CustomerSchema.index(
    { companyId: 1, externalCode: 1 },
    {
        name: 'unique_customer_code_per_company',
        unique: true,
        partialFilterExpression: { externalCode: { $type: 'string', $gt: '' } },
        collation: CUSTOMER_CODE_COLLATION
    }
);

CustomerSchema.plugin(tenantPlugin);

const Customer = mongoose.model('Customer', CustomerSchema);
Customer.CUSTOMER_CODE_COLLATION = CUSTOMER_CODE_COLLATION;

// The index cannot be built while a company still has two customers with the same code; the app
// keeps working without it. scripts/checkCustomerCodeDuplicates.js lists them.
Customer.on('index', (error) => {
    if (error) {
        console.warn(error.code === 11000
            ? 'Customer code uniqueness is not enforced yet: some customers share a code. Run `node scripts/checkCustomerCodeDuplicates.js` to list them.'
            : `Customer indexes could not be built: ${error.message}`);
    }
});

module.exports = Customer;
