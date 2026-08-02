const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const Ticket = require('../models/Ticket');
const Meeting = require('../models/Meeting');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const createContact = async (req, res) => {
    try {
        const { contactName, company, email, phone, designation, customerType, lastInteractionDate, notes } = req.body;

        if (!contactName || !contactName.trim()) {
            return res.status(400).json({ message: 'Contact Name is required' });
        }

        // Auto-generate contactId
        const lastContact = await Contact.findOne().sort({ createdAt: -1 }).select('contactId').lean();
        let nextNum = 1;
        if (lastContact && lastContact.contactId) {
            const match = lastContact.contactId.match(/^C(\d+)$/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const contactId = 'C' + String(nextNum).padStart(3, '0');

        const contact = await Contact.create({
            contactId,
            contactName: contactName.trim(),
            company,
            email,
            phone,
            designation,
            customerType,
            lastInteractionDate: lastInteractionDate || null,
            notes
        });

        res.status(201).json(contact);
    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ message: error.message || 'Error creating contact' });
    }
};

const getAllContacts = async (req, res) => {
    try {
        const filter = {};

        // Filter by customerType
        if (req.query.customerType) {
            filter.customerType = req.query.customerType;
        }

        // Search by name or company
        const search = String(req.query.search || '').trim();
        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i');
            filter.$or = [
                { contactName: regex },
                { company: regex },
                { email: regex },
                { phone: regex },
                { contactId: regex }
            ];
        }

        if (req.query.page || req.query.limit || search) {
            const { page, limit, skip } = getPagination(req.query);
            const [contacts, total] = await Promise.all([
                Contact.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Contact.countDocuments(filter)
            ]);

            return res.json({
                data: contacts,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1
                }
            });
        }

        const contacts = await Contact.find(filter)
            .sort({ createdAt: -1 })
            .lean();
        res.json(contacts);
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ message: error.message || 'Error fetching contacts' });
    }
};

const getContactById = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id).lean();
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        res.json(contact);
    } catch (error) {
        console.error('Get contact by ID error:', error);
        res.status(500).json({ message: error.message || 'Error fetching contact' });
    }
};

const updateContact = async (req, res) => {
    try {
        const { contactName, company, email, phone, designation, customerType, lastInteractionDate, notes } = req.body;

        if (typeof contactName !== 'undefined' && !String(contactName).trim()) {
            return res.status(400).json({ message: 'Contact Name cannot be empty' });
        }

        const updateData = {};
        if (typeof contactName !== 'undefined') updateData.contactName = String(contactName).trim();
        if (typeof company !== 'undefined') updateData.company = company;
        if (typeof email !== 'undefined') updateData.email = email;
        if (typeof phone !== 'undefined') updateData.phone = phone;
        if (typeof designation !== 'undefined') updateData.designation = designation;
        if (typeof customerType !== 'undefined') updateData.customerType = customerType;
        if (typeof lastInteractionDate !== 'undefined') updateData.lastInteractionDate = lastInteractionDate || null;
        if (typeof notes !== 'undefined') updateData.notes = notes;

        const updatedContact = await Contact.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedContact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json(updatedContact);
    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({ message: error.message || 'Error updating contact' });
    }
};

const deleteContact = async (req, res) => {
    try {
        const deletedContact = await Contact.findByIdAndDelete(req.params.id);

        if (!deletedContact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ message: error.message || 'Error deleting contact' });
    }
};

const getContact360Data = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Contact ID' });
        }
        const contactId = new mongoose.Types.ObjectId(id);

        const contact = await Contact.findById(id).lean();
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        const emailMatch = contact.email ? contact.email : null;

        const [customer, tickets, meetings] = await Promise.all([
            contact.company
                ? Customer.findOne({
                    $or: [
                        { companyName: new RegExp('^' + escapeRegex(contact.company) + '$', 'i') },
                        { customerName: new RegExp('^' + escapeRegex(contact.company) + '$', 'i') }
                    ]
                }).lean()
                : null,
            Ticket.find({
                $or: [
                    { contactId: contactId },
                    ...(emailMatch ? [{ customerEmail: emailMatch }] : [])
                ]
            }).sort({ createdAt: -1 }).lean(),
            Meeting.find({
                $or: [
                    { relatedRecordId: contactId },
                    ...(emailMatch ? [{ 'attendees.email': emailMatch }] : [])
                ]
            }).sort({ startDateTime: -1 }).lean()
        ]);

        const timeline = [];
        timeline.push({
            id: `create-${contact._id}`,
            type: 'system',
            title: 'Contact Profile Created',
            description: `Contact ${contact.contactName} (${contact.designation || 'No Designation'}) registered.`,
            date: contact.createdAt,
            icon: 'MdContactPhone'
        });

        if (contact.lastInteractionDate) {
            timeline.push({
                id: `interaction-${contact._id}`,
                type: 'interaction',
                title: 'Last Interaction Logged',
                description: `Interaction noted: ${contact.notes || 'No notes'}`,
                date: contact.lastInteractionDate,
                icon: 'MdMessage'
            });
        }

        meetings.forEach(m => {
            timeline.push({
                id: `meeting-${m._id}`,
                type: 'meeting',
                title: `Meeting: ${m.title}`,
                description: `Status: ${m.status || 'Scheduled'}. Agenda: ${m.agenda || 'N/A'}`,
                date: m.startDateTime || m.createdAt,
                icon: 'MdCalendarMonth'
            });
        });

        tickets.forEach(t => {
            timeline.push({
                id: `ticket-${t._id}`,
                type: 'ticket',
                title: `Ticket #${t.ticketNo}`,
                description: `Issue: ${t.issueTitle}. Status: ${t.status}`,
                date: t.createdAt,
                icon: 'MdBuildCircle'
            });
        });

        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            contact,
            customer,
            tickets,
            meetings,
            timeline,
            stats: {
                ticketCount: tickets.length,
                meetingCount: meetings.length
            }
        });
    } catch (error) {
        console.error('Get contact 360 error:', error);
        res.status(500).json({ message: error.message || 'Error fetching contact 360 data' });
    }
};

module.exports = {
    createContact,
    getAllContacts,
    getContactById,
    updateContact,
    deleteContact,
    getContact360Data
};
