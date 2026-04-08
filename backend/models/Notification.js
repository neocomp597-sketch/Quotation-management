const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['Reminder', 'Alert', 'Overdue'], default: 'Reminder' },
    relatedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' }, // e.g., Enquiry ID
    isRead: { type: Boolean, default: false },
    isDismissed: { type: Boolean, default: false },
    dueDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
