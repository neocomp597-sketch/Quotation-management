const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CityMasterSchema = new mongoose.Schema({
    country: { type: String, default: 'India', trim: true },
    state: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    area: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    pincode: { 
        type: String, 
        required: true, 
        trim: true,
        validate: {
            validator: function(v) {
                return /^\d{6}$/.test(v);
            },
            message: 'Pincode must be a 6-digit numeric value'
        }
    },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

CityMasterSchema.pre('save', function() {
    this.updatedAt = new Date();
});

CityMasterSchema.index({ district: 1, city: 1 }, { unique: false });
CityMasterSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CityMaster', CityMasterSchema);
