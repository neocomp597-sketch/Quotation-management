const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const TermsTemplate = require('./models/TermsTemplate');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        // Clear existing data
        await User.deleteMany({});
        await Customer.deleteMany({});
        await Product.deleteMany({});
        await TermsTemplate.deleteMany({});

        // 1. Create Users
        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('123456', salt); // Password: 123456
        const salesHash = await bcrypt.hash('123456', salt); // Password: 123456 for ease of testing

        const users = await User.insertMany([
            {
                name: 'System Admin',
                email: 'Admin@gmail.com',
                passwordHash: adminHash,
                role: 'admin'
            },
            {
                name: 'John Sales',
                email: 'sales@example.com',
                passwordHash: salesHash,
                role: 'sales'
            }
        ]);

        const salesUser = users[1];
        console.log('Admin User Created: Admin@gmail.com / 123456');
        console.log('Sales User Created: sales@example.com / 123456');

        // 2. Seed Customers (assigned to Sales User)
        await Customer.insertMany([
            {
                customerName: 'John Doe',
                companyName: 'JD Interiors & Designs',
                gstin: '27AAACJ1234A1Z1',
                billingAddress: { line1: '101, Business Park', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
                mobile: '9876543210',
                email: 'john@jdinteriors.com',
                defaultDiscount: 10,
                createdBy: salesUser._id
            },
            {
                customerName: 'Sarah Smith',
                companyName: 'Alpha Builders Pvt Ltd',
                gstin: '24AABCA5678B1Z2',
                billingAddress: { line1: 'Sector 5, Hiranandani', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
                mobile: '9988776655',
                email: 'sarah@alphabuilders.in',
                defaultDiscount: 15,
                createdBy: salesUser._id
            }
        ]);

        // 3. Seed Products
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
            }
        ]);

        // 4. Seed Terms Templates
        await TermsTemplate.insertMany([
            {
                templateName: 'Standard Sanitaryware T&C',
                content: '1. Delivery: Within 7 days.\n2. Payment: 50% advance.\n3. Warranty: 10 years on ceramic.',
                isDefault: true
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
