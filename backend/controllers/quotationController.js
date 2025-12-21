const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');

// Helper Functions for Calculations
const calculateSubtotal = (items) => {
    return items.reduce((total, item) => total + (item.taxableAmount || 0), 0);
};

const calculateTotalDiscount = (items) => {
    return items.reduce((total, item) => total + (item.discountAmount || 0), 0);
};

const calculateGST = (items, customerState) => {
    let cgst = 0, sgst = 0, igst = 0;
    const businessState = "Maharashtra"; // Fixed business location

    items.forEach(item => {
        if (customerState === businessState) {
            cgst += (item.gstAmount / 2) || 0;
            sgst += (item.gstAmount / 2) || 0;
        } else {
            igst += (item.gstAmount || 0);
        }
    });
    return { cgst, sgst, igst };
};

const calculateGrandTotal = (items) => {
    return items.reduce((total, item) => total + (item.lineTotal || 0), 0);
};

// Create Quotation
const createQuotation = async (req, res) => {
    try {
        const {
            customerId,
            items,
            validTill,
            salespersonName,
            siteId,
            paymentTerms,
            termsTemplateId,
            customTerms,
            status
        } = req.body;

        const customer = await Customer.findById(customerId);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        // Auto-increment logic for JAG/QTN/YYYY/0001
        const year = new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const lastQuotationCount = await Quotation.countDocuments({
            createdAt: { $gte: startOfYear, $lte: endOfYear }
        });

        const sequence = lastQuotationCount + 1;
        const seqStr = sequence.toString().padStart(4, '0');
        const quotationNo = `JAG/QTN/${year}/${seqStr}`;

        const subtotal = calculateSubtotal(items);
        const totalDiscount = calculateTotalDiscount(items);
        const gstBreakup = calculateGST(items, customer.billingAddress.state);
        const tempGrandTotal = calculateGrandTotal(items);
        const roundedGrandTotal = Math.round(tempGrandTotal);
        const roundOff = (roundedGrandTotal - tempGrandTotal).toFixed(2);

        const newQuotation = new Quotation({
            quotationNo,
            customerId,
            quotationDate: new Date(),
            validTill,
            salespersonName,
            siteId,
            paymentTerms,
            items,
            subtotal,
            totalDiscount,
            gstBreakup,
            roundOff,
            grandTotal: roundedGrandTotal,
            termsTemplateId: termsTemplateId || undefined,
            customTerms,
            status: status || 'draft',
            createdBy: req.user ? req.user.id : null,
        });

        await newQuotation.save();
        res.status(201).json(newQuotation);
    } catch (error) {
        console.error("Create Quotation Error:", error);
        res.status(500).json({ message: 'Error creating quotation', error: error.message });
    }
};

// Update Quotation
const updateQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            customerId,
            items,
            validTill,
            salespersonName,
            siteId,
            paymentTerms,
            termsTemplateId,
            customTerms,
            status
        } = req.body;

        const customer = await Customer.findById(customerId);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const subtotal = calculateSubtotal(items);
        const totalDiscount = calculateTotalDiscount(items);
        const gstBreakup = calculateGST(items, customer.billingAddress.state);
        const tempGrandTotal = calculateGrandTotal(items);
        const roundedGrandTotal = Math.round(tempGrandTotal);
        const roundOff = (roundedGrandTotal - tempGrandTotal).toFixed(2);

        const updatedQuotation = await Quotation.findByIdAndUpdate(id, {
            customerId,
            items,
            validTill,
            salespersonName,
            siteId,
            paymentTerms,
            subtotal,
            totalDiscount,
            gstBreakup,
            roundOff,
            grandTotal: roundedGrandTotal,
            termsTemplateId: termsTemplateId || undefined,
            customTerms,
            status: status || 'draft',
        }, { new: true });

        res.json(updatedQuotation);
    } catch (error) {
        console.error("Update Quotation Error:", error);
        res.status(500).json({ message: 'Error updating quotation' });
    }
};

const deleteQuotation = async (req, res) => {
    try {
        await Quotation.findByIdAndDelete(req.params.id);
        res.json({ message: 'Quotation deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting quotation' });
    }
};

const finalizeQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndUpdate(req.params.id, { status: 'final' }, { new: true });
        res.json(quotation);
    } catch (error) {
        res.status(500).json({ message: 'Error finalizing quotation' });
    }
};

module.exports = {
    createQuotation,
    updateQuotation,
    deleteQuotation,
    finalizeQuotation,
    getQuotationById: async (req, res) => {
        try {
            const quotation = await Quotation.findById(req.params.id)
                .populate('customerId')
                .populate('siteId')
                .populate('items.siteId')
                .populate('items.productId')
                .populate('termsTemplateId');
            if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
            res.json(quotation);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching quotation' });
        }
    },
    getAllQuotations: async (req, res) => {
        try {
            const quotations = await Quotation.find()
                .populate('customerId')
                .populate('siteId')
                .sort({ createdAt: -1 });
            res.json(quotations);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching quotations' });
        }
    },
};
