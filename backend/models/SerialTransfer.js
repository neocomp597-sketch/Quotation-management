const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

/**
 * Customer-wise ownership history of a sold serial number (Serial No Transfer).
 *
 * One record per customer who has held the serial: the original sale ("Sold") and every
 * later transfer ("Transferred"). Records are never edited or deleted; a transfer switches
 * the current record off (isActive false) and adds a new active one, so exactly one record
 * per serial is active and it names the current customer. The customer fields are a copy
 * taken at the time of the record, so the history still reads correctly if the customer
 * master is edited later.
 */
const SerialTransferSchema = new mongoose.Schema({
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    serialNumber: { type: String, required: true, trim: true },
    // Upper-cased serial number, for lookups and the one-active-record rule.
    serialKey: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productCode: { type: String, default: '' },
    productName: { type: String, default: '' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerCode: { type: String, default: '' },
    customerName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    customerMobile: { type: String, default: '' },
    customerGstin: { type: String, default: '' },
    customerCity: { type: String, default: '' },
    customerState: { type: String, default: '' },
    customerPincode: { type: String, default: '' },
    // Who held the serial before this record (blank on the original sale).
    previousCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    previousCustomerCode: { type: String, default: '' },
    previousCustomerName: { type: String, default: '' },
    entryType: { type: String, enum: ['Sold', 'Transferred'], required: true },
    transferDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    invoiceNumber: { type: String, default: '' },
    remarks: { type: String, trim: true, default: '' },
    // Set when this record stops being the current one.
    endedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
    // Sent by the transfer form with each save; a retried request finds its record instead of adding another.
    requestId: { type: String, default: undefined },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true }
}, { timestamps: true });

SerialTransferSchema.index({ companyId: 1, serialKey: 1, transferDate: 1, createdAt: 1 });
SerialTransferSchema.index({ companyId: 1, assetId: 1 });
SerialTransferSchema.index({ companyId: 1, createdAt: -1 });
// Only one current customer per serial number.
SerialTransferSchema.index(
    { companyId: 1, serialKey: 1 },
    { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_per_serial' }
);

SerialTransferSchema.index(
    { companyId: 1, requestId: 1 },
    { unique: true, partialFilterExpression: { requestId: { $type: 'string' } }, name: 'one_record_per_request' }
);

SerialTransferSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SerialTransfer', SerialTransferSchema);
