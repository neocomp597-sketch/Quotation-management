const express = require('express');
const router = express.Router();
const Meeting = require('../../../models/Meeting');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/meetings - List meetings
router.get('/', requireApiScope('meetings.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId, isDeleted: { $ne: true } };

        if (req.query.search) {
            filter.title = new RegExp(req.query.search.trim(), 'i');
        }

        if (req.query.status) {
            filter.status = req.query.status;
        }

        const [meetings, total] = await Promise.all([
            Meeting.find(filter)
                .sort({ startDateTime: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Meeting.countDocuments(filter)
        ]);

        const formatted = meetings.map(m => ({
            id: m._id,
            title: m.title,
            startDateTime: m.startDateTime,
            endDateTime: m.endDateTime,
            location: m.location || '',
            agenda: m.agenda || '',
            status: m.status || 'Scheduled',
            outcome: m.outcome || '',
            createdAt: m.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching meetings:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve meetings', 500);
    }
});

// GET /api/v1/meetings/:id - Get single meeting
router.get('/:id', requireApiScope('meetings.read'), async (req, res) => {
    try {
        const meeting = await Meeting.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId,
            isDeleted: { $ne: true }
        }).lean();

        if (!meeting) {
            return sendError(res, 'resource_not_found', 'Meeting was not found', 404);
        }

        const formatted = {
            id: meeting._id,
            title: meeting.title,
            startDateTime: meeting.startDateTime,
            endDateTime: meeting.endDateTime,
            location: meeting.location || '',
            agenda: meeting.agenda || '',
            status: meeting.status || 'Scheduled',
            outcome: meeting.outcome || '',
            notes: meeting.notes || '',
            createdAt: meeting.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching meeting by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve meeting', 500);
    }
});

// POST /api/v1/meetings - Schedule meeting
router.post('/', requireApiScope('meetings.write'), async (req, res) => {
    try {
        const { title, startDateTime, endDateTime, relatedModule, relatedRecordId, location, agenda, status } = req.body;

        if (!title || !startDateTime) {
            return sendError(res, 'validation_error', 'title and startDateTime are required fields', 400);
        }

        const start = new Date(startDateTime);
        const end = endDateTime ? new Date(endDateTime) : new Date(start.getTime() + 30 * 60 * 1000);

        const newMeeting = new Meeting({
            title: title.trim(),
            startDateTime: start,
            endDateTime: end,
            relatedModule: relatedModule || 'Customer',
            relatedRecordId: relatedRecordId || req.apiClient.companyId,
            organizerId: req.apiClient.userId,
            location: location || '',
            agenda: agenda || '',
            status: status || 'Scheduled',
            companyId: req.apiClient.companyId,
            createdBy: req.apiClient.userId
        });

        await newMeeting.save();

        const formatted = {
            id: newMeeting._id,
            title: newMeeting.title,
            startDateTime: newMeeting.startDateTime,
            endDateTime: newMeeting.endDateTime,
            status: newMeeting.status,
            createdAt: newMeeting.createdAt
        };

        return sendSuccess(res, formatted, 201);
    } catch (error) {
        console.error('[PublicAPI] Error creating meeting:', error);
        return sendError(res, 'internal_error', 'Failed to create meeting', 500);
    }
});

// DELETE /api/v1/meetings/:id - Soft delete meeting
router.delete('/:id', requireApiScope('meetings.write'), async (req, res) => {
    try {
        const deleted = await Meeting.findOneAndUpdate(
            { _id: req.params.id, companyId: req.apiClient.companyId },
            { $set: { isDeleted: true, deletedAt: new Date() } },
            { new: true }
        );

        if (!deleted) {
            return sendError(res, 'resource_not_found', 'Meeting was not found', 404);
        }

        return sendSuccess(res, { id: req.params.id, deleted: true });
    } catch (error) {
        console.error('[PublicAPI] Error deleting meeting:', error);
        return sendError(res, 'internal_error', 'Failed to delete meeting', 500);
    }
});

module.exports = router;
