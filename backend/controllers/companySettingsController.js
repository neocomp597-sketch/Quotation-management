const CompanySettings = require('../models/CompanySettings');

// Get company settings for logged in user
exports.getCompanySettings = async (req, res) => {
    try {
        let settings = await CompanySettings.findOne({ userId: req.user.id });

        if (!settings) {
            // Return empty settings if not found
            return res.json(null);
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching company settings:', error);
        res.status(500).json({ message: 'Error fetching company settings', error: error.message });
    }
};

// Create or update company settings
exports.updateCompanySettings = async (req, res) => {
    try {
        const {
            companyName,
            tagline,
            logoUrl,
            email,
            phone,
            website,
            address,
            gstin,
            pan,
            cin,
            bankDetails,
            authorizedSignatory,
            defaultTerms,
            quotationPrefix
        } = req.body;

        // Validate required fields
        if (!companyName) {
            return res.status(400).json({ message: 'Company name is required' });
        }

        if (!authorizedSignatory?.name) {
            return res.status(400).json({ message: 'Authorized signatory name is required' });
        }

        if (!address?.line1 || !address?.city || !address?.state || !address?.pincode) {
            return res.status(400).json({ message: 'Complete address is required (line1, city, state, pincode)' });
        }

        let settings = await CompanySettings.findOne({ userId: req.user.id });

        if (settings) {
            // Update existing settings
            settings.companyName = companyName;
            settings.tagline = tagline || '';
            settings.logoUrl = logoUrl;
            settings.email = email;
            settings.phone = phone;
            settings.website = website;
            settings.address = address;
            settings.gstin = gstin;
            settings.pan = pan;
            settings.cin = cin;
            settings.bankDetails = bankDetails || {};
            settings.authorizedSignatory = authorizedSignatory;
            settings.defaultTerms = defaultTerms;
            settings.quotationPrefix = quotationPrefix || 'ARM/QTN';

            await settings.save();
        } else {
            // Create new settings
            settings = await CompanySettings.create({
                userId: req.user.id,
                companyName,
                tagline: tagline || '',
                logoUrl,
                email,
                phone,
                website,
                address,
                gstin,
                pan,
                cin,
                bankDetails: bankDetails || {},
                authorizedSignatory,
                defaultTerms,
                quotationPrefix: quotationPrefix || 'ARM/QTN'
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error updating company settings:', error);
        res.status(500).json({ message: 'Error updating company settings', error: error.message });
    }
};

// Get company settings by user ID (for quotation PDF generation)
exports.getCompanySettingsByUserId = async (userId) => {
    try {
        const settings = await CompanySettings.findOne({ userId });
        return settings;
    } catch (error) {
        console.error('Error fetching company settings by userId:', error);
        return null;
    }
};
