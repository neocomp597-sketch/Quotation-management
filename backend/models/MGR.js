const mongoose = require('mongoose');

const MGRSchema = new mongoose.Schema({
    mgrType: { type: String, enum: ['MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5'], required: true },
    code: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

// Since the combination of type and code should likely be unique
MGRSchema.index({ mgrType: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('MGR', MGRSchema);
