const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const FooterPageSchema = new mongoose.Schema({
    slug: { type: String, required: true },
    label: { type: String, required: true },
    content: { type: String, default: '' }
}, {
    timestamps: true
});

FooterPageSchema.plugin(tenantPlugin);
FooterPageSchema.index({ companyId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('FooterPage', FooterPageSchema);
