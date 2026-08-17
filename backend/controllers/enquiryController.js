const Enquiry = require('../models/Enquiry');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');
const { updateActivityDate, logStatusChange } = require('../utils/activityHelper');
const { broadcastCrmUpdate } = require('../config/socket');

let indexDropped = false;

const ensureIndexDropped = async () => {
    if (indexDropped) return;
    try {
        const db = mongoose.connection.db;
        if (!db) {
            console.warn('[Migration Warning] Database connection not ready for index drop check');
            return;
        }
        const collections = await db.listCollections({ name: 'enquiries' }).toArray();
        if (collections.length > 0) {
            const indexes = await db.collection('enquiries').indexes();
            const hasLegacyIndex = indexes.some(idx => idx.name === 'enquiryNo_1');
            if (hasLegacyIndex) {
                console.log('[Migration] Found legacy unique index enquiryNo_1 on enquiries. Dropping it...');
                await db.collection('enquiries').dropIndex('enquiryNo_1');
                console.log('[Migration] Successfully dropped legacy unique index enquiryNo_1.');
            }
        }
        indexDropped = true;
    } catch (err) {
        console.error('[Migration Error] Failed to drop legacy index:', err.message);
    }
};

const cleanEnquiryBody = (body) => {
    if (!body) return body;
    
    // Clean header fields
    if (body.assignedTo && typeof body.assignedTo === 'object') {
        body.assignedTo = body.assignedTo._id ? body.assignedTo._id.toString() : null;
    }
    if (body.assignedTo === '' || body.assignedTo === 'null' || body.assignedTo === 'undefined') {
        body.assignedTo = null;
    }

    if (body.createdBy && typeof body.createdBy === 'object') {
        body.createdBy = body.createdBy._id ? body.createdBy._id.toString() : null;
    }
    if (!body.createdBy || body.createdBy === '' || body.createdBy === 'null' || body.createdBy === 'undefined') {
        delete body.createdBy;
    }

    if (body.customerId && typeof body.customerId === 'object') {
        body.customerId = body.customerId._id ? body.customerId._id.toString() : null;
    }
    if (!body.customerId || body.customerId === '' || body.customerId === 'null') {
        delete body.customerId;
    }

    if (body.followUpDate === '') {
        delete body.followUpDate;
    }
    if (body.requiredDeliveryDate === '') {
        delete body.requiredDeliveryDate;
    }
    
    // Clean items
    if (Array.isArray(body.items)) {
        body.items = body.items.map(item => {
            const cleanedItem = { ...item };
            const isManualBool = Boolean(cleanedItem.isManual || cleanedItem.itemCategory === 'Manual');
            cleanedItem.isManual = isManualBool;
            cleanedItem.itemCategory = isManualBool ? 'Manual' : 'Added';

            if (cleanedItem.productId && typeof cleanedItem.productId === 'object') {
                cleanedItem.productId = cleanedItem.productId._id;
            }
            if (!cleanedItem.productId || cleanedItem.productId === '') {
                delete cleanedItem.productId;
            }

            if (cleanedItem.finalVendor && typeof cleanedItem.finalVendor === 'object') {
                cleanedItem.finalVendor = cleanedItem.finalVendor._id;
            }
            if (!cleanedItem.finalVendor || cleanedItem.finalVendor === '') {
                delete cleanedItem.finalVendor;
            }

            if (Array.isArray(cleanedItem.vendors)) {
                cleanedItem.vendors = cleanedItem.vendors
                    .map(v => (v && typeof v === 'object') ? v._id : v)
                    .filter(v => v && v !== '');
            }

            if (Array.isArray(cleanedItem.vendorQuotes)) {
                cleanedItem.vendorQuotes = cleanedItem.vendorQuotes.map(vq => {
                    const cleanedVq = { ...vq };
                    if (cleanedVq.vendorId && typeof cleanedVq.vendorId === 'object') {
                        cleanedVq.vendorId = cleanedVq.vendorId._id;
                    }
                    if (!cleanedVq.vendorId || cleanedVq.vendorId === '') {
                        delete cleanedVq.vendorId;
                    }
                    if (cleanedVq.price === '') {
                        delete cleanedVq.price;
                    }
                    return cleanedVq;
                }).filter(vq => vq.vendorId);
            }
            return cleanedItem;
        });
    }

    // Clean visits
    if (Array.isArray(body.visits)) {
        body.visits = body.visits.map(v => {
            const cleanedV = { ...v };
            if (cleanedV.assignedTo && typeof cleanedV.assignedTo === 'object') {
                cleanedV.assignedTo = cleanedV.assignedTo._id ? cleanedV.assignedTo._id.toString() : null;
            }
            if (cleanedV.assignedTo === '' || cleanedV.assignedTo === 'null' || cleanedV.assignedTo === 'undefined') {
                cleanedV.assignedTo = null;
            }
            if (cleanedV.createdBy && typeof cleanedV.createdBy === 'object') {
                cleanedV.createdBy = cleanedV.createdBy._id ? cleanedV.createdBy._id.toString() : null;
            }
            if (!cleanedV.createdBy || cleanedV.createdBy === '' || cleanedV.createdBy === 'null' || cleanedV.createdBy === 'undefined') {
                delete cleanedV.createdBy;
            }
            return cleanedV;
        });
    }

    return body;
};

const generateEnquiryNumber = async (companyId) => {
    const currentYear = new Date().getFullYear();
    const prefix = `${currentYear}-`;
    const filter = { enquiryNo: new RegExp(`^${prefix}`) };
    if (companyId) filter.companyId = companyId;

    const existingEnquiries = await Enquiry.find(filter).select('enquiryNo').lean();
    let maxSeq = 0;
    existingEnquiries.forEach(e => {
        if (e.enquiryNo) {
            const str = String(e.enquiryNo).trim();
            const parts = str.split('-');
            if (parts.length >= 2) {
                const seq = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }
        }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(2, '0');
    return `${prefix}${seqStr}`;
};

exports.createEnquiry = async (req, res) => {
    try {
        await ensureIndexDropped();
        req.body = cleanEnquiryBody(req.body);

        // Auto-generate enquiry number if left empty
        if (!req.body.enquiryNo || String(req.body.enquiryNo).trim() === '') {
            req.body.enquiryNo = await generateEnquiryNumber(req.user?.companyId);
        }

        const { enquiryNo } = req.body;
        const exists = await Enquiry.findOne({ enquiryNo }).select('_id').lean();
        if (exists) {
            console.error(`[Enquiry Create Error] Enquiry with number ${enquiryNo} already exists`);
            return res.status(400).json({ 
                message: `Enquiry number "${enquiryNo}" already exists in the system. Please enter a different number or leave it blank to auto-generate a unique number.` 
            });
        }

        const newEnquiry = new Enquiry({
            ...req.body,
            companyId: req.user?.companyId,
            createdBy: req.user?._id,
            lastActivityDate: new Date() // Set initial activity date
        });

        await newEnquiry.save();
        broadcastCrmUpdate('ENQUIRY', 'CREATE', newEnquiry);
        res.status(201).json(newEnquiry);
    } catch (err) {
        console.error('[Enquiry Create Error] Exception caught during save:', err);
        
        // Catch duplicate key errors gracefully
        if (err.code === 11000 || err.message.includes('E11000') || err.message.includes('duplicate key')) {
            return res.status(400).json({ 
                message: 'This Enquiry Number is already in use. Please enter a unique number or leave it blank to auto-generate.' 
            });
        }

        res.status(400).json({ message: err.message });
    }
};

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

const isAdminOrManagerUser = (user) => {
    if (!user || !user.role) return false;
    const role = user.role.toLowerCase();
    return role === 'admin' || role === 'manager' || role === 'super_admin' || role === 'superadmin';
};

const Salesperson = require('../models/Salesperson');

const getHierarchyUserAndStaffIds = async (user) => {
    if (!user) {
        return { selfUserIds: [], selfSalespersonIds: [], teamUserIds: [], teamSalespersonIds: [] };
    }

    const companyId = user.companyId;
    const currentUserIdStr = (user.id || user._id || '').toString();
    const currentUserEmail = (user.email || '').toLowerCase().trim();

    const [allUsers, allEmployees] = await Promise.all([
        User.find({ companyId }).select('_id email reportsTo').lean(),
        EmployeeProfile.find({ companyId }).select('_id email reportingTo userId').lean()
    ]);

    const userIdByEmail = new Map();
    allUsers.forEach(u => {
        if (u.email) userIdByEmail.set(u.email.toLowerCase().trim(), u._id.toString());
    });

    const empIdByEmail = new Map();
    const empIdByUserId = new Map();
    allEmployees.forEach(e => {
        const eIdStr = e._id.toString();
        if (e.email) empIdByEmail.set(e.email.toLowerCase().trim(), eIdStr);
        if (e.userId) empIdByUserId.set(e.userId.toString(), eIdStr);
    });

    let currentEmpIdStr = empIdByUserId.get(currentUserIdStr);
    if (!currentEmpIdStr && currentUserEmail) {
        currentEmpIdStr = empIdByEmail.get(currentUserEmail);
    }

    const teamUserIdsSet = new Set();
    const teamEmailsSet = new Set();
    const userQueue = [currentUserIdStr];
    const empQueue = currentEmpIdStr ? [currentEmpIdStr] : [];
    const visitedUsers = new Set([currentUserIdStr]);
    const visitedEmps = currentEmpIdStr ? new Set([currentEmpIdStr]) : new Set();

    while (userQueue.length > 0) {
        const parentUserId = userQueue.shift();
        allUsers.forEach(u => {
            const uIdStr = u._id.toString();
            const parentId = u.reportsTo ? u.reportsTo.toString() : null;
            if (parentId === parentUserId && !visitedUsers.has(uIdStr)) {
                visitedUsers.add(uIdStr);
                teamUserIdsSet.add(uIdStr);
                if (u.email) teamEmailsSet.add(u.email.toLowerCase().trim());
                userQueue.push(uIdStr);

                const linkedEmpId = empIdByUserId.get(uIdStr) || (u.email ? empIdByEmail.get(u.email.toLowerCase().trim()) : null);
                if (linkedEmpId && !visitedEmps.has(linkedEmpId)) {
                    visitedEmps.add(linkedEmpId);
                    empQueue.push(linkedEmpId);
                }
            }
        });
    }

    while (empQueue.length > 0) {
        const parentEmpId = empQueue.shift();
        allEmployees.forEach(e => {
            const eIdStr = e._id.toString();
            const parentId = e.reportingTo ? (e.reportingTo._id || e.reportingTo).toString() : null;
            if (parentId === parentEmpId && !visitedEmps.has(eIdStr)) {
                visitedEmps.add(eIdStr);
                if (e.email) teamEmailsSet.add(e.email.toLowerCase().trim());
                if (e.userId) teamUserIdsSet.add(e.userId.toString());
                if (e.email && userIdByEmail.has(e.email.toLowerCase().trim())) {
                    const matchedUserId = userIdByEmail.get(e.email.toLowerCase().trim());
                    teamUserIdsSet.add(matchedUserId);
                    if (!visitedUsers.has(matchedUserId)) {
                        visitedUsers.add(matchedUserId);
                        userQueue.push(matchedUserId);
                    }
                }
                empQueue.push(eIdStr);
            }
        });
    }

    teamUserIdsSet.delete(currentUserIdStr);

    const selfEmails = currentUserEmail ? [currentUserEmail] : [];
    const teamEmails = Array.from(teamEmailsSet);

    const [selfSalespeople, teamSalespeople] = await Promise.all([
        selfEmails.length ? Salesperson.find({ companyId, email: { $in: selfEmails } }).select('_id').lean() : [],
        teamEmails.length ? Salesperson.find({ companyId, email: { $in: teamEmails } }).select('_id').lean() : []
    ]);

    return {
        selfUserIds: [currentUserIdStr],
        selfSalespersonIds: selfSalespeople.map(s => s._id.toString()),
        teamUserIds: Array.from(teamUserIdsSet),
        teamSalespersonIds: teamSalespeople.map(s => s._id.toString())
    };
};

const populateAssignedToFallback = async (itemsList) => {
    if (!itemsList) return itemsList;
    const isArray = Array.isArray(itemsList);
    const list = isArray ? itemsList : [itemsList];

    const unpopulatedIds = [];
    list.forEach(e => {
        if (e.assignedTo) {
            if (typeof e.assignedTo === 'object' && !e.assignedTo.name && e.assignedTo._id) {
                unpopulatedIds.push(e.assignedTo._id.toString());
            } else if (typeof e.assignedTo === 'string' || e.assignedTo instanceof mongoose.Types.ObjectId) {
                unpopulatedIds.push(e.assignedTo.toString());
            }
        }
        if (Array.isArray(e.visits)) {
            e.visits.forEach(v => {
                if (v && v.assignedTo) {
                    if (typeof v.assignedTo === 'object' && !v.assignedTo.name && v.assignedTo._id) {
                        unpopulatedIds.push(v.assignedTo._id.toString());
                    } else if (typeof v.assignedTo === 'string' || v.assignedTo instanceof mongoose.Types.ObjectId) {
                        unpopulatedIds.push(v.assignedTo.toString());
                    }
                }
            });
        }
    });

    if (unpopulatedIds.length === 0) return isArray ? list : list[0];

    const [users, salespersons] = await Promise.all([
        User.find({ _id: { $in: unpopulatedIds } }).select('_id name email role').lean(),
        Salesperson.find({ _id: { $in: unpopulatedIds } }).select('_id name email role').lean()
    ]);

    const userMap = new Map();
    users.forEach(u => userMap.set(u._id.toString(), { _id: u._id, name: u.name, email: u.email, role: u.role || 'Sales Executive' }));
    salespersons.forEach(s => {
        if (!userMap.has(s._id.toString())) {
            userMap.set(s._id.toString(), { _id: s._id, name: s.name, email: s.email, role: s.role || 'Salesperson' });
        }
    });

    list.forEach(e => {
        if (e.assignedTo) {
            const rawId = (typeof e.assignedTo === 'object' ? e.assignedTo._id : e.assignedTo || '').toString();
            if (rawId && userMap.has(rawId)) {
                e.assignedTo = userMap.get(rawId);
            }
        }
        if (Array.isArray(e.visits)) {
            e.visits.forEach(v => {
                if (v && v.assignedTo) {
                    const rawVId = (typeof v.assignedTo === 'object' ? v.assignedTo._id : v.assignedTo || '').toString();
                    if (rawVId && userMap.has(rawVId)) {
                        v.assignedTo = userMap.get(rawVId);
                    }
                }
            });
        }
    });

    return isArray ? list : list[0];
};

exports.getAllEnquiries = async (req, res) => {
    try {
        await ensureIndexDropped();
        const filter = {};
        if (req.user?.companyId) {
            filter.companyId = req.user.companyId;
        }

        if (req.query.assignedTo && typeof req.query.assignedTo === 'string' && req.query.assignedTo.trim() !== '' && req.query.assignedTo !== 'null' && req.query.assignedTo !== 'undefined') {
            filter.assignedTo = req.query.assignedTo.trim();
        }
        if (req.query.status && typeof req.query.status === 'string' && req.query.status.trim() !== '' && req.query.status !== 'null' && req.query.status !== 'undefined') {
            filter.status = req.query.status.trim();
        }

        const andConditions = [];
        const tab = (req.query.tab || '').toLowerCase().trim();
        const hierarchyInfo = await getHierarchyUserAndStaffIds(req.user);

        const unassignedCondition = [
            { assignedTo: { $exists: false } },
            { assignedTo: null }
        ];

        if (tab === 'my') {
            const selfUserObjIds = hierarchyInfo.selfUserIds.map(id => new mongoose.Types.ObjectId(id));
            const selfSalesObjIds = hierarchyInfo.selfSalespersonIds.map(id => new mongoose.Types.ObjectId(id));

            const myIdsCombined = [...hierarchyInfo.selfUserIds, ...hierarchyInfo.selfSalespersonIds];
            const myObjIdsCombined = [...selfUserObjIds, ...selfSalesObjIds];
            const allMyTargets = [...myObjIdsCombined, ...myIdsCombined];

            andConditions.push({
                $or: [
                    { assignedTo: { $in: allMyTargets } },
                    {
                        createdBy: { $in: allMyTargets },
                        $or: unassignedCondition
                    }
                ]
            });
        } else if (tab === 'team') {
            const teamUserObjIds = hierarchyInfo.teamUserIds.map(id => new mongoose.Types.ObjectId(id));
            const teamSalesObjIds = hierarchyInfo.teamSalespersonIds.map(id => new mongoose.Types.ObjectId(id));

            const teamIdsCombined = [...hierarchyInfo.teamUserIds, ...hierarchyInfo.teamSalespersonIds];
            const teamObjIdsCombined = [...teamUserObjIds, ...teamSalesObjIds];
            const allTeamTargets = [...teamObjIdsCombined, ...teamIdsCombined];

            if (allTeamTargets.length > 0) {
                andConditions.push({
                    $or: [
                        { assignedTo: { $in: allTeamTargets } },
                        {
                            createdBy: { $in: allTeamTargets },
                            $or: unassignedCondition
                        }
                    ]
                });
            } else {
                andConditions.push({ _id: null });
            }
        } else if (tab === 'all') {
            if (!isAdminOrManagerUser(req.user)) {
                const allUserIds = [...hierarchyInfo.selfUserIds, ...hierarchyInfo.teamUserIds, ...hierarchyInfo.selfSalespersonIds, ...hierarchyInfo.teamSalespersonIds];
                const allUserObjIds = allUserIds.map(id => new mongoose.Types.ObjectId(id));
                const allCombined = [...allUserObjIds, ...allUserIds];

                andConditions.push({
                    $or: [
                        { assignedTo: { $in: allCombined } },
                        {
                            createdBy: { $in: allCombined },
                            $or: unassignedCondition
                        }
                    ]
                });
            }
        } else {
            if (!isAdminOrManagerUser(req.user)) {
                const allUserIds = [...hierarchyInfo.selfUserIds, ...hierarchyInfo.teamUserIds, ...hierarchyInfo.selfSalespersonIds, ...hierarchyInfo.teamSalespersonIds];
                const allUserObjIds = allUserIds.map(id => new mongoose.Types.ObjectId(id));
                const allCombined = [...allUserObjIds, ...allUserIds];

                andConditions.push({
                    $or: [
                        { assignedTo: { $in: allCombined } },
                        {
                            createdBy: { $in: allCombined },
                            $or: unassignedCondition
                        }
                    ]
                });
            }
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        let enquiries = await Enquiry.find(filter)
            .select('enquiryNo enquiryDate followUpDate customerId partners status probability priority projectName requiredDeliveryDate items assignedTo visits createdBy lastActivityDate createdAt updatedAt remarks closureReason lossReason grandTotal')
            .populate('customerId', 'customerName companyName gstin')
            .populate('createdBy', 'name email')
            .populate('visits.assignedTo', 'name email role')
            .populate('visits.createdBy', 'name email')
            .populate('items.productId')
            .populate('items.vendors', 'name')
            .populate('items.vendorQuotes.vendorId', 'name')
            .populate('items.finalVendor', 'name')
            .collation({ locale: 'en', numericOrdering: true })
            .sort({ enquiryNo: -1 })
            .lean();

        enquiries = await populateAssignedToFallback(enquiries);

        res.json(enquiries);
    } catch (err) {
        console.error('[Enquiry Fetch Error] Exception caught:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getEnquiryById = async (req, res) => {
    try {
        const { id } = req.params;
        let enquiry = await Enquiry.findById(id)
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
            .populate('createdBy', 'name email')
            .populate('visits.assignedTo', 'name email role')
            .populate('visits.createdBy', 'name email')
            .populate('items.productId')
            .populate('items.vendors', 'name')
            .populate('items.vendorQuotes.vendorId', 'name')
            .populate('items.finalVendor', 'name')
            .lean();
        if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });
        enquiry = await populateAssignedToFallback(enquiry);
        res.json(enquiry);
    } catch (err) {
        console.error('[Enquiry Fetch ID Error] Exception caught:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.updateEnquiry = async (req, res) => {
    try {
        req.body = cleanEnquiryBody(req.body);
        const { id } = req.params;
        const { status, lossReason } = req.body;

        // Get current enquiry to track status change
        const currentEnquiry = await Enquiry.findById(id);
        if (!currentEnquiry) {
            return res.status(404).json({ message: 'Enquiry not found' });
        }

        // Enforce: If changing to Lost, lossReason MUST be provided
        if (status === 'Lost' && !lossReason) {
            console.error(`[Enquiry Update Error] Missing lossReason for Lost status on Enquiry ID ${id}`);
            return res.status(400).json({
                message: 'lossReason is required when marking enquiry as Lost',
                requiredField: 'lossReason',
                validValues: ['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other']
            });
        }

        // Log status change if happening
        if (status && status !== currentEnquiry.status) {
            await logStatusChange(id, currentEnquiry.status, status, req.user?._id);
        }

        // Update enquiry (lastActivityDate will be auto-updated by Mongoose hook)
        let updatedEnquiry = await Enquiry.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true, runValidators: true }
        )
        .populate('customerId', 'customerName companyName gstin')
        .populate('createdBy', 'name email')
        .populate('visits.assignedTo', 'name email role')
        .populate('visits.createdBy', 'name email')
        .populate('items.productId')
        .populate('items.vendors', 'name')
        .populate('items.vendorQuotes.vendorId', 'name')
        .populate('items.finalVendor', 'name')
        .lean();

        updatedEnquiry = await populateAssignedToFallback(updatedEnquiry);

        // Ensure activity date is updated
        await updateActivityDate(id, 'status_update');

        broadcastCrmUpdate('ENQUIRY', 'UPDATE', updatedEnquiry);
        res.json(updatedEnquiry);
    } catch (err) {
        console.error('[Enquiry Update Error] Exception caught during update:', err);

        // Catch duplicate key errors gracefully on updates
        if (err.code === 11000 || err.message.includes('E11000') || err.message.includes('duplicate key')) {
            return res.status(400).json({ 
                message: 'The Enquiry Number you entered is already in use. Please choose a unique number.' 
            });
        }

        res.status(400).json({ message: err.message });
    }
};

exports.deleteEnquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Enquiry.findByIdAndDelete(id);
        if (!result) return res.status(404).json({ message: 'Enquiry not found' });
        broadcastCrmUpdate('ENQUIRY', 'DELETE', { id });
        res.json({ message: 'Enquiry deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.searchHierarchical = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.json([]);
        }

        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = new RegExp(escapeRegex(q.trim()), 'i');
        const enquiries = await Enquiry.find({
            $or: [
                { enquiryNo: queryRegex },
                { title: queryRegex },
                { customerName: queryRegex },
                { contactPerson: queryRegex },
                { email: queryRegex },
                { phone: queryRegex }
            ]
        }).limit(5).lean();

        const results = enquiries.map(enq => {
            const followUpCount = enq.followUpDate ? 1 : 0;
            const taskCount = Array.isArray(enq.items) ? enq.items.length : 0;
            const quotationCount = enq.quotationId ? 1 : (enq.status === 'Quoted' ? 1 : 0);
            const notesCount = enq.notes ? 1 : 0;
            const attachmentsCount = Array.isArray(enq.attachments) ? enq.attachments.length : 0;

            return {
                id: enq._id,
                enquiryNo: enq.enquiryNo || 'ENQ',
                customerName: enq.customerName || 'Customer',
                title: enq.title || enq.customerName || 'Enquiry Record',
                submodules: [
                    { key: 'customer', label: 'Customer Details', path: `/customers`, icon: '👤', hasData: true },
                    { key: 'followups', label: 'Follow-ups', count: followUpCount, path: `/enquiries/edit/${enq._id}?tab=followup`, icon: '📞', hasData: true },
                    { key: 'tasks', label: 'Tasks', count: taskCount, path: `/enquiries/edit/${enq._id}?tab=tasks`, icon: '✅', hasData: taskCount > 0 },
                    { key: 'quotations', label: 'Quotations', count: quotationCount, path: `/quotations`, icon: '📄', hasData: quotationCount > 0 },
                    { key: 'deals', label: 'Deals', path: `/sales/deals`, icon: '💼', hasData: true },
                    { key: 'notes', label: 'Notes', count: notesCount, path: `/enquiries/edit/${enq._id}?tab=notes`, icon: '📝', hasData: notesCount > 0 },
                    { key: 'attachments', label: 'Attachments', count: attachmentsCount, path: `/enquiries/edit/${enq._id}?tab=attachments`, icon: '📎', hasData: attachmentsCount > 0 },
                    { key: 'timeline', label: 'Timeline', path: `/enquiries/edit/${enq._id}?tab=timeline`, icon: '🕒', hasData: true }
                ]
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
