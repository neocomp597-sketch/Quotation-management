const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const SlaEscalationUserSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    escalationAfterHours: { type: Number, required: true }
}, { _id: false });

const SlaPolicySchema = new mongoose.Schema({
    name: { type: String, required: true },
    priorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Priority', required: true },
    responseTimeHours: { type: Number, required: true },
    resolutionTimeHours: { type: Number, required: true },
    escalationUsers: { type: [SlaEscalationUserSchema], default: [] },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

SlaPolicySchema.plugin(tenantPlugin);

module.exports = mongoose.model('SlaPolicy', SlaPolicySchema);
