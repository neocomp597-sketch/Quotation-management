const TermsTemplate = require('../models/TermsTemplate');

const getAllTemplates = async (req, res) => {
    try {
        const templates = await TermsTemplate.find();
        res.json(templates);
    } catch (err) {
        res.status(500).json({ message: "Error fetching templates" });
    }
};

const createTemplate = async (req, res) => {
    try {
        const template = new TermsTemplate(req.body);
        await template.save();
        res.status(201).json(template);
    } catch (err) {
        res.status(500).json({ message: "Error creating template" });
    }
};

const updateTemplate = async (req, res) => {
    try {
        const template = await TermsTemplate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(template);
    } catch (err) {
        res.status(500).json({ message: "Error updating template" });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        await TermsTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: "Template deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting template" });
    }
};

module.exports = {
    getAllTemplates,
    getAllTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
};
