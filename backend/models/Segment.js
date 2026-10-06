const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// Segment Master: every segment belongs to one division. Segment codes are unique within
// the company, so an Excel row's Segment_Code identifies one segment and its division can
// be checked against the row's Division_Code. Company-wide (not branch scoped).
const SegmentSchema = new mongoose.Schema({
    divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

SegmentSchema.index({ companyId: 1, code: 1 }, { unique: true });

SegmentSchema.pre('save', function () {
    this.updatedAt = new Date();
});

SegmentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Segment', SegmentSchema);
