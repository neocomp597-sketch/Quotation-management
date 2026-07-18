const mongoose = require('mongoose');

const EngineerSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile', default: null },
    name: { type: String, required: true },
    email: { type: String },
    mobile: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    territoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null },
    pincodes: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

EngineerSchema.index({ status: 1, name: 1 });

const tenantPlugin = require('./plugins/tenantPlugin');
EngineerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Engineer', EngineerSchema);
