const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
    type: { type: String, required: true },
    prefix: { type: String, required: true },
    year: { type: Number, required: true },
    seq: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
});

CounterSchema.index({ companyId: 1, type: 1, prefix: 1, year: 1 }, { unique: true });

CounterSchema.pre('findOneAndUpdate', function () {
    this.set({ updatedAt: new Date() });
});

const tenantPlugin = require('./plugins/tenantPlugin');
CounterSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Counter', CounterSchema);
