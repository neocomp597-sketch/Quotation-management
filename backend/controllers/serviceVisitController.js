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
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqStr}`;
};

exports.createVisit = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const visitNo = await generateVisitNumber(companyId);

        const visitData = {
            ...req.body,
            visitNo,
            companyId,
            status: 'Scheduled'
        };

        const visit = await ServiceVisit.create(visitData);

        // Update ticket timeline
        const ticket = await Ticket.findOne({ _id: req.body.ticketId, companyId });
        if (ticket) {
            ticket.timeline.push({
                activityType: 'StatusChange',
                description: `Field Service Visit scheduled (${visitNo})`,
                performedBy: req.user?.id
            });
            await ticket.save();
        }

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

        const visits = await ServiceVisit.find(filter)
            .populate({
                path: 'ticketId',
                select: 'ticketNo issueTitle customerId status',
                populate: { path: 'customerId', select: 'customerName companyName' }
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
            await ticket.save();
        }

        res.json(visit);
    } catch (error) {
        console.error('Check-in service visit error:', error);
        res.status(500).json({ message: error.message || 'Error checking in' });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const { latitude, longitude, address, visitReport, customerSignature, billingStatus, expenses } = req.body;
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
        visit.customerSignature = customerSignature || '';
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
            ticket.status = 'Resolved';
            ticket.resolvedAt = new Date();
            if (ticket.slaResolutionDue && new Date() > ticket.slaResolutionDue) {
                ticket.isSlaBreached.resolution = true;
            }
            ticket.timeline.push({
                activityType: 'Resolved',
                description: `Service visit completed. Resolution details logged. Customer signature captured.`,
                performedBy: req.user?.id
            });
            await ticket.save();
        }

        res.json(visit);
    } catch (error) {
        console.error('Check-out service visit error:', error);
        res.status(500).json({ message: error.message || 'Error checking out' });
    }
};
