const mongoose = require('mongoose');

const SalespersonSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String },
    mobile: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Salesperson', SalespersonSchema);
