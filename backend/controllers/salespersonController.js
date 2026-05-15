const Salesperson = require('../models/Salesperson');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const getAllSalespersons = async (req, res) => {
    try {
        if (req.query.page || req.query.limit) {
            const { page, limit, skip } = getPagination(req.query);
            const [salespersons, total] = await Promise.all([
                Salesperson.find({ status: 'Active' })
                    .select('name email mobile role status createdAt updatedAt')
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Salesperson.countDocuments({ status: 'Active' })
            ]);

            return res.json({
                data: salespersons,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1
                }
            });
        }

        const salespersons = await Salesperson.find({ status: 'Active' })
            .select('name email mobile role status createdAt updatedAt')
            .sort({ name: 1 })
            .lean();
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
