const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ProductAttributeSchema = new mongoose.Schema({
    productCode: { type: String, required: true },
    attributeCode: { type: String, required: true },
    attributeValue: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Index for faster lookups
ProductAttributeSchema.index({ companyId: 1, productCode: 1, attributeCode: 1 });

ProductAttributeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ProductAttribute', ProductAttributeSchema, 'Product_Attribute');
