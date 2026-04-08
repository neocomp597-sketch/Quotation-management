const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/unread', protect, notificationController.getUnreadNotifications);
router.get('/', protect, notificationController.getAllNotifications);
router.patch('/:id/read', protect, notificationController.markAsRead);
router.patch('/:id/dismiss', protect, notificationController.dismiss);

module.exports = router;
