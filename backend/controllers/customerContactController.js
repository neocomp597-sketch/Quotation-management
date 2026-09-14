const mongoose = require('mongoose');
const CustomerContact = require('../models/CustomerContact');
const Customer = require('../models/Customer');
const Designation = require('../models/Designation');

const normalizeBoolean = (value, fallback = true) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
};

const extractId = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val._id || val.id || null;
    return String(val).trim();
};

const buildPayload = (body) => ({
    customerId: extractId(body.customerId),
    contactName: String(body.contactName || '').trim(),
    designationId: extractId(body.designationId),
    mobileNo: String(body.mobileNo || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    isPrimary: normalizeBoolean(body.isPrimary, false),
    status: normalizeBoolean(body.status, true)
});

const validateReferences = async ({ customerId, designationId, companyId }) => {
    let resolvedCustomer = null;
    const rawCustStr = String(customerId || '').trim();
    const isMongoId = rawCustStr && mongoose.Types.ObjectId.isValid(rawCustStr) && /^[0-9a-fA-F]{24}$/.test(rawCustStr);
    
    if (isMongoId) {
        if (companyId) {
            resolvedCustomer = await Customer.findOne({ _id: rawCustStr, companyId }).select('_id companyId').lean();
        }
        if (!resolvedCustomer) {
            resolvedCustomer = await Customer.findById(rawCustStr).setOptions({ bypassTenant: true }).select('_id companyId').lean();
        }
    }
    
    if (!resolvedCustomer && rawCustStr) {
        const escaped = rawCustStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const exactRegex = new RegExp(`^${escaped}$`, 'i');
        const flexRegex = new RegExp(escaped, 'i');
        
        if (companyId) {
            resolvedCustomer = await Customer.findOne({
                companyId,
                $or: [
                    { externalCode: exactRegex },
                    { companyName: exactRegex },
                    { customerName: exactRegex },
                    { companyName: flexRegex },
                    { customerName: flexRegex }
                ]
            }).select('_id companyId').lean();
        }

        if (!resolvedCustomer) {
            resolvedCustomer = await Customer.findOne({
                $or: [
                    { externalCode: exactRegex },
                    { companyName: exactRegex },
                    { customerName: exactRegex },
                    { companyName: flexRegex },
                    { customerName: flexRegex }
                ]
            }).setOptions({ bypassTenant: true }).select('_id companyId').lean();
        }
    }

    if (!resolvedCustomer) return { error: 'Invalid customer selected' };

    let resolvedDesignationId = null;
    if (designationId) {
        const rawDesigStr = String(designationId || '').trim();
        const isDesigId = rawDesigStr && mongoose.Types.ObjectId.isValid(rawDesigStr) && /^[0-9a-fA-F]{24}$/.test(rawDesigStr);
        if (isDesigId) {
            let designation = null;
            if (companyId) {
                designation = await Designation.findOne({ _id: rawDesigStr, companyId }).select('_id').lean();
            }
            if (!designation) {
                designation = await Designation.findById(rawDesigStr).setOptions({ bypassTenant: true }).select('_id').lean();
            }
            if (designation) resolvedDesignationId = designation._id;
        }
        
        if (!resolvedDesignationId && rawDesigStr) {
            const escaped = rawDesigStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            let designation = null;
            if (companyId) {
                designation = await Designation.findOne({ companyId, name: new RegExp(`^${escaped}$`, 'i') }).select('_id').lean();
            }
            if (!designation) {
                designation = await Designation.findOne({ name: new RegExp(`^${escaped}$`, 'i') }).setOptions({ bypassTenant: true }).select('_id').lean();
            }
            if (designation) {
                resolvedDesignationId = designation._id;
            } else {
                try {
                    const newDes = await Designation.create({
                        name: rawDesigStr,
                        ...(companyId ? { companyId } : {})
                    });
                    resolvedDesignationId = newDes._id;
                } catch (e) {
                    console.error('Auto-create designation failed:', e);
                }
            }
        }
    }

    return { 
        resolvedCustomerId: resolvedCustomer._id, 
        resolvedCompanyId: resolvedCustomer.companyId || companyId,
        resolvedDesignationId
    };
};

exports.create = async (req, res) => {
    try {
        const userCompanyId = req.user?.companyId;
        const payload = buildPayload(req.body);
        if (!payload.contactName) {
            return res.status(400).json({ message: 'Contact person name is required' });
        }

        if (payload.mobileNo) {
            let cleanMobile = String(payload.mobileNo || '').trim().replace(/[\s\-\(\)]/g, '');
            if (cleanMobile.startsWith('+91')) cleanMobile = cleanMobile.slice(3);
            else if (cleanMobile.startsWith('91') && cleanMobile.length > 10) cleanMobile = cleanMobile.slice(2);
            else if (cleanMobile.startsWith('0') && cleanMobile.length === 11) cleanMobile = cleanMobile.slice(1);
            cleanMobile = cleanMobile.replace(/\D/g, '');

            if (cleanMobile.length !== 10) {
                return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number.' });
            }
            payload.mobileNo = cleanMobile;
        } else {
            payload.mobileNo = '';
        }

        const refResult = await validateReferences({ customerId: payload.customerId, designationId: payload.designationId, companyId: userCompanyId });
        if (refResult.error) return res.status(400).json({ message: refResult.error });

        payload.customerId = refResult.resolvedCustomerId;
        payload.designationId = refResult.resolvedDesignationId || null;
        const targetCompanyId = refResult.resolvedCompanyId || userCompanyId;

        const contact = await CustomerContact.create({ ...payload, ...(targetCompanyId ? { companyId: targetCompanyId } : {}) });
        await contact.populate('designationId', 'name');
        res.status(201).json(contact);
    } catch (error) {
        console.error('Error creating customer contact:', error);
        res.status(500).json({ message: error.message || 'Failed to create customer contact' });
    }
};

exports.getAll = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = {};
        let rawCustId = null;

        if (req.query.customerId) {
            rawCustId = typeof req.query.customerId === 'object' 
                ? (req.query.customerId._id || req.query.customerId.id) 
                : req.query.customerId;
            filter.customerId = rawCustId;
        } else if (companyId && req.user?.role !== 'super_admin') {
            filter.companyId = companyId;
        }
        if (req.query.activeOnly !== 'false') filter.status = true;

        let contacts = await CustomerContact.find(filter)
            .populate('designationId', 'name')
            .sort({ isPrimary: -1, contactName: 1 })
            .lean();

        if (contacts.length === 0 && rawCustId) {
            contacts = await CustomerContact.find({ customerId: rawCustId, ...(req.query.activeOnly !== 'false' ? { status: true } : {}) })
                .setOptions({ bypassTenant: true })
                .populate('designationId', 'name')
                .sort({ isPrimary: -1, contactName: 1 })
                .lean();
        }

        // If still no contacts found, attempt resolving Customer by name or code
        if (contacts.length === 0 && rawCustId && typeof rawCustId === 'string') {
            const escaped = String(rawCustId).trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (escaped) {
                const resolvedCustomer = await Customer.findOne({
                    $or: [
                        { externalCode: new RegExp(`^${escaped}$`, 'i') },
                        { companyName: new RegExp(`^${escaped}$`, 'i') },
                        { customerName: new RegExp(`^${escaped}$`, 'i') }
                    ]
                }).setOptions({ bypassTenant: true }).select('_id').lean();

                if (resolvedCustomer) {
                    contacts = await CustomerContact.find({ customerId: resolvedCustomer._id, ...(req.query.activeOnly !== 'false' ? { status: true } : {}) })
                        .setOptions({ bypassTenant: true })
                        .populate('designationId', 'name')
                        .sort({ isPrimary: -1, contactName: 1 })
                        .lean();
                }
            }
        }

        res.json(contacts);
    } catch (error) {
        console.error('Error fetching customer contacts:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch customer contacts' });
    }
};

exports.update = async (req, res) => {
    try {
        const userCompanyId = req.user?.companyId;
        const payload = buildPayload(req.body);
        if (!payload.contactName) {
            return res.status(400).json({ message: 'Contact person name is required' });
        }

        if (payload.mobileNo) {
            const cleanMobile = payload.mobileNo.replace(/\D/g, '');
            if (cleanMobile.length !== 10) {
                return res.status(400).json({ message: 'Invalid Mobile Number. Please enter a valid 10-digit mobile number' });
            }
            payload.mobileNo = cleanMobile;
        }

        const refResult = await validateReferences({ customerId: payload.customerId, designationId: payload.designationId, companyId: userCompanyId });
        if (refResult.error) return res.status(400).json({ message: refResult.error });
        payload.customerId = refResult.resolvedCustomerId;
        if (refResult.resolvedDesignationId) payload.designationId = refResult.resolvedDesignationId;

        const queryFilter = { _id: req.params.id };
        if (userCompanyId && req.user?.role !== 'super_admin') {
            queryFilter.companyId = userCompanyId;
        }

        const contact = await CustomerContact.findOneAndUpdate(
            queryFilter,
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
        const queryFilter = { _id: req.params.id };
        if (req.user?.companyId && req.user?.role !== 'super_admin') {
            queryFilter.companyId = req.user.companyId;
        }

        const contact = await CustomerContact.findOneAndDelete(queryFilter);
        if (!contact) return res.status(404).json({ message: 'Customer contact not found' });
        res.json({ message: 'Customer contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to delete customer contact' });
    }
};
