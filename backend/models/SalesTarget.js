const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const SalesTargetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    period: {
        type: String,
        required: true,
        enum: ['monthly', 'quarterly', 'yearly']
    },

    periodLabel: { type: String, required: true }, // "Jun-2026", "Q1-2026", "2026-27"

    targetAmount: { type: Number, required: true, min: 0 },
    achievedAmount: { type: Number, default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

SalesTargetSchema.pre('save', function () {
    this.updatedAt = new Date();
});

SalesTargetSchema.index({ companyId: 1, userId: 1, period: 1, periodLabel: 1 }, { unique: true });
SalesTargetSchema.index({ companyId: 1, periodLabel: 1 });

SalesTargetSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SalesTarget', SalesTargetSchema);
