const express = require('express');
const router = express.Router();
const ownAssets = require('../controllers/ownAssetController');
const { protect } = require('../middlewares/authMiddleware');

// Own Assets: /:view is mine, manager or team. Each is its own screen in Authorization, and
// protect checks the screen and action of every request (config/apiPermissions.js).
router.use(protect);
router.param('view', ownAssets.loadView);

router.get('/:view', ownAssets.list);
router.get('/:view/assignable', ownAssets.searchAssignable);
router.post('/:view/assign', ownAssets.assign);
router.get('/:view/:assetId/log', ownAssets.log);
router.put('/:view/:assetId', ownAssets.update);
router.post('/:view/:assetId/return', ownAssets.takeBack);

module.exports = router;
