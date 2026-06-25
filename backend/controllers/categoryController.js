const Category = require('../models/Category');

exports.getAll = async (req, res) => {
    try {
        const categories = await Category.find({}).sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

exports.create = async (req, res) => {
    try {
        const { name, description, status } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        const newCategory = new Category({
            name,
            description,
            status: status || 'Active'
        });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating category' });
    }
};
