const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const MeetingSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    relatedModule: { 
        type: String, 
        required: true, 
        enum: ['Customer', 'Enquiry', 'Lead', 'Contact', 'Account', 'Deal'] 
    },
    relatedRecordId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'relatedModule' },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    location: { type: String, trim: true },
    agenda: { type: String, trim: true },
    status: { 
        type: String, 
        required: true,
        enum: ['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'],
        default: 'Scheduled'
    },
    outcome: {
        type: String,
        enum: ['Successful', 'Follow Up Required', 'No Show', 'Cancelled', 'Not Interested']
    },
    notes: { type: String, trim: true },
    remindersSent: {
        oneDay: { type: Boolean, default: false },
        thirtyMin: { type: Boolean, default: false }
    },
    statusHistory: [{
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        changedAt: { type: Date, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

MeetingSchema.pre('save', function() {
    this.updatedAt = new Date();
});

// Performance optimization indexes
MeetingSchema.index({ companyId: 1, startDateTime: 1 });
MeetingSchema.index({ companyId: 1, organizerId: 1 });
MeetingSchema.index({ companyId: 1, reportTo: 1 });
MeetingSchema.index({ companyId: 1, status: 1 });
MeetingSchema.index({ relatedRecordId: 1 });

MeetingSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Meeting', MeetingSchema);
