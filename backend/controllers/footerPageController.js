const FooterPage = require('../models/FooterPage');

const DEFAULT_PAGES = {
    'privacy-policy': {
        slug: 'privacy-policy',
        label: 'Privacy Policy',
        content: '<h1>Privacy Policy</h1><p>Welcome to our Privacy Policy page. We take your privacy seriously...</p>'
    },
    'terms-of-service': {
        slug: 'terms-of-service',
        label: 'Terms of Service',
        content: '<h1>Terms of Service</h1><p>Welcome to our Terms of Service page. By using our service, you agree to these terms...</p>'
    },
    'help-center': {
        slug: 'help-center',
        label: 'Help Center',
        content: '<h1>Help Center</h1><p>Welcome to our Help Center. How can we help you today?</p>'
    }
};

exports.getAllPages = async (req, res) => {
    try {
        const pages = await FooterPage.find().lean();
        const result = { ...DEFAULT_PAGES };
        pages.forEach(p => {
            if (result[p.slug]) {
                result[p.slug] = {
                    slug: p.slug,
                    label: p.label,
                    content: p.content
                };
            }
        });
        res.json(Object.values(result));
    } catch (error) {
        console.error('getAllPages error:', error);
        res.status(500).json({ message: 'Failed to fetch footer pages', error: error.message });
    }
};

exports.getPageBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        let page = await FooterPage.findOne({ slug }).lean();
        if (!page) {
            const defaultPage = DEFAULT_PAGES[slug];
            if (!defaultPage) {
                return res.status(404).json({ message: 'Page not found' });
            }
            page = defaultPage;
        }
        res.json(page);
    } catch (error) {
        console.error('getPageBySlug error:', error);
        res.status(500).json({ message: 'Failed to fetch page content', error: error.message });
    }
};

exports.updatePage = async (req, res) => {
    try {
        const { slug } = req.params;
        const { label, content } = req.body || {};

        if (!label || !label.trim()) {
            return res.status(400).json({ message: 'Page label is required' });
        }

        const page = await FooterPage.findOneAndUpdate(
            { slug },
            { label: label.trim(), content: content || '' },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(page);
    } catch (error) {
        console.error('updatePage error:', error);
        res.status(500).json({ message: 'Failed to update page', error: error.message });
    }
};
