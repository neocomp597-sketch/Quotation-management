const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess } = require('../../../utils/apiResponse');

// GET /api/v1/planning
router.get('/', requireApiScope('planning.read'), async (req, res) => {
    return sendSuccess(res, {
        totalAssemblyLines: 4,
        avgCapacityUtilizationPct: 82.4,
        currentWeekPlannedUnits: 140,
        bottleneckStation: 'Testing & Calibration Cell 2'
    }, 200, 'Production planning board matrix');
});

// GET /api/v1/simulations
router.get('/simulations', requireApiScope('planning.read'), async (req, res) => {
    return sendSuccess(res, {
        scenarios: [
            { scenarioId: 'SIM-01', name: 'Shift 3 Overtime Addition', throughputIncreasePct: 24.5, estCostDelta: 180000 },
            { scenarioId: 'SIM-02', name: 'Component Dual Sourcing Shift', leadTimeReductionDays: 5, estCostDelta: -45000 }
        ]
    }, 200, 'What-if capacity simulations');
});

module.exports = router;
