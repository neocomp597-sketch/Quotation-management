const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const OptionItemSchema = new mongoose.Schema({
    label: { type: String, required: true },
    priceModifier: { type: Number, default: 0 }, // Positive or negative flat adjustments
    costModifier: { type: Number, default: 0 }
}, { _id: false });

const OptionGroupSchema = new mongoose.Schema({
    groupName: { type: String, required: true }, // e.g. 'Support Tier', 'Storage Limit'
    type: { type: String, enum: ['Select', 'Number', 'Boolean'], default: 'Select' },
    options: [OptionItemSchema]
}, { _id: false });

const ProductConfigTemplateSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
    optionGroups: [OptionGroupSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ProductConfigTemplateSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ProductConfigTemplateSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ProductConfigTemplate', ProductConfigTemplateSchema);
