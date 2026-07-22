const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const QuotationVersionSchema = new mongoose.Schema({
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
    versionNumber: { type: Number, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changeSummary: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

QuotationVersionSchema.index({ quotationId: 1, versionNumber: -1 }, { unique: true });

QuotationVersionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('QuotationVersion', QuotationVersionSchema);
