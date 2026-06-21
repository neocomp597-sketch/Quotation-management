const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const TicketSourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure ticket source name is unique per tenant
TicketSourceSchema.index({ companyId: 1, name: 1 }, { unique: true });
TicketSourceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TicketSource', TicketSourceSchema);
