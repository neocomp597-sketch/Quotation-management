const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DesignationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
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

// Ensure designation name is unique per tenant
DesignationSchema.index({ companyId: 1, name: 1 }, { unique: true });
DesignationSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Designation', DesignationSchema);
