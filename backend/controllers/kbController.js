const KnowledgeBase = require('../models/KnowledgeBase');

exports.createArticle = async (req, res) => {
    try {
        const article = await KnowledgeBase.create({
            ...req.body,
            createdBy: req.user?.id,
            companyId: req.user?.companyId
        });
        res.status(201).json(article);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getArticles = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { companyId, isActive: true };

        if (req.query.category) {
            filter.category = req.query.category;
        }

        const search = String(req.query.search || '').trim();
        let query;

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { title: regex },
                { content: regex }
            ];
            query = KnowledgeBase.find(filter);
        } else {
            query = KnowledgeBase.find(filter);
        }

        const articles = await query.sort({ views: -1, createdAt: -1 }).lean();
        res.json(articles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getArticleById = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const article = await KnowledgeBase.findOneAndUpdate(
            { _id: req.params.id, companyId },
            { $inc: { views: 1 } },
            { new: true }
        ).populate('createdBy', 'name email').lean();

        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }

        res.json(article);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateArticle = async (req, res) => {
    try {
        const article = await KnowledgeBase.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user?.companyId },
            req.body,
            { new: true, runValidators: true }
        );
        if (!article) return res.status(404).json({ message: 'Article not found' });
        res.json(article);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteArticle = async (req, res) => {
    try {
        const article = await KnowledgeBase.findOneAndDelete({ _id: req.params.id, companyId: req.user?.companyId });
        if (!article) return res.status(404).json({ message: 'Article not found' });
        res.json({ message: 'Article deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
