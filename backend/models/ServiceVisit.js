const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const VisitCheckLogSchema = new mongoose.Schema({
    time: { type: Date, required: true },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String, default: '' }
    }
}, { _id: false });

const VisitExpenseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true }
}, { _id: false });

const ServiceVisitSchema = new mongoose.Schema({
    visitNo: { type: String, required: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    engineerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledDate: { type: Date, required: true },
    status: { 
        type: String, 
        enum: ['Scheduled', 'In Transit', 'Started', 'Completed', 'Cancelled'], 
        default: 'Scheduled' 
    },
    checkIn: { type: VisitCheckLogSchema, default: null },
    checkOut: { type: VisitCheckLogSchema, default: null },
    visitReport: { type: String, default: '' },
    customerSignature: { type: String, default: '' },
    billingStatus: { 
        type: String, 
        enum: ['Under Warranty', 'Under AMC', 'Paid', 'Free Service'], 
        default: 'Paid' 
    },
    expenses: { type: [VisitExpenseSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ServiceVisitSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ServiceVisitSchema.index({ visitNo: 1 });
ServiceVisitSchema.index({ ticketId: 1 });
ServiceVisitSchema.index({ engineerId: 1, scheduledDate: 1 });
ServiceVisitSchema.index({ companyId: 1, visitNo: 1 }, { unique: true });

ServiceVisitSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ServiceVisit', ServiceVisitSchema);
