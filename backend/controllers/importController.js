const XLSX = require('xlsx');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const ProductAttribute = require('../models/ProductAttribute');
const Attribute = require('../models/Attribute');
const MGR = require('../models/MGR');
const Vendor = require('../models/Vendor');
const Planning = require('../models/Planning');
const { deriveBasePriceFromVendors } = require('../utils/vendorSelection');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase().trim());
    return false;
};
const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const PLANNING_STATUS_OPTIONS = ['Firm', 'MFC', 'B & B', 'Others', 'Order Received', 'Invoice', 'Lost', 'Parked'];
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

const getPlanningMonthLabels = (financialYear) => {
    if (!/^\d{4}-\d{2}$/.test(financialYear)) {
        throw new Error('Financial Year must be in the format 2025-26');
    }

    const startYear = parseInt(financialYear.split('-')[0], 10);
    return FY_MONTHS.map((month, idx) => {
        const year = idx < 9 ? startYear : startYear + 1;
        return `${month}-${year.toString().slice(-2)}`;
    });
};

const resolvePlanningMonth = (financialYear, monthYear) => {
    const cleanedMonthYear = cleanCellValue(monthYear);
    const validMonthLabels = getPlanningMonthLabels(financialYear);
    const monthIndex = validMonthLabels.findIndex((label) => normalizeKey(label) === normalizeKey(cleanedMonthYear));

    if (monthIndex === -1) {
        throw new Error(`Month & Year must match FY ${financialYear} (example: ${validMonthLabels[0]})`);
    }

    return monthIndex + 1;
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

// Import Products from Excel/CSV
const importProducts = async (req, res) => {
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
                // Map columns (case-insensitive)
                const uomMap = {
                    1: 'PCS',
                    2: 'KG',
                    3: 'LTR',
                    4: 'BOX',
                    5: 'MTR'
                };
                let rawUom = row['UOM'] || row['uom'] || row['Unit'];
                let parsedUom = uomMap[rawUom] || rawUom || 'Nos';

                const productData = {
                    productCode: row['Product Code'] || row['productCode'] || row['Code'],
                    productName: row['Product Name'] || row['productName'] || row['Name'],
                    hsnCode: row['HSN Code'] || row['hsnCode'] || row['HSN'],
                    gstPercentage: parseFloat(row['GST %'] || row['gstPercentage'] || row['GST'] || 18),
                    basePrice: parseFloat(row['Base Price'] || row['basePrice'] || row['Price'] || 0),
                    mrp: parseFloat(row['MRP'] || row['mrp'] || 0),
                    uom: String(parsedUom).trim(),
                    productImageUrl: row['Image URL'] || row['productImageUrl'] || '',
                    status: row['Status'] || row['status'] || 'Active'
                };

                const vendorName = row['Vendor Name'] || row['vendorName'] || row['Vendor'];
                const vendorPriceRaw = row['Vendor Price'] || row['vendorPrice'];
                const vendorStockRaw = row['Vendor Stock'] || row['vendorStock'];
                const primaryRaw = row['Is Primary'] || row['isPrimary'] || row['Primary Vendor'];
                const hasVendorData = Boolean(vendorName || vendorPriceRaw || vendorStockRaw || typeof primaryRaw !== 'undefined');

                // Validate required fields
                if (!productData.productCode || !productData.productName || !productData.hsnCode) {
                    throw new Error('Missing required fields: Product Code, Product Name, or HSN Code');
                }

                let vendorEntry = null;
                if (hasVendorData) {
                    if (!vendorName || !String(vendorName).trim()) {
                        throw new Error('Vendor Name is required when vendor fields are provided');
                    }

                    const normalizedVendorName = String(vendorName).trim();
                    let vendor = await Vendor.findOne({
                        name: { $regex: `^${escapeRegex(normalizedVendorName)}$`, $options: 'i' }
                    });

                    if (!vendor) {
                        const autoCreateVendor = String(req.query.autoCreateVendor || 'true').toLowerCase() !== 'false';
                        if (!autoCreateVendor) {
                            throw new Error(`Vendor not found: ${normalizedVendorName}`);
                        }
                        vendor = await Vendor.create({ name: normalizedVendorName, isActive: true });
                    }

                    if (!vendor.isActive) {
                        throw new Error(`Vendor is inactive: ${vendor.name}`);
                    }

                    const vendorPrice = parseFloat(vendorPriceRaw || productData.basePrice || 0);
                    const vendorStock = parseFloat(vendorStockRaw || 0);
                    const isPrimary = toBoolean(primaryRaw);

                    if (!(vendorPrice > 0)) {
                        throw new Error('Vendor Price must be greater than zero');
                    }
                    if (vendorStock < 0) {
                        throw new Error('Vendor Stock cannot be negative');
                    }

                    vendorEntry = {
                        vendorId: vendor._id,
                        price: vendorPrice,
                        stock: vendorStock,
                        isPrimary,
                        lastUpdated: new Date()
                    };
                }

                // Check if product already exists
                const existing = await Product.findOne({ productCode: productData.productCode });
                if (existing) {
                    const updatePayload = { ...productData };
                    if (vendorEntry) {
                        const mergedVendors = (existing.vendors || []).map((entry) => ({
                            vendorId: entry.vendorId,
                            price: Number(entry.price),
                            stock: Number(entry.stock),
                            isPrimary: Boolean(entry.isPrimary),
                            lastUpdated: entry.lastUpdated || new Date()
                        }));

                        const idx = mergedVendors.findIndex(v => String(v.vendorId) === String(vendorEntry.vendorId));
                        if (idx === -1) {
                            mergedVendors.push(vendorEntry);
                        } else {
                            mergedVendors[idx] = { ...mergedVendors[idx], ...vendorEntry };
                        }

                        if (vendorEntry.isPrimary) {
                            const effectiveIndex = idx === -1 ? mergedVendors.length - 1 : idx;
                            mergedVendors.forEach((v) => {
                                v.isPrimary = false;
                            });
                            mergedVendors[effectiveIndex].isPrimary = true;
                        }
                        if (!mergedVendors.some(v => v.isPrimary)) {
                            mergedVendors[0].isPrimary = true;
                        }

                        updatePayload.vendors = mergedVendors;
                        updatePayload.basePrice = deriveBasePriceFromVendors({
                            vendors: mergedVendors,
                            basePrice: productData.basePrice
                        });
                    }
                    await Product.findByIdAndUpdate(existing._id, updatePayload, { runValidators: true });
                } else {
                    const createPayload = { ...productData };
                    if (vendorEntry) {
                        createPayload.vendors = [vendorEntry];
                        createPayload.basePrice = deriveBasePriceFromVendors(createPayload);
                    }
                    await Product.create(createPayload);
                }
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Import completed. ${results.success} products imported, ${results.failed} failed.`,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing products' });
    }
};

// Import Customers from Excel/CSV
const importCustomers = async (req, res) => {
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
                // Map columns (case-insensitive)
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
                    createdBy: req.user ? req.user.id : null
                };

                // Validate required fields
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
                    // Update existing customer
                    await Customer.findByIdAndUpdate(existing._id, {
                        ...customerData,
                        createdBy: req.user?.id || existing.createdBy || null
                    });
                } else {
                    // Create new customer
                    await Customer.create(customerData);
                }
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Import completed. ${results.success} customers imported, ${results.failed} failed.`,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing customers' });
    }
};

// Import Planning entries from Excel/CSV
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

        const selectedFinancialYear = cleanCellValue(req.body.financialYear || req.query.financialYear);

        const uniqueCustomerCodes = new Set();
        const uniqueProductCodes = new Set();

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const customerLookup = cleanCellValue(
                row['Customer Code'] || row['customerCode'] || row['Customer Name'] || row.customerName || row['Company Name'] || row.companyName
            );
            const productLookup = cleanCellValue(
                row['Product Code'] || row['productCode'] || row['Product Name'] || row.productName
            );
            if (customerLookup) uniqueCustomerCodes.add(customerLookup);
            if (productLookup) uniqueProductCodes.add(productLookup);
        }

        const missingCustomerCodes = [];
        const missingProductCodes = [];

        for (const custCode of uniqueCustomerCodes) {
            const existing = await findCustomerByLookup(custCode);
            if (!existing) {
                missingCustomerCodes.push(custCode);
            }
        }

        for (const prodCode of uniqueProductCodes) {
            const existing = await Product.findOne({
                productCode: { $regex: buildExactRegex(prodCode) }
            });
            if (!existing) {
                missingProductCodes.push(prodCode);
            }
        }

        if (missingCustomerCodes.length > 0 || missingProductCodes.length > 0) {
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

            return res.status(400).json({
                message: 'Validation failed. Missing customer and/or product codes found.',
                missingCustomerCodes,
                missingProductCodes,
                missingCustomerCodesFile: missingCustomerCodes.length > 0 ? 'missing_customer_codes.txt' : null,
                missingProductCodesFile: missingProductCodes.length > 0 ? 'missing_product_codes.txt' : null
            });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            try {
                const financialYear = cleanCellValue(
                    row['Financial Year'] || row.financialYear || row.FY || selectedFinancialYear
                );
                const monthYear = cleanCellValue(
                    row['Month & Year'] || row.monthYear || row.Month || row.month
                );
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

                const month = resolvePlanningMonth(financialYear, monthYear);

                const customer = await findCustomerByLookup(customerLookup);
                if (!customer) {
                    throw new Error(`Customer code not found: ${customerLookup}`);
                }

                let product = await Product.findOne({
                    productCode: { $regex: buildExactRegex(productLookup) }
                });
                if (!product) {
                    throw new Error(`Product code not found: ${productLookup}`);
                }

                const mgr1 = await MGR.findOne({
                    mgrType: 'MGR1',
                    code: { $regex: buildExactRegex(mgrCodeInput) }
                });
                if (!mgr1) {
                    throw new Error(`MGR 1 not found: ${mgrCodeInput}`);
                }

                let mgr2 = null;
                if (mgrCode2Input) {
                    mgr2 = await MGR.findOne({
                        mgrType: 'MGR2',
                        code: { $regex: buildExactRegex(mgrCode2Input) }
                    });
                    if (!mgr2) {
                        throw new Error(`MGR 2 not found: ${mgrCode2Input}`);
                    }
                }

                const planningData = {
                    financialYear,
                    monthYear,
                    month,
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

                const existing = await Planning.findOne({
                    financialYear,
                    monthYear,
                    customerId: customer._id,
                    productId: product._id,
                    mgrCode: mgr1.code,
                    mgrCode2: mgr2?.code || '',
                    status
                });

                if (existing) {
                    await Planning.findByIdAndUpdate(existing._id, planningData, { runValidators: true });
                } else {
                    await Planning.create(planningData);
                }

                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        res.status(200).json({
            message: `Import completed. ${results.success} planning entries imported, ${results.failed} failed.`,
            ...results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: error.message || 'Error importing planning entries' });
    }
};

// Generate Planning Template
const getPlanningTemplate = async (req, res) => {
    try {
        const financialYear = cleanCellValue(req.query.financialYear) || getCurrentFinancialYear();
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
    getAttributeMasterTemplate
};

