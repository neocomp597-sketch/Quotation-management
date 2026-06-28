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
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');
const { createCompanyNotifications } = require('../utils/notificationHelper');

const DRAFT_TTL_SECONDS = 24 * 60 * 60;
const DASHBOARD_TTL_SECONDS = 60;
const QUOTATIONS_LIST_CACHE_TTL_SECONDS = Number(process.env.QUOTATIONS_LIST_CACHE_TTL_SECONDS || 120);
const QUOTATIONS_DETAIL_CACHE_TTL_SECONDS = Number(process.env.QUOTATIONS_DETAIL_CACHE_TTL_SECONDS || 300);
const COMPANY_SETTINGS_CACHE_TTL_SECONDS = Number(process.env.COMPANY_SETTINGS_CACHE_TTL_SECONDS || 600);

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

const getQuotationRefSequence = (quotation = {}) => {
    const ref = String(quotation.quotationNumber || quotation.quotationNo || '').trim();
    const match = ref.match(/(\d+)$/);
    return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
};

const sortQuotationsByRefDesc = (quotations = []) => (
    [...quotations].sort((a, b) => {
        const sequenceDiff = getQuotationRefSequence(b) - getQuotationRefSequence(a);
        if (sequenceDiff !== 0) return sequenceDiff;

        const refA = String(a.quotationNumber || a.quotationNo || '');
        const refB = String(b.quotationNumber || b.quotationNo || '');
        const refDiff = refB.localeCompare(refA, undefined, { numeric: true, sensitivity: 'base' });
        if (refDiff !== 0) return refDiff;

        return new Date(b.createdAt || b.quotationDate || 0) - new Date(a.createdAt || a.quotationDate || 0);
    })
);

const normalizeReference = (value) => String(value || '').trim();

const getReferenceSuffix = (value) => {
    const match = normalizeReference(value).match(/(\d+)$/);
    return match ? match[1] : normalizeReference(value);
};

const findQuotationWithReference = async ({ companyId, references, excludeId }) => {
    const refs = [...new Set((references || []).map(normalizeReference).filter(Boolean))];
    const suffixes = [...new Set(refs.map(getReferenceSuffix).filter(Boolean))];
    if (!refs.length && !suffixes.length) return null;

    const query = {
        $or: [
            { quotationNo: { $in: refs } },
            { quotationNumber: { $in: refs } },
            ...suffixes.flatMap((suffix) => {
                const escapedSuffix = escapeRegex(suffix);
                return [
                    { quotationNo: new RegExp(`${escapedSuffix}$`) },
                    { quotationNumber: new RegExp(`${escapedSuffix}$`) },
                ];
            }),
        ],
    };
    if (companyId) {
        query.companyId = companyId;
    }
    if (excludeId) {
        query._id = { $ne: excludeId };
    }

    return Quotation.findOne(query)
        .select('quotationNo quotationNumber')
        .lean();
};

const ensureUniqueQuotationReference = async ({ companyId, quotationNo, quotationNumber, excludeId }) => {
    const duplicate = await findQuotationWithReference({
        companyId,
        references: [quotationNo, quotationNumber],
        excludeId,
    });
    if (duplicate) {
        const duplicateRef = duplicate.quotationNo || duplicate.quotationNumber;
        throw asBadRequest(`Quotation reference number "${duplicateRef}" already exists. Please use a unique reference number.`);
    }
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
    const tenantId = require('../middlewares/tenantContext').getTenantId();
    const cacheKey = tenantId
        ? `company-settings:tenant:${tenantId}`
        : (creatorId ? `company-settings:user:${creatorId}` : 'company-settings:any');
    const { redis, value: cachedSettings } = await getCachedJson(cacheKey);
    if (cachedSettings) return cachedSettings;

    // 1. Try current tenant's settings
    if (tenantId) {
        const settings = await CompanySettings.findOne({ companyId: tenantId }).lean();
        if (settings) {
            await setCachedJson(redis, cacheKey, settings, COMPANY_SETTINGS_CACHE_TTL_SECONDS);
            return settings;
        }
    }

    // 2. Try creator's settings for legacy calls outside tenant context
    if (creatorId) {
        const settings = await CompanySettings.findOne({ userId: creatorId }).lean();
        if (settings) {
            await setCachedJson(redis, cacheKey, settings, COMPANY_SETTINGS_CACHE_TTL_SECONDS);
            return settings;
        }
    }

    // 3. Try any settings visible in the current context
    const anySettings = await CompanySettings.findOne().sort({ createdAt: 1 }).lean();
    if (anySettings) {
        await setCachedJson(redis, cacheKey, anySettings, COMPANY_SETTINGS_CACHE_TTL_SECONDS);
        return anySettings;
    }

    // 4. Absolute Fallback (Fake object so UI doesn't break)
    const fallback = {
        companyName: "Your Business Name",
        address: { line1: "Business Address", city: "City", state: "State", pincode: "000000" },
        authorizedSignatory: { name: "Authorized Person" }
    };
    await setCachedJson(redis, cacheKey, fallback, 60);
    return fallback;
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

const generateUniqueQuotationNumber = async (prefix, year, companyId) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const quotationNo = await generateQuotationNumber(prefix, year);
        const duplicate = await findQuotationWithReference({
            companyId,
            references: [quotationNo],
        });
        if (!duplicate) {
            return quotationNo;
        }
    }

    throw asBadRequest('Could not generate a unique quotation reference number. Please try again.');
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

const normalizeQuotationItems = async (items, fallbackSiteId, customerId = null, dealId = null, promoCode = null, targetCurrency = 'INR') => {
    if (!Array.isArray(items) || items.length === 0) {
        throw asBadRequest('At least one quotation item is required');
    }

    return Promise.all(
        items.map(async (item) => {
            if (!item.productId) {
                throw asBadRequest('Each quotation item must include productId');
            }

            const product = await Product.findById(item.productId)
                .select('productCode productName hsnCode gstPercentage uom productImageUrl basePrice vendors pricing')
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

            // Call Acczite CPQ Pricing Engine
            let enginePrice = product.basePrice;
            let priceSource = 'Standard Product Price';
            let calculatedCost = product.pricing?.baseCost || 0;
            
            try {
                const calcResult = await calculateProductPrice({
                    productId: product._id,
                    customerId,
                    quantity,
                    dealId,
                    siteId: item.siteId || fallbackSiteId,
                    promoCode,
                    targetCurrency
                });
                enginePrice = calcResult.unitPrice;
                priceSource = calcResult.priceSource;
                calculatedCost = calcResult.costPrice;
            } catch (pricingErr) {
                console.error("Pricing Engine error:", pricingErr.message);
            }

            // Option Modifiers if present
            let modifierPrice = 0;
            let modifierCost = 0;
            if (item.selectedOptions) {
                const ProductConfigTemplate = require('../models/ProductConfigTemplate');
                const template = await ProductConfigTemplate.findOne({ productId: product._id }).lean();
                if (template) {
                    Object.entries(item.selectedOptions).forEach(([groupName, val]) => {
                        const group = template.optionGroups.find(g => g.groupName === groupName);
                        if (group) {
                            const option = group.options.find(o => o.label === val);
                            if (option) {
                                modifierPrice += option.priceModifier || 0;
                                modifierCost += option.costModifier || 0;
                            }
                        }
                    });
                }
            }

            const unitPrice = Number(
                item.unitPrice ??
                item.rate ??
                (enginePrice + modifierPrice)
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
                    productImageUrl: item.productSnapshot?.productImageUrl || product.productImageUrl,
                    baseCost: calculatedCost + modifierCost
                },
                quantity,
                unitPrice,
                rate: unitPrice,
                discountPercent,
                discountAmount: calculations.discountAmount,
                taxableAmount: calculations.taxableAmount,
                gstAmount: calculations.gstAmount,
                lineTotal: calculations.lineTotal,
                priceSource,
                selectedOptions: item.selectedOptions || {}
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
            clientRequestId,
            totalDiscount: requestedTotalDiscount
        } = req.body;

        const normalizedClientRequestId = normalizeReference(clientRequestId);
        if (normalizedClientRequestId) {
            const existingQuotation = await Quotation.findOne({
                companyId: req.user?.companyId,
                clientRequestId: normalizedClientRequestId,
            });
            if (existingQuotation) {
                return res.status(200).json(existingQuotation);
            }
        }

        const customer = await Customer.findById(customerId)
            .select('companyName customerName billingAddress territory')
            .lean();
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const normalizedItems = await normalizeQuotationItems(
            items,
            siteId,
            customerId,
            req.body.dealId || null,
            req.body.promoCode || null,
            req.body.currency || 'INR'
        );

        // Margin Protection Engine
        let requiresApproval = false;
        let minMargin = 100;
        normalizedItems.forEach(item => {
            const cost = item.productSnapshot?.baseCost || 0;
            const rate = item.rate || item.unitPrice || 0;
            if (rate > 0) {
                const margin = ((rate - cost) / rate) * 100;
                if (margin < minMargin) minMargin = margin;
            }
        });

        if (minMargin < 0) {
            return res.status(400).json({ message: "Margin is negative. Quote creation blocked by Margin Protection Engine." });
        } else if (minMargin < 10) {
            requiresApproval = true;
        }

        let finalStatus = status || 'draft';
        if (requiresApproval && finalStatus !== 'draft') {
            finalStatus = 'pending_approval';
        }

        const year = new Date().getFullYear();
        const creatorId = req.user ? req.user.id : undefined;
        const settings = await getAnyCompanySettings(creatorId);
        const prefix = (settings?.quotationPrefix && settings.quotationPrefix.toUpperCase().startsWith('ARM')) 
            ? settings.quotationPrefix 
            : 'ARM/QTN';
        const quotationNo = await generateUniqueQuotationNumber(prefix, year, req.user?.companyId);
        await ensureUniqueQuotationReference({
            companyId: req.user?.companyId,
            quotationNo,
            quotationNumber: quotationNo,
        });

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
            companyId: req.user?.companyId,
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
            status: finalStatus,
            territory: customer.territory || null,
            createdBy: req.user ? req.user.id : undefined,
            clientRequestId: normalizedClientRequestId || undefined,
        });

        await newQuotation.save();
        await clearQuotationDashboardCache();
        if (req.user?.id) {
            await QuotationDraft.deleteOne({ userId: req.user.id, draftKey: 'new' });
            await deleteDraftFromRedis(req.user.id, 'new');
        }

        // Trigger notification for all other company users
        const creatorName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'New Quotation Added',
            message: `Quotation ${newQuotation.quotationNo} has been created for ${newQuotation.customerName} by ${creatorName} (Grand Total: ₹${newQuotation.grandTotal.toLocaleString()}).`,
            type: 'Quotation',
            relatedId: newQuotation._id,
            excludeUserId: req.user?.id
        });

        res.status(201).json(newQuotation);
    } catch (error) {
        console.error("Create Quotation Error Stack:", error);
        if (error.code === 11000) {
            const duplicateClientRequestId = normalizeReference(req.body?.clientRequestId);
            if (duplicateClientRequestId) {
                const existingQuotation = await Quotation.findOne({
                    companyId: req.user?.companyId,
                    clientRequestId: duplicateClientRequestId,
                });
                if (existingQuotation) {
                    return res.status(200).json(existingQuotation);
                }
            }
            return res.status(400).json({ message: 'Quotation reference number already exists. Please use a unique reference number.' });
        }
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
            .select('companyName customerName billingAddress territory')
            .lean();
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        // Quotation Versioning: save snapshot if updating non-draft quote
        const existingQuote = await Quotation.findById(id).lean();
        if (existingQuote && existingQuote.status !== 'draft') {
            const versionCount = await QuotationVersion.countDocuments({ quotationId: id });
            await QuotationVersion.create({
                quotationId: id,
                versionNumber: versionCount + 1,
                snapshot: existingQuote,
                createdBy: req.user?.id || existingQuote.createdBy,
                changeSummary: req.body.changeSummary || 'Revision update'
            });
        }

        const refUpdates = {};
        const requestedQuotationNo = normalizeReference(req.body.quotationNo);
        const requestedQuotationNumber = normalizeReference(req.body.quotationNumber);
        if (requestedQuotationNo) {
            refUpdates.quotationNo = requestedQuotationNo;
        }
        if (requestedQuotationNumber) {
            refUpdates.quotationNumber = requestedQuotationNumber;
        } else if (requestedQuotationNo) {
            refUpdates.quotationNumber = requestedQuotationNo;
        }
        if (refUpdates.quotationNo || refUpdates.quotationNumber) {
            await ensureUniqueQuotationReference({
                companyId: req.user?.companyId,
                quotationNo: refUpdates.quotationNo,
                quotationNumber: refUpdates.quotationNumber,
                excludeId: id,
            });
        }

        const normalizedItems = await normalizeQuotationItems(
            items,
            siteId,
            customerId,
            req.body.dealId || null,
            req.body.promoCode || null,
            req.body.currency || 'INR'
        );

        // Margin Protection Engine
        let requiresApproval = false;
        let minMargin = 100;
        normalizedItems.forEach(item => {
            const cost = item.productSnapshot?.baseCost || 0;
            const rate = item.rate || item.unitPrice || 0;
            if (rate > 0) {
                const margin = ((rate - cost) / rate) * 100;
                if (margin < minMargin) minMargin = margin;
            }
        });

        if (minMargin < 0) {
            return res.status(400).json({ message: "Margin is negative. Quote update blocked by Margin Protection Engine." });
        } else if (minMargin < 10) {
            requiresApproval = true;
        }

        let finalStatus = status || 'draft';
        if (requiresApproval && finalStatus !== 'draft') {
            finalStatus = 'pending_approval';
        }

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
            ...refUpdates,
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
            status: finalStatus,
            territory: customer.territory || null,
        }, { new: true, runValidators: true }).lean();

        await clearQuotationDashboardCache();

        // Trigger notification
        const updaterName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'Quotation Updated',
            message: `Quotation ${updatedQuotation.quotationNo} for ${updatedQuotation.customerName} has been updated by ${updaterName}.`,
            type: 'Quotation',
            relatedId: updatedQuotation._id,
            excludeUserId: req.user?.id
        });

        res.json(updatedQuotation);
    } catch (error) {
        console.error("Update Quotation Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Quotation reference number already exists. Please use a unique reference number.' });
        }
        res.status(error.statusCode || 500).json({ message: error.message || 'Error updating quotation' });
    }
};

const deleteQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const quotation = await Quotation.findById(id).lean();
        if (!quotation) {
            return res.status(404).json({ message: 'Quotation not found' });
        }
        
        await Quotation.findByIdAndDelete(id);
        await clearQuotationDashboardCache();

        // Trigger notification
        const performerName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'Quotation Deleted',
            message: `Quotation ${quotation.quotationNo} for ${quotation.customerName} has been deleted by ${performerName}.`,
            type: 'Quotation',
            relatedId: quotation._id,
            excludeUserId: req.user?.id
        });

        res.json({ message: 'Quotation deleted successfully' });
    } catch (error) {
        console.error("Delete Quotation Error:", error);
        res.status(500).json({ message: error.message || 'Error deleting quotation' });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['draft', 'final', 'ordered'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const quotation = await Quotation.findById(id);
        if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

        const oldStatus = quotation.status;
        quotation.status = status;
        await quotation.save();
        await clearQuotationDashboardCache();

        // Trigger notification
        const updaterName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'Quotation Status Updated',
            message: `Quotation ${quotation.quotationNo} status changed from ${oldStatus} to ${status} by ${updaterName}.`,
            type: 'Quotation',
            relatedId: quotation._id,
            excludeUserId: req.user?.id
        });

        res.json(quotation);
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ message: error.message || 'Error updating status' });
    }
};

const finalizeQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const quotation = await Quotation.findById(id);
        if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

        if (quotation.status !== 'draft') {
            return res.status(400).json({ message: 'Only draft quotations can be finalized' });
        }

        quotation.status = 'final';
        await quotation.save();
        await clearQuotationDashboardCache();

        // Trigger notification
        const updaterName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'Quotation Finalized',
            message: `Quotation ${quotation.quotationNo} for ${quotation.customerName} has been finalized by ${updaterName}.`,
            type: 'Quotation',
            relatedId: quotation._id,
            excludeUserId: req.user?.id
        });

        res.json(quotation);
    } catch (error) {
        console.error("Finalize Quotation Error:", error);
        res.status(500).json({ message: error.message || 'Error finalizing quotation' });
    }
};

module.exports = {
    createQuotation,
    updateQuotation,
    deleteQuotation,
    updateStatus,
    finalizeQuotation,
    getQuotationById: async (req, res) => {
        try {
            const cacheKey = `quotations:detail:${req.user?.companyId || 'unknown'}:${req.params.id}`;
            const { redis, value: cachedQuotation } = await getCachedJson(cacheKey);
            if (cachedQuotation) {
                return res.json(cachedQuotation);
            }

            const quotation = await Quotation.findById(req.params.id)
                .populate('customerId', 'customerName companyName gstin billingAddress mobile email logoUrl defaultDiscount')
                .populate('siteId', 'siteName address')
                .populate('items.siteId', 'siteName address')
                .populate('items.productId', 'productName productCode hsnCode gstPercentage uom productImageUrl')
                .populate('items.vendorId', 'name')
                .populate('territory', 'name type')
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

            await setCachedJson(redis, cacheKey, quotationObj, QUOTATIONS_DETAIL_CACHE_TTL_SECONDS);
            res.json(quotationObj);
        } catch (error) {
            console.error("Error fetching quotation:", error);
            res.status(500).json({ message: 'Error fetching quotation' });
        }
    },
    getAllQuotations: async (req, res) => {
        try {
            let query = {};
            if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
                const Territory = require('../models/Territory');
                const userTerritories = await Territory.find({
                    $or: [
                        { manager: req.user.id },
                        { salesReps: req.user.id }
                    ]
                }).select('_id').lean();
                
                const territoryIds = userTerritories.map(t => t._id);
                
                query.$or = [
                    { territory: { $in: territoryIds } },
                    { createdBy: req.user.id }
                ];
            }

            if (req.query.territory) {
                query.territory = req.query.territory;
            }

            const search = String(req.query.search || '').trim();
            if (search) {
                const regex = new RegExp(escapeRegex(search), 'i');
                const searchOr = [
                    { quotationNo: regex },
                    { quotationNumber: regex },
                    { customerName: regex },
                ];
                if (query.$or) {
                    query.$and = [
                        { $or: query.$or },
                        { $or: searchOr }
                    ];
                    delete query.$or;
                } else {
                    query.$or = searchOr;
                }
            }
            if (req.query.status) {
                query.status = req.query.status;
            }

            const listParams = hasListParams(req.query);
            const cacheKey = makeCacheKey('quotations:list', req, {
                territory: req.query.territory || null,
                listParams,
                sort: 'quotation-ref-sequence-desc-v1',
            });
            const { redis, value: cachedQuotations } = await getCachedJson(cacheKey);
            if (cachedQuotations) {
                return res.json(cachedQuotations);
            }

            let quotationsQuery = Quotation.find(query)
                .select('quotationNo quotationNumber customerName customerId quotationDate validTill grandTotal status siteId territory createdBy createdAt updatedAt')
                .populate('customerId', 'customerName companyName gstin logoUrl')
                .populate('siteId', 'siteName address')
                .populate('territory', 'name type')
                .populate('createdBy', 'name email');

            if (listParams) {
                const { page, limit, skip } = getPagination(req.query);
                const [allQuotations, total] = await Promise.all([
                    quotationsQuery.lean(),
                    Quotation.countDocuments(query),
                ]);
                const quotations = sortQuotationsByRefDesc(allQuotations).slice(skip, skip + limit);

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

                const response = {
                    data: quotationsWithSettings,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit) || 1,
                    },
                };
                await setCachedJson(redis, cacheKey, response, QUOTATIONS_LIST_CACHE_TTL_SECONDS);
                return res.json(response);
            }

            const quotations = sortQuotationsByRefDesc(await quotationsQuery.lean());

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

            await setCachedJson(redis, cacheKey, quotationsWithSettings, QUOTATIONS_LIST_CACHE_TTL_SECONDS);
            res.json(quotationsWithSettings);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching quotations' });
        }
    },
    getReports: async (req, res) => {
        try {
            let query = {};
            if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
                const Territory = require('../models/Territory');
                const userTerritories = await Territory.find({
                    $or: [
                        { manager: req.user.id },
                        { salesReps: req.user.id }
                    ]
                }).select('_id').lean();
                
                const territoryIds = userTerritories.map(t => t._id);
                
                query.$or = [
                    { territory: { $in: territoryIds } },
                    { createdBy: req.user.id }
                ];
            }

            const cacheScope = (req.user?.role === 'admin' || req.user?.role === 'manager')
                ? `tenant:${req.user?.companyId || 'unknown'}:admin`
                : `tenant:${req.user?.companyId || 'unknown'}:user:${req.user?.id || 'anonymous'}`;
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
