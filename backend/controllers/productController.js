const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const {
    sortVendorsByPriority,
    getBestVendorForProduct,
    deriveBasePriceFromVendors,
    isVendorActive
} = require('../utils/vendorSelection');

const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
};

const statusForProductError = (error) => {
    if (!error) return 500;
    if (error.name === 'ValidationError') return 400;
    const message = String(error.message || '').toLowerCase();
    if (
        message.includes('vendor') ||
        message.includes('price') ||
        message.includes('stock') ||
        message.includes('primary') ||
        message.includes('required') ||
        message.includes('must')
    ) {
        return 400;
    }
    return 500;
};

const normalizeVendorEntries = (vendors = []) => {
    return (vendors || []).map((entry) => ({
        vendorId: entry.vendorId?._id || entry.vendorId,
        price: Number(entry.price),
        stock: Number(entry.stock),
        isPrimary: toBoolean(entry.isPrimary),
        lastUpdated: entry.lastUpdated ? new Date(entry.lastUpdated) : new Date()
    }));
};

const validateAndPrepareVendors = async (vendors = [], options = {}) => {
    const { allowEmpty = true } = options;
    if (!Array.isArray(vendors)) {
        throw new Error('Vendors must be an array');
    }

    if (!vendors.length) {
        if (!allowEmpty) {
            throw new Error('At least one vendor is required');
        }
        return [];
    }

    const normalized = normalizeVendorEntries(vendors);
    const uniqueIds = new Set();
    let primaryCount = 0;

    normalized.forEach((entry) => {
        if (!entry.vendorId) {
            throw new Error('Each vendor mapping must include vendorId');
        }
        const stringVendorId = String(entry.vendorId);
        if (uniqueIds.has(stringVendorId)) {
            throw new Error('Same vendor cannot be added more than once for a product');
        }
        uniqueIds.add(stringVendorId);

        if (!(entry.price > 0)) {
            throw new Error('Vendor price must be greater than zero');
        }
        if (entry.stock < 0) {
            throw new Error('Vendor stock cannot be negative');
        }
        if (entry.isPrimary) primaryCount += 1;
    });

    if (primaryCount > 1) {
        throw new Error('Only one vendor can be marked as primary');
    }

    const vendorIds = normalized.map((v) => v.vendorId);
    const vendorsInDb = await Vendor.find({ _id: { $in: vendorIds } }).select('_id isActive name');
    const vendorMap = new Map(vendorsInDb.map((v) => [String(v._id), v]));

    normalized.forEach((entry) => {
        const vendor = vendorMap.get(String(entry.vendorId));
        if (!vendor) {
            throw new Error(`Vendor not found: ${entry.vendorId}`);
        }
        if (!vendor.isActive) {
            throw new Error(`Inactive vendor cannot be assigned: ${vendor.name}`);
        }
    });

    if (!normalized.some((entry) => entry.isPrimary)) {
        normalized[0].isPrimary = true;
    }

    return normalized;
};

const buildProductResponse = (productDoc) => {
    const product = productDoc.toObject ? productDoc.toObject() : { ...productDoc };
    const sortedVendors = sortVendorsByPriority(product.vendors || []);
    const bestVendor = getBestVendorForProduct({ ...product, vendors: sortedVendors });
    const derivedBasePrice = deriveBasePriceFromVendors({ ...product, vendors: sortedVendors });

    product.vendors = sortedVendors;
    product.bestVendor = bestVendor;
    product.inStock = Boolean(bestVendor && Number(bestVendor.stock) > 0);
    if (derivedBasePrice > 0) {
        product.basePrice = derivedBasePrice;
    }
    return product;
};

const fetchProductByIdWithRelations = (id) => {
    return Product.findById(id)
        .populate('mgr1')
        .populate('mgr2')
        .populate('mgr3')
        .populate('mgr4')
        .populate('mgr5')
        .populate('attributes')
        .populate('vendors.vendorId');
};

// Create Product
const createProduct = async (req, res) => {
    try {
        const {
            productCode,
            productName,
            categoryId,
            hsnCode,
            gstPercentage,
            basePrice,
            mrp,
            uom,
            productImageUrl,
            status,
            mgr1,
            mgr2,
            mgr3,
            mgr4,
            mgr5,
            attributes,
            vendors
        } = req.body;

        if (!productCode || !productName || !hsnCode) {
            return res.status(400).json({ message: 'Product code, name and HSN code are required' });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'vendors') && Array.isArray(vendors) && vendors.length === 0) {
            return res.status(400).json({ message: 'At least one vendor is required when vendor mapping is provided' });
        }

        const preparedVendors = await validateAndPrepareVendors(vendors || [], { allowEmpty: true });

        const newProduct = new Product({
            productCode,
            productName,
            categoryId: categoryId || undefined,
            hsnCode,
            gstPercentage,
            basePrice,
            mrp,
            uom,
            productImageUrl,
            status: status || 'Active',
            mgr1: mgr1 || undefined,
            mgr2: mgr2 || undefined,
            mgr3: mgr3 || undefined,
            mgr4: mgr4 || undefined,
            mgr5: mgr5 || undefined,
            attributes: attributes || [],
            vendors: preparedVendors,
        });

        if (preparedVendors.length) {
            newProduct.basePrice = deriveBasePriceFromVendors(newProduct);
        }

        await newProduct.save();
        const hydrated = await fetchProductByIdWithRelations(newProduct._id);
        res.status(201).json(buildProductResponse(hydrated));
    } catch (error) {
        console.error(error);
        res.status(statusForProductError(error)).json({ message: error.message || 'Error creating product' });
    }
};

// Get All Products
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find()
            .populate('mgr1')
            .populate('mgr2')
            .populate('mgr3')
            .populate('mgr4')
            .populate('mgr5')
            .populate('attributes')
            .populate('vendors.vendorId');

        res.json(products.map(buildProductResponse));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

// Get Product by ID
const getProductById = async (req, res) => {
    try {
        const product = await fetchProductByIdWithRelations(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(buildProductResponse(product));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching product' });
    }
};

// Get Product Vendors
const getProductVendors = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('vendors.vendorId');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let vendors = sortVendorsByPriority(product.vendors || []);
        if (req.query.available === 'true') {
            vendors = vendors.filter((entry) => Number(entry.stock) > 0 && isVendorActive(entry));
        }

        res.json(vendors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching product vendors' });
    }
};

// Update Product
const updateProduct = async (req, res) => {
    try {
        const {
            productCode,
            productName,
            categoryId,
            hsnCode,
            gstPercentage,
            basePrice,
            mrp,
            uom,
            productImageUrl,
            status,
            mgr1,
            mgr2,
            mgr3,
            mgr4,
            mgr5,
            attributes,
            vendors
        } = req.body;

        const updateData = {
            productCode,
            productName,
            categoryId: categoryId || undefined,
            hsnCode,
            gstPercentage,
            basePrice,
            mrp,
            uom,
            productImageUrl,
            status,
            mgr1: mgr1 || undefined,
            mgr2: mgr2 || undefined,
            mgr3: mgr3 || undefined,
            mgr4: mgr4 || undefined,
            mgr5: mgr5 || undefined,
            attributes: attributes || [],
            updatedAt: new Date()
        };

        if (Object.prototype.hasOwnProperty.call(req.body, 'vendors')) {
            const preparedVendors = await validateAndPrepareVendors(vendors || [], { allowEmpty: true });
            updateData.vendors = preparedVendors;

            if (preparedVendors.length) {
                updateData.basePrice = deriveBasePriceFromVendors({ vendors: preparedVendors, basePrice });
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('mgr1')
            .populate('mgr2')
            .populate('mgr3')
            .populate('mgr4')
            .populate('mgr5')
            .populate('attributes')
            .populate('vendors.vendorId');

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(buildProductResponse(updatedProduct));
    } catch (error) {
        console.error(error);
        res.status(statusForProductError(error)).json({ message: error.message || 'Error updating product' });
    }
};

// Update Product Vendor Price/Stock
const updateProductVendor = async (req, res) => {
    try {
        const { id, vendorId } = req.params;
        const { price, stock, isPrimary } = req.body;

        if (typeof price !== 'undefined' && !(Number(price) > 0)) {
            return res.status(400).json({ message: 'Price must be greater than zero' });
        }
        if (typeof stock !== 'undefined' && Number(stock) < 0) {
            return res.status(400).json({ message: 'Stock cannot be negative' });
        }

        const product = await Product.findById(id).populate('vendors.vendorId');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const vendorIndex = (product.vendors || []).findIndex((entry) => String(entry.vendorId?._id || entry.vendorId) === vendorId);
        if (vendorIndex === -1) {
            return res.status(404).json({ message: 'Vendor mapping not found for this product' });
        }

        const target = product.vendors[vendorIndex];

        if (typeof price !== 'undefined') {
            target.price = Number(price);
        }
        if (typeof stock !== 'undefined') {
            target.stock = Number(stock);
        }
        if (typeof isPrimary !== 'undefined') {
            if (toBoolean(isPrimary)) {
                product.vendors.forEach((entry) => {
                    entry.isPrimary = false;
                });
                target.isPrimary = true;
            } else {
                target.isPrimary = false;
            }
        }

        target.lastUpdated = new Date();
        product.basePrice = deriveBasePriceFromVendors(product);
        product.updatedAt = new Date();
        await product.save();

        const hydrated = await fetchProductByIdWithRelations(id);
        res.json(buildProductResponse(hydrated));
    } catch (error) {
        console.error(error);
        res.status(statusForProductError(error)).json({ message: error.message || 'Error updating product vendor' });
    }
};

// Delete Product
const deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting product' });
    }
};

// Bulk Delete Products
const bulkDeleteProducts = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of product IDs' });
        }

        const result = await Product.deleteMany({ _id: { $in: ids } });

        res.json({
            message: `${result.deletedCount} products deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting products' });
    }
};

// Bulk Update Products
const bulkUpdateProducts = async (req, res) => {
    try {
        const { ids, updateData } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of product IDs' });
        }

        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'Please provide update data' });
        }

        const result = await Product.updateMany(
            { _id: { $in: ids } },
            { $set: { ...updateData, updatedAt: new Date() } }
        );

        res.json({
            message: `${result.modifiedCount} products updated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating products' });
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    getProductVendors,
    updateProduct,
    updateProductVendor,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateProducts,
};
