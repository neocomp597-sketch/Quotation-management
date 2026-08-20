const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    passwordChangedAt: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
    refreshTokenHash: { type: String },
    refreshTokenExpiresAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, default: 'sales' },
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    status: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    personalNote: { type: String, default: '' },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: function () {
            return this.role !== 'SUPER_ADMIN';
        },
        index: true,
    },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    customPermissions: { type: Map, of: Boolean, default: {} },
    createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
