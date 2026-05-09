const mongoose = require('mongoose');
const Status = require('../models/Status');
require('dotenv').config();

const initialStatuses = [
    { name: 'Budget', color: '#3b82f6' },
    { name: 'B & B', color: '#8b5cf6' },
    { name: 'Firm', color: '#10b981' },
    { name: 'Invoice', color: '#f59e0b' },
    { name: 'Lost', color: '#ef4444' },
    { name: 'MFC', color: '#ec4899' },
    { name: 'Order Received', color: '#06b6d4' },
    { name: 'Others', color: '#64748b' },
    { name: 'Parked', color: '#78350f' }
];

const seedStatuses = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotations');
        console.log('Connected to MongoDB for seeding statuses...');

        for (const statusData of initialStatuses) {
            await Status.findOneAndUpdate(
                { name: statusData.name },
                statusData,
                { upsert: true, new: true }
            );
        }

        console.log('Statuses seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding statuses:', error);
        process.exit(1);
    }
};

seedStatuses();
