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
 */
const syncAllEngineers = async (companyId) => {
    try {
        if (!companyId) return [];

        const employees = await EmployeeProfile.find({ companyId }).lean();
        
        for (const emp of employees) {
            await syncEmployeeToEngineer(emp);
        }

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
