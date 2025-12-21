const Product = require('../models/Product');

// Create Product
const createProduct = async (req, res) => {
    try {
        const { productCode, productName, categoryId, hsnCode, gstPercentage, basePrice, mrp, uom } = req.body;

        const newProduct = new Product({
            productCode,
            productName,
            categoryId: categoryId || undefined,
            hsnCode,
            gstPercentage,
            basePrice,
            mrp,
            uom,
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
        const { productCode, productName, categoryId, hsnCode, gstPercentage, basePrice, mrp, uom } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, {
            productCode,
            productName,
            categoryId: categoryId || undefined,
            hsnCode,
            gstPercentage,
            basePrice,
            mrp,
            uom,
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

module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
};
