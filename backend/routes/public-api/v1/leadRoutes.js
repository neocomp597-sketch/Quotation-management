const express = require('express');
const router = express.Router();
const Enquiry = require('../../../models/Enquiry');
const Customer = require('../../../models/Customer');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/leads - List leads
router.get('/', requireApiScope('leads.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { enquiryNo: searchRegex },
                { companyName: searchRegex },
                { contactPerson: searchRegex },
                { contactEmail: searchRegex },
                { contactMobile: searchRegex }
            ];
        }

        if (req.query.priority) {
            filter.priority = req.query.priority;
        }

        if (req.query.status) {
            filter.overallStatus = req.query.status;
        }

        const [leads, total] = await Promise.all([
            Enquiry.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Enquiry.countDocuments(filter)
        ]);

        const formatted = leads.map(l => ({
            id: l._id,
            enquiryNo: l.enquiryNo,
            companyName: l.companyName || '',
            contactPerson: l.contactPerson || '',
            contactMobile: l.contactMobile || '',
            contactEmail: l.contactEmail || '',
            contactDesignation: l.contactDesignation || '',
            priority: l.priority || 'Medium',
            projectName: l.projectName || '',
            budget: l.budget || '',
            overallStatus: l.overallStatus || 'Active',
            totalAmount: l.grandTotal || l.totalAmount || 0,
            items: (l.items || []).map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                rate: item.rate,
                value: item.value
            })),
            createdAt: l.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching leads:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve leads', 500);
    }
});

// GET /api/v1/leads/:id - Get single lead
router.get('/:id', requireApiScope('leads.read'), async (req, res) => {
    try {
        const lead = await Enquiry.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!lead) {
            return sendError(res, 'resource_not_found', 'Lead was not found', 404);
        }

        const formatted = {
            id: lead._id,
            enquiryNo: lead.enquiryNo,
            companyName: lead.companyName || '',
            contactPerson: lead.contactPerson || '',
            contactMobile: lead.contactMobile || '',
            contactEmail: lead.contactEmail || '',
            contactDesignation: lead.contactDesignation || '',
            priority: lead.priority || 'Medium',
            projectName: lead.projectName || '',
            budget: lead.budget || '',
            overallStatus: lead.overallStatus || 'Active',
            totalAmount: lead.grandTotal || lead.totalAmount || 0,
            items: (lead.items || []).map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                rate: item.rate,
                value: item.value
            })),
            createdAt: lead.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching lead by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve lead', 500);
    }
});

// POST /api/v1/leads - Create lead
router.post('/', requireApiScope('leads.write'), async (req, res) => {
    try {
        const { companyName, contactPerson, contactMobile, contactEmail, contactDesignation, priority, projectName, budget, items } = req.body;

        if (!companyName && !contactPerson) {
            return sendError(res, 'validation_error', 'companyName or contactPerson is required', 400);
        }

        // Find or create customer entry under same company
        let customer = await Customer.findOne({
            companyId: req.apiClient.companyId,
            $or: [
                { companyName: companyName ? companyName.trim() : 'Prospect Company' },
                { mobile: contactMobile ? contactMobile.trim() : 'N/A' }
            ]
        });

        if (!customer) {
            customer = new Customer({
                customerName: contactPerson || companyName || 'New API Lead',
                companyName: companyName || contactPerson || 'New API Company',
                email: contactEmail || '',
                mobile: contactMobile || '',
                companyId: req.apiClient.companyId,
                createdBy: req.apiClient.userId
            });
            await customer.save();
        }

        const count = await Enquiry.countDocuments({ companyId: req.apiClient.companyId });
        const enquiryNo = `ENQ-API-${Date.now().toString().slice(-4)}-${count + 1}`;

        const newLead = new Enquiry({
            enquiryNo,
            customerId: customer._id,
            companyName: companyName || customer.companyName,
            contactPerson: contactPerson || customer.customerName,
            contactMobile: contactMobile || customer.mobile,
            contactEmail: contactEmail || customer.email,
            contactDesignation: contactDesignation || '',
            priority: priority || 'Medium',
            projectName: projectName || '',
            budget: budget || '',
            items: (items || []).map(i => ({
                productName: i.productName || 'General Requirement',
                quantity: parseInt(i.quantity) || 1,
                rate: parseFloat(i.rate) || 0,
                value: (parseInt(i.quantity) || 1) * (parseFloat(i.rate) || 0)
            })),
            companyId: req.apiClient.companyId,
            createdBy: req.apiClient.userId
        });

        await newLead.save();

        const formatted = {
            id: newLead._id,
            enquiryNo: newLead.enquiryNo,
            companyName: newLead.companyName,
            contactPerson: newLead.contactPerson,
            contactMobile: newLead.contactMobile,
            contactEmail: newLead.contactEmail,
            priority: newLead.priority,
            createdAt: newLead.createdAt
        };

        return sendSuccess(res, formatted, 201);
    } catch (error) {
        console.error('[PublicAPI] Error creating lead:', error);
        return sendError(res, 'internal_error', 'Failed to create lead', 500);
    }
});

// PATCH /api/v1/leads/:id - Update lead
router.patch('/:id', requireApiScope('leads.write'), async (req, res) => {
    try {
        const allowedFields = ['companyName', 'contactPerson', 'contactMobile', 'contactEmail', 'contactDesignation', 'priority', 'projectName', 'budget', 'overallStatus'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return sendError(res, 'validation_error', 'No valid fields provided for update', 400);
        }

        const updated = await Enquiry.findOneAndUpdate(
            { _id: req.params.id, companyId: req.apiClient.companyId },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            return sendError(res, 'resource_not_found', 'Lead was not found', 404);
        }

        const formatted = {
            id: updated._id,
            enquiryNo: updated.enquiryNo,
            companyName: updated.companyName,
            contactPerson: updated.contactPerson,
            contactMobile: updated.contactMobile,
            contactEmail: updated.contactEmail,
            priority: updated.priority,
            overallStatus: updated.overallStatus,
            createdAt: updated.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error updating lead:', error);
        return sendError(res, 'internal_error', 'Failed to update lead', 500);
    }
});

module.exports = router;
