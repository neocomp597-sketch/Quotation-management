const Enquiry = require('../models/Enquiry');
const { updateActivityDate, logStatusChange } = require('../utils/activityHelper');

exports.createEnquiry = async (req, res) => {
    try {
        const { enquiryNo } = req.body;
        const exists = await Enquiry.findOne({ enquiryNo }).select('_id').lean();
        if (exists) {
            return res.status(400).json({ message: `Enquiry with number ${enquiryNo} already exists` });
        }

        const newEnquiry = new Enquiry({
            ...req.body,
            createdBy: req.user?._id,
            lastActivityDate: new Date() // Set initial activity date
        });

        await newEnquiry.save();
        res.status(201).json(newEnquiry);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllEnquiries = async (req, res) => {
    try {
        const enquiries = await Enquiry.find()
            .select('enquiryNo customerId status probability items createdBy lastActivityDate createdAt updatedAt')
            .populate('customerId', 'customerName companyName gstin')
            .populate('createdBy', 'name email')
            .populate('items.vendors', 'name')
            .populate('items.vendorQuotes.vendorId', 'name')
            .populate('items.finalVendor', 'name')
            .sort({ createdAt: -1 })
            .lean();
        res.json(enquiries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getEnquiryById = async (req, res) => {
    try {
        const { id } = req.params;
        const enquiry = await Enquiry.findById(id)
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
            .populate('items.vendors', 'name')
            .populate('items.vendorQuotes.vendorId', 'name')
            .populate('items.finalVendor', 'name')
            .lean();
        if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });
        res.json(enquiry);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateEnquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, lossReason } = req.body;

        // Get current enquiry to track status change
        const currentEnquiry = await Enquiry.findById(id);
        if (!currentEnquiry) {
            return res.status(404).json({ message: 'Enquiry not found' });
        }

        // Enforce: If changing to Lost, lossReason MUST be provided
        if (status === 'Lost' && !lossReason) {
            return res.status(400).json({
                message: 'lossReason is required when marking enquiry as Lost',
                requiredField: 'lossReason',
                validValues: ['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other']
            });
        }

        // Log status change if happening
        if (status && status !== currentEnquiry.status) {
            await logStatusChange(id, currentEnquiry.status, status, req.user?._id);
        }

        // Update enquiry (lastActivityDate will be auto-updated by Mongoose hook)
        const updatedEnquiry = await Enquiry.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true, runValidators: true }
        );

        // Ensure activity date is updated
        await updateActivityDate(id, 'status_update');

        res.json(updatedEnquiry);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteEnquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Enquiry.findByIdAndDelete(id);
        if (!result) return res.status(404).json({ message: 'Enquiry not found' });
        res.json({ message: 'Enquiry deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
