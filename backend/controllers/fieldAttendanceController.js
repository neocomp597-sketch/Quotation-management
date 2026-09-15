const FieldAttendance = require('../models/FieldAttendance');
const Company = require('../models/Company');
const User = require('../models/User');

// Start of day helper
const getStartOfDay = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const resolveCompanyId = async (req) => {
    let companyId = req.user?.companyId || req.body?.companyId;
    if (!companyId) {
        const firstComp = await Company.findOne().lean();
        if (firstComp) companyId = firstComp._id;
    }
    return companyId;
};

exports.checkIn = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const engineerId = req.user?.id || req.user?._id;
        if (!engineerId) {
            return res.status(401).json({ message: 'User authentication required for attendance check-in.' });
        }
        const employeeName = req.user?.name || req.body.employeeName || 'Field Engineer';

        const todayStart = getStartOfDay();
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        // Check if ANY check-in record already exists for today (Checked-In or Checked-Out)
        const todayQuery = {
            attendanceDate: { $gte: todayStart, $lt: tomorrowStart }
        };
        if (companyId) todayQuery.companyId = companyId;
        if (engineerId) todayQuery.engineerId = engineerId;

        const existingToday = await FieldAttendance.findOne(todayQuery);

        if (existingToday) {
            if (existingToday.status === 'Checked-In') {
                return res.status(400).json({
                    message: 'You are currently checked in for today. Please check out when finished.',
                    data: existingToday
                });
            } else {
                return res.status(400).json({
                    message: 'You have already completed your check-in for today. Users are allowed to check in only once per day.',
                    data: existingToday
                });
            }
        }

        const {
            areaName,
            address,
            latitude,
            longitude,
            selfieUrl,
            notes
        } = req.body;

        const newAttendance = await FieldAttendance.create({
            companyId: companyId || null,
            engineerId: engineerId || null,
            employeeName,
            attendanceDate: todayStart,
            checkInTime: new Date(),
            checkInLocation: {
                address: address || '',
                areaName: areaName || 'Field Location',
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null
            },
            selfieUrl: selfieUrl || '',
            status: 'Checked-In',
            notes: notes || ''
        });

        res.status(201).json({
            message: 'Field Attendance Check-In recorded successfully!',
            data: newAttendance
        });
    } catch (error) {
        console.error('CheckIn error:', error);
        res.status(500).json({ message: error.message || 'Error recording Check-In' });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const engineerId = req.user?.id || req.user?._id;
        const todayStart = getStartOfDay();
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const {
            attendanceId,
            areaName,
            address,
            latitude,
            longitude,
            selfieUrl,
            checkOutSelfieUrl,
            notes
        } = req.body;

        let attendance = null;
        if (attendanceId) {
            const query = { _id: attendanceId };
            if (companyId) query.companyId = companyId;
            attendance = await FieldAttendance.findOne(query);
        } else {
            const query = {
                attendanceDate: { $gte: todayStart, $lt: tomorrowStart },
                status: 'Checked-In'
            };
            if (companyId) query.companyId = companyId;
            if (engineerId) query.engineerId = engineerId;
            attendance = await FieldAttendance.findOne(query).sort({ checkInTime: -1 });
        }

        if (!attendance) {
            return res.status(404).json({ message: 'No active Check-In record found to check out.' });
        }

        attendance.checkOutTime = new Date();
        attendance.checkOutLocation = {
            address: address || attendance.checkInLocation?.address || '',
            areaName: areaName || attendance.checkInLocation?.areaName || 'Field Location',
            latitude: latitude ? Number(latitude) : (attendance.checkInLocation?.latitude || null),
            longitude: longitude ? Number(longitude) : (attendance.checkInLocation?.longitude || null)
        };
        const selfieToSave = checkOutSelfieUrl || selfieUrl;
        if (selfieToSave) {
            attendance.checkOutSelfieUrl = selfieToSave;
        }
        attendance.status = 'Checked-Out';
        if (notes) attendance.notes = (attendance.notes && attendance.notes !== notes ? attendance.notes + ' | ' : '') + notes;

        await attendance.save();

        res.json({
            message: 'Field Attendance Check-Out recorded successfully!',
            data: attendance
        });
    } catch (error) {
        console.error('CheckOut error:', error);
        res.status(500).json({ message: error.message || 'Error recording Check-Out' });
    }
};

exports.getAttendance = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const userRole = String(req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin';

        if (!isAdmin) {
            // Non-admin users are strictly restricted to their own attendance records
            filter.engineerId = req.user?.id || req.user?._id;
        } else if (engineerId && engineerId !== 'all') {
            filter.engineerId = engineerId;
        }

        if (date) {
            const start = getStartOfDay(new Date(date));
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            filter.attendanceDate = { $gte: start, $lt: end };
        }

        const records = await FieldAttendance.find(filter)
            .populate('engineerId', 'name email mobile')
            .sort({ checkInTime: -1 })
            .lean();

        res.json(records);
    } catch (error) {
        console.error('getAttendance error:', error);
        res.status(500).json({ message: error.message || 'Error fetching field attendance' });
    }
};

exports.getActiveStatus = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const engineerId = req.user?.id || req.user?._id;
        const todayStart = getStartOfDay();
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const query = {
            attendanceDate: { $gte: todayStart, $lt: tomorrowStart }
        };
        if (companyId) query.companyId = companyId;
        if (engineerId) query.engineerId = engineerId;

        const todayRecord = await FieldAttendance.findOne(query).sort({ checkInTime: -1 }).lean();
        const activeRecord = (todayRecord && todayRecord.status === 'Checked-In') ? todayRecord : null;
        const hasCompletedToday = !!(todayRecord && todayRecord.status === 'Checked-Out');

        res.json({
            activeRecord,
            todayRecord: todayRecord || null,
            hasCompletedToday
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
