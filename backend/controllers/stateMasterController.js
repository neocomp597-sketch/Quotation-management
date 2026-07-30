const StateMaster = require('../models/StateMaster');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const Branch = require('../models/Branch');

const DEFAULT_INDIAN_STATES = [
    { state: 'Andhra Pradesh', shortCode: 'AP', gstCode: '37' },
    { state: 'Arunachal Pradesh', shortCode: 'AR', gstCode: '12' },
    { state: 'Assam', shortCode: 'AS', gstCode: '18' },
    { state: 'Bihar', shortCode: 'BR', gstCode: '10' },
    { state: 'Chhattisgarh', shortCode: 'CG', gstCode: '22' },
    { state: 'Goa', shortCode: 'GA', gstCode: '30' },
    { state: 'Gujarat', shortCode: 'GJ', gstCode: '24' },
    { state: 'Haryana', shortCode: 'HR', gstCode: '06' },
    { state: 'Himachal Pradesh', shortCode: 'HP', gstCode: '02' },
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
    { state: 'Punjab', shortCode: 'PB', gstCode: '03' },
    { state: 'Rajasthan', shortCode: 'RJ', gstCode: '08' },
    { state: 'Sikkim', shortCode: 'SK', gstCode: '11' },
    { state: 'Tamil Nadu', shortCode: 'TN', gstCode: '33' },
    { state: 'Telangana', shortCode: 'TS', gstCode: '36' },
    { state: 'Tripura', shortCode: 'TR', gstCode: '16' },
    { state: 'Uttar Pradesh', shortCode: 'UP', gstCode: '09' },
    { state: 'Uttarakhand', shortCode: 'UK', gstCode: '05' },
    { state: 'West Bengal', shortCode: 'WB', gstCode: '19' },
    { state: 'Andaman & Nicobar Islands', shortCode: 'AN', gstCode: '35' },
    { state: 'Chandigarh', shortCode: 'CH', gstCode: '04' },
    { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH', gstCode: '26' },
    { state: 'Delhi (NCT)', shortCode: 'DL', gstCode: '07' },
    { state: 'Jammu & Kashmir', shortCode: 'JK', gstCode: '01' },
    { state: 'Ladakh', shortCode: 'LA', gstCode: '38' },
    { state: 'Lakshadweep', shortCode: 'LD', gstCode: '31' },
    { state: 'Puducherry', shortCode: 'PY', gstCode: '34' }
];

// Helper to normalize state name for space & case insensitive comparison
const normalizeStateName = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
};

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
                dialCode: '+91',
                state: s.state,
                shortCode: s.shortCode,
                gstCode: s.gstCode,
                city: '',
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
        const { country, dialCode, state, shortCode, gstCode, city, status } = req.body;
        if (!state || !shortCode) {
            return res.status(400).json({ success: false, message: 'State and Short Code are required' });
        }

        const normalizedInput = normalizeStateName(state);

        // Check duplicate state name (case and space insensitive)
        const query = companyId ? { companyId } : {};
        const existingStates = await StateMaster.find(query).lean();
        const duplicate = existingStates.find(s => normalizeStateName(s.state) === normalizedInput);

        if (duplicate) {
            return res.status(400).json({ 
                success: false, 
                message: `State record '${state.trim()}' already exists (matches existing '${duplicate.state}'). Duplicate states are not allowed.` 
            });
        }

        const newState = new StateMaster({
            ...(companyId && { companyId }),
            country: country?.trim() || 'India',
            dialCode: dialCode?.trim() || '+91',
            state: state.trim().replace(/\s+/g, ' '),
            shortCode: shortCode.trim().toUpperCase(),
            gstCode: gstCode?.trim() || '',
            city: city?.trim() || '',
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
        const { country, dialCode, state, shortCode, gstCode, city, status } = req.body;
        const query = { _id: id };
        if (companyId) query.companyId = companyId;

        const existingDoc = await StateMaster.findOne(query);
        if (!existingDoc) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }

        let newCleanState = existingDoc.state;
        if (state && state.trim()) {
            newCleanState = state.trim().replace(/\s+/g, ' ');
            const normalizedNew = normalizeStateName(newCleanState);
            const normalizedOld = normalizeStateName(existingDoc.state);

            if (normalizedNew !== normalizedOld) {
                // 1. Check duplicate against other records
                const allStates = await StateMaster.find(companyId ? { companyId } : {}).lean();
                const duplicate = allStates.find(s => s._id.toString() !== id && normalizeStateName(s.state) === normalizedNew);
                if (duplicate) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `State name '${newCleanState}' conflicts with existing record '${duplicate.state}'.` 
                    });
                }

                // 2. Check Business Rules: restrict rename if state is referenced in system records
                const [custCount, vendCount, branchCount] = await Promise.all([
                    Customer.countDocuments({ state: existingDoc.state }),
                    Vendor.countDocuments({ state: existingDoc.state }),
                    Branch.countDocuments({ state: existingDoc.state })
                ]);

                if (custCount > 0 || vendCount > 0 || branchCount > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `State name '${existingDoc.state}' cannot be renamed because it is actively bound to ${custCount} customer(s), ${vendCount} vendor(s), and ${branchCount} branch(es).`
                    });
                }
            }
        }

        const updated = await StateMaster.findOneAndUpdate(
            query,
            { 
                ...(country && { country: country.trim() }),
                ...(dialCode !== undefined && { dialCode: dialCode.trim() }),
                state: newCleanState,
                ...(shortCode && { shortCode: shortCode.trim().toUpperCase() }),
                ...(gstCode !== undefined && { gstCode: gstCode.trim() }),
                ...(city !== undefined && { city: city.trim() }),
                ...(status && { status }),
                updatedAt: new Date()
            },
            { new: true }
        );
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

        const targetState = await StateMaster.findOne(query);
        if (!targetState) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }

        // Check if state is in active use
        const [custCount, vendCount, branchCount] = await Promise.all([
            Customer.countDocuments({ state: targetState.state }),
            Vendor.countDocuments({ state: targetState.state }),
            Branch.countDocuments({ state: targetState.state })
        ]);

        if (custCount > 0 || vendCount > 0 || branchCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete State '${targetState.state}' because it is actively referenced by system records (${custCount} customer(s), ${vendCount} vendor(s), ${branchCount} branch(es)).`
            });
        }

        await StateMaster.findOneAndDelete(query);
        res.json({ success: true, message: 'State deleted successfully' });
    } catch (error) {
        console.error('Error deleting state:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
