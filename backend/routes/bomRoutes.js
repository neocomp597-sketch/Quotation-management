const express = require('express');
const multer = require('multer');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const canManageBOM = requirePermission('master_bom');

// Workbooks are parsed in memory; nothing is written to disk.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
        cb(ok ? null : new Error('Only .xlsx, .xls and .csv files are supported'), ok);
    }
});

router.use(protect);

// Complaint screens read BOMs through these, so they only need a logged-in user.
// There are deliberately no write endpoints for complaint BOMs.
router.get('/serial/:serialNumber', bomController.getBOMBySerial);
router.get('/ticket/:ticketId', bomController.getBOMForTicket);

router.get('/materials', canManageBOM, bomController.searchMaterials);
router.get('/template', canManageBOM, bomController.downloadTemplate);
router.post('/upload', canManageBOM, upload.single('file'), bomController.uploadBOM);
router.get('/', canManageBOM, bomController.listBOMs);
router.post('/', canManageBOM, bomController.createBOM);
router.get('/:id/export', canManageBOM, bomController.exportBOM);
router.get('/:id', canManageBOM, bomController.getBOMById);
router.put('/:id', canManageBOM, bomController.updateBOM);
router.delete('/:id', canManageBOM, bomController.deleteBOM);

module.exports = router;
