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

const generateEnquiryNumber = async (companyId) => {
    const year = new Date().getFullYear();
    const prefix = 'ENQ';
    
    // Find counter for enquiry type, companyId, prefix, and year
    // Scoped per tenant (companyId)
    const counter = await Counter.findOneAndUpdate(
        { type: 'enquiry', companyId: companyId || null, prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}/${year}/${seqStr}`;
};

const cleanEnquiryBody = (body) => {
    if (!body) return body;
    
    // Clean header fields
    if (body.assignedTo === '') {
        delete body.assignedTo;
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
            if (cleanedItem.finalVendor === '') {
                delete cleanedItem.finalVendor;
            }
            if (Array.isArray(cleanedItem.vendors)) {
                cleanedItem.vendors = cleanedItem.vendors.filter(v => v !== '');
            }
            if (Array.isArray(cleanedItem.vendorQuotes)) {
                cleanedItem.vendorQuotes = cleanedItem.vendorQuotes.map(vq => {
                    const cleanedVq = { ...vq };
                    if (cleanedVq.vendorId === '') {
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
    return body;
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

exports.getAllEnquiries = async (req, res) => {
    try {
        await ensureIndexDropped();
        const enquiries = await Enquiry.find()
            .select('enquiryNo enquiryDate followUpDate customerId partners status probability priority projectName requiredDeliveryDate items createdBy lastActivityDate createdAt updatedAt')
            .populate('customerId', 'customerName companyName gstin')
            .populate('createdBy', 'name email')
            .populate('items.productId')
            .populate('items.vendors', 'name')
            .populate('items.vendorQuotes.vendorId', 'name')
            .populate('items.finalVendor', 'name')
            .collation({ locale: 'en', numericOrdering: true })
            .sort({ enquiryNo: -1 })
            .lean();
        res.json(enquiries);
    } catch (err) {
        console.error('[Enquiry Fetch Error] Exception caught:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getEnquiryById = async (req, res) => {
    try {
        const { id } = req.params;
        const enquiry = await Enquiry.findById(id)
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
            .populate('items.productId')
            .populate('items.vendors', 'name')
            .populate('items.vendorQuotes.vendorId', 'name')
            .populate('items.finalVendor', 'name')
            .lean();
        if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });
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
        const updatedEnquiry = await Enquiry.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true, runValidators: true }
        );

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
