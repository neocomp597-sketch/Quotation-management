const mongoose = require('mongoose');

const AttributeSchema = new mongoose.Schema({
    mgr3Id: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR', required: true },
    code: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

// Combination of mgr3Id, code, and description should be unique
AttributeSchema.index({ mgr3Id: 1, code: 1, description: 1 }, { unique: true });

module.exports = mongoose.model('Attribute', AttributeSchema);
