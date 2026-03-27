const Vendor = require('../models/Vendor');

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

        const vendors = await Vendor.find(filter).sort({ name: 1 });
        res.json(vendors);
    } catch (error) {
        console.error('Get vendors error:', error);
        res.status(500).json({ message: error.message || 'Error fetching vendors' });
    }
};

const getVendorById = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
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
