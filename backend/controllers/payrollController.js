const EmployeeProfile = require('../models/EmployeeProfile');
const PayrollSettings = require('../models/PayrollSettings');
const PayrollRun = require('../models/PayrollRun');
const PayrollEmployeeSummary = require('../models/PayrollEmployeeSummary');
const PayrollLetter = require('../models/PayrollLetter');
const PayrollAuditLog = require('../models/PayrollAuditLog');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Company = require('../models/Company');
const { getTenantId } = require('../middlewares/tenantContext');
const mongoose = require('mongoose');
const { broadcastCrmUpdate } = require('../config/socket');

const getEffectiveCompanyId = async (req) => {
    let companyId = req.query?.companyId || req.headers?.['x-company-id'] || req.body?.companyId || req.user?.companyId || getTenantId?.();
    if (!companyId) {
        const firstCompany = await Company.findOne().lean();
        if (firstCompany) {
            companyId = firstCompany._id;
        }
    }
    return companyId?.toString ? companyId.toString() : companyId;
};

// Helper to write to PayrollAuditLog
const writePayrollAudit = async (req, action, details, targetId = null, targetType = null) => {
    try {
        await PayrollAuditLog.create({
            actorId: req.user.id,
            actorEmail: req.user.email,
            action,
            details,
            targetId,
            targetType
        });
    } catch (err) {
        console.error('Failed to write payroll audit log:', err.message);
    }
};

// Check if a payroll month run is locked
const isRunLocked = async (payrollRunId) => {
    const run = await PayrollRun.findById(payrollRunId).select('status').lean();
    return run && run.status === 'locked';
};

// Core Calculation Helper
const calculateEmployeePayrollValues = (baseStructure, adjustments, settings) => {
    const isManual = settings.calculationType === 'manual';
    
    // Earnings (if manual, base structure earnings are ignored and start from 0)
    const basic = isManual ? (adjustments.basic || 0) : (baseStructure.basic || 0);
    const hra = isManual ? (adjustments.hra || 0) : (baseStructure.hra || 0);
    const da = isManual ? (adjustments.da || 0) : (baseStructure.da || 0);
    const specialAllowance = isManual ? (adjustments.specialAllowance || 0) : (baseStructure.specialAllowance || 0);
    
    // Adjustments added to earnings
    const bonus = (isManual ? 0 : (baseStructure.bonus || 0)) + (adjustments.bonus || 0);
    const incentive = (isManual ? 0 : (baseStructure.incentive || 0)) + (adjustments.incentive || 0);
    const reimbursement = (isManual ? 0 : (baseStructure.reimbursement || 0)) + (adjustments.reimbursement || 0);
    const arrears = adjustments.arrears || 0;

    const grossSalary = basic + hra + da + specialAllowance + bonus + incentive + reimbursement + arrears;

    // Deductions
    const pf = (settings.pfEnabled && !isManual) ? (baseStructure.pf || 0) : 0;
    const esi = (settings.esiEnabled && !isManual) ? (baseStructure.esi || 0) : 0;
    const pt = (settings.ptEnabled && !isManual) ? (baseStructure.pt || 0) : 0;
    const tds = (settings.tdsEnabled && !isManual) ? (baseStructure.tds || 0) : 0;

    const loan = (isManual ? 0 : (baseStructure.loan || 0)) + (adjustments.loanDeduction || 0);
    const advance = (isManual ? 0 : (baseStructure.advance || 0)) + (adjustments.advanceDeduction || 0);
    const otherDeduction = (isManual ? 0 : (baseStructure.otherDeduction || 0)) + (adjustments.otherDeduction || 0);
    const unpaidLeaveDeduction = adjustments.unpaidLeaveDeduction || 0;

    const totalDeduction = pf + esi + pt + tds + loan + advance + otherDeduction + unpaidLeaveDeduction;
    const netSalary = Math.max(0, grossSalary - totalDeduction);

    return {
        basic,
        hra,
        da,
        specialAllowance,
        bonus,
        incentive,
        reimbursement,
        grossSalary,
        pf,
        esi,
        pt,
        tds,
        loan,
        advance,
        unpaidLeaveDeduction,
        otherDeduction,
        totalDeduction,
        netSalary
    };
};

// ─── EMPLOYEE PROFILES ──────────────────────────────────────────────────────

exports.getEmployees = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const query = companyId ? { companyId } : {};
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.branchId) {
            query.$or = [
                { branchId: req.query.branchId },
                { assignedBranches: req.query.branchId }
            ];
        }
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }
        
        const employees = await EmployeeProfile.find(query)
            .populate('reportingTo', 'name email designation')
            .populate('branchId', 'name code branchPrefix')
            .populate('assignedBranches', 'name code branchPrefix')
            .sort({ name: 1 })
            .lean();
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load employees', error: error.message });
    }
};

exports.getEmployee = async (req, res) => {
    try {
        const employee = await EmployeeProfile.findById(req.params.id)
            .populate('reportingTo', 'name email designation')
            .populate('branchId', 'name code branchPrefix')
            .populate('assignedBranches', 'name code branchPrefix')
            .lean();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load employee details', error: error.message });
    }
};

const validateEmployeeFieldsBackend = (data) => {
    if (data.mobile && data.mobile.trim()) {
        const cleanMobile = data.mobile.trim().replace(/\D/g, '');
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(cleanMobile)) {
            return 'Invalid Mobile Number. Must be a valid 10-digit number starting with 6-9 (e.g. 9876543210)';
        }
    }
    if (data.pan && data.pan.trim()) {
        const cleanPan = data.pan.trim().toUpperCase();
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(cleanPan)) {
            return 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)';
        }
    }
    if (data.aadhaar && data.aadhaar.trim()) {
        const cleanAadhaar = data.aadhaar.trim().replace(/\D/g, '');
        const aadhaarRegex = /^\d{12}$/;
        if (!aadhaarRegex.test(cleanAadhaar)) {
            return 'Invalid Aadhaar number. Must be a 12-digit numeric code.';
        }
    }
    if (data.uan && data.uan.trim()) {
        const cleanUan = data.uan.trim().replace(/\D/g, '');
        const uanRegex = /^\d{12}$/;
        if (!uanRegex.test(cleanUan)) {
            return 'Invalid UAN number. Must be a 12-digit numeric code.';
        }
    }
    if (data.pfNumber && data.pfNumber.trim()) {
        const cleanPf = data.pfNumber.trim().toUpperCase();
        const pfRegex = /^([A-Z]{2}\/?[A-Z]{3}\/?[0-9]{7}\/?[0-9]{3}\/?[0-9]{7}|[A-Z0-9\/]{10,25})$/i;
        if (!pfRegex.test(cleanPf)) {
            return 'Invalid PF Account No format (e.g. MH/BAN/0012345/000/0000123)';
        }
    }
    if (data.esiNumber && data.esiNumber.trim()) {
        const cleanEsi = data.esiNumber.trim().replace(/\D/g, '');
        const esiRegex = /^\d{17}$/;
        if (!esiRegex.test(cleanEsi)) {
            return 'Invalid ESI Number. Must be a 17-digit numeric code.';
        }
    }
    if (data.ifscCode && data.ifscCode.trim()) {
        const cleanIfsc = data.ifscCode.trim().toUpperCase();
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(cleanIfsc)) {
            return 'Invalid IFSC Code format (e.g. SBIN0001234)';
        }
    }
    return null;
};

exports.createEmployee = async (req, res) => {
    try {
        const employeeData = { ...req.body };
        if (!employeeData.companyId && req.user?.companyId) {
            employeeData.companyId = req.user.companyId;
        }

        // Validate formats
        const validationError = validateEmployeeFieldsBackend(employeeData);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        if (Array.isArray(employeeData.assignedBranches)) {
            employeeData.assignedBranches = Array.from(new Set(employeeData.assignedBranches.filter(Boolean)));
        } else if (employeeData.branchId) {
            employeeData.assignedBranches = [employeeData.branchId];
        }
        if (!employeeData.branchId && employeeData.assignedBranches?.length) {
            employeeData.branchId = employeeData.assignedBranches[0];
        }

        if (employeeData.branchId) {
            const { generateNextUniqueEmployeeId } = require('../utils/employeeIdHelper');
            const { employeeId, branchPrefix } = await generateNextUniqueEmployeeId(employeeData.companyId, employeeData.branchId);
            employeeData.branchPrefix = branchPrefix;
            if (!employeeData.employeeId) {
                employeeData.employeeId = employeeId;
            }
        }

        if (employeeData.employeeId) {
            const existingEmp = await EmployeeProfile.findOne({ employeeId: employeeData.employeeId, companyId: employeeData.companyId }).lean();
            if (existingEmp) {
                return res.status(400).json({ message: `Duplicate Employee ID '${employeeData.employeeId}' is not allowed` });
            }
        }

        const employee = await EmployeeProfile.create(employeeData);
        
        // Requirement: Auto User Creation on Employee Addition
        const { syncUserForEmployee } = require('../services/employeeUserService');
        await syncUserForEmployee(employee);

        // Auto-sync Service Engineer to Engineers Master
        const { syncEmployeeToEngineer } = require('../services/engineerSyncService');
        await syncEmployeeToEngineer(employee);

        await writePayrollAudit(req, 'EMPLOYEE_CREATED', `Created employee profile for ${employee.name}`, employee._id, 'EmployeeProfile');
        
        const populatedEmployee = await EmployeeProfile.findById(employee._id)
            .populate('reportingTo', 'name email designation')
            .populate('branchId', 'name code branchPrefix')
            .populate('assignedBranches', 'name code branchPrefix')
            .lean();
        res.status(201).json(populatedEmployee || employee);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create employee profile', error: error.message });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.employeeId;
        if (Array.isArray(updateData.assignedBranches)) {
            updateData.assignedBranches = Array.from(new Set(updateData.assignedBranches.filter(Boolean)));
            updateData.branchId = updateData.branchId || updateData.assignedBranches[0] || null;
        } else if (updateData.branchId) {
            updateData.assignedBranches = [updateData.branchId];
        }
        // Rule 4: If branch is changed later, Employee ID should NOT change.

        // Validate formats
        const validationError = validateEmployeeFieldsBackend(updateData);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const employee = await EmployeeProfile.findByIdAndUpdate(
            req.params.id, 
            { $set: updateData }, 
            { new: true }
        )
        .populate('reportingTo', 'name email designation')
        .populate('branchId', 'name code branchPrefix')
        .populate('assignedBranches', 'name code branchPrefix');
        
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        
        // Auto-sync User account if email present
        const { syncUserForEmployee } = require('../services/employeeUserService');
        await syncUserForEmployee(employee);

        // Auto-sync details/status to CSM Engineers Master
        const { syncEmployeeToEngineer } = require('../services/engineerSyncService');
        await syncEmployeeToEngineer(employee);

        await writePayrollAudit(req, 'EMPLOYEE_UPDATED', `Updated details for employee ${employee.name}`, employee._id, 'EmployeeProfile');
        broadcastCrmUpdate('EMPLOYEE', 'UPDATE', employee);
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update employee details', error: error.message });
    }
};

exports.syncEmployeeUsers = async (req, res) => {
    try {
        const { syncUsersForExistingEmployees } = require('../services/employeeUserService');
        const companyId = req.user?.companyId || null;
        const result = await syncUsersForExistingEmployees(companyId);
        res.json({ message: 'User sync complete for existing employees', ...result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to sync users for employees', error: error.message });
    }
};

exports.updateEmployeeStructure = async (req, res) => {
    try {
        const employee = await EmployeeProfile.findByIdAndUpdate(
            req.params.id,
            { $set: { salaryStructure: req.body } },
            { new: true }
        );
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        await writePayrollAudit(req, 'STRUCTURE_UPDATED', `Updated salary structure for ${employee.name}`, employee._id, 'EmployeeProfile');
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update salary structure', error: error.message });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        // Check if employee has summaries in locked runs
        const summaryInLockedRun = await PayrollEmployeeSummary.findOne({ employeeId: req.params.id })
            .populate({ path: 'payrollRunId', select: 'status' })
            .lean();
        
        if (summaryInLockedRun && summaryInLockedRun.payrollRunId?.status === 'locked') {
            return res.status(400).json({ message: 'Cannot delete employee profile associated with locked payroll months' });
        }

        const employee = await EmployeeProfile.findByIdAndDelete(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Clean up pending summaries in draft runs
        await PayrollEmployeeSummary.deleteMany({ employeeId: req.params.id });

        // Update corresponding Engineer record to Inactive if exists
        const Engineer = require('../models/Engineer');
        await Engineer.updateMany({ employeeId: req.params.id }, { status: 'Inactive' });

        await writePayrollAudit(req, 'EMPLOYEE_DELETED', `Deleted employee profile for ${employee.name}`, req.params.id, 'EmployeeProfile');
        res.json({ message: 'Employee profile deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete employee profile', error: error.message });
    }
};

// ─── PAYROLL SETTINGS ───────────────────────────────────────────────────────

exports.getSettings = async (req, res) => {
    try {
        let settings = await PayrollSettings.findOne().lean();
        if (!settings) {
            // Seed default settings on first load
            settings = await PayrollSettings.create({
                currentMonth: new Date().toISOString().substring(0, 7),
                calculationType: 'fixed',
                pfEnabled: true,
                esiEnabled: true,
                ptEnabled: true,
                tdsEnabled: true,
                payslipFormat: 'format1',
                lockDate: 25
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load payroll settings', error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        let settings = await PayrollSettings.findOne();
        if (!settings) {
            settings = new PayrollSettings(req.body);
            await settings.save();
        } else {
            Object.assign(settings, req.body);
            await settings.save();
        }
        await writePayrollAudit(req, 'SETTINGS_UPDATED', 'Updated global payroll settings', settings._id, 'PayrollSettings');
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update payroll settings', error: error.message });
    }
};

// ─── PAYROLL MONTH RUNS ─────────────────────────────────────────────────────

exports.getRuns = async (req, res) => {
    try {
        const runs = await PayrollRun.find().sort({ month: -1 }).lean();
        res.json(runs);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load payroll runs', error: error.message });
    }
};

exports.createRun = async (req, res) => {
    try {
        const { month } = req.body;
        if (!month) {
            return res.status(400).json({ message: 'Month is required' });
        }

        const companyId = await getEffectiveCompanyId(req);

        // Check if run already exists
        const existingRun = await PayrollRun.findOne({ month, companyId }).lean();
        if (existingRun) {
            return res.status(400).json({ message: `Payroll run for ${month} already exists` });
        }

        // Fetch settings
        const settings = await PayrollSettings.findOne({ companyId }).lean() || { calculationType: 'fixed', pfEnabled: true, esiEnabled: true, ptEnabled: true, tdsEnabled: true };

        // Fetch all active/hold employees for this organization
        const employees = await EmployeeProfile.find({ companyId, status: { $in: ['Active', 'Hold'] } }).lean();
        if (employees.length === 0) {
            return res.status(400).json({ message: 'No active employees to generate payroll for' });
        }

        // Create the run
        const payrollRun = await PayrollRun.create({
            month,
            status: 'draft',
            calculatedBy: req.user.id
        });

        // Generate employee summaries
        const summaries = employees.map(emp => {
            const baseStructure = emp.salaryStructure || {};
            const defaultAdjustments = {
                bonus: 0, incentive: 0, arrears: 0, reimbursement: 0,
                loanDeduction: 0, advanceDeduction: 0, unpaidLeaveDeduction: 0, otherDeduction: 0
            };
            
            // System calculates values based on settings
            const calculated = calculateEmployeePayrollValues(baseStructure, defaultAdjustments, settings);

            return {
                payrollRunId: payrollRun._id,
                employeeId: emp._id,
                month,
                status: emp.status,
                basicDetails: {
                    name: emp.name,
                    email: emp.email,
                    dob: emp.dob,
                    pan: emp.pan,
                    aadhaar: emp.aadhaar,
                    uan: emp.uan,
                    pfNumber: emp.pfNumber,
                    esiNumber: emp.esiNumber,
                    bankName: emp.bankName,
                    accountNumber: emp.accountNumber,
                    ifscCode: emp.ifscCode,
                    department: emp.department,
                    designation: emp.designation,
                    workerType: emp.workerType || 'PERMANENT WORKER',
                    employeeType: emp.employeeType || 'ONSITE'
                },
                baseStructure,
                adjustments: defaultAdjustments,
                calculatedValues: calculated,
                paymentDetails: {
                    status: 'pending',
                    paymentMode: '',
                    transactionRef: '',
                    receivedConfirmation: false
                }
            };
        });

        await PayrollEmployeeSummary.insertMany(summaries);
        await writePayrollAudit(req, 'RUN_CREATED', `Initialized payroll run for month ${month}`, payrollRun._id, 'PayrollRun');

        res.status(201).json(payrollRun);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create payroll run', error: error.message });
    }
};

exports.getRunDetails = async (req, res) => {
    try {
        const run = await PayrollRun.findById(req.params.id).lean();
        if (!run) {
            return res.status(404).json({ message: 'Payroll run not found' });
        }

        const summaries = await PayrollEmployeeSummary.find({ payrollRunId: run._id })
            .populate('employeeId', 'status salaryStructure')
            .lean();

        res.json({ run, summaries });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load payroll run details', error: error.message });
    }
};

exports.getEmployeeSummary = async (req, res) => {
    try {
        const summary = await PayrollEmployeeSummary.findById(req.params.summaryId).lean();
        if (!summary) {
            return res.status(404).json({ message: 'Employee payroll summary not found' });
        }
        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load employee payroll summary', error: error.message });
    }
};

exports.updateEmployeeSummary = async (req, res) => {
    try {
        const summary = await PayrollEmployeeSummary.findById(req.params.summaryId);
        if (!summary) {
            return res.status(404).json({ message: 'Employee summary not found' });
        }

        if (await isRunLocked(summary.payrollRunId)) {
            return res.status(400).json({ message: 'Cannot modify employee adjustments/values because this payroll month is locked' });
        }

        const adjustments = req.body.adjustments || summary.adjustments;
        const baseStructure = summary.baseStructure || {};
        const settings = await PayrollSettings.findOne().lean() || { calculationType: 'fixed', pfEnabled: true, esiEnabled: true, ptEnabled: true, tdsEnabled: true };

        const calculated = calculateEmployeePayrollValues(baseStructure, adjustments, settings);

        summary.adjustments = adjustments;
        summary.calculatedValues = calculated;
        
        // Allow overriding basicDetails/status snapshot if admin requested
        if (req.body.basicDetails) {
            summary.basicDetails = { ...summary.basicDetails, ...req.body.basicDetails };
        }
        if (req.body.status) {
            summary.status = req.body.status;
        }

        await summary.save();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update employee summary values', error: error.message });
    }
};

exports.calculateRun = async (req, res) => {
    try {
        const runId = req.params.id;
        if (await isRunLocked(runId)) {
            return res.status(400).json({ message: 'Cannot recalculate because this payroll month is locked' });
        }

        const settings = await PayrollSettings.findOne().lean() || { calculationType: 'fixed', pfEnabled: true, esiEnabled: true, ptEnabled: true, tdsEnabled: true };
        const summaries = await PayrollEmployeeSummary.find({ payrollRunId: runId });

        for (const summary of summaries) {
            summary.calculatedValues = calculateEmployeePayrollValues(
                summary.baseStructure || {},
                summary.adjustments || {},
                settings
            );
            await summary.save();
        }

        await writePayrollAudit(req, 'RUN_RECALCULATED', 'Recalculated salary figures for all run summaries', runId, 'PayrollRun');
        res.json({ message: 'Recalculated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Recalculation failed', error: error.message });
    }
};

exports.approveRun = async (req, res) => {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) {
            return res.status(404).json({ message: 'Payroll run not found' });
        }

        if (run.status === 'locked') {
            return res.status(400).json({ message: 'Locked runs are already approved and locked' });
        }

        run.status = 'approved';
        run.approvedBy = req.user.id;
        run.approvedAt = new Date();
        await run.save();

        await writePayrollAudit(req, 'RUN_APPROVED', `Approved payroll run for month ${run.month}`, run._id, 'PayrollRun');
        res.json(run);
    } catch (error) {
        res.status(500).json({ message: 'Failed to approve payroll run', error: error.message });
    }
};

exports.lockRun = async (req, res) => {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) {
            return res.status(404).json({ message: 'Payroll run not found' });
        }

        run.status = 'locked';
        run.lockedBy = req.user.id;
        run.lockedAt = new Date();
        await run.save();

        await writePayrollAudit(req, 'RUN_LOCKED', `Locked payroll run for month ${run.month}`, run._id, 'PayrollRun');
        res.json(run);
    } catch (error) {
        res.status(500).json({ message: 'Failed to lock payroll run', error: error.message });
    }
};

exports.updatePaymentDetails = async (req, res) => {
    try {
        const summary = await PayrollEmployeeSummary.findById(req.params.summaryId);
        if (!summary) {
            return res.status(404).json({ message: 'Employee summary not found' });
        }

        // Lock constraint: The summary MUST belong to a locked or approved payroll run to record payment details.
        // Wait, the requirement says: "Admin records payment slip after lock". 
        // We can allow recording payment details in locked state. Wait, does payment detail change count as editing the salary? 
        // Salary numbers (calculated values) cannot be edited once locked. But recording transaction references and marking as paid
        // is explicitly allowed after lock!
        
        const run = await PayrollRun.findById(summary.payrollRunId).lean();
        if (!run) {
            return res.status(404).json({ message: 'Run not found' });
        }

        const payment = req.body.paymentDetails || {};
        summary.paymentDetails = {
            status: payment.status || 'paid',
            paymentMode: payment.paymentMode || 'bank',
            paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
            transactionRef: payment.transactionRef || '',
            paidBy: req.user.id,
            receivedConfirmation: payment.receivedConfirmation !== undefined ? Boolean(payment.receivedConfirmation) : false
        };

        await summary.save();
        await writePayrollAudit(req, 'PAYMENT_RECORDED', `Recorded payment slip for ${summary.basicDetails.name} in month ${summary.month}`, summary._id, 'PayrollEmployeeSummary');
        
        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update payment details', error: error.message });
    }
};

// ─── LETTERS ────────────────────────────────────────────────────────────────

exports.getLetters = async (req, res) => {
    try {
        const letters = await PayrollLetter.find()
            .populate('employeeId', 'name designation')
            .sort({ createdAt: -1 })
            .lean();
        res.json(letters);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load letters', error: error.message });
    }
};

exports.getLetter = async (req, res) => {
    try {
        const letter = await PayrollLetter.findById(req.params.id)
            .populate('employeeId')
            .lean();
        if (!letter) {
            return res.status(404).json({ message: 'Letter not found' });
        }
        res.json(letter);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load letter details', error: error.message });
    }
};

exports.createLetter = async (req, res) => {
    try {
        const { employeeId, type, recipientName, recipientEmail, content, metadata } = req.body;
        const letter = await PayrollLetter.create({
            employeeId: employeeId || null,
            type,
            recipientName,
            recipientEmail,
            content,
            metadata,
            generatedBy: req.user.id
        });

        await writePayrollAudit(req, 'LETTER_GENERATED', `Generated ${type} letter for ${recipientName}`, letter._id, 'PayrollLetter');
        res.status(201).json(letter);
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate letter', error: error.message });
    }
};

exports.deleteLetter = async (req, res) => {
    try {
        const letter = await PayrollLetter.findByIdAndDelete(req.params.id);
        if (!letter) {
            return res.status(404).json({ message: 'Letter not found' });
        }
        await writePayrollAudit(req, 'LETTER_DELETED', `Deleted letter ID ${req.params.id}`, req.params.id, 'PayrollLetter');
        res.json({ message: 'Letter deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete letter', error: error.message });
    }
};

// ─── REPORTS ────────────────────────────────────────────────────────────────

exports.getReports = async (req, res) => {
    try {
        const { type, month, employeeId } = req.query;

        if (type === 'monthly-register') {
            if (!month) return res.status(400).json({ message: 'Month is required' });
            const data = await PayrollEmployeeSummary.find({ month }).lean();
            return res.json(data);
        }

        if (type === 'employee-history') {
            if (!employeeId) return res.status(400).json({ message: 'Employee ID is required' });
            const data = await PayrollEmployeeSummary.find({ employeeId }).sort({ month: 1 }).lean();
            return res.json(data);
        }

        if (type === 'deductions') {
            if (!month) return res.status(400).json({ message: 'Month is required' });
            const data = await PayrollEmployeeSummary.find({ month })
                .select('basicDetails calculatedValues')
                .lean();
            
            // Calculate totals
            const totals = data.reduce((acc, curr) => {
                const cv = curr.calculatedValues || {};
                acc.pf += cv.pf || 0;
                acc.esi += cv.esi || 0;
                acc.pt += cv.pt || 0;
                acc.tds += cv.tds || 0;
                acc.total += (cv.pf || 0) + (cv.esi || 0) + (cv.pt || 0) + (cv.tds || 0);
                return acc;
            }, { pf: 0, esi: 0, pt: 0, tds: 0, total: 0 });

            return res.json({ totals, register: data });
        }

        if (type === 'adjustments') {
            if (!month) return res.status(400).json({ message: 'Month is required' });
            const data = await PayrollEmployeeSummary.find({ month })
                .select('basicDetails adjustments')
                .lean();
            
            const totals = data.reduce((acc, curr) => {
                const adj = curr.adjustments || {};
                acc.bonus += adj.bonus || 0;
                acc.incentive += adj.incentive || 0;
                acc.arrears += adj.arrears || 0;
                acc.reimbursement += adj.reimbursement || 0;
                acc.total += (adj.bonus || 0) + (adj.incentive || 0) + (adj.arrears || 0) + (adj.reimbursement || 0);
                return acc;
            }, { bonus: 0, incentive: 0, arrears: 0, reimbursement: 0, total: 0 });

            return res.json({ totals, register: data });
        }

        if (type === 'loans-advances') {
            if (!month) return res.status(400).json({ message: 'Month is required' });
            const data = await PayrollEmployeeSummary.find({ month })
                .select('basicDetails adjustments')
                .lean();

            const totals = data.reduce((acc, curr) => {
                const adj = curr.adjustments || {};
                acc.loanDeduction += adj.loanDeduction || 0;
                acc.advanceDeduction += adj.advanceDeduction || 0;
                acc.unpaidLeaveDeduction += adj.unpaidLeaveDeduction || 0;
                acc.total += (adj.loanDeduction || 0) + (adj.advanceDeduction || 0) + (adj.unpaidLeaveDeduction || 0);
                return acc;
            }, { loanDeduction: 0, advanceDeduction: 0, unpaidLeaveDeduction: 0, total: 0 });

            return res.json({ totals, register: data });
        }

        if (type === 'department-wise') {
            if (!month) return res.status(400).json({ message: 'Month is required' });
            const data = await PayrollEmployeeSummary.find({ month }).lean();

            const depts = {};
            data.forEach(item => {
                const deptName = item.basicDetails?.department || 'Unassigned';
                const net = item.calculatedValues?.netSalary || 0;
                const gross = item.calculatedValues?.grossSalary || 0;
                const deduction = item.calculatedValues?.totalDeduction || 0;

                if (!depts[deptName]) {
                    depts[deptName] = { department: deptName, net: 0, gross: 0, deduction: 0, count: 0 };
                }
                depts[deptName].net += net;
                depts[deptName].gross += gross;
                depts[deptName].deduction += deduction;
                depts[deptName].count += 1;
            });

            return res.json(Object.values(depts));
        }

        if (type === 'payments') {
            if (!month) return res.status(400).json({ message: 'Month is required' });
            const data = await PayrollEmployeeSummary.find({ month })
                .select('basicDetails calculatedValues paymentDetails')
                .lean();
            
            const summary = data.reduce((acc, curr) => {
                const isPaid = curr.paymentDetails?.status === 'paid';
                const net = curr.calculatedValues?.netSalary || 0;
                if (isPaid) {
                    acc.paidAmount += net;
                    acc.paidCount += 1;
                } else {
                    acc.pendingAmount += net;
                    acc.pendingCount += 1;
                }
                acc.totalAmount += net;
                acc.totalCount += 1;
                return acc;
            }, { paidAmount: 0, paidCount: 0, pendingAmount: 0, pendingCount: 0, totalAmount: 0, totalCount: 0 });

            return res.json({ summary, payments: data });
        }

        res.status(400).json({ message: 'Invalid or missing report type parameter' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate report data', error: error.message });
    }
};

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await PayrollAuditLog.find()
            .populate('actorId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load payroll audit logs', error: error.message });
    }
};

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

exports.getDepartments = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }
        let query = { companyId };
        let departments = await Department.find(query).sort({ name: 1 }).lean();
        if (departments.length === 0) {
            const defaults = [
                { name: 'Sales Department', description: 'Sales and business development', companyId },
                { name: 'Support Department', description: 'Customer support and service', companyId },
                { name: 'Marketing Department', description: 'Marketing and brand management', companyId },
                { name: 'Accounts Department', description: 'Finance, accounts, and tax', companyId },
                { name: 'HR Department', description: 'Human resources and recruitment', companyId }
            ];
            await Department.insertMany(defaults, { bypassTenant: true });
            departments = await Department.find(query).sort({ name: 1 }).lean();
        }
        res.json(departments);
    } catch (error) {
        console.error('getDepartments error:', error);
        res.status(500).json({ message: 'Failed to load departments', error: error.message });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const existing = await Department.findOne({
            ...(companyId ? { companyId } : {}),
            name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') }
        }).lean();
        if (existing) {
            return res.status(400).json({ message: 'Department with this name already exists' });
        }
        const dept = await Department.create({ ...req.body, companyId });
        broadcastCrmUpdate('DEPARTMENT', 'CREATE', dept);
        res.status(201).json(dept);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create department', error: error.message });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        if (req.body.name) {
            const existing = await Department.findOne({
                ...(companyId ? { companyId } : {}),
                _id: { $ne: req.params.id },
                name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') }
            }).lean();
            if (existing) {
                return res.status(400).json({ message: 'Another department with this name already exists' });
            }
        }
        const dept = await Department.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        broadcastCrmUpdate('DEPARTMENT', 'UPDATE', dept);
        res.json(dept);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update department', error: error.message });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const dept = await Department.findById(req.params.id);
        if (!dept) {
            return res.status(404).json({ message: 'Department not found' });
        }
        const empCount = await EmployeeProfile.countDocuments({
            ...(companyId ? { companyId } : {}),
            department: dept.name
        });
        if (empCount > 0) {
            return res.status(400).json({ message: `Cannot delete department because it is currently assigned to ${empCount} employee(s)` });
        }
        await Department.findByIdAndDelete(req.params.id);
        broadcastCrmUpdate('DEPARTMENT', 'DELETE', { id: req.params.id });
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete department', error: error.message });
    }
};

// ─── DESIGNATIONS ────────────────────────────────────────────────────────────

exports.getDesignations = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }
        let query = { companyId };
        let designations = await Designation.find(query).sort({ name: 1 }).lean();
        if (designations.length === 0) {
            const defaults = [
                { name: 'Sales Executive', description: 'Sales executive role', companyId },
                { name: 'Sales Manager', description: 'Managing sales team', companyId },
                { name: 'Accounts Executive', description: 'Finance and billing executive', companyId },
                { name: 'HR Manager', description: 'Human resources head', companyId },
                { name: 'Software Engineer', description: 'Developer and engineering role', companyId }
            ];
            await Designation.insertMany(defaults, { bypassTenant: true });
            designations = await Designation.find(query).sort({ name: 1 }).lean();
        }
        res.json(designations);
    } catch (error) {
        console.error('getDesignations error:', error);
        res.status(500).json({ message: 'Failed to load designations', error: error.message });
    }
};

exports.createDesignation = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const existing = await Designation.findOne({
            ...(companyId ? { companyId } : {}),
            name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') }
        }).lean();
        if (existing) {
            return res.status(400).json({ message: 'Designation with this name already exists' });
        }
        const des = await Designation.create({ ...req.body, companyId });
        res.status(201).json(des);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create designation', error: error.message });
    }
};

exports.updateDesignation = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        if (req.body.name) {
            const existing = await Designation.findOne({
                ...(companyId ? { companyId } : {}),
                _id: { $ne: req.params.id },
                name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') }
            }).lean();
            if (existing) {
                return res.status(400).json({ message: 'Another designation with this name already exists' });
            }
        }
        const des = await Designation.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(des);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update designation', error: error.message });
    }
};

exports.deleteDesignation = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const des = await Designation.findById(req.params.id);
        if (!des) {
            return res.status(404).json({ message: 'Designation not found' });
        }
        const empCount = await EmployeeProfile.countDocuments({
            ...(companyId ? { companyId } : {}),
            designation: des.name
        });
        if (empCount > 0) {
            return res.status(400).json({ message: `Cannot delete designation because it is currently assigned to ${empCount} employee(s)` });
        }
        await Designation.findByIdAndDelete(req.params.id);
        res.json({ message: 'Designation deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete designation', error: error.message });
    }
};

// ─── EMPLOYEE MY PAYSLIPS (For logged-in employees) ───────────────────────

exports.getMyPayslips = async (req, res) => {
    try {
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.json([]);
        }

        const emailStr = String(userEmail).trim().toLowerCase();
        const escapedEmail = emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        const summaries = await PayrollEmployeeSummary.find({
            'basicDetails.email': { $regex: new RegExp("^" + escapedEmail + "$", "i") }
        })
        .populate({
            path: 'payrollRunId',
            select: 'month status totalNetSalary'
        })
        .sort({ createdAt: -1 })
        .lean();

        const validSummaries = summaries.filter(s => 
            s.payrollRunId && ['approved', 'locked'].includes(s.payrollRunId.status)
        );

        res.json(validSummaries);
    } catch (error) {
        console.error('getMyPayslips error:', error);
        res.status(500).json({ message: 'Failed to load employee payslips', error: error.message });
    }
};

exports.getPublicSettings = async (req, res) => {
    try {
        let settings = await PayrollSettings.findOne().lean();
        if (!settings) {
            settings = { pfEnabled: true, esiEnabled: true, ptEnabled: true, tdsEnabled: true };
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load payroll settings', error: error.message });
    }
};

// ─── BATCH ASSIGN BRANCH & EMPLOYEE ID ──────────────────────────────────────
exports.batchAssignBranchAndEmployeeId = async (req, res) => {
    try {
        const { assignments } = req.body; // Array of { employeeId_db: string, branchId: string, customEmployeeId?: string }
        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ message: 'No employee assignments provided' });
        }

        const Branch = require('../models/Branch');
        const Counter = require('../models/Counter');
        const { syncUserForEmployee } = require('../services/employeeUserService');
        const { syncEmployeeToEngineer } = require('../services/engineerSyncService');

        const companyId = req.user?.companyId;
        const updatedEmployees = [];

        for (const item of assignments) {
            const emp = await EmployeeProfile.findById(item.employeeId_db);
            if (!emp) continue;

            let targetBranchId = item.branchId || emp.branchId;
            if (!targetBranchId) continue;

            const branch = await Branch.findById(targetBranchId).lean();
            if (!branch) continue;

            emp.branchId = branch._id;
            emp.branchPrefix = branch.branchPrefix;

            // Generate Employee ID if empty or custom requested
            if (item.customEmployeeId) {
                emp.employeeId = item.customEmployeeId.trim();
            } else if (!emp.employeeId) {
                const { generateNextUniqueEmployeeId } = require('../utils/employeeIdHelper');
                const { employeeId } = await generateNextUniqueEmployeeId(companyId, branch._id);
                emp.employeeId = employeeId;
            }

            await emp.save();
            await syncUserForEmployee(emp);
            await syncEmployeeToEngineer(emp);
            updatedEmployees.push(emp);
        }

        await writePayrollAudit(req, 'EMPLOYEE_BATCH_BRANCH_ASSIGN', `Assigned branch and employee ID for ${updatedEmployees.length} employees`, null, 'EmployeeProfile');
        res.json({ message: `Successfully updated ${updatedEmployees.length} employees`, count: updatedEmployees.length });
    } catch (error) {
        console.error('batchAssignBranchAndEmployeeId error:', error);
        res.status(500).json({ message: 'Failed to batch assign branch and employee IDs', error: error.message });
    }
};

// ─── REASSIGN REPORTING MANAGER (DRAG & DROP) ────────────────────────────────
exports.updateReportingManager = async (req, res) => {
    try {
        const { id } = req.params;
        const { reportingTo } = req.body; // Can be ObjectId or null

        const emp = await EmployeeProfile.findById(id);
        if (!emp) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Prevent circular reporting loop (direct and transitive)
        if (reportingTo) {
            if (String(reportingTo) === String(id)) {
                return res.status(400).json({ message: 'An employee cannot report to themselves' });
            }

            // Traverse up from the target manager to see if they report to the current employee
            let currentManagerId = reportingTo;
            const visited = new Set([String(id)]);
            while (currentManagerId) {
                if (visited.has(String(currentManagerId))) {
                    return res.status(400).json({ message: 'Circular reporting loop detected: The selected manager reports back to this employee' });
                }
                visited.add(String(currentManagerId));

                const manager = await EmployeeProfile.findById(currentManagerId).select('reportingTo').lean();
                if (!manager) break;
                currentManagerId = manager.reportingTo;
            }
        }

        emp.reportingTo = reportingTo || null;
        await emp.save();

        const populated = await EmployeeProfile.findById(id)
            .populate('reportingTo', 'name email designation')
            .populate('branchId', 'name code branchPrefix')
            .populate('assignedBranches', 'name code branchPrefix')
            .lean();

        await writePayrollAudit(req, 'REPORTING_MANAGER_UPDATED', `Reassigned reporting manager for ${emp.name}`, emp._id, 'EmployeeProfile');
        broadcastCrmUpdate('EMPLOYEE', 'UPDATE', populated);
        res.json(populated);
    } catch (error) {
        console.error('updateReportingManager error:', error);
        res.status(500).json({ message: 'Failed to update reporting manager', error: error.message });
    }
};

// ─── VACANT POSITION MANAGE ────────────────────────────────────────────────
exports.createVacantPosition = async (req, res) => {
    try {
        const { name, designation, department, branchId, reportingTo } = req.body;
        const companyId = req.user?.companyId;

        const vacantEmp = await EmployeeProfile.create({
            name: name || `Vacant - ${designation || 'Position'}`,
            designation: designation || 'Open Position',
            department: department || 'General',
            branchId: branchId || null,
            reportingTo: reportingTo || null,
            joiningDate: new Date(),
            status: 'Vacant',
            isVacant: true,
            companyId
        });

        const populated = await EmployeeProfile.findById(vacantEmp._id)
            .populate('reportingTo', 'name email designation')
            .populate('branchId', 'name code branchPrefix')
            .populate('assignedBranches', 'name code branchPrefix')
            .lean();

        await writePayrollAudit(req, 'VACANT_POSITION_CREATED', `Created vacant position ${vacantEmp.name}`, vacantEmp._id, 'EmployeeProfile');
        broadcastCrmUpdate('EMPLOYEE', 'CREATE', populated);
        res.status(201).json(populated);
    } catch (error) {
        console.error('createVacantPosition error:', error);
        res.status(500).json({ message: 'Failed to create vacant position', error: error.message });
    }
};

// ─── UPDATE KRA & PERFORMANCE METRICS ──────────────────────────────────────
exports.updateEmployeeKra = async (req, res) => {
    try {
        const { id } = req.params;
        const { kraList } = req.body; // Array of KRA items

        const emp = await EmployeeProfile.findById(id);
        if (!emp) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        emp.kraList = kraList || [];
        await emp.save();

        res.json({ message: 'KRA updated successfully', kraList: emp.kraList });
    } catch (error) {
        console.error('updateEmployeeKra error:', error);
        res.status(500).json({ message: 'Failed to update KRA', error: error.message });
    }
};




