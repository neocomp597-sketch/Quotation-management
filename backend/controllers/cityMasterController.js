const CityMaster = require('../models/CityMaster');
const StateMaster = require('../models/StateMaster');
const xlsx = require('xlsx');

const DEFAULT_STATE_MAPPINGS = {
    'MAHARASHTRA': { state: 'Maharashtra', shortCode: 'MH' },
    'GUJARAT': { state: 'Gujarat', shortCode: 'GJ' },
    'KARNATAKA': { state: 'Karnataka', shortCode: 'KA' },
    'TELANGANA': { state: 'Telangana', shortCode: 'TS' },
    'ANDHRA PRADESH': { state: 'Andhra Pradesh', shortCode: 'AP' },
    'TAMIL NADU': { state: 'Tamil Nadu', shortCode: 'TN' },
    'DELHI': { state: 'Delhi (NCT)', shortCode: 'DL' },
    'DELHI (NCT)': { state: 'Delhi (NCT)', shortCode: 'DL' },
    'WEST BENGAL': { state: 'West Bengal', shortCode: 'WB' },
    'UTTAR PRADESH': { state: 'Uttar Pradesh', shortCode: 'UP' },
    'MADHYA PRADESH': { state: 'Madhya Pradesh', shortCode: 'MP' },
    'RAJASTHAN': { state: 'Rajasthan', shortCode: 'RJ' },
    'PUNJAB': { state: 'Punjab', shortCode: 'PB' },
    'HARYANA': { state: 'Haryana', shortCode: 'HR' },
    'BIHAR': { state: 'Bihar', shortCode: 'BR' },
    'KERALA': { state: 'Kerala', shortCode: 'KL' },
    'ODISHA': { state: 'Odisha', shortCode: 'OD' },
    'JHARKHAND': { state: 'Jharkhand', shortCode: 'JH' },
    'ASSAM': { state: 'Assam', shortCode: 'AS' },
    'CHHATTISGARH': { state: 'Chhattisgarh', shortCode: 'CG' },
    'HIMACHAL PRADESH': { state: 'Himachal Pradesh', shortCode: 'HP' },
    'UTTARAKHAND': { state: 'Uttarakhand', shortCode: 'UK' },
    'GOA': { state: 'Goa', shortCode: 'GA' },
    'JAMMU AND KASHMIR': { state: 'Jammu & Kashmir', shortCode: 'JK' },
    'JAMMU & KASHMIR': { state: 'Jammu & Kashmir', shortCode: 'JK' },
    'LADAKH': { state: 'Ladakh', shortCode: 'LA' },
    'CHANDIGARH': { state: 'Chandigarh', shortCode: 'CH' },
    'PUDUCHERRY': { state: 'Puducherry', shortCode: 'PY' },
    'TRIPURA': { state: 'Tripura', shortCode: 'TR' },
    'MEGHALAYA': { state: 'Meghalaya', shortCode: 'ML' },
    'MANIPUR': { state: 'Manipur', shortCode: 'MN' },
    'NAGALAND': { state: 'Nagaland', shortCode: 'NL' },
    'MIZORAM': { state: 'Mizoram', shortCode: 'MZ' },
    'ARUNACHAL PRADESH': { state: 'Arunachal Pradesh', shortCode: 'AR' },
    'SIKKIM': { state: 'Sikkim', shortCode: 'SK' },
    'ANDAMAN AND NICOBAR ISLANDS': { state: 'Andaman & Nicobar Islands', shortCode: 'AN' },
    'ANDAMAN & NICOBAR ISLANDS': { state: 'Andaman & Nicobar Islands', shortCode: 'AN' },
    'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU': { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH' },
    'DADRA & NAGAR HAVELI AND DAMAN & DIU': { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH' },
    'LAKSHADWEEP': { state: 'Lakshadweep', shortCode: 'LD' }
};

const resolveStateMapping = async (inputState) => {
    if (!inputState) return { state: '', shortCode: '' };
    const raw = String(inputState).trim();
    const upper = raw.toUpperCase().replace(/\s+/g, ' ');

    if (DEFAULT_STATE_MAPPINGS[upper]) {
        return DEFAULT_STATE_MAPPINGS[upper];
    }

    const dbState = await StateMaster.findOne({
        $or: [
            { state: { $regex: new RegExp(`^${raw}$`, 'i') } },
            { shortCode: raw.toUpperCase() }
        ]
    }).lean();

    if (dbState) {
        return { state: dbState.state, shortCode: dbState.shortCode };
    }

    const words = raw.split(' ');
    const titleState = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const shortCode = raw.length >= 2 ? raw.substring(0, 2).toUpperCase() : raw.toUpperCase();
    return { state: titleState, shortCode };
};

// GET /api/city-master
exports.getAllCities = async (req, res) => {
    try {
        const { search, country, state, district, status, page, limit } = req.query;
        let filter = {};

        if (country) filter.country = country;
        if (state) filter.state = state;
        if (district) filter.district = district;
        if (status) filter.status = status;

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { country: regex },
                { state: regex },
                { stateCode: regex },
                { district: regex },
                { area: regex },
                { city: regex },
                { pincode: regex }
            ];
        }

        const total = await CityMaster.countDocuments(filter);
        let query = CityMaster.find(filter).sort({ state: 1, district: 1, city: 1 });

        if (limit !== 'all') {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
            query = query.skip((pageNum - 1) * limitNum).limit(limitNum);

            const cities = await query.lean();
            return res.json({
                success: true,
                count: cities.length,
                total,
                page: pageNum,
                totalPages: Math.ceil(total / limitNum) || 1,
                data: cities
            });
        } else {
            const cities = await query.lean();
            return res.json({ success: true, count: cities.length, total, data: cities });
        }
    } catch (error) {
        console.error('Error fetching city master list:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching city master data' });
    }
};

// GET /api/city-master/:id
exports.getCityById = async (req, res) => {
    try {
        const item = await CityMaster.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'City entry not found' });
        }
        return res.json({ success: true, data: item });
    } catch (error) {
        console.error('Error fetching city entry:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching city entry' });
    }
};

// POST /api/city-master
exports.createCity = async (req, res) => {
    try {
        const { country, state, stateCode, district, area, city, pincode, status } = req.body;

        if (!state || !state.trim() || !district || !district.trim() || !city || !city.trim() || !pincode) {
            return res.status(400).json({ success: false, message: 'State, District, City, and Pincode are required' });
        }

        const cleanPincode = String(pincode).trim().replace(/\D/g, '');
        if (cleanPincode.length !== 6) {
            return res.status(400).json({ success: false, message: 'Pincode must be exactly 6 numeric digits' });
        }

        const normalizedDistrict = district.trim().replace(/\s+/g, ' ').toLowerCase();
        const normalizedCity = city.trim().replace(/\s+/g, ' ').toLowerCase();

        // Check duplicate under same district
        const existing = await CityMaster.find({
            district: { $regex: new RegExp(`^${normalizedDistrict}$`, 'i') }
        });

        const isDuplicate = existing.some(item => 
            item.city.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedCity
        );

        if (isDuplicate) {
            return res.status(400).json({ 
                success: false, 
                message: `City '${city.trim()}' already exists under district '${district.trim()}'. Duplicates are prohibited under the same district.` 
            });
        }

        const stateInfo = stateCode ? { state: state.trim(), shortCode: stateCode.trim().toUpperCase() } : await resolveStateMapping(state.trim());

        const newCity = new CityMaster({
            country: country || 'India',
            state: stateInfo.state || state.trim(),
            stateCode: stateInfo.shortCode || '',
            district: district.trim(),
            area: area ? area.trim() : '',
            city: city.trim(),
            pincode: cleanPincode,
            status: status || 'Active',
            createdBy: req.user?._id
        });

        await newCity.save();
        return res.status(201).json({ success: true, message: 'City entry created successfully', data: newCity });
    } catch (error) {
        console.error('Error creating city entry:', error);
        return res.status(500).json({ success: false, message: error.message || 'Server error creating city entry' });
    }
};

// PUT /api/city-master/:id
exports.updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const { country, state, stateCode, district, area, city, pincode, status } = req.body;

        const existingItem = await CityMaster.findById(id);
        if (!existingItem) {
            return res.status(404).json({ success: false, message: 'City entry not found' });
        }

        if (pincode) {
            const cleanPincode = String(pincode).trim().replace(/\D/g, '');
            if (cleanPincode.length !== 6) {
                return res.status(400).json({ success: false, message: 'Pincode must be exactly 6 numeric digits' });
            }
            existingItem.pincode = cleanPincode;
        }

        if (district && city) {
            const normalizedDistrict = district.trim().replace(/\s+/g, ' ').toLowerCase();
            const normalizedCity = city.trim().replace(/\s+/g, ' ').toLowerCase();

            const duplicates = await CityMaster.find({
                _id: { $ne: id },
                district: { $regex: new RegExp(`^${normalizedDistrict}$`, 'i') }
            });

            const isDuplicate = duplicates.some(item => 
                item.city.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedCity
            );

            if (isDuplicate) {
                return res.status(400).json({ 
                    success: false, 
                    message: `City '${city.trim()}' already exists under district '${district.trim()}'.` 
                });
            }
        }

        if (country) existingItem.country = country.trim();
        if (state) {
            existingItem.state = state.trim();
            const stateInfo = stateCode ? { state: state.trim(), shortCode: stateCode.trim().toUpperCase() } : await resolveStateMapping(state.trim());
            existingItem.stateCode = stateInfo.shortCode || '';
        } else if (stateCode) {
            existingItem.stateCode = stateCode.trim().toUpperCase();
        }

        if (district) existingItem.district = district.trim();
        if (area !== undefined) existingItem.area = area.trim();
        if (city) existingItem.city = city.trim();
        if (status) existingItem.status = status;
        existingItem.updatedBy = req.user?._id;

        await existingItem.save();
        return res.json({ success: true, message: 'City entry updated successfully', data: existingItem });
    } catch (error) {
        console.error('Error updating city entry:', error);
        return res.status(500).json({ success: false, message: error.message || 'Server error updating city entry' });
    }
};

// DELETE /api/city-master/:id
exports.deleteCity = async (req, res) => {
    try {
        const deleted = await CityMaster.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'City entry not found' });
        }
        return res.json({ success: true, message: 'City entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting city entry:', error);
        return res.status(500).json({ success: false, message: 'Server error deleting city entry' });
    }
};

// POST /api/city-master/upload
exports.uploadCityMaster = async (req, res) => {
    try {
        let rows = [];
        if (req.file) {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } else if (Array.isArray(req.body?.data)) {
            rows = req.body.data;
        } else {
            return res.status(400).json({ success: false, message: 'No file or data array provided for upload' });
        }

        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Uploaded sheet or array is empty' });
        }

        const dbStates = await StateMaster.find().lean();
        const stateLookup = {};
        dbStates.forEach(s => {
            const normName = s.state.toUpperCase().replace(/\s+/g, ' ');
            stateLookup[normName] = { state: s.state, shortCode: s.shortCode };
            if (s.shortCode) stateLookup[s.shortCode.toUpperCase()] = { state: s.state, shortCode: s.shortCode };
        });

        Object.keys(DEFAULT_STATE_MAPPINGS).forEach(k => {
            if (!stateLookup[k]) stateLookup[k] = DEFAULT_STATE_MAPPINGS[k];
        });

        let insertedCount = 0;
        let batchOps = [];
        const BATCH_SIZE = 5000;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rawOffice = row.officename || row.office || row.city || row.City || '';
            const rawPincode = String(row.pincode || row.Pincode || row.pin || '').trim().replace(/\D/g, '');
            const rawState = String(row.statename || row.state || row.State || '').trim();
            const rawDistrict = String(row.district || row.District || '').trim();

            if (!rawOffice && !rawPincode && !rawState) continue;

            const pincode = rawPincode.padStart(6, '0').slice(-6);

            let mappedState = rawState;
            let mappedCode = '';
            if (rawState) {
                const norm = rawState.toUpperCase().replace(/\s+/g, ' ');
                if (stateLookup[norm]) {
                    mappedState = stateLookup[norm].state;
                    mappedCode = stateLookup[norm].shortCode;
                } else {
                    const fallback = await resolveStateMapping(rawState);
                    mappedState = fallback.state;
                    mappedCode = fallback.shortCode;
                }
            }

            const cityClean = rawOffice.trim() || 'Unknown City';
            const districtClean = rawDistrict.trim() || cityClean;

            batchOps.push({
                updateOne: {
                    filter: { pincode, city: cityClean, state: mappedState },
                    update: {
                        $set: {
                            country: 'India',
                            state: mappedState,
                            stateCode: mappedCode,
                            district: districtClean,
                            area: cityClean,
                            city: cityClean,
                            pincode,
                            status: 'Active',
                            updatedAt: new Date()
                        }
                    },
                    upsert: true
                }
            });

            if (batchOps.length >= BATCH_SIZE) {
                const resBatch = await CityMaster.bulkWrite(batchOps, { ordered: false });
                insertedCount += (resBatch.upsertedCount || 0) + (resBatch.modifiedCount || 0);
                batchOps = [];
            }
        }

        if (batchOps.length > 0) {
            const resBatch = await CityMaster.bulkWrite(batchOps, { ordered: false });
            insertedCount += (resBatch.upsertedCount || 0) + (resBatch.modifiedCount || 0);
        }

        return res.json({
            success: true,
            message: `Successfully processed ${rows.length} rows. Uploaded/updated ${insertedCount} entries in City Master.`,
            count: insertedCount,
            totalRows: rows.length
        });
    } catch (error) {
        console.error('Error in uploadCityMaster:', error);
        return res.status(500).json({ success: false, message: error.message || 'Server error processing Excel upload' });
    }
};
