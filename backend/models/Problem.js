const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ProblemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    mgr4Category: { type: String, default: '' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketCategory' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

ProblemSchema.index({ companyId: 1, mgr4Category: 1 });
ProblemSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Problem', ProblemSchema);
