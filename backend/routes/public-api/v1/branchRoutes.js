const express = require('express');
const router = express.Router();
const Branch = require('../../../models/Branch');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/branches - List branches
router.get('/', requireApiScope('branches.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { name: searchRegex },
                { code: searchRegex },
                { city: searchRegex },
                { state: searchRegex }
            ];
        }

        const [branches, total] = await Promise.all([
            Branch.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Branch.countDocuments(filter)
        ]);

        const formatted = branches.map(b => ({
            id: b._id,
            name: b.name,
            code: b.code,
            branchPrefix: b.branchPrefix,
            address: b.address || '',
            city: b.city || '',
            state: b.state || '',
            pincode: b.pincode || '',
            contactNo: b.contactNo || '',
            email: b.email || '',
            gstNo: b.gstNo || '',
            status: b.status || 'Active',
            createdAt: b.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching branches:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve branches', 500);
    }
});

// GET /api/v1/branches/:id - Get single branch
router.get('/:id', requireApiScope('branches.read'), async (req, res) => {
    try {
        const branch = await Branch.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!branch) {
            return sendError(res, 'resource_not_found', 'Branch was not found', 404);
        }

        const formatted = {
            id: branch._id,
            name: branch.name,
            code: branch.code,
            branchPrefix: branch.branchPrefix,
            address: branch.address || '',
            city: branch.city || '',
            state: branch.state || '',
            pincode: branch.pincode || '',
            contactNo: branch.contactNo || '',
            email: branch.email || '',
            gstNo: branch.gstNo || '',
            status: branch.status || 'Active',
            createdAt: branch.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching branch by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve branch', 500);
    }
});

module.exports = router;
