require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Engineer = require('../models/Engineer');
const CompanySettings = require('../models/CompanySettings');

async function fixMobileAndEmail() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        console.log('[SBU2 Fix] Connected to DB');

        // Find super@gmail.com company context
        const superUser = await User.findOne({ email: 'super@gmail.com' });
        let companyId = superUser?.companyId;
        if (!companyId) {
            const company = await CompanySettings.findOne({});
            companyId = company?._id;
        }

        const excelPath = path.join(__dirname, '../../Employee detail - SBU2.xlsx');
        const workbook = xlsx.readFile(excelPath);
        console.log('[SBU2 Fix] Workbook Sheets:', workbook.SheetNames);

        let allRows = [];
        workbook.SheetNames.forEach(sName => {
            const sheet = workbook.Sheets[sName];
            const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
            console.log(`[SBU2 Fix] Sheet "${sName}" row count:`, rows.length);
            if (rows.length > 0) {
                console.log(`[SBU2 Fix] Sheet "${sName}" columns:`, Object.keys(rows[0]));
            }
            allRows = allRows.concat(rows);
        });

        console.log('[SBU2 Fix] Total Excel rows combined:', allRows.length);

        let updatedEmployeesCount = 0;
        let updatedUsersCount = 0;
        let updatedEngineersCount = 0;

        for (const row of allRows) {
            // Find name
            const rawName = row['Employee Name'] || row['NAME OF EMPLOYEE'] || row['Name'] || row['NAME'] || row['Employee'] || row['EmployeeName'] || '';
            const name = String(rawName).trim();
            if (!name) continue;

            // Find mobile / phone
            const rawMobile = row['Mobile'] || row['MOBILE'] || row['Mobile Number'] || row['MOBILE NO'] || row['Mobile No.'] || row['Phone'] || row['PHONE'] || row['Phone Number'] || row['Contact'] || row['CONTACT NO'] || row['Contact No.'] || row['Cell'] || row['CONTACT'] || '';
            let mobile = String(rawMobile).replace(/[^\d+]/g, '').trim();

            // Find email
            const rawEmail = row['Email'] || row['EMAIL'] || row['Email ID'] || row['EMAIL ID'] || row['Email Id'] || row['Official Email'] || row['Personal Email'] || '';
            let email = String(rawEmail).trim().toLowerCase();

            // If email is missing, generate normalized fallback email from name
            if (!email && name) {
                const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                email = `${cleanName}@arcrm.co.in`;
            }

            // Find matching EmployeeProfile by name
            const empProfile = await EmployeeProfile.findOne({
                companyId,
                name: { $regex: new RegExp("^" + name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") }
            });

            if (empProfile) {
                let modified = false;
                if (mobile && empProfile.mobile !== mobile) {
                    empProfile.mobile = mobile;
                    empProfile.phone = mobile;
                    empProfile.contactNumber = mobile;
                    modified = true;
                }
                if (email && empProfile.email !== email) {
                    empProfile.email = email;
                    modified = true;
                }
                if (modified) {
                    await empProfile.save();
                    updatedEmployeesCount++;
                }

                // Sync User account for this employee if exists
                const userAcc = await User.findOne({
                    companyId,
                    $or: [
                        { name: { $regex: new RegExp("^" + name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } },
                        { employeeId: empProfile._id }
                    ]
                });

                if (userAcc) {
                    let userMod = false;
                    if (mobile && (userAcc.mobile !== mobile || userAcc.phone !== mobile)) {
                        userAcc.mobile = mobile;
                        userAcc.phone = mobile;
                        userMod = true;
                    }
                    if (email && userAcc.email !== email) {
                        userAcc.email = email;
                        userMod = true;
                    }
                    if (userMod) {
                        await userAcc.save();
                        updatedUsersCount++;
                    }
                }

                // Sync Engineer profile if exists
                const engRecord = await Engineer.findOne({
                    companyId,
                    $or: [
                        { name: { $regex: new RegExp("^" + name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } },
                        { employeeId: empProfile._id }
                    ]
                });

                if (engRecord) {
                    let engMod = false;
                    if (mobile && engRecord.mobile !== mobile) {
                        engRecord.mobile = mobile;
                        engRecord.phone = mobile;
                        engMod = true;
                    }
                    if (email && engRecord.email !== email) {
                        engRecord.email = email;
                        engMod = true;
                    }
                    if (engMod) {
                        await engRecord.save();
                        updatedEngineersCount++;
                    }
                }
            }
        }

        console.log(`[SBU2 Fix] Successfully synced SBU2 data: ${updatedEmployeesCount} EmployeeProfiles, ${updatedUsersCount} Users, ${updatedEngineersCount} Engineers updated.`);
        return { updatedEmployeesCount, updatedUsersCount, updatedEngineersCount };
    } catch (err) {
        console.error('[SBU2 Fix] Error in sync script:', err);
    }
}

module.exports = fixMobileAndEmail;

if (require.main === module) {
    fixMobileAndEmail().then(() => process.exit(0));
}
