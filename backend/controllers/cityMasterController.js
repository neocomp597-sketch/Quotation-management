const CityMaster = require('../models/CityMaster');

// GET /api/city-master
exports.getAllCities = async (req, res) => {
    try {
        const { search, country, state, district, status } = req.query;
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
                { district: regex },
                { area: regex },
                { city: regex },
                { pincode: regex }
            ];
        }

        const cities = await CityMaster.find(filter).sort({ state: 1, district: 1, city: 1 }).lean();
        return res.json({ success: true, count: cities.length, data: cities });
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
        const { country, state, district, area, city, pincode, status } = req.body;

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

        const newCity = new CityMaster({
            country: country || 'India',
            state: state.trim(),
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
        const { country, state, district, area, city, pincode, status } = req.body;

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
        if (state) existingItem.state = state.trim();
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
