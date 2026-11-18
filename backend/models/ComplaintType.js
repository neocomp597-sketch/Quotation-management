const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

/**
 * Type of Complaint and the Details of Complaint under it (CSM Config > Complaint Types), offered
 * as two linked dropdowns when a ticket is raised. A ticket keeps its own copy of the two texts, so
 * renaming or removing an entry here leaves earlier tickets as they were.
 */
const ComplaintTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    // The name in lower case: one entry per name in a company, however it is typed.
    nameKey: { type: String, required: true },
    details: [{ type: String, trim: true }],
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

ComplaintTypeSchema.plugin(tenantPlugin);
ComplaintTypeSchema.index({ companyId: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.model('ComplaintType', ComplaintTypeSchema);
