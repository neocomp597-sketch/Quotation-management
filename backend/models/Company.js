const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, lowercase: true, index: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

CompanySchema.pre('validate', function () {
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
});

module.exports = mongoose.model('Company', CompanySchema);
