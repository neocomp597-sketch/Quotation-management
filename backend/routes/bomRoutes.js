const express = require('express');
const multer = require('multer');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files are allowed'), false);
        }
    }
});

const handleUpload = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (error) {
        return res.status(400).json({ message: error.message });
    }
    return next();
});

router.use(protect);

// Complaint screens read BOMs through these, so they only need a logged-in user.
// There are deliberately no write endpoints for complaint BOMs.
router.get('/serial/:serialNumber', bomController.getBOMBySerial);
router.get('/ticket/:ticketId', bomController.getBOMForTicket);

router.get('/template', requirePermission('master_bom'), bomController.downloadTemplate);
router.post('/upload', requirePermission('master_bom'), handleUpload, bomController.uploadBOM);
router.get('/', requirePermission('master_bom'), bomController.listBOMs);
router.get('/:id', requirePermission('master_bom'), bomController.getBOMById);

module.exports = router;
