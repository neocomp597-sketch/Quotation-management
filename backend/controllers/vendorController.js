const Vendor = require('../models/Vendor');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const createVendor = async (req, res) => {
    try {
        const { name, contactPerson, phone, email, address, isActive } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Vendor name is required' });
        }

        const vendor = await Vendor.create({
            name: name.trim(),
            contactPerson,
            phone,
            email,
            address,
            isActive
        });

        res.status(201).json(vendor);
    } catch (error) {
        console.error('Create vendor error:', error);
        res.status(500).json({ message: error.message || 'Error creating vendor' });
    }
};

const getAllVendors = async (req, res) => {
    try {
        const filter = {};
        if (typeof req.query.active !== 'undefined') {
            filter.isActive = req.query.active === 'true';
        }
        const search = String(req.query.search || '').trim();
        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i');
            filter.$or = [
                { name: regex },
                { contactPerson: regex },
                { phone: regex },
                { email: regex },
                { gstin: regex }
            ];
        }

        if (req.query.page || req.query.limit || search) {
            const { page, limit, skip } = getPagination(req.query);
            const [vendors, total] = await Promise.all([
                Vendor.find(filter)
                    .select('name contactPerson phone email address gstin isActive createdAt updatedAt')
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Vendor.countDocuments(filter)
            ]);

            return res.json({
                data: vendors,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1
                }
            });
        }

        const vendors = await Vendor.find(filter)
            .select('name contactPerson phone email address gstin isActive createdAt updatedAt')
            .sort({ name: 1 })
            .lean();
        res.json(vendors);
    } catch (error) {
        console.error('Get vendors error:', error);
        res.status(500).json({ message: error.message || 'Error fetching vendors' });
    }
};

const getVendorById = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id)
            .select('name contactPerson phone email address gstin isActive createdAt updatedAt')
            .lean();
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        res.json(vendor);
    } catch (error) {
        console.error('Get vendor by ID error:', error);
        res.status(500).json({ message: error.message || 'Error fetching vendor' });
    }
};

const updateVendor = async (req, res) => {
    try {
        const { name, contactPerson, phone, email, address, isActive } = req.body;

        if (typeof name !== 'undefined' && !String(name).trim()) {
            return res.status(400).json({ message: 'Vendor name cannot be empty' });
        }

        const updatedVendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            {
                ...(typeof name !== 'undefined' ? { name: String(name).trim() } : {}),
                ...(typeof contactPerson !== 'undefined' ? { contactPerson } : {}),
                ...(typeof phone !== 'undefined' ? { phone } : {}),
                ...(typeof email !== 'undefined' ? { email } : {}),
                ...(typeof address !== 'undefined' ? { address } : {}),
                ...(typeof isActive !== 'undefined' ? { isActive } : {}),
            },
            { new: true, runValidators: true }
        );

        if (!updatedVendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        res.json(updatedVendor);
    } catch (error) {
        console.error('Update vendor error:', error);
        res.status(500).json({ message: error.message || 'Error updating vendor' });
    }
};

const deleteVendor = async (req, res) => {
    try {
        const deletedVendor = await Vendor.findByIdAndDelete(req.params.id);

        if (!deletedVendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error('Delete vendor error:', error);
        res.status(500).json({ message: error.message || 'Error deleting vendor' });
    }
};

module.exports = {
    createVendor,
    getAllVendors,
    getVendorById,
    updateVendor,
    deleteVendor
};
