const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const Priority = require('../models/Priority');
const Customer = require('../models/Customer');
const User = require('../models/User');
const CustomerContact = require('../models/CustomerContact');

const generateTicketNumber = async (companyId) => {
    const year = new Date().getFullYear();
    const prefix = 'CSM';
    const counter = await Counter.findOneAndUpdate(
        { type: 'ticket', companyId: companyId || null, prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqStr}`;
};

exports.createTicket = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const ticketNo = await generateTicketNumber(companyId);

        // Fetch SLA times from priority
        const priority = await Priority.findOne({ _id: req.body.priorityId, companyId });
        if (!priority) {
            return res.status(400).json({ message: 'Invalid priority selected' });
        }

        const now = new Date();
        const responseDue = new Date(now.getTime() + priority.responseSlaHours * 60 * 60 * 1000);
        const resolutionDue = new Date(now.getTime() + priority.resolutionSlaHours * 60 * 60 * 1000);
        const ticketBody = { ...req.body };

        // Clean empty string values for optional ObjectId fields to avoid Cast to ObjectId errors
        const optionalObjectIdFields = ['contactId', 'contactDesignationId', 'productId', 'assetId', 'invoiceId', 'assignedTeamId', 'assignedEngineerId'];
        for (const field of optionalObjectIdFields) {
            if (ticketBody[field] === '') {
                ticketBody[field] = null;
            }
        }

        if (ticketBody.contactId) {
            const contact = await CustomerContact.findOne({
                _id: ticketBody.contactId,
                customerId: ticketBody.customerId,
                companyId
            }).populate('designationId', 'name').lean();

            if (!contact) {
                return res.status(400).json({ message: 'Invalid contact person selected' });
            }

            ticketBody.contactName = contact.contactName || '';
            ticketBody.contactDesignationId = contact.designationId?._id || null;
            ticketBody.contactDesignation = contact.designationId?.name || '';
            ticketBody.contactPhone = contact.mobileNo || '';
            ticketBody.contactEmail = contact.email || '';
        }

        const timelineEntry = {
            activityType: 'Created',
            description: `Ticket created via ${ticketBody.source || 'Web Portal'}`,
            performedBy: req.user?.id
        };

        const ticketData = {
            ...ticketBody,
            ticketNo,
            companyId,
            slaResponseDue: responseDue,
            slaResolutionDue: resolutionDue,
            timeline: [timelineEntry]
        };

        const ticket = await Ticket.create(ticketData);
        res.status(201).json(ticket);
    } catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ message: error.message || 'Error creating ticket' });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { companyId };

        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.priorityId) filter.priorityId = req.query.priorityId;
        if (req.query.assignedEngineerId) filter.assignedEngineerId = req.query.assignedEngineerId;
        
        const andConditions = [];

        if (req.query.isManual === 'true') {
            andConditions.push({
                $or: [
                    { isManual: true },
                    { manualInvoiceNo: { $exists: true, $ne: '' } },
                    { description: /--- Uploaded Images ---/ }
                ]
            });
        } else if (req.query.isManual === 'false') {
            andConditions.push({
                isManual: { $ne: true },
                manualInvoiceNo: { $in: [null, ''] },
                $or: [
                    { description: { $exists: false } },
                    { description: null },
                    { description: '' },
                    { description: { $not: /--- Uploaded Images ---/ } }
                ]
            });
        }

        const search = String(req.query.search || '').trim();
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            andConditions.push({
                $or: [
                    { ticketNo: regex },
                    { issueTitle: regex },
                    { contactName: regex }
                ]
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
        const skip = (page - 1) * limit;

        const [tickets, total] = await Promise.all([
            Ticket.find(filter)
                .populate('customerId', 'customerName companyName email mobile')
                .populate('contactDesignationId', 'name')
                .populate('categoryId', 'name')
                .populate('typeId', 'name')
                .populate('priorityId', 'name color')
                .populate('assignedTeamId', 'name')
                .populate('assignedEngineerId', 'name email')
                .populate('productId', 'productName productCode')
                .populate('assetId', 'serialNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Ticket.countDocuments(filter)
        ]);

        res.json({
            data: tickets,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ message: error.message || 'Error fetching tickets' });
    }
};

exports.getTicketById = async (req, res) => {
    try {
        if (req.params.id === 'customers') {
            return exports.getTicketCustomers(req, res);
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ticket ID format' });
        }
        const ticket = await Ticket.findOne({ _id: req.params.id, companyId: req.user?.companyId })
            .populate('customerId')
            .populate('contactId')
            .populate('contactDesignationId')
            .populate('productId')
            .populate('assetId')
            .populate('invoiceId')
            .populate('categoryId')
            .populate('typeId')
            .populate('priorityId')
            .populate('assignedTeamId')
            .populate('assignedEngineerId', 'name email role')
            .populate('timeline.performedBy', 'name email role')
            .lean();

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        res.json(ticket);
    } catch (error) {
        console.error('Get ticket details error:', error);
        res.status(500).json({ message: error.message || 'Error fetching ticket' });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const ticketBody = { ...req.body };
        const optionalObjectIdFields = ['contactId', 'contactDesignationId', 'productId', 'assetId', 'invoiceId', 'assignedTeamId', 'assignedEngineerId'];
        for (const field of optionalObjectIdFields) {
            if (ticketBody[field] === '') {
                ticketBody[field] = null;
            }
        }
        const ticket = await Ticket.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user?.companyId },
            ticketBody,
            { new: true, runValidators: true }
        );
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        res.json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.assignTicket = async (req, res) => {
    try {
        const { assignedTeamId, assignedEngineerId } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        ticket.assignedTeamId = assignedTeamId || null;
        ticket.assignedEngineerId = assignedEngineerId || null;
        
        if (ticket.status === 'Open') {
            ticket.status = 'Assigned';
        }

        let desc = 'Ticket reassigned';
        if (assignedEngineerId) {
            const eng = await User.findById(assignedEngineerId).select('name').lean();
            desc = `Ticket assigned to engineer: ${eng?.name || 'Unknown'}`;
        } else if (assignedTeamId) {
            desc = `Ticket assigned to team`;
        }

        ticket.timeline.push({
            activityType: 'Assigned',
            description: desc,
            performedBy: req.user?.id
        });

        await ticket.save();
        res.json(ticket);
    } catch (error) {
        console.error('Assign ticket error:', error);
        res.status(500).json({ message: error.message || 'Error assigning ticket' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { status, isFirstCallResolved } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const oldStatus = ticket.status;
        ticket.status = status;

        const now = new Date();

        // Check response SLA on first response transition from Open/Assigned
        if (['In Progress', 'Pending Customer', 'Resolved'].includes(status) && !ticket.firstResponseAt) {
            ticket.firstResponseAt = now;
            if (ticket.slaResponseDue && now > ticket.slaResponseDue) {
                ticket.isSlaBreached.response = true;
            }
        }

        // Manage resolution timestamps
        if (status === 'Resolved') {
            ticket.resolvedAt = now;
            if (ticket.slaResolutionDue && now > ticket.slaResolutionDue) {
                ticket.isSlaBreached.resolution = true;
            }
            if (typeof isFirstCallResolved !== 'undefined') {
                ticket.isFirstCallResolved = isFirstCallResolved === true || isFirstCallResolved === 'true';
            }
        } else if (status === 'Closed') {
            ticket.closedAt = now;
        }

        ticket.timeline.push({
            activityType: 'StatusChange',
            description: `Status changed from ${oldStatus} to ${status}`,
            performedBy: req.user?.id
        });

        await ticket.save();
        res.json(ticket);
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ message: error.message || 'Error updating status' });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { text, attachments } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const authorName = req.user?.name || 'Support Executive';
        const comment = {
            text,
            authorId: req.user?.id,
            authorName,
            attachments: attachments || [],
            createdAt: new Date()
        };

        ticket.comments.push(comment);

        ticket.timeline.push({
            activityType: 'CommentAdded',
            description: `Comment posted by ${authorName}`,
            performedBy: req.user?.id
        });

        await ticket.save();
        res.status(201).json(comment);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: error.message || 'Error adding comment' });
    }
};

exports.escalateTicket = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        ticket.escalationLevel += 1;
        ticket.status = 'Escalated';

        ticket.timeline.push({
            activityType: 'Escalated',
            description: `Ticket escalated to level ${ticket.escalationLevel}`,
            performedBy: req.user?.id
        });

        await ticket.save();
        res.json(ticket);
    } catch (error) {
        console.error('Escalate ticket error:', error);
        res.status(500).json({ message: error.message || 'Error escalating ticket' });
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        ticket.feedback = {
            rating,
            comment: comment || '',
            submittedAt: new Date()
        };

        ticket.timeline.push({
            activityType: 'Feedback',
            description: `Customer submitted feedback: Rating ${rating}/5`,
            performedBy: req.user?.id
        });

        await ticket.save();
        res.json(ticket);
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ message: error.message || 'Error submitting feedback' });
    }
};

exports.getTicketCustomers = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const uniqueCustomerIds = await Ticket.find({ companyId }).distinct('customerId');
        
        const customers = await Customer.find({ 
            _id: { $in: uniqueCustomerIds },
            companyId 
        }).select('customerName companyName email mobile').lean();
        
        res.json(customers);
    } catch (error) {
        console.error('Get ticket customers error:', error);
        res.status(500).json({ message: error.message || 'Error fetching ticket customers' });
    }
};
