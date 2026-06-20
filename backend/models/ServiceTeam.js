const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ServiceTeamSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

ServiceTeamSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ServiceTeam', ServiceTeamSchema);
