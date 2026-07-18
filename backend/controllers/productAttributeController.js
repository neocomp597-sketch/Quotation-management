const ProductAttribute = require('../models/ProductAttribute');

// Get all product attributes
const getAllProductAttributes = async (req, res) => {
    try {
        const attributes = await ProductAttribute.find({})
            .select('productCode attributeCode attributeValue createdAt updatedAt')
            .lean();
        res.status(200).json(attributes);
    } catch (error) {
        console.error('Error fetching all product attributes:', error);
        res.status(500).json({ message: error.message || 'Error fetching product attributes' });
    }
};


// Get all attributes for a specific product
const getProductAttributes = async (req, res) => {
    try {
        const { productCode } = req.params;
        const attributes = await ProductAttribute.find({ productCode })
            .select('productCode attributeCode attributeValue createdAt updatedAt')
            .lean();
        res.status(200).json(attributes);
    } catch (error) {
        console.error('Error fetching product attributes:', error);
        res.status(500).json({ message: error.message || 'Error fetching product attributes' });
    }
};

// Create or update a product attribute
const saveProductAttribute = async (req, res) => {
    try {
        const { productCode, attributeCode, attributeValue } = req.body;
        
        if (!productCode || !attributeCode || !attributeValue) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const attribute = await ProductAttribute.findOneAndUpdate(
            { productCode, attributeCode },
            { attributeValue },
            { upsert: true, new: true }
        );

        res.status(200).json(attribute);
    } catch (error) {
        console.error('Error saving product attribute:', error);
        res.status(500).json({ message: error.message || 'Error saving product attribute' });
    }
};

// Delete a product attribute
const deleteProductAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        await ProductAttribute.findByIdAndDelete(id);
        res.status(200).json({ message: 'Attribute deleted successfully' });
    } catch (error) {
        console.error('Error deleting product attribute:', error);
        res.status(500).json({ message: error.message || 'Error deleting product attribute' });
    }
};

module.exports = {
    getAllProductAttributes,
    getProductAttributes,
    saveProductAttribute,
    deleteProductAttribute
};
