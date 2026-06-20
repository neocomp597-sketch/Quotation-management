const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DealSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPipeline', required: true },
    stageId: { type: String, required: true }, // stage _id within pipeline

    value: { type: Number, default: 0, min: 0 },
    probability: { type: Number, default: 0, min: 0, max: 100 },
    weightedValue: { type: Number, default: 0 },

    expectedCloseDate: { type: Date },

    forecastCategory: {
        type: String,
        enum: ['Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted'],
        default: 'Pipeline'
    },

    source: {
        type: String,
        default: 'Other'
    },

    status: {
        type: String,
        enum: ['Open', 'Won', 'Lost'],
        default: 'Open'
    },

    lostReason: {
        type: String,
        enum: ['Price', 'Competitor', 'Budget', 'No Response', 'Other', ''],
        default: ''
    },

    tags: [{ type: String, trim: true }],

    notes: { type: String, default: '' },

    enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },

    wonDate: { type: Date },
    lostDate: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Auto-calculate weightedValue
DealSchema.pre('save', function () {
    this.weightedValue = Math.round((this.value * this.probability) / 100);
    this.updatedAt = new Date();
});

DealSchema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    if (update.value !== undefined && update.probability !== undefined) {
        this.set({ weightedValue: Math.round((update.value * update.probability) / 100) });
    }
    this.set({ updatedAt: new Date() });
});

DealSchema.index({ companyId: 1, pipelineId: 1, stageId: 1 });
DealSchema.index({ companyId: 1, ownerId: 1 });
DealSchema.index({ companyId: 1, status: 1 });
DealSchema.index({ companyId: 1, customerId: 1 });
DealSchema.index({ companyId: 1, forecastCategory: 1 });
DealSchema.index({ companyId: 1, expectedCloseDate: 1 });
DealSchema.index({ companyId: 1, createdAt: -1 });

DealSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Deal', DealSchema);
