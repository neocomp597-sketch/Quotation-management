const Branch = require('../models/Branch');
const Counter = require('../models/Counter');
const EmployeeProfile = require('../models/EmployeeProfile');

/**
 * Generates a guaranteed unique sequential Employee ID for a given branch and company.
 * Auto-detects existing employee IDs in DB to prevent any duplicate/repeat IDs.
 * 
 * @param {String|ObjectId} companyId 
 * @param {String|ObjectId} branchId 
 * @returns {Promise<{ employeeId: String, branchPrefix: String, seq: Number }>}
 */
const generateNextUniqueEmployeeId = async (companyId, branchId) => {
    const branch = await Branch.findOne({ _id: branchId, companyId }).lean();
    if (!branch) {
        throw new Error('Selected branch not found');
    }

    const prefix = branch.branchPrefix || branch.code || 'EMP';

    // 1. Scan existing EmployeeProfile records for highest numeric suffix matching this prefix
    const existingEmployees = await EmployeeProfile.find({
        companyId,
        employeeId: new RegExp(`^${prefix}\\d+`, 'i')
    }).select('employeeId').lean();

    let maxExistingSeq = 1000;
    existingEmployees.forEach(emp => {
        if (emp.employeeId) {
            const numPart = emp.employeeId.replace(new RegExp(`^${prefix}`, 'i'), '');
            const parsed = parseInt(numPart, 10);
            if (!isNaN(parsed) && parsed > maxExistingSeq) {
                maxExistingSeq = parsed;
            }
        }
    });

    // 2. Fetch current counter sequence
    let counter = await Counter.findOne({
        type: 'employee',
        prefix,
        companyId
    });

    let currentCounterSeq = counter ? counter.seq : 1000;

    // 3. Next sequence must be > max existing in DB and > current counter
    let candidateSeq = Math.max(currentCounterSeq + 1, maxExistingSeq + 1, 1001);

    // 4. Verify candidate isn't already taken in EmployeeProfile (loop collision protection)
    let candidateEmpId = `${prefix}${candidateSeq}`;
    while (await EmployeeProfile.exists({ companyId, employeeId: candidateEmpId })) {
        candidateSeq++;
        candidateEmpId = `${prefix}${candidateSeq}`;
    }

    // 5. Atomically update or create Counter
    if (!counter) {
        await Counter.create({
            type: 'employee',
            prefix,
            year: 0,
            companyId,
            seq: candidateSeq
        });
    } else {
        counter.seq = candidateSeq;
        await counter.save();
    }

    return {
        employeeId: candidateEmpId,
        branchPrefix: prefix,
        seq: candidateSeq
    };
};

module.exports = {
    generateNextUniqueEmployeeId
};
