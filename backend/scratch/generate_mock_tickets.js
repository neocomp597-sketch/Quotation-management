const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

async function generate() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to MongoDB');

        // Fetch some real customers and products
        const customers = await Customer.find({}).limit(10);
        const products = await Product.find({}).limit(5);

        // Find or fallback to "Brass Hose Connector"
        let brassProduct = await Product.findOne({ productName: /Brass Hose Connector/i });
        if (!brassProduct) {
            // Find any first product or use a mock one
            brassProduct = products[0] || { productCode: 'BHC-001', productName: 'Brass Hose Connector' };
        }

        const templateData = [];

        // Generate 10 mock records, simulating 10 pieces with unique serial numbers sold to 10 customers
        for (let i = 1; i <= 10; i++) {
            const cust = customers[i - 1] || customers[0];
            const serialNo = `BHC-SN-000${i}`;
            const desc = `Automated mock support ticket for piece #${i} of Brass Hose Connector.`;
            const date = new Date(Date.now() - (11 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            
            templateData.push({
                'Ticket No': `CSM-2026-MOCK${1000 + i}`,
                'Customer Code': cust ? (cust.externalCode || cust.customerName) : `Mock Customer ${i}`,
                'Product Code': brassProduct.productCode,
                'Product Serial No.': serialNo,
                'Issue Title': `Brass Hose Connector - Issue with piece #${i}`,
                'Description': desc,
                'Priority': i % 3 === 0 ? 'High' : (i % 2 === 0 ? 'Medium' : 'Low'),
                'Category': 'Hardware',
                'Ticket Type': 'Complaint',
                'Status': i <= 8 ? 'Open' : 'Resolved',
                'Issue Date': date
            });
        }

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

        worksheet['!cols'] = [
            { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 35 }, { wch: 55 },
            { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }
        ];

        const destPath = 'D:\\tally\\Quotations\\ticket_import_template.xlsx';
        XLSX.writeFile(workbook, destPath);
        console.log(`Successfully generated template with 10 mock tickets at ${destPath}`);

    } catch (err) {
        console.error('Error generating mock data:', err);
    } finally {
        await mongoose.disconnect();
    }
}

generate();
