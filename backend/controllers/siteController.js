const Site = require('../models/Site');

const getAllSites = async (req, res) => {
    try {
        const { customerId } = req.query;
        let query = {};
        if (customerId) query.customerId = customerId;

        const sites = await Site.find(query).sort({ siteName: 1 });
        res.json(sites);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sites' });
    }
};

const createSite = async (req, res) => {
    try {
        const { customerId, siteName, location, address, contactPerson, mobile } = req.body;
        const newSite = new Site({ customerId, siteName, location, address, contactPerson, mobile });
        await newSite.save();
        res.status(201).json(newSite);
    } catch (error) {
        res.status(500).json({ message: 'Error creating site', error: error.message });
    }
};

module.exports = {
    getAllSites,
    createSite
};
