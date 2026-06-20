const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DealSourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure deal source name is unique per tenant
DealSourceSchema.index({ companyId: 1, name: 1 }, { unique: true });
DealSourceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DealSource', DealSourceSchema);
