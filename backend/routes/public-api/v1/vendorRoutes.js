const express = require('express');
const router = express.Router();
const Vendor = require('../../../models/Vendor');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/vendors - List vendors
router.get('/', requireApiScope('vendors.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { name: searchRegex },
                { contactPerson: searchRegex },
                { email: searchRegex },
                { gstin: searchRegex }
            ];
        }

        const [vendors, total] = await Promise.all([
            Vendor.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Vendor.countDocuments(filter)
        ]);

        const formatted = vendors.map(v => ({
            id: v._id,
            name: v.name,
            contactPerson: v.contactPerson || '',
            phone: v.phone || '',
            email: v.email || '',
            address: v.address || '',
            gstin: v.gstin || '',
            isActive: v.isActive !== false,
            createdAt: v.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching vendors:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve vendors', 500);
    }
});

// GET /api/v1/vendors/:id - Get single vendor
router.get('/:id', requireApiScope('vendors.read'), async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!vendor) {
            return sendError(res, 'resource_not_found', 'Vendor was not found', 404);
        }

        const formatted = {
            id: vendor._id,
            name: vendor.name,
            contactPerson: vendor.contactPerson || '',
            phone: vendor.phone || '',
            email: vendor.email || '',
            address: vendor.address || '',
            gstin: vendor.gstin || '',
            isActive: vendor.isActive !== false,
            createdAt: vendor.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching vendor by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve vendor', 500);
    }
});

const { syncUserForVendor } = require('../../../services/vendorUserService');

// POST /api/v1/vendors - Create vendor
router.post('/', requireApiScope('vendors.write'), async (req, res) => {
    try {
        const { name, contactPerson, phone, email, address, gstin } = req.body;

        if (!name || !name.trim()) {
            return sendError(res, 'validation_error', 'name is a required field', 400);
        }

        const newVendor = new Vendor({
            name: name.trim(),
            contactPerson: contactPerson ? contactPerson.trim() : '',
            phone: phone ? phone.trim() : '',
            email: email ? email.trim().toLowerCase() : '',
            address: address ? address.trim() : '',
            gstin: gstin ? gstin.trim().toUpperCase() : '',
            companyId: req.apiClient.companyId
        });

        await newVendor.save();

        if (newVendor.email) {
            await syncUserForVendor(newVendor);
        }

        const formatted = {
            id: newVendor._id,
            name: newVendor.name,
            contactPerson: newVendor.contactPerson,
            phone: newVendor.phone,
            email: newVendor.email,
            gstin: newVendor.gstin,
            createdAt: newVendor.createdAt
        };

        return sendSuccess(res, formatted, 201);
    } catch (error) {
        console.error('[PublicAPI] Error creating vendor:', error);
        return sendError(res, 'internal_error', 'Failed to create vendor', 500);
    }
});

// PATCH /api/v1/vendors/:id - Update vendor
router.patch('/:id', requireApiScope('vendors.write'), async (req, res) => {
    try {
        const allowedFields = ['name', 'contactPerson', 'phone', 'email', 'address', 'gstin', 'isActive'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return sendError(res, 'validation_error', 'No valid fields provided for update', 400);
        }

        const updated = await Vendor.findOneAndUpdate(
            { _id: req.params.id, companyId: req.apiClient.companyId },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            return sendError(res, 'resource_not_found', 'Vendor was not found', 404);
        }

        const formatted = {
            id: updated._id,
            name: updated.name,
            contactPerson: updated.contactPerson || '',
            phone: updated.phone || '',
            email: updated.email || '',
            gstin: updated.gstin || '',
            isActive: updated.isActive !== false,
            createdAt: updated.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error updating vendor:', error);
        return sendError(res, 'internal_error', 'Failed to update vendor', 500);
    }
});

// DELETE /api/v1/vendors/:id - Delete vendor
router.delete('/:id', requireApiScope('vendors.write'), async (req, res) => {
    try {
        const deleted = await Vendor.findOneAndDelete({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        });

        if (!deleted) {
            return sendError(res, 'resource_not_found', 'Vendor was not found', 404);
        }

        return sendSuccess(res, { id: req.params.id, deleted: true });
    } catch (error) {
        console.error('[PublicAPI] Error deleting vendor:', error);
        return sendError(res, 'internal_error', 'Failed to delete vendor', 500);
    }
});

module.exports = router;
