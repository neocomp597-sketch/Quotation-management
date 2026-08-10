const mongoose = require('mongoose');

const FeatureItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    isExpandable: { type: Boolean, default: false },
    isIncluded: { type: Boolean, default: true }
});

const CategorySchema = new mongoose.Schema({
    categoryName: { type: String, required: true },
    items: [FeatureItemSchema]
});

const TierSchema = new mongoose.Schema({
    tierName: { type: String, required: true }, // e.g. FOUNDATION, STRENGTH, GROWTH
    subtitle: { type: String, default: '' },
    buttonText: { type: String, default: 'Free Trial' },
    buttonLink: { type: String, default: '/register' },
    featuresHeader: { type: String, default: 'Essential Features' },
    badge: { type: String, default: '' },
    categories: [CategorySchema]
});

const LandingPlanSchema = new mongoose.Schema({
    tabKey: { type: String, required: true, unique: true }, // e.g. hrms_payroll, hiring, psa
    tabName: { type: String, required: true }, // e.g. HRMS & Payroll
    order: { type: Number, default: 0 },
    tiers: [TierSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

LandingPlanSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('LandingPlan', LandingPlanSchema);
