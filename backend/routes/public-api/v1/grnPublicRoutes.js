const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/grn
router.get('/', requireApiScope('inventory.read'), async (req, res) => {
    const grnList = [
        { grnNo: 'GRN-2026-0492', vendorName: 'Siemens India Pvt Ltd', poNumber: 'PO-9842', itemDesc: 'SIMATIC S7-1500 PLC CPU Modules', totalQty: 25, status: 'Verified & Accepted', receivedDate: '2026-08-10' },
        { grnNo: 'GRN-2026-0493', vendorName: 'Schneider Electric', poNumber: 'PO-9845', itemDesc: 'Variable Frequency Drives (VFD) 15kW', totalQty: 10, status: 'Inspection Pending', receivedDate: '2026-08-11' }
    ];
    return sendPaginated(res, grnList, 1, 25, grnList.length);
});

// POST /api/v1/grn
router.post('/', requireApiScope('inventory.write'), async (req, res) => {
    return sendSuccess(res, {
        grnNo: `GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'Created',
        receivedDate: new Date()
    }, 201, 'Goods Receipt Note created successfully');
});

module.exports = router;
