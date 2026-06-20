const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const AssetSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    serialNumber: { type: String, required: true },
    installationDate: { type: Date, default: Date.now },
    location: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

AssetSchema.index({ customerId: 1, serialNumber: 1 });
AssetSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Asset', AssetSchema);
