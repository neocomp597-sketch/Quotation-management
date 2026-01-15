const XLSX = require('xlsx');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

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
                const productData = {
                    productCode: row['Product Code'] || row['productCode'] || row['Code'],
                    productName: row['Product Name'] || row['productName'] || row['Name'],
                    hsnCode: row['HSN Code'] || row['hsnCode'] || row['HSN'],
                    gstPercentage: parseFloat(row['GST %'] || row['gstPercentage'] || row['GST'] || 18),
                    basePrice: parseFloat(row['Base Price'] || row['basePrice'] || row['Price'] || 0),
                    mrp: parseFloat(row['MRP'] || row['mrp'] || 0),
                    uom: row['UOM'] || row['uom'] || row['Unit'] || 'Nos',
                    productImageUrl: row['Image URL'] || row['productImageUrl'] || '',
                    status: row['Status'] || row['status'] || 'Active'
                };

                // Validate required fields
                if (!productData.productCode || !productData.productName || !productData.hsnCode) {
                    throw new Error('Missing required fields: Product Code, Product Name, or HSN Code');
                }

                // Check if product already exists
                const existing = await Product.findOne({ productCode: productData.productCode });
                if (existing) {
                    // Update existing product
                    await Product.findByIdAndUpdate(existing._id, productData);
                } else {
                    // Create new product
                    await Product.create(productData);
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
            { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 10 }
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

module.exports = {
    importProducts,
    importCustomers,
    getProductTemplate,
    getCustomerTemplate
};
