const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function verifyAndUpdateMobiles() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db');
        console.log('Connected to MongoDB');

        const EmployeeProfile = mongoose.model('EmployeeProfile', new mongoose.Schema({}, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

        const excelPath = 'D:\\tally\\Quotations\\Employee detail - SBU2.xlsx';
        const wb = xlsx.readFile(excelPath, { cellText: true, raw: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const excelData = xlsx.utils.sheet_to_json(sheet, { raw: false, defval: '' });

        console.log(`Loaded ${excelData.length} rows from Excel sheet.`);

        const dbEmps = await EmployeeProfile.find({});

        const empOps = [];
        const userOps = [];

        let mismatchCount = 0;
        let updatedCount = 0;

        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            const extCode = String(row['EMP Code'] || '').trim();
            const name = String(row['Employee Name'] || '').trim();
            const exactContact = String(row['Contact'] || '').trim();
            const exactEmail = String(row['Official Mail Id'] || '').trim();

            let emp = dbEmps.find(e => e.externalEmployeeCode && String(e.externalEmployeeCode).trim().toLowerCase() === extCode.toLowerCase());
            if (!emp) {
                emp = dbEmps.find(e => e.name && e.name.trim().toLowerCase() === name.toLowerCase());
            }

            if (emp) {
                const currentMobile = emp.mobile || '';
                const currentEmail = emp.email || '';

                if (currentMobile !== exactContact || currentEmail !== exactEmail) {
                    mismatchCount++;
                    console.log(`Mismatch Row ${i + 1} (${name}): Excel Mobile="${exactContact}", DB Mobile="${currentMobile}" | Excel Email="${exactEmail}", DB Email="${currentEmail}"`);
                }

                empOps.push({
                    updateOne: {
                        filter: { _id: emp._id },
                        update: {
                            $set: {
                                mobile: exactContact,
                                email: exactEmail
                            }
                        }
                    }
                });

                userOps.push({
                    updateMany: {
                        filter: {
                            $or: [
                                { employeeProfileId: emp._id },
                                { username: emp.employeeId }
                            ]
                        },
                        update: {
                            $set: {
                                mobile: exactContact,
                                email: exactEmail
                            }
                        }
                    }
                });
            } else {
                console.log(`NOT FOUND IN DB Row ${i + 1}: Name="${name}", Ext="${extCode}"`);
            }
        }

        if (empOps.length > 0) {
            const res1 = await EmployeeProfile.bulkWrite(empOps);
            console.log(`EmployeeProfile bulkWrite result: modified ${res1.modifiedCount}`);
        }

        if (userOps.length > 0) {
            const res2 = await User.bulkWrite(userOps);
            console.log(`User bulkWrite result: modified ${res2.modifiedCount}`);
        }

        console.log('Mobile & Email verification complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

verifyAndUpdateMobiles();
