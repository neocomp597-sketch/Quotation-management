const mongoose = require('mongoose');
const RolePermission = require('./models/RolePermission');
require('dotenv').config();

const dropIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://danish0007:XgM6y8uK0yD3qE3T@cluster0.aexn1.mongodb.net/test?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to DB');
        await RolePermission.collection.dropIndex('role_1');
        console.log('Successfully dropped old unique index role_1');
    } catch (err) {
        if (err.message.includes('index not found')) {
            console.log('Index role_1 does not exist, everything is fine.');
        } else {
            console.error('Failed to drop index:', err);
        }
    } finally {
        await mongoose.disconnect();
    }
};

dropIndex();
