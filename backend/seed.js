const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const TermsTemplate = require('./models/TermsTemplate');
require('dotenv').config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        // Clear existing data
        await Customer.deleteMany({});
        await Product.deleteMany({});
        await TermsTemplate.deleteMany({});

        // Seed Customers
        const customers = await Customer.insertMany([
            {
                customerName: 'John Doe',
                companyName: 'JD Interiors & Designs',
                gstin: '27AAACJ1234A1Z1',
                billingAddress: { line1: '101, Business Park', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
                mobile: '9876543210',
                email: 'john@jdinteriors.com',
                defaultDiscount: 10
            },
            {
                customerName: 'Sarah Smith',
                companyName: 'Alpha Builders Pvt Ltd',
                gstin: '24AABCA5678B1Z2',
                billingAddress: { line1: 'Sector 5, Hiranandani', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
                mobile: '9988776655',
                email: 'sarah@alphabuilders.in',
                defaultDiscount: 15
            }
        ]);

        // Seed Products
        await Product.insertMany([
            {
                productCode: 'JAG-WC-001',
                productName: 'Rimless Wall Hung WC with Soft Close Seat',
                hsnCode: '69101000',
                gstPercentage: 18,
                basePrice: 12500,
                mrp: 18500,
                uom: 'Nos'
            },
            {
                productCode: 'JAG-CP-502',
                productName: 'Single Lever Basin Mixer - Alive Series',
                hsnCode: '84818020',
                gstPercentage: 18,
                basePrice: 4200,
                mrp: 6500,
                uom: 'Nos'
            },
            {
                productCode: 'JAG-SHW-015',
                productName: 'Overhead Rain Shower 200x200mm',
                hsnCode: '84818020',
                gstPercentage: 18,
                basePrice: 2800,
                mrp: 4200,
                uom: 'Nos'
            }
        ]);

        // Seed Terms Templates
        await TermsTemplate.insertMany([
            {
                templateName: 'Standard Sanitaryware T&C',
                content: '1. Delivery: Within 7 days.\n2. Payment: 50% advance.\n3. Warranty: 10 years on ceramic.',
                isDefault: true
            },
            {
                templateName: 'CP Fittings Project T&C',
                content: '1. Delivery: Immediate.\n2. Payment: On delivery.\n3. Warranty: 5 years on plating.',
                isDefault: false
            }
        ]);

        console.log("Seed data created successfully!");
        process.exit();
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
};

seedData();
