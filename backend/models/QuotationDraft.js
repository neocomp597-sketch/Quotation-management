const mongoose = require('mongoose');

const QuotationDraftSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    draftKey: { type: String, required: true, default: 'new' },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
});

QuotationDraftSchema.index({ userId: 1, draftKey: 1 }, { unique: true });
QuotationDraftSchema.index({ updatedAt: -1 });

QuotationDraftSchema.pre('findOneAndUpdate', function () {
    this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('QuotationDraft', QuotationDraftSchema);
