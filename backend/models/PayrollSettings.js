const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PayrollSettingsSchema = new mongoose.Schema({
    currentMonth: { type: String, default: '' }, // e.g. "2026-06"
    calculationType: { type: String, enum: ['fixed', 'manual'], default: 'fixed' },
    pfEnabled: { type: Boolean, default: true },
    esiEnabled: { type: Boolean, default: true },
    ptEnabled: { type: Boolean, default: true },
    tdsEnabled: { type: Boolean, default: true },
    payslipFormat: { type: String, enum: ['format1', 'format2'], default: 'format1' },
    lockDate: { type: Number, default: 25 }, // Day of the month
    companySealUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' }
}, { timestamps: true });

PayrollSettingsSchema.plugin(tenantPlugin);
module.exports = mongoose.model('PayrollSettings', PayrollSettingsSchema);
