const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const VersionSchema = new mongoose.Schema({
    versionId: { type: String, required: true },
    versionNumber: { type: Number, required: true },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    rawSteps: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const FlowchartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true },
    rawSteps: { type: String, default: '' },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    status: { type: String, enum: ['Draft', 'Published', 'Archived'], default: 'Draft' },
    isDeleted: { type: Boolean, default: false },
    lastOpenedAt: { type: Date, default: Date.now },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    thumbnail: { type: String, default: '' },
    versions: [VersionSchema]
}, { timestamps: true });

FlowchartSchema.plugin(tenantPlugin, { required: false });

module.exports = mongoose.model('Flowchart', FlowchartSchema);
