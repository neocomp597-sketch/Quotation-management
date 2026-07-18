const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DealActivitySchema = new mongoose.Schema({
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },

    type: {
        type: String,
        required: true,
        enum: ['Call', 'Email', 'Meeting', 'WhatsApp', 'Task', 'Note']
    },

    description: { type: String, required: true, trim: true },

    activityDate: { type: Date, default: Date.now },

    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    createdAt: { type: Date, default: Date.now }
});

DealActivitySchema.index({ companyId: 1, dealId: 1, activityDate: -1 });
DealActivitySchema.index({ companyId: 1, performedBy: 1 });
DealActivitySchema.index({ companyId: 1, type: 1 });
DealActivitySchema.index({ companyId: 1, activityDate: -1 });

DealActivitySchema.plugin(tenantPlugin);

module.exports = mongoose.model('DealActivity', DealActivitySchema);
