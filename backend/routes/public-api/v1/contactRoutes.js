const express = require('express');
const router = express.Router();
const Contact = require('../../../models/Contact');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/contacts - List contacts
router.get('/', requireApiScope('contacts.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { contactName: searchRegex },
                { company: searchRegex },
                { email: searchRegex },
                { phone: searchRegex }
            ];
        }

        const [contacts, total] = await Promise.all([
            Contact.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Contact.countDocuments(filter)
        ]);

        const formatted = contacts.map(c => ({
            id: c._id,
            contactName: c.contactName,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            company: c.company || '',
            email: c.email || '',
            phone: c.phone || '',
            designation: c.designation || '',
            department: c.department || '',
            gstin: c.gstin || '',
            status: c.status || 'Active',
            createdAt: c.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching contacts:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve contacts', 500);
    }
});

// GET /api/v1/contacts/:id - Get single contact
router.get('/:id', requireApiScope('contacts.read'), async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!contact) {
            return sendError(res, 'resource_not_found', 'Contact was not found', 404);
        }

        const formatted = {
            id: contact._id,
            contactName: contact.contactName,
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            company: contact.company || '',
            email: contact.email || '',
            phone: contact.phone || '',
            designation: contact.designation || '',
            department: contact.department || '',
            gstin: contact.gstin || '',
            status: contact.status || 'Active',
            createdAt: contact.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching contact by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve contact', 500);
    }
});

// POST /api/v1/contacts - Create new contact
router.post('/', requireApiScope('contacts.write'), async (req, res) => {
    try {
        const { contactName, firstName, lastName, company, email, phone, designation, department, gstin } = req.body;

        const name = contactName || `${firstName || ''} ${lastName || ''}`.trim();

        if (!name) {
            return sendError(res, 'validation_error', 'contactName or (firstName/lastName) is required', 400);
        }

        const newContact = new Contact({
            contactName: name,
            firstName: firstName ? firstName.trim() : '',
            lastName: lastName ? lastName.trim() : '',
            company: company ? company.trim() : '',
            email: email ? email.trim().toLowerCase() : '',
            phone: phone ? phone.trim() : '',
            designation: designation ? designation.trim() : '',
            department: department ? department.trim() : '',
            gstin: gstin ? gstin.trim().toUpperCase() : '',
            companyId: req.apiClient.companyId,
            createdBy: req.apiClient.userId
        });

        await newContact.save();

        const formatted = {
            id: newContact._id,
            contactName: newContact.contactName,
            firstName: newContact.firstName,
            lastName: newContact.lastName,
            company: newContact.company,
            email: newContact.email,
            phone: newContact.phone,
            designation: newContact.designation,
            department: newContact.department,
            createdAt: newContact.createdAt
        };

        return sendSuccess(res, formatted, 201);
    } catch (error) {
        console.error('[PublicAPI] Error creating contact:', error);
        return sendError(res, 'internal_error', 'Failed to create contact', 500);
    }
});

module.exports = router;
