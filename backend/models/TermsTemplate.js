const mongoose = require('mongoose');

const TermsTemplateSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    content: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('TermsTemplate', TermsTemplateSchema);
