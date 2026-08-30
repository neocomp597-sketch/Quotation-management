const Branch = require('../models/Branch');
const Counter = require('../models/Counter');

const Company = require('../models/Company');

const getEffectiveCompanyId = async (req) => {
    let companyId = req.query?.companyId || req.headers?.['x-company-id'] || req.body?.companyId || req.user?.companyId;
    if (!companyId) {
        const firstCompany = await Company.findOne().lean();
        if (firstCompany) {
            companyId = firstCompany._id.toString();
        }
    }
    return companyId?.toString ? companyId.toString() : companyId;
};

exports.getAllBranches = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const query = companyId ? { companyId } : {};
        const branches = await Branch.find(query)
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
        const companyId = await getEffectiveCompanyId(req);
        const query = { _id: req.params.id };
        if (companyId) query.companyId = companyId;
        const branch = await Branch.findOne(query).lean();
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
        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }

        const { name, code, branchPrefix, address, country, city, state, stateShortCode, countryDialCode, pincode, contactNo, email, gstNo, logoUrl, managerName, status, startEmployeeSeq } = req.body;

        if (!name || !code || !branchPrefix) {
            return res.status(400).json({ message: 'Branch Name, Branch Code, and Branch Prefix are required' });
        }

        const cleanCode = String(code).trim().toUpperCase();
        const cleanPrefix = String(branchPrefix).trim().toUpperCase();
        const parsedStartSeq = parseInt(startEmployeeSeq, 10) || 1001;

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
            country: country || 'India',
            city: city || '',
            state: state || '',
            stateShortCode: stateShortCode || '',
            countryDialCode: countryDialCode || '+91',
            pincode: pincode || '',
            contactNo: contactNo || '',
            email: email || '',
            gstNo: gstNo || '',
            logoUrl: logoUrl || '',
            managerName: managerName || '',
            startEmployeeSeq: parsedStartSeq,
            status: status || 'Active',
            companyId
        });

        // Initialize Counter for employee sequence for this branch prefix
        const counterQuery = { type: 'employee', prefix: cleanPrefix, year: 0 };
        if (companyId) counterQuery.companyId = companyId;

        await Counter.findOneAndUpdate(
            counterQuery,
            { 
                $set: {
                    seq: parsedStartSeq - 1
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(201).json(branch);
    } catch (error) {
        console.error('[createBranch] Error:', error);
        res.status(500).json({ message: error.message || 'Failed to create branch', error: error.message });
    }
};

exports.updateBranch = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const { id } = req.params;
        const { name, code, branchPrefix, address, country, city, state, stateShortCode, countryDialCode, pincode, contactNo, email, gstNo, logoUrl, managerName, status, startEmployeeSeq } = req.body;

        const query = { _id: id };
        if (companyId) query.companyId = companyId;

        const branch = await Branch.findOne(query);
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        if (code && code.trim().toUpperCase() !== branch.code) {
            const cleanCode = code.trim().toUpperCase();
            const q = { code: cleanCode, _id: { $ne: id } };
            if (companyId) q.companyId = companyId;
            const existing = await Branch.findOne(q).lean();
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
            const q = { branchPrefix: cleanPrefix, _id: { $ne: id } };
            if (companyId) q.companyId = companyId;
            const existing = await Branch.findOne(q).lean();
            if (existing) {
                return res.status(400).json({ message: 'Branch Prefix already exists' });
            }
            branch.branchPrefix = cleanPrefix;
        }

        if (name) branch.name = name.trim();
        if (address !== undefined) branch.address = address;
        if (country !== undefined) branch.country = country || 'India';
        if (city !== undefined) branch.city = city;
        if (state !== undefined) branch.state = state;
        if (stateShortCode !== undefined) branch.stateShortCode = stateShortCode;
        if (countryDialCode !== undefined) branch.countryDialCode = countryDialCode || '+91';
        if (pincode !== undefined) branch.pincode = pincode;
        if (contactNo !== undefined) branch.contactNo = contactNo;
        if (email !== undefined) branch.email = email;
        if (gstNo !== undefined) branch.gstNo = gstNo;
        if (logoUrl !== undefined) branch.logoUrl = logoUrl;
        if (managerName !== undefined) branch.managerName = managerName;
        if (status) branch.status = status;

        if (startEmployeeSeq !== undefined && startEmployeeSeq !== null) {
            const parsedSeq = parseInt(startEmployeeSeq, 10);
            if (!isNaN(parsedSeq) && parsedSeq > 0) {
                branch.startEmployeeSeq = parsedSeq;
                // Reset Counter for this branch prefix to parsedSeq - 1 so the next code auto-starts from parsedSeq
                const Counter = require('../models/Counter');
                const counterQuery = { type: 'employee', prefix: branch.branchPrefix, year: 0 };
                if (companyId) counterQuery.companyId = companyId;

                await Counter.findOneAndUpdate(
                    counterQuery,
                    { 
                        $set: {
                            seq: parsedSeq - 1 
                        }
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }
        }

        const updatedBranch = await branch.save();
        res.json(updatedBranch);
    } catch (error) {
        console.error('[updateBranch] Error:', error);
        res.status(500).json({ message: error.message || 'Failed to update branch', error: error.message });
    }
};

exports.deleteBranch = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const { id } = req.params;

        const query = { _id: id };
        if (companyId) query.companyId = companyId;

        const branch = await Branch.findOne(query);
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        await Branch.deleteOne(query);
        res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
        console.error('[deleteBranch] Error:', error);
        res.status(500).json({ message: 'Failed to delete branch', error: error.message });
    }
};

exports.getNextEmployeeId = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
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
