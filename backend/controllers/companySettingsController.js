const CompanySettings = require('../models/CompanySettings');
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');
const { invalidateViaQueueOrNow } = require('../queues/cacheInvalidationQueue');

const COMPANY_SETTINGS_CACHE_TTL_SECONDS = Number(process.env.COMPANY_SETTINGS_CACHE_TTL_SECONDS || 600);

const SETTINGS_QUERY_OPTIONS = { bypassTenant: true };

// Get company settings for logged in user
exports.getCompanySettings = async (req, res) => {
    try {
        const cacheKey = makeCacheKey('company-settings:me', req);
        const { hit, redis, value: cachedSettings } = await getCachedJson(cacheKey);
        if (hit) {
            return res.json(cachedSettings);
        }

        let settings = await CompanySettings.findOne({
            $or: [
                { companyId: req.user.companyId },
                { userId: req.user.id }
            ]
        })
            .setOptions(SETTINGS_QUERY_OPTIONS)
            .lean();

        if (!settings) {
            await setCachedJson(redis, cacheKey, null, 60);
            // Return empty settings if not found
            return res.json(null);
        }

        await setCachedJson(redis, cacheKey, settings, COMPANY_SETTINGS_CACHE_TTL_SECONDS);
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
            quotationPrefix,
            showDualBranding,
            whitelabelAppTitle,
            primaryBrandColor,
            rcaLeftLogoUrl,
            rcaRightLogoUrl
        } = req.body;

        // Validate required fields
        if (!companyName) {
            return res.status(400).json({ message: 'Company name is required' });
        }

        if (address?.pincode) {
            const cleanPin = String(address.pincode).trim().replace(/\D/g, '');
            if (cleanPin && cleanPin.length !== 6) {
                return res.status(400).json({ message: 'Pincode must be exactly 6 numeric digits' });
            }
        }

        let settings = await CompanySettings.findOne({
            $or: [
                { companyId: req.user.companyId },
                { userId: req.user.id }
            ]
        }).setOptions(SETTINGS_QUERY_OPTIONS);
        const baseAddress = settings?.address || {};
        const baseBankDetails = settings?.bankDetails || {};
        const baseSignatory = settings?.authorizedSignatory || {};

        if (settings) {
            // Update existing settings
            settings.companyName = companyName;
            settings.tagline = tagline || '';
            settings.logoUrl = logoUrl;
            settings.email = email;
            settings.phone = phone;
            settings.website = website;
            settings.address = {
                ...baseAddress,
                ...(address || {}),
                country: address?.country ?? baseAddress.country ?? 'India'
            };
            settings.gstin = gstin;
            settings.pan = pan;
            settings.cin = cin;
            settings.bankDetails = {
                ...baseBankDetails,
                ...(bankDetails || {})
            };
            settings.authorizedSignatory = {
                ...baseSignatory,
                ...(authorizedSignatory || {})
            };
            settings.defaultTerms = defaultTerms;
            settings.quotationPrefix = (quotationPrefix && quotationPrefix.toUpperCase().startsWith('ARM')) ? quotationPrefix : 'ARM/QTN';
            if (typeof showDualBranding === 'boolean') settings.showDualBranding = showDualBranding;
            if (typeof whitelabelAppTitle === 'string') settings.whitelabelAppTitle = whitelabelAppTitle;
            if (typeof primaryBrandColor === 'string') settings.primaryBrandColor = primaryBrandColor;
            if (typeof rcaLeftLogoUrl === 'string') settings.rcaLeftLogoUrl = rcaLeftLogoUrl;
            if (typeof rcaRightLogoUrl === 'string') settings.rcaRightLogoUrl = rcaRightLogoUrl;
            settings.companyId = req.user.companyId;
            settings.userId = settings.userId || req.user.id;

            await settings.save();
        } else {
            // Create new settings
            settings = await CompanySettings.create({
                userId: req.user.id,
                companyId: req.user.companyId,
                companyName,
                tagline: tagline || '',
                logoUrl,
                email,
                phone,
                website,
                address: {
                    line1: address?.line1 || '',
                    line2: address?.line2 || '',
                    city: address?.city || '',
                    state: address?.state || '',
                    pincode: address?.pincode || '',
                    country: address?.country || 'India'
                },
                gstin,
                pan,
                cin,
                bankDetails: {
                    ...(bankDetails || {})
                },
                authorizedSignatory: {
                    name: authorizedSignatory?.name || '',
                    designation: authorizedSignatory?.designation || '',
                    signatureImageUrl: authorizedSignatory?.signatureImageUrl || ''
                },
                defaultTerms,
                quotationPrefix: (quotationPrefix && quotationPrefix.toUpperCase().startsWith('ARM')) ? quotationPrefix : 'ARM/QTN',
                showDualBranding: typeof showDualBranding === 'boolean' ? showDualBranding : true,
                whitelabelAppTitle: whitelabelAppTitle || '',
                primaryBrandColor: primaryBrandColor || '',
                rcaLeftLogoUrl: rcaLeftLogoUrl || '',
                rcaRightLogoUrl: rcaRightLogoUrl || ''
            });
        }

        await invalidateViaQueueOrNow('company-settings:*', 'quotations:*');
        res.json(settings);
    } catch (error) {
        console.error('Error updating company settings:', error);
        res.status(500).json({ message: 'Error updating company settings', error: error.message });
    }
};

/**
 * Sets only the two logos printed on the Why-Why Analysis Sheet. Kept apart from the full
 * settings save so changing a logo from the RCA screen cannot overwrite anything else.
 */
exports.updateRcaLogos = async (req, res) => {
    try {
        const update = {};
        if (typeof req.body.rcaLeftLogoUrl === 'string') update.rcaLeftLogoUrl = req.body.rcaLeftLogoUrl.trim();
        if (typeof req.body.rcaRightLogoUrl === 'string') update.rcaRightLogoUrl = req.body.rcaRightLogoUrl.trim();
        if (!Object.keys(update).length) {
            return res.status(400).json({ message: 'Nothing to change.' });
        }

        const settings = await CompanySettings.findOne({
            $or: [
                { companyId: req.user.companyId },
                { userId: req.user.id }
            ]
        }).setOptions(SETTINGS_QUERY_OPTIONS);

        if (!settings) {
            return res.status(404).json({ message: 'Set the company details up first, then the sheet logos.' });
        }

        Object.assign(settings, update);
        await settings.save();
        await invalidateViaQueueOrNow('company-settings:*');
        return res.json({
            rcaLeftLogoUrl: settings.rcaLeftLogoUrl || '',
            rcaRightLogoUrl: settings.rcaRightLogoUrl || ''
        });
    } catch (error) {
        console.error('Error updating RCA sheet logos:', error);
        return res.status(500).json({ message: 'Could not save the sheet logos', error: error.message });
    }
};

// Get company settings by user ID (for quotation PDF generation)
exports.getCompanySettingsByUserId = async (userId) => {
    try {
        const user = await require('../models/User').findById(userId).select('companyId').lean();
        const settings = user?.companyId
            ? await CompanySettings.findOne({ companyId: user.companyId }).setOptions(SETTINGS_QUERY_OPTIONS).lean()
            : null;
        return settings;
    } catch (error) {
        console.error('Error fetching company settings by userId:', error);
        return null;
    }
};
