const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const BOMItemSchema = new mongoose.Schema({
    bomMasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'BOMMaster', required: true },
    lineNo: { type: Number, default: 0 },
    itemCode: { type: String, required: true, trim: true },
    // Product Master description when the item code is found, otherwise the description that was entered
    itemDescription: { type: String, trim: true, default: '' },
    enteredDescription: { type: String, trim: true, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    qty: { type: Number, required: true, min: 0 },
    componentSerialNumber: { type: String, trim: true, default: '' },
    batchNumber: { type: String, trim: true, default: '' },
    mgr1: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr2: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr3: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr4: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr5: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null }
}, { timestamps: true });

BOMItemSchema.index({ companyId: 1, bomMasterId: 1, lineNo: 1 });
BOMItemSchema.index({ companyId: 1, itemCode: 1 });

BOMItemSchema.plugin(tenantPlugin);

module.exports = mongoose.model('BOMItem', BOMItemSchema);
