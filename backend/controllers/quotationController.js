const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const CompanySettings = require('../models/CompanySettings');

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

const getAnyCompanySettings = async (creatorId) => {
    // 1. Try creator's settings
    if (creatorId) {
        const settings = await CompanySettings.findOne({ userId: creatorId });
        if (settings) return settings;
    }

    // 2. Try any settings existing in system (Global)
    const anySettings = await CompanySettings.findOne().sort({ createdAt: 1 });
    if (anySettings) return anySettings;

    // 3. Absolute Fallback (Fake object so UI doesn't break)
    return {
        companyName: "Your Business Name",
        address: { line1: "Business Address", city: "City", state: "State", pincode: "000000" },
        authorizedSignatory: { name: "Authorized Person" }
    };
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

        // console.log("Received Quotation Request:", JSON.stringify(req.body, null, 2));

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

        const customerState = customer.billingAddress?.state || ''; // Safe access

        const subtotal = calculateSubtotal(items || []); // Safe array access
        const totalDiscount = calculateTotalDiscount(items || []);
        const gstBreakup = calculateGST(items || [], customerState);
        const tempGrandTotal = calculateGrandTotal(items || []);
        const roundedGrandTotal = Math.round(tempGrandTotal);
        const roundOff = (roundedGrandTotal - tempGrandTotal).toFixed(2);

        const newQuotation = new Quotation({
            quotationNo,
            customerId,
            quotationDate: new Date(),
            validTill,
            salespersonName,
            siteId: siteId || undefined, // Ensure empty string becomes undefined
            paymentTerms,
            items: items.map(item => ({
                ...item,
                siteId: item.siteId || undefined
            })),
            subtotal,
            totalDiscount,
            gstBreakup,
            roundOff,
            grandTotal: roundedGrandTotal,
            termsTemplateId: termsTemplateId || undefined,
            customTerms,
            status: status || 'draft',
            createdBy: req.user ? req.user.id : undefined, // Safely handle createdBy
        });

        await newQuotation.save();
        res.status(201).json(newQuotation);
    } catch (error) {
        console.error("Create Quotation Error Stack:", error); // Log full stack
        res.status(500).json({ message: 'Error creating quotation', error: error.message, stack: error.stack });
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

        const customerState = customer.billingAddress?.state || '';

        const subtotal = calculateSubtotal(items || []);
        const totalDiscount = calculateTotalDiscount(items || []);
        const gstBreakup = calculateGST(items || [], customerState);
        const tempGrandTotal = calculateGrandTotal(items || []);
        const roundedGrandTotal = Math.round(tempGrandTotal);
        const roundOff = (roundedGrandTotal - tempGrandTotal).toFixed(2);

        const updatedQuotation = await Quotation.findByIdAndUpdate(id, {
            customerId,
            items: items.map(item => ({
                ...item,
                siteId: item.siteId || undefined
            })),
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
                .populate('termsTemplateId')
                .populate('createdBy');
            if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

            // Fetch company settings with robust fallback
            const creatorId = quotation.createdBy?._id || quotation.createdBy;
            const companySettings = await getAnyCompanySettings(creatorId);

            // Return quotation with company settings
            const quotationObj = quotation.toObject();
            quotationObj.companySettings = companySettings;

            res.json(quotationObj);
        } catch (error) {
            console.error("Error fetching quotation:", error);
            res.status(500).json({ message: 'Error fetching quotation' });
        }
    },
    getAllQuotations: async (req, res) => {
        try {
            let query = {};
            if (req.user && req.user.role !== 'admin') {
                query.createdBy = req.user.id;
            }
            const quotations = await Quotation.find(query)
                .populate('customerId')
                .populate('siteId')
                .populate('createdBy')
                .sort({ createdAt: -1 });

            // Fetch company settings for each creator (with caching to avoid redundant calls)
            const settingsCache = {};
            const quotationsWithSettings = await Promise.all(quotations.map(async (q) => {
                const qObj = q.toObject();
                const creatorId = q.createdBy?._id || q.createdBy;

                if (creatorId && !settingsCache[creatorId]) {
                    settingsCache[creatorId] = await getAnyCompanySettings(creatorId);
                }
                qObj.companySettings = settingsCache[creatorId] || await getAnyCompanySettings();
                return qObj;
            }));

            res.json(quotationsWithSettings);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching quotations' });
        }
    },
    getReports: async (req, res) => {
        try {
            let query = {};
            if (req.user && req.user.role !== 'admin') {
                query.createdBy = req.user.id;
            }

            const quotations = await Quotation.find(query);
            
            // Basic Aggregation
            const totalQuotations = quotations.length;
            const totalValue = quotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
            
            const statusBreakdown = {
                draft: 0,
                final: 0,
                ordered: 0
            };

            quotations.forEach(q => {
                const s = q.status || 'draft';
                if (statusBreakdown.hasOwnProperty(s)) {
                    statusBreakdown[s]++;
                }
            });

            // Monthly Trend (Last 6 months)
            const monthlyTrend = [];
            const now = new Date();
            
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const m = d.getMonth();
                const y = d.getFullYear();

                const monthTotal = quotations.reduce((sum, q) => {
                    const qDate = new Date(q.createdAt || q.quotationDate);
                    if (qDate.getMonth() === m && qDate.getFullYear() === y) {
                        return sum + (q.grandTotal || 0);
                    }
                    return sum;
                }, 0);

                monthlyTrend.push({ month: monthName, total: monthTotal });
            }

            res.json({
                summary: {
                    totalQuotations,
                    totalValue,
                    statusBreakdown
                },
                monthlyTrend
            });
        } catch (error) {
            console.error("Aggregation Error:", error);
            res.status(500).json({ message: 'Error generating reports', error: error.message });
        }
    }
};
