const mongoose = require('mongoose');

const SystemUpdateSchema = new mongoose.Schema({
    version: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    releaseNotes: {
        type: [String],
        required: true,
        default: []
    },
    detailedChanges: [
        {
            date: { type: String, required: true },
            module: { type: String, required: true },
            submodule: { type: String, required: true },
            changes: { type: String, required: true }
        }
    ],
    deployedAt: {
        type: Date,
        default: Date.now
    },
    deployedBy: {
        type: String,
        default: 'GitHub CI/CD',
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

SystemUpdateSchema.index({ deployedAt: -1 });
SystemUpdateSchema.index({ version: 1 }, { unique: true });

module.exports = mongoose.model('SystemUpdate', SystemUpdateSchema);
