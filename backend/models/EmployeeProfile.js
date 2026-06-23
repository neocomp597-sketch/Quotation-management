const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const SalaryStructureSchema = new mongoose.Schema({
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    reimbursement: { type: Number, default: 0 },
    // Deductions
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    pt: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    otherDeduction: { type: Number, default: 0 }
}, { _id: false });

const EmployeeProfileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, trim: true },
    pan: { type: String, uppercase: true, trim: true },
    aadhaar: { type: String, trim: true },
    uan: { type: String, trim: true },
    pfNumber: { type: String, trim: true },
    esiNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, uppercase: true, trim: true },
    joiningDate: { type: Date, required: true },
    dob: { type: Date },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    status: { type: String, enum: ['Active', 'Hold', 'Resigned'], default: 'Active' },
    salaryStructure: { type: SalaryStructureSchema, default: () => ({}) }
}, { timestamps: true });

EmployeeProfileSchema.plugin(tenantPlugin);
module.exports = mongoose.model('EmployeeProfile', EmployeeProfileSchema);
