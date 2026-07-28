const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', branchController.getAllBranches);
router.post('/', branchController.createBranch);
router.get('/:id', branchController.getBranchById);
router.put('/:id', branchController.updateBranch);
router.delete('/:id', branchController.deleteBranch);
router.get('/:id/next-emp-id', branchController.getNextEmployeeId);

module.exports = router;
