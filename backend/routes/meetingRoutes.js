const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, meetingController.createMeeting);
router.get('/', protect, meetingController.getAllMeetings);
router.get('/stats', protect, meetingController.getMeetingStats);
router.get('/user-summary', protect, meetingController.getMeetingUserSummary);
router.get('/monthly-summary', protect, meetingController.getMeetingMonthlySummary);
router.get('/client-history', protect, meetingController.getMeetingClientHistory);
router.get('/:id', protect, meetingController.getMeetingById);
router.put('/:id', protect, meetingController.updateMeeting);
router.delete('/:id', protect, meetingController.deleteMeeting);

module.exports = router;
