const Enquiry = require('../models/Enquiry');

exports.createEnquiry = async (req, res) => {
    try {
        const { enquiryNo } = req.body;
        const exists = await Enquiry.findOne({ enquiryNo });
        if (exists) {
            return res.status(400).json({ message: `Enquiry with number ${enquiryNo} already exists` });
        }

        const newEnquiry = new Enquiry({
            ...req.body,
            createdBy: req.user?._id
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
            .populate('customerId')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(enquiries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getEnquiryById = async (req, res) => {
    try {
        const { id } = req.params;
        const enquiry = await Enquiry.findById(id).populate('customerId');
        if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });
        res.json(enquiry);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateEnquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedEnquiry = await Enquiry.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true, runValidators: true }
        );
        if (!updatedEnquiry) return res.status(404).json({ message: 'Enquiry not found' });
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
