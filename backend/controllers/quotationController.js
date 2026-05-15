const Quotation = require('../models/Quotation');
const Counter = require('../models/Counter');
const QuotationDraft = require('../models/QuotationDraft');
const Customer = require('../models/Customer');
const CompanySettings = require('../models/CompanySettings');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { getBestVendorForProduct, sortVendorsByPriority, isVendorActive } = require('../utils/vendorSelection');
const { getRedis } = require('../config/redis');
const { invalidateQuotationCaches } = require('../utils/cacheInvalidation');

const DRAFT_TTL_SECONDS = 24 * 60 * 60;
const DASHBOARD_TTL_SECONDS = 60;

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    return { page, limit, skip: (page - 1) * limit };
};

const hasListParams = (query) => Boolean(query.page || query.limit || query.search || query.status);

const asBadRequest = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
};

const getDraftKey = (userId, draftKey = 'new') => (
    draftKey === 'new'
        ? `draft:quotation:${userId}`
        : `draft:quotation:${userId}:${draftKey}`
);

const readDraftFromRedis = async (userId, draftKey = 'new') => {
    const redis = await getRedis();
    if (!redis) return null;

    const rawDraft = await redis.get(getDraftKey(userId, draftKey));
    if (!rawDraft) return null;

    try {
        return JSON.parse(rawDraft);
    } catch {
        await redis.del(getDraftKey(userId, draftKey));
        return null;
    }
};

const saveDraftToRedis = async (userId, draftKey = 'new', payload = {}) => {
    const redis = await getRedis();
    if (!redis) return null;

    const now = new Date().toISOString();
    const draft = {
        userId,
        draftKey,
        payload,
        updatedAt: now,
        expiresAt: new Date(Date.now() + DRAFT_TTL_SECONDS * 1000).toISOString(),
    };

    await redis.set(getDraftKey(userId, draftKey), JSON.stringify(draft), { EX: DRAFT_TTL_SECONDS });
    return draft;
};

const deleteDraftFromRedis = async (userId, draftKey = 'new') => {
    const redis = await getRedis();
    if (!redis) return false;

    await redis.del(getDraftKey(userId, draftKey));
    return true;
};

const clearQuotationDashboardCache = async () => {
    await invalidateQuotationCaches();
};

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

const calculateLineItem = (quantity, rate, discountPercent, gstPercentage) => {
    const amount = Number(quantity || 0) * Number(rate || 0);
    const discountAmount = (amount * Number(discountPercent || 0)) / 100;
    const taxableAmount = amount - discountAmount;
    const gstAmount = (taxableAmount * Number(gstPercentage || 0)) / 100;
    const lineTotal = taxableAmount + gstAmount;

    return {
        discountAmount,
        taxableAmount,
        gstAmount,
        lineTotal
    };
};

const getAnyCompanySettings = async (creatorId) => {
    // 1. Try creator's settings
    if (creatorId) {
        const settings = await CompanySettings.findOne({ userId: creatorId }).lean();
        if (settings) return settings;
    }

    // 2. Try any settings existing in system (Global)
    const anySettings = await CompanySettings.findOne().sort({ createdAt: 1 }).lean();
    if (anySettings) return anySettings;

    // 3. Absolute Fallback (Fake object so UI doesn't break)
    return {
        companyName: "Your Business Name",
        address: { line1: "Business Address", city: "City", state: "State", pincode: "000000" },
        authorizedSignatory: { name: "Authorized Person" }
    };
};

const generateQuotationNumber = async (prefix, year) => {
    const counter = await Counter.findOneAndUpdate(
        { type: 'quotation', prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}/${year}/${seqStr}`;
};

const resolveVendorForItem = (product, requestedVendorId) => {
    const productVendors = sortVendorsByPriority(product.vendors || []);

    if (!productVendors.length) {
        return { selectedVendor: null, isAutoSelected: true };
    }

    if (requestedVendorId) {
        const match = productVendors.find((entry) => String(entry.vendorId?._id || entry.vendorId) === String(requestedVendorId));
        if (!match) {
            throw asBadRequest('Selected vendor does not belong to this product');
        }
        if (!isVendorActive(match)) {
            throw asBadRequest('Selected vendor is inactive');
        }
        return { selectedVendor: match, isAutoSelected: false };
    }

    const productObj = product.toObject ? product.toObject() : product;
    const bestVendor = getBestVendorForProduct({ ...productObj, vendors: productVendors });
    return { selectedVendor: bestVendor, isAutoSelected: true };
};

const normalizeQuotationItems = async (items, fallbackSiteId) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw asBadRequest('At least one quotation item is required');
    }

    return Promise.all(
        items.map(async (item) => {
            if (!item.productId) {
                throw asBadRequest('Each quotation item must include productId');
            }

            const product = await Product.findById(item.productId)
                .select('productCode productName hsnCode gstPercentage uom productImageUrl basePrice vendors')
                .populate('vendors.vendorId', 'name isActive')
                .lean();
            if (!product) {
                throw asBadRequest(`Product not found for item: ${item.productId}`);
            }

            const { selectedVendor, isAutoSelected } = resolveVendorForItem(product, item.vendorId);
            const quantity = Number(item.quantity || 0);
            const discountPercent = Number(item.discountPercent || 0);

            if (!(quantity > 0)) {
                throw asBadRequest(`Quantity must be greater than 0 for product ${product.productCode}`);
            }

            const unitPrice = Number(
                item.unitPrice ??
                item.rate ??
                selectedVendor?.price ??
                product.basePrice
            );

            if (!(unitPrice > 0)) {
                throw asBadRequest(`Unit price must be greater than 0 for product ${product.productCode}`);
            }

            const gstPercentage = Number(
                item.productSnapshot?.gstPercentage ??
                item.gstPercentage ??
                product.gstPercentage ??
                0
            );

            const calculations = calculateLineItem(quantity, unitPrice, discountPercent, gstPercentage);

            return {
                productId: product._id,
                vendorId: selectedVendor ? (selectedVendor.vendorId?._id || selectedVendor.vendorId) : undefined,
                vendorName: selectedVendor?.vendorId?.name || item.vendorName || '',
                vendorPrice: selectedVendor ? Number(selectedVendor.price || 0) : unitPrice,
                vendorStockAtSelection: selectedVendor ? Number(selectedVendor.stock || 0) : Number(item.vendorStockAtSelection || 0),
                isVendorAutoSelected: selectedVendor ? isAutoSelected : true,
                siteId: item.siteId || fallbackSiteId || undefined,
                productSnapshot: {
                    productName: item.productSnapshot?.productName || product.productName,
                    productCode: item.productSnapshot?.productCode || product.productCode,
                    hsnCode: item.productSnapshot?.hsnCode || product.hsnCode,
                    gstPercentage,
                    uom: item.productSnapshot?.uom || product.uom,
                    productImageUrl: item.productSnapshot?.productImageUrl || product.productImageUrl
                },
                quantity,
                unitPrice,
                rate: unitPrice,
                discountPercent,
                discountAmount: calculations.discountAmount,
                taxableAmount: calculations.taxableAmount,
                gstAmount: calculations.gstAmount,
                lineTotal: calculations.lineTotal,
            };
        })
    );
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
            status,
            totalDiscount: requestedTotalDiscount
        } = req.body;

        const customer = await Customer.findById(customerId)
            .select('companyName customerName billingAddress')
            .lean();
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const normalizedItems = await normalizeQuotationItems(items, siteId);

        const year = new Date().getFullYear();
        const creatorId = req.user ? req.user.id : undefined;
        const settings = await getAnyCompanySettings(creatorId);
        const prefix = (settings?.quotationPrefix && settings.quotationPrefix.toUpperCase().startsWith('ARM')) 
            ? settings.quotationPrefix 
            : 'ARM/QTN';
        const quotationNo = await generateQuotationNumber(prefix, year);

        const customerState = customer.billingAddress?.state || '';
        const itemDiscountTotal = calculateTotalDiscount(normalizedItems);
        const totalDiscount = typeof requestedTotalDiscount !== 'undefined'
            ? Number(requestedTotalDiscount)
            : itemDiscountTotal;
        const additionalDiscount = Math.max(0, totalDiscount - itemDiscountTotal);

        const subtotal = calculateSubtotal(normalizedItems);
        const gstBreakup = calculateGST(normalizedItems, customerState);
        const tempGrandTotal = Math.max(0, calculateGrandTotal(normalizedItems) - additionalDiscount);
        const roundedGrandTotal = Math.round(tempGrandTotal);
        const roundOff = Number((roundedGrandTotal - tempGrandTotal).toFixed(2));

        const newQuotation = new Quotation({
            quotationNo,
            quotationNumber: quotationNo,
            companyId: settings?._id,
            customerName: customer.companyName || customer.customerName,
            customerId,
            quotationDate: new Date(),
            validTill,
            salespersonName,
            siteId: siteId || undefined,
            paymentTerms,
            items: normalizedItems,
            subtotal,
            totalDiscount,
            gstBreakup,
            roundOff,
            grandTotal: roundedGrandTotal,
            termsTemplateId: termsTemplateId || undefined,
            customTerms,
            status: status || 'draft',
            createdBy: req.user ? req.user.id : undefined,
        });

        await newQuotation.save();
        await clearQuotationDashboardCache();
        if (req.user?.id) {
            await QuotationDraft.deleteOne({ userId: req.user.id, draftKey: 'new' });
            await deleteDraftFromRedis(req.user.id, 'new');
        }
        res.status(201).json(newQuotation);
    } catch (error) {
        console.error("Create Quotation Error Stack:", error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error creating quotation' });
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
            status,
            totalDiscount: requestedTotalDiscount
        } = req.body;

        const customer = await Customer.findById(customerId)
            .select('companyName customerName billingAddress')
            .lean();
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const normalizedItems = await normalizeQuotationItems(items, siteId);
        const customerState = customer.billingAddress?.state || '';

        const itemDiscountTotal = calculateTotalDiscount(normalizedItems);
        const totalDiscount = typeof requestedTotalDiscount !== 'undefined'
            ? Number(requestedTotalDiscount)
            : itemDiscountTotal;
        const additionalDiscount = Math.max(0, totalDiscount - itemDiscountTotal);

        const subtotal = calculateSubtotal(normalizedItems);
        const gstBreakup = calculateGST(normalizedItems, customerState);
        const tempGrandTotal = Math.max(0, calculateGrandTotal(normalizedItems) - additionalDiscount);
        const roundedGrandTotal = Math.round(tempGrandTotal);
        const roundOff = Number((roundedGrandTotal - tempGrandTotal).toFixed(2));

        const updatedQuotation = await Quotation.findByIdAndUpdate(id, {
            customerId,
            items: normalizedItems,
            validTill,
            salespersonName,
            siteId: siteId || undefined,
            paymentTerms,
            subtotal,
            totalDiscount,
            gstBreakup,
            roundOff,
            grandTotal: roundedGrandTotal,
            termsTemplateId: termsTemplateId || undefined,
            customTerms,
            status: status || 'draft',
        }, { new: true, runValidators: true }).lean();

        await clearQuotationDashboardCache();
        res.json(updatedQuotation);
    } catch (error) {
        console.error("Update Quotation Error:", error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error updating quotation' });
    }
};

const deleteQuotation = async (req, res) => {
    try {
        await Quotation.findByIdAndDelete(req.params.id);
        await clearQuotationDashboardCache();
        res.json({ message: 'Quotation deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting quotation' });
    }
};

const finalizeQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndUpdate(
            req.params.id,
            { status: 'final' },
            { new: true }
        ).lean();
        await clearQuotationDashboardCache();
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
                .populate('customerId', 'customerName companyName gstin billingAddress mobile email logoUrl defaultDiscount')
                .populate('siteId', 'siteName address')
                .populate('items.siteId', 'siteName address')
                .populate('items.productId', 'productName productCode hsnCode gstPercentage uom productImageUrl')
                .populate('items.vendorId', 'name')
                .populate('termsTemplateId', 'templateName content isDefault')
                .populate('createdBy', 'name email')
                .lean();
            if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

            // Fetch company settings with robust fallback
            const creatorId = quotation.createdBy?._id || quotation.createdBy;
            const companySettings = await getAnyCompanySettings(creatorId);

            // Return quotation with company settings
            const quotationObj = { ...quotation };
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

            const search = String(req.query.search || '').trim();
            if (search) {
                const regex = new RegExp(escapeRegex(search), 'i');
                query.$or = [
                    { quotationNo: regex },
                    { quotationNumber: regex },
                    { customerName: regex },
                ];
            }
            if (req.query.status) {
                query.status = req.query.status;
            }

            const listParams = hasListParams(req.query);
            let quotationsQuery = Quotation.find(query)
                .select('quotationNo quotationNumber customerName customerId quotationDate validTill grandTotal status siteId createdBy createdAt updatedAt')
                .populate('customerId', 'customerName companyName gstin logoUrl')
                .populate('siteId', 'siteName address')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });

            if (listParams) {
                const { page, limit, skip } = getPagination(req.query);
                const [quotations, total] = await Promise.all([
                    quotationsQuery.skip(skip).limit(limit).lean(),
                    Quotation.countDocuments(query),
                ]);

                const settingsCache = {};
                const quotationsWithSettings = await Promise.all(quotations.map(async (q) => {
                    const qObj = { ...q };
                    const creatorId = q.createdBy?._id || q.createdBy;

                    if (creatorId && !settingsCache[creatorId]) {
                        settingsCache[creatorId] = await getAnyCompanySettings(creatorId);
                    }
                    qObj.companySettings = settingsCache[creatorId] || await getAnyCompanySettings();
                    return qObj;
                }));

                return res.json({
                    data: quotationsWithSettings,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit) || 1,
                    },
                });
            }

            const quotations = await quotationsQuery.lean();

            // Fetch company settings for each creator (with caching to avoid redundant calls)
            const settingsCache = {};
            const quotationsWithSettings = await Promise.all(quotations.map(async (q) => {
                const qObj = { ...q };
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

            const cacheScope = req.user?.role === 'admin' ? 'admin' : `user:${req.user?.id || 'anonymous'}`;
            const cacheKey = `dashboard:quotations:${cacheScope}`;
            const redis = await getRedis();
            if (redis) {
                const cachedReport = await redis.get(cacheKey);
                if (cachedReport) {
                    return res.json(JSON.parse(cachedReport));
                }
            }

            const [
                quotations,
                productCount,
                vendorCount,
                customerCount,
                recentQuotations
            ] = await Promise.all([
                Quotation.find(query).select('grandTotal status createdAt quotationDate').lean(),
                Product.countDocuments(),
                Vendor.countDocuments(),
                Customer.countDocuments(),
                Quotation.find(query)
                    .select('quotationNo customerName customerId quotationDate grandTotal status createdAt')
                    .populate('customerId', 'customerName companyName')
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean()
            ]);

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

            const report = {
                summary: {
                    totalQuotations,
                    totalValue,
                    statusBreakdown,
                    productCount,
                    vendorCount,
                    customerCount
                },
                monthlyTrend,
                recentQuotations
            };

            if (redis) {
                await redis.set(cacheKey, JSON.stringify(report), { EX: DASHBOARD_TTL_SECONDS });
            }

            res.json(report);
        } catch (error) {
            console.error("Aggregation Error:", error);
            res.status(500).json({ message: 'Error generating reports', error: error.message });
        }
    },
    getDraft: async (req, res) => {
        try {
            const draftKey = req.params.draftKey || 'new';
            const redisDraft = await readDraftFromRedis(req.user.id, draftKey);
            if (redisDraft) {
                return res.json(redisDraft);
            }

            const draft = await QuotationDraft.findOne({
                userId: req.user.id,
                draftKey
            }).select('userId draftKey payload updatedAt expiresAt createdAt').lean();

            res.json(draft || null);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching quotation draft' });
        }
    },
    autosaveDraft: async (req, res) => {
        try {
            const draftKey = req.params.draftKey || 'new';
            const redisDraft = await saveDraftToRedis(req.user.id, draftKey, req.body || {});
            if (redisDraft) {
                return res.json(redisDraft);
            }

            const draft = await QuotationDraft.findOneAndUpdate(
                { userId: req.user.id, draftKey },
                { payload: req.body || {} },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );

            res.json(draft);
        } catch (error) {
            res.status(500).json({ message: 'Error saving quotation draft' });
        }
    },
    deleteDraft: async (req, res) => {
        try {
            const draftKey = req.params.draftKey || 'new';
            await deleteDraftFromRedis(req.user.id, draftKey);
            await QuotationDraft.deleteOne({
                userId: req.user.id,
                draftKey
            });
            res.json({ message: 'Draft deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting quotation draft' });
        }
    }
};
