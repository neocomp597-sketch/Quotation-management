const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PrioritySchema = new mongoose.Schema({
    name: { type: String, required: true },
    responseSlaHours: { type: Number, required: true },
    resolutionSlaHours: { type: Number, required: true },
    color: { type: String, default: '#64748b' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

PrioritySchema.plugin(tenantPlugin);

module.exports = mongoose.model('Priority', PrioritySchema);
