const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PayrollLetterSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile' },
    type: {
        type: String,
        enum: ['offer', 'appointment', 'increment', 'promotion', 'salary_certificate', 'experience', 'relieving'],
        required: true
    },
    recipientName: { type: String, required: true },
    recipientEmail: { type: String },
    content: { type: String, required: true }, // Compiled rich HTML/Text
    metadata: { type: mongoose.Schema.Types.Mixed }, // Arbitrary input variables (designation, salary increment etc.)
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

PayrollLetterSchema.plugin(tenantPlugin);
module.exports = mongoose.model('PayrollLetter', PayrollLetterSchema);
