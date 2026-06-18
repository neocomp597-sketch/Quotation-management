const express = require('express');
const router = express.Router();
const {
    createContact,
    getAllContacts,
    getContactById,
    updateContact,
    deleteContact
} = require('../controllers/contactController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/', createContact);
router.get('/', getAllContacts);
router.get('/:id', getContactById);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;
