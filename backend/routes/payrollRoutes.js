const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { protect } = require('../middlewares/authMiddleware');
const PayrollEmployeeSummary = require('../models/PayrollEmployeeSummary');

// Middleware: Enforce admin role for general payroll management actions
const checkAdmin = (req, res, next) => {
    const { isSuperAdminRole } = require('../middlewares/authMiddleware');
    if (req.user && (req.user.role === 'admin' || isSuperAdminRole(req.user.role))) {
        return next();
    }
    return res.status(403).json({ message: 'Only admin can manage payroll' });
};

// Middleware: Allow employee to view only their own payslip summary, while admin has full access
const checkEmployeeSelfOrAdmin = async (req, res, next) => {
    try {
        const { summaryId } = req.params;
        const summary = await PayrollEmployeeSummary.findById(summaryId).lean();
        if (!summary) {
            return res.status(404).json({ message: 'Employee payroll summary not found' });
        }

        // Admins can view everything
        if (req.user && req.user.role === 'admin') {
            return next();
        }

        // Regular users (employees) can only view if their email matches the snapshot email
        if (req.user && req.user.email && summary.basicDetails?.email === req.user.email) {
            return next();
        }

        return res.status(403).json({ message: 'Access denied: You can only view your own payslip' });
    } catch (err) {
        return res.status(500).json({ message: 'Authorization check failed', error: err.message });
    }
};

// All routes are protected by auth token verification
router.use(protect);

// ─── EMPLOYEE PROFILES (Admin only) ─────────────────────────────────────────
router.get('/employees', checkAdmin, payrollController.getEmployees);
router.post('/employees', checkAdmin, payrollController.createEmployee);
router.get('/employees/:id', checkAdmin, payrollController.getEmployee);
router.put('/employees/:id', checkAdmin, payrollController.updateEmployee);
router.put('/employees/:id/structure', checkAdmin, payrollController.updateEmployeeStructure);
router.delete('/employees/:id', checkAdmin, payrollController.deleteEmployee);

// ─── SETTINGS (Admin only) ──────────────────────────────────────────────────
router.get('/settings', checkAdmin, payrollController.getSettings);
router.put('/settings', checkAdmin, payrollController.updateSettings);

// ─── MONTHLY PAYROLL RUNS ───────────────────────────────────────────────────
router.get('/runs', checkAdmin, payrollController.getRuns);
router.post('/runs', checkAdmin, payrollController.createRun);
router.get('/runs/:id', checkAdmin, payrollController.getRunDetails);
router.post('/runs/:id/calculate', checkAdmin, payrollController.calculateRun);
router.post('/runs/:id/approve', checkAdmin, payrollController.approveRun);
router.post('/runs/:id/lock', checkAdmin, payrollController.lockRun);

// Employee summary updates (Admin only)
router.put('/runs/:id/employee/:summaryId', checkAdmin, payrollController.updateEmployeeSummary);

// Recording payment slip details (Admin only)
router.put('/runs/:id/employee/:summaryId/payment', checkAdmin, payrollController.updatePaymentDetails);

// View specific employee summary (Admin or Self)
router.get('/runs/:id/employee/:summaryId', checkEmployeeSelfOrAdmin, payrollController.getEmployeeSummary);

// ─── LETTERS (Admin only) ───────────────────────────────────────────────────
router.get('/letters', checkAdmin, payrollController.getLetters);
router.post('/letters', checkAdmin, payrollController.createLetter);
router.get('/letters/:id', checkAdmin, payrollController.getLetter);
router.delete('/letters/:id', checkAdmin, payrollController.deleteLetter);

// ─── REPORTS (Admin only) ───────────────────────────────────────────────────
router.get('/reports', checkAdmin, payrollController.getReports);

// ─── AUDIT LOGS (Admin only) ────────────────────────────────────────────────
router.get('/audit-logs', checkAdmin, payrollController.getAuditLogs);

// ─── DEPARTMENTS (Admin only) ────────────────────────────────────────────────
router.get('/departments', checkAdmin, payrollController.getDepartments);
router.post('/departments', checkAdmin, payrollController.createDepartment);
router.put('/departments/:id', checkAdmin, payrollController.updateDepartment);
router.delete('/departments/:id', checkAdmin, payrollController.deleteDepartment);

// ─── DESIGNATIONS (Admin only) ────────────────────────────────────────────────
router.get('/designations', checkAdmin, payrollController.getDesignations);
router.post('/designations', checkAdmin, payrollController.createDesignation);
router.put('/designations/:id', checkAdmin, payrollController.updateDesignation);
router.delete('/designations/:id', checkAdmin, payrollController.deleteDesignation);

module.exports = router;
