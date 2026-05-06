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
        
        let logs = `Total rows found: ${rows.length}\n`;
        logs += 'Sample rows (first 15):\n';
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
            // Normalize SBU name
            let sbuCode = h.replace(/[^A-Z0-9]/g, '');
            sbuColumns.push({ index: c, code: sbuCode });
        }
        
        const defaultProduct = await Product.findOne() || { _id: new mongoose.Types.ObjectId(), productName: 'Default Product' };
        const defaultCustomer = await Customer.findOne() || { _id: new mongoose.Types.ObjectId(), companyName: 'Default Customer' };

        // Clear existing for 2026-27 to start fresh
        await Planning.deleteMany({ financialYear: '2026-27' });
        console.log('Cleared existing 2026-27 data');

        const entries = [];
        let currentMonthNum = null;
        let currentMonthYear = null;
        
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            
            const rowLabel = String(row[0]).trim();
            if (rowLabel === 'Grand Total') break;
            
            // Check if it's a month row (e.g., "April-2025" or "January-2026")
            const monthMatch = rowLabel.match(/^([a-zA-Z]+)-\d{4}$/i);
            if (monthMatch) {
                const monthNameFull = monthMatch[1];
                const dateObj = new Date(`${monthNameFull} 1, 2025`); // Just for parsing month name
                const month = dateObj.getMonth();
                const year = 2026 + (month < 3 ? 1 : 0);
                currentMonthYear = `${dateObj.toLocaleString('default', { month: 'short' })}-${String(year).slice(-2)}`;
                currentMonthNum = ((month - 3 + 12) % 12) + 1;
                continue;
            }
            
            // If it's a segment row (e.g., "Debtors - Export")
            if (rowLabel.startsWith('Debtors - ') && currentMonthYear) {
                let segmentRaw = rowLabel.replace('Debtors - ', '').trim();
                let segment = segmentRaw;
                if (segmentRaw === 'Industries') segment = 'Industry';
                if (segmentRaw === 'Utility Contractor') segment = 'UC';
                
                // For each SBU column, get the value
                for (const sbuCol of sbuColumns) {
                    const val = row[sbuCol.index];
                    if (typeof val === 'number' && val !== 0) {
                        entries.push({
                            monthYear: currentMonthYear,
                            financialYear: '2026-27',
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
            console.log(`Successfully seeded ${entries.length} entries for FY 2026-27`);
        } else {
            console.log('No valid entries found to seed');
        }
    } catch (err) {
        console.error('Seeding error:', err);
    }
}

module.exports = seedData;
