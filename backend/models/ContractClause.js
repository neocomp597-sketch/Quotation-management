const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ContractClauseSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    content: { type: String, required: true }, // Clause text/HTML
    tags: [{ type: String, index: true }],
    isRequired: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ContractClauseSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ContractClauseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ContractClause', ContractClauseSchema);
