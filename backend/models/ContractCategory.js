const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ContractCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
});

ContractCategorySchema.plugin(tenantPlugin);

module.exports = mongoose.model('ContractCategory', ContractCategorySchema);
