const mongoose = require('mongoose');

const RequestLockSchema = new mongoose.Schema({
    lockKey: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

// Auto-delete lock documents after 10 seconds
RequestLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10 });

module.exports = mongoose.model('RequestLock', RequestLockSchema);
