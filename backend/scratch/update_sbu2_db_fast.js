const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function updateSbu2Employees() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db');
        console.log('Connected to MongoDB');

        const EmployeeProfile = mongoose.model('EmployeeProfile', new mongoose.Schema({}, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Branch = mongoose.model('Branch', new mongoose.Schema({}, { strict: false }));

        // Find USGOAN branch
        const usgaonBranch = await Branch.findOne({ 
            $or: [
                { name: { $regex: 'usgoan', $options: 'i' } },
                { name: { $regex: 'usgaon', $options: 'i' } }
            ]
        });

        if (!usgaonBranch) {
            console.error('USGOAN branch not found in DB!');
            process.exit(1);
        }

        console.log('Found USGOAN Branch ID:', usgaonBranch._id.toString());

        const excelPath = 'D:\\tally\\Quotations\\Employee detail - SBU2.xlsx';
        const wb = xlsx.readFile(excelPath);
        const excelData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        console.log('Excel Total Rows:', excelData.length);

        const dbEmps = await EmployeeProfile.find({});
        console.log('Total DB Employee Profiles:', dbEmps.length);

        const empOps = [];
        const userOps = [];

        for (const row of excelData) {
            const extCode = String(row['EMP Code'] || '').trim();
            const name = String(row['Employee Name'] || '').trim();
            const contact = String(row['Contact'] || '').trim();
            const email = String(row['Official Mail Id'] || '').trim();
            const dept = String(row['Department'] || '').trim();
            const desig = String(row['Designation'] || '').trim();

            let emp = dbEmps.find(e => e.externalEmployeeCode && String(e.externalEmployeeCode).trim().toLowerCase() === extCode.toLowerCase());
            if (!emp) {
                emp = dbEmps.find(e => e.name && e.name.trim().toLowerCase() === name.toLowerCase());
            }

            if (emp) {
                const updateFields = {
                    branchId: usgaonBranch._id,
                    assignedBranches: [usgaonBranch._id]
                };

                if (email) updateFields.email = email;
                if (contact) updateFields.mobile = contact;
                if (extCode) updateFields.externalEmployeeCode = extCode;
                if (dept) updateFields.department = dept;
                if (desig) updateFields.designation = desig;

                empOps.push({
                    updateOne: {
                        filter: { _id: emp._id },
                        update: { $set: updateFields }
                    }
                });

                if (email) {
                    userOps.push({
                        updateMany: {
                            filter: { 
                                $or: [
                                    { employeeProfileId: emp._id },
                                    { email: { $regex: `^${email}$`, $options: 'i' } },
                                    { username: emp.employeeId }
                                ]
                            },
                            update: { 
                                $set: { 
                                    email: email,
                                    mobile: contact,
                                    branchId: usgaonBranch._id,
                                    assignedBranches: [usgaonBranch._id]
                                }
                            }
                        }
                    });
                }
            }
        }

        if (empOps.length > 0) {
            const empRes = await EmployeeProfile.bulkWrite(empOps);
            console.log(`Bulk updated Employee Profiles: modified ${empRes.modifiedCount} documents.`);
        }

        if (userOps.length > 0) {
            const userRes = await User.bulkWrite(userOps);
            console.log(`Bulk updated Users: modified ${userRes.modifiedCount} documents.`);
        }

        console.log('UPDATE DONE SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('Error during execution:', err);
        process.exit(1);
    }
}

updateSbu2Employees();
