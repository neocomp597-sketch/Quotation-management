const Product = require('../models/Product');
const PriceBook = require('../models/PriceBook');
const PriceBookItem = require('../models/PriceBookItem');
const PricingRule = require('../models/PricingRule');
const DiscountPolicy = require('../models/DiscountPolicy');
const Promotion = require('../models/Promotion');
const CurrencyRate = require('../models/CurrencyRate');
const Contract = require('../models/Contract');
const Customer = require('../models/Customer');

/**
 * Main pricing engine for Acczite CPQ.
 * Evaluates the correct price for a catalog product based on customer context, quantities, currencies, and discount policies.
 */
async function calculateProductPrice({
    productId,
    customerId,
    quantity = 1,
    dealId = null,
    siteId = null,
    promoCode = null,
    targetCurrency = 'INR',
    date = new Date()
}) {
    const product = await Product.findById(productId).lean();
    if (!product) {
        throw new Error(`Product not found: ${productId}`);
    }

    let customer = null;
    if (customerId) {
        customer = await Customer.findById(customerId).lean();
    }

    let baseRate = product.basePrice;
    let priceSource = 'Standard Product Price';
    let baseCost = product.pricing?.baseCost || 0;

    // --- LEVEL 3: PRICE BOOK HIERARCHY ENGINE ---

    // 1. Opportunity (Deal-Specific) Pricing
    if (dealId) {
        const oppPriceBook = await PriceBook.findOne({
            type: 'Opportunity',
            targetId: String(dealId),
            isActive: true
        }).lean();
        
        if (oppPriceBook) {
            const item = await PriceBookItem.findOne({
                priceBookId: oppPriceBook._id,
                productId: product._id
            }).lean();
            if (item) {
                baseRate = item.price;
                priceSource = `Opportunity Price Book: ${oppPriceBook.name}`;
            }
        }
    }

    // 2. Contract Price
    if (priceSource === 'Standard Product Price' && customerId) {
        const activeContract = await Contract.findOne({
            customerId,
            status: 'Active',
            startDate: { $lte: date },
            endDate: { $gte: date }
        }).lean();

        if (activeContract) {
            // Check lockedPrices Map
            const lockedPrice = activeContract.lockedPrices && activeContract.lockedPrices[String(product._id)];
            if (lockedPrice !== undefined && lockedPrice !== null) {
                baseRate = lockedPrice;
                priceSource = `Contract Price (Agreement: ${activeContract.contractNumber})`;
            } else if (activeContract.priceBookId) {
                const item = await PriceBookItem.findOne({
                    priceBookId: activeContract.priceBookId,
                    productId: product._id
                }).lean();
                if (item) {
                    baseRate = item.price;
                    priceSource = `Contract Price Book (Agreement: ${activeContract.contractNumber})`;
                }
            }
        }
    }

    // 3. Customer Price Book
    if (priceSource === 'Standard Product Price' && customerId) {
        const custPriceBook = await PriceBook.findOne({
            type: 'Customer',
            targetId: String(customerId),
            isActive: true
        }).lean();

        if (custPriceBook) {
            const item = await PriceBookItem.findOne({
                priceBookId: custPriceBook._id,
                productId: product._id
            }).lean();
            if (item) {
                baseRate = item.price;
                priceSource = `Customer Price Book: ${custPriceBook.name}`;
            }
        }
    }

    // 4. Project Price Book
    if (priceSource === 'Standard Product Price' && siteId) {
        const projPriceBook = await PriceBook.findOne({
            type: 'Project',
            targetId: String(siteId),
            isActive: true
        }).lean();

        if (projPriceBook) {
            const item = await PriceBookItem.findOne({
                priceBookId: projPriceBook._id,
                productId: product._id
            }).lean();
            if (item) {
                baseRate = item.price;
                priceSource = `Project Price Book: ${projPriceBook.name}`;
            }
        }
    }

    // 5. Region Price Book
    if (priceSource === 'Standard Product Price' && customer) {
        const customerState = customer.billingAddress?.state || '';
        const regionPriceBook = await PriceBook.findOne({
            type: 'Region',
            targetId: customerState,
            isActive: true
        }).lean();

        if (regionPriceBook) {
            const item = await PriceBookItem.findOne({
                priceBookId: regionPriceBook._id,
                productId: product._id
            }).lean();
            if (item) {
                baseRate = item.price;
                priceSource = `Region Price Book: ${regionPriceBook.name} (${customerState})`;
            }
        }
    }

    // 6. Promotion Price Book
    if (priceSource === 'Standard Product Price') {
        const promoPriceBook = await PriceBook.findOne({
            type: 'Promotional',
            isActive: true,
            validFrom: { $lte: date },
            validTo: { $gte: date }
        }).lean();

        if (promoPriceBook) {
            const item = await PriceBookItem.findOne({
                priceBookId: promoPriceBook._id,
                productId: product._id
            }).lean();
            if (item) {
                baseRate = item.price;
                priceSource = `Promotional Price Book: ${promoPriceBook.name}`;
            }
        }
    }

    // 7. Standard Price Book Fallback
    if (priceSource === 'Standard Product Price') {
        const stdPriceBook = await PriceBook.findOne({
            type: 'Standard',
            isActive: true
        }).lean();

        if (stdPriceBook) {
            const item = await PriceBookItem.findOne({
                priceBookId: stdPriceBook._id,
                productId: product._id
            }).lean();
            if (item) {
                baseRate = item.price;
                priceSource = `Standard Price Book`;
            }
        }
    }

    // --- LEVEL 4: ADVANCED PRICING RULES ---
    let finalRate = baseRate;
    let appliedRuleDetails = null;

    // Look for active product-specific pricing rules
    const rules = await PricingRule.find({
        $or: [
            { productId: product._id },
            { ruleType: { $in: ['CustomerGroup', 'Industry', 'Territory', 'DynamicMargin'] } }
        ],
        isActive: true,
        $and: [
            { $or: [{ validFrom: null }, { validFrom: { $lte: date } }] },
            { $or: [{ validTo: null }, { validTo: { $gte: date } }] }
        ]
    }).lean();

    for (const rule of rules) {
        // Quantity / Volume / Slab pricing
        if (['Quantity', 'Volume', 'Slab'].includes(rule.ruleType) && String(rule.productId) === String(product._id)) {
            const matchingCondition = rule.conditions.find(c => quantity >= c.minQty && quantity <= c.maxQty);
            if (matchingCondition) {
                if (matchingCondition.type === 'price') {
                    finalRate = matchingCondition.value;
                    priceSource = `Slab/Quantity rule: ${rule.name}`;
                } else if (matchingCondition.type === 'discountPercent') {
                    finalRate = finalRate * (1 - matchingCondition.value / 100);
                    priceSource += ` + Slab Discount ${matchingCondition.value}%`;
                } else if (matchingCondition.type === 'markupPercent') {
                    finalRate = finalRate * (1 + matchingCondition.value / 100);
                    priceSource += ` + Slab Markup ${matchingCondition.value}%`;
                }
                appliedRuleDetails = { name: rule.name, type: rule.ruleType, value: matchingCondition.value };
                break;
            }
        }

        // Customer Group Pricing
        if (rule.ruleType === 'CustomerGroup' && customer && rule.customerGroup === customer.customerGroup) {
            // Apply group-level discount/markup if set in slab rules
            const match = rule.conditions?.find(c => quantity >= c.minQty && quantity <= c.maxQty) || rule.conditions?.[0];
            if (match) {
                if (match.type === 'discountPercent') {
                    finalRate = finalRate * (1 - match.value / 100);
                    priceSource += ` (Customer Group: ${customer.customerGroup} -${match.value}%)`;
                } else if (match.type === 'markupPercent') {
                    finalRate = finalRate * (1 + match.value / 100);
                    priceSource += ` (Customer Group: ${customer.customerGroup} +${match.value}%)`;
                }
            }
        }

        // Industry Pricing
        if (rule.ruleType === 'Industry' && customer && rule.industry === customer.industry) {
            const match = rule.conditions?.[0];
            if (match) {
                if (match.type === 'discountPercent') {
                    finalRate = finalRate * (1 - match.value / 100);
                    priceSource += ` (Industry: ${customer.industry} -${match.value}%)`;
                }
            }
        }

        // Dynamic Margin Pricing (Cost + X%)
        if (rule.ruleType === 'DynamicMargin' && String(rule.productId) === String(product._id)) {
            const markup = rule.markupPercent || 0;
            if (baseCost > 0) {
                finalRate = baseCost * (1 + markup / 100);
                priceSource = `Dynamic Margin Cost+${markup}%`;
            }
        }
    }

    // --- MISSING MODULE 2: DISCOUNT POLICIES ---
    let totalDiscountPercent = 0;
    let totalDiscountAmount = 0;
    
    if (customer) {
        const policies = await DiscountPolicy.find({
            isActive: true,
            $or: [
                { customerGroups: customer.customerGroup },
                { customerGroups: { $size: 0 } }
            ]
        }).lean();

        let maxNonStackableDiscount = 0;
        let stackableDiscountSum = 0;

        for (const policy of policies) {
            if (policy.stackable) {
                if (policy.discountType === 'Percentage') {
                    stackableDiscountSum += policy.value;
                } else {
                    totalDiscountAmount += policy.value;
                }
            } else {
                if (policy.discountType === 'Percentage') {
                    if (policy.value > maxNonStackableDiscount) {
                        maxNonStackableDiscount = policy.value;
                    }
                }
            }
        }

        // Combine stackable discounts or single largest non-stackable discount
        totalDiscountPercent = Math.max(stackableDiscountSum, maxNonStackableDiscount);
        if (totalDiscountPercent > 0) {
            finalRate = finalRate * (1 - totalDiscountPercent / 100);
            priceSource += ` (Discount Policy Applied: -${totalDiscountPercent}%)`;
        }
        if (totalDiscountAmount > 0) {
            finalRate = Math.max(0, finalRate - totalDiscountAmount);
            priceSource += ` (Discount Policy Deducted: -₹${totalDiscountAmount})`;
        }
    }

    // --- MISSING MODULE 3: PROMOTION ENGINE (COUPONS) ---
    if (promoCode) {
        const promo = await Promotion.findOne({
            code: promoCode.trim().toUpperCase(),
            isActive: true,
            startDate: { $lte: date },
            endDate: { $gte: date }
        });

        if (promo) {
            // Validate promo target constraints
            const matchesProduct = promo.products.length === 0 || promo.products.some(pId => String(pId) === String(product._id));
            const matchesCustomer = promo.customers.length === 0 || (customerId && promo.customers.some(cId => String(cId) === String(customerId)));
            const limitNotExceeded = !promo.usageLimit || promo.usageCount < promo.usageLimit;

            if (matchesProduct && matchesCustomer && limitNotExceeded) {
                if (promo.discountPercent > 0) {
                    finalRate = finalRate * (1 - promo.discountPercent / 100);
                    priceSource += ` (Promo Code: ${promo.code} -${promo.discountPercent}%)`;
                } else if (promo.discountAmount > 0) {
                    finalRate = Math.max(0, finalRate - promo.discountAmount);
                    priceSource += ` (Promo Code: ${promo.code} -₹${promo.discountAmount})`;
                }
            }
        }
    }

    // --- MISSING MODULE 4: MULTI-CURRENCY CONVERSION ---
    let currency = 'INR';
    let exchangeRate = 1;
    if (targetCurrency && targetCurrency !== 'INR') {
        const rateRecord = await CurrencyRate.findOne({
            fromCurrency: 'INR',
            toCurrency: targetCurrency
        }).sort({ effectiveDate: -1 }).lean();

        if (rateRecord) {
            exchangeRate = rateRecord.rate;
            currency = targetCurrency;
            finalRate = finalRate * exchangeRate;
            baseCost = baseCost * exchangeRate;
            priceSource += ` [Converted to ${targetCurrency} @ ${exchangeRate}]`;
        }
    }

    // --- MISSING MODULE 8: MARGIN PROTECTION ENGINE ---
    // Margin = (sellingPrice - costPrice) / sellingPrice
    let marginPercent = 0;
    let marginRisk = 'Low';

    if (finalRate > 0) {
        marginPercent = ((finalRate - baseCost) / finalRate) * 100;
        if (marginPercent < 0) {
            marginRisk = 'Blocked'; // Locked negative margin
        } else if (marginPercent < 5) {
            marginRisk = 'High'; // Requires Director Approval
        } else if (marginPercent < 10) {
            marginRisk = 'Medium'; // Requires Manager Approval
        }
    }

    return {
        productId: product._id,
        productName: product.productName,
        catalogType: product.catalogType || 'Product',
        unitPrice: Math.round(finalRate * 100) / 100,
        originalPrice: Math.round(baseRate * 100) / 100,
        costPrice: Math.round(baseCost * 100) / 100,
        marginPercent: Math.round(marginPercent * 100) / 100,
        marginRisk,
        currency,
        exchangeRate,
        priceSource,
        appliedRule: appliedRuleDetails
    };
}

module.exports = {
    calculateProductPrice
};
