const Notification = require('../models/Notification');

exports.getUnreadNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            userId: req.user._id, 
            isDismissed: false, 
            isRead: false 
        }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAllNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id, isDismissed: false }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.dismiss = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { isDismissed: true, isRead: true });
        res.json({ message: 'Dismissed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
