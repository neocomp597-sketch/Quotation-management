const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ContractTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true }, // e.g. AMC, NDA, Sales Agreement
    htmlContent: { type: String, required: true },
    cssContent: { type: String, default: '' },
    headerHtml: { type: String, default: '' },
    footerHtml: { type: String, default: '' },
    themeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentTheme' },
    paperSize: { type: String, enum: ['A4', 'Letter', 'Legal'], default: 'A4' },
    orientation: { type: String, enum: ['Portrait', 'Landscape'], default: 'Portrait' },
    marginTop: { type: Number, default: 20 }, // Margins in mm
    marginBottom: { type: Number, default: 20 },
    marginLeft: { type: Number, default: 20 },
    marginRight: { type: Number, default: 20 },
    status: { type: String, enum: ['Active', 'Draft', 'Archived'], default: 'Draft', index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ContractTemplateSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ContractTemplateSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ContractTemplate', ContractTemplateSchema);
