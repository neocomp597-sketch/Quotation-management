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
const { deriveBasePriceFromVendors } = require('../utils/vendorSelection');
const { invalidateCustomerCaches, invalidateProductCaches } = require('../utils/cacheInvalidation');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase().trim());
    return false;
};
const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const PLANNING_STATUS_OPTIONS = ['Budget', 'Firm', 'MFC', 'B & B', 'Others', 'Order Received', 'Invoice', 'Lost', 'Parked'];
const cleanCellValue = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeKey = (value = '') => cleanCellValue(value).toUpperCase();
const buildExactRegex = (value = '') => new RegExp(`^${escapeRegex(cleanCellValue(value))}$`, 'i');
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
        const hasHsnCode = cleanHeaders.some(h => ['hsn code', 'hsncode', 'hsn'].includes(h));
        
        const missingHeaders = [];
        if (!hasProductCode) missingHeaders.push('Product Code');
        if (!hasProductName) missingHeaders.push('Product Name');
        if (!hasHsnCode) missingHeaders.push('HSN Code');
        
        if (missingHeaders.length > 0) {
            return res.status(400).json({
                message: `Missing required column headers: ${missingHeaders.join(', ')}`,
                errors: [`The sheet must contain these column headers: ${missingHeaders.join(', ')}`]
            });
        }

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
                const productCode = pickFirstNonEmpty(row['Product Code'], row.productCode, row.code, row.Code);
                const productName = pickFirstNonEmpty(row['Product Name'], row.productName, row.name, row.Name);
                const hsnCode = pickFirstNonEmpty(row['HSN Code'], row.hsnCode, row.hsn, row.Hsn);
                const gstPercentage = toSafeNumber(row['GST %'] ?? row['GST Percentage'] ?? row.gstPercentage ?? row.gst, 18);
                const basePrice = toSafeNumber(row['Base Price'] ?? row.basePrice ?? row.price, 0);
                const mrp = toSafeNumber(row.MRP ?? row.mrp ?? row['M.R.P.'], 0);
                const uom = pickFirstNonEmpty(row.UOM ?? row.uom ?? row.Unit ?? row.unit, 'Nos');
                const productImageUrl = pickFirstNonEmpty(row['Image URL'] ?? row.productImageUrl ?? row.imageUrl ?? row.image, '');
                const status = pickFirstNonEmpty(row.Status ?? row.status, 'Active');

                if (!productCode || !productName || !hsnCode) {
                    throw new Error('Missing required fields: Product Code, Product Name, or HSN Code');
                }

                let existing = await Product.findOne({ productCode: buildExactRegex(productCode) });
                
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

                const vendorName = pickFirstNonEmpty(row['Vendor Name'] ?? row.vendorName);
                const vendorPrice = toSafeNumber(row['Vendor Price'] ?? row.vendorPrice);
                const vendorStock = toSafeNumber(row['Vendor Stock'] ?? row.vendorStock ?? row.stock);
                const isPrimary = toBoolean(row['Is Primary'] ?? row.isPrimary ?? true);

                if (vendorName) {
                    const vendorObj = await Vendor.findOne({ vendorName: buildExactRegex(vendorName) });
                    if (vendorObj) {
                        productData.vendors = [{
                            vendorId: vendorObj._id,
                            price: vendorPrice || basePrice,
                            stock: vendorStock,
                            isPrimary
                        }];
                    }
                }

                if (existing) {
                    await Product.findByIdAndUpdate(existing._id, productData);
                } else {
                    await Product.create(productData);
                }
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        await invalidateProductCaches();

        if (results.success > 0) {
            const { createCompanyNotifications } = require('../utils/notificationHelper');
            await createCompanyNotifications({
                companyId: req.user?.companyId,
                title: 'Products Master Imported',
                message: `Successfully imported/updated ${results.success} products (failed: ${results.failed}).`,
                type: 'Reminder',
                excludeUserId: req.user?.id
            });
        }

        if (results.success === 0 && results.failed > 0) {
            return res.status(400).json({
                message: 'All rows failed to import',
                errors: results.errors,
                ...results
            });
        }

        res.status(200).json({
            message: `Import completed. ${results.success} products imported, ${results.failed} failed.`,
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
            success: 0,
            failed: 0,
            errors: []
        };

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
                    companyId: req.user?.companyId,
                    createdBy: req.user ? req.user.id : null
                };

                if (!customerData.customerName || !customerData.companyName) {
                    throw new Error('Missing required fields: Customer Name or Company Name');
                }

                let existing = null;
                if (customerData.externalCode) {
                    existing = await Customer.findOne({
                        externalCode: buildExactRegex(customerData.externalCode)
                    });
                }

                if (!existing && customerData.gstin) {
                    existing = await Customer.findOne({ gstin: customerData.gstin });
                }

                if (!existing) {
                    existing = await Customer.findOne({
                        companyName: customerData.companyName,
                        customerName: customerData.customerName
                    });
                }

                if (existing) {
                    await Customer.findByIdAndUpdate(existing._id, {
                        ...customerData,
                        createdBy: req.user?.id || existing.createdBy || null
                    });
                } else {
                    await Customer.create(customerData);
                }
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        await invalidateCustomerCaches();

        if (results.success > 0) {
            const { createCompanyNotifications } = require('../utils/notificationHelper');
            await createCompanyNotifications({
                companyId: req.user?.companyId,
                title: 'Customers Master Imported',
                message: `Successfully imported/updated ${results.success} customers (failed: ${results.failed}).`,
                type: 'Reminder',
                excludeUserId: req.user?.id
            });
        }

        if (results.success === 0 && results.failed > 0) {
            return res.status(400).json({
                message: 'All rows failed to import',
                errors: results.errors,
                ...results
            });
        }

        res.status(200).json({
            message: `Import completed. ${results.success} customers imported, ${results.failed} failed.`,
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

        // Check for missing codes
        const missingCustomerCodes = customerLookups.filter(code => !customerMap.has(normalizeKey(code)));
        const missingProductCodes = productLookups.filter(code => !productMap.has(normalizeKey(code)));
        const missingMgr1Codes = mgr1Lookups.filter(code => !mgr1Map.has(normalizeKey(code)));
        const missingMgr2Codes = mgr2Lookups.filter(code => !mgr2Map.has(normalizeKey(code)));

        if (missingCustomerCodes.length > 0 || missingProductCodes.length > 0 || missingMgr1Codes.length > 0 || missingMgr2Codes.length > 0) {
            const uploadDir = path.join(__dirname, '..', 'uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            if (missingCustomerCodes.length > 0) {
                const custFilePath = path.join(uploadDir, 'missing_customer_codes.txt');
                fs.writeFileSync(custFilePath, missingCustomerCodes.join('\n'), 'utf8');
            }

            if (missingProductCodes.length > 0) {
                const prodFilePath = path.join(uploadDir, 'missing_product_codes.txt');
                fs.writeFileSync(prodFilePath, missingProductCodes.join('\n'), 'utf8');
            }

            if (missingMgr1Codes.length > 0) {
                const mgr1FilePath = path.join(uploadDir, 'missing_mgr1_codes.txt');
                fs.writeFileSync(mgr1FilePath, missingMgr1Codes.join('\n'), 'utf8');
            }

            if (missingMgr2Codes.length > 0) {
                const mgr2FilePath = path.join(uploadDir, 'missing_mgr2_codes.txt');
                fs.writeFileSync(mgr2FilePath, missingMgr2Codes.join('\n'), 'utf8');
            }

            return res.status(400).json({
                message: 'Validation failed. Missing codes found.',
                missingCustomerCodes,
                missingProductCodes,
                missingMgr1Codes,
                missingMgr2Codes
            });
        }

        // PHASE 3: Parse and prepare bulk operations
        const results = {
            success: 0,
            failed: 0,
            errors: [],
            processed: 0,
            total: data.length
        };

        const bulkOps = [];
        const BATCH_SIZE = 1000;


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

                // Use cached lookups
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

                const planningData = {
                    financialYear,
                    monthYear: monthInfo.monthYear,
                    month: monthInfo.month,
                    customerId: customer._id,
                    customerName: customer.companyName || customer.customerName,
                    productId: product._id,
                    productName: product.productName,
                    qty,
                    value,
                    totalValue: qty * value,
                    mgrCode: mgr1.code,
                    mgrCode2: mgr2?.code || '',
                    status,
                    createdBy: req.user?.id || null
                };

                // Use updateOne with upsert for bulk operation
                bulkOps.push({
                    updateOne: {
                        filter: {
                            financialYear,
                            monthYear: monthInfo.monthYear,
                            customerId: customer._id,
                            productId: product._id,
                            mgrCode: mgr1.code,
                            mgrCode2: mgr2?.code || '',
                            status
                        },
                        update: {
                            $set: planningData
                        },
                        upsert: true
                    }
                });

                results.success++;

                // Execute bulk operations in batches
                if (bulkOps.length >= BATCH_SIZE || i === data.length - 1) {
                    if (bulkOps.length > 0) {
                        await Planning.bulkWrite(bulkOps, { ordered: false });
                        bulkOps.length = 0;
                    }
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
                
                // Still track in bulk to maintain consistency
                if (bulkOps.length >= BATCH_SIZE) {
                    if (bulkOps.length > 0) {
                        await Planning.bulkWrite(bulkOps, { ordered: false });
                        bulkOps.length = 0;
                    }
                }
            }
        }

        // Trigger notification
        if (results.success > 0) {
            const { createCompanyNotifications } = require('../utils/notificationHelper');
            await createCompanyNotifications({
                companyId: req.user?.companyId,
                title: 'Planning Entries Imported',
                message: `Successfully imported ${results.success} planning entries for FY ${selectedFinancialYear} (failed: ${results.failed}).`,
                type: 'Planning',
                excludeUserId: req.user?.id
            });
        }

        if (results.success === 0 && results.failed > 0) {
            return res.status(400).json({
                message: 'All rows failed to import',
                errors: results.errors,
                ...results
            });
        }

        res.status(200).json({
            message: `Import completed. ${results.success} planning entries imported, ${results.failed} failed.`,
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
    getAmcTemplate
};
