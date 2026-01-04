const Customer = require('../models/Customer');

// Create Customer
const createCustomer = async (req, res) => {
    try {
        const { customerName, companyName, gstin, billingAddress, shippingAddress, mobile, email, logoUrl, defaultDiscount } = req.body;

        const newCustomer = new Customer({
            customerName,
            companyName,
            gstin,
            billingAddress,
            shippingAddress,
            mobile,
            email,
            logoUrl,
            defaultDiscount,
            createdBy: req.user ? req.user.id : null
        });

        await newCustomer.save();
        res.status(201).json(newCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating customer' });
    }
};

// Get All Customers
const getAllCustomers = async (req, res) => {
    try {
        let query = {};
        if (req.user && req.user.role !== 'admin') {
            query.createdBy = req.user.id;
        }
        const customers = await Customer.find(query);
        res.json(customers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
};

// Get Customer by ID
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
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

        const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, {
            customerName,
            companyName,
            gstin,
            billingAddress,
            shippingAddress,
            mobile,
            email,
            logoUrl,
            defaultDiscount,
        }, { new: true });

        if (!updatedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(updatedCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating customer' });
    }
};

// Delete Customer
const deleteCustomer = async (req, res) => {
    try {
        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);

        if (!deletedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting customer' });
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
};
