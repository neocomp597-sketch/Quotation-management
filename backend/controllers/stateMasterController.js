const StateMaster = require('../models/StateMaster');

const DEFAULT_INDIAN_STATES = [
    { state: 'Maharashtra', shortCode: 'MH' },
    { state: 'Gujarat', shortCode: 'GJ' },
    { state: 'Karnataka', shortCode: 'KA' },
    { state: 'Delhi', shortCode: 'DL' },
    { state: 'West Bengal', shortCode: 'WB' },
    { state: 'Tamil Nadu', shortCode: 'TN' },
    { state: 'Telangana', shortCode: 'TS' },
    { state: 'Uttar Pradesh', shortCode: 'UP' },
    { state: 'Rajasthan', shortCode: 'RJ' },
    { state: 'Kerala', shortCode: 'KL' },
    { state: 'Andhra Pradesh', shortCode: 'AP' },
    { state: 'Madhya Pradesh', shortCode: 'MP' },
    { state: 'Punjab', shortCode: 'PB' },
    { state: 'Haryana', shortCode: 'HR' },
    { state: 'Bihar', shortCode: 'BR' },
    { state: 'Odisha', shortCode: 'OR' },
    { state: 'Assam', shortCode: 'AS' },
    { state: 'Chhattisgarh', shortCode: 'CG' },
    { state: 'Jharkhand', shortCode: 'JH' },
    { state: 'Uttarakhand', shortCode: 'UK' },
    { state: 'Himachal Pradesh', shortCode: 'HP' },
    { state: 'Goa', shortCode: 'GA' },
    { state: 'Jammu and Kashmir', shortCode: 'JK' },
    { state: 'Ladakh', shortCode: 'LA' },
    { state: 'Chandigarh', shortCode: 'CH' },
    { state: 'Puducherry', shortCode: 'PY' },
    { state: 'Tripura', shortCode: 'TR' },
    { state: 'Meghalaya', shortCode: 'ML' },
    { state: 'Manipur', shortCode: 'MN' },
    { state: 'Nagaland', shortCode: 'NL' },
    { state: 'Mizoram', shortCode: 'MZ' },
    { state: 'Arunachal Pradesh', shortCode: 'AR' },
    { state: 'Sikkim', shortCode: 'SK' },
    { state: 'Andaman and Nicobar Islands', shortCode: 'AN' },
    { state: 'Dadra and Nagar Haveli and Daman and Diu', shortCode: 'DN' },
    { state: 'Lakshadweep', shortCode: 'LD' }
];

exports.getAll = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const query = companyId ? { companyId } : {};
        let states = await StateMaster.find(query).sort({ state: 1 }).lean();
        
        // Auto-seed default Indian states if empty
        if (states.length === 0) {
            const docsToInsert = DEFAULT_INDIAN_STATES.map(s => ({
                ...(companyId && { companyId }),
                state: s.state,
                shortCode: s.shortCode,
                status: 'Active'
            }));
            states = await StateMaster.insertMany(docsToInsert);
        }
        res.json({ success: true, data: states });
    } catch (error) {
        console.error('Error fetching state master:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { state, shortCode, status } = req.body;
        if (!state || !shortCode) {
            return res.status(400).json({ success: false, message: 'State and Short Code are required' });
        }
        const newState = new StateMaster({
            ...(companyId && { companyId }),
            state: state.trim(),
            shortCode: shortCode.trim().toUpperCase(),
            status: status || 'Active'
        });
        await newState.save();
        res.status(201).json({ success: true, data: newState, message: 'State created successfully' });
    } catch (error) {
        console.error('Error creating state:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;
        const { state, shortCode, status } = req.body;
        const query = { _id: id };
        if (companyId) query.companyId = companyId;

        const updated = await StateMaster.findOneAndUpdate(
            query,
            { 
                ...(state && { state: state.trim() }),
                ...(shortCode && { shortCode: shortCode.trim().toUpperCase() }),
                ...(status && { status }),
                updatedAt: new Date()
            },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }
        res.json({ success: true, data: updated, message: 'State updated successfully' });
    } catch (error) {
        console.error('Error updating state:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;
        const query = { _id: id };
        if (companyId) query.companyId = companyId;

        const deleted = await StateMaster.findOneAndDelete(query);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }
        res.json({ success: true, message: 'State deleted successfully' });
    } catch (error) {
        console.error('Error deleting state:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
