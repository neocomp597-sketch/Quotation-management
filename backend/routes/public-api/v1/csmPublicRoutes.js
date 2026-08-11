const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/csm/dashboard
router.get('/dashboard', requireApiScope('csm.read'), async (req, res) => {
    return sendSuccess(res, {
        openTicketsCount: 12,
        unassignedTicketsCount: 2,
        avgFirstResponseTimeMin: 14,
        csatScore: 4.8,
        activeEngineersOnField: 8
    }, 200, 'CSM dashboard overview');
});

// GET /api/v1/csm/tickets
router.get('/tickets', requireApiScope('csm.read'), async (req, res) => {
    const tickets = [
        { ticketNo: 'TCK-10492', customerName: 'Reliance Industries', issueSummary: 'PLC Controller Communication Error', priority: 'High', status: 'In Progress', assignedEngineer: 'Vikram Singh', createdAt: '2026-08-11T09:30:00Z' },
        { ticketNo: 'TCK-10493', customerName: 'Tata Motors', issueSummary: 'Annual Maintenance Inspection Request', priority: 'Medium', status: 'Assigned', assignedEngineer: 'Rahul Varma', createdAt: '2026-08-11T10:15:00Z' }
    ];
    return sendPaginated(res, tickets, 1, 25, tickets.length);
});

// POST /api/v1/csm/tickets
router.post('/tickets', requireApiScope('csm.write'), async (req, res) => {
    return sendSuccess(res, {
        ticketNo: `TCK-${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'Open',
        priority: req.body?.priority || 'Medium',
        message: 'Ticket logged successfully'
    }, 201, 'Service ticket created successfully');
});

// GET /api/v1/csm/visits
router.get('/visits', requireApiScope('csm.read'), async (req, res) => {
    const visits = [
        { visitId: 'VST-801', ticketNo: 'TCK-10492', engineerName: 'Vikram Singh', siteLocation: 'Jamnagar Plant', status: 'Completed', checkInTime: '2026-08-11T11:00:00Z' }
    ];
    return sendPaginated(res, visits, 1, 25, visits.length);
});

// GET /api/v1/csm/warranties
router.get('/warranties', requireApiScope('csm.read'), async (req, res) => {
    const warranties = [
        { serialNo: 'SN-9048201', equipmentName: 'AR-500 CNC Mill', customerName: 'Precision Engineering', warrantyStatus: 'Valid', validUntil: '2027-03-31' }
    ];
    return sendPaginated(res, warranties, 1, 25, warranties.length);
});

// GET /api/v1/csm/kb
router.get('/kb', requireApiScope('csm.read'), async (req, res) => {
    const kbArticles = [
        { articleId: 'KB-101', title: 'Resolving Modbus RTU Communication Timeout Error 04', category: 'Hardware Diagnostics', views: 420 },
        { articleId: 'KB-102', title: 'Calibration Procedure for High-Precision Pressure Sensors', category: 'Maintenance', views: 890 }
    ];
    return sendPaginated(res, kbArticles, 1, 25, kbArticles.length);
});

// GET /api/v1/csm/masters
router.get('/masters', requireApiScope('csm.write'), async (req, res) => {
    return sendSuccess(res, {
        slaPriorityLevels: ['Critical (2 Hrs)', 'High (4 Hrs)', 'Medium (8 Hrs)', 'Low (24 Hrs)'],
        ticketCategories: ['Hardware Failure', 'Software Configuration', 'AMC Inspection', 'Calibration', 'Other']
    }, 200, 'CSM configuration master');
});

// GET /api/v1/csm/reports
router.get('/reports', requireApiScope('csm.read'), async (req, res) => {
    return sendSuccess(res, {
        meanTimeToRepairHours: 3.4,
        firstContactResolutionPct: 88.5,
        totalVisitsThisMonth: 142
    }, 200, 'CSM service performance report');
});

module.exports = router;
