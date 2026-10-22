const Engineer = require('../models/Engineer');
const EmployeeProfile = require('../models/EmployeeProfile');
const CompanySettings = require('../models/CompanySettings');

// Who appears in Engineers Master, and so in every ticket / visit assignment list:
//   all_employees     - every Active employee (default)
//   service_engineers - only employees whose designation is "Service Engineer"
const ENGINEER_SOURCES = ['all_employees', 'service_engineers'];
const DEFAULT_ENGINEER_SOURCE = 'all_employees';

const getEngineerSource = async (companyId) => {
    if (!companyId) return DEFAULT_ENGINEER_SOURCE;
    const settings = await CompanySettings.findOne({ companyId }).select('csmEngineerSource').lean();
    return ENGINEER_SOURCES.includes(settings?.csmEngineerSource) ? settings.csmEngineerSource : DEFAULT_ENGINEER_SOURCE;
};

/**
 * Checks if a designation string matches "Service Engineer" (case-insensitive)
 */
const isServiceEngineerDesignation = (designation) => {
    if (!designation) return false;
    const norm = designation.trim().toLowerCase();
    return norm === 'service engineer' || norm === 'service engineer employee' || norm.includes('service engineer');
};

// Service Engineers always keep an engineer record (Inactive while they are not Active);
// with the all-employees source every Active employee gets one as well.
const isEligibleEngineer = (employee, source) => isServiceEngineerDesignation(employee.designation)
    || (source === 'all_employees' && employee.status === 'Active');

// Only Service Engineers take their territory from Employee Master. Other employees may hold
// sales territories, and ticket auto-assignment picks engineers by territory.
const primaryTerritoryOf = (employee) => {
    if (!isServiceEngineerDesignation(employee.designation)) return null;
    return (Array.isArray(employee.assignedTerritories) && employee.assignedTerritories.length > 0)
        ? (employee.assignedTerritories[0]?._id || employee.assignedTerritories[0])
        : null;
};

/**
 * Syncs a single employee profile to Engineers Master.
 * - If the employee is eligible (see isEligibleEngineer), ensures an Engineer record exists with auto-populated details.
 * - Otherwise (inactive, or designation changed away from Service Engineer), marks the Engineer record as 'Inactive'.
 */
const syncEmployeeToEngineer = async (employeeOrId) => {
    try {
        let employee = employeeOrId;
        if (!employee || typeof employee === 'string' || employee instanceof require('mongoose').Types.ObjectId) {
            employee = await EmployeeProfile.findById(employeeOrId).setOptions({ bypassBranch: true }).lean();
        }

        if (!employee) return null;

        const source = await getEngineerSource(employee.companyId);
        const isActiveEmployee = employee.status === 'Active';

        // Find the employee's own engineer record, else an unlinked one with the same email.
        let engineer = await Engineer.findOne({ employeeId: employee._id });
        if (!engineer && employee.email) {
            const byEmail = await Engineer.findOne({ email: employee.email, companyId: employee.companyId });
            const ownedByOther = byEmail?.employeeId && String(byEmail.employeeId) !== String(employee._id)
                && await EmployeeProfile.exists({ _id: byEmail.employeeId }).setOptions({ bypassBranch: true });
            if (byEmail && !ownedByOther) engineer = byEmail;
        }

        if (isEligibleEngineer(employee, source)) {
            const targetStatus = isActiveEmployee ? 'Active' : 'Inactive';
            const primaryTerritory = primaryTerritoryOf(employee);

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
            // No longer eligible. If engineer record exists, mark Inactive.
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
 * Syncs every eligible employee of a company (all branches) to Engineers Master.
 *
 * Reads the employees and the existing engineer records once each, works out the
 * differences in memory and applies them in a single bulkWrite. The previous
 * version issued one query per employee, which took ~20s on a company with
 * ~1000 employees because this runs on every Engineers Master page load.
 */
const syncAllEngineers = async (companyId, { returnEngineers = true } = {}) => {
    try {
        if (!companyId) return [];

        // Engineers Master is company-wide, so it is built from the employees of every branch.
        const [employees, engineers, source] = await Promise.all([
            EmployeeProfile.find({ companyId })
                .select('name email mobile designation status companyId assignedTerritories')
                .setOptions({ bypassBranch: true })
                .lean(),
            Engineer.find({ companyId }).lean(),
            getEngineerSource(companyId)
        ]);

        const byEmployeeId = new Map();
        const byEmail = new Map();
        for (const eng of engineers) {
            if (eng.employeeId) byEmployeeId.set(String(eng.employeeId), eng);
            if (eng.email) byEmail.set(String(eng.email).toLowerCase(), eng);
        }
        const employeeIds = new Set(employees.map(e => String(e._id)));
        const claimed = new Set();

        // An engineer record found only by email is reused when no other employee owns it,
        // so two employees sharing an address don't take turns rewriting one record.
        const findExisting = (employee) => {
            const own = byEmployeeId.get(String(employee._id));
            if (own) return own;
            const match = employee.email ? byEmail.get(String(employee.email).toLowerCase()) : null;
            if (!match || claimed.has(String(match._id))) return null;
            if (match.employeeId && employeeIds.has(String(match.employeeId))) return null;
            return match;
        };

        const ops = [];

        for (const employee of employees) {
            const existing = findExisting(employee);
            if (existing) claimed.add(String(existing._id));

            if (!isEligibleEngineer(employee, source)) {
                // Not eligible any more: retire the engineer record.
                if (existing && existing.status !== 'Inactive') {
                    ops.push({ updateOne: { filter: { _id: existing._id }, update: { $set: { status: 'Inactive' } } } });
                }
                continue;
            }

            const targetStatus = employee.status === 'Active' ? 'Active' : 'Inactive';
            const primaryTerritory = primaryTerritoryOf(employee);

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
    ENGINEER_SOURCES,
    getEngineerSource,
    isServiceEngineerDesignation,
    syncEmployeeToEngineer,
    syncAllEngineers
};
