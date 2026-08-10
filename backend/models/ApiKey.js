const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    keyPrefix: {
        type: String,
        required: true,
        index: true
    },
    keyHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    environment: {
        type: String,
        enum: ['production', 'sandbox'],
        default: 'production'
    },
    permissions: [{
        type: String,
        enum: [
            'customers.read', 'customers.write',
            'contacts.read', 'contacts.write',
            'leads.read', 'leads.write',
            'deals.read', 'deals.write',
            'products.read', 'products.write',
            'quotations.read', 'quotations.write',
            'vendors.read', 'vendors.write',
            'orders.read', 'orders.write',
            'meetings.read', 'meetings.write',
            'branches.read', 'branches.write'
        ]
    }],
    status: {
        type: String,
        enum: ['active', 'revoked', 'expired'],
        default: 'active',
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: null
    },
    revokedAt: {
        type: Date,
        default: null
    }
});

ApiKeySchema.index({ companyId: 1, status: 1 });
ApiKeySchema.index({ companyId: 1, keyPrefix: 1 });

module.exports = mongoose.model('ApiKey', ApiKeySchema);
