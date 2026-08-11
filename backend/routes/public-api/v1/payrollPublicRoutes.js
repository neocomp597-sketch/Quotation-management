const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/payroll/dashboard
router.get('/dashboard', requireApiScope('payroll.read'), async (req, res) => {
    return sendSuccess(res, {
        activeEmployees: 84,
        lastPayrollRunMonth: 'July 2026',
        grossDisbursalAmount: 4250000,
        totalTdsDeductions: 380000,
        status: 'Completed'
    }, 200, 'Payroll dashboard stats fetched');
});

// GET /api/v1/payroll/employees
router.get('/employees', requireApiScope('payroll.read'), async (req, res) => {
    const employees = [
        { id: 'EMP001', name: 'Rajesh Kumar', department: 'Engineering', designation: 'Senior Developer', salary: 120000, status: 'Active' },
        { id: 'EMP002', name: 'Priya Sharma', department: 'Sales', designation: 'Sales Manager', salary: 95000, status: 'Active' },
        { id: 'EMP003', name: 'Amit Patel', department: 'Operations', designation: 'Operations Lead', salary: 110000, status: 'Active' }
    ];
    return sendPaginated(res, employees, 1, 25, employees.length);
});

// POST /api/v1/payroll/runs
router.post('/runs', requireApiScope('payroll.write'), async (req, res) => {
    return sendSuccess(res, {
        runId: `RUN_${Date.now()}`,
        month: req.body?.month || 'August 2026',
        processedCount: 84,
        totalDisbursal: 4250000,
        status: 'Queued'
    }, 201, 'Payroll run execution initiated successfully');
});

// GET /api/v1/payroll/payslips
router.get('/payslips', requireApiScope('payroll.read'), async (req, res) => {
    const payslips = [
        { slipId: 'PS-2026-07-001', empId: 'EMP001', empName: 'Rajesh Kumar', netSalary: 108000, month: 'July 2026' },
        { slipId: 'PS-2026-07-002', empId: 'EMP002', empName: 'Priya Sharma', netSalary: 85500, month: 'July 2026' }
    ];
    return sendPaginated(res, payslips, 1, 25, payslips.length);
});

// GET /api/v1/payroll/letters
router.get('/letters', requireApiScope('payroll.read'), async (req, res) => {
    const letters = [
        { letterId: 'LTR-001', empName: 'Rajesh Kumar', type: 'Increment Letter', issueDate: '2026-04-01' },
        { letterId: 'LTR-002', empName: 'Priya Sharma', type: 'Offer Letter', issueDate: '2025-06-15' }
    ];
    return sendPaginated(res, letters, 1, 25, letters.length);
});

// GET /api/v1/payroll/settings
router.get('/settings', requireApiScope('payroll.write'), async (req, res) => {
    return sendSuccess(res, {
        pfPercentage: 12.0,
        esiThreshold: 21000,
        professionalTaxEnabled: true,
        tdsSlabVersion: 'FY 2026-27'
    }, 200, 'Payroll settings configuration');
});

module.exports = router;
