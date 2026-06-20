const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const TicketTypeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

TicketTypeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TicketType', TicketTypeSchema);
