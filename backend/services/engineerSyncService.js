const Engineer = require('../models/Engineer');
const EmployeeProfile = require('../models/EmployeeProfile');

/**
 * Checks if a designation string matches "Service Engineer" (case-insensitive)
 */
const isServiceEngineerDesignation = (designation) => {
    if (!designation) return false;
    const norm = designation.trim().toLowerCase();
    return norm === 'service engineer' || norm === 'service engineer employee' || norm.includes('service engineer');
};

/**
 * Syncs a single employee profile to Engineers Master.
 * - If employee has designation "Service Engineer", ensures an Engineer record exists with auto-populated details.
 * - If employee is inactive/hold/resigned or designation changed away from Service Engineer, marks the Engineer record as 'Inactive'.
 */
const syncEmployeeToEngineer = async (employeeOrId) => {
    try {
        let employee = employeeOrId;
        if (!employee || typeof employee === 'string' || employee instanceof require('mongoose').Types.ObjectId) {
            employee = await EmployeeProfile.findById(employeeOrId).lean();
        }

        if (!employee) return null;

        const isServiceEng = isServiceEngineerDesignation(employee.designation);
        const isActiveEmployee = employee.status === 'Active';

        // Find existing engineer document by employeeId or email & companyId
        let engineer = await Engineer.findOne({
            $or: [
                { employeeId: employee._id },
                { email: employee.email, companyId: employee.companyId }
            ]
        });

        if (isServiceEng) {
            const targetStatus = isActiveEmployee ? 'Active' : 'Inactive';
            const primaryTerritory = (Array.isArray(employee.assignedTerritories) && employee.assignedTerritories.length > 0)
                ? (employee.assignedTerritories[0]?._id || employee.assignedTerritories[0])
                : null;

            if (engineer) {
                engineer.employeeId = employee._id;
                engineer.name = employee.name;
                engineer.email = employee.email;
                engineer.mobile = employee.mobile || '';
                engineer.status = targetStatus;
                if (primaryTerritory && !engineer.territoryId) {
                    engineer.territoryId = primaryTerritory;
                }
                await engineer.save();
            } else {
                engineer = await Engineer.create({
                    employeeId: employee._id,
                    companyId: employee.companyId,
                    name: employee.name,
                    email: employee.email,
                    mobile: employee.mobile || '',
                    status: targetStatus,
                    territoryId: primaryTerritory || null,
                    pincodes: []
                });
            }
            return engineer;
        } else {
            // Designation is not Service Engineer. If engineer record exists, mark Inactive.
            if (engineer) {
                engineer.status = 'Inactive';
                await engineer.save();
            }
            return engineer;
        }
    } catch (error) {
        console.error('Error syncing employee to engineer:', error);
        return null;
    }
};

/**
 * Syncs all active Service Engineer employees for a company to Engineers Master.
 *
 * Reads the employees and the existing engineer records once each, works out the
 * differences in memory and applies them in a single bulkWrite. The previous
 * version issued one query per employee, which took ~20s on a company with
 * ~1000 employees because this runs on every Engineers Master page load.
 */
const syncAllEngineers = async (companyId, { returnEngineers = true } = {}) => {
    try {
        if (!companyId) return [];

        const [employees, engineers] = await Promise.all([
            EmployeeProfile.find({ companyId })
                .select('name email mobile designation status companyId assignedTerritories')
                .lean(),
            Engineer.find({ companyId }).lean()
        ]);

        const byEmployeeId = new Map();
        const byEmail = new Map();
        for (const eng of engineers) {
            if (eng.employeeId) byEmployeeId.set(String(eng.employeeId), eng);
            if (eng.email) byEmail.set(String(eng.email).toLowerCase(), eng);
        }

        const ops = [];
        const matchedEngineerIds = new Set();

        for (const employee of employees) {
            const existing = byEmployeeId.get(String(employee._id))
                || (employee.email ? byEmail.get(String(employee.email).toLowerCase()) : null);
            if (existing) matchedEngineerIds.add(String(existing._id));

            if (!isServiceEngineerDesignation(employee.designation)) {
                // Designation is no longer Service Engineer: retire the engineer record.
                if (existing && existing.status !== 'Inactive') {
                    ops.push({ updateOne: { filter: { _id: existing._id }, update: { $set: { status: 'Inactive' } } } });
                }
                continue;
            }

            const targetStatus = employee.status === 'Active' ? 'Active' : 'Inactive';
            const primaryTerritory = (Array.isArray(employee.assignedTerritories) && employee.assignedTerritories.length > 0)
                ? (employee.assignedTerritories[0]?._id || employee.assignedTerritories[0])
                : null;

            if (existing) {
                const update = {
                    employeeId: employee._id,
                    name: employee.name,
                    email: employee.email,
                    mobile: employee.mobile || '',
                    status: targetStatus
                };
                if (primaryTerritory && !existing.territoryId) {
                    update.territoryId = primaryTerritory;
                }
                const changed = Object.keys(update).some(key => String(existing[key] ?? '') !== String(update[key] ?? ''));
                if (changed) {
                    ops.push({ updateOne: { filter: { _id: existing._id }, update: { $set: update } } });
                }
            } else {
                ops.push({
                    insertOne: {
                        document: {
                            employeeId: employee._id,
                            companyId: employee.companyId,
                            name: employee.name,
                            email: employee.email,
                            mobile: employee.mobile || '',
                            status: targetStatus,
                            territoryId: primaryTerritory || null,
                            pincodes: [],
                            createdAt: new Date()
                        }
                    }
                });
            }
        }

        if (ops.length > 0) {
            await Engineer.bulkWrite(ops, { ordered: false });
        }

        // Callers that only need the sync to happen can skip the extra populated read.
        if (!returnEngineers) return [];

        return await Engineer.find({ companyId }).populate('employeeId').populate('territoryId', 'name rules').lean();
    } catch (error) {
        console.error('Error syncing all engineers:', error);
        return [];
    }
};

module.exports = {
    isServiceEngineerDesignation,
    syncEmployeeToEngineer,
    syncAllEngineers
};
