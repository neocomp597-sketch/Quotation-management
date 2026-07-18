const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { runWithTenant } = require('../middlewares/tenantContext');
const { importProducts } = require('../controllers/importController');

async function testImport() {
    console.log('Connecting to Mongo...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const filePath = path.resolve(__dirname, '..', '..', 'products_import_filled (1).xlsx');
    console.log('File path:', filePath);
    
    if (!fs.existsSync(filePath)) {
        console.error('Import file does not exist at:', filePath);
        await mongoose.disconnect();
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Mock Express req and res
    const req = {
        file: {
            buffer: fileBuffer,
            originalname: 'products_import_filled (1).xlsx',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        user: {
            id: '695a75e7ac70ed0e6a2ffba5',
            name: 'Admin',
            email: 'Admin@gmail.com',
            role: 'admin',
            companyId: '6a0b44ab81a41f89dab23668'
        }
    };

    const res = {
        status(code) {
            console.log('Response Status:', code);
            return this;
        },
        json(data) {
            console.log('Response JSON:', JSON.stringify(data, null, 2));
            return this;
        }
    };

    await runWithTenant(req.user.companyId, async () => {
        await importProducts(req, res);
    });

    await mongoose.disconnect();
}

testImport();
