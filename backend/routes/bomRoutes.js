const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const canManageBOM = requirePermission('master_bom');

router.use(protect);

// Complaint screens read BOMs through these, so they only need a logged-in user.
// There are deliberately no write endpoints for complaint BOMs.
router.get('/serial/:serialNumber', bomController.getBOMBySerial);
router.get('/ticket/:ticketId', bomController.getBOMForTicket);

router.get('/materials', canManageBOM, bomController.searchMaterials);
router.get('/', canManageBOM, bomController.listBOMs);
router.post('/', canManageBOM, bomController.createBOM);
router.get('/:id', canManageBOM, bomController.getBOMById);
router.put('/:id', canManageBOM, bomController.updateBOM);
router.delete('/:id', canManageBOM, bomController.deleteBOM);

module.exports = router;
