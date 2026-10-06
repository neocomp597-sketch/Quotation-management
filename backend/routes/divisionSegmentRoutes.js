const express = require('express');
const multer = require('multer');
const { protect } = require('../middlewares/authMiddleware');
const controller = require('../controllers/divisionSegmentController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Mounted at /api/divisions
const divisionRouter = express.Router();
divisionRouter.use(protect);
divisionRouter.get('/', controller.getDivisions);
divisionRouter.post('/', controller.createDivision);
divisionRouter.put('/:id', controller.updateDivision);
divisionRouter.delete('/:id', controller.deleteDivision);

// Mounted at /api/segments
const segmentRouter = express.Router();
segmentRouter.use(protect);
segmentRouter.get('/template', controller.getSegmentTemplate);
segmentRouter.get('/export', controller.exportSegments);
segmentRouter.post('/import', upload.single('file'), controller.importSegments);
segmentRouter.get('/', controller.getSegments);
segmentRouter.post('/', controller.createSegment);
segmentRouter.put('/:id', controller.updateSegment);
segmentRouter.delete('/:id', controller.deleteSegment);

module.exports = { divisionRouter, segmentRouter };
