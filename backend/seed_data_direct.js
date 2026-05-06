const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Planning = require('./models/Planning');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const MGR = require('./models/MGR');
require('fs').writeFileSync(path.join(__dirname, 'debug.txt'), 'Module Loaded');

async function seedData() {
    try {
        console.log('Starting direct seeding process...');
        const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i][0] === 'Row Labels') {
                headerIdx = i;
                break;
            }
        }
        
        if (headerIdx === -1) {
            console.error('Could not find "Row Labels" header for Pivot Table.');
            return;
        }
        
        const headers = rows[headerIdx];
        const sbuColumns = [];
        for (let c = 1; c < headers.length; c++) {
            const h = String(headers[c] || '').trim().toUpperCase();
            if (h === 'GRAND TOTAL' || h === '(BLANK)') continue;
            let sbuCode = h.replace(/[^A-Z0-9]/g, '');
            sbuColumns.push({ index: c, code: sbuCode });
        }
        
        const defaultProduct = await Product.findOne() || { _id: new mongoose.Types.ObjectId(), productName: 'Default Product' };
        const defaultCustomer = await Customer.findOne() || { _id: new mongoose.Types.ObjectId(), companyName: 'Default Customer' };

        // Clear existing for both FY to start fresh as requested
        await Planning.deleteMany({ financialYear: { $in: ['2025-26', '2026-27'] } });
        console.log('Cleared existing 2025-26 and 2026-27 data');

        const entries = [];
        let currentMonthNum = null;
        let currentMonthYear = null;
        let currentFinancialYear = null;
        
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            
            const rowLabel = String(row[0]).trim();
            if (rowLabel === 'Grand Total') break;
            
            const monthMatch = rowLabel.match(/^([a-zA-Z]+)-(\d{4})$/i);
            if (monthMatch) {
                const monthNameFull = monthMatch[1];
                const year = parseInt(monthMatch[2], 10);
                const dateObj = new Date(`${monthNameFull} 1, 2000`);
                const month = dateObj.getMonth();
                
                const startYear = month >= 3 ? year : year - 1;
                currentFinancialYear = `${startYear}-${String(startYear + 1).slice(-2)}`;
                currentMonthYear = `${dateObj.toLocaleString('default', { month: 'short' })}-${String(year).slice(-2)}`;
                currentMonthNum = ((month - 3 + 12) % 12) + 1;
                continue;
            }
            
            if (rowLabel.startsWith('Debtors - ') && currentMonthYear && currentFinancialYear) {
                let segmentRaw = rowLabel.replace('Debtors - ', '').trim();
                let segment = segmentRaw;
                if (segmentRaw === 'Industries') segment = 'Industry';
                if (segmentRaw === 'Utility Contractor') segment = 'UC';
                
                for (const sbuCol of sbuColumns) {
                    const val = row[sbuCol.index];
                    if (typeof val === 'number' && val !== 0) {
                        entries.push({
                            monthYear: currentMonthYear,
                            financialYear: currentFinancialYear,
                            month: currentMonthNum,
                            customerId: defaultCustomer._id,
                            customerName: defaultCustomer.companyName || defaultCustomer.customerName,
                            productId: defaultProduct._id,
                            productName: defaultProduct.productName,
                            qty: 1,
                            value: Math.abs(val),
                            totalValue: Math.abs(val),
                            mgrCode: sbuCol.code,
                            mgrCode2: segment,
                            status: 'Firm',
                            createdBy: null
                        });
                    }
                }
            }
        }
        
        if (entries.length > 0) {
            await Planning.insertMany(entries);
            console.log(`Successfully seeded ${entries.length} entries into 2025-26.`);
        } else {
            console.log('No valid entries found to seed');
        }
    } catch (err) {
        console.error('Seeding error:', err);
    }
}

module.exports = seedData;
