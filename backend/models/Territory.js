const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const TerritorySchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['Country', 'Zone', 'State', 'City', 'Area', 'Custom', 'country', 'zone', 'state', 'city', 'area', 'custom'], 
        required: true 
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null, index: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mgr1: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr2: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr3: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr4: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr5: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    salesReps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    engineerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Engineer', default: null },
    rules: {
        cities: [{ type: String }],
        pincodes: [{ type: String }]
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

TerritorySchema.index({ companyId: 1, name: 1 });

TerritorySchema.plugin(tenantPlugin);

module.exports = mongoose.model('Territory', TerritorySchema);
