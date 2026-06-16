const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
        type: String, 
        enum: [
            'Reminder', 'Alert', 'Overdue', 'Quotation', 'Planning',
            'MEETING_CREATED', 'MEETING_REMINDER_1_DAY', 'MEETING_REMINDER_30_MIN', 
            'MEETING_UPDATED', 'MEETING_CANCELLED', 'MEETING_RESCHEDULED'
        ], 
        default: 'Reminder' 
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' }, // e.g., Enquiry ID
    isRead: { type: Boolean, default: false },
    isDismissed: { type: Boolean, default: false },
    dueDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const tenantPlugin = require('./plugins/tenantPlugin');
NotificationSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Notification', NotificationSchema);
