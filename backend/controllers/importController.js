const XLSX = require('xlsx');
const RolePermission = require('../models/RolePermission');
const { resolvePermissions } = require('../config/authorization');

const normalizeFinancialYear = (fy) => {
    if (!fy) return fy;
    let clean = String(fy).trim().replace(/[\s\-\/]+/g, '-');
    const match = clean.match(/^(\d{2,4})-(\d{2,4})$/);
    if (match) {
        let start = match[1];
        let end = match[2];
        if (start.length === 2) {
            start = '20' + start;
        }
        if (end.length === 4) {
            end = end.slice(-2);
        }
        return `${start}-${end}`;
    }
    return fy;
};

const isPreviousYear = (financialYear) => {
    if (!financialYear) return false;
    const normalizedFY = normalizeFinancialYear(financialYear);
    const startYear = parseInt(normalizedFY.split('-')[0], 10);
    if (isNaN(startYear)) return false;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentFYStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    
    return startYear < currentFYStartYear;
};

const getRolePermissions = async (role) => {
    const { DEFAULT_ROLE_PERMISSIONS } = require('../config/authorization');
    if (role === 'admin') {
        return { ...DEFAULT_ROLE_PERMISSIONS.admin };
    }
    const document = await RolePermission.findOne({ role }).select('menuVisibility').lean();
    return resolvePermissions(role, document?.menuVisibility || {});
};

const checkPrevYearEditPermission = async (user, financialYear) => {
    if (!financialYear) return true;
    if (!user) return true;
    if (user.role === 'admin') return true;
    
    if (isPreviousYear(financialYear)) {
        const permissions = await getRolePermissions(user.role);
        if (!permissions.planning_edit_prev_year) {
            return false;
        }
    }
    return true;
};
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const ProductAttribute = require('../models/ProductAttribute');
const Attribute = require('../models/Attribute');
const MGR = require('../models/MGR');
const Vendor = require('../models/Vendor');
const Planning = require('../models/Planning');
const PriceBook = require('../models/PriceBook');
const PriceBookItem = require('../models/PriceBookItem');
const EmployeeProfile = require('../models/EmployeeProfile');
const Contact = require('../models/Contact');
const Contract = require('../models/Contract');
const { deriveBasePriceFromVendors } = require('../utils/vendorSelection');
const { invalidateCustomerCaches, invalidateProductCaches } = require('../utils/cacheInvalidation');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase().trim());
    return false;
};

const cleanCellValue = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeKey = (value = '') => cleanCellValue(value).toUpperCase();
const buildExactRegex = (value = '') => new RegExp(`^${escapeRegex(cleanCellValue(value))}$`, 'i');

const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const PLANNING_STATUS_OPTIONS = ['Budget', 'Firm', 'MFC', 'B & B', 'Others', 'Order Received', 'Invoice', 'Lost', 'Parked'];
const pickFirstNonEmpty = (...values) => {
    for (const value of values) {
        const cleaned = cleanCellValue(value);
        if (cleaned) {
            return cleaned;
        }
    }

    return '';
};
const toSafeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const buildNormalizedLookupMap = (docs, fields, requestedValues) => {
    const requestedSet = new Set(requestedValues.map(normalizeKey));
    const map = new Map();

    docs.forEach((doc) => {
        fields.forEach((field) => {
            const rawValue = doc[field];
            const key = normalizeKey(rawValue);
            if (key && requestedSet.has(key) && !map.has(key)) {
                map.set(key, doc);
            }
        });
    });

    return map;
};

const loadPlanningCustomers = async (lookupValues) => {
    if (!lookupValues.length) {
        return new Map();
    }

    const docs = await Customer.find({
        $or: [
            { externalCode: { $in: lookupValues } },
            { customerName: { $in: lookupValues } },
            { companyName: { $in: lookupValues } }
        ]
    })
        .select('externalCode customerName companyName')
        .collation({ locale: 'en', strength: 2 })
        .lean();

    return buildNormalizedLookupMap(docs, ['externalCode', 'customerName', 'companyName'], lookupValues);
};

const loadPlanningProducts = async (lookupValues) => {
    if (!lookupValues.length) {
        return new Map();
    }

    const docs = await Product.find({
        $or: [
            { productCode: { $in: lookupValues } },
            { productName: { $in: lookupValues } }
        ]
    })
        .select('productCode productName')
        .collation({ locale: 'en', strength: 2 })
        .lean();

    return buildNormalizedLookupMap(docs, ['productCode', 'productName'], lookupValues);
};

const loadPlanningMgrs = async (lookupValues, mgrType) => {
    if (!lookupValues.length) {
        return new Map();
    }

    const docs = await MGR.find({
        mgrType,
        code: { $in: lookupValues }
    })
        .select('code mgrType')
        .collation({ locale: 'en', strength: 2 })
        .lean();

    return buildNormalizedLookupMap(docs, ['code'], lookupValues);
};

const getPlanningMonthLabels = (financialYear) => {
    const normalizedFY = normalizeFinancialYear(financialYear);
    if (!/^\d{4}-\d{2}$/.test(normalizedFY)) {
        throw new Error('Financial Year must be in the format 2025-26');
    }

    const startYear = parseInt(normalizedFY.split('-')[0], 10);
    return FY_MONTHS.map((month, idx) => {
        const year = idx < 9 ? startYear : startYear + 1;
        return `${month}-${year.toString().slice(-2)}`;
    });
};

const excelSerialDateToDate = (serial) => {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    return new Date(utcValue * 1000);
};

const resolvePlanningMonthInfo = (financialYear, monthYear) => {
    const rawMonthYear = monthYear;
    const cleanedMonthYear = cleanCellValue(rawMonthYear);
    const validMonthLabels = getPlanningMonthLabels(financialYear);
    const normalizedInput = normalizeKey(cleanedMonthYear).replace(/\s+/g, '-');
    let monthIndex = validMonthLabels.findIndex((label) => normalizeKey(label) === normalizedInput);

    if (monthIndex === -1 && normalizedInput) {
        const parts = normalizedInput.split('-');
        if (parts.length === 2) {
            const inputMonthPrefix = parts[0].substring(0, 3);
            const inputYearSuffix = parts[1];
            monthIndex = validMonthLabels.findIndex((label) => {
                const labelParts = normalizeKey(label).split('-');
                return labelParts[0].substring(0, 3) === inputMonthPrefix && labelParts[1] === inputYearSuffix;
            });
        }
    }

    if (monthIndex === -1 && typeof rawMonthYear === 'number' && Number.isFinite(rawMonthYear)) {
        const date = excelSerialDateToDate(rawMonthYear);
        if (!Number.isNaN(date.getTime())) {
            const month = FY_MONTHS[date.getUTCMonth()];
            const label = `${month}-${String(date.getUTCFullYear()).slice(-2)}`;
            monthIndex = validMonthLabels.findIndex((validLabel) => normalizeKey(validLabel) === normalizeKey(label));
        }
    }

    if (monthIndex === -1 && rawMonthYear instanceof Date && !Number.isNaN(rawMonthYear.getTime())) {
        const month = FY_MONTHS[rawMonthYear.getMonth()];
        const label = `${month}-${String(rawMonthYear.getFullYear()).slice(-2)}`;
        monthIndex = validMonthLabels.findIndex((validLabel) => normalizeKey(validLabel) === normalizeKey(label));
    }

    if (monthIndex === -1 && cleanedMonthYear) {
        const parsedDate = new Date(cleanedMonthYear);
        if (!Number.isNaN(parsedDate.getTime())) {
            const month = FY_MONTHS[parsedDate.getMonth()];
            const label = `${month}-${String(parsedDate.getFullYear()).slice(-2)}`;
            monthIndex = validMonthLabels.findIndex((validLabel) => normalizeKey(validLabel) === normalizeKey(label));
        }
    }

    if (monthIndex === -1) {
        throw new Error(`Month & Year must match FY ${financialYear} (example: ${validMonthLabels[0]})`);
    }

    return {
        month: monthIndex + 1,
        monthYear: validMonthLabels[monthIndex]
    };
};

const resolvePlanningStatus = (value = '') => {
    const cleaned = cleanCellValue(value);
    return PLANNING_STATUS_OPTIONS.find((status) => normalizeKey(status) === normalizeKey(cleaned)) || '';
};

const findCustomerByLookup = async (value = '') => {
    const cleaned = cleanCellValue(value);
    if (!cleaned) {
        return null;
    }

    const exactMatch = buildExactRegex(cleaned);
    return Customer.findOne({
        $or: [
            { externalCode: exactMatch },
            { customerName: exactMatch },
            { companyName: exactMatch }
        ]
    });
};

const getCurrentFinancialYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const importProducts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasProductCode = cleanHeaders.some(h => ['product code', 'productcode', 'code'].includes(h));
        const hasProductName = cleanHeaders.some(h => ['product name', 'productname', 'name'].includes(h));
        
        if (!hasProductCode && !hasProductName) {
            return res.status(400).json({
                message: `Missing required column headers: The sheet must contain at least 'Product Code' or 'Product Name'.`,
                errors: [`The sheet must contain at least 'Product Code' or 'Product Name' column.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                let productCode = pickFirstNonEmpty(row['Product Code'], row.productCode, row.code, row.Code);
                let productName = pickFirstNonEmpty(row['Product Name'], row.productName, row.name, row.Name);
                const hsnCode = pickFirstNonEmpty(row['HSN Code'], row.hsnCode, row.hsn, row.Hsn) || 'N/A';
                const gstPercentage = toSafeNumber(row['GST %'] ?? row['GST Percentage'] ?? row.gstPercentage ?? row.gst, 18);
                const basePrice = toSafeNumber(row['Base Price'] ?? row.basePrice ?? row.price, 0);
                const mrp = toSafeNumber(row.MRP ?? row.mrp ?? row['M.R.P.'], basePrice);
                const uom = pickFirstNonEmpty(row.UOM ?? row.uom ?? row.Unit ?? row.unit, 'Nos');
                const productImageUrl = pickFirstNonEmpty(row['Image URL'] ?? row.productImageUrl ?? row.imageUrl ?? row.image, '');
                const status = pickFirstNonEmpty(row.Status ?? row.status, 'Active');

                if (!productName && productCode) {
                    productName = productCode;
                }

                if (!productCode) {
                    if (productName) {
                        productCode = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
                    } else {
                        results.skipped++;
                        continue;
                    }
                }

                let existing = null;
                if (productCode) {
                    existing = await Product.findOne({ productCode: buildExactRegex(productCode) });
                }
                
                if (!existing && productName) {
                    existing = await Product.findOne({ productName: buildExactRegex(productName) });
                }
                
                const productData = {
                    productCode,
                    productName,
                    hsnCode,
                    gstPercentage,
                    basePrice,
                    mrp,
                    uom,
                    productImageUrl,
                    status,
                    companyId: req.user?.companyId
                };

                const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
                if (isVendorUser && req.user?.vendorId) {
                    productData.vendorId = req.user.vendorId;
                    productData.vendors = [{
                        vendorId: req.user.vendorId,
                        price: vendorPrice || basePrice || mrp || 1,
                        stock: vendorStock,
                        isPrimary: true
                    }];
                } else if (vendorName) {
                    const vendorObj = await Vendor.findOne({ $or: [{ name: buildExactRegex(vendorName) }, { vendorName: buildExactRegex(vendorName) }] });
                    if (vendorObj) {
                        productData.vendors = [{
                            vendorId: vendorObj._id,
                            price: vendorPrice || basePrice,
                            stock: vendorStock,
                            isPrimary
                        }];
                        productData.vendorId = vendorObj._id;
                    }
                }

                if (existing) {
                    await Product.findByIdAndUpdate(existing._id, productData);
                    results.updated++;
                } else {
                    await Product.create(productData);
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        await invalidateProductCaches();

        const successCount = results.created + results.updated;

        if (successCount > 0) {
            const { createCompanyNotifications } = require('../utils/notificationHelper');
            await createCompanyNotifications({
                companyId: req.user?.companyId,
                title: 'Products Master Imported',
                message: `Successfully imported/updated ${successCount} products (created: ${results.created}, updated: ${results.updated}, skipped: ${results.skipped}, failed: ${results.failed}).`,
                type: 'Reminder',
                excludeUserId: req.user?.id
            });
        }

        if (successCount === 0 && results.failed > 0) {
            return res.status(400).json({
                message: 'All rows failed to import',
                errors: results.errors,
                success: 0,
                ...results
            });
        }

        res.status(200).json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}.`,
            success: successCount,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing products', errors: [error.message] });
    }
};

const importCustomers = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasCustomerName = cleanHeaders.some(h => [
            'customer name', 'customername', 'name', 'contact person', 'bp name', 'company name', 'companyname', 'company'
        ].includes(h));
        
        if (!hasCustomerName) {
            return res.status(400).json({
                message: `Missing required column headers. Customer Name or Company Name is required.`,
                errors: [`The sheet must contain a column for Customer Name or Company Name.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        // Fetch all existing customers of the company for in-memory matching
        const existingCustomers = await Customer.find({ companyId }).lean();
        
        const externalCodeMap = new Map();
        const gstinMap = new Map();
        const nameMap = new Map();

        existingCustomers.forEach(cust => {
            if (cust.externalCode) {
                externalCodeMap.set(cust.externalCode.trim().toLowerCase(), cust);
            }
            if (cust.gstin) {
                gstinMap.set(cust.gstin.trim().toLowerCase(), cust);
            }
            if (cust.companyName && cust.customerName) {
                const key = `${cust.companyName.trim().toLowerCase()}|${cust.customerName.trim().toLowerCase()}`;
                nameMap.set(key, cust);
            }
        });

        const bulkOps = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const customerData = {
                    externalCode: pickFirstNonEmpty(row['Customer Code'], row.customerCode, row['Code'], row['BP Code']),
                    customerName: pickFirstNonEmpty(
                        row['Customer Name'],
                        row.customerName,
                        row['Name'],
                        row['Contact Person'],
                        row['BP Name'],
                        row['Company Name'],
                        row.companyName,
                        row['Company']
                    ),
                    companyName: pickFirstNonEmpty(
                        row['Company Name'],
                        row.companyName,
                        row['Company'],
                        row['BP Name'],
                        row['Customer Name'],
                        row.customerName,
                        row['Name']
                    ),
                    gstin: pickFirstNonEmpty(row['GSTIN'], row.gstin, row['GST No'], row['Federal Tax ID'], row['Unified Federal Tax ID'], row['VAT Reg. Number'], row['Registration No.']),
                    mobile: pickFirstNonEmpty(row['Mobile'], row.mobile, row['Phone'], row['Mobile Phone'], row['Telephone 1'], row['Telephone 2']),
                    email: pickFirstNonEmpty(row['Email'], row.email, row['E-Mail'], row.EmailCC),
                    logoUrl: pickFirstNonEmpty(row['Logo URL'], row.logoUrl, row.Picture),
                    defaultDiscount: toSafeNumber(row['Default Discount'] ?? row.defaultDiscount ?? row['Discount'] ?? row['Discount %'], 0),
                    billingAddress: {
                        line1: pickFirstNonEmpty(row['Billing Address Line 1'], row['Address Line 1'], row['Bill-to Street']),
                        line2: pickFirstNonEmpty(row['Billing Address Line 2'], row['Address Line 2'], row['Bill-to County'], row['Bill-to Country']),
                        city: pickFirstNonEmpty(row['City'], row['Billing City'], row['Bill-to City'], row['City/Town/Village']),
                        state: pickFirstNonEmpty(row['State'], row['Billing State'], row['Bill-to State'], row['BP State']),
                        pincode: pickFirstNonEmpty(row['Pincode'], row['Billing Pincode'], row['Bill-to Zip Code'], row['Zip Code'])
                    },
                    shippingAddress: {
                        line1: pickFirstNonEmpty(row['Shipping Address Line 1'], row['Billing Address Line 1'], row['Address Line 1'], row['Ship-to Street']),
                        line2: pickFirstNonEmpty(row['Shipping Address Line 2'], row['Billing Address Line 2'], row['Address Line 2'], row['Ship-to County'], row['Ship-to Country']),
                        city: pickFirstNonEmpty(row['Shipping City'], row['City'], row['Ship-to City'], row['City/Town/Village']),
                        state: pickFirstNonEmpty(row['Shipping State'], row['State'], row['Ship-to State'], row['BP State']),
                        pincode: pickFirstNonEmpty(row['Shipping Pincode'], row['Pincode'], row['Ship-to Zip Code'], row['Zip Code'])
                    },
                    companyId: companyId,
                    createdBy: req.user ? req.user.id : null
                };

                if (!customerData.customerName || !customerData.companyName) {
                    throw new Error('Missing required fields: Customer Name or Company Name');
                }

                // Check for matches in memory
                let existing = null;
                if (customerData.externalCode) {
                    existing = externalCodeMap.get(customerData.externalCode.trim().toLowerCase());
                }

                if (!existing && customerData.gstin) {
                    existing = gstinMap.get(customerData.gstin.trim().toLowerCase());
                }

                if (!existing && customerData.companyName && customerData.customerName) {
                    const key = `${customerData.companyName.trim().toLowerCase()}|${customerData.customerName.trim().toLowerCase()}`;
                    existing = nameMap.get(key);
                }

                if (existing) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: existing._id },
                            update: {
                                $set: {
                                    ...customerData,
                                    createdBy: req.user?.id || existing.createdBy || null
                                }
                            }
                        }
                    });
                    results.updated++;
                } else {
                    bulkOps.push({
                        insertOne: {
                            document: customerData
                        }
                    });
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        if (bulkOps.length > 0) {
            await Customer.bulkWrite(bulkOps, { ordered: false });
        }

        await invalidateCustomerCaches();

        const successCount = results.created + results.updated;

        if (successCount > 0) {
            const { createCompanyNotifications } = require('../utils/notificationHelper');
            await createCompanyNotifications({
                companyId: req.user?.companyId,
                title: 'Customers Master Imported',
                message: `Successfully imported/updated ${successCount} customers (created: ${results.created}, updated: ${results.updated}, skipped: ${results.skipped}, failed: ${results.failed}).`,
                type: 'Reminder',
                excludeUserId: req.user?.id
            });
        }

        if (successCount === 0 && results.failed > 0) {
            return res.status(400).json({
                message: 'All rows failed to import',
                errors: results.errors,
                success: 0,
                ...results
            });
        }

        res.status(200).json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}.`,
            success: successCount,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing customers', errors: [error.message] });
    }
};

// Import Planning entries from Excel/CSV - OPTIMIZED with batch lookups and bulkWrite
const importPlanning = async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const selectedFinancialYear = normalizeFinancialYear(cleanCellValue(req.body.financialYear || req.query.financialYear));

        // Pre-validate headers for Planning sheet
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasMonthYear = cleanHeaders.some(h => ['month & year', 'monthyear', 'month', 'year'].includes(h));
        const hasCustomer = cleanHeaders.some(h => ['customer code', 'customercode', 'customer name', 'customername', 'company name', 'companyname'].includes(h));
        const hasProduct = cleanHeaders.some(h => ['product code', 'productcode', 'product name', 'productname'].includes(h));
        const hasMgr1 = cleanHeaders.some(h => ['mgr 1', 'mgr1', 'mgrcode', 'mgrcode1'].includes(h));
        const hasStatus = cleanHeaders.some(h => ['status'].includes(h));
        
        const missingHeaders = [];
        if (!hasMonthYear) missingHeaders.push('Month & Year');
        if (!hasCustomer) missingHeaders.push('Customer Code');
        if (!hasProduct) missingHeaders.push('Product Code');
        if (!hasMgr1) missingHeaders.push('MGR 1');
        if (!hasStatus) missingHeaders.push('Status');
        
        if (missingHeaders.length > 0) {
            return res.status(400).json({
                message: `Missing required column headers: ${missingHeaders.join(', ')}`,
                errors: [`The sheet must contain these column headers: ${missingHeaders.join(', ')}`]
            });
        }

        // PHASE 1: Collect all unique lookups
        const uniqueCustomerCodes = new Set();
        const uniqueProductCodes = new Set();
        const uniqueMgr1Codes = new Set();
        const uniqueMgr2Codes = new Set();

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const customerLookup = cleanCellValue(
                row['Customer Code'] || row['customerCode'] || row['Customer Name'] || row.customerName || row['Company Name'] || row.companyName
            );
            const productLookup = cleanCellValue(
                row['Product Code'] || row['productCode'] || row['Product Name'] || row.productName
            );
            const mgrCodeInput = cleanCellValue(
                row['MGR 1'] || row.MGR1 || row.mgrCode || row.mgrCode1
            );
            const mgrCode2Input = cleanCellValue(
                row['MGR 2'] || row.MGR2 || row.mgrCode2
            );
            
            if (customerLookup) uniqueCustomerCodes.add(customerLookup);
            if (productLookup) uniqueProductCodes.add(productLookup);
            if (mgrCodeInput) uniqueMgr1Codes.add(mgrCodeInput);
            if (mgrCode2Input) uniqueMgr2Codes.add(mgrCode2Input);
        }

        // PHASE 2: Batch load all entities
        const customerLookups = Array.from(uniqueCustomerCodes);
        const productLookups = Array.from(uniqueProductCodes);
        const mgr1Lookups = Array.from(uniqueMgr1Codes);
        const mgr2Lookups = Array.from(uniqueMgr2Codes);

        const [customerMap, productMap, mgr1Map, mgr2Map] = await Promise.all([
            loadPlanningCustomers(customerLookups),
            loadPlanningProducts(productLookups),
            loadPlanningMgrs(mgr1Lookups, 'MGR1'),
            loadPlanningMgrs(mgr2Lookups, 'MGR2')
        ]);

        // Dynamically create missing master records on the fly
        if (missingCustomerCodes.length > 0) {
            for (const code of missingCustomerCodes) {
                const newCustomer = new Customer({
                    companyId: req.user?.companyId,
                    customerName: code,
                    companyName: code,
                    externalCode: code,
                    createdBy: req.user?.id || null
                });
                await newCustomer.save();
                customerMap.set(normalizeKey(code), newCustomer);
            }
        }

        if (missingProductCodes.length > 0) {
            for (const code of missingProductCodes) {
                const newProduct = new Product({
                    companyId: req.user?.companyId,
                    productCode: code,
                    productName: code,
                    hsnCode: 'N/A',
                    gstPercentage: 18,
                    basePrice: 0,
                    mrp: 0,
                    uom: 'Nos',
                    status: 'Active'
                });
                await newProduct.save();
                productMap.set(normalizeKey(code), newProduct);
            }
        }

        if (missingMgr1Codes.length > 0) {
            for (const code of missingMgr1Codes) {
                const newMgr = new MGR({
                    companyId: req.user?.companyId,
                    code,
                    mgrType: 'MGR1',
                    description: code,
                    status: 'Active'
                });
                await newMgr.save();
                mgr1Map.set(normalizeKey(code), newMgr);
            }
        }

        if (missingMgr2Codes.length > 0) {
            for (const code of missingMgr2Codes) {
                const newMgr = new MGR({
                    companyId: req.user?.companyId,
                    code,
                    mgrType: 'MGR2',
                    description: code,
                    status: 'Active'
                });
                await newMgr.save();
                mgr2Map.set(normalizeKey(code), newMgr);
            }
        }

        // PHASE 3: Parse and prepare bulk operations
        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            processed: 0,
            total: data.length,
            success: 0
        };

        const bulkOps = [];
        const BATCH_SIZE = 1000;

        const executeBatch = async () => {
            if (bulkOps.length === 0) return;
            const writeResult = await Planning.bulkWrite(bulkOps, { ordered: false });
            results.created += writeResult?.upsertedCount || 0;
            results.updated += writeResult?.modifiedCount || 0;
            const matched = writeResult?.matchedCount || 0;
            const modified = writeResult?.modifiedCount || 0;
            results.skipped += (matched - modified);
            bulkOps.length = 0;
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            results.processed = i + 1;

            try {
                const financialYear = normalizeFinancialYear(cleanCellValue(
                    row['Financial Year'] || row.financialYear || row.FY || selectedFinancialYear
                ));
                const canEdit = await checkPrevYearEditPermission(req.user, financialYear);
                if (!canEdit) {
                    throw new Error(`You do not have permission to import entries for previous financial year (${financialYear})`);
                }
                const rawMonthYear = row['Month & Year'] ?? row.monthYear ?? row.Month ?? row.month;
                const monthYear = cleanCellValue(rawMonthYear);
                const customerLookup = cleanCellValue(
                    row['Customer Code'] || row['customerCode'] || row['Customer Name'] || row.customerName || row['Company Name'] || row.companyName
                );
                const productLookup = cleanCellValue(
                    row['Product Code'] || row['productCode'] || row['Product Name'] || row.productName
                );
                const qty = Number(row.Qty ?? row.qty);
                const value = Number(row.Value ?? row.value);
                const mgrCodeInput = cleanCellValue(
                    row['MGR 1'] || row.MGR1 || row.mgrCode || row.mgrCode1
                );
                const mgrCode2Input = cleanCellValue(
                    row['MGR 2'] || row.MGR2 || row.mgrCode2
                );
                const status = resolvePlanningStatus(row.Status || row.status);

                if (!financialYear || !monthYear || !customerLookup || !productLookup || !mgrCodeInput || !status) {
                    throw new Error('Missing required fields: Financial Year, Month & Year, Customer Code, Product Code, MGR 1, or Status');
                }

                if (!Number.isFinite(qty) || qty < 0) {
                    throw new Error('Qty must be a number greater than or equal to zero');
                }

                if (!Number.isFinite(value) || value < 0) {
                    throw new Error('Value must be a number greater than or equal to zero');
                }

                const monthInfo = resolvePlanningMonthInfo(financialYear, rawMonthYear);

                const customer = customerMap.get(normalizeKey(customerLookup));
                if (!customer) {
                    throw new Error(`Customer code not found: ${customerLookup}`);
                }

                const product = productMap.get(normalizeKey(productLookup));
                if (!product) {
                    throw new Error(`Product code not found: ${productLookup}`);
                }

                const mgr1 = mgr1Map.get(normalizeKey(mgrCodeInput));
                if (!mgr1) {
                    throw new Error(`MGR 1 not found: ${mgrCodeInput}`);
                }

                const mgr2 = mgrCode2Input ? mgr2Map.get(normalizeKey(mgrCode2Input)) : null;
                if (mgrCode2Input && !mgr2) {
                    throw new Error(`MGR 2 not found: ${mgrCode2Input}`);
                }

                bulkOps.push({
                    updateOne: {
                        filter: {
                            companyId: req.user?.companyId,
                            customerId: customer._id,
                            productId: product._id,
                            monthYear: monthInfo.monthYear,
                            mgrCode: mgr1.code
                        },
                        update: {
                            $set: {
                                financialYear,
                                customerName: customer.companyName || customer.customerName,
                                productName: product.productName,
                                qty,
                                value,
                                totalValue: qty * value,
                                mgrCode2: mgr2?.code || '',
                                status
                            },
                            $setOnInsert: {
                                createdBy: req.user?.id || null
                            }
                        },
                        upsert: true
                    }
                });

                if (bulkOps.length >= BATCH_SIZE || i === data.length - 1) {
                    await executeBatch();
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
                
                if (bulkOps.length >= BATCH_SIZE || i === data.length - 1) {
                    await executeBatch();
                }
            }
        }

        results.success = results.created + results.updated;

        // Trigger notification
        if (results.success > 0) {
            const { createCompanyNotifications } = require('../utils/notificationHelper');
            await createCompanyNotifications({
                companyId: req.user?.companyId,
                title: 'Planning Entries Imported',
                message: `Successfully imported/updated ${results.success} planning entries (created: ${results.created}, updated: ${results.updated}, skipped: ${results.skipped}, failed: ${results.failed}).`,
                type: 'Planning',
                excludeUserId: req.user?.id
            });
        }

        if (results.success === 0 && results.failed > 0) {
            return res.status(400).json({
                message: 'All rows failed to import',
                errors: results.errors,
                success: 0,
                ...results
            });
        }

        res.status(200).json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}.`,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing planning entries', errors: [error.message] });
    }
};

// Generate Planning Template
const getPlanningTemplate = async (req, res) => {
    try {
        const financialYear = normalizeFinancialYear(cleanCellValue(req.query.financialYear)) || getCurrentFinancialYear();
        const monthLabels = getPlanningMonthLabels(financialYear);
        const [customer, product, mgr1, mgr2] = await Promise.all([
            Customer.findOne().sort({ createdAt: 1 }),
            Product.findOne().sort({ createdAt: 1 }),
            MGR.findOne({ mgrType: 'MGR1', status: 'Active' }).sort({ code: 1 }),
            MGR.findOne({ mgrType: 'MGR2', status: 'Active' }).sort({ code: 1 })
        ]);

const templateData = [
            {
                'Financial Year': financialYear,
                'Month & Year': monthLabels[0],
                'Customer Code': customer?.externalCode || customer?.customerName || 'CUST001',
                'Product Code': product?.productCode || 'PROD001',
                Qty: 10,
                Value: 2500,
                'MGR 1': mgr1?.code || 'SBU 3',
                'MGR 2': mgr2?.code || '',
                Status: 'Firm'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Planning');

worksheet['!cols'] = [
            { wch: 16 },
            { wch: 14 },
            { wch: 16 },
            { wch: 16 },
            { wch: 10 },
            { wch: 12 },
            { wch: 14 },
            { wch: 14 },
            { wch: 18 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=planning_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Generate Product Template
const getProductTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Product Code': 'PROD001',
                'Product Name': 'Sample Product Name',
                'HSN Code': '84818020',
                'GST %': 18,
                'Base Price': 1000,
                'MRP': 1180,
                'UOM': 'Nos',
                'Vendor Name': 'Vendor A',
                'Vendor Price': 1000,
                'Vendor Stock': 25,
                'Is Primary': true,
                'Image URL': '',
                'Status': 'Active'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 8 },
            { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 24 },
            { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 10 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Generate Customer Template
const getCustomerTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Customer Code': 'CUST-001',
                'Customer Name': 'John Doe',
                'Company Name': 'ABC Enterprises Pvt Ltd',
                'GSTIN': '27AABCU9603R1ZM',
                'Mobile': '9876543210',
                'Email': 'john@abc.com',
                'Billing Address Line 1': '123 Main Street',
                'Billing Address Line 2': 'Near Park',
                'City': 'Mumbai',
                'State': 'Maharashtra',
                'Pincode': '400001',
                'Shipping Address Line 1': 'Warehouse 12, Industrial Estate',
                'Shipping Address Line 2': 'Phase 2',
                'Shipping City': 'Mumbai',
                'Shipping State': 'Maharashtra',
                'Shipping Pincode': '400001',
                'Default Discount': 5,
                'Logo URL': ''
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

        const notesSheet = XLSX.utils.aoa_to_sheet([
            ['Customer Import Notes'],
            ['Required columns', 'Customer Code, Customer Name, Company Name'],
            ['Meaning', 'Customer Code = external customer code, Customer Name = contact/person, Company Name = trade name/company'],
            ['Optional columns', 'GSTIN, Mobile, Email, Billing/Shipping address columns, Default Discount, Logo URL'],
            ['Accepted source formats', 'This importer also accepts BP Code, BP Name, Contact Person and related SAP-style columns']
        ]);
        XLSX.utils.book_append_sheet(workbook, notesSheet, 'Instructions');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 20 }, { wch: 28 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 28 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 15 }, { wch: 40 }
        ];
        notesSheet['!cols'] = [{ wch: 24 }, { wch: 120 }];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customer_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Import Product Attributes from Excel/CSV
const importAttributes = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                // Map columns
                const attrData = {
                    productCode: row['Product Code'] || row['productCode'],
                    attributeCode: row['Attribute Code'] || row['attributeCode'],
                    attributeValue: row['Attribute Value'] || row['attributeValue']
                };

                // Validate required fields
                if (!attrData.productCode || !attrData.attributeCode || !attrData.attributeValue) {
                    throw new Error('Missing required fields: Product Code, Attribute Code, or Attribute Value');
                }

                // Upsert logic: Update if (productCode + attributeCode) match, otherwise create
                await ProductAttribute.findOneAndUpdate(
                    { productCode: attrData.productCode, attributeCode: attrData.attributeCode },
                    { attributeValue: attrData.attributeValue },
                    { upsert: true, new: true }
                );

                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Import completed. ${results.success} attributes imported, ${results.failed} failed.`,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing attributes' });
    }
};

// Import Attribute Master Definitions
const importAttributeMaster = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const { mgr3Id } = req.body;
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                // Map columns
                const attrData = {
                    mgr3Code: row['MGR3 Code'] || row['mgr3Code'],
                    code: row['Attribute Code'] || row['attributeCode'] || row['Code'],
                    description: row['Description'] || row['description'],
                    status: row['Status'] || row['status'] || 'Active'
                };

                // Validate required fields
                if (!attrData.code || !attrData.description) {
                    throw new Error('Missing required fields: Attribute Code or Description');
                }

                let targetMgr3Id = mgr3Id;

                // If MGR3 Code is provided, try to find the MGR3 record
                if (attrData.mgr3Code) {
                    const mgr3 = await MGR.findOne({ code: attrData.mgr3Code, type: 'MGR3' });
                    if (mgr3) {
                        targetMgr3Id = mgr3._id;
                    }
                }

                if (!targetMgr3Id) {
                    throw new Error('Missing MGR3 reference. Either provide mgr3Id in request or MGR3 Code in file.');
                }

                // Upsert logic: Update if (mgr3Id + code) match, otherwise create
                await Attribute.findOneAndUpdate(
                    { mgr3Id: targetMgr3Id, code: attrData.code },
                    { description: attrData.description, status: attrData.status },
                    { upsert: true, new: true }
                );

                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Import completed. ${results.success} attributes imported, ${results.failed} failed.`,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing attribute definitions' });
    }
};

// Generate Attribute Template
const getAttributeTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Product Code': 'PROD001',
                'Attribute Code': 'COLOR',
                'Attribute Value': 'Red'
            },
            {
                'Product Code': 'PROD001',
                'Attribute Code': 'SIZE',
                'Attribute Value': 'XL'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attributes');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 20 }, { wch: 30 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attribute_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Generate Attribute Master Template
const getAttributeMasterTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'MGR3 Code': 'MGR-001',
                'Attribute Code': 'COLOR',
                'Description': 'Product Color',
                'Status': 'Active'
            },
            {
                'MGR3 Code': 'MGR-001',
                'Attribute Code': 'SIZE',
                'Description': 'Product Size',
                'Status': 'Active'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attribute Master');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 12 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attribute_master_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

const parseDateValue = (val) => {
    if (!val) return null;
    if (typeof val === 'number' && Number.isFinite(val)) {
        return excelSerialDateToDate(val);
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d;
};

const importWarranties = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const Asset = require('../models/Asset');
        const Warranty = require('../models/Warranty');
        const Product = require('../models/Product');

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const customerLookup = cleanCellValue(row['Customer Code'] || row['Customer Name'] || row.customerId || row.customer);
                const productLookup = cleanCellValue(row['Product Code'] || row['Product Name'] || row.productId || row.product);
                const serialNumber = cleanCellValue(row['Serial Number'] || row.serialNumber || row.serial);
                const purchaseDateVal = row['Purchase Date'] || row.purchaseDate;
                const expiryDateVal = row['Expiry Date'] || row.expiryDate;
                const status = cleanCellValue(row.Status || row.status || 'Active');

                if (!customerLookup || !productLookup || !serialNumber || !purchaseDateVal || !expiryDateVal) {
                    throw new Error('Missing required fields: Customer Code/Name, Product Code/Name, Serial Number, Purchase Date, or Expiry Date');
                }

                // 1. Resolve Customer
                const customer = await findCustomerByLookup(customerLookup);
                if (!customer) {
                    throw new Error(`Customer not found for: "${customerLookup}"`);
                }

                // 2. Resolve Product
                const exactProd = buildExactRegex(productLookup);
                const product = await Product.findOne({
                    companyId,
                    $or: [
                        { productCode: exactProd },
                        { productName: exactProd }
                    ]
                });
                if (!product) {
                    throw new Error(`Product not found for: "${productLookup}"`);
                }

                const purchaseDate = parseDateValue(purchaseDateVal);
                const expiryDate = parseDateValue(expiryDateVal);
                if (!purchaseDate) throw new Error(`Invalid Purchase Date: "${purchaseDateVal}"`);
                if (!expiryDate) throw new Error(`Invalid Expiry Date: "${expiryDateVal}"`);

                // 3. Asset Handling (duplicate serial number -> reuse/update)
                let asset = await Asset.findOne({ companyId, serialNumber: buildExactRegex(serialNumber) });
                if (asset) {
                    // Update asset relations if they changed
                    asset.customerId = customer._id;
                    asset.productId = product._id;
                    asset.installationDate = purchaseDate;
                    await asset.save();
                } else {
                    asset = await Asset.create({
                        companyId,
                        customerId: customer._id,
                        productId: product._id,
                        serialNumber,
                        installationDate: purchaseDate
                    });
                }

                // 4. Warranty Handling (duplicate serial number -> update warranty)
                let warranty = await Warranty.findOne({ companyId, serialNumber: buildExactRegex(serialNumber) });
                if (warranty) {
                    warranty.customerId = customer._id;
                    warranty.productId = product._id;
                    warranty.assetId = asset._id;
                    warranty.purchaseDate = purchaseDate;
                    warranty.expiryDate = expiryDate;
                    warranty.status = status;
                    await warranty.save();
                    results.updated++;
                } else {
                    await Warranty.create({
                        companyId,
                        customerId: customer._id,
                        productId: product._id,
                        assetId: asset._id,
                        serialNumber,
                        purchaseDate,
                        expiryDate,
                        status
                    });
                    results.imported++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.json({
            success: results.failed === 0,
            ...results
        });
    } catch (error) {
        console.error('Import warranties error:', error);
        res.status(500).json({ message: error.message || 'Error importing warranties', errors: [error.message] });
    }
};

const importAmcs = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const AMC = require('../models/AMC');

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const customerLookup = cleanCellValue(row['Customer Code'] || row['Customer Name'] || row.customerId || row.customer);
                const contractNo = cleanCellValue(row['Contract Number'] || row['Contract No'] || row.contractNo || row.contractNumber);
                const startDateVal = row['Start Date'] || row.startDate;
                const endDateVal = row['End Date'] || row.endDate;
                const visitsAllowed = toSafeNumber(row['Allowed Visits'] || row['Visits Allowed'] || row.visitsAllowed, 4);
                const amount = toSafeNumber(row['Amount'] || row.amount || row.price, 0);
                const status = cleanCellValue(row.Status || row.status || 'Active');

                if (!customerLookup || !contractNo || !startDateVal || !endDateVal) {
                    throw new Error('Missing required fields: Customer Code/Name, Contract Number, Start Date, or End Date');
                }

                // 1. Resolve Customer
                const customer = await findCustomerByLookup(customerLookup);
                if (!customer) {
                    throw new Error(`Customer not found for: "${customerLookup}"`);
                }

                const startDate = parseDateValue(startDateVal);
                const endDate = parseDateValue(endDateVal);
                if (!startDate) throw new Error(`Invalid Start Date: "${startDateVal}"`);
                if (!endDate) throw new Error(`Invalid End Date: "${endDateVal}"`);

                // 2. AMC Handling (duplicate contract No -> update existing)
                let amc = await AMC.findOne({ companyId, contractNo: buildExactRegex(contractNo) });
                if (amc) {
                    amc.customerId = customer._id;
                    amc.startDate = startDate;
                    amc.endDate = endDate;
                    amc.visitsAllowed = visitsAllowed;
                    amc.amount = amount;
                    amc.status = status;
                    await amc.save();
                    results.updated++;
                } else {
                    await AMC.create({
                        companyId,
                        customerId: customer._id,
                        contractNo,
                        startDate,
                        endDate,
                        visitsAllowed,
                        visitsUsed: 0,
                        amount,
                        status
                    });
                    results.imported++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.json({
            success: results.failed === 0,
            ...results
        });
    } catch (error) {
        console.error('Import amcs error:', error);
        res.status(500).json({ message: error.message || 'Error importing AMCs', errors: [error.message] });
    }
};

const getWarrantyTemplate = async (req, res) => {
    try {
        const Customer = require('../models/Customer');
        const Product = require('../models/Product');
        const [customer, product] = await Promise.all([
            Customer.findOne().sort({ createdAt: 1 }),
            Product.findOne().sort({ createdAt: 1 })
        ]);

        const templateData = [
            {
                'Customer Code': customer?.externalCode || customer?.customerName || 'CUST001',
                'Product Code': product?.productCode || 'PROD001',
                'Serial Number': 'SN-GEN-908123',
                'Purchase Date': '2025-04-01',
                'Expiry Date': '2027-03-31',
                'Status': 'Active'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Warranties');

        worksheet['!cols'] = [
            { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=warranty_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

const getAmcTemplate = async (req, res) => {
    try {
        const Customer = require('../models/Customer');
        const customer = await Customer.findOne().sort({ createdAt: 1 });

        const templateData = [
            {
                'Customer Code': customer?.externalCode || customer?.customerName || 'CUST001',
                'Contract Number': 'AMC-2025-9012',
                'Start Date': '2025-04-01',
                'End Date': '2026-03-31',
                'Allowed Visits': 4,
                'Amount': 15000,
                'Status': 'Active'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'AMCs');

        worksheet['!cols'] = [
            { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=amc_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

const generateTicketNumberForImport = async (companyId) => {
    const Counter = require('../models/Counter');
    const year = new Date().getFullYear();
    const prefix = 'CSM';
    const counter = await Counter.findOneAndUpdate(
        { type: 'ticket', companyId: companyId || null, prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqStr}`;
};

const importTickets = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const Ticket = require('../models/Ticket');
        const TicketCategory = require('../models/TicketCategory');
        const TicketType = require('../models/TicketType');
        const Priority = require('../models/Priority');
        const Asset = require('../models/Asset');
        const Product = require('../models/Product');

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        // Pre-fetch/create default categories, types, priorities to speed things up
        const defaultCategory = await TicketCategory.findOne({ companyId }) || await TicketCategory.create({ companyId, name: 'General', description: 'General Tickets' });
        const defaultType = await TicketType.findOne({ companyId }) || await TicketType.create({ companyId, name: 'Incident', description: 'Incident Reports' });
        const defaultPriority = await Priority.findOne({ companyId }) || await Priority.create({ companyId, name: 'Medium', responseSlaHours: 4, resolutionSlaHours: 24, color: '#3b82f6' });

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const ticketNoInput = cleanCellValue(row['Ticket No'] || row['Ticket Number'] || row.ticketNo || row.ticketNumber);
                const customerLookup = cleanCellValue(row['Customer Code'] || row['Customer Name'] || row.customerId || row.customer);
                const productLookup = cleanCellValue(row['Product Code'] || row['Product Name'] || row.productId || row.product);
                const serialNumber = cleanCellValue(row['Product Serial No.'] || row['Product Serial No'] || row['Serial Number'] || row.serialNumber || row.serial);
                const issueTitle = cleanCellValue(row['Issue Title'] || row.issueTitle || row.title || row.subject || row['Subject']);
                const description = cleanCellValue(row['Description'] || row.description || '');
                const priorityName = cleanCellValue(row['Priority'] || row.priority);
                const categoryName = cleanCellValue(row['Category'] || row.category);
                const typeName = cleanCellValue(row['Ticket Type'] || row['Type'] || row.type);
                const status = cleanCellValue(row['Status'] || row.status || 'Open');
                const issueDateVal = row['Issue Date'] || row['Created At'] || row.issueDate || row.createdAt;

                if (!customerLookup || !issueTitle) {
                    throw new Error('Missing required fields: Customer Code/Name or Issue Title');
                }

                // 1. Resolve Customer
                const customer = await findCustomerByLookup(customerLookup);
                if (!customer) {
                    throw new Error(`Customer not found for: "${customerLookup}"`);
                }

                // 2. Resolve Product (optional)
                let product = null;
                if (productLookup) {
                    const exactProd = buildExactRegex(productLookup);
                    product = await Product.findOne({
                        companyId,
                        $or: [
                            { productCode: exactProd },
                            { productName: exactProd }
                        ]
                    });
                    if (!product) {
                        throw new Error(`Product not found for: "${productLookup}"`);
                    }
                }

                // 3. Resolve or Create Asset (optional)
                let asset = null;
                if (serialNumber) {
                    const exactSerial = buildExactRegex(serialNumber);
                    asset = await Asset.findOne({ companyId, serialNumber: exactSerial });
                    if (!asset) {
                        // Create asset dynamically
                        if (!product) {
                            throw new Error(`Product Code/Name is required to register new Serial Number: "${serialNumber}"`);
                        }
                        asset = await Asset.create({
                            companyId,
                            customerId: customer._id,
                            productId: product._id,
                            serialNumber,
                            installationDate: parseDateValue(issueDateVal) || new Date()
                        });
                    } else {
                        // If product/customer are not specified, autofill from the existing asset
                        if (!product) {
                            product = await Product.findById(asset.productId);
                        }
                    }
                }

                // 4. Resolve Priority
                let priorityObj = defaultPriority;
                if (priorityName) {
                    priorityObj = await Priority.findOne({ companyId, name: buildExactRegex(priorityName) });
                    if (!priorityObj) {
                        priorityObj = await Priority.create({
                            companyId,
                            name: priorityName,
                            responseSlaHours: 4,
                            resolutionSlaHours: 24,
                            color: '#3b82f6'
                        });
                    }
                }

                // 5. Resolve Category
                let categoryObj = defaultCategory;
                if (categoryName) {
                    categoryObj = await TicketCategory.findOne({ companyId, name: buildExactRegex(categoryName) });
                    if (!categoryObj) {
                        categoryObj = await TicketCategory.create({
                            companyId,
                            name: categoryName,
                            description: `Created during tickets import`
                        });
                    }
                }

                // 6. Resolve Type
                let typeObj = defaultType;
                if (typeName) {
                    typeObj = await TicketType.findOne({ companyId, name: buildExactRegex(typeName) });
                    if (!typeObj) {
                        typeObj = await TicketType.create({
                            companyId,
                            name: typeName,
                            description: `Created during tickets import`
                        });
                    }
                }

                // 7. Resolve Issue Date
                const createdAt = parseDateValue(issueDateVal) || new Date();

                // Calculate SLAs
                const responseDue = new Date(createdAt.getTime() + priorityObj.responseSlaHours * 60 * 60 * 1000);
                const resolutionDue = new Date(createdAt.getTime() + priorityObj.resolutionSlaHours * 60 * 60 * 1000);

                // 8. Generate Ticket No
                let ticketNo = ticketNoInput;
                if (!ticketNo) {
                    ticketNo = await generateTicketNumberForImport(companyId);
                } else {
                    // Check if ticket number is unique for this company
                    const existingTicket = await Ticket.findOne({ companyId, ticketNo: buildExactRegex(ticketNo) });
                    if (existingTicket) {
                        throw new Error(`Ticket No "${ticketNo}" already exists`);
                    }
                }

                // Create the ticket
                const ticketData = {
                    companyId,
                    ticketNo,
                    customerId: customer._id,
                    productId: product ? product._id : null,
                    assetId: asset ? asset._id : null,
                    issueTitle,
                    description,
                    categoryId: categoryObj._id,
                    typeId: typeObj._id,
                    priorityId: priorityObj._id,
                    status,
                    source: 'Excel Import',
                    createdAt,
                    updatedAt: createdAt,
                    slaResponseDue: responseDue,
                    slaResolutionDue: resolutionDue,
                    timeline: [{
                        activityType: 'Created',
                        description: 'Ticket imported from Excel',
                        performedBy: req.user?.id,
                        createdAt
                    }]
                };

                await Ticket.create(ticketData);
                results.imported++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.json({
            success: results.failed === 0,
            ...results
        });
    } catch (error) {
        console.error('Import tickets error:', error);
        res.status(500).json({ message: error.message || 'Error importing tickets', errors: [error.message] });
    }
};

const getTicketTemplate = async (req, res) => {
    try {
        const Customer = require('../models/Customer');
        const Product = require('../models/Product');
        const [customer, product] = await Promise.all([
            Customer.findOne().sort({ createdAt: 1 }),
            Product.findOne().sort({ createdAt: 1 })
        ]);

        const templateData = [
            {
                'Ticket No': 'CSM-2026-0001',
                'Customer Code': customer?.externalCode || customer?.customerName || 'CUST001',
                'Product Code': product?.productCode || 'PROD001',
                'Product Serial No.': 'SN-GEN-908123',
                'Issue Title': 'Hose leakage at joint',
                'Description': 'Customer reported heavy leakage in the Brass Hose Connector after 10 days of use.',
                'Priority': 'Medium',
                'Category': 'Hardware',
                'Ticket Type': 'Complaint',
                'Status': 'Open',
                'Issue Date': '2026-06-30'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

        worksheet['!cols'] = [
            { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 45 },
            { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }
        ];

        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Vendor Imports
const importVendors = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const existingVendors = await Vendor.find({ companyId }).lean();
        const vendorNameMap = new Map();
        existingVendors.forEach(v => {
            if (v.name) {
                vendorNameMap.set(v.name.trim().toLowerCase(), v);
            }
        });

        const bulkOps = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const rawName = pickFirstNonEmpty(row['Vendor Name'], row.vendorName, row['Name'], row['Company Name'], row.name);
                const name = rawName ? String(rawName).trim() : '';

                const vendorData = {
                    name: name,
                    contactPerson: pickFirstNonEmpty(row['Contact Person'], row.contactPerson, row['Contact'], row['Person']) || '',
                    phone: pickFirstNonEmpty(row['Phone'], row.phone, row['Mobile'], row['Mobile Phone'], row['Telephone']) || '',
                    email: pickFirstNonEmpty(row['Email'], row.email, row['E-Mail']) || '',
                    address: pickFirstNonEmpty(row['Address'], row.address, row['Street'], row['Location']) || '',
                    gstin: pickFirstNonEmpty(row['GSTIN'], row.gstin, row['GST No'], row['GST Number']) || '',
                    isActive: typeof row['Active'] !== 'undefined' ? toBoolean(row['Active']) : (typeof row['IsActive'] !== 'undefined' ? toBoolean(row['IsActive']) : true),
                    companyId: companyId
                };

                const existing = name ? vendorNameMap.get(name.toLowerCase()) : null;
                if (existing) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: existing._id },
                            update: { $set: vendorData }
                        }
                    });
                    results.updated++;
                } else {
                    bulkOps.push({
                        insertOne: {
                            document: vendorData
                        }
                    });
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        if (bulkOps.length > 0) {
            await Vendor.bulkWrite(bulkOps, { ordered: false });
        }

        res.json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            success: results.created + results.updated,
            created: results.created,
            updated: results.updated,
            failed: results.failed,
            skipped: results.skipped,
            errors: results.errors
        });
    } catch (error) {
        console.error('Import vendors error:', error);
        res.status(500).json({ message: error.message || 'Error importing vendors', errors: [error.message] });
    }
};

const getVendorTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Vendor Name': 'Acme Corporation',
                'Contact Person': 'Jane Smith',
                'Phone': '9876543210',
                'Email': 'jane@acme.com',
                'Address': '456 Industrial Road, Phase 1, Mumbai',
                'GSTIN': '27AABCU9603R1ZM',
                'Active': 'TRUE'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendors');

        worksheet['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 10 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=vendors_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Price Book Imports
const importPriceBooks = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasBookName = cleanHeaders.some(h => [
            'book name', 'bookname', 'name', 'pricebook name', 'pricebookname'
        ].includes(h));
        
        if (!hasBookName) {
            return res.status(400).json({
                message: `Missing required column headers. Book Name is required.`,
                errors: [`The sheet must contain a column for Book Name.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const existingBooks = await PriceBook.find({ companyId }).lean();
        const priceBookMap = new Map();
        existingBooks.forEach(pb => {
            if (pb.name) {
                priceBookMap.set(pb.name.trim().toLowerCase(), pb);
            }
        });

        const bulkOps = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const name = pickFirstNonEmpty(row['Book Name'], row.bookName, row['Name'], row['PriceBook Name'], row.name);
                
                if (!name) {
                    throw new Error('Book Name is required');
                }

                const rawType = pickFirstNonEmpty(row['Book Type'], row.bookType, row['Type'], row.type) || 'Standard';
                let type = 'Standard';
                const validTypes = ['Standard', 'Customer', 'Region', 'Dealer', 'Project', 'Contract', 'Promotional', 'Opportunity'];
                const matchedType = validTypes.find(t => t.toLowerCase() === rawType.toLowerCase());
                if (matchedType) {
                    type = matchedType;
                } else {
                    throw new Error(`Invalid Book Type: '${rawType}'. Must be one of: ${validTypes.join(', ')}`);
                }

                const priceBookData = {
                    name: name.trim(),
                    description: pickFirstNonEmpty(row['Description'], row.description) || '',
                    type: type,
                    targetId: pickFirstNonEmpty(row['Target ID'], row.targetId, row['TargetValue'], row.target) || '',
                    currency: pickFirstNonEmpty(row['Currency'], row.currency) || 'INR',
                    isActive: typeof row['Active'] !== 'undefined' ? toBoolean(row['Active']) : (typeof row['IsActive'] !== 'undefined' ? toBoolean(row['IsActive']) : true),
                    validFrom: row['Valid From'] || row.validFrom ? new Date(row['Valid From'] || row.validFrom) : null,
                    validTo: row['Valid To'] || row.validTo ? new Date(row['Valid To'] || row.validTo) : null,
                    companyId: companyId
                };

                const existing = priceBookMap.get(priceBookData.name.toLowerCase());
                if (existing) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: existing._id },
                            update: { $set: priceBookData }
                        }
                    });
                    results.updated++;
                } else {
                    bulkOps.push({
                        insertOne: {
                            document: priceBookData
                        }
                    });
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        if (bulkOps.length > 0) {
            await PriceBook.bulkWrite(bulkOps, { ordered: false });
        }

        res.json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            success: results.created + results.updated,
            created: results.created,
            updated: results.updated,
            failed: results.failed,
            skipped: results.skipped,
            errors: results.errors
        });
    } catch (error) {
        console.error('Import price books error:', error);
        res.status(500).json({ message: error.message || 'Error importing price books', errors: [error.message] });
    }
};

const getPriceBookTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Book Name': 'Standard Retail Price Book',
                'Description': 'Base retail price book for all customers',
                'Book Type': 'Standard',
                'Target ID': '',
                'Currency': 'INR',
                'Valid From': '2026-04-01',
                'Valid To': '2027-03-31',
                'Active': 'TRUE'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PriceBooks');

        worksheet['!cols'] = [
            { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=pricebook_import_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

// Price Book Items Imports
const importPriceBookItems = async (req, res) => {
    try {
        const { priceBookId } = req.params;
        if (!priceBookId) {
            return res.status(400).json({ message: 'Price Book ID is required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const priceBook = await PriceBook.findById(priceBookId);
        if (!priceBook) {
            return res.status(404).json({ message: 'Price Book not found' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasProductCode = cleanHeaders.some(h => [
            'product code', 'productcode', 'code'
        ].includes(h));
        
        const hasPrice = cleanHeaders.some(h => [
            'price', 'custom price', 'rate', 'customprice'
        ].includes(h));

        if (!hasProductCode || !hasPrice) {
            return res.status(400).json({
                message: `Missing required column headers. Product Code and Price are required.`,
                errors: [`The sheet must contain columns for Product Code and Price.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const allProducts = await Product.find({ companyId }).select('productCode productName').lean();
        const productCodeMap = new Map();
        allProducts.forEach(p => {
            if (p.productCode) {
                productCodeMap.set(p.productCode.trim().toLowerCase(), p);
            }
        });

        const existingItems = await PriceBookItem.find({ priceBookId }).lean();
        const existingItemsMap = new Map();
        existingItems.forEach(item => {
            existingItemsMap.set(item.productId.toString(), item);
        });

        const bulkOps = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const productCode = pickFirstNonEmpty(row['Product Code'], row.productCode, row['Code']);
                const priceVal = row['Price'] ?? row.price ?? row['Custom Price'] ?? row.rate ?? row.customPrice;

                if (!productCode) {
                    throw new Error('Product Code is required');
                }

                if (typeof priceVal === 'undefined' || priceVal === '') {
                    throw new Error('Price is required');
                }

                const parsedPrice = toSafeNumber(priceVal, -1);
                if (parsedPrice < 0) {
                    throw new Error(`Invalid price value: '${priceVal}'`);
                }

                const productObj = productCodeMap.get(productCode.trim().toLowerCase());
                if (!productObj) {
                    throw new Error(`Product with Code '${productCode}' not found`);
                }

                const itemData = {
                    priceBookId: priceBookId,
                    productId: productObj._id,
                    price: parsedPrice,
                    currency: pickFirstNonEmpty(row['Currency'], row.currency) || priceBook.currency || 'INR',
                    companyId: companyId
                };

                const existing = existingItemsMap.get(itemData.productId.toString());
                if (existing) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: existing._id },
                            update: { $set: itemData }
                        }
                    });
                    results.updated++;
                } else {
                    bulkOps.push({
                        insertOne: {
                            document: itemData
                        }
                    });
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        if (bulkOps.length > 0) {
            await PriceBookItem.bulkWrite(bulkOps, { ordered: false });
        }

        res.json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            success: results.created + results.updated,
            created: results.created,
            updated: results.updated,
            failed: results.failed,
            skipped: results.skipped,
            errors: results.errors
        });
    } catch (error) {
        console.error('Import price book items error:', error);
        res.status(500).json({ message: error.message || 'Error importing price book items', errors: [error.message] });
    }
};

const getPriceBookItemTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Product Code': 'PROD-001',
                'Product Name': 'Example Product (Info Only)',
                'Price': 1500,
                'Currency': 'INR'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rates');

        worksheet['!cols'] = [
            { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 }
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=pricebook_items_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

const importEmployees = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasEmployeeName = cleanHeaders.some(h => ['employee name', 'employeename', 'name'].includes(h));
        if (!hasEmployeeName) {
            return res.status(400).json({
                message: `Missing required column headers. Employee Name is required.`,
                errors: [`The sheet must contain a column for Employee Name.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const existingEmployees = await EmployeeProfile.find({ companyId }).lean();
        const employeeNameMap = new Map();
        existingEmployees.forEach(e => {
            if (e.name) {
                employeeNameMap.set(e.name.trim().toLowerCase(), e);
            }
        });

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const name = pickFirstNonEmpty(row['Employee Name'], row.employeeName, row['Name'], row.name);
                if (!name) {
                    throw new Error('Employee Name is required');
                }

                const email = pickFirstNonEmpty(row['Email'], row.email);
                const pan = pickFirstNonEmpty(row['PAN'], row.pan);
                const aadhaar = pickFirstNonEmpty(row['Aadhaar'], row.aadhaar);
                const uan = pickFirstNonEmpty(row['UAN'], row.uan);
                const pfNumber = pickFirstNonEmpty(row['PF Number'], row.pfNumber);
                const esiNumber = pickFirstNonEmpty(row['ESI Number'], row.esiNumber);
                const bankName = pickFirstNonEmpty(row['Bank Name'], row.bank);
                const accountNumber = pickFirstNonEmpty(row['Account Number'], row.account);
                const ifscCode = pickFirstNonEmpty(row['IFSC Code'], row.ifsc);
                const joiningDateStr = pickFirstNonEmpty(row['Joining Date'], row.joiningDate);
                const dobStr = pickFirstNonEmpty(row['DOB'], row.dob);
                const department = pickFirstNonEmpty(row['Department'], row.dept);
                const designation = pickFirstNonEmpty(row['Designation'], row.desig);
                const workerType = pickFirstNonEmpty(row['Worker Type'], row.workerType) || 'PERMANENT WORKER';
                const employeeType = pickFirstNonEmpty(row['Employee Type'], row.employeeType) || 'ONSITE';
                const status = pickFirstNonEmpty(row['Status'], row.status) || 'Active';

                const joiningDate = joiningDateStr ? new Date(joiningDateStr) : new Date();
                const dob = dobStr ? new Date(dobStr) : null;

                const basic = toSafeNumber(row['Basic Salary'] || row.basic, 0);
                const hra = toSafeNumber(row['HRA'] || row.hra, 0);
                const da = toSafeNumber(row['DA'] || row.da, 0);
                const specialAllowance = toSafeNumber(row['Special Allowance'] || row.specialAllowance, 0);

                const empData = {
                    name,
                    email,
                    pan,
                    aadhaar,
                    uan,
                    pfNumber,
                    esiNumber,
                    bankName,
                    accountNumber,
                    ifscCode,
                    joiningDate,
                    dob,
                    department,
                    designation,
                    workerType,
                    employeeType,
                    status,
                    salaryStructure: {
                        basic, hra, da, specialAllowance
                    },
                    companyId
                };

                const normalizedName = name.trim().toLowerCase();
                const matched = employeeNameMap.get(normalizedName);

                if (matched) {
                    await EmployeeProfile.findByIdAndUpdate(matched._id, empData);
                    results.updated++;
                } else {
                    await EmployeeProfile.create(empData);
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        // Auto-sync imported employees with designation "Service Engineer" to Engineers Master
        try {
            const { syncAllEngineers } = require('../services/engineerSyncService');
            await syncAllEngineers(companyId);
        } catch (syncErr) {
            console.error('Error auto-syncing engineers during import:', syncErr);
        }

        // Auto-sync user accounts for imported employees
        try {
            const { syncUsersForExistingEmployees } = require('../services/employeeUserService');
            await syncUsersForExistingEmployees(companyId);
        } catch (userSyncErr) {
            console.error('Error auto-syncing users during employee import:', userSyncErr);
        }

        res.json({
            message: `Import processed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            results
        });
    } catch (err) {
        console.error('Import employees error:', err);
        res.status(500).json({ message: 'Error processing employee import' });
    }
};

const getEmployeeTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Employee Name': 'John Doe',
                'Email': 'john.doe@example.com',
                'PAN': 'ABCDE1234F',
                'Aadhaar': '123456789012',
                'UAN': '100020003000',
                'PF Number': 'DL/CPM/12345/678',
                'ESI Number': '31000123450001010',
                'Bank Name': 'HDFC Bank',
                'Account Number': '50100123456789',
                'IFSC Code': 'HDFC0000123',
                'Joining Date': '2026-01-01',
                'DOB': '1990-05-15',
                'Department': 'Engineering',
                'Designation': 'Software Engineer',
                'Worker Type': 'PERMANENT WORKER',
                'Employee Type': 'ONSITE',
                'Status': 'Active',
                'Basic Salary': 30000,
                'HRA': 12000,
                'DA': 5000,
                'Special Allowance': 8000
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        Xcontent = XLSX.utils.book_append_sheet(wb, ws, 'Employees Template');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Employees_Import_Template.xlsx');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ message: 'Error generating employee import template' });
    }
};

const importContacts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasContactName = cleanHeaders.some(h => ['contact name', 'contactname', 'name'].includes(h));
        if (!hasContactName) {
            return res.status(400).json({
                message: `Missing required column headers. Contact Name is required.`,
                errors: [`The sheet must contain a column for Contact Name.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const existingContacts = await Contact.find({ companyId }).lean();
        const contactNameMap = new Map();
        existingContacts.forEach(c => {
            if (c.contactName) {
                contactNameMap.set(c.contactName.trim().toLowerCase(), c);
            }
        });

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const contactName = pickFirstNonEmpty(row['Contact Name'], row.contactName, row['Name'], row.name);
                if (!contactName) {
                    throw new Error('Contact Name is required');
                }

                const contactIdVal = pickFirstNonEmpty(row['Contact ID'], row.contactId) || '';
                const company = pickFirstNonEmpty(row['Company'], row.company) || '';
                const email = pickFirstNonEmpty(row['Email'], row.email) || '';
                const phone = pickFirstNonEmpty(row['Phone'], row.phone) || '';
                const designation = pickFirstNonEmpty(row['Designation'], row.designation) || '';
                const customerType = pickFirstNonEmpty(row['Customer Type'], row.customerType) || '';
                const notes = pickFirstNonEmpty(row['Notes'], row.notes) || '';

                const contactData = {
                    contactId: contactIdVal,
                    contactName,
                    company,
                    email,
                    phone,
                    designation,
                    customerType,
                    notes,
                    companyId
                };

                const normalizedName = contactName.trim().toLowerCase();
                const matched = contactNameMap.get(normalizedName);

                if (matched) {
                    await Contact.findByIdAndUpdate(matched._id, contactData);
                    results.updated++;
                } else {
                    await Contact.create(contactData);
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.json({
            message: `Import processed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            results
        });
    } catch (err) {
        console.error('Import contacts error:', err);
        res.status(500).json({ message: 'Error processing contact import' });
    }
};

const getContactTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Contact Name': 'Alice Smith',
                'Contact ID': 'CON-001',
                'Company': 'Acme Corporation',
                'Email': 'alice@example.com',
                'Phone': '9876543210',
                'Designation': 'Procurement Head',
                'Customer Type': 'Prospect',
                'Notes': 'Interested in cloud migrations'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts Template');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Contacts_Import_Template.xlsx');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ message: 'Error generating contact import template' });
    }
};

const importContracts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const cleanHeaders = headers.map(h => String(h || '').trim().toLowerCase());
        
        const hasContractNumber = cleanHeaders.some(h => ['contract number', 'contractnumber', 'contract no', 'contractno'].includes(h));
        if (!hasContractNumber) {
            return res.status(400).json({
                message: `Missing required column headers. Contract Number is required.`,
                errors: [`The sheet must contain a column for Contract Number.`]
            });
        }

        if (data.length === 0) {
            return res.status(400).json({ message: 'No data found in file' });
        }

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const existingContracts = await Contract.find({ companyId }).lean();
        const contractNumberMap = new Map();
        existingContracts.forEach(c => {
            if (c.contractNumber) {
                contractNumberMap.set(c.contractNumber.trim().toLowerCase(), c);
            }
        });

        const existingCustomers = await Customer.find({ companyId }).lean();
        const customerNameMap = new Map();
        existingCustomers.forEach(c => {
            if (c.companyName) {
                customerNameMap.set(c.companyName.trim().toLowerCase(), c);
            }
            if (c.customerName) {
                customerNameMap.set(c.customerName.trim().toLowerCase(), c);
            }
        });

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const contractNumber = pickFirstNonEmpty(row['Contract Number'], row.contractNumber, row['Contract No'], row.contractNo);
                if (!contractNumber) {
                    throw new Error('Contract Number is required');
                }

                const title = pickFirstNonEmpty(row['Title'], row.title, row['Name'], row.name) || `Contract ${contractNumber}`;
                const customerName = pickFirstNonEmpty(row['Customer'], row.customer, row['Company'], row.company);
                if (!customerName) {
                    throw new Error('Customer Name is required');
                }

                const customerMatched = customerNameMap.get(customerName.trim().toLowerCase());
                if (!customerMatched) {
                    throw new Error(`Customer "${customerName}" not found in database`);
                }

                const startDateStr = pickFirstNonEmpty(row['Start Date'], row.startDate);
                const endDateStr = pickFirstNonEmpty(row['End Date'], row.endDate);
                if (!startDateStr || !endDateStr) {
                    throw new Error('Start Date and End Date are required');
                }

                const value = toSafeNumber(row['Value'] || row.value, 0);
                const status = pickFirstNonEmpty(row['Status'], row.status) || 'Draft';
                const category = pickFirstNonEmpty(row['Category'], row.category) || 'Sales Agreement';
                const renewalRules = pickFirstNonEmpty(row['Renewal Rules'], row.renewalRules) || 'Auto-Renew annually';

                const contractData = {
                    contractNumber,
                    title,
                    customerId: customerMatched._id,
                    startDate: new Date(startDateStr),
                    endDate: new Date(endDateStr),
                    value,
                    status,
                    category,
                    renewalRules,
                    companyId
                };

                const normalizedNo = contractNumber.trim().toLowerCase();
                const matched = contractNumberMap.get(normalizedNo);

                if (matched) {
                    await Contract.findByIdAndUpdate(matched._id, contractData);
                    results.updated++;
                } else {
                    await Contract.create(contractData);
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.json({
            message: `Import processed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            results
        });
    } catch (err) {
        console.error('Import contracts error:', err);
        res.status(500).json({ message: 'Error processing contract import' });
    }
};

const getContractTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Contract Number': 'CON-2026-101',
                'Title': 'Annual Service Agreement',
                'Customer': 'Acme Corporation',
                'Start Date': '2026-01-01',
                'End Date': '2026-12-31',
                'Value': 500000,
                'Category': 'Sales Agreement',
                'Status': 'Draft',
                'Renewal Rules': 'Auto-Renew annually'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contracts Template');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Contracts_Import_Template.xlsx');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ message: 'Error generating contract import template' });
    }
};

const importTenders = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const results = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: []
        };

        const companyId = req.user?.companyId;

        const Tender = require('../models/Tender');
        const Department = require('../models/Department');
        const User = require('../models/User');

        const existingTenders = await Tender.find({ companyId }).lean();
        const tenderNoMap = new Map();
        existingTenders.forEach(t => {
            if (t.tenderNo) {
                tenderNoMap.set(t.tenderNo.trim().toLowerCase(), t);
            }
        });

        const existingCustomers = await Customer.find({ companyId }).lean();
        const customerNameMap = new Map();
        existingCustomers.forEach(c => {
            if (c.companyName) {
                customerNameMap.set(c.companyName.trim().toLowerCase(), c);
            }
            if (c.customerName) {
                customerNameMap.set(c.customerName.trim().toLowerCase(), c);
            }
        });

        const existingDepts = await Department.find({ companyId }).lean();
        const deptNameMap = new Map();
        existingDepts.forEach(d => {
            if (d.name) {
                deptNameMap.set(d.name.trim().toLowerCase(), d);
            }
        });

        const existingUsers = await User.find({ companyId }).lean();
        const userNameMap = new Map();
        const userEmailMap = new Map();
        existingUsers.forEach(u => {
            if (u.name) userNameMap.set(u.name.trim().toLowerCase(), u);
            if (u.email) userEmailMap.set(u.email.trim().toLowerCase(), u);
        });

        const generateTenderNumber = async (companyId) => {
            const Counter = require('../models/Counter');
            const year = new Date().getFullYear();
            const prefix = 'TND';
            const counter = await Counter.findOneAndUpdate(
                { type: 'tender', companyId: companyId || null, prefix, year },
                { $inc: { seq: 1 } },
                { new: true, upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
            const seqStr = counter.seq.toString().padStart(4, '0');
            return `${prefix}/${year}/${seqStr}`;
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const title = pickFirstNonEmpty(row['Tender Title'], row.title, row['Title'], row.name);
                if (!title) {
                    throw new Error('Tender Title is required');
                }

                const customerName = pickFirstNonEmpty(row['Client'], row.client, row['Customer'], row.customer, row['Company'], row.company);
                if (!customerName) {
                    throw new Error('Client / Customer Name is required');
                }

                const customerMatched = customerNameMap.get(customerName.trim().toLowerCase());
                if (!customerMatched) {
                    throw new Error(`Client "${customerName}" not found in database`);
                }

                const value = toSafeNumber(row['Value'] || row.value, 0);

                const deadlineDateStr = pickFirstNonEmpty(row['Deadline Date'], row.deadlineDate, row['Deadline'], row.deadline_date);
                if (!deadlineDateStr) {
                    throw new Error('Deadline Date is required');
                }
                const deadlineDate = new Date(deadlineDateStr);
                if (isNaN(deadlineDate.getTime())) {
                    throw new Error('Invalid Deadline Date format');
                }

                const submissionDateStr = pickFirstNonEmpty(row['Submission Date'], row.submissionDate, row['Submission'], row.submission_date);
                const submissionDate = submissionDateStr ? new Date(submissionDateStr) : undefined;
                if (submissionDate && isNaN(submissionDate.getTime())) {
                    throw new Error('Invalid Submission Date format');
                }

                const status = pickFirstNonEmpty(row['Status'], row.status) || 'Active';
                const description = pickFirstNonEmpty(row['Description'], row.description, row['Scope'], row.scope) || '';

                const deptName = pickFirstNonEmpty(row['Department'], row.department);
                let departmentId = undefined;
                if (deptName) {
                    const matchedDept = deptNameMap.get(deptName.trim().toLowerCase());
                    if (matchedDept) {
                        departmentId = matchedDept._id;
                    }
                }

                const ownerName = pickFirstNonEmpty(row['Owner'], row.owner, row['Assignee'], row.assignee);
                let ownerId = req.user?.id;
                if (ownerName) {
                    const matchedUser = userNameMap.get(ownerName.trim().toLowerCase()) || userEmailMap.get(ownerName.trim().toLowerCase());
                    if (matchedUser) {
                        ownerId = matchedUser._id;
                    }
                }

                let tenderNo = pickFirstNonEmpty(row['Tender Number'], row.tenderNo, row['Tender No'], row.tenderNo);
                
                const tenderData = {
                    title,
                    customerId: customerMatched._id,
                    value,
                    deadlineDate,
                    submissionDate,
                    status,
                    description,
                    departmentId,
                    ownerId,
                    companyId
                };

                let matchedTender = null;
                if (tenderNo) {
                    matchedTender = tenderNoMap.get(tenderNo.trim().toLowerCase());
                }

                if (matchedTender) {
                    const updatedActivities = [...(matchedTender.activities || []), {
                        userId: req.user?.id,
                        userName: req.user?.name || 'System',
                        action: 'Tender imported/updated via excel'
                    }];
                    await Tender.findByIdAndUpdate(matchedTender._id, {
                        ...tenderData,
                        activities: updatedActivities
                    });
                    results.updated++;
                } else {
                    if (!tenderNo) {
                        tenderNo = await generateTenderNumber(companyId);
                    }
                    await Tender.create({
                        ...tenderData,
                        tenderNo,
                        activities: [{
                            userId: req.user?.id,
                            userName: req.user?.name || 'System',
                            action: 'Tender imported/created via excel'
                        }]
                    });
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.json({
            message: `Import processed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            results
        });
    } catch (err) {
        console.error('Import tenders error:', err);
        res.status(500).json({ message: 'Error processing tender import' });
    }
};

const getTenderTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                'Tender Number': 'TND/2026/0001',
                'Tender Title': 'Gov ACC Smart Grid Upgrade',
                'Client': 'ACC Enterprises Pvt Ltd',
                'Value': 1500000,
                'Deadline Date': '2026-08-30',
                'Submission Date': '',
                'Status': 'Active',
                'Department': 'Accounts',
                'Owner': 'A Dixit',
                'Description': 'Tender for implementing smart grid sensors and control system updates.'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tenders Template');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Tenders_Import_Template.xlsx');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ message: 'Error generating tender import template' });
    }
};

module.exports = {
    importProducts,
    importCustomers,
    importPlanning,
    importAttributes,
    importAttributeMaster,
    getProductTemplate,
    getCustomerTemplate,
    getPlanningTemplate,
    getAttributeTemplate,
    getAttributeMasterTemplate,
    importWarranties,
    importAmcs,
    getWarrantyTemplate,
    getAmcTemplate,
    importTickets,
    getTicketTemplate,
    importVendors,
    getVendorTemplate,
    importPriceBooks,
    getPriceBookTemplate,
    importPriceBookItems,
    getPriceBookItemTemplate,
    importEmployees,
    getEmployeeTemplate,
    importContacts,
    getContactTemplate,
    importContracts,
    getContractTemplate,
    importTenders,
    getTenderTemplate
};
