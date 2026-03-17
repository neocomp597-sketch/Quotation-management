const mongoose = require('mongoose');

const ProductAttributeSchema = new mongoose.Schema({
    productCode: { type: String, required: true },
    attributeCode: { type: String, required: true },
    attributeValue: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Index for faster lookups
ProductAttributeSchema.index({ productCode: 1, attributeCode: 1 });

module.exports = mongoose.model('ProductAttribute', ProductAttributeSchema, 'Product_Attribute');
