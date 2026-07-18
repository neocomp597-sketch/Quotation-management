const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Company = require('../models/Company');
const Product = require('../models/Product');
const PriceBook = require('../models/PriceBook');
const PriceBookItem = require('../models/PriceBookItem');
const PricingRule = require('../models/PricingRule');
const DiscountPolicy = require('../models/DiscountPolicy');
const Promotion = require('../models/Promotion');
const CurrencyRate = require('../models/CurrencyRate');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const CompetitorPrice = require('../models/CompetitorPrice');
const Contract = require('../models/Contract');
const Customer = require('../models/Customer');

const seed = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await connectDB();
        console.log('Connected.');

        // Find or create default company for multi-tenancy context
        let company = await Company.findOne();
        if (!company) {
            console.log('No company found. Creating a default Company...');
            company = await Company.create({
                name: 'Acczite Enterprise Systems',
                slug: 'acczite-enterprise-systems',
                isActive: true
            });
        }
        const companyId = company._id;
        console.log(`Using Company: ${company.name} [ID: ${companyId}]`);

        // Find a customer to assign contracts to
        let customer = await Customer.findOne({ companyId });
        if (!customer) {
            console.log('No customer found. Creating a default customer for rate contracts...');
            customer = await Customer.create({
                companyId,
                customerName: 'CUST-009',
                companyName: 'Bhartiya Pipes & Valves Ltd',
                mobile: '+919988776655',
                email: 'procurement@bhartiyapipes.com',
                gstin: '27AAAAA1111A1Z1',
                billingAddress: {
                    line1: 'Shed 4, MIDC Industrial Area',
                    city: 'Pune',
                    state: 'Maharashtra',
                    pincode: '411018'
                },
                defaultDiscount: 8,
                creditLimit: 5000000
            });
        }

        // Clean up previous CPQ data for fresh seed
        console.log('Cleaning up existing CPQ metadata...');
        await Product.deleteMany({ companyId, catalogType: { $in: ['Product', 'Service', 'Bundle', 'Subscription'] } });
        await PriceBook.deleteMany({ companyId });
        await PriceBookItem.deleteMany({ companyId });
        await PricingRule.deleteMany({ companyId });
        await DiscountPolicy.deleteMany({ companyId });
        await Promotion.deleteMany({ companyId });
        await CurrencyRate.deleteMany({ companyId });
        await SubscriptionPlan.deleteMany({ companyId });
        await CompetitorPrice.deleteMany({ companyId });
        await Contract.deleteMany({ companyId });

        console.log('Seeding products, services, subscriptions, and bundles...');
        // 1. Seed Products & Services
        const productsList = await Product.create([
            {
                companyId,
                productCode: 'ARM-BM-101',
                productName: 'Arm Premium Single Lever Basin Mixer',
                hsnCode: '84818020',
                gstPercentage: 18,
                basePrice: 5000,
                mrp: 6500,
                uom: 'Nos',
                catalogType: 'Product',
                status: 'Active',
                pricing: { baseCost: 3200, minPrice: 4200, maxPrice: 6200, marginPercent: 36, currency: 'INR' }
            },
            {
                companyId,
                productCode: 'ARM-SM-102',
                productName: 'Arm Brass Kitchen Sink Mixer',
                hsnCode: '84818020',
                gstPercentage: 18,
                basePrice: 5500,
                mrp: 7200,
                uom: 'Nos',
                catalogType: 'Product',
                status: 'Active',
                pricing: { baseCost: 3500, minPrice: 4800, maxPrice: 7000, marginPercent: 36.3, currency: 'INR' }
            },
            {
                companyId,
                productCode: 'SRV-INSTALL',
                productName: 'Bathroom Plumbing & Fitting Service',
                hsnCode: '998244',
                gstPercentage: 18,
                basePrice: 2000,
                mrp: 3000,
                uom: 'Hours',
                catalogType: 'Service',
                status: 'Active',
                pricing: { baseCost: 800, minPrice: 1500, maxPrice: 2800, marginPercent: 60, currency: 'INR' }
            },
            {
                companyId,
                productCode: 'SUB-SUPPORT',
                productName: 'Annual Plumber Support & Support Subscription',
                hsnCode: '998311',
                gstPercentage: 18,
                basePrice: 12000,
                mrp: 15000,
                uom: 'Yr',
                catalogType: 'Subscription',
                status: 'Active',
                pricing: { baseCost: 4000, minPrice: 9000, maxPrice: 14000, marginPercent: 66.6, currency: 'INR' },
                subscriptionDetails: { billingCycle: 'Monthly', setupFee: 1500, renewalPrice: 10000 }
            },
            {
                companyId,
                productCode: 'BNDL-LUXURY',
                productName: 'Arm Ultimate Luxury Bath Suite Bundle',
                hsnCode: '84818090',
                gstPercentage: 18,
                basePrice: 11000,
                mrp: 14000,
                uom: 'Set',
                catalogType: 'Bundle',
                status: 'Active',
                pricing: { baseCost: 7000, minPrice: 9500, maxPrice: 13000, marginPercent: 36.3, currency: 'INR' }
            }
        ]);

        console.log('Seeding Price Books & Items...');
        // 2. Seed Price Books
        const stdPriceBook = await PriceBook.create({
            companyId,
            name: 'Standard Price Book',
            type: 'Standard',
            description: 'Default price book for regular catalog sales',
            priority: 1,
            isActive: true
        });

        const custPriceBook = await PriceBook.create({
            companyId,
            name: 'Elite Distributor Pricing',
            type: 'Customer',
            description: 'Exclusive discounted rates for primary distribution partners',
            priority: 10,
            isActive: true
        });

        // Price Book Items
        await PriceBookItem.create([
            {
                companyId,
                priceBookId: stdPriceBook._id,
                productId: productsList[0]._id,
                price: 4800,
                currency: 'INR'
            },
            {
                companyId,
                priceBookId: stdPriceBook._id,
                productId: productsList[1]._id,
                price: 5200,
                currency: 'INR'
            },
            {
                companyId,
                priceBookId: custPriceBook._id,
                productId: productsList[0]._id,
                price: 4400, // Special distributor rate
                currency: 'INR'
            },
            {
                companyId,
                priceBookId: custPriceBook._id,
                productId: productsList[1]._id,
                price: 4900,
                currency: 'INR'
            }
        ]);

        console.log('Seeding Pricing Rules...');
        // 3. Seed Pricing Rules (Volume Slab rule)
        await PricingRule.create({
            companyId,
            name: 'Volume Slab Discount: Arm Basin Mixer',
            productId: productsList[0]._id,
            ruleType: 'Volume',
            conditions: [
                { minQty: 10, maxQty: 49, value: 12, type: 'discountPercent' },
                { minQty: 50, maxQty: 9999, value: 20, type: 'discountPercent' }
            ],
            isActive: true
        });

        console.log('Seeding Discount Policies...');
        // 4. Seed Discount Policies
        await DiscountPolicy.create({
            companyId,
            name: 'Strategic Infrastructure Partner Discount',
            type: 'Custom',
            discountType: 'Percentage',
            value: 5,
            stackable: true,
            isActive: true
        });

        console.log('Seeding Promotions & Currencies...');
        // 5. Seed Promotions
        await Promotion.create({
            companyId,
            code: 'FESTIVE15',
            name: 'Diwali Festive CPQ Campaign',
            promotionType: 'Coupon',
            discountPercent: 15,
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-11-30'),
            isActive: true
        });

        // 6. Seed Currency Exchange Rates
        await CurrencyRate.create([
            { companyId, fromCurrency: 'INR', toCurrency: 'USD', rate: 0.012, effectiveDate: new Date() },
            { companyId, fromCurrency: 'INR', toCurrency: 'EUR', rate: 0.011, effectiveDate: new Date() },
            { companyId, fromCurrency: 'INR', toCurrency: 'AED', rate: 0.044, effectiveDate: new Date() }
        ]);

        console.log('Seeding Competitor Log Info...');
        // 7. Seed Competitor pricing indices
        await CompetitorPrice.create([
            {
                companyId,
                productId: productsList[0]._id,
                competitorName: 'Acme Bathware Solutions',
                competitorPrice: 4200,
                currency: 'INR',
                source: 'Public Web Portal',
                observedDate: new Date()
            },
            {
                companyId,
                productId: productsList[1]._id,
                competitorName: 'Apex Plumbing Corp',
                competitorPrice: 4800,
                currency: 'INR',
                source: 'Client Quotation Match',
                observedDate: new Date(Date.now() - 3*24*60*60*1000)
            }
        ]);

        console.log('Seeding Customer Rate Contracts...');
        // 8. Seed Customer Pricing Contract
        await Contract.create({
            companyId,
            contractNumber: 'CTR-BHART-2026',
            title: 'Bhartiya Pipes Annual Rate Contract',
            customerId: customer._id,
            priceBookId: custPriceBook._id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 365*24*60*60*1000), // 1 year
            status: 'Active',
            lockedPrices: {}
        });

        console.log('🎉 Seeding successfully completed!');
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seed();
