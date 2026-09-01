const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const Priority = require('../models/Priority');
const Customer = require('../models/Customer');
const User = require('../models/User');
const CustomerContact = require('../models/CustomerContact');
const { broadcastCrmUpdate } = require('../config/socket');

const generateTicketNumber = async (companyId) => {
    const year = new Date().getFullYear();
    const prefix = 'CSM';
    const counter = await Counter.findOneAndUpdate(
        { type: 'ticket', companyId: companyId || null, prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqStr}`;
};

exports.createTicket = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const ticketNo = await generateTicketNumber(companyId);

        // Fetch SLA times from priority
        const priority = await Priority.findOne({ _id: req.body.priorityId, companyId });
        if (!priority) {
            return res.status(400).json({ message: 'Invalid priority selected' });
        }

        const now = new Date();
        const responseDue = new Date(now.getTime() + priority.responseSlaHours * 60 * 60 * 1000);
        const resolutionDue = new Date(now.getTime() + priority.resolutionSlaHours * 60 * 60 * 1000);
        const ticketBody = { ...req.body };

        // Clean empty string values for optional ObjectId fields to avoid Cast to ObjectId errors
        const optionalObjectIdFields = ['contactId', 'contactDesignationId', 'productId', 'assetId', 'invoiceId', 'assignedTeamId', 'assignedEngineerId', 'assignedSalespersonId'];
        for (const field of optionalObjectIdFields) {
            if (ticketBody[field] === '') {
                ticketBody[field] = null;
            }
        }

        // Validate pincode is present and not empty
        if (!ticketBody.pincode || !String(ticketBody.pincode).trim()) {
            return res.status(400).json({ message: 'Pincode is a mandatory field' });
        }
        const cleanPincode = String(ticketBody.pincode).trim();

        if (ticketBody.contactId) {
            const contact = await CustomerContact.findOne({
                _id: ticketBody.contactId,
                customerId: ticketBody.customerId,
                companyId
            }).populate('designationId', 'name').lean();

            if (!contact) {
                return res.status(400).json({ message: 'Invalid contact person selected' });
            }

            ticketBody.contactName = contact.contactName || '';
            ticketBody.contactDesignationId = contact.designationId?._id || null;
            ticketBody.contactDesignation = contact.designationId?.name || '';
            ticketBody.contactPhone = contact.mobileNo || '';
            ticketBody.contactEmail = contact.email || '';
        }

        // Auto-Assignment Logic: Pincode > Engineer OR Pincode > Territory > Engineer
        let assignedEngineerId = null;
        const Territory = require('../models/Territory');
        const Engineer = require('../models/Engineer');
        
        console.log(`[DEBUG Auto-Assign Engineer] Starting lookup for pincode: "${cleanPincode}" under companyId: "${companyId}"`);
        
        // 1. Try direct matching: find active engineer who has this pincode directly assigned
        let matchedEngineer = await Engineer.findOne({
            companyId,
            pincodes: cleanPincode,
            status: 'Active'
        }).lean();
        
        if (matchedEngineer) {
            console.log(`[DEBUG Auto-Assign Engineer] Matched Engineer directly: "${matchedEngineer.name}" (${matchedEngineer._id})`);
            assignedEngineerId = matchedEngineer._id;
        } else {
            // 2. Fallback matching: find territory that matches pincode, then active engineer assigned to that territory
            const territory = await Territory.findOne({
                companyId,
                'rules.pincodes': cleanPincode
            }).lean();
            
            console.log('[DEBUG Auto-Assign Engineer] Matched Territory:', territory ? `${territory.name} (${territory._id})` : 'NONE');
            
            if (territory) {
                if (territory.engineerId) {
                    matchedEngineer = await Engineer.findOne({
                        _id: territory.engineerId,
                        status: 'Active'
                    }).lean();
                } else {
                    matchedEngineer = await Engineer.findOne({
                        companyId,
                        territoryId: territory._id,
                        status: 'Active'
                    }).lean();
                }
                
                console.log('[DEBUG Auto-Assign Engineer] Matched Engineer by Territory:', matchedEngineer ? `${matchedEngineer.name} (${matchedEngineer._id})` : 'NONE');
                
                if (matchedEngineer) {
                    assignedEngineerId = matchedEngineer._id;
                }
            }
        }

        const timelineEntry = {
            activityType: 'Created',
            description: `Ticket created via ${ticketBody.source || 'Web Portal'}` + (assignedEngineerId ? ' & Auto-assigned to Engineer' : ''),
            performedBy: req.user?.id
        };

        const ticketData = {
            ...ticketBody,
            ticketNo,
            companyId,
            createdBy: req.user?.id,
            branchId: ticketBody.branchId || req.user?.branchId || null,
            pincode: cleanPincode,
            assignedSalespersonId: null, // Stop salesperson auto-assignment
            assignedEngineerId,
            status: ticketBody.status || (assignedEngineerId ? 'Assigned' : 'Open'),
            slaResponseDue: responseDue,
            slaResolutionDue: resolutionDue,
            timeline: [timelineEntry]
        };

        const populatedTicket = await Ticket.create(ticketData);
        broadcastCrmUpdate('TICKET', 'CREATE', populatedTicket);
        res.status(201).json(populatedTicket);
    } catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ message: error.message || 'Error creating ticket' });
    }
};

const Engineer = require('../models/Engineer');

const isAdminOrManagerUser = (user) => {
    if (!user || !user.role) return false;
    const role = user.role.toLowerCase();
    return role === 'admin' || role === 'manager' || role === 'super_admin' || role === 'superadmin';
};

const getEngineerForUser = async (user) => {
    if (!user || !user.email) return null;
    return await Engineer.findOne({
        email: user.email,
        companyId: user.companyId
    }).lean();
};

const EmployeeProfile = require('../models/EmployeeProfile');

const getHierarchyUserAndStaffIds = async (user) => {
    if (!user) {
        return {
            selfUserIds: [], selfEngineerIds: [], selfSalespersonIds: [],
            teamUserIds: [], teamEngineerIds: [], teamSalespersonIds: []
        };
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
    if (currentUserEmail) teamEmailsSet.delete(currentUserEmail);

    const selfUserIds = [currentUserIdStr];
    const selfEmails = currentUserEmail ? [currentUserEmail] : [];

    const teamUserIds = Array.from(teamUserIdsSet);
    const teamEmails = Array.from(teamEmailsSet);

    const Engineer = require('../models/Engineer');
    const Salesperson = require('../models/Salesperson');

    const [selfEngineers, selfSalespeople, teamEngineers, teamSalespeople] = await Promise.all([
        selfEmails.length ? Engineer.find({ companyId, email: { $in: selfEmails } }).select('_id').lean() : [],
        selfEmails.length ? Salesperson.find({ companyId, email: { $in: selfEmails } }).select('_id').lean() : [],
        teamEmails.length ? Engineer.find({ companyId, email: { $in: teamEmails } }).select('_id').lean() : [],
        teamEmails.length ? Salesperson.find({ companyId, email: { $in: teamEmails } }).select('_id').lean() : []
    ]);

    return {
        selfUserIds,
        selfEngineerIds: selfEngineers.map(e => e._id),
        selfSalespersonIds: selfSalespeople.map(s => s._id),
        teamUserIds,
        teamEngineerIds: teamEngineers.map(e => e._id),
        teamSalespersonIds: teamSalespeople.map(s => s._id)
    };
};

exports.getTickets = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { companyId };

        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.priorityId) filter.priorityId = req.query.priorityId;

        const { getScopedBranchIds } = require('../utils/accessControl');
        const userBranchIds = getScopedBranchIds(req.user);
        const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes((req.user?.role || '').toUpperCase());

        if (req.query.branchId) {
            filter.branchId = req.query.branchId;
        } else if (!isAdmin && userBranchIds.length > 0) {
            filter.branchId = { $in: userBranchIds };
        }

        const andConditions = [];
        
        // Cascading Reporting Hierarchy & Ticket Visibility Filter
        const tab = (req.query.tab || '').toLowerCase().trim();
        const hierarchyInfo = await getHierarchyUserAndStaffIds(req.user);

        if (tab === 'my') {
            const selfUserObjIds = hierarchyInfo.selfUserIds.map(id => new mongoose.Types.ObjectId(id));
            const myOr = [{ createdBy: { $in: selfUserObjIds } }];
            if (hierarchyInfo.selfEngineerIds.length > 0) {
                myOr.push({ assignedEngineerId: { $in: hierarchyInfo.selfEngineerIds } });
                myOr.push({ assignedEngineerIds: { $in: hierarchyInfo.selfEngineerIds } });
            }
            if (hierarchyInfo.selfSalespersonIds.length > 0) {
                myOr.push({ assignedSalespersonId: { $in: hierarchyInfo.selfSalespersonIds } });
            }
            andConditions.push({ $or: myOr });
        } else if (tab === 'team') {
            const teamUserObjIds = hierarchyInfo.teamUserIds.map(id => new mongoose.Types.ObjectId(id));
            const teamOr = [];
            if (teamUserObjIds.length > 0) {
                teamOr.push({ createdBy: { $in: teamUserObjIds } });
            }
            if (hierarchyInfo.teamEngineerIds.length > 0) {
                teamOr.push({ assignedEngineerId: { $in: hierarchyInfo.teamEngineerIds } });
                teamOr.push({ assignedEngineerIds: { $in: hierarchyInfo.teamEngineerIds } });
            }
            if (hierarchyInfo.teamSalespersonIds.length > 0) {
                teamOr.push({ assignedSalespersonId: { $in: hierarchyInfo.teamSalespersonIds } });
            }
            if (teamOr.length > 0) {
                andConditions.push({ $or: teamOr });
            } else {
                // User has no reportees in hierarchy -> 0 team tickets
                andConditions.push({ _id: null });
            }
        } else if (tab === 'all') {
            if (!isAdminOrManagerUser(req.user)) {
                const allUserObjIds = [...hierarchyInfo.selfUserIds, ...hierarchyInfo.teamUserIds].map(id => new mongoose.Types.ObjectId(id));
                const allEngIds = [...hierarchyInfo.selfEngineerIds, ...hierarchyInfo.teamEngineerIds];
                const allSalesIds = [...hierarchyInfo.selfSalespersonIds, ...hierarchyInfo.teamSalespersonIds];
                const allOr = [{ createdBy: { $in: allUserObjIds } }];
                if (allEngIds.length > 0) {
                    allOr.push({ assignedEngineerId: { $in: allEngIds } });
                    allOr.push({ assignedEngineerIds: { $in: allEngIds } });
                }
                if (allSalesIds.length > 0) allOr.push({ assignedSalespersonId: { $in: allSalesIds } });
                andConditions.push({ $or: allOr });
            } else if (req.query.assignedEngineerId) {
                filter.$or = [
                    { assignedEngineerId: req.query.assignedEngineerId },
                    { assignedEngineerIds: req.query.assignedEngineerId }
                ];
            }
        } else {
            // Default handling when no tab specified
            if (!isAdminOrManagerUser(req.user)) {
                const allUserObjIds = [...hierarchyInfo.selfUserIds, ...hierarchyInfo.teamUserIds].map(id => new mongoose.Types.ObjectId(id));
                const allEngIds = [...hierarchyInfo.selfEngineerIds, ...hierarchyInfo.teamEngineerIds];
                const allSalesIds = [...hierarchyInfo.selfSalespersonIds, ...hierarchyInfo.teamSalespersonIds];
                const visibilityOr = [{ createdBy: { $in: allUserObjIds } }];
                if (allEngIds.length > 0) {
                    visibilityOr.push({ assignedEngineerId: { $in: allEngIds } });
                    visibilityOr.push({ assignedEngineerIds: { $in: allEngIds } });
                }
                if (allSalesIds.length > 0) visibilityOr.push({ assignedSalespersonId: { $in: allSalesIds } });
                andConditions.push({ $or: visibilityOr });
            } else if (req.query.assignedEngineerId) {
                filter.$or = [
                    { assignedEngineerId: req.query.assignedEngineerId },
                    { assignedEngineerIds: req.query.assignedEngineerId }
                ];
            }
        }

        if (req.query.isManual === 'true') {
            andConditions.push({
                $or: [
                    { isManual: true },
                    { manualInvoiceNo: { $exists: true, $ne: '' } },
                    { description: /--- Uploaded Images ---/ }
                ]
            });
        } else if (req.query.isManual === 'false') {
            andConditions.push({
                isManual: { $ne: true },
                manualInvoiceNo: { $in: [null, ''] },
                $or: [
                    { description: { $exists: false } },
                    { description: null },
                    { description: '' },
                    { description: { $not: /--- Uploaded Images ---/ } }
                ]
            });
        }

        const search = String(req.query.search || '').trim();
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            andConditions.push({
                $or: [
                    { ticketNo: regex },
                    { issueTitle: regex },
                    { contactName: regex }
                ]
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
        const skip = (page - 1) * limit;

        const [tickets, total] = await Promise.all([
            Ticket.find(filter)
                .populate('customerId', 'customerName companyName email mobile')
                .populate('contactDesignationId', 'name')
                .populate('categoryId', 'name')
                .populate('typeId', 'name')
                .populate('priorityId', 'name color')
                .populate('assignedTeamId', 'name')
                .populate('assignedEngineerId', 'name email mobile')
                .populate('assignedEngineerIds', 'name email mobile status')
                .populate('productId', 'productName productCode')
                .populate('assetId', 'serialNumber')
                .populate('assignedSalespersonId', 'name email mobile')
                .populate('branchId', 'name code branchPrefix')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Ticket.countDocuments(filter)
        ]);

        res.json({
            data: tickets,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ message: error.message || 'Error fetching tickets' });
    }
};

exports.getTicketById = async (req, res) => {
    try {
        if (req.params.id === 'customers') {
            return exports.getTicketCustomers(req, res);
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ticket ID format' });
        }
        const ticket = await Ticket.findOne({ _id: req.params.id, companyId: req.user?.companyId })
            .populate('customerId')
            .populate('contactId')
            .populate('contactDesignationId')
            .populate('productId')
            .populate('assetId')
            .populate('invoiceId')
            .populate('categoryId')
            .populate('typeId')
            .populate('priorityId')
            .populate('assignedTeamId')
            .populate('assignedEngineerId', 'name email mobile status')
            .populate('assignedEngineerIds', 'name email mobile status')
            .populate('assignedSalespersonId')
            .populate('timeline.performedBy', 'name email role')
            .lean();

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (!isAdminOrManagerUser(req.user)) {
            const engineer = await getEngineerForUser(req.user);
            if (!engineer) {
                return res.status(403).json({ message: 'Access denied: You can only view complaints assigned to you.' });
            }
            const engIdStr = engineer._id.toString();
            const primaryEngIdStr = ticket.assignedEngineerId?._id?.toString() || ticket.assignedEngineerId?.toString();
            const assignedEngIdsStr = (ticket.assignedEngineerIds || []).map(e => e._id?.toString() || e.toString());
            const isAssigned = (primaryEngIdStr === engIdStr) || assignedEngIdsStr.includes(engIdStr);

            if (!isAssigned) {
                return res.status(403).json({ message: 'Access denied: You can only view complaints assigned to you.' });
            }
        }

        res.json(ticket);
    } catch (error) {
        console.error('Get ticket details error:', error);
        res.status(500).json({ message: error.message || 'Error fetching ticket' });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const ticketBody = { ...req.body };
        const companyId = req.user?.companyId;

        const existingTicket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!existingTicket) return res.status(404).json({ message: 'Ticket not found' });

        if (!isAdminOrManagerUser(req.user)) {
            const engineer = await getEngineerForUser(req.user);
            const ticketEngineerId = existingTicket.assignedEngineerId?.toString();
            const assignedEngIdsStr = (existingTicket.assignedEngineerIds || []).map(e => e.toString());
            const isAssigned = engineer && (ticketEngineerId === engineer._id.toString() || assignedEngIdsStr.includes(engineer._id.toString()));
            if (!isAssigned) {
                return res.status(403).json({ message: 'Access denied: You can only update complaints assigned to you.' });
            }
        }

        const optionalObjectIdFields = ['contactId', 'contactDesignationId', 'productId', 'assetId', 'invoiceId', 'assignedTeamId', 'assignedEngineerId', 'assignedSalespersonId'];
        for (const field of optionalObjectIdFields) {
            if (ticketBody[field] === '') {
                ticketBody[field] = null;
            }
        }

        if (Array.isArray(ticketBody.assignedEngineerIds)) {
            ticketBody.assignedEngineerIds = ticketBody.assignedEngineerIds.filter(Boolean);
            if (!ticketBody.assignedEngineerId && ticketBody.assignedEngineerIds.length > 0) {
                ticketBody.assignedEngineerId = ticketBody.assignedEngineerIds[0];
            }
        } else if (ticketBody.assignedEngineerId) {
            ticketBody.assignedEngineerIds = [ticketBody.assignedEngineerId];
        }

        // Validate pincode if provided and run auto-assignment
        if (ticketBody.pincode !== undefined) {
            if (!ticketBody.pincode || !String(ticketBody.pincode).trim()) {
                return res.status(400).json({ message: 'Pincode is a mandatory field' });
            }
            ticketBody.pincode = String(ticketBody.pincode).trim();

            const Territory = require('../models/Territory');
            const Engineer = require('../models/Engineer');
            console.log(`[DEBUG Auto-Assign Update] Starting lookup for pincode: "${ticketBody.pincode}" under companyId: "${companyId}"`);
            
            let assignedEngineerId = null;
            
            // 1. Direct match
            let matchedEngineer = await Engineer.findOne({
                companyId,
                pincodes: ticketBody.pincode,
                status: 'Active'
            }).lean();
            
            if (matchedEngineer) {
                console.log(`[DEBUG Auto-Assign Update] Matched Engineer directly: "${matchedEngineer.name}" (${matchedEngineer._id})`);
                assignedEngineerId = matchedEngineer._id;
            } else {
                // 2. Fallback match to territory
                const territory = await Territory.findOne({
                    companyId,
                    'rules.pincodes': ticketBody.pincode
                }).lean();

                console.log('[DEBUG Auto-Assign Update] Matched Territory:', territory ? `${territory.name} (${territory._id})` : 'NONE');

                if (territory) {
                    matchedEngineer = await Engineer.findOne({
                        companyId,
                        territoryId: territory._id,
                        status: 'Active'
                    }).lean();
                    
                    console.log('[DEBUG Auto-Assign Update] Matched Engineer by Territory:', matchedEngineer ? `${matchedEngineer.name} (${matchedEngineer._id})` : 'NONE');
                    
                    if (matchedEngineer) {
                        assignedEngineerId = matchedEngineer._id;
                    }
                }
            }
            
            ticketBody.assignedEngineerId = assignedEngineerId;
            ticketBody.assignedEngineerIds = assignedEngineerId ? [assignedEngineerId] : [];
            if (assignedEngineerId) {
                ticketBody.status = 'Assigned';
            }
            ticketBody.assignedSalespersonId = null; // Salesperson is not auto-assigned
        }

        const ticket = await Ticket.findOneAndUpdate(
            { _id: req.params.id, companyId },
            ticketBody,
            { new: true, runValidators: true }
        );
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.assignTicket = async (req, res) => {
    try {
        const { assignedTeamId, assignedEngineerId, assignedEngineerIds } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const Engineer = require('../models/Engineer');

        let rawEngIds = [];
        if (Array.isArray(assignedEngineerIds)) {
            rawEngIds = assignedEngineerIds.filter(Boolean);
        } else if (assignedEngineerId) {
            rawEngIds = [assignedEngineerId];
        }

        const validEngIds = [...new Set(rawEngIds)].filter(id => mongoose.Types.ObjectId.isValid(id));
        const oldPrimaryEngineerId = ticket.assignedEngineerId;

        ticket.assignedTeamId = assignedTeamId || null;
        ticket.assignedEngineerIds = validEngIds;
        ticket.assignedEngineerId = validEngIds.length > 0 ? validEngIds[0] : null;
        
        if (ticket.status === 'Open' && (assignedTeamId || validEngIds.length > 0)) {
            ticket.status = 'Assigned';
        }

        let desc = 'Ticket assignment updated';
        let assignedEngNames = [];
        if (validEngIds.length > 0) {
            const engs = await Engineer.find({ _id: { $in: validEngIds } }).select('name').lean();
            assignedEngNames = engs.map(e => e.name);
            desc = `Ticket assigned to engineer(s): ${assignedEngNames.join(', ')}`;
        } else if (assignedTeamId) {
            desc = `Ticket assigned to team`;
        }

        // Record history if primary engineer changed
        const newPrimaryEngineerId = ticket.assignedEngineerId;
        if (newPrimaryEngineerId && String(oldPrimaryEngineerId || '') !== String(newPrimaryEngineerId)) {
            let oldEngineerName = 'Unassigned';
            if (oldPrimaryEngineerId) {
                const oldEng = await Engineer.findById(oldPrimaryEngineerId).select('name').lean();
                if (oldEng) oldEngineerName = oldEng.name;
            }
            const primaryEng = await Engineer.findById(newPrimaryEngineerId).select('name').lean();
            const validUserId = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null;
            ticket.reassignmentHistory.push({
                fromEngineerId: oldPrimaryEngineerId || null,
                fromEngineerName: oldEngineerName,
                toEngineerId: newPrimaryEngineerId,
                toEngineerName: primaryEng?.name || 'Assigned Engineer',
                reason: 'Workload',
                notes: `Assigned engineer list updated (${assignedEngNames.join(', ')})`,
                reassignedBy: validUserId,
                reassignedByName: req.user?.name || 'System User',
                reassignedAt: new Date()
            });
        }

        const validUserId = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null;
        ticket.timeline.push({
            activityType: 'Assigned',
            description: desc,
            performedBy: validUserId
        });

        await ticket.save();

        const updatedTicket = await Ticket.findById(ticket._id)
            .populate('customerId')
            .populate('contactId')
            .populate('contactDesignationId')
            .populate('productId')
            .populate('assetId')
            .populate('invoiceId')
            .populate('categoryId')
            .populate('typeId')
            .populate('priorityId')
            .populate('assignedTeamId')
            .populate('assignedEngineerId', 'name email mobile status')
            .populate('assignedEngineerIds', 'name email mobile status')
            .populate('assignedSalespersonId')
            .populate('timeline.performedBy', 'name email role')
            .lean();

        broadcastCrmUpdate('TICKET', 'UPDATE', updatedTicket);
        res.json(updatedTicket);
    } catch (error) {
        console.error('Assign ticket error:', error);
        res.status(500).json({ message: error.message || 'Error assigning ticket' });
    }
};

exports.reassignTicket = async (req, res) => {
    try {
        const { toEngineerId, notes } = req.body;
        let reason = req.body.reason;
        const companyId = req.user?.companyId;

        if (!toEngineerId) {
            return res.status(400).json({ message: 'Target engineer is required' });
        }

        const validReasons = ['Leave', 'Sick', 'Emergency', 'Workload', 'Other'];
        if (!reason || !validReasons.includes(reason)) {
            reason = 'Workload';
        }

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const Engineer = require('../models/Engineer');
        const Notification = require('../models/Notification');

        let fromEngineerName = 'Unassigned';
        if (ticket.assignedEngineerId) {
            const oldEng = await Engineer.findById(ticket.assignedEngineerId).select('name').lean();
            if (oldEng) fromEngineerName = oldEng.name;
        }

        let targetEng = await Engineer.findOne({ _id: toEngineerId, companyId }).select('name userId email employeeId').lean();
        if (!targetEng) {
            targetEng = await Engineer.findOne({
                companyId,
                $or: [{ userId: toEngineerId }, { employeeId: toEngineerId }]
            }).select('name userId email employeeId').lean();
        }
        if (!targetEng && mongoose.Types.ObjectId.isValid(toEngineerId)) {
            targetEng = await Engineer.findById(toEngineerId).select('name userId email employeeId').lean();
        }

        if (!targetEng) {
            return res.status(404).json({ message: 'Selected target engineer not found' });
        }

        const fromEngineerId = ticket.assignedEngineerId;
        ticket.assignedEngineerId = targetEng._id;
        ticket.status = 'Assigned';

        const validUserId = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null;
        const reassignmentRecord = {
            fromEngineerId,
            fromEngineerName,
            toEngineerId: targetEng._id,
            toEngineerName: targetEng.name,
            reason,
            notes: notes || '',
            reassignedBy: validUserId,
            reassignedByName: req.user?.name || 'User',
            reassignedAt: new Date()
        };

        ticket.reassignmentHistory.push(reassignmentRecord);

        const timelineDesc = `Ticket reassigned from ${fromEngineerName} to ${targetEng.name}. Reason: ${reason}${notes ? ` (${notes})` : ''}`;
        ticket.timeline.push({
            activityType: 'Reassigned',
            description: timelineDesc,
            performedBy: validUserId
        });

        await ticket.save();

        // Send notification to new engineer if assigned user exists
        if (targetEng.userId) {
            try {
                await Notification.create({
                    user: targetEng.userId,
                    companyId,
                    type: 'SYSTEM',
                    title: `Ticket Reassigned: ${ticket.ticketNo}`,
                    message: `Complaint '${ticket.issueTitle}' has been reassigned to you. Reason: ${reason}`
                });
            } catch (nErr) {
                console.warn('Failed to send notification for ticket reassignment:', nErr);
            }
        }

        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json({ success: true, message: 'Ticket reassigned successfully', ticket });
    } catch (error) {
        console.error('Reassign ticket error:', error);
        res.status(500).json({ message: error.message || 'Error reassigning ticket' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { status, isFirstCallResolved } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (!isAdminOrManagerUser(req.user)) {
            const engineer = await getEngineerForUser(req.user);
            const ticketEngineerId = ticket.assignedEngineerId?.toString();
            if (!engineer || !ticketEngineerId || ticketEngineerId !== engineer._id.toString()) {
                return res.status(403).json({ message: 'Access denied: You can only update status for complaints assigned to you.' });
            }
        }

        const oldStatus = ticket.status;
        ticket.status = status;

        const now = new Date();

        // Check response SLA on first response transition from Open/Assigned
        if (['In Progress', 'Pending Customer', 'Resolved'].includes(status) && !ticket.firstResponseAt) {
            ticket.firstResponseAt = now;
            if (ticket.slaResponseDue && now > ticket.slaResponseDue) {
                ticket.isSlaBreached.response = true;
            }
        }

        // Manage resolution timestamps
        if (status === 'Resolved') {
            ticket.resolvedAt = now;
            if (ticket.slaResolutionDue && now > ticket.slaResolutionDue) {
                ticket.isSlaBreached.resolution = true;
            }
            if (typeof isFirstCallResolved !== 'undefined') {
                ticket.isFirstCallResolved = isFirstCallResolved === true || isFirstCallResolved === 'true';
            }
        } else if (status === 'Closed') {
            ticket.closedAt = now;
        }

        ticket.timeline.push({
            activityType: 'StatusChange',
            description: `Status changed from ${oldStatus} to ${status}`,
            performedBy: req.user?.id
        });

        await ticket.save();
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json(ticket);
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ message: error.message || 'Error updating status' });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { text, attachments } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (!isAdminOrManagerUser(req.user)) {
            const engineer = await getEngineerForUser(req.user);
            const ticketEngineerId = ticket.assignedEngineerId?.toString();
            if (!engineer || !ticketEngineerId || ticketEngineerId !== engineer._id.toString()) {
                return res.status(403).json({ message: 'Access denied: You can only add comments to complaints assigned to you.' });
            }
        }

        const authorName = req.user?.name || 'Support Executive';
        const comment = {
            text,
            authorId: req.user?.id,
            authorName,
            attachments: attachments || [],
            createdAt: new Date()
        };

        ticket.comments.push(comment);

        ticket.timeline.push({
            activityType: 'CommentAdded',
            description: `Comment posted by ${authorName}`,
            performedBy: req.user?.id
        });

        await ticket.save();
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.status(201).json(comment);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: error.message || 'Error adding comment' });
    }
};

exports.escalateTicket = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (!isAdminOrManagerUser(req.user)) {
            const engineer = await getEngineerForUser(req.user);
            const ticketEngineerId = ticket.assignedEngineerId?.toString();
            if (!engineer || !ticketEngineerId || ticketEngineerId !== engineer._id.toString()) {
                return res.status(403).json({ message: 'Access denied: You can only escalate complaints assigned to you.' });
            }
        }

        ticket.escalationLevel += 1;
        ticket.status = 'Escalated';

        ticket.timeline.push({
            activityType: 'Escalated',
            description: `Ticket escalated to level ${ticket.escalationLevel}`,
            performedBy: req.user?.id
        });

        await ticket.save();
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json(ticket);
    } catch (error) {
        console.error('Escalate ticket error:', error);
        res.status(500).json({ message: error.message || 'Error escalating ticket' });
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        ticket.feedback = {
            rating,
            comment: comment || '',
            submittedAt: new Date()
        };

        ticket.timeline.push({
            activityType: 'Feedback',
            description: `Customer submitted feedback: Rating ${rating}/5`,
            performedBy: req.user?.id
        });

        await ticket.save();
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json(ticket);
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ message: error.message || 'Error submitting feedback' });
    }
};

exports.updateTicketLocation = async (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        ticket.location = {
            latitude: Number(latitude),
            longitude: Number(longitude),
            address: address || '',
            updatedAt: new Date()
        };

        const validUserId = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null;
        ticket.timeline.push({
            activityType: 'LocationUpdate',
            description: `GPS Location updated: ${address || `${latitude}, ${longitude}`}`,
            performedBy: validUserId
        });

        await ticket.save();
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json(ticket);
    } catch (error) {
        console.error('Update ticket location error:', error);
        res.status(500).json({ message: error.message || 'Error updating location' });
    }
};

exports.closeTicket = async (req, res) => {
    try {
        const { resolutionNotes, isFirstCallResolved, rating, comment, latitude, longitude, address } = req.body;
        const companyId = req.user?.companyId;

        const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const now = new Date();
        ticket.status = 'Closed';
        ticket.closedAt = now;
        if (!ticket.resolvedAt) {
            ticket.resolvedAt = now;
        }

        if (typeof isFirstCallResolved !== 'undefined') {
            ticket.isFirstCallResolved = Boolean(isFirstCallResolved);
        }

        if (latitude && longitude) {
            ticket.location = {
                latitude: Number(latitude),
                longitude: Number(longitude),
                address: address || '',
                updatedAt: now
            };
        }

        if (rating) {
            ticket.feedback = {
                rating: Number(rating),
                comment: comment || '',
                submittedAt: now
            };
        }

        const validUserId = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null;
        const desc = `Ticket closed${resolutionNotes ? `: ${resolutionNotes}` : ''}`;
        ticket.timeline.push({
            activityType: 'Closed',
            description: desc,
            performedBy: validUserId
        });

        await ticket.save();
        broadcastCrmUpdate('TICKET', 'UPDATE', ticket);
        res.json(ticket);
    } catch (error) {
        console.error('Close ticket error:', error);
        res.status(500).json({ message: error.message || 'Error closing ticket' });
    }
};

exports.getTicketCustomers = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const uniqueCustomerIds = await Ticket.find({ companyId }).distinct('customerId');
        
        const customers = await Customer.find({ 
            _id: { $in: uniqueCustomerIds },
            companyId 
        }).select('customerName companyName email mobile').lean();
        
        res.json(customers);
    } catch (error) {
        console.error('Get ticket customers error:', error);
        res.status(500).json({ message: error.message || 'Error fetching ticket customers' });
    }
};

exports.debugAutoAssign = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.query.companyId;
        const Territory = require('../models/Territory');
        const Salesperson = require('../models/Salesperson');
        const Ticket = require('../models/Ticket');
        
        const filter = companyId ? { companyId } : {};
        const territories = await Territory.find(filter).lean();
        const salespeople = await Salesperson.find().lean();
        const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(10).lean();
        
        res.json({
            companyId: companyId || 'All',
            territoriesCount: territories.length,
            salespeopleCount: salespeople.length,
            ticketsCount: tickets.length,
            territories,
            salespeople,
            tickets
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
