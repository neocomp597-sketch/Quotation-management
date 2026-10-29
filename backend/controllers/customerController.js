const Customer = require('../models/Customer');
const { invalidateCustomerCaches } = require('../utils/cacheInvalidation');
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');

const CUSTOMERS_LIST_CACHE_TTL_SECONDS = Number(process.env.CUSTOMERS_LIST_CACHE_TTL_SECONDS || 300);
const CUSTOMERS_DETAIL_CACHE_TTL_SECONDS = Number(process.env.CUSTOMERS_DETAIL_CACHE_TTL_SECONDS || 300);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    return { page, limit, skip: (page - 1) * limit };
};

const hasListParams = (query) => Boolean(query.page || query.limit || query.search);

const normalizeCustomerName = (value = '') => String(value || '').trim();

const buildExactMatch = (value = '') => new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');

// Whether customerName is a copy of the Company Trade Name (with the "-2" style suffix
// getUniqueCustomerName adds when another customer has that name), not a name saved on its own.
const followsCompanyName = (customer) => {
    const name = normalizeCustomerName(customer?.customerName).toLowerCase();
    const company = normalizeCustomerName(customer?.companyName).toLowerCase();
    return !name || name === company || name.replace(/-\d+$/, '') === company;
};

const getUniqueCustomerName = async (customerName, excludeId) => {
    const baseName = normalizeCustomerName(customerName);
    if (!baseName) return baseName;

    const query = { customerName: buildExactMatch(baseName) };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }

    const existing = await Customer.findOne(query).select('_id').lean();
    if (!existing) return baseName;

    for (let suffix = 2; suffix < 10000; suffix += 1) {
        const candidate = `${baseName}-${suffix}`;
        const candidateQuery = { customerName: buildExactMatch(candidate) };
        if (excludeId) {
            candidateQuery._id = { $ne: excludeId };
        }
        const match = await Customer.findOne(candidateQuery).select('_id').lean();
        if (!match) return candidate;
    }

    return `${baseName}-${Date.now().toString(36).toUpperCase()}`;
};

const buildCustomerQuery = async (req) => {
    const query = {};
    // Customers belong to the selected branch; shared Product and MGR masters are unaffected.
    if (req.user?.activeBranchId) query.branchId = req.user.activeBranchId;
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
        const Territory = require('../models/Territory');
        const userTerritories = await Territory.find({
            $or: [
                { manager: req.user.id },
                { salesReps: req.user.id }
            ]
        }).select('_id').lean();
        
        const territoryIds = userTerritories.map(t => t._id);
        
        query.$or = [
            { territory: { $in: territoryIds } },
            { createdBy: req.user.id }
        ];
    }

    if (req.query.territory) {
        query.territory = req.query.territory;
    }

    const search = String(req.query.search || '').trim();
    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        const searchOr = [
            { customerName: regex },
            { companyName: regex },
            { externalCode: regex },
            { contactPerson: regex },
            { gstin: regex },
            { mobile: regex },
            { email: regex },
        ];
        if (query.$or) {
            query.$and = [
                { $or: query.$or },
                { $or: searchOr }
            ];
            delete query.$or;
        } else {
            query.$or = searchOr;
        }
    }

    return query;
};

const findDuplicateCustomer = async (payload, excludeId) => {
    const checks = [];
    if (payload.gstin?.trim()) checks.push({ gstin: payload.gstin.trim().toUpperCase() });
    if (payload.mobile?.trim()) checks.push({ mobile: payload.mobile.trim() });
    if (payload.email?.trim()) checks.push({ email: payload.email.trim().toLowerCase() });
    if (payload.customerName?.trim()) checks.push({ customerName: buildExactMatch(payload.customerName) });
    if (!checks.length) return null;

    const query = { $or: checks };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }

    return Customer.findOne(query).select('companyName customerName gstin mobile email').lean();
};

/**
 * The customer that already uses this code. Codes are unique in the whole company, ignoring
 * case (models/Customer.js), so customers of other branches count too.
 */
const findCustomerWithCode = (code, excludeId) => {
    const value = String(code || '').trim();
    if (!value) return null;
    const query = { externalCode: value };
    if (excludeId) query._id = { $ne: excludeId };
    return Customer.findOne(query)
        .collation(Customer.CUSTOMER_CODE_COLLATION)
        .setOptions({ bypassBranch: true })
        .select('externalCode companyName customerName')
        .lean();
};

const duplicateCodeResponse = (res, code, existing) => res.status(409).json({
    code: 'DUPLICATE_CUSTOMER_CODE',
    message: existing
        ? `Customer code ${existing.externalCode || code} is already used by ${existing.companyName || existing.customerName}. Each customer needs its own code.`
        : `Customer code ${code} is already used by another customer. Each customer needs its own code.`,
    duplicate: existing || undefined
});

// Two people saving the same new code at once: the second save is refused by the unique index.
const isDuplicateCodeError = (error) => error?.code === 11000 && Boolean(error?.keyPattern?.externalCode);

// Create Customer
const createCustomer = async (req, res) => {
    let cleanExternalCode = '';
    try {
        const { externalCode, customerCode, code, customerName, companyName, contactPerson, gstin, billingAddress, shippingAddress, mobile, email, logoUrl, defaultDiscount, territory } = req.body;

        cleanExternalCode = String(externalCode || customerCode || code || '').trim();

        // Pincode validation helper
        const validatePincode = (addressObj, typeName) => {
            const raw = addressObj?.pincode;
            if (raw && String(raw).trim()) {
                const clean = String(raw).trim().replace(/\D/g, '');
                if (clean.length !== 6) {
                    return `${typeName} Pincode must be exactly 6 numeric digits (e.g. 400001). Got: "${raw}"`;
                }
            }
            return null;
        };

        const billPinErr = validatePincode(billingAddress, 'Billing');
        if (billPinErr) return res.status(400).json({ message: billPinErr });
        const shipPinErr = validatePincode(shippingAddress, 'Shipping');
        if (shipPinErr) return res.status(400).json({ message: shipPinErr });

        const duplicate = await findDuplicateCustomer({ gstin, mobile, email });
        if (duplicate) {
            return res.status(409).json({
                message: 'Customer already exists with same GSTIN, mobile, or email',
                duplicate
            });
        }
        const sameCode = await findCustomerWithCode(cleanExternalCode);
        if (sameCode) return duplicateCodeResponse(res, cleanExternalCode, sameCode);
        const targetCustName = customerName?.trim() || companyName?.trim() || cleanExternalCode;
        const uniqueCustomerName = await getUniqueCustomerName(targetCustName);

        const companyId = req.user?.companyId || req.headers['x-company-id'] || req.body.companyId;

        let assignedTerritory = territory;
        if (!assignedTerritory) {
            const { getAutoAssignedTerritory } = require('./territoryController');
            assignedTerritory = await getAutoAssignedTerritory(billingAddress, shippingAddress, companyId);
        }

        const newCustomer = new Customer({
            companyId,
            externalCode: cleanExternalCode,
            customerName: uniqueCustomerName,
            companyName: companyName?.trim() || uniqueCustomerName,
            contactPerson: normalizeCustomerName(contactPerson),
            gstin: gstin?.trim().toUpperCase(),
            billingAddress,
            shippingAddress,
            mobile: mobile?.trim(),
            email: email?.trim().toLowerCase(),
            logoUrl,
            defaultDiscount,
            territory: assignedTerritory || null,
            createdBy: req.user ? req.user.id : null
        });

        await newCustomer.save();
        invalidateCustomerCaches().catch(err => console.error("Cache invalidation error:", err));
        res.status(201).json(newCustomer);
    } catch (error) {
        if (isDuplicateCodeError(error)) return duplicateCodeResponse(res, cleanExternalCode);
        console.error("Error in createCustomer:", error);
        res.status(500).json({
            message: `Error creating customer: ${error.message}`,
            error: error.message
        });
    }
};

// Get All Customers
const getAllCustomers = async (req, res) => {
    try {
        const query = await buildCustomerQuery(req);

        const cacheKey = makeCacheKey('customers:list', req);
        const { redis, value: cachedCustomers } = await getCachedJson(cacheKey);
        if (cachedCustomers) {
            return res.json(cachedCustomers);
        }

        if (!hasListParams(req.query) && req.query.all !== 'false') {
            const customers = await Customer.find(query)
                .select('externalCode customerName companyName contactPerson gstin billingAddress mobile email logoUrl defaultDiscount territory createdAt')
                .populate('territory', 'name type')
                .sort({ createdAt: -1 })
                .lean();
            await setCachedJson(redis, cacheKey, customers, CUSTOMERS_LIST_CACHE_TTL_SECONDS);
            return res.json(customers);
        }

        const { page, limit, skip } = getPagination(req.query);
        const [customers, total] = await Promise.all([
            Customer.find(query)
                .select('externalCode customerName companyName contactPerson gstin billingAddress mobile email logoUrl defaultDiscount territory createdAt')
                .populate('territory', 'name type')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Customer.countDocuments(query),
        ]);

        const response = {
            data: customers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        };
        await setCachedJson(redis, cacheKey, response, CUSTOMERS_LIST_CACHE_TTL_SECONDS);
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
};

// Get Customer by ID
const getCustomerById = async (req, res) => {
    try {
        const cacheKey = `customers:detail:${req.user?.companyId || 'unknown'}:${req.params.id}`;
        const { redis, value: cachedCustomer } = await getCachedJson(cacheKey);
        if (cachedCustomer) {
            return res.json(cachedCustomer);
        }

        const customer = await Customer.findById(req.params.id)
            .select('externalCode customerName companyName contactPerson gstin billingAddress shippingAddress mobile email logoUrl defaultDiscount territory createdAt')
            .populate('territory', 'name type')
            .lean();
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        await setCachedJson(redis, cacheKey, customer, CUSTOMERS_DETAIL_CACHE_TTL_SECONDS);
        res.json(customer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customer' });
    }
};

// Update Customer
const updateCustomer = async (req, res) => {
    let cleanExternalCode;
    try {
        const { externalCode, customerCode, code, customerName, companyName, contactPerson, gstin, billingAddress, shippingAddress, mobile, email, logoUrl, defaultDiscount, territory } = req.body;

        cleanExternalCode = externalCode !== undefined || customerCode !== undefined || code !== undefined
            ? String(externalCode || customerCode || code || '').trim()
            : undefined;

        const validatePincode = (addressObj, typeName) => {
            const raw = addressObj?.pincode;
            if (raw && String(raw).trim()) {
                const clean = String(raw).trim().replace(/\D/g, '');
                if (clean.length !== 6) {
                    return `${typeName} Pincode must be exactly 6 numeric digits (e.g. 400001). Got: "${raw}"`;
                }
            }
            return null;
        };

        const billPinErr = validatePincode(billingAddress, 'Billing');
        if (billPinErr) return res.status(400).json({ message: billPinErr });
        const shipPinErr = validatePincode(shippingAddress, 'Shipping');
        if (shipPinErr) return res.status(400).json({ message: shipPinErr });

        const duplicate = await findDuplicateCustomer({ gstin, mobile, email }, req.params.id);
        if (duplicate) {
            return res.status(409).json({
                message: 'Customer already exists with same GSTIN, mobile, or email',
                duplicate
            });
        }
        const sameCode = await findCustomerWithCode(cleanExternalCode, req.params.id);
        if (sameCode) return duplicateCodeResponse(res, cleanExternalCode, sameCode);

        const existing = await Customer.findById(req.params.id).select('customerName companyName').lean();
        if (!existing) return res.status(404).json({ message: 'Customer not found' });
        // The Customer form does not send customerName: a copy of the Company Trade Name follows the
        // new company name, and a different name saved earlier (an import's Customer Name) is kept.
        const newCompanyName = companyName?.trim() || existing.companyName;
        const targetCustName = customerName?.trim()
            || (followsCompanyName(existing) ? newCompanyName : existing.customerName)
            || cleanExternalCode || 'Customer';
        const uniqueCustomerName = await getUniqueCustomerName(targetCustName, req.params.id);

        let assignedTerritory = territory;
        if (assignedTerritory === undefined) {
            const { getAutoAssignedTerritory } = require('./territoryController');
            const companyId = req.user?.companyId || req.headers['x-company-id'] || req.body.companyId;
            assignedTerritory = await getAutoAssignedTerritory(billingAddress, shippingAddress, companyId);
        }

        const updatePayload = {
            customerName: uniqueCustomerName,
            companyName: newCompanyName || uniqueCustomerName,
            gstin: gstin?.trim().toUpperCase(),
            billingAddress,
            shippingAddress,
            mobile: mobile?.trim(),
            email: email?.trim().toLowerCase(),
            logoUrl,
            defaultDiscount,
            territory: assignedTerritory !== undefined ? (assignedTerritory || null) : undefined,
        };
        if (cleanExternalCode !== undefined) {
            updatePayload.externalCode = cleanExternalCode;
        }
        if (contactPerson !== undefined) {
            updatePayload.contactPerson = normalizeCustomerName(contactPerson);
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, updatePayload, { new: true }).populate('territory', 'name type').lean();

        if (!updatedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        invalidateCustomerCaches().catch(err => console.error("Cache invalidation error:", err));
        res.json(updatedCustomer);
    } catch (error) {
        if (isDuplicateCodeError(error)) return duplicateCodeResponse(res, cleanExternalCode);
        console.error("Error in updateCustomer:", error);
        res.status(500).json({ 
            message: `Error updating customer: ${error.message}`,
            error: error.message
        });
    }
};

// Delete Customer
const deleteCustomer = async (req, res) => {
    try {
        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id).lean();

        if (!deletedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        invalidateCustomerCaches().catch(err => console.error("Cache invalidation error:", err));
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting customer' });
    }
};

// Bulk Delete Customers
const bulkDeleteCustomers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of customer IDs' });
        }

        const result = await Customer.deleteMany({ _id: { $in: ids } });
        invalidateCustomerCaches().catch(err => console.error("Cache invalidation error:", err));

        res.json({
            message: `${result.deletedCount} customers deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting customers' });
    }
};

// Bulk Update Customers
const bulkUpdateCustomers = async (req, res) => {
    try {
        const { ids, updateData } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of customer IDs' });
        }

        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'Please provide update data' });
        }

        const result = await Customer.updateMany(
            { _id: { $in: ids } },
            { $set: updateData }
        );
        invalidateCustomerCaches().catch(err => console.error("Cache invalidation error:", err));

        res.json({
            message: `${result.modifiedCount} customers updated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating customers' });
    }
};

// Check Duplicate Customer
const checkDuplicateCustomer = async (req, res) => {
    try {
        const { gstin, mobile, email, customerName, excludeId } = req.query;
        if (!gstin && !mobile && !email && !customerName) {
            return res.json({ isDuplicate: false });
        }
        const duplicate = await findDuplicateCustomer({ gstin, mobile, email, customerName }, excludeId);
        if (duplicate) {
            const suggestedCustomerName = customerName
                ? await getUniqueCustomerName(customerName, excludeId)
                : undefined;
            return res.json({ isDuplicate: true, duplicate, suggestedCustomerName });
        }
        res.json({ isDuplicate: false });
    } catch (error) {
        console.error('Error checking duplicate customer:', error);
        res.status(500).json({ message: 'Error checking duplicate customer' });
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    bulkUpdateCustomers,
    checkDuplicateCustomer,
};
