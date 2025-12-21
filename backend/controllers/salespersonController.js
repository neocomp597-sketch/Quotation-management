const Salesperson = require('../models/Salesperson');

const getAllSalespersons = async (req, res) => {
    try {
        const salespersons = await Salesperson.find({ status: 'Active' }).sort({ name: 1 });
        res.json(salespersons);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching salespersons' });
    }
};

const createSalesperson = async (req, res) => {
    try {
        const { name, email, mobile } = req.body;
        const newSalesperson = new Salesperson({ name, email, mobile });
        await newSalesperson.save();
        res.status(201).json(newSalesperson);
    } catch (error) {
        res.status(500).json({ message: 'Error creating salesperson' });
    }
};

module.exports = {
    getAllSalespersons,
    createSalesperson
};
