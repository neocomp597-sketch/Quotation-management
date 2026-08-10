const express = require('express');
const router = express.Router();
const Customer = require('../../../models/Customer');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/customers - Paginated list of customers
router.get('/', requireApiScope('customers.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { customerName: searchRegex },
                { companyName: searchRegex },
                { email: searchRegex },
                { mobile: searchRegex },
                { gstin: searchRegex }
            ];
        }

        if (req.query.status) {
            filter.status = req.query.status;
        }

        const [customers, total] = await Promise.all([
            Customer.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Customer.countDocuments(filter)
        ]);

        const formatted = customers.map(c => ({
            id: c._id,
            customerName: c.customerName,
            companyName: c.companyName,
            email: c.email || '',
            mobile: c.mobile || '',
            gstin: c.gstin || '',
            pan: c.pan || '',
            industry: c.industry || 'Other',
            status: c.status || 'Prospect',
            segment: c.segment || 'Retail',
            billingAddress: c.billingAddress || {},
            shippingAddress: c.shippingAddress || {},
            createdAt: c.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching customers:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve customers', 500);
    }
});

// GET /api/v1/customers/:id - Get single customer
router.get('/:id', requireApiScope('customers.read'), async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!customer) {
            return sendError(res, 'resource_not_found', 'Customer was not found', 404);
        }

        const formatted = {
            id: customer._id,
            customerName: customer.customerName,
            companyName: customer.companyName,
            email: customer.email || '',
            mobile: customer.mobile || '',
            gstin: customer.gstin || '',
            pan: customer.pan || '',
            industry: customer.industry || 'Other',
            status: customer.status || 'Prospect',
            segment: customer.segment || 'Retail',
            billingAddress: customer.billingAddress || {},
            shippingAddress: customer.shippingAddress || {},
            createdAt: customer.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching customer by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve customer', 500);
    }
});

// POST /api/v1/customers - Create new customer
router.post('/', requireApiScope('customers.write'), async (req, res) => {
    try {
        const { customerName, companyName, email, mobile, gstin, pan, industry, status, segment, billingAddress, shippingAddress } = req.body;

        if (!customerName || !companyName) {
            return sendError(res, 'validation_error', 'customerName and companyName are required fields', 400);
        }

        const newCustomer = new Customer({
            customerName: customerName.trim(),
            companyName: companyName.trim(),
            email: email ? email.trim().toLowerCase() : '',
            mobile: mobile ? mobile.trim() : '',
            gstin: gstin ? gstin.trim().toUpperCase() : '',
            pan: pan ? pan.trim().toUpperCase() : '',
            industry: industry || 'Other',
            status: status || 'Prospect',
            segment: segment || 'Retail',
            billingAddress: billingAddress || {},
            shippingAddress: shippingAddress || {},
            companyId: req.apiClient.companyId, // ALWAYS enforce from API key
            createdBy: req.apiClient.userId
        });

        await newCustomer.save();

        const formatted = {
            id: newCustomer._id,
            customerName: newCustomer.customerName,
            companyName: newCustomer.companyName,
            email: newCustomer.email,
            mobile: newCustomer.mobile,
            gstin: newCustomer.gstin,
            pan: newCustomer.pan,
            industry: newCustomer.industry,
            status: newCustomer.status,
            segment: newCustomer.segment,
            createdAt: newCustomer.createdAt
        };

        return sendSuccess(res, formatted, 201);
    } catch (error) {
        console.error('[PublicAPI] Error creating customer:', error);
        return sendError(res, 'internal_error', 'Failed to create customer', 500);
    }
});

// PATCH /api/v1/customers/:id - Update customer
router.patch('/:id', requireApiScope('customers.write'), async (req, res) => {
    try {
        const allowedFields = ['customerName', 'companyName', 'email', 'mobile', 'gstin', 'pan', 'industry', 'status', 'segment', 'billingAddress', 'shippingAddress'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return sendError(res, 'validation_error', 'No valid fields provided for update', 400);
        }

        const updated = await Customer.findOneAndUpdate(
            { _id: req.params.id, companyId: req.apiClient.companyId },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            return sendError(res, 'resource_not_found', 'Customer was not found', 404);
        }

        const formatted = {
            id: updated._id,
            customerName: updated.customerName,
            companyName: updated.companyName,
            email: updated.email || '',
            mobile: updated.mobile || '',
            gstin: updated.gstin || '',
            pan: updated.pan || '',
            industry: updated.industry || 'Other',
            status: updated.status || 'Prospect',
            segment: updated.segment || 'Retail',
            billingAddress: updated.billingAddress || {},
            shippingAddress: updated.shippingAddress || {},
            createdAt: updated.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error updating customer:', error);
        return sendError(res, 'internal_error', 'Failed to update customer', 500);
    }
});

// DELETE /api/v1/customers/:id - Delete customer
router.delete('/:id', requireApiScope('customers.write'), async (req, res) => {
    try {
        const deleted = await Customer.findOneAndDelete({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        });

        if (!deleted) {
            return sendError(res, 'resource_not_found', 'Customer was not found', 404);
        }

        return sendSuccess(res, { id: req.params.id, deleted: true });
    } catch (error) {
        console.error('[PublicAPI] Error deleting customer:', error);
        return sendError(res, 'internal_error', 'Failed to delete customer', 500);
    }
});

module.exports = router;
