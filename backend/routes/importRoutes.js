const express = require('express');
const router = express.Router();
const multer = require('multer');
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


module.exports = router;
