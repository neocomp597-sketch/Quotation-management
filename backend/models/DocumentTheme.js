const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DocumentThemeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    fonts: { type: String, default: 'font-outfit' }, // CSS font class name
    primaryColor: { type: String, default: '#0f172a' }, // Slate 900
    secondaryColor: { type: String, default: '#4f46e5' }, // Indigo 600
    textColor: { type: String, default: '#334155' }, // Slate 700
    logoAlignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    watermarkText: { type: String, default: '' },
    tableHeaderBg: { type: String, default: '#f8fafc' }, // Slate 50
    tableHeaderColor: { type: String, default: '#475569' }, // Slate 600
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

DocumentThemeSchema.pre('save', function () {
    this.updatedAt = new Date();
});

DocumentThemeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DocumentTheme', DocumentThemeSchema);
