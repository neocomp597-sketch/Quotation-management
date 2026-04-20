const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Customer = require('../models/Customer');
const User = require('../models/User');

const DEFAULT_EMAIL = 'Admin@gmail.com';
const DEFAULT_PASSWORD = '123456';
const DEFAULT_NAME = 'System Admin';

const cleanValue = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const cleanEmail = (value = '') => cleanValue(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const pickFirst = (...values) => values.map(cleanValue).find(Boolean) || '';
const buildAddressLine = (street, streetNo, building, room) => (
    [cleanValue(street), cleanValue(streetNo), cleanValue(building), cleanValue(room)]
        .filter(Boolean)
        .join(', ')
);

const ensureAdminUser = async (email, password) => {
    const normalizedEmail = cleanValue(email) || DEFAULT_EMAIL;
    const passwordHash = await bcrypt.hash(password || DEFAULT_PASSWORD, 10);

    let user = await User.findOne({
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (user) {
        user.name = user.name || DEFAULT_NAME;
        user.email = normalizedEmail;
        user.passwordHash = passwordHash;
        user.role = 'admin';
        user.status = true;
        await user.save();
        return { user, created: false };
    }

    user = await User.create({
        name: DEFAULT_NAME,
        email: normalizedEmail,
        passwordHash,
        role: 'admin',
        status: true
    });

    return { user, created: true };
};

const mapCustomerRow = (row, adminUserId) => {
    const externalCode = cleanValue(row['BP Code']);
    const companyName = pickFirst(row['BP Name'], row['Company Name'], externalCode);
    const customerName = pickFirst(row['Contact Person'], row['BP Name'], externalCode);
    const gstin = pickFirst(row['Federal Tax ID'], row['Unified Federal Tax ID'], row['VAT Reg. Number'], row['Registration No.']);
    const mobile = pickFirst(row['Mobile Phone'], row['Telephone 1'], row['Telephone 2']);
    const email = pickFirst(row['E-Mail'], row.EmailCC);

    const billingAddress = {
        line1: buildAddressLine(
            row['Bill-to Street'],
            row['Bill-to Street No.'],
            row['Street Number'],
            row['Bill-to Building/Floor/Room']
        ),
        line2: pickFirst(row['Bill-to County'], row['Bill-to Country']),
        city: pickFirst(row['Bill-to City'], row['City/Town/Village']),
        state: pickFirst(row['Bill-to State'], row['BP State']),
        pincode: pickFirst(row['Bill-to Zip Code'], row['Zip Code'])
    };

    const shippingAddress = {
        line1: buildAddressLine(
            row['Ship-to Street'],
            row['Ship-to Street No.'],
            row['Street Number'],
            row['Ship to Building/Floor/Room']
        ),
        line2: pickFirst(row['Ship-to County'], row['Ship-to Country']),
        city: pickFirst(row['Ship-to City'], row['City/Town/Village']),
        state: pickFirst(row['Ship-to State'], row['BP State']),
        pincode: pickFirst(row['Ship-to Zip Code'], row['Zip Code'])
    };

    return {
        externalCode,
        customerName,
        companyName,
        gstin,
        billingAddress,
        shippingAddress,
        mobile,
        email,
        logoUrl: cleanValue(row.Picture),
        defaultDiscount: toNumber(row['Discount %'], 0),
        createdBy: adminUserId
    };
};

const findExistingCustomer = async (customerData) => {
    if (customerData.externalCode) {
        const existingByCode = await Customer.findOne({ externalCode: customerData.externalCode });
        if (existingByCode) {
            return existingByCode;
        }
    }

    if (customerData.gstin) {
        const existingByGstin = await Customer.findOne({ gstin: customerData.gstin });
        if (existingByGstin) {
            return existingByGstin;
        }
    }

    return Customer.findOne({
        companyName: customerData.companyName,
        customerName: customerData.customerName
    });
};

const importCustomerMaster = async (filePath, adminEmail, adminPassword) => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is missing in backend/.env');
    }

    const resolvedPath = path.resolve(filePath);
    const workbook = XLSX.readFile(resolvedPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (!rows.length) {
        throw new Error('No data rows found in the Excel file');
    }

    await mongoose.connect(process.env.MONGO_URI);

    try {
        const { user: adminUser, created: adminCreated } = await ensureAdminUser(adminEmail, adminPassword);
        const results = {
            adminCreated,
            totalRows: rows.length,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];

            try {
                const customerData = mapCustomerRow(row, adminUser._id);

                if (!customerData.externalCode || !customerData.companyName || !customerData.customerName) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 2}: Missing BP Code, BP Name, or Contact/BP name`);
                    continue;
                }

                const existing = await findExistingCustomer(customerData);

                if (existing) {
                    await Customer.findByIdAndUpdate(existing._id, customerData, { runValidators: true });
                    results.updated++;
                } else {
                    await Customer.create(customerData);
                    results.created++;
                }
            } catch (error) {
                results.errors.push(`Row ${index + 2}: ${error.message}`);
            }
        }

        return {
            admin: {
                email: adminUser.email,
                id: adminUser._id.toString(),
                created: adminCreated
            },
            ...results
        };
    } finally {
        await mongoose.disconnect();
    }
};

if (require.main === module) {
    const [, , inputFilePath, adminEmail = DEFAULT_EMAIL, adminPassword = DEFAULT_PASSWORD] = process.argv;

    if (!inputFilePath) {
        console.error('Usage: node scripts/import_customer_master_excel.js "<excel-path>" [admin-email] [admin-password]');
        process.exit(1);
    }

    importCustomerMaster(inputFilePath, adminEmail, adminPassword)
        .then((result) => {
            console.log(JSON.stringify(result, null, 2));
        })
        .catch((error) => {
            console.error(error.message || error);
            process.exit(1);
        });
}

module.exports = {
    importCustomerMaster
};
