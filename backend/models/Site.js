const mongoose = require('mongoose');

const SiteSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    siteName: { type: String, required: true },
    location: { type: String }, // For Google Maps place name/desc
    address: { type: String }, // Detailed address
    contactPerson: { type: String },
    mobile: { type: String },
    createdAt: { type: Date, default: Date.now },
});

const tenantPlugin = require('./plugins/tenantPlugin');
SiteSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Site', SiteSchema);
