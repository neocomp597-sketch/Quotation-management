const Branch = require('../models/Branch');
const Counter = require('../models/Counter');

exports.getAllBranches = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }
        const branches = await Branch.find({ companyId })
            .sort({ name: 1 })
            .lean();
        res.json(branches);
    } catch (error) {
        console.error('[getAllBranches] Error:', error);
        res.status(500).json({ message: 'Failed to load branches', error: error.message });
    }
};

exports.getBranchById = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const branch = await Branch.findOne({ _id: req.params.id, companyId }).lean();
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }
        res.json(branch);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch branch', error: error.message });
    }
};

exports.createBranch = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }

        const { name, code, branchPrefix, address, city, state, pincode, contactNo, email, gstNo, logoUrl, managerName, status } = req.body;

        if (!name || !code || !branchPrefix) {
            return res.status(400).json({ message: 'Branch Name, Branch Code, and Branch Prefix are required' });
        }

        const cleanCode = String(code).trim().toUpperCase();
        const cleanPrefix = String(branchPrefix).trim().toUpperCase();

        if (cleanPrefix.length < 2 || cleanPrefix.length > 5) {
            return res.status(400).json({ message: 'Branch Prefix should be 2 to 5 characters (e.g., NSK, PN, MUM)' });
        }

        const existingCode = await Branch.findOne({ companyId, code: cleanCode }).lean();
        if (existingCode) {
            return res.status(400).json({ message: 'Branch Code already exists' });
        }

        const existingPrefix = await Branch.findOne({ companyId, branchPrefix: cleanPrefix }).lean();
        if (existingPrefix) {
            return res.status(400).json({ message: 'Branch Prefix already exists' });
        }

        const branch = await Branch.create({
            name: String(name).trim(),
            code: cleanCode,
            branchPrefix: cleanPrefix,
            address: address || '',
            city: city || '',
            state: state || '',
            pincode: pincode || '',
            contactNo: contactNo || '',
            email: email || '',
            gstNo: gstNo || '',
            logoUrl: logoUrl || '',
            managerName: managerName || '',
            status: status || 'Active',
            companyId
        });

        res.status(201).json(branch);
    } catch (error) {
        console.error('[createBranch] Error:', error);
        res.status(500).json({ message: 'Failed to create branch', error: error.message });
    }
};

exports.updateBranch = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { name, code, branchPrefix, address, city, state, pincode, contactNo, email, gstNo, logoUrl, managerName, status } = req.body;

        const branch = await Branch.findOne({ _id: id, companyId });
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        if (code && code.trim().toUpperCase() !== branch.code) {
            const cleanCode = code.trim().toUpperCase();
            const existing = await Branch.findOne({ companyId, code: cleanCode, _id: { $ne: id } }).lean();
            if (existing) {
                return res.status(400).json({ message: 'Branch Code already exists' });
            }
            branch.code = cleanCode;
        }

        if (branchPrefix && branchPrefix.trim().toUpperCase() !== branch.branchPrefix) {
            const cleanPrefix = branchPrefix.trim().toUpperCase();
            if (cleanPrefix.length < 2 || cleanPrefix.length > 5) {
                return res.status(400).json({ message: 'Branch Prefix should be 2 to 5 characters' });
            }
            const existing = await Branch.findOne({ companyId, branchPrefix: cleanPrefix, _id: { $ne: id } }).lean();
            if (existing) {
                return res.status(400).json({ message: 'Branch Prefix already exists' });
            }
            branch.branchPrefix = cleanPrefix;
        }

        if (name) branch.name = name.trim();
        if (address !== undefined) branch.address = address;
        if (city !== undefined) branch.city = city;
        if (state !== undefined) branch.state = state;
        if (pincode !== undefined) branch.pincode = pincode;
        if (contactNo !== undefined) branch.contactNo = contactNo;
        if (email !== undefined) branch.email = email;
        if (gstNo !== undefined) branch.gstNo = gstNo;
        if (logoUrl !== undefined) branch.logoUrl = logoUrl;
        if (managerName !== undefined) branch.managerName = managerName;
        if (status) branch.status = status;

        const updatedBranch = await branch.save();
        res.json(updatedBranch);
    } catch (error) {
        console.error('[updateBranch] Error:', error);
        res.status(500).json({ message: 'Failed to update branch', error: error.message });
    }
};

exports.deleteBranch = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const branch = await Branch.findOne({ _id: id, companyId });
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        await Branch.deleteOne({ _id: id, companyId });
        res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
        console.error('[deleteBranch] Error:', error);
        res.status(500).json({ message: 'Failed to delete branch', error: error.message });
    }
};

exports.getNextEmployeeId = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { id: branchId } = req.params;

        const { generateNextUniqueEmployeeId } = require('../utils/employeeIdHelper');
        const { employeeId, branchPrefix, seq } = await generateNextUniqueEmployeeId(companyId, branchId);

        res.json({
            branchId,
            branchPrefix,
            nextSeq: seq,
            employeeId
        });
    } catch (error) {
        console.error('[getNextEmployeeId] Error:', error);
        res.status(500).json({ message: 'Failed to generate Employee ID', error: error.message });
    }
};
