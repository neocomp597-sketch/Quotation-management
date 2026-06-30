const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middlewares/authMiddleware');
const {
    importProducts,
    importCustomers,
    importAttributes,
    getProductTemplate,
    getCustomerTemplate,
    getAttributeTemplate,
    importAttributeMaster,
    getAttributeMasterTemplate,
    importPlanning,
    getPlanningTemplate,
    importWarranties,
    importAmcs,
    getWarrantyTemplate,
    getAmcTemplate,
    importTickets,
    getTicketTemplate
} = require('../controllers/importController');

// Multer memory storage for Excel/CSV files
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel', // xls
            'text/csv', // csv
            'application/csv'
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files are allowed'), false);
        }
    }
});

// Import routes
router.post('/products', protect, upload.single('file'), importProducts);
router.post('/customers', protect, upload.single('file'), importCustomers);
router.post('/attributes', protect, upload.single('file'), importAttributes);
router.post('/attribute-master', protect, upload.single('file'), importAttributeMaster);
router.post('/planning', protect, upload.single('file'), importPlanning);
router.post('/warranties', protect, upload.single('file'), importWarranties);
router.post('/amcs', protect, upload.single('file'), importAmcs);
router.post('/tickets', protect, upload.single('file'), importTickets);

// Template download routes
router.get('/template/products', getProductTemplate);
router.get('/template/customers', getCustomerTemplate);
router.get('/template/attributes', getAttributeTemplate);
router.get('/template/attribute-master', getAttributeMasterTemplate);
router.get('/template/planning', protect, getPlanningTemplate);
router.get('/template/warranties', protect, getWarrantyTemplate);
router.get('/template/amcs', protect, getAmcTemplate);
router.get('/template/tickets', protect, getTicketTemplate);

// Debug endpoint to read Excel headers
router.post('/debug-headers', upload.single('file'), (req, res) => {
    try {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        res.json({ headers: data[0], sample: data.slice(1, 11) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/missing-codes/:filename', (req, res) => {
    const { filename } = req.params;
    const validFilenames = ['missing_customer_codes.txt', 'missing_product_codes.txt', 'missing_mgr1_codes.txt', 'missing_mgr2_codes.txt'];
    
    if (!validFilenames.includes(filename)) {
        return res.status(400).json({ message: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
    }
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.sendFile(filePath);
});

// Specialized seeding endpoint for Tally Sales Register
router.post('/seed-file', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const path = require('path');
        const Planning = require('../models/Planning');
        const Customer = require('../models/Customer');
        const Product = require('../models/Product');
        const MGR = require('../models/MGR');
        
        const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row && (row.includes('Date') || row.includes('Particulars'))) {
                headerIdx = i;
                break;
            }
        }
        
        if (headerIdx === -1) throw new Error('Could not find headers in Excel file');
        
        const headers = rows[headerIdx];
        const dataRows = rows.slice(headerIdx + 1);
        const colMap = {};
        headers.forEach((h, idx) => {
            const sh = String(h || '').trim();
            if (sh === 'Date') colMap.date = idx;
            if (sh === 'Particulars') colMap.particulars = idx;
            if (sh === 'Quantity' || sh === 'Qty') colMap.qty = idx;
            if (sh === 'Rate') colMap.rate = idx;
            if (sh === 'Value' || sh === 'Amount') colMap.value = idx;
        });

        const sbus = ['EPC', 'SBU1', 'SBU2', 'SBU3'];
        const segments = ['Export', 'Industry', 'UC', 'Utility'];
        
        const defaultProduct = await Product.findOne();
        const defaultCustomer = await Customer.findOne();

        // Clear existing for 2026-27 to start fresh
        await Planning.deleteMany({ financialYear: '2026-27' });

        const entries = [];
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row || !row[colMap.date] || !row[colMap.particulars]) continue;
            
            let dateObj = typeof row[colMap.date] === 'number' 
                ? new Date((row[colMap.date] - 25569) * 86400 * 1000)
                : new Date(row[colMap.date]);
            
            if (isNaN(dateObj.getTime())) continue;
            
            // Shift to 2026-27 for current report view
            const month = dateObj.getMonth();
            const year = 2026 + (month < 3 ? 1 : 0);
            const financialYear = '2026-27';
            const monthYear = `${dateObj.toLocaleString('default', { month: 'short' })}-${String(year).slice(-2)}`;
            const monthNum = ((month - 3 + 12) % 12) + 1;

            const qty = Math.abs(Number(row[colMap.qty]) || 1);
            const value = Math.abs(Number(row[colMap.rate] || row[colMap.value]) || 1000);
            
            const particulars = String(row[colMap.particulars]).trim();
            let customer = await Customer.findOne({ 
                $or: [{ companyName: new RegExp(`^${particulars}$`, 'i') }, { customerName: new RegExp(`^${particulars}$`, 'i') }]
            });
            if (!customer) customer = defaultCustomer;

            // Distribute across SBUs and Segments for the report representation
            const sbu = sbus[i % sbus.length];
            const segment = segments[Math.floor(i / sbus.length) % segments.length];

            entries.push({
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
                mgrCode: sbu,
                mgrCode2: segment,
                status: 'Invoice',
                createdBy: null
            });
        }
        
        if (entries.length === 0) throw new Error('No valid entries found to seed');
        
        await Planning.insertMany(entries);
        res.json({ message: `Successfully seeded ${entries.length} entries for FY 2026-27` });
    } catch (err) {
        console.error('Seeding error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
