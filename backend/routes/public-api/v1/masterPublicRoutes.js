const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/territories
router.get('/territories', requireApiScope('branches.read'), async (req, res) => {
    const territories = [
        { id: 'TR-01', name: 'North India Industrial Zone', states: ['Delhi', 'Haryana', 'Punjab', 'UP'], code: 'NZ-01' },
        { id: 'TR-02', name: 'West Manufacturing Hub', states: ['Maharashtra', 'Gujarat'], code: 'WZ-02' }
    ];
    return sendPaginated(res, territories, 1, 25, territories.length);
});

// GET /api/v1/states
router.get('/states', async (req, res) => {
    const states = [
        { stateCode: '07', stateName: 'Delhi', gstType: 'UTGST' },
        { stateCode: '27', stateName: 'Maharashtra', gstType: 'SGST' },
        { stateCode: '24', stateName: 'Gujarat', gstType: 'SGST' },
        { stateCode: '06', stateName: 'Haryana', gstType: 'SGST' }
    ];
    return sendSuccess(res, states, 200, 'State master list');
});

// GET /api/v1/cities
router.get('/cities', async (req, res) => {
    const cities = [
        { cityName: 'New Delhi', tier: 'Tier-1', state: 'Delhi' },
        { cityName: 'Mumbai', tier: 'Tier-1', state: 'Maharashtra' },
        { cityName: 'Ahmedabad', tier: 'Tier-1', state: 'Gujarat' },
        { cityName: 'Gurugram', tier: 'Tier-1', state: 'Haryana' }
    ];
    return sendSuccess(res, cities, 200, 'City master list');
});

// GET /api/v1/attributes
router.get('/attributes', requireApiScope('products.read'), async (req, res) => {
    const attrs = [
        { attrId: 'ATT-01', name: 'Operating Voltage', type: 'Dropdown', options: ['110V', '230V', '415V AC'] },
        { attrId: 'ATT-02', name: 'IP Ingress Protection', type: 'Dropdown', options: ['IP54', 'IP65', 'IP67'] }
    ];
    return sendSuccess(res, attrs, 200, 'Product attributes list');
});

// GET /api/v1/terms
router.get('/terms', requireApiScope('quotations.read'), async (req, res) => {
    const terms = [
        { termId: 'TRM-01', title: 'Standard Payment Terms', content: '30% Advance along with Purchase Order, 70% against proforma invoice before dispatch.' },
        { termId: 'TRM-02', title: 'Warranty Terms', content: '12 Months comprehensive warranty from the date of commissioning or 18 months from dispatch.' }
    ];
    return sendSuccess(res, terms, 200, 'Terms and conditions list');
});

// GET /api/v1/mgrs
router.get('/mgrs', requireApiScope('products.read'), async (req, res) => {
    const mgrs = [
        { mgrCode: 'MGR-ELEC', categoryName: 'Electrical & Automation Components' },
        { mgrCode: 'MGR-MECH', categoryName: 'Mechanical Drives & Gearing' }
    ];
    return sendSuccess(res, mgrs, 200, 'MGR master list');
});

// GET /api/v1/statuses
router.get('/statuses', async (req, res) => {
    const statuses = [
        { entity: 'Quotation', status: 'Draft', color: 'slate' },
        { entity: 'Quotation', status: 'Pending Approval', color: 'amber' },
        { entity: 'Quotation', status: 'Approved', color: 'emerald' },
        { entity: 'Quotation', status: 'Rejected', color: 'rose' }
    ];
    return sendSuccess(res, statuses, 200, 'Status master list');
});

// GET /api/v1/serials
router.get('/serials', async (req, res) => {
    const serials = [
        { serialNo: 'SN-2026-9001', itemCode: 'CNC-CTRL-01', status: 'In Warehouse', dispatchedDate: null }
    ];
    return sendSuccess(res, serials, 200, 'Serial number master list');
});

// GET /api/v1/flowcharts
router.get('/flowcharts', async (req, res) => {
    return sendSuccess(res, {
        builderVersion: '2.0',
        activeFlowchartsCount: 5,
        defaultApprovalNodes: ['Sales Rep Submit', 'Manager Discount Review', 'Finance Verification', 'Final Voucher Dispatch']
    }, 200, 'Flowchart builder configurations');
});

module.exports = router;
