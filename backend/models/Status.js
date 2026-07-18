const mongoose = require('mongoose');

const StatusSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    color: {
        type: String,
        default: '#64748b' // Default slate color
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

StatusSchema.index({ isActive: 1, name: 1 });
StatusSchema.index({ companyId: 1, name: 1 }, { unique: true });

const tenantPlugin = require('./plugins/tenantPlugin');
StatusSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Status', StatusSchema);
