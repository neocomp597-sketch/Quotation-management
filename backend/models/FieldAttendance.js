const mongoose = require('mongoose');

const fieldAttendanceSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'Company',
        index: true
    },
    engineerId: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'User',
        index: true
    },
    employeeName: {
        type: String,
        required: true
    },
    attendanceDate: {
        type: Date,
        required: true,
        index: true
    },
    checkInTime: {
        type: Date,
        required: true
    },
    checkOutTime: {
        type: Date,
        default: null
    },
    checkInLocation: {
        address: { type: String, default: '' },
        areaName: { type: String, default: '' },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
    },
    checkOutLocation: {
        address: { type: String, default: '' },
        areaName: { type: String, default: '' },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
    },
    selfieUrl: {
        type: String,
        default: ''
    },
    checkOutSelfieUrl: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Checked-In', 'Checked-Out'],
        default: 'Checked-In'
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('FieldAttendance', fieldAttendanceSchema);
