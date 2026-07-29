const StateMaster = require('../models/StateMaster');

const DEFAULT_INDIAN_STATES = [
    { state: 'Andhra Pradesh', shortCode: 'AP', gstCode: '37' },
    { state: 'Arunachal Pradesh', shortCode: 'AR', gstCode: '12' },
    { state: 'Assam', shortCode: 'AS', gstCode: '18' },
    { state: 'Bihar', shortCode: 'BR', gstCode: '10' },
    { state: 'Chhattisgarh', shortCode: 'CG', gstCode: '22' },
    { state: 'Goa', shortCode: 'GA', gstCode: '30' },
    { state: 'Gujarat', shortCode: 'GJ', gstCode: '24' },
    { state: 'Haryana', shortCode: 'HR', gstCode: '6' },
    { state: 'Himachal Pradesh', shortCode: 'HP', gstCode: '2' },
    { state: 'Jharkhand', shortCode: 'JH', gstCode: '20' },
    { state: 'Karnataka', shortCode: 'KA', gstCode: '29' },
    { state: 'Kerala', shortCode: 'KL', gstCode: '32' },
    { state: 'Madhya Pradesh', shortCode: 'MP', gstCode: '23' },
    { state: 'Maharashtra', shortCode: 'MH', gstCode: '27' },
    { state: 'Manipur', shortCode: 'MN', gstCode: '14' },
    { state: 'Meghalaya', shortCode: 'ML', gstCode: '17' },
    { state: 'Mizoram', shortCode: 'MZ', gstCode: '15' },
    { state: 'Nagaland', shortCode: 'NL', gstCode: '13' },
    { state: 'Odisha', shortCode: 'OD', gstCode: '21' },
    { state: 'Punjab', shortCode: 'PB', gstCode: '3' },
    { state: 'Rajasthan', shortCode: 'RJ', gstCode: '8' },
    { state: 'Sikkim', shortCode: 'SK', gstCode: '11' },
    { state: 'Tamil Nadu', shortCode: 'TN', gstCode: '33' },
    { state: 'Telangana', shortCode: 'TS', gstCode: '36' },
    { state: 'Tripura', shortCode: 'TR', gstCode: '16' },
    { state: 'Uttar Pradesh', shortCode: 'UP', gstCode: '9' },
    { state: 'Uttarakhand', shortCode: 'UK', gstCode: '5' },
    { state: 'West Bengal', shortCode: 'WB', gstCode: '19' },
    { state: 'Andaman & Nicobar Islands', shortCode: 'AN', gstCode: '35' },
    { state: 'Chandigarh', shortCode: 'CH', gstCode: '4' },
    { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH', gstCode: '26' },
    { state: 'Delhi (NCT)', shortCode: 'DL', gstCode: '7' },
    { state: 'Jammu & Kashmir', shortCode: 'JK', gstCode: '1' },
    { state: 'Ladakh', shortCode: 'LA', gstCode: '38' },
    { state: 'Lakshadweep', shortCode: 'LD', gstCode: '31' },
    { state: 'Puducherry', shortCode: 'PY', gstCode: '34' }
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
                country: 'India',
                state: s.state,
                shortCode: s.shortCode,
                gstCode: s.gstCode,
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
        const { country, state, shortCode, gstCode, status } = req.body;
        if (!state || !shortCode) {
            return res.status(400).json({ success: false, message: 'State and Short Code are required' });
        }
        const newState = new StateMaster({
            ...(companyId && { companyId }),
            country: country?.trim() || 'India',
            state: state.trim(),
            shortCode: shortCode.trim().toUpperCase(),
            gstCode: gstCode?.trim() || '',
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
        const { country, state, shortCode, gstCode, status } = req.body;
        const query = { _id: id };
        if (companyId) query.companyId = companyId;

        const updated = await StateMaster.findOneAndUpdate(
            query,
            { 
                ...(country && { country: country.trim() }),
                ...(state && { state: state.trim() }),
                ...(shortCode && { shortCode: shortCode.trim().toUpperCase() }),
                ...(gstCode !== undefined && { gstCode: gstCode.trim() }),
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
