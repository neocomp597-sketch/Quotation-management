const Enquiry = require('../models/Enquiry');
const { updateActivityDate, logStatusChange } = require('../utils/activityHelper');

const cleanEnquiryBody = (body) => {
    if (!body) return body;
    
    // Clean header fields
    if (body.assignedTo === '') {
        delete body.assignedTo;
    }
    if (body.followUpDate === '') {
        delete body.followUpDate;
    }
    
    // Clean items
    if (Array.isArray(body.items)) {
        body.items = body.items.map(item => {
            const cleanedItem = { ...item };
            if (cleanedItem.finalVendor === '') {
                delete cleanedItem.finalVendor;
            }
            if (Array.isArray(cleanedItem.vendors)) {
                cleanedItem.vendors = cleanedItem.vendors.filter(v => v !== '');
            }
            if (Array.isArray(cleanedItem.vendorQuotes)) {
                cleanedItem.vendorQuotes = cleanedItem.vendorQuotes.map(vq => {
                    const cleanedVq = { ...vq };
                    if (cleanedVq.vendorId === '') {
                        delete cleanedVq.vendorId;
                    }
                    if (cleanedVq.price === '') {
                        delete cleanedVq.price;
                    }
                    return cleanedVq;
                }).filter(vq => vq.vendorId);
            }
            return cleanedItem;
        });
    }
    return body;
};

exports.createEnquiry = async (req, res) => {
    try {
        req.body = cleanEnquiryBody(req.body);
        const { enquiryNo } = req.body;
        const exists = await Enquiry.findOne({ enquiryNo }).select('_id').lean();
        if (exists) {
            console.error(`[Enquiry Create Error] Enquiry with number ${enquiryNo} already exists`);
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
        console.error('[Enquiry Create Error] Exception caught during save:', err);
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
        console.error('[Enquiry Fetch Error] Exception caught:', err);
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
        console.error('[Enquiry Fetch ID Error] Exception caught:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.updateEnquiry = async (req, res) => {
    try {
        req.body = cleanEnquiryBody(req.body);
        const { id } = req.params;
        const { status, lossReason } = req.body;

        // Get current enquiry to track status change
        const currentEnquiry = await Enquiry.findById(id);
        if (!currentEnquiry) {
            return res.status(404).json({ message: 'Enquiry not found' });
        }

        // Enforce: If changing to Lost, lossReason MUST be provided
        if (status === 'Lost' && !lossReason) {
            console.error(`[Enquiry Update Error] Missing lossReason for Lost status on Enquiry ID ${id}`);
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
        console.error('[Enquiry Update Error] Exception caught during update:', err);
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
