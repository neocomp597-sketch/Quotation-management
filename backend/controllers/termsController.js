const TermsTemplate = require('../models/TermsTemplate');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const getAllTemplates = async (req, res) => {
    try {
        if (req.query.page || req.query.limit) {
            const { page, limit, skip } = getPagination(req.query);
            const [templates, total] = await Promise.all([
                TermsTemplate.find()
                    .select('templateName content isDefault createdAt updatedAt')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                TermsTemplate.countDocuments()
            ]);

            return res.json({
                data: templates,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1
                }
            });
        }

        const templates = await TermsTemplate.find()
            .select('templateName content isDefault createdAt updatedAt')
            .lean();
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
