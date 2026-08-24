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

const KraSchema = new mongoose.Schema({
    title: { type: String, required: true },
    weightage: { type: Number, default: 0 },
    target: { type: String, default: '' },
    achievement: { type: String, default: '' },
    status: { type: String, enum: ['On Track', 'Needs Attention', 'Exceeded', 'Behind'], default: 'On Track' }
}, { _id: true });

const FamilyMemberSchema = new mongoose.Schema({
    relation: { type: String, enum: ['Father', 'Mother', 'Spouse', 'Wife', 'Husband', 'Child', 'Son', 'Daughter', 'Sibling', 'Other'], default: 'Other' },
    name: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    aadhaarNumber: { type: String, trim: true, default: '' },
    panNumber: { type: String, trim: true, uppercase: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
    isEmergencyContact: { type: Boolean, default: false }
}, { _id: true });

const EmployeeProfileSchema = new mongoose.Schema({
    employeeId: { type: String, trim: true, index: true },
    externalEmployeeCode: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
    photo: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branchPrefix: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true },
    email: { type: String, trim: true },
    mobile: { type: String, trim: true },
    reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile', default: null },
    pan: { type: String, uppercase: true, trim: true },
    aadhaar: { type: String, trim: true },
    uan: { type: String, trim: true },
    pfNumber: { type: String, trim: true },
    esiNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, uppercase: true, trim: true },
    joiningDate: { type: Date, required: true },
    lastWorkingDate: { type: Date, default: null },
    dob: { type: Date },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    workerType: { type: String, trim: true, default: 'PERMANENT WORKER' },
    employeeType: { type: String, trim: true, default: 'ONSITE' },
    status: { type: String, enum: ['Active', 'Hold', 'Resigned', 'Vacant'], default: 'Active' },
    isVacant: { type: Boolean, default: false },
    familyDetails: [FamilyMemberSchema],
    kraList: [KraSchema],
    salaryStructure: { type: SalaryStructureSchema, default: () => ({}) }
}, { timestamps: true });

EmployeeProfileSchema.plugin(tenantPlugin);
module.exports = mongoose.model('EmployeeProfile', EmployeeProfileSchema);
