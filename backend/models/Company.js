const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, lowercase: true, index: true },
        isActive: { type: Boolean, default: true },
        status: {
            type: String,
            enum: ['ACTIVE', 'SUSPENDED', 'DISABLED'],
            default: 'ACTIVE',
            index: true,
        },
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

// Every new company starts with the standard Division Master (U, UC, IND, EXP, CCD,
// OTHERS). A seeding failure is logged and never blocks creating the company; the
// one-time script scripts/seedDivisionMaster.js can fill it in later.
CompanySchema.pre('save', function () {
    this.$locals.wasNew = this.isNew;
});

CompanySchema.post('save', async function (doc) {
    if (!doc.$locals.wasNew) return;
    try {
        const { seedDefaultDivisions } = require('../utils/divisionSegment');
        await seedDefaultDivisions(doc._id);
    } catch (err) {
        console.error(`Division Master seeding failed for company ${doc._id}:`, err.message);
    }
});

module.exports = mongoose.model('Company', CompanySchema);
