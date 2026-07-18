const mongoose = require('mongoose');

const PlatformAuditLogSchema = new mongoose.Schema(
    {
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        actorEmail: { type: String, trim: true },
        action: { type: String, required: true, index: true },
        targetType: { type: String, required: true, index: true },
        targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        previousState: { type: mongoose.Schema.Types.Mixed },
        nextState: { type: mongoose.Schema.Types.Mixed },
        ipAddress: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true }
);

PlatformAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PlatformAuditLog', PlatformAuditLogSchema);
