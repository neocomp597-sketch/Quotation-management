const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const GeneratedDocumentSchema = new mongoose.Schema({
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractTemplate', required: true, index: true },
    htmlSnapshot: { type: String, required: true }, // Complete compiled HTML with merged data
    pdfUrl: { type: String, default: '' }, // Local path or S3 URL
    version: { type: Number, default: 1 },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

GeneratedDocumentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('GeneratedDocument', GeneratedDocumentSchema);
