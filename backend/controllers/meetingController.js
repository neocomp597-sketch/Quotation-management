const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');
const mongoose = require('mongoose');
const { broadcastCrmUpdate } = require('../config/socket');

const getOrganizerDefaultReportTo = async (organizerId, companyId) => {
    if (!organizerId) return null;
    const organizer = await User.findOne({ _id: organizerId, companyId }).select('reportsTo').lean();
    return organizer?.reportsTo || null;
};

const validateAppointmentReportTo = async (reportTo, companyId) => {
    if (!reportTo) return null;
    const senior = await User.findOne({ _id: reportTo, companyId }).select('_id').lean();
    if (!senior) {
        throw new Error('Selected report-to senior was not found in this company');
    }
    return reportTo;
};

const getDirectReportIds = async (userId, companyId) => {
    if (!userId || !companyId) return [];
    const reports = await User.find({ companyId, reportsTo: userId }).select('_id').lean();
    return reports.map((user) => user._id);
};

// Helper to check for overlapping meetings
const checkOverlaps = async (startDateTime, endDateTime, organizerId, participants = [], excludeMeetingId = null) => {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    const allUserIds = [organizerId, ...participants].filter(id => id);

    const conflictQuery = {
        isDeleted: { $ne: true },
        status: { $in: ['Scheduled', 'Confirmed', 'In Progress'] },
        startDateTime: { $lt: end },
        endDateTime: { $gt: start },
        $or: [
            { organizerId: { $in: allUserIds } },
            { participants: { $in: allUserIds } }
        ]
    };

    if (excludeMeetingId) {
        conflictQuery._id = { $ne: excludeMeetingId };
    }

    const conflictingMeetings = await Meeting.find(conflictQuery)
        .populate('organizerId', 'name email')
        .populate('participants', 'name email')
        .lean();

    return conflictingMeetings;
};

// Create a meeting
exports.createMeeting = async (req, res) => {
    try {
        const {
            title,
            startDateTime,
            endDateTime,
            relatedModule,
            relatedRecordId,
            organizerId,
            reportTo,
            participants = [],
            location,
            agenda,
            status,
            notes,
            allowConflict = false
        } = req.body;

        if (!title || !startDateTime || !endDateTime || !relatedModule || !relatedRecordId || !organizerId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Conflict check
        if (!allowConflict) {
            const conflicts = await checkOverlaps(startDateTime, endDateTime, organizerId, participants);
            if (conflicts.length > 0) {
                return res.status(409).json({
                    message: 'Time conflict detected for organizer or participants.',
                    conflicts
                });
            }
        }

        const resolvedReportTo = reportTo
            ? await validateAppointmentReportTo(reportTo, req.user?.companyId)
            : await getOrganizerDefaultReportTo(organizerId, req.user?.companyId);

        const newMeeting = new Meeting({
            title,
            startDateTime,
            endDateTime,
            relatedModule,
            relatedRecordId,
            organizerId,
            reportTo: resolvedReportTo,
            participants,
            location,
            agenda,
            status: status || 'Scheduled',
            notes,
            createdBy: req.user?.id,
            statusHistory: [{
                status: status || 'Scheduled',
                changedBy: req.user?.id || organizerId,
                changedAt: new Date()
            }]
        });

        await newMeeting.save();

        // Send immediate notifications in database
        const notifyUserIds = Array.from(new Set([organizerId, ...participants].map(id => id.toString())));
        const participantNamesStr = participants.length > 0 ? ` with ${participants.length} other participant(s)` : '';
        const startTimeStr = new Date(startDateTime).toLocaleString();

        for (const userId of notifyUserIds) {
            await Notification.create({
                userId,
                title: 'New Meeting Scheduled',
                message: `You have been scheduled for meeting: "${title}" on ${startTimeStr}${participantNamesStr}.`,
                type: 'MEETING_CREATED',
                dueDate: new Date(startDateTime),
                companyId: req.user?.companyId
            });
        }

        broadcastCrmUpdate('MEETING', 'CREATE', newMeeting);
        res.status(201).json(newMeeting);
    } catch (err) {
        if (/report-to senior/i.test(err.message)) {
            return res.status(400).json({ message: err.message });
        }
        console.error('[Meeting Create Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Get all meetings (tenant isolated)
exports.getAllMeetings = async (req, res) => {
    try {
        const { status, organizerId, relatedRecordId, start, end, search, scope } = req.query;

        const query = { isDeleted: { $ne: true } };

        if (status) {
            query.status = status;
        }
        if (organizerId) {
            query.organizerId = organizerId;
        }
        if (scope === 'team' && req.user?.id) {
            const directReportIds = await getDirectReportIds(req.user.id, req.user.companyId);
            query.$or = [
                { reportTo: req.user.id },
                { organizerId: { $in: directReportIds } }
            ];
        } else if (scope === 'mine' && req.user?.id) {
            query.$or = [
                { organizerId: req.user.id },
                { participants: req.user.id }
            ];
        }
        if (relatedRecordId) {
            query.relatedRecordId = relatedRecordId;
        }
        if (start || end) {
            query.startDateTime = {};
            if (start) query.startDateTime.$gte = new Date(start);
            if (end) query.startDateTime.$lte = new Date(end);
        }
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const meetings = await Meeting.find(query)
            .populate('organizerId', 'name email')
            .populate('reportTo', 'name email')
            .populate('participants', 'name email')
            .populate({ path: 'relatedRecordId' }) // dynamic populate
            .sort({ startDateTime: 1 })
            .lean();

        res.json(meetings);
    } catch (err) {
        console.error('[Meeting Fetch All Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Get meeting by ID
exports.getMeetingById = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
            .populate('organizerId', 'name email')
            .populate('reportTo', 'name email')
            .populate('participants', 'name email')
            .populate({ path: 'relatedRecordId' })
            .lean();

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }
        res.json(meeting);
    } catch (err) {
        console.error('[Meeting Fetch ID Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Update meeting
exports.updateMeeting = async (req, res) => {
    try {
        const meetingId = req.params.id;
        const meeting = await Meeting.findOne({ _id: meetingId, isDeleted: { $ne: true } });

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        const {
            title,
            startDateTime,
            endDateTime,
            relatedModule,
            relatedRecordId,
            organizerId,
            reportTo,
            participants,
            location,
            agenda,
            status,
            outcome,
            notes,
            allowConflict = false
        } = req.body;

        // Overlap Check if times or participants changed
        const timeChanged = startDateTime && new Date(startDateTime).getTime() !== new Date(meeting.startDateTime).getTime();
        const endTimeChanged = endDateTime && new Date(endDateTime).getTime() !== new Date(meeting.endDateTime).getTime();
        const organizerChanged = organizerId && organizerId.toString() !== meeting.organizerId.toString();
        const participantsChanged = participants && JSON.stringify(participants) !== JSON.stringify(meeting.participants);

        if (!allowConflict && (timeChanged || endTimeChanged || organizerChanged || participantsChanged)) {
            const checkStart = startDateTime || meeting.startDateTime;
            const checkEnd = endDateTime || meeting.endDateTime;
            const checkOrg = organizerId || meeting.organizerId;
            const checkPart = participants || meeting.participants;

            const conflicts = await checkOverlaps(checkStart, checkEnd, checkOrg, checkPart, meetingId);
            if (conflicts.length > 0) {
                return res.status(409).json({
                    message: 'Time conflict detected for organizer or participants.',
                    conflicts
                });
            }
        }

        // Keep track of status change for audit log
        let statusUpdated = false;
        let originalStatus = meeting.status;
        if (status && status !== meeting.status) {
            meeting.status = status;
            meeting.statusHistory.push({
                status: status,
                changedBy: req.user?.id || meeting.organizerId,
                changedAt: new Date()
            });
            statusUpdated = true;
        }

        // Apply remaining updates
        if (title !== undefined) meeting.title = title;
        if (startDateTime !== undefined) meeting.startDateTime = startDateTime;
        if (endDateTime !== undefined) meeting.endDateTime = endDateTime;
        if (relatedModule !== undefined) meeting.relatedModule = relatedModule;
        if (relatedRecordId !== undefined) meeting.relatedRecordId = relatedRecordId;
        if (organizerId !== undefined) meeting.organizerId = organizerId;
        if (reportTo !== undefined) {
            meeting.reportTo = await validateAppointmentReportTo(reportTo, req.user?.companyId);
        } else if (organizerChanged) {
            meeting.reportTo = await getOrganizerDefaultReportTo(organizerId, req.user?.companyId);
        }
        if (participants !== undefined) meeting.participants = participants;
        if (location !== undefined) meeting.location = location;
        if (agenda !== undefined) meeting.agenda = agenda;
        if (outcome !== undefined) meeting.outcome = outcome;
        if (notes !== undefined) meeting.notes = notes;

        await meeting.save();

        // Send notifications if status updated
        if (statusUpdated) {
            const notifyUserIds = Array.from(new Set([meeting.organizerId, ...meeting.participants].map(id => id.toString())));
            const type = status === 'Cancelled' ? 'MEETING_CANCELLED' : status === 'Rescheduled' ? 'MEETING_RESCHEDULED' : 'MEETING_UPDATED';
            const titleMsg = status === 'Cancelled' ? 'Meeting Cancelled' : status === 'Rescheduled' ? 'Meeting Rescheduled' : 'Meeting Details Updated';

            for (const userId of notifyUserIds) {
                await Notification.create({
                    userId,
                    title: titleMsg,
                    message: `Meeting "${meeting.title}" status changed from ${originalStatus} to ${status}.`,
                    type,
                    dueDate: meeting.startDateTime,
                    companyId: req.user?.companyId
                });
            }
        }

        broadcastCrmUpdate('MEETING', 'UPDATE', meeting);
        res.json(meeting);
    } catch (err) {
        if (/report-to senior/i.test(err.message)) {
            return res.status(400).json({ message: err.message });
        }
        console.error('[Meeting Update Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Soft delete meeting
exports.deleteMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        meeting.isDeleted = true;
        meeting.deletedAt = new Date();
        meeting.deletedBy = req.user?.id;
        await meeting.save();

        // Send cancellation notice
        const notifyUserIds = Array.from(new Set([meeting.organizerId, ...meeting.participants].map(id => id.toString())));
        for (const userId of notifyUserIds) {
            await Notification.create({
                userId,
                title: 'Meeting Deleted',
                message: `Meeting "${meeting.title}" has been deleted.`,
                type: 'MEETING_CANCELLED',
                companyId: req.user?.companyId
            });
        }

        broadcastCrmUpdate('MEETING', 'DELETE', { id: req.params.id });
        res.json({ message: 'Meeting deleted successfully (soft-delete)' });
    } catch (err) {
        console.error('[Meeting Delete Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// --- OPTIMIZED REPORTING API ENDPOINTS ---

// 1. General stats count (Upcoming, Completed, Cancelled)
exports.getMeetingStats = async (req, res) => {
    try {
        const stats = await Meeting.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    scheduled: { $sum: { $cond: [{ $eq: ['$status', 'Scheduled'] }, 1, 0] } },
                    confirmed: { $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
                    upcoming: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $in: ['$status', ['Scheduled', 'Confirmed', 'In Progress']] },
                                        { $gte: ['$startDateTime', new Date()] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const result = stats[0] || { total: 0, scheduled: 0, confirmed: 0, completed: 0, cancelled: 0, upcoming: 0 };
        res.json(result);
    } catch (err) {
        console.error('[Meeting Stats Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// 2. User performance summary (Meetings count by organizer)
exports.getMeetingUserSummary = async (req, res) => {
    try {
        const summary = await Meeting.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            {
                $group: {
                    _id: '$organizerId',
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } }
                }
            },
            { $sort: { total: -1 } }
        ]);

        // Populate organizer details
        const populated = await User.populate(summary, { path: '_id', select: 'name email' });
        const result = populated.map(item => ({
            user: item._id,
            total: item.total,
            completed: item.completed,
            cancelled: item.cancelled
        }));

        res.json(result);
    } catch (err) {
        console.error('[Meeting User Summary Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// 3. Monthly meeting counts
exports.getMeetingMonthlySummary = async (req, res) => {
    try {
        const summary = await Meeting.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$startDateTime' },
                        month: { $month: '$startDateTime' }
                    },
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const result = summary.map(item => {
            const monthIdx = item._id.month - 1;
            const label = `${MONTH_NAMES[monthIdx]}-${item._id.year}`;
            return {
                label,
                year: item._id.year,
                month: item._id.month,
                total: item.total,
                completed: item.completed,
                cancelled: item.cancelled
            };
        });

        res.json(result);
    } catch (err) {
        console.error('[Meeting Monthly Summary Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// 4. Client history
exports.getMeetingClientHistory = async (req, res) => {
    try {
        const { relatedRecordId } = req.query;
        if (!relatedRecordId) {
            return res.status(400).json({ message: 'relatedRecordId query parameter is required' });
        }

        const meetings = await Meeting.find({
            relatedRecordId: new mongoose.Types.ObjectId(relatedRecordId),
            isDeleted: { $ne: true }
        })
        .populate('organizerId', 'name email')
        .populate('reportTo', 'name email')
        .populate('participants', 'name email')
        .sort({ startDateTime: -1 })
        .lean();

        res.json(meetings);
    } catch (err) {
        console.error('[Meeting Client History Error]', err);
        res.status(500).json({ message: err.message });
    }
};
