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
    getPlanningTemplate

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
router.post('/products', upload.single('file'), importProducts);
router.post('/customers', protect, upload.single('file'), importCustomers);
router.post('/attributes', upload.single('file'), importAttributes);
router.post('/attribute-master', upload.single('file'), importAttributeMaster);
router.post('/planning', protect, upload.single('file'), importPlanning);


// Template download routes
router.get('/template/products', getProductTemplate);
router.get('/template/customers', getCustomerTemplate);
router.get('/template/attributes', getAttributeTemplate);
router.get('/template/attribute-master', getAttributeMasterTemplate);
router.get('/template/planning', protect, getPlanningTemplate);

router.get('/missing-codes/:filename', (req, res) => {
    const { filename } = req.params;
    const validFilenames = ['missing_customer_codes.txt', 'missing_product_codes.txt'];
    
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
