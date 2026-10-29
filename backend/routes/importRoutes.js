const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middlewares/authMiddleware');
const { enforceImportRowLimit } = require('../middlewares/importRowLimit');
const { limitImportConcurrency } = require('../middlewares/importConcurrency');
const { keepTenantContext } = require('../middlewares/tenantContext');
const { getImportProgress, getLatestImportProgress } = require('../utils/importProgress');
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
    getTicketTemplate,
    importVendors,
    getVendorTemplate,
    importPriceBooks,
    getPriceBookTemplate,
    importPriceBookItems,
    getPriceBookItemTemplate,
    importEmployees,
    getEmployeeTemplate,
    importContacts,
    getContactTemplate,
    importContracts,
    getContractTemplate,
    importTenders,
    getTenderTemplate,
    importAssets,
    getAssetTemplate
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

// The upload keeps the tenant context protect opened (multer finishes outside it), so the
// importers run with the company and branch filters of the user who uploads.
const uploadFile = keepTenantContext(upload.single('file'));

// Live progress of the user's latest import, optionally of one module (?module=products).
router.get('/progress', protect, (req, res) => {
    const progress = getLatestImportProgress(req.user, String(req.query.module || '') || null);
    if (!progress) return res.status(404).json({ message: 'No import is running on this server.' });
    return res.json(progress);
});

// Live progress of an import started with an X-Import-Id header (see utils/importProgress).
router.get('/progress/:id', protect, (req, res) => {
    const progress = getImportProgress(req.params.id, req.user);
    if (!progress) return res.status(404).json({ message: 'No import with this id is running on this server.' });
    return res.json(progress);
});

// Import routes
router.post('/products', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importProducts);
router.post('/customers', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importCustomers);
router.post('/attributes', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importAttributes);
router.post('/attribute-master', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importAttributeMaster);
router.post('/planning', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importPlanning);
router.post('/warranties', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importWarranties);
router.post('/amcs', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importAmcs);
router.post('/tickets', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importTickets);
router.post('/vendors', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importVendors);
router.post('/price-books', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importPriceBooks);
router.post('/price-book-items/:priceBookId', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importPriceBookItems);

router.post('/employees', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importEmployees);
router.post('/contacts', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importContacts);
router.post('/contracts', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importContracts);
router.post('/tenders', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importTenders);
router.post('/assets', protect, uploadFile, enforceImportRowLimit, limitImportConcurrency, importAssets);

// Template download routes
router.get('/template/products', getProductTemplate);

router.get('/template/customers', getCustomerTemplate);
router.get('/template/attributes', getAttributeTemplate);
router.get('/template/attribute-master', getAttributeMasterTemplate);
router.get('/template/planning', protect, getPlanningTemplate);
router.get('/template/warranties', protect, getWarrantyTemplate);
router.get('/template/amcs', protect, getAmcTemplate);
router.get('/template/tickets', protect, getTicketTemplate);
router.get('/template/assets', protect, getAssetTemplate);
router.get('/template/vendors', getVendorTemplate);
router.get('/template/price-books', getPriceBookTemplate);
router.get('/template/price-book-items', getPriceBookItemTemplate);
router.get('/template/employees', getEmployeeTemplate);
router.get('/template/contacts', getContactTemplate);
router.get('/template/contracts', getContractTemplate);
router.get('/template/tenders', getTenderTemplate);


router.get('/missing-codes/:filename', protect, (req, res) => {
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

module.exports = router;
