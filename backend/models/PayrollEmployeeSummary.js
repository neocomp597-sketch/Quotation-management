const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PayrollEmployeeSummarySchema = new mongoose.Schema({
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile', required: true },
    month: { type: String, required: true }, // e.g. "2026-06"
    status: { type: String, enum: ['Active', 'Hold', 'Resigned'] },
    
    // Snapshots of basic details to protect history
    basicDetails: {
        name: String,
        email: String,
        dob: Date,
        pan: String,
        aadhaar: String,
        uan: String,
        pfNumber: String,
        esiNumber: String,
        bankName: String,
        accountNumber: String,
        ifscCode: String,
        department: String,
        designation: String
    },
    
    baseStructure: { type: mongoose.Schema.Types.Mixed }, // Copy of original salaryStructure
    
    // Admin Adjustments (Module 5)
    adjustments: {
        bonus: { type: Number, default: 0 },
        incentive: { type: Number, default: 0 },
        arrears: { type: Number, default: 0 },
        reimbursement: { type: Number, default: 0 },
        loanDeduction: { type: Number, default: 0 },
        advanceDeduction: { type: Number, default: 0 },
        unpaidLeaveDeduction: { type: Number, default: 0 },
        otherDeduction: { type: Number, default: 0 }
    },

    calculatedValues: {
        // Earnings
        basic: { type: Number, default: 0 },
        hra: { type: Number, default: 0 },
        da: { type: Number, default: 0 },
        specialAllowance: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 },
        incentive: { type: Number, default: 0 },
        reimbursement: { type: Number, default: 0 },
        grossSalary: { type: Number, default: 0 },
        // Deductions
        pf: { type: Number, default: 0 },
        esi: { type: Number, default: 0 },
        pt: { type: Number, default: 0 },
        tds: { type: Number, default: 0 },
        loan: { type: Number, default: 0 },
        advance: { type: Number, default: 0 },
        unpaidLeaveDeduction: { type: Number, default: 0 },
        otherDeduction: { type: Number, default: 0 },
        totalDeduction: { type: Number, default: 0 },
        // Net
        netSalary: { type: Number, default: 0 }
    },

    // Salary Payment Slip Details (Module 7)
    paymentDetails: {
        status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
        paymentMode: { type: String, enum: ['bank', 'upi', 'cash', ''], default: '' },
        paymentDate: { type: Date },
        transactionRef: { type: String, default: '' },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        receivedConfirmation: { type: Boolean, default: false }
    }
}, { timestamps: true });

PayrollEmployeeSummarySchema.plugin(tenantPlugin);

// Compound index for query efficiency
PayrollEmployeeSummarySchema.index({ companyId: 1, payrollRunId: 1 });
PayrollEmployeeSummarySchema.index({ companyId: 1, employeeId: 1 });

module.exports = mongoose.model('PayrollEmployeeSummary', PayrollEmployeeSummarySchema);
