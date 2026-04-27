/**
 * Script to delete a specific Planning entry by ID
 * Usage: node delete_planning_entry.js <entryId>
 * Example: node delete_planning_entry.js 6942
 */

const mongoose = require('mongoose');
const Planning = require('../models/Planning');
require('dotenv').config();

const deleteEntry = async (entryId) => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        console.log(`Attempting to delete Planning entry with ID: ${entryId}`);
        
        // Attempt to delete the entry
        const result = await Planning.findByIdAndDelete(entryId);
        
        if (result) {
            console.log('✓ Entry deleted successfully!');
            console.log('Deleted entry:', {
                id: result._id,
                financialYear: result.financialYear,
                monthYear: result.monthYear,
                customerName: result.customerName,
                productName: result.productName,
                status: result.status,
                totalValue: result.totalValue
            });
        } else {
            console.log('✗ Entry not found. ID might be incorrect.');
        }
        
        await mongoose.connection.close();
        console.log('Database connection closed.');
    } catch (error) {
        console.error('Error deleting entry:', error.message);
        process.exit(1);
    }
};

// Get entry ID from command line arguments
const entryId = process.argv[2];

if (!entryId) {
    console.error('Error: Please provide an entry ID');
    console.error('Usage: node delete_planning_entry.js <entryId>');
    process.exit(1);
}

deleteEntry(entryId);
