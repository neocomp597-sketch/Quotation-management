const mongoose = require('mongoose');

const PlanningSchema = new mongoose.Schema({
    monthYear: { type: String, required: true }, // e.g. "Apr-26", "May-26"
    financialYear: { type: String, required: true }, // e.g. "2026-27"
    month: { type: Number, required: true, min: 1, max: 12 }, // 1-12 (Apr=4, Mar=3)
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    customerName: { type: String, required: true },
    qty: { type: Number, required: true },
    value: { type: Number, required: true, min: 0 },
    totalValue: { type: Number, default: 0 }, // qty * value (auto-calculated)
    mgrCode: { type: String, required: true }, // MGR1 code from MGR master
    mgrCode2: { type: String }, // MGR2 code from MGR master
    status: {
        type: String,
        enum: ['Budget', 'B & B', 'Firm', 'Invoice', 'Lost', 'MFC', 'Order Received', 'Others', 'Parked'],
        required: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

PlanningSchema.index({ financialYear: 1, monthYear: 1 });
PlanningSchema.index({ financialYear: 1, mgrCode: 1, monthYear: 1 });
PlanningSchema.index({ financialYear: 1, mgrCode2: 1, monthYear: 1 });
PlanningSchema.index({ financialYear: 1, customerId: 1, productId: 1, mgrCode: 1, mgrCode2: 1, status: 1, monthYear: 1 });

// Auto-calculate totalValue before save
PlanningSchema.pre('save', function() {
    this.totalValue = this.qty * this.value;
});

PlanningSchema.pre('findByIdAndUpdate', function() {
    const update = this.getUpdate();
    if (update.qty !== undefined && update.value !== undefined) {
        this.set({ totalValue: update.qty * update.value });
    }
});

module.exports = mongoose.model('Planning', PlanningSchema);
