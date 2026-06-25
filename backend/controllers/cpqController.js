const PriceBook = require('../models/PriceBook');
const PriceBookItem = require('../models/PriceBookItem');
const PricingRule = require('../models/PricingRule');
const DiscountPolicy = require('../models/DiscountPolicy');
const Promotion = require('../models/Promotion');
const CurrencyRate = require('../models/CurrencyRate');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const ProductConfigTemplate = require('../models/ProductConfigTemplate');
const ApprovalRule = require('../models/ApprovalRule');
const CompetitorPrice = require('../models/CompetitorPrice');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const Contract = require('../models/Contract');
const { calculateProductPrice } = require('../utils/pricingEngine');

// Helper to log changes for compliance auditing
async function logChange(req, action, entityType, entityId, oldValue, newValue, reason = '') {
    try {
        await AuditLog.create({
            action,
            entityType,
            entityId,
            userId: req.user?.id,
            userName: req.user?.name,
            oldValue,
            newValue,
            reason
        });
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
}

// --- PRICE BOOKS CONTROLLERS ---
exports.createPriceBook = async (req, res) => {
    try {
        const pb = new PriceBook(req.body);
        const saved = await pb.save();
        await logChange(req, 'CREATE_PRICE_BOOK', 'PriceBook', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllPriceBooks = async (req, res) => {
    try {
        const list = await PriceBook.find({}).sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getPriceBookById = async (req, res) => {
    try {
        const pb = await PriceBook.findById(req.params.id).lean();
        if (!pb) return res.status(404).json({ message: 'Price Book not found' });
        res.json(pb);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updatePriceBook = async (req, res) => {
    try {
        const old = await PriceBook.findById(req.params.id).lean();
        const updated = await PriceBook.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Price Book not found' });
        await logChange(req, 'UPDATE_PRICE_BOOK', 'PriceBook', updated._id, old, updated);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deletePriceBook = async (req, res) => {
    try {
        const old = await PriceBook.findById(req.params.id).lean();
        const deleted = await PriceBook.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Price Book not found' });
        await PriceBookItem.deleteMany({ priceBookId: req.params.id });
        await logChange(req, 'DELETE_PRICE_BOOK', 'PriceBook', req.params.id, old, null);
        res.json({ message: 'Price Book deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- PRICE BOOK ITEMS CONTROLLERS ---
exports.addItemToPriceBook = async (req, res) => {
    try {
        const { priceBookId, productId, price, currency } = req.body;
        const item = await PriceBookItem.findOneAndUpdate(
            { priceBookId, productId },
            { price, currency },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getItemsInPriceBook = async (req, res) => {
    try {
        const items = await PriceBookItem.find({ priceBookId: req.params.priceBookId })
            .populate('productId', 'productName productCode basePrice catalogType')
            .lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.removeItemFromPriceBook = async (req, res) => {
    try {
        const deleted = await PriceBookItem.findByIdAndDelete(req.params.itemId);
        if (!deleted) return res.status(404).json({ message: 'Price Book Item not found' });
        res.json({ message: 'Item removed from Price Book' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- PRICING RULES CONTROLLERS ---
exports.createPricingRule = async (req, res) => {
    try {
        const rule = new PricingRule(req.body);
        const saved = await rule.save();
        await logChange(req, 'CREATE_PRICING_RULE', 'PricingRule', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllPricingRules = async (req, res) => {
    try {
        const list = await PricingRule.find({}).populate('productId', 'productName productCode').lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updatePricingRule = async (req, res) => {
    try {
        const old = await PricingRule.findById(req.params.id).lean();
        const updated = await PricingRule.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Rule not found' });
        await logChange(req, 'UPDATE_PRICING_RULE', 'PricingRule', updated._id, old, updated);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deletePricingRule = async (req, res) => {
    try {
        const old = await PricingRule.findById(req.params.id).lean();
        await PricingRule.findByIdAndDelete(req.params.id);
        await logChange(req, 'DELETE_PRICING_RULE', 'PricingRule', req.params.id, old, null);
        res.json({ message: 'Pricing Rule deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- DISCOUNT POLICIES CONTROLLERS ---
exports.createDiscountPolicy = async (req, res) => {
    try {
        const dp = new DiscountPolicy(req.body);
        const saved = await dp.save();
        await logChange(req, 'CREATE_DISCOUNT_POLICY', 'DiscountPolicy', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllDiscountPolicies = async (req, res) => {
    try {
        const list = await DiscountPolicy.find({}).sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateDiscountPolicy = async (req, res) => {
    try {
        const old = await DiscountPolicy.findById(req.params.id).lean();
        const updated = await DiscountPolicy.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Discount Policy not found' });
        await logChange(req, 'UPDATE_DISCOUNT_POLICY', 'DiscountPolicy', updated._id, old, updated);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteDiscountPolicy = async (req, res) => {
    try {
        const old = await DiscountPolicy.findById(req.params.id).lean();
        await DiscountPolicy.findByIdAndDelete(req.params.id);
        await logChange(req, 'DELETE_DISCOUNT_POLICY', 'DiscountPolicy', req.params.id, old, null);
        res.json({ message: 'Discount Policy deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- PROMOTION ENGINE CONTROLLERS ---
exports.createPromotion = async (req, res) => {
    try {
        const promo = new Promotion(req.body);
        const saved = await promo.save();
        await logChange(req, 'CREATE_PROMOTION', 'Promotion', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllPromotions = async (req, res) => {
    try {
        const list = await Promotion.find({}).sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updatePromotion = async (req, res) => {
    try {
        const old = await Promotion.findById(req.params.id).lean();
        const updated = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Promotion not found' });
        await logChange(req, 'UPDATE_PROMOTION', 'Promotion', updated._id, old, updated);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deletePromotion = async (req, res) => {
    try {
        const old = await Promotion.findById(req.params.id).lean();
        await Promotion.findByIdAndDelete(req.params.id);
        await logChange(req, 'DELETE_PROMOTION', 'Promotion', req.params.id, old, null);
        res.json({ message: 'Promotion deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- MULTI CURRENCY CONTROLLERS ---
exports.createCurrencyRate = async (req, res) => {
    try {
        const rate = new CurrencyRate(req.body);
        const saved = await rate.save();
        await logChange(req, 'CREATE_CURRENCY_RATE', 'CurrencyRate', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllCurrencyRates = async (req, res) => {
    try {
        const list = await CurrencyRate.find({}).sort({ effectiveDate: -1 }).lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- SUBSCRIPTION PLANS CONTROLLERS ---
exports.createSubscriptionPlan = async (req, res) => {
    try {
        const plan = new SubscriptionPlan(req.body);
        const saved = await plan.save();
        await logChange(req, 'CREATE_SUBSCRIPTION_PLAN', 'SubscriptionPlan', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllSubscriptionPlans = async (req, res) => {
    try {
        const list = await SubscriptionPlan.find({}).lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- PRODUCT CONFIGURATION TEMPLATES ---
exports.saveProductConfigTemplate = async (req, res) => {
    try {
        const { productId, optionGroups } = req.body;
        const template = await ProductConfigTemplate.findOneAndUpdate(
            { productId },
            { optionGroups },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(201).json(template);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getProductConfigTemplate = async (req, res) => {
    try {
        const template = await ProductConfigTemplate.findOne({ productId: req.params.productId }).lean();
        if (!template) return res.status(200).json({ productId: req.params.productId, optionGroups: [] });
        res.json(template);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- CPQ ENGINE: QUOTE SIMULATION ---
exports.simulateQuote = async (req, res) => {
    try {
        const {
            items = [],
            customerId = null,
            dealId = null,
            siteId = null,
            promoCode = null,
            targetCurrency = 'INR'
        } = req.body;

        const calculatedItems = await Promise.all(
            items.map(async (item) => {
                const calc = await calculateProductPrice({
                    productId: item.productId,
                    customerId,
                    quantity: item.quantity || 1,
                    dealId,
                    siteId,
                    promoCode,
                    targetCurrency
                });

                // Apply Option Modifiers if present
                let modifierPrice = 0;
                let modifierCost = 0;
                if (item.selectedOptions) {
                    const template = await ProductConfigTemplate.findOne({ productId: item.productId }).lean();
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

                const finalUnitPrice = calc.unitPrice + modifierPrice;
                const finalCostPrice = calc.costPrice + modifierCost;
                const taxableAmount = finalUnitPrice * (item.quantity || 1);
                
                // Recalculate margins based on config modifiers
                let marginPercent = 0;
                let marginRisk = 'Low';
                if (finalUnitPrice > 0) {
                    marginPercent = ((finalUnitPrice - finalCostPrice) / finalUnitPrice) * 100;
                    if (marginPercent < 0) marginRisk = 'Blocked';
                    else if (marginPercent < 5) marginRisk = 'High';
                    else if (marginPercent < 10) marginRisk = 'Medium';
                }

                return {
                    productId: item.productId,
                    productName: calc.productName,
                    catalogType: calc.catalogType,
                    quantity: item.quantity || 1,
                    unitPrice: finalUnitPrice,
                    originalPrice: calc.originalPrice + modifierPrice,
                    costPrice: finalCostPrice,
                    taxableAmount,
                    marginPercent: Math.round(marginPercent * 100) / 100,
                    marginRisk,
                    currency: calc.currency,
                    priceSource: calc.priceSource,
                    selectedOptions: item.selectedOptions || {}
                };
            })
        );

        // Summarize Simulated Totals
        const subtotal = calculatedItems.reduce((acc, curr) => acc + curr.taxableAmount, 0);
        
        let highestMarginRisk = 'Low';
        let requiresApproval = false;
        let isBlocked = false;

        calculatedItems.forEach(item => {
            if (item.marginRisk === 'Blocked') {
                highestMarginRisk = 'Blocked';
                isBlocked = true;
            } else if (item.marginRisk === 'High' && highestMarginRisk !== 'Blocked') {
                highestMarginRisk = 'High';
                requiresApproval = true;
            } else if (item.marginRisk === 'Medium' && !['Blocked', 'High'].includes(highestMarginRisk)) {
                highestMarginRisk = 'Medium';
                requiresApproval = true;
            }
        });

        res.json({
            items: calculatedItems,
            subtotal,
            grandTotal: subtotal,
            currency: targetCurrency,
            marginRisk: highestMarginRisk,
            requiresApproval,
            isBlocked
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- COMPETITOR PRICES ---
exports.createCompetitorPrice = async (req, res) => {
    try {
        const cp = new CompetitorPrice(req.body);
        const saved = await cp.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllCompetitorPrices = async (req, res) => {
    try {
        const list = await CompetitorPrice.find({})
            .populate('productId', 'productName productCode basePrice')
            .sort({ observedDate: -1 })
            .lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- COMPLIANCE AUDIT LOGS ---
exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- CONTRACT MANAGEMENT CONTROLLERS ---
exports.createContract = async (req, res) => {
    try {
        const contract = new Contract(req.body);
        const saved = await contract.save();
        await logChange(req, 'CREATE_CONTRACT', 'Contract', saved._id, null, saved);
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllContracts = async (req, res) => {
    try {
        const list = await Contract.find({})
            .populate('customerId', 'customerName companyName')
            .populate('priceBookId', 'name')
            .sort({ createdAt: -1 })
            .lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateContract = async (req, res) => {
    try {
        const old = await Contract.findById(req.params.id).lean();
        const updated = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Contract not found' });
        await logChange(req, 'UPDATE_CONTRACT', 'Contract', updated._id, old, updated);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteContract = async (req, res) => {
    try {
        const old = await Contract.findById(req.params.id).lean();
        await Contract.findByIdAndDelete(req.params.id);
        await logChange(req, 'DELETE_CONTRACT', 'Contract', req.params.id, old, null);
        res.json({ message: 'Contract deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
