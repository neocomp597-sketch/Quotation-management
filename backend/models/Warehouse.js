const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const BinSchema = new mongoose.Schema({
    binCode: { type: String, required: true, trim: true },
    rack: { type: String, default: '', trim: true },
    aisle: { type: String, default: '', trim: true },
    capacity: { type: Number, default: 0 }
}, { _id: true });

const WarehouseSchema = new mongoose.Schema({
    warehouseCode: { type: String, required: true, trim: true },
    warehouseName: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['Main Warehouse', 'Regional Depot', 'Retail Store', 'Transit Location', 'Virtual Drop-Ship'],
        default: 'Main Warehouse'
    },
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        country: { type: String, default: 'India' }
    },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bins: [BinSchema],
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

WarehouseSchema.index({ companyId: 1, warehouseCode: 1 }, { unique: true });
WarehouseSchema.plugin(tenantPlugin);

WarehouseSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Warehouse', WarehouseSchema);
