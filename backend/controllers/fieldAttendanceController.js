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
        const engineerId = req.user?.id || req.user?._id || 'engineer_user';
        const employeeName = req.body.employeeName || req.user?.name || 'Field Engineer';

        const todayStart = getStartOfDay();
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        // Check if active check-in already exists for today
        const activeQuery = {
            attendanceDate: { $gte: todayStart, $lt: tomorrowStart },
            status: 'Checked-In'
        };
        if (companyId) activeQuery.companyId = companyId;
        if (engineerId) activeQuery.engineerId = engineerId;

        const existingActive = await FieldAttendance.findOne(activeQuery);

        if (existingActive) {
            return res.status(400).json({
                message: 'You have already checked in for today. Please check out before checking in again.',
                data: existingActive
            });
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
        attendance.status = 'Checked-Out';
        if (notes) attendance.notes = (attendance.notes ? attendance.notes + ' | ' : '') + notes;

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
        const { date, engineerId } = req.query;

        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (engineerId) filter.engineerId = engineerId;

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
            attendanceDate: { $gte: todayStart, $lt: tomorrowStart },
            status: 'Checked-In'
        };
        if (companyId) query.companyId = companyId;
        if (engineerId) query.engineerId = engineerId;

        const activeRecord = await FieldAttendance.findOne(query).sort({ checkInTime: -1 }).lean();

        res.json({ activeRecord });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
