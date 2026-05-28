// Validation middleware for Enquiry operations
// Enforces data integrity rules

exports.validateEnquiryUpdate = (req, res, next) => {
    const { status, lossReason, assignedTo } = req.body;

    // Rule 1: If status is being changed to "Lost", lossReason is REQUIRED
    if (status === 'Lost' && !lossReason) {
        console.error('[Enquiry Validation Error] Status is Lost but lossReason is missing');
        return res.status(400).json({
            message: 'lossReason is required when status is "Lost"',
            requiredField: 'lossReason',
            validValues: ['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other']
        });
    }

    // Rule 2: Validate lossReason enum if provided
    const validLossReasons = ['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other'];
    if (lossReason && !validLossReasons.includes(lossReason)) {
        console.error(`[Enquiry Validation Error] Invalid lossReason value provided: ${lossReason}`);
        return res.status(400).json({
            message: 'Invalid lossReason value',
            providedValue: lossReason,
            validValues: validLossReasons
        });
    }

    // Rule 3: If lossReason is provided but status is not "Lost", warn (but allow)
    if (lossReason && status && status !== 'Lost') {
        console.warn(`[Enquiry Validation] lossReason provided for non-Lost status. Status: ${status}`);
    }

    // Rule 4: assignedTo validation (if provided, must be valid ObjectId)
    if (assignedTo) {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
            console.error(`[Enquiry Validation Error] Invalid assignedTo value: ${assignedTo}`);
            return res.status(400).json({
                message: 'Invalid assignedTo value. Must be a valid user ID.',
                providedValue: assignedTo
            });
        }
    }

    next();
};

// Middleware to ensure lastActivityDate is not manually overridden to past
exports.validateActivityDate = (req, res, next) => {
    if (req.body.lastActivityDate) {
        const providedDate = new Date(req.body.lastActivityDate);
        const now = new Date();

        // Don't allow manually setting to future date
        if (providedDate > now) {
            console.error(`[Enquiry Validation Error] lastActivityDate cannot be set to a future date: ${req.body.lastActivityDate}`);
            return res.status(400).json({
                message: 'lastActivityDate cannot be set to a future date',
                providedValue: req.body.lastActivityDate,
                currentDate: now
            });
        }
    }

    next();
};

// Validate lossReason on Lost enquiry
exports.validateLossEnquiry = async (req, res, next) => {
    const { id } = req.params;
    const { status, lossReason } = req.body;

    // If not changing status to Lost, skip
    if (status !== 'Lost') {
        return next();
    }

    // Status is Lost — lossReason is mandatory
    if (!lossReason) {
        console.error('[Enquiry Validation Error] Cannot mark enquiry as Lost without specifying lossReason');
        return res.status(400).json({
            message: 'Cannot mark enquiry as Lost without specifying lossReason',
            requiredField: 'lossReason',
            validValues: ['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other']
        });
    }

    next();
};

// Validate that critical fields are not nullified
exports.validateCriticalFields = (req, res, next) => {
    const forbiddenNulls = {
        customerId: 'Customer ID cannot be removed',
        enquiryNo: 'Enquiry number cannot be changed',
        enquiryDate: 'Enquiry date cannot be removed'
    };

    for (const [field, message] of Object.entries(forbiddenNulls)) {
        if (req.body[field] === null || req.body[field] === '') {
            console.error(`[Enquiry Validation Error] Nullified critical field: ${field}`);
            return res.status(400).json({
                message,
                field,
                providedValue: req.body[field]
            });
        }
    }

    next();
};
