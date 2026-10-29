const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    passwordChangedAt: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
    // Legacy single-session fields: still accepted on refresh so existing logins survive.
    refreshTokenHash: { type: String },
    refreshTokenExpiresAt: { type: Date },
    // One entry per signed-in device, so a login on one device never ends another
    // device's session (Redis, when configured, holds the same sessions as a fast path).
    refreshSessions: {
        type: [{
            _id: false,
            deviceId: { type: String, required: true },
            tokenHash: { type: String, required: true },
            expiresAt: { type: Date, required: true },
            createdAt: { type: Date, default: Date.now }
        }],
        default: [],
        select: false
    },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, default: 'sales' },
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    assignedBranches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    // Branch the user is currently working in; drives server-side branch scoping (see authMiddleware).
    activeBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    // MGR values the user's Invoice Bulk Upload data is limited to; none = all (utils/mgrAccess.js).
    mgrAccess: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MGR' }],
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
    employeeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile', default: null },
    // Overrides of the role's permissions: "<screen>" is View, "<screen>:create",
    // "<screen>:modify" and "<screen>:delete" are the actions (see config/authorization.js).
    customPermissions: { type: Map, of: Boolean, default: {} },
    customPermissionsUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customPermissionsUpdatedAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
