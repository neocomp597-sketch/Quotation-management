const express = require('express');
const multer = require('multer');
const router = express.Router();
const importJobController = require('../controllers/importJobController');
const { protect } = require('../middlewares/authMiddleware');
const { keepTenantContext } = require('../middlewares/tenantContext');

// Bulk import jobs: preview -> fix -> import -> retry (services/importEngine). The controller
// checks the module's Create permission and that the job belongs to the user, for every route.

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/\.(xlsx|xls|csv)$/i.test(file.originalname || '')) return cb(null, true);
        const error = new Error('Only Excel (.xlsx, .xls) and CSV files can be imported.');
        error.code = 'UNSUPPORTED_FILE';
        return cb(error);
    }
});

// The upload keeps the tenant context `protect` opened (multer finishes outside it). Multer
// problems (too large, wrong type) become plain answers instead of a server error.
const receiveFile = keepTenantContext(upload.single('file'));
const singleFile = (req, res, next) => receiveFile(req, res, (error) => afterUpload(error, res, next));

const afterUpload = (error, res, next) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'This file is larger than 10 MB.', hint: 'Split it into smaller files and import them one at a time.' });
    }
    return res.status(400).json({
        code: error.code === 'UNSUPPORTED_FILE' ? 'UNSUPPORTED_FILE' : 'UPLOAD_FAILED',
        message: error.message || 'The file could not be uploaded.',
        hint: 'Save the file as .xlsx or .csv and try again.'
    });
};

router.use(protect);

router.get('/modules/:module', importJobController.getModule);
router.get('/', importJobController.listJobs);
router.post('/preview', singleFile, importJobController.preview);
router.get('/:jobId', importJobController.getJob);
router.put('/:jobId', importJobController.updateJob);
router.get('/:jobId/rows', importJobController.getRows);
router.patch('/:jobId/rows', importJobController.correctRows);
router.post('/:jobId/corrections', singleFile, importJobController.uploadCorrections);
router.post('/:jobId/execute', importJobController.execute);
router.get('/:jobId/export', importJobController.exportRows);

module.exports = router;
