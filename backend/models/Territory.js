const mongoose = require('mongoose');

const TerritorySchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanySettings', index: true },
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['Country', 'Zone', 'State', 'City', 'Area', 'Custom', 'country', 'zone', 'state', 'city', 'area', 'custom'], 
        required: true 
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null, index: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    salesReps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rules: {
        cities: [{ type: String }],
        pincodes: [{ type: String }]
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

TerritorySchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('Territory', TerritorySchema);
