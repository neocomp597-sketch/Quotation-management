const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

/**
 * A serial number moved from one branch to another (Serial No Transfer > Branch Transfer).
 *
 * One record per serial per transfer; the serials moved together share a transferNo. Records
 * are never edited or deleted, so they are the complete branch history of a serial. Branch and
 * product names are copied at the time of the transfer, so the history still reads correctly
 * if a master is renamed later. `status` is the serial's Invoice Bulk Upload status when it was
 * moved; a branch transfer never changes it.
 *
 * There is deliberately no `branchId`: tenantPlugin would then show a transfer in one branch
 * only, while it belongs to both. Who may see which transfers is decided in the controller
 * (see utils/serialBranchAccess.js).
 */
const SerialBranchTransferSchema = new mongoose.Schema({
    transferNo: { type: String, required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    serialNumber: { type: String, required: true, trim: true },
    serialKey: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productCode: { type: String, default: '' },
    productName: { type: String, default: '' },
    status: { type: String, default: '' },
    fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    fromBranchName: { type: String, default: '' },
    toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    toBranchName: { type: String, default: '' },
    transferDate: { type: Date, required: true },
    reference: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
    // Sent by the form with each save; a retried request finds its records instead of moving again.
    requestId: { type: String, default: undefined }
}, { timestamps: true });

SerialBranchTransferSchema.index({ companyId: 1, transferDate: -1, _id: -1 });
SerialBranchTransferSchema.index({ companyId: 1, assetId: 1, transferDate: 1 });
SerialBranchTransferSchema.index({ companyId: 1, transferNo: 1 });
SerialBranchTransferSchema.index({ companyId: 1, fromBranchId: 1, transferDate: -1 });
SerialBranchTransferSchema.index({ companyId: 1, toBranchId: 1, transferDate: -1 });
SerialBranchTransferSchema.index(
    { companyId: 1, requestId: 1, assetId: 1 },
    { unique: true, partialFilterExpression: { requestId: { $type: 'string' } }, name: 'one_move_per_request' }
);

SerialBranchTransferSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SerialBranchTransfer', SerialBranchTransferSchema);
