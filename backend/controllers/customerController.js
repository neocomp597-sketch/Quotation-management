const Customer = require('../models/Customer');
const { invalidateCustomerCaches } = require('../utils/cacheInvalidation');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    return { page, limit, skip: (page - 1) * limit };
};

const hasListParams = (query) => Boolean(query.page || query.limit || query.search);

const buildCustomerQuery = (req) => {
    const query = {};
    if (req.user && req.user.role !== 'admin') {
        query.createdBy = req.user.id;
    }

    const search = String(req.query.search || '').trim();
    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        query.$or = [
            { customerName: regex },
            { companyName: regex },
            { gstin: regex },
            { mobile: regex },
            { email: regex },
        ];
    }

    return query;
};

const findDuplicateCustomer = async (payload, excludeId) => {
    const checks = [];
    if (payload.gstin?.trim()) checks.push({ gstin: payload.gstin.trim().toUpperCase() });
    if (payload.mobile?.trim()) checks.push({ mobile: payload.mobile.trim() });
    if (payload.email?.trim()) checks.push({ email: payload.email.trim().toLowerCase() });
    if (!checks.length) return null;

    const query = { $or: checks };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }

    return Customer.findOne(query).select('companyName customerName gstin mobile email').lean();
};

// Create Customer
const createCustomer = async (req, res) => {
    try {
        const { customerName, companyName, gstin, billingAddress, shippingAddress, mobile, email, logoUrl, defaultDiscount } = req.body;
        const duplicate = await findDuplicateCustomer({ gstin, mobile, email });
        if (duplicate) {
            return res.status(409).json({
                message: 'Customer already exists with same GSTIN, mobile, or email',
                duplicate
            });
        }

        const newCustomer = new Customer({
            customerName,
            companyName,
            gstin: gstin?.trim().toUpperCase(),
            billingAddress,
            shippingAddress,
            mobile,
            email: email?.trim().toLowerCase(),
            logoUrl,
            defaultDiscount,
            createdBy: req.user ? req.user.id : null
        });

        await newCustomer.save();
        await invalidateCustomerCaches();
        res.status(201).json(newCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating customer' });
    }
};

// Get All Customers
const getAllCustomers = async (req, res) => {
    try {
        const query = buildCustomerQuery(req);

        if (!hasListParams(req.query) && req.query.all !== 'false') {
            const customers = await Customer.find(query)
                .select('customerName companyName gstin billingAddress mobile email logoUrl defaultDiscount createdAt')
                .sort({ createdAt: -1 })
                .lean();
            return res.json(customers);
        }

        const { page, limit, skip } = getPagination(req.query);
        const [customers, total] = await Promise.all([
            Customer.find(query)
                .select('customerName companyName gstin billingAddress mobile email logoUrl defaultDiscount createdAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Customer.countDocuments(query),
        ]);

        res.json({
            data: customers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
};

// Get Customer by ID
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id)
            .select('customerName companyName gstin billingAddress shippingAddress mobile email logoUrl defaultDiscount createdAt')
            .lean();
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customer' });
    }
};

// Update Customer
const updateCustomer = async (req, res) => {
    try {
        const { customerName, companyName, gstin, billingAddress, shippingAddress, mobile, email, logoUrl, defaultDiscount } = req.body;
        const duplicate = await findDuplicateCustomer({ gstin, mobile, email }, req.params.id);
        if (duplicate) {
            return res.status(409).json({
                message: 'Customer already exists with same GSTIN, mobile, or email',
                duplicate
            });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, {
            customerName,
            companyName,
            gstin: gstin?.trim().toUpperCase(),
            billingAddress,
            shippingAddress,
            mobile,
            email: email?.trim().toLowerCase(),
            logoUrl,
            defaultDiscount,
        }, { new: true }).lean();

        if (!updatedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        await invalidateCustomerCaches();
        res.json(updatedCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating customer' });
    }
};

// Delete Customer
const deleteCustomer = async (req, res) => {
    try {
        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id).lean();

        if (!deletedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        await invalidateCustomerCaches();
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting customer' });
    }
};

// Bulk Delete Customers
const bulkDeleteCustomers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of customer IDs' });
        }

        const result = await Customer.deleteMany({ _id: { $in: ids } });
        await invalidateCustomerCaches();

        res.json({
            message: `${result.deletedCount} customers deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting customers' });
    }
};

// Bulk Update Customers
const bulkUpdateCustomers = async (req, res) => {
    try {
        const { ids, updateData } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of customer IDs' });
        }

        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'Please provide update data' });
        }

        const result = await Customer.updateMany(
            { _id: { $in: ids } },
            { $set: updateData }
        );
        await invalidateCustomerCaches();

        res.json({
            message: `${result.modifiedCount} customers updated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating customers' });
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    bulkUpdateCustomers,
};
