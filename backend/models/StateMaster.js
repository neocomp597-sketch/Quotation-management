const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StateMasterSchema = new mongoose.Schema({
    country: { type: String, default: 'India', trim: true },
    state: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, trim: true, uppercase: true },
    gstCode: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

StateMasterSchema.pre('save', function() {
    this.updatedAt = new Date();
});

StateMasterSchema.plugin(tenantPlugin);

module.exports = mongoose.model('StateMaster', StateMasterSchema);
