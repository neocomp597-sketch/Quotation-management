const ServiceVisit = require('../models/ServiceVisit');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const AMC = require('../models/AMC');

const generateVisitNumber = async (companyId) => {
    const year = new Date().getFullYear();
    const prefix = 'VST';
    const counter = await Counter.findOneAndUpdate(
        { type: 'visit', companyId: companyId || null, prefix, year },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqStr}`;
};

exports.createVisit = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const visitNo = await generateVisitNumber(companyId);

        const ticket = await Ticket.findOne({ _id: req.body.ticketId, companyId });
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Only one active service visit allowed per customer
        const customerTickets = await Ticket.find({ customerId: ticket.customerId, companyId }).select('_id').lean();
        const ticketIds = customerTickets.map(t => t._id);

        const activeVisit = await ServiceVisit.findOne({
            ticketId: { $in: ticketIds },
            status: { $in: ['Scheduled', 'In Transit', 'Started'] },
            companyId
        }).lean();

        if (activeVisit) {
            return res.status(400).json({ 
                message: 'A service visit is already scheduled for this customer. Please use the Reschedule option instead of creating a new service visit.' 
            });
        }

        const visitData = {
            ...req.body,
            visitNo,
            companyId,
            status: 'Scheduled'
        };

        const visit = await ServiceVisit.create(visitData);

        // Update ticket timeline
        ticket.timeline.push({
            activityType: 'StatusChange',
            description: `Field Service Visit scheduled (${visitNo})`,
            performedBy: req.user?.id
        });
        await ticket.save({ validateBeforeSave: false });

        res.status(201).json(visit);
    } catch (error) {
        console.error('Create service visit error:', error);
        res.status(500).json({ message: error.message || 'Error scheduling service visit' });
    }
};

exports.getVisits = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { companyId };

        if (req.query.ticketId) filter.ticketId = req.query.ticketId;
        if (req.query.engineerId) filter.engineerId = req.query.engineerId;
        if (req.query.status) filter.status = req.query.status;

        if (req.query.customerId) {
            const customerTickets = await Ticket.find({ customerId: req.query.customerId, companyId }).select('_id').lean();
            filter.ticketId = { $in: customerTickets.map(t => t._id) };
        }

        const visits = await ServiceVisit.find(filter)
            .populate({
                path: 'ticketId',
                select: 'ticketNo issueTitle customerId status invoiceId manualInvoiceNo assetId pincode',
                populate: [
                    { path: 'customerId', select: 'customerName companyName' },
                    { path: 'invoiceId', select: 'voucherNumber invoiceNumber' },
                    { path: 'assetId', select: 'serialNumber' }
                ]
            })
            .populate('engineerId', 'name email')
            .sort({ scheduledDate: -1 })
            .lean();

        res.json(visits);
    } catch (error) {
        console.error('Get service visits error:', error);
        res.status(500).json({ message: error.message || 'Error fetching service visits' });
    }
};

exports.getVisitById = async (req, res) => {
    try {
        const visit = await ServiceVisit.findOne({ _id: req.params.id, companyId: req.user?.companyId })
            .populate({
                path: 'ticketId',
                populate: [
                    { path: 'customerId' },
                    { path: 'productId' }
                ]
            })
            .populate('engineerId', 'name email')
            .lean();

        if (!visit) {
            return res.status(404).json({ message: 'Service visit not found' });
        }

        res.json(visit);
    } catch (error) {
        console.error('Get service visit by ID error:', error);
        res.status(500).json({ message: error.message || 'Error fetching service visit' });
    }
};

exports.checkIn = async (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;
        const companyId = req.user?.companyId;

        const visit = await ServiceVisit.findOne({ _id: req.params.id, companyId });
        if (!visit) return res.status(404).json({ message: 'Service visit not found' });

        visit.checkIn = {
            time: new Date(),
            location: {
                lat: latitude,
                lng: longitude,
                address: address || ''
            }
        };
        visit.status = 'Started';

        await visit.save();

        const ticket = await Ticket.findOne({ _id: visit.ticketId, companyId });
        if (ticket) {
            ticket.status = 'In Progress';
            ticket.timeline.push({
                activityType: 'StatusChange',
                description: `Engineer checked-in for service visit (${visit.visitNo}) at location: ${address || 'GPS Coordinates'}`,
                performedBy: req.user?.id
            });
            await ticket.save({ validateBeforeSave: false });
        }

        res.json(visit);
    } catch (error) {
        console.error('Check-in service visit error:', error);
        res.status(500).json({ message: error.message || 'Error checking in' });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const { latitude, longitude, address, visitReport, nextAction, customerSignature, productPhoto, billingStatus, expenses, actionType } = req.body;
        const companyId = req.user?.companyId;

        const visit = await ServiceVisit.findOne({ _id: req.params.id, companyId });
        if (!visit) return res.status(404).json({ message: 'Service visit not found' });

        visit.checkOut = {
            time: new Date(),
            location: {
                lat: latitude,
                lng: longitude,
                address: address || ''
            }
        };
        visit.status = 'Completed';
        visit.visitReport = visitReport || '';
        if (nextAction) {
            visit.nextAction = nextAction;
        }
        visit.customerSignature = customerSignature || '';
        visit.productPhoto = productPhoto || '';
        visit.billingStatus = billingStatus || 'Paid';
        visit.expenses = expenses || [];

        await visit.save();

        // Increment AMC consumed visit if AMC is chosen
        if (billingStatus === 'Under AMC') {
            const ticket = await Ticket.findById(visit.ticketId).select('customerId').lean();
            if (ticket && ticket.customerId) {
                const activeAmc = await AMC.findOne({ 
                    customerId: ticket.customerId, 
                    status: 'Active', 
                    companyId 
                });
                if (activeAmc) {
                    activeAmc.visitsUsed += 1;
                    if (activeAmc.visitsUsed >= activeAmc.visitsAllowed) {
                        activeAmc.status = 'Expired';
                    }
                    await activeAmc.save();
                }
            }
        }

        const ticket = await Ticket.findOne({ _id: visit.ticketId, companyId });
        if (ticket) {
            const partChanges = (expenses || []).filter(ex => ex.isPartChange || ex.mgr5Id);
            if (partChanges.length > 0) {
                const partsSummary = partChanges.map(p => `${p.description} (Qty: ${p.quantity || 1})`).join(', ');
                ticket.timeline.push({
                    activityType: 'Part Change',
                    description: `Spare Parts Changed during Visit (${visit.visitNo}): ${partsSummary}`,
                    performedBy: req.user?.id
                });
            }

            if (actionType === 'close_visit') {
                // Only current visit is closed, ticket remains OPEN
                ticket.status = 'Open';
                ticket.timeline.push({
                    activityType: 'Visit Closed',
                    description: `Service Visit (${visit.visitNo}) closed. Next Action: ${nextAction || 'Next visit required'}`,
                    performedBy: req.user?.id
                });
            } else {
                // Ticket is closed permanently as resolved
                ticket.status = 'Closed';
                ticket.resolvedAt = new Date();
                ticket.closedAt = new Date();
                if (ticket.slaResolutionDue && new Date() > ticket.slaResolutionDue) {
                    ticket.isSlaBreached.resolution = true;
                }
                ticket.timeline.push({
                    activityType: 'Ticket Closed',
                    description: `Service Visit (${visit.visitNo}) completed and Ticket permanently closed as resolved.`,
                    performedBy: req.user?.id
                });
            }
            await ticket.save({ validateBeforeSave: false });
        }

        res.json(visit);
    } catch (error) {
        console.error('Check-out service visit error:', error);
        res.status(500).json({ message: error.message || 'Error checking out' });
    }
};

exports.rescheduleVisit = async (req, res) => {
    try {
        const { scheduledDate, engineerId, ticketType } = req.body;
        const companyId = req.user?.companyId;

        const visit = await ServiceVisit.findOne({ _id: req.params.id, companyId });
        if (!visit) {
            return res.status(404).json({ message: 'Service visit not found' });
        }

        if (['Completed', 'Cancelled'].includes(visit.status)) {
            return res.status(400).json({ message: 'Cannot reschedule a completed or cancelled service visit' });
        }

        if (scheduledDate) visit.scheduledDate = new Date(scheduledDate);
        if (engineerId) visit.engineerId = engineerId;
        if (ticketType !== undefined) visit.ticketType = ticketType;
        
        // Reset status to Scheduled and clear any check-in logs so the visit can be started anew
        visit.status = 'Scheduled';
        visit.checkIn = null;
        visit.checkOut = null;

        if (!visit.rescheduleHistory) visit.rescheduleHistory = [];
        visit.rescheduleHistory.push({
            rescheduledDate: visit.scheduledDate,
            engineerId: visit.engineerId,
            ticketType: visit.ticketType || '',
            rescheduledAt: new Date()
        });

        await visit.save();

        // Update ticket timeline
        const ticket = await Ticket.findOne({ _id: visit.ticketId, companyId });
        if (ticket) {
            let engineerName = 'Unassigned';
            if (visit.engineerId) {
                const Engineer = require('../models/Engineer');
                const eng = await Engineer.findById(visit.engineerId).select('name').lean();
                if (eng) engineerName = eng.name;
            }
            
            const typeText = visit.ticketType ? ` [Type of Ticket: ${visit.ticketType}]` : '';

            ticket.timeline.push({
                activityType: 'StatusChange',
                description: `Field Service Visit rescheduled (${visit.visitNo}) to ${new Date(visit.scheduledDate).toLocaleString()} with engineer ${engineerName}${typeText}`,
                performedBy: req.user?.id
            });
            await ticket.save({ validateBeforeSave: false });
        }

        res.json(visit);
    } catch (error) {
        console.error('Reschedule service visit error:', error);
        res.status(500).json({ message: error.message || 'Error rescheduling service visit' });
    }
};
