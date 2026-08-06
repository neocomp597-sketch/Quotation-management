const VendorProductCatalog = require('../models/VendorProductCatalog');
const Vendor = require('../models/Vendor');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const getEffectiveVendorId = (req, targetVendorId) => {
    if (req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor') {
        return req.user?.vendorId ? String(req.user.vendorId) : null;
    }
    return targetVendorId || req.body?.vendorId || req.query?.vendorId || null;
};

exports.getVendorCatalog = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const vendorId = getEffectiveVendorId(req, req.query.vendorId);

        const query = { companyId };
        if (vendorId) {
            query.vendorId = vendorId;
        }

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { productName: searchRegex },
                { brand: searchRegex },
                { category: searchRegex },
                { description: searchRegex }
            ];
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        const total = await VendorProductCatalog.countDocuments(query);
        const products = await VendorProductCatalog.find(query)
            .populate('vendorId', 'name email phone contactPerson')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            success: true,
            data: products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('getVendorCatalog error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch vendor catalog' });
    }
};

exports.getVendorCatalogProductById = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const product = await VendorProductCatalog.findOne({ _id: req.params.id, companyId })
            .populate('vendorId', 'name email phone contactPerson')
            .lean();

        if (!product) {
            return res.status(404).json({ message: 'Catalog product not found' });
        }

        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser && req.user?.vendorId && String(product.vendorId._id || product.vendorId) !== String(req.user.vendorId)) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this vendor product' });
        }

        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to fetch product' });
    }
};

exports.createVendorCatalogProduct = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const vendorId = getEffectiveVendorId(req, req.body.vendorId);

        if (!vendorId) {
            return res.status(400).json({ message: 'Vendor ID is required for vendor catalog products' });
        }

        const vendorObj = await Vendor.findById(vendorId);
        if (!vendorObj) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const { productName, brand, category, description, specification, price, MOQ, UOM, images, productImageUrl, attachments, status } = req.body;

        if (!productName || !String(productName).trim()) {
            return res.status(400).json({ message: 'Product Name is required' });
        }

        const newProduct = await VendorProductCatalog.create({
            companyId,
            vendorId,
            productName: String(productName).trim(),
            brand: brand || '',
            category: category || '',
            description: description || '',
            specification: specification || '',
            price: Number(price) || 0,
            MOQ: Number(MOQ) || 1,
            UOM: UOM || 'Nos',
            images: Array.isArray(images) ? images : [],
            productImageUrl: productImageUrl || (Array.isArray(images) && images[0]) || '',
            attachments: Array.isArray(attachments) ? attachments : [],
            status: status || 'Active',
            createdBy: req.user?.id || null
        });

        res.status(201).json({ success: true, message: 'Product added to Vendor Catalog successfully', data: newProduct });
    } catch (error) {
        console.error('createVendorCatalogProduct error:', error);
        res.status(500).json({ message: error.message || 'Failed to create vendor catalog product' });
    }
};

exports.updateVendorCatalogProduct = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const existing = await VendorProductCatalog.findOne({ _id: req.params.id, companyId });

        if (!existing) {
            return res.status(404).json({ message: 'Catalog product not found' });
        }

        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser && req.user?.vendorId && String(existing.vendorId) !== String(req.user.vendorId)) {
            return res.status(403).json({ message: 'Forbidden: You cannot modify products belonging to another vendor' });
        }

        const fields = ['productName', 'brand', 'category', 'description', 'specification', 'price', 'MOQ', 'UOM', 'images', 'productImageUrl', 'attachments', 'status'];
        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                existing[field] = req.body[field];
            }
        });

        await existing.save();
        res.json({ success: true, message: 'Vendor catalog product updated successfully', data: existing });
    } catch (error) {
        console.error('updateVendorCatalogProduct error:', error);
        res.status(500).json({ message: error.message || 'Failed to update vendor catalog product' });
    }
};

exports.deleteVendorCatalogProduct = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const existing = await VendorProductCatalog.findOne({ _id: req.params.id, companyId });

        if (!existing) {
            return res.status(404).json({ message: 'Catalog product not found' });
        }

        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser && req.user?.vendorId && String(existing.vendorId) !== String(req.user.vendorId)) {
            return res.status(403).json({ message: 'Forbidden: You cannot delete products belonging to another vendor' });
        }

        await VendorProductCatalog.deleteOne({ _id: existing._id });
        res.json({ success: true, message: 'Product removed from Vendor Catalog' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to delete vendor catalog product' });
    }
};

exports.importVendorCatalog = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

        const companyId = req.user?.companyId;
        const targetVendorId = getEffectiveVendorId(req, req.body?.vendorId || req.query?.vendorId);

        if (!targetVendorId) {
            return res.status(400).json({ message: 'Vendor ID is required for catalog import' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rows.length) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const results = { created: 0, updated: 0, failed: 0, errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const productName = String(row['Product Name'] || row.productName || row.name || '').trim();
                if (!productName) {
                    results.failed++;
                    results.errors.push(`Row ${i + 2}: Product Name missing`);
                    continue;
                }

                const brand = String(row['Brand'] || row.brand || '').trim();
                const category = String(row['Category'] || row.category || '').trim();
                const description = String(row['Description'] || row.description || '').trim();
                const specification = String(row['Specification'] || row.specification || row.specs || '').trim();
                const price = Number(row['Price'] || row.price || row.rate || 0);
                const MOQ = Number(row['MOQ'] || row.moq || 1);
                const UOM = String(row['UOM'] || row.uom || row.unit || 'Nos').trim();
                const status = String(row['Status'] || row.status || 'Active').trim();

                const existing = await VendorProductCatalog.findOne({
                    companyId,
                    vendorId: targetVendorId,
                    productName: new RegExp(`^${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
                });

                if (existing) {
                    existing.brand = brand || existing.brand;
                    existing.category = category || existing.category;
                    existing.description = description || existing.description;
                    existing.specification = specification || existing.specification;
                    existing.price = price >= 0 ? price : existing.price;
                    existing.MOQ = MOQ > 0 ? MOQ : existing.MOQ;
                    existing.UOM = UOM || existing.UOM;
                    existing.status = ['Active', 'Inactive', 'Discontinued'].includes(status) ? status : existing.status;
                    await existing.save();
                    results.updated++;
                } else {
                    await VendorProductCatalog.create({
                        companyId,
                        vendorId: targetVendorId,
                        productName,
                        brand,
                        category,
                        description,
                        specification,
                        price,
                        MOQ,
                        UOM,
                        status: ['Active', 'Inactive', 'Discontinued'].includes(status) ? status : 'Active',
                        createdBy: req.user?.id || null
                    });
                    results.created++;
                }
            } catch (rErr) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${rErr.message}`);
            }
        }

        res.json({
            success: true,
            message: `Catalog imported: ${results.created} created, ${results.updated} updated, ${results.failed} failed.`,
            results
        });
    } catch (error) {
        console.error('importVendorCatalog error:', error);
        res.status(500).json({ message: error.message || 'Failed to import vendor catalog' });
    }
};
