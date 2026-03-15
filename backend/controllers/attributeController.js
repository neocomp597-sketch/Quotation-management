const Attribute = require('../models/Attribute');

exports.getAttributesByMGR3 = async (req, res) => {
    try {
        const { mgr3Id } = req.params;
        const attributes = await Attribute.find({ mgr3Id }).populate('mgr3Id');
        res.json(attributes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createAttribute = async (req, res) => {
    try {
        const { mgr3Id, code, description, status } = req.body;

        // Check for duplicates
        const existing = await Attribute.findOne({ mgr3Id, code, description });
        if (existing) {
            return res.status(400).json({ message: 'Attribute with this Code and Description already exists for this MGR3' });
        }

        const newAttribute = new Attribute({
            mgr3Id,
            code,
            description,
            status
        });

        await newAttribute.save();
        res.status(201).json(newAttribute);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.updateAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, description, status } = req.body;

        const attribute = await Attribute.findById(id);
        if (!attribute) return res.status(404).json({ message: 'Attribute not found' });

        // Check for duplicates if code/description changed
        if (code !== attribute.code || description !== attribute.description) {
            const existing = await Attribute.findOne({ 
                mgr3Id: attribute.mgr3Id, 
                code, 
                description,
                _id: { $ne: id }
            });
            if (existing) {
                return res.status(400).json({ message: 'Attribute with this Code and Description already exists' });
            }
        }

        attribute.code = code || attribute.code;
        attribute.description = description || attribute.description;
        attribute.status = status || attribute.status;

        await attribute.save();
        res.json(attribute);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        await Attribute.findByIdAndDelete(id);
        res.json({ message: 'Attribute deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
