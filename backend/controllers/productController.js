const Product = require('../models/Product');

// Create Product
const createProduct = async (req, res) => {
    try {
        const { productCode, productName, categoryId, hsnCode, gstPercentage, basePrice, mrp, uom, productImageUrl, status } = req.body;

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
        });

        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating product' });
    }
};

// Get All Products
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

// Get Product by ID
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching product' });
    }
};

// Update Product
const updateProduct = async (req, res) => {
    try {
        const { productCode, productName, categoryId, hsnCode, gstPercentage, basePrice, mrp, uom, productImageUrl, status } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, {
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
        }, { new: true });

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(updatedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating product' });
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
            { $set: updateData }
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
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateProducts,
};
