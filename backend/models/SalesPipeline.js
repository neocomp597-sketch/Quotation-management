const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    probability: { type: Number, required: true, min: 0, max: 100 },
    color: { type: String, default: '#3b82f6' },
    sortOrder: { type: Number, required: true }
}, { _id: true });

const SalesPipelineSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    stages: { type: [StageSchema], required: true, validate: v => v.length > 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

SalesPipelineSchema.pre('save', function () {
    this.updatedAt = new Date();
});

SalesPipelineSchema.index({ companyId: 1, name: 1 }, { unique: true });
SalesPipelineSchema.index({ companyId: 1, isDefault: 1 });

SalesPipelineSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SalesPipeline', SalesPipelineSchema);
