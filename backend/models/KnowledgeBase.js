const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const KnowledgeBaseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    content: { type: String, required: true },
    views: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

KnowledgeBaseSchema.index({ category: 1 });
KnowledgeBaseSchema.index({ title: 'text', content: 'text' });
// Branch that owns this record; filled from the active branch on create and used for branch scoping (see tenantPlugin).
KnowledgeBaseSchema.add({ branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true } });
KnowledgeBaseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('KnowledgeBase', KnowledgeBaseSchema);
