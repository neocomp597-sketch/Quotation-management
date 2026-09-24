const express = require('express');
const multer = require('multer');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const ATTACHMENT_EXTENSIONS = /\.(pdf|xlsx|xls|docx|doc|jpg|jpeg|png|dwg|dxf)$/i;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ATTACHMENT_EXTENSIONS.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('Allowed files: PDF, XLSX, DOCX, JPG, PNG, DWG, DXF'), false);
        }
    }
});

const handleUpload = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (error) {
        return res.status(400).json({ message: error.message });
    }
    return next();
});

const canViewBOM = requirePermission('master_bom');
const canEditBOM = requirePermission('bom_create');

router.use(protect);

// Complaint screens read the Active BOM through these, so they only need a logged-in user.
// There are deliberately no write endpoints for complaint BOMs.
router.get('/complaint/ticket/:ticketId', bomController.getComplaintBOMForTicket);
router.get('/complaint/lookup', bomController.getComplaintBOMLookup);

router.get('/options', canViewBOM, bomController.getOptions);
router.get('/materials', canViewBOM, bomController.searchMaterials);
router.post('/validate', canEditBOM, bomController.validateDraft);

router.get('/', canViewBOM, bomController.listBOMs);
router.post('/', canEditBOM, bomController.createBOM);
router.get('/:id', canViewBOM, bomController.getBOM);
router.put('/:id', canEditBOM, bomController.updateBOM);
router.delete('/:id', canEditBOM, bomController.deleteBOM);

// Workflow. Stage approvals check the stage-specific permission inside the controller.
router.post('/:id/submit', canEditBOM, bomController.submitBOM);
router.post('/:id/approve', bomController.approveBOM);
router.post('/:id/send-back', bomController.sendBackBOM);
router.post('/:id/reject', bomController.rejectBOM);
router.post('/:id/release', bomController.releaseBOM);
router.post('/:id/obsolete', bomController.obsoleteBOM);
router.post('/:id/revise', canEditBOM, bomController.reviseBOM);

router.post('/:id/attachments', canEditBOM, handleUpload, bomController.addAttachment);
router.delete('/:id/attachments/:attachmentId', canEditBOM, bomController.removeAttachment);

module.exports = router;
