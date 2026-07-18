const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Status = require('./models/Status');
require('dotenv').config();

const DEFAULT_STATUSES = [
    { name: 'Budget', color: '#6366f1', isActive: true }, 
    { name: 'Firm', color: '#10b981', isActive: true }, 
    { name: 'MFC', color: '#f59e0b', isActive: true }, 
    { name: 'B & B', color: '#3b82f6', isActive: true }, 
    { name: 'Others', color: '#64748b', isActive: true }, 
    { name: 'Order Received', color: '#8b5cf6', isActive: true }, 
    { name: 'Invoice', color: '#ec4899', isActive: true }, 
    { name: 'Lost', color: '#ef4444', isActive: true }, 
    { name: 'Parked', color: '#84cc16', isActive: true }
];

async function seedStatuses() {
    try {
        await connectDB();
        console.log('Connected to DB');

        for (const statusData of DEFAULT_STATUSES) {
            const existing = await Status.findOne({ name: { $regex: new RegExp(`^${statusData.name}$`, 'i') } });
            if (!existing) {
                await Status.create(statusData);
                console.log(`Created status: ${statusData.name}`);
            } else {
                console.log(`Status already exists: ${statusData.name}`);
            }
        }

        console.log('Statuses seeding completed successfully!');
    } catch (error) {
        console.error('Error seeding statuses:', error);
    } finally {
        process.exit(0);
    }
}

seedStatuses();
