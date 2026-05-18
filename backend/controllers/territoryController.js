const Territory = require('../models/Territory');
const Customer = require('../models/Customer');

// Helper to auto-assign territory based on city & pincode
const getAutoAssignedTerritory = async (billingAddress, shippingAddress, companyId) => {
    if (!companyId) return null;
    
    const city = (billingAddress?.city || shippingAddress?.city || '').trim().toLowerCase();
    const pincode = (billingAddress?.pincode || shippingAddress?.pincode || '').trim();

    if (!city && !pincode) return null;

    // Fetch all territories with rules for this company
    const territories = await Territory.find({ companyId }).lean();

    // 1. Match Pincode first (pincode first)
    if (pincode) {
        for (const t of territories) {
            const pincodes = t.rules?.pincodes || [];
            if (pincodes.some(p => p.trim() === pincode)) {
                return t._id;
            }
        }
    }

    // 2. Match City (case-insensitive)
    if (city) {
        for (const t of territories) {
            const cities = t.rules?.cities || [];
            if (cities.some(c => c.trim().toLowerCase() === city)) {
                return t._id;
            }
        }
    }

    return null;
};

// Get all territories
const getTerritories = async (req, res) => {
    try {
        let companyId = req.user.companyId || req.headers['x-company-id'] || req.query.companyId;

        if (!companyId) {
            // Gracefully return empty array if no company is configured yet, avoiding toast error
            return res.json([]);
        }

        const territories = await Territory.find({ companyId })
            .populate('parent', 'name type')
            .populate('manager', 'name email')
            .populate('salesReps', 'name email')
            .sort({ name: 1 })
            .lean();

        res.json(territories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new territory
const createTerritory = async (req, res) => {
    try {
        let companyId = req.user.companyId || req.headers['x-company-id'] || req.body.companyId;

        if (!companyId) {
            return res.status(400).json({ message: "Please configure Company Settings first in the Settings menu before creating territories." });
        }

        const { name, type, parent, manager, salesReps, rules } = req.body;

        const newTerritory = new Territory({
            companyId,
            name,
            type,
            parent: parent || null,
            manager: manager || null,
            salesReps: salesReps || [],
            rules: rules || { cities: [], pincodes: [] },
            createdBy: req.user?.id || null
        });

        await newTerritory.save();
        res.status(201).json(newTerritory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a territory
const updateTerritory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, parent, manager, salesReps, rules } = req.body;

        const territory = await Territory.findById(id);
        if (!territory) {
            return res.status(404).json({ message: "Territory not found" });
        }

        // Prevent circular reference (setting parent as itself or one of its descendants, but simple check for self is minimum)
        if (parent && parent.toString() === id.toString()) {
            return res.status(400).json({ message: "A territory cannot be its own parent" });
        }

        territory.name = name || territory.name;
        territory.type = type || territory.type;
        territory.parent = parent !== undefined ? (parent || null) : territory.parent;
        territory.manager = manager !== undefined ? (manager || null) : territory.manager;
        territory.salesReps = salesReps || territory.salesReps;
        territory.rules = rules || territory.rules;

        await territory.save();
        res.json(territory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a territory
const deleteTerritory = async (req, res) => {
    try {
        const { id } = req.params;

        const territory = await Territory.findById(id);
        if (!territory) {
            return res.status(404).json({ message: "Territory not found" });
        }

        const parentId = territory.parent || null;

        // 1. Move all children territories to parent territory
        await Territory.updateMany(
            { parent: id },
            { $set: { parent: parentId } }
        );

        // 2. Move all customers of this territory to parent territory
        await Customer.updateMany(
            { territory: id },
            { $set: { territory: parentId } }
        );

        // 3. Delete the territory
        await Territory.findByIdAndDelete(id);

        res.json({ message: "Territory deleted successfully. Child territories and customers moved to parent." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAutoAssignedTerritory,
    getTerritories,
    createTerritory,
    updateTerritory,
    deleteTerritory
};
