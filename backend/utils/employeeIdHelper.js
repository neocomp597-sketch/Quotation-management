const Branch = require('../models/Branch');
const Counter = require('../models/Counter');
const EmployeeProfile = require('../models/EmployeeProfile');

/**
 * Generates a guaranteed unique sequential Employee ID for a given branch and company.
 * Supports configurable starting sequence (e.g., 5001, 6001, 1001).
 * 
 * @param {String|ObjectId} companyId 
 * @param {String|ObjectId} branchId 
 * @returns {Promise<{ employeeId: String, branchPrefix: String, seq: Number }>}
 */
const generateNextUniqueEmployeeId = async (companyId, branchId) => {
    const branchQuery = { _id: branchId };
    if (companyId) branchQuery.companyId = companyId;

    const branch = await Branch.findOne(branchQuery).lean();
    if (!branch) {
        throw new Error('Selected branch not found');
    }

    const prefix = branch.branchPrefix || branch.code || 'EMP';
    const startSeq = Number(branch.startEmployeeSeq) || 1001;

    // 1. Scan existing EmployeeProfile records for highest numeric suffix >= startSeq matching this prefix
    const empQuery = {
        employeeId: new RegExp(`^${prefix}\\d+`, 'i')
    };
    if (companyId) empQuery.companyId = companyId;

    const existingEmployees = await EmployeeProfile.find(empQuery).select('employeeId').lean();

    let maxExistingSeq = startSeq - 1;
    existingEmployees.forEach(emp => {
        if (emp.employeeId) {
            const numPart = emp.employeeId.replace(new RegExp(`^${prefix}`, 'i'), '');
            const parsed = parseInt(numPart, 10);
            // Only consider existing IDs that are >= startSeq
            if (!isNaN(parsed) && parsed >= startSeq && parsed > maxExistingSeq) {
                maxExistingSeq = parsed;
            }
        }
    });

    // 2. Fetch current counter sequence
    const counterQuery = {
        type: 'employee',
        prefix
    };
    if (companyId) counterQuery.companyId = companyId;

    let counter = await Counter.findOne(counterQuery);

    let currentCounterSeq = counter ? counter.seq : (startSeq - 1);
    if (currentCounterSeq < startSeq - 1) {
        currentCounterSeq = startSeq - 1;
    }

    // 3. Candidate sequence must be >= startSeq, > currentCounterSeq, and > maxExistingSeq
    let candidateSeq = Math.max(currentCounterSeq + 1, maxExistingSeq + 1, startSeq);

    // 4. Verify candidate isn't already taken in EmployeeProfile (loop collision protection)
    const checkExists = async (seq) => {
        const q = { employeeId: `${prefix}${seq}` };
        if (companyId) q.companyId = companyId;
        return await EmployeeProfile.exists(q);
    };

    while (await checkExists(candidateSeq)) {
        candidateSeq++;
    }

    // 5. Update or create Counter
    if (!counter) {
        await Counter.create({
            type: 'employee',
            prefix,
            year: 0,
            ...(companyId && { companyId }),
            seq: candidateSeq
        });
    } else {
        counter.seq = candidateSeq;
        await counter.save();
    }

    return {
        employeeId: `${prefix}${candidateSeq}`,
        branchPrefix: prefix,
        seq: candidateSeq
    };
};

module.exports = {
    generateNextUniqueEmployeeId
};
