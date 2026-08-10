const mongoose = require('mongoose');

const ApiRequestLogSchema = new mongoose.Schema({
    apiKeyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey',
        required: true,
        index: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    requestId: {
        type: String,
        required: true,
        index: true
    },
    endpoint: {
        type: String,
        required: true
    },
    method: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    responseTimeMs: {
        type: Number,
        required: true
    },
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 90 // 90 days TTL
    }
});

ApiRequestLogSchema.index({ companyId: 1, createdAt: -1 });
ApiRequestLogSchema.index({ apiKeyId: 1, createdAt: -1 });

module.exports = mongoose.model('ApiRequestLog', ApiRequestLogSchema);
