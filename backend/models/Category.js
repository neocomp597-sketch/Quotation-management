const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

CategorySchema.plugin(tenantPlugin);

module.exports = mongoose.model('Category', CategorySchema);
