const Salesperson = require('../models/Salesperson');
const User = require('../models/User');
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');
const { invalidateViaQueueOrNow } = require('../queues/cacheInvalidationQueue');

const SALESPERSON_CACHE_TTL_SECONDS = Number(process.env.SALESPERSON_CACHE_TTL_SECONDS || 600);

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const getAllSalespersons = async (req, res) => {
    try {
        const cacheKey = makeCacheKey('salespersons:list', req);
        const { redis, value: cachedSalespersons } = await getCachedJson(cacheKey);
        if (cachedSalespersons) {
            return res.json(cachedSalespersons);
        }

        // Fetch all Salespersons in the collection
        const salespersons = await Salesperson.find()
            .populate('territoryId', 'name')
            .sort({ name: 1 })
            .lean();

        // Fetch all sales Users
        const userFilter = {
            role: { $in: ['sales', 'SALESPERSON', 'SalesPerson', 'salesperson'] },
            status: { $ne: false },
            isActive: { $ne: false },
        };
        const users = await User.find(userFilter)
            .select('_id name email mobile role status isActive createdAt updatedAt')
            .sort({ name: 1 })
            .lean();

        // Merge users into salespersons list if not already present
        const salespersonEmails = new Set(salespersons.map(s => s.email?.toLowerCase()).filter(Boolean));
        const salespersonNames = new Set(salespersons.map(s => s.name?.toLowerCase()).filter(Boolean));

        const merged = [...salespersons];

        for (const user of users) {
            const hasEmail = user.email && salespersonEmails.has(user.email.toLowerCase());
            const hasName = user.name && salespersonNames.has(user.name.toLowerCase());
            if (!hasEmail && !hasName) {
                merged.push({
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile || '',
                    role: user.role || 'sales',
                    status: (user.status === false || user.isActive === false) ? 'Inactive' : 'Active',
                    territoryId: null,
                    isUser: true
                });
            }
        }

        merged.sort((a, b) => a.name.localeCompare(b.name));

        if (req.query.page || req.query.limit) {
            const { page, limit, skip } = getPagination(req.query);
            const paginatedData = merged.slice(skip, skip + limit);
            const response = {
                data: paginatedData,
                pagination: {
                    page,
                    limit,
                    total: merged.length,
                    pages: Math.ceil(merged.length / limit) || 1
                }
            };
            await setCachedJson(redis, cacheKey, response, SALESPERSON_CACHE_TTL_SECONDS);
            return res.json(response);
        }

        await setCachedJson(redis, cacheKey, merged, SALESPERSON_CACHE_TTL_SECONDS);
        res.json(merged);
    } catch (error) {
        console.error('Get salespersons error:', error);
        res.status(500).json({ message: 'Error fetching salespersons' });
    }
};

const createSalesperson = async (req, res) => {
    try {
        const { name, email, mobile, territoryId, status } = req.body;
        const newSalesperson = new Salesperson({ 
            name, 
            email, 
            mobile, 
            territoryId: territoryId || null, 
            status: status || 'Active' 
        });
        await newSalesperson.save();
        await invalidateViaQueueOrNow('salespersons:*');
        res.status(201).json(newSalesperson);
    } catch (error) {
        console.error('Create salesperson error:', error);
        res.status(500).json({ message: 'Error creating salesperson' });
    }
};

const updateSalesperson = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile, territoryId, status } = req.body;
        const mongoose = require('mongoose');

        let salesperson = await Salesperson.findById(id);
        if (!salesperson && mongoose.Types.ObjectId.isValid(id)) {
            // Check if there is a salesperson with the same email or name
            salesperson = await Salesperson.findOne({
                $or: [{ email }, { name }]
            });
        }

        if (salesperson) {
            salesperson.name = name || salesperson.name;
            salesperson.email = email || salesperson.email;
            salesperson.mobile = mobile || salesperson.mobile;
            salesperson.territoryId = territoryId !== undefined ? (territoryId || null) : salesperson.territoryId;
            salesperson.status = status || salesperson.status;
            await salesperson.save();
        } else {
            // Create a new Salesperson document
            salesperson = new Salesperson({
                name,
                email,
                mobile,
                territoryId: territoryId || null,
                status: status || 'Active'
            });
            await salesperson.save();
        }

        await invalidateViaQueueOrNow('salespersons:*');
        res.json(salesperson);
    } catch (error) {
        console.error('Update salesperson error:', error);
        res.status(500).json({ message: 'Error updating salesperson' });
    }
};

module.exports = {
    getAllSalespersons,
    createSalesperson,
    updateSalesperson
};
