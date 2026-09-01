const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const TicketTimelineSchema = new mongoose.Schema({
    activityType: { type: String, required: true },
    description: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ReassignmentHistorySchema = new mongoose.Schema({
    fromEngineerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Engineer' },
    fromEngineerName: { type: String, default: '' },
    toEngineerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Engineer', required: true },
    toEngineerName: { type: String, default: '' },
    reason: { type: String, enum: ['Leave', 'Sick', 'Emergency', 'Workload', 'Other'], required: true },
    notes: { type: String, default: '' },
    reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reassignedByName: { type: String, default: '' },
    reassignedAt: { type: Date, default: Date.now }
}, { _id: true });

const TicketCommentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const TicketSchema = new mongoose.Schema({
    ticketNo: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerContact' },
    contactName: { type: String, default: '' },
    contactDesignationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    contactDesignation: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    issueTitle: { type: String, required: true },
    description: { type: String, default: '' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketCategory', required: true },
    typeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
    priorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Priority', required: true },
    pincode: { type: String, required: true },
    assignedSalespersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isManual: { type: Boolean, default: false },
    manualInvoiceNo: { type: String, default: '' },
    manualInvoiceDate: { type: Date },
    manualProductName: { type: String, default: '' },
    source: { 
        type: String, 
        default: 'Web Portal' 
    },
    status: { 
        type: String, 
        enum: ['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed', 'Escalated', 'Cancelled'], 
        default: 'Open' 
    },
    assignedTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceTeam' },
    assignedEngineerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Engineer' },
    slaResponseDue: { type: Date },
    slaResolutionDue: { type: Date },
    firstResponseAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    escalationLevel: { type: Number, default: 0 },
    isSlaBreached: {
        response: { type: Boolean, default: false },
        resolution: { type: Boolean, default: false }
    },
    isFirstCallResolved: { type: Boolean, default: false },
    timeline: { type: [TicketTimelineSchema], default: [] },
    reassignmentHistory: { type: [ReassignmentHistorySchema], default: [] },
    comments: { type: [TicketCommentSchema], default: [] },
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String, default: '' },
        submittedAt: { type: Date }
    },
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String, default: '' },
        updatedAt: { type: Date }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

TicketSchema.pre('save', function () {
    this.updatedAt = new Date();
});

TicketSchema.index({ ticketNo: 1 });
TicketSchema.index({ customerId: 1, ticketNo: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ assignedEngineerId: 1 });
TicketSchema.index({ companyId: 1, ticketNo: 1 }, { unique: true });

TicketSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Ticket', TicketSchema);
