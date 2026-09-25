const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// One BOM per finished-good serial number. Components live in BOMItem.
const BOMMasterSchema = new mongoose.Schema({
    fgItemCode: { type: String, required: true, trim: true },
    fgItemDescription: { type: String, trim: true, default: '' },
    fgProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    fgSerialNumber: { type: String, required: true, trim: true },
    // Upper-cased serial used for lookups so "sn-01" and "SN-01" resolve to the same BOM
    fgSerialKey: { type: String, required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    componentCount: { type: Number, default: 0 },
    // Name of the workbook a bulk-uploaded BOM came from (blank for manual entry)
    sourceFileName: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

BOMMasterSchema.index({ companyId: 1, fgSerialKey: 1 }, { unique: true });
BOMMasterSchema.index({ companyId: 1, fgItemCode: 1 });
BOMMasterSchema.index({ companyId: 1, updatedAt: -1 });

BOMMasterSchema.plugin(tenantPlugin);

module.exports = mongoose.model('BOMMaster', BOMMasterSchema);
