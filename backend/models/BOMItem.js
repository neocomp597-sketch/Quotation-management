const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const BOMItemSchema = new mongoose.Schema({
    bomMasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'BOMMaster', required: true },
    // Sibling sequence of this line inside its BOM: 1, 2, 3... The displayed number (1.3.2) is
    // built from these along the path, by services/bomLineService. Assigned only by the backend;
    // kept when other lines are added or removed, and unique within the BOM.
    lineNo: {
        type: Number,
        required: true,
        min: 1,
        validate: { validator: Number.isInteger, message: 'Line number must be a whole number.' }
    },
    itemCode: { type: String, required: true, trim: true },
    // Product Master description when the item code is found, otherwise the description that was entered
    itemDescription: { type: String, trim: true, default: '' },
    enteredDescription: { type: String, trim: true, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    // Unit of measure as given on the BOM sheet (NOS, KGS, MTR...); Product Master UOM is the fallback.
    uom: { type: String, trim: true, default: '' },
    qty: { type: Number, required: true, min: 0 },
    componentSerialNumber: { type: String, trim: true, default: '' },
    batchNumber: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    // Drawing and revision numbers from the SAP BOM Costing Report.
    drawingNo: { type: String, trim: true, default: '' },
    revisionNo: { type: String, trim: true, default: '' },
    mgr1: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr2: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr3: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr4: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null },
    mgr5: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', default: null }
}, { timestamps: true });

BOMItemSchema.index({ companyId: 1, bomMasterId: 1, lineNo: 1 });
// No two lines of one BOM share a number, whatever the screens or concurrent requests do.
BOMItemSchema.index({ bomMasterId: 1, lineNo: 1 }, { unique: true, name: 'bom_line_number_unique' });
BOMItemSchema.index({ companyId: 1, itemCode: 1 });

BOMItemSchema.plugin(tenantPlugin);

module.exports = mongoose.model('BOMItem', BOMItemSchema);
