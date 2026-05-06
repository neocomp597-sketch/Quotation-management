const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.resolve(__dirname, 'backend', '.env') });

const Planning = require('./backend/models/Planning');
const Customer = require('./backend/models/Customer');
const Product = require('./backend/models/Product');
const MGR = require('./backend/models/MGR');
const User = require('./backend/models/User');

const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

async function seed() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const admin = await User.findOne({ email: 'Admin@gmail.com' });
    const defaultMgr = await MGR.findOne({ mgrType: 'MGR1' });
    const defaultProduct = await Product.findOne();
    const defaultCustomer = await Customer.findOne();

    if (!defaultMgr || !defaultProduct || !defaultCustomer) {
        console.error('Missing master data (MGR1, Product, or Customer)');
        process.exit(1);
    }

    const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
    console.log('Reading Excel file:', filePath);
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // We'll read the data as a 2D array first to find the header row
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.includes('Date') || row.includes('Particulars')) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) {
        console.error('Could not find header row with "Date" or "Particulars"');
        process.exit(1);
    }

    console.log('Found header at row:', headerIdx + 1);
    const headers = rows[headerIdx];
    const dataRows = rows.slice(headerIdx + 1);

    const colMap = {};
    headers.forEach((h, idx) => {
        if (!h) return;
        const sh = String(h).trim();
        if (sh === 'Date') colMap.date = idx;
        if (sh === 'Particulars') colMap.particulars = idx;
        if (sh === 'Quantity' || sh === 'Qty') colMap.qty = idx;
        if (sh === 'Rate') colMap.rate = idx;
        if (sh === 'Value' || sh === 'Amount') colMap.value = idx;
        if (sh === 'Vch Type') colMap.vchType = idx;
    });

    console.log('Column Map:', colMap);

    const planningEntries = [];
    
    // Cache for customers and products to speed up
    const customerCache = new Map();
    const productCache = new Map();

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row[colMap.date] || !row[colMap.particulars]) continue;

        try {
            // Parse Date
            let dateVal = row[colMap.date];
            let dateObj;
            if (typeof dateVal === 'number') {
                dateObj = new Date((dateVal - 25569) * 86400 * 1000);
            } else {
                dateObj = new Date(dateVal);
            }

            if (isNaN(dateObj.getTime())) continue;

            const month = dateObj.getMonth(); // 0-11
            const year = dateObj.getFullYear();
            const startYear = month >= 3 ? year : year - 1;
            const financialYear = `${startYear}-${String(startYear + 1).slice(-2)}`;
            const monthName = FY_MONTHS[(month - 3 + 12) % 12];
            const monthYear = `${dateObj.toLocaleString('default', { month: 'short' })}-${String(year).slice(-2)}`;
            const monthNum = ((month - 3 + 12) % 12) + 1; // Apr=1, Mar=12

            // Customer
            const particulars = String(row[colMap.particulars]).trim();
            let customer = customerCache.get(particulars);
            if (!customer) {
                customer = await Customer.findOne({ 
                    $or: [
                        { companyName: new RegExp(`^${particulars}$`, 'i') },
                        { customerName: new RegExp(`^${particulars}$`, 'i') }
                    ]
                });
                if (!customer) customer = defaultCustomer;
                customerCache.set(particulars, customer);
            }

            // Qty & Value
            const qty = Math.abs(Number(row[colMap.qty]) || 0);
            const value = Math.abs(Number(row[colMap.rate] || row[colMap.value]) || 0);

            if (qty === 0 || value === 0) continue;

            planningEntries.push({
                monthYear,
                financialYear,
                month: monthNum,
                customerId: customer._id,
                customerName: customer.companyName || customer.customerName,
                productId: defaultProduct._id,
                productName: defaultProduct.productName,
                qty,
                value,
                totalValue: qty * value,
                mgrCode: defaultMgr.code,
                status: 'Invoice',
                createdBy: admin?._id
            });
        } catch (err) {
            console.error(`Error processing row ${i}:`, err.message);
        }
    }

    console.log(`Prepared ${planningEntries.length} entries. Seeding...`);
    
    // Clear existing for this range to avoid duplicates if re-running
    // Or just insert
    await Planning.insertMany(planningEntries);
    console.log('Seeding completed successfully.');
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed script failed:', err);
    process.exit(1);
});
