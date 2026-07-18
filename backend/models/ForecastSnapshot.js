const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ForecastSnapshotSchema = new mongoose.Schema({
    month: { type: String, required: true }, // "Jun-2026"

    pipelineValue: { type: Number, default: 0 },
    weightedForecast: { type: Number, default: 0 },
    bestCase: { type: Number, default: 0 },
    worstCase: { type: Number, default: 0 },
    actualRevenue: { type: Number, default: 0 },

    accuracy: { type: Number, default: 0 }, // (actual / forecast) * 100

    createdAt: { type: Date, default: Date.now }
});

ForecastSnapshotSchema.index({ companyId: 1, month: 1 }, { unique: true });

ForecastSnapshotSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ForecastSnapshot', ForecastSnapshotSchema);
