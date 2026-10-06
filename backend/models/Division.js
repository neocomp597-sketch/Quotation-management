const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// Division Master: the top level of Division -> Segment. Records reference a division by
// id; the code is what Excel templates and exports carry. Company-wide (not branch scoped).
const DivisionSchema = new mongoose.Schema({
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

DivisionSchema.index({ companyId: 1, code: 1 }, { unique: true });

DivisionSchema.pre('save', function () {
    this.updatedAt = new Date();
});

DivisionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Division', DivisionSchema);
