const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    passwordChangedAt: { type: Date },
    refreshTokenHash: { type: String },
    refreshTokenExpiresAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, default: 'sales' },
    status: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: function () {
            return this.role !== 'SUPER_ADMIN';
        },
        index: true,
    },
    createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
