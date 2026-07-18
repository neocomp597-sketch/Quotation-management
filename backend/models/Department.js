const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DepartmentSchema = new mongoose.Schema({
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

// Ensure department name is unique per tenant
DepartmentSchema.index({ companyId: 1, name: 1 }, { unique: true });
DepartmentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Department', DepartmentSchema);
