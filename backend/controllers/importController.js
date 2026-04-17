const XLSX = require('xlsx');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const ProductAttribute = require('../models/ProductAttribute');
const Attribute = require('../models/Attribute');
const MGR = require('../models/MGR');
const Vendor = require('../models/Vendor');
const { deriveBasePriceFromVendors } = require('../utils/vendorSelection');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase().trim());
    return false;
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
                    customerName: row['Customer Name'] || row['customerName'] || row['Name'],
                    companyName: row['Company Name'] || row['companyName'] || row['Company'],
                    gstin: row['GSTIN'] || row['gstin'] || row['GST No'],
                    mobile: row['Mobile'] || row['mobile'] || row['Phone'] || '',
                    email: row['Email'] || row['email'] || '',
                    logoUrl: row['Logo URL'] || row['logoUrl'] || '',
                    defaultDiscount: parseFloat(row['Default Discount'] || row['defaultDiscount'] || row['Discount'] || 0),
                    billingAddress: {
                        line1: row['Billing Address Line 1'] || row['Address Line 1'] || '',
                        line2: row['Billing Address Line 2'] || row['Address Line 2'] || '',
                        city: row['City'] || row['Billing City'] || '',
                        state: row['State'] || row['Billing State'] || '',
                        pincode: row['Pincode'] || row['Billing Pincode'] || ''
                    },
                    shippingAddress: {
                        line1: row['Shipping Address Line 1'] || row['Billing Address Line 1'] || row['Address Line 1'] || '',
                        line2: row['Shipping Address Line 2'] || row['Billing Address Line 2'] || row['Address Line 2'] || '',
                        city: row['Shipping City'] || row['City'] || '',
                        state: row['Shipping State'] || row['State'] || '',
                        pincode: row['Shipping Pincode'] || row['Pincode'] || ''
                    },
                    createdBy: req.user ? req.user.id : null
                };

                // Validate required fields
                if (!customerData.customerName || !customerData.companyName || !customerData.gstin) {
                    throw new Error('Missing required fields: Customer Name, Company Name, or GSTIN');
                }

                // Check if customer already exists by GSTIN
                const existing = await Customer.findOne({ gstin: customerData.gstin });
                if (existing) {
                    // Update existing customer
                    await Customer.findByIdAndUpdate(existing._id, customerData);
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
                'Customer Name': 'John Doe',
                'Company Name': 'ABC Enterprises',
                'GSTIN': '27AABCU9603R1ZM',
                'Mobile': '9876543210',
                'Email': 'john@abc.com',
                'Billing Address Line 1': '123 Main Street',
                'Billing Address Line 2': 'Near Park',
                'City': 'Mumbai',
                'State': 'Maharashtra',
                'Pincode': '400001',
                'Default Discount': 5,
                'Logo URL': ''
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 15 }, { wch: 40 }
        ];

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
    importAttributes,
    importAttributeMaster,
    getProductTemplate,
    getCustomerTemplate,
    getAttributeTemplate,
    getAttributeMasterTemplate
};

