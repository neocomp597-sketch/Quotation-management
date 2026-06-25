const CustomerContact = require('../models/CustomerContact');
const Customer = require('../models/Customer');
const Designation = require('../models/Designation');

const normalizeBoolean = (value, fallback = true) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
};

const buildPayload = (body) => ({
    customerId: body.customerId,
    contactName: String(body.contactName || '').trim(),
    designationId: body.designationId || null,
    mobileNo: String(body.mobileNo || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    isPrimary: normalizeBoolean(body.isPrimary, false),
    status: normalizeBoolean(body.status, true)
});

const validateReferences = async ({ customerId, designationId, companyId }) => {
    const customer = await Customer.findOne({ _id: customerId, companyId }).select('_id').lean();
    if (!customer) return 'Invalid customer selected';

    if (designationId) {
        const designation = await Designation.findOne({ _id: designationId, companyId }).select('_id').lean();
        if (!designation) return 'Invalid designation selected';
    }

    return null;
};

exports.create = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const payload = buildPayload(req.body);
        if (!payload.contactName) {
            return res.status(400).json({ message: 'Contact person name is required' });
        }

        const referenceError = await validateReferences({ ...payload, companyId });
        if (referenceError) return res.status(400).json({ message: referenceError });

        const contact = await CustomerContact.create({ ...payload, companyId });
        await contact.populate('designationId', 'name');
        res.status(201).json(contact);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to create customer contact' });
    }
};

exports.getAll = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { companyId };
        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.activeOnly !== 'false') filter.status = true;

        const contacts = await CustomerContact.find(filter)
            .populate('designationId', 'name')
            .sort({ isPrimary: -1, contactName: 1 })
            .lean();

        res.json(contacts);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to fetch customer contacts' });
    }
};

exports.update = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const payload = buildPayload(req.body);
        if (!payload.contactName) {
            return res.status(400).json({ message: 'Contact person name is required' });
        }

        const referenceError = await validateReferences({ ...payload, companyId });
        if (referenceError) return res.status(400).json({ message: referenceError });

        const contact = await CustomerContact.findOneAndUpdate(
            { _id: req.params.id, companyId },
            { $set: payload },
            { new: true, runValidators: true }
        ).populate('designationId', 'name');

        if (!contact) return res.status(404).json({ message: 'Customer contact not found' });
        res.json(contact);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to update customer contact' });
    }
};

exports.delete = async (req, res) => {
    try {
        const contact = await CustomerContact.findOneAndDelete({
            _id: req.params.id,
            companyId: req.user?.companyId
        });

        if (!contact) return res.status(404).json({ message: 'Customer contact not found' });
        res.json({ message: 'Customer contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to delete customer contact' });
    }
};
