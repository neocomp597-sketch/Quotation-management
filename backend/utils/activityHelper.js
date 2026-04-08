// Activity helper utility
// Centralized function to update lastActivityDate consistently across the system

const Enquiry = require('../models/Enquiry');

/**
 * Update enquiry's lastActivityDate to current time
 * Called whenever an important action happens on an enquiry
 *
 * @param {string} enquiryId - MongoDB ObjectId of enquiry
 * @param {string} source - Source of update (e.g., 'status_change', 'followup_update', 'vendor_quote')
 * @returns {Promise<void>}
 */
exports.updateActivityDate = async (enquiryId, source = 'manual_update') => {
    try {
        await Enquiry.findByIdAndUpdate(
            enquiryId,
            { lastActivityDate: new Date() },
            { new: true, runValidators: false }
        );
        console.log(`[Activity] Updated enquiry ${enquiryId} (source: ${source})`);
    } catch (err) {
        console.error(`[Activity Error] Failed to update activity date for ${enquiryId}:`, err.message);
        // Don't throw — logging only, activity date update is non-critical
    }
};

/**
 * Batch update activity dates for multiple enquiries
 * Used when updating follow-ups, vendor quotes, etc.
 *
 * @param {string[]} enquiryIds - Array of MongoDB ObjectIds
 * @param {string} source - Source of update
 * @returns {Promise<void>}
 */
exports.updateActivityDateBatch = async (enquiryIds, source = 'batch_update') => {
    if (!enquiryIds || enquiryIds.length === 0) return;

    try {
        await Enquiry.updateMany(
            { _id: { $in: enquiryIds } },
            { lastActivityDate: new Date() },
            { runValidators: false }
        );
        console.log(`[Activity] Batch updated ${enquiryIds.length} enquiries (source: ${source})`);
    } catch (err) {
        console.error(`[Activity Error] Failed to batch update activity dates:`, err.message);
    }
};

/**
 * Log when an enquiry status is changed
 * Used for audit trail (will be integrated with EnquiryActivity in Tier 2)
 *
 * @param {string} enquiryId
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {string} userId
 * @returns {Promise<void>}
 */
exports.logStatusChange = async (enquiryId, oldStatus, newStatus, userId) => {
    try {
        console.log(`[Status Change] Enquiry ${enquiryId}: ${oldStatus} → ${newStatus} (by user ${userId})`);
        // This will be extended in Tier 2 to log to EnquiryActivity collection
    } catch (err) {
        console.error(`[Activity Error] Failed to log status change:`, err.message);
    }
};

/**
 * Get last activity details for an enquiry
 * Returns the enquiry with focus on activity tracking fields
 *
 * @param {string} enquiryId
 * @returns {Promise<Object>}
 */
exports.getActivityDetails = async (enquiryId) => {
    try {
        const enquiry = await Enquiry.findById(enquiryId).select(
            'enquiryNo status lastActivityDate followUpDate followUpHistory createdAt'
        );
        return enquiry;
    } catch (err) {
        console.error(`[Activity Error] Failed to get activity details:`, err.message);
        return null;
    }
};

/**
 * Check if an enquiry is inactive (no activity for X days)
 * Useful for detecting stale enquiries
 *
 * @param {string} enquiryId
 * @param {number} daysThreshold - Default 7 days
 * @returns {Promise<boolean>}
 */
exports.isInactive = async (enquiryId, daysThreshold = 7) => {
    try {
        const enquiry = await Enquiry.findById(enquiryId).select('lastActivityDate');
        if (!enquiry) return false;

        const lastActivity = new Date(enquiry.lastActivityDate);
        const daysSinceActivity = (new Date() - lastActivity) / (1000 * 60 * 60 * 24);

        return daysSinceActivity > daysThreshold;
    } catch (err) {
        console.error(`[Activity Error] Failed to check inactivity:`, err.message);
        return false;
    }
};

/**
 * Force update activity date (use sparingly, for corrections only)
 * Requires reason parameter for audit trail
 *
 * @param {string} enquiryId
 * @param {Date} date
 * @param {string} reason
 * @returns {Promise<void>}
 */
exports.forceUpdateActivityDate = async (enquiryId, date, reason) => {
    try {
        if (date > new Date()) {
            throw new Error('Cannot set activity date to future');
        }
        await Enquiry.findByIdAndUpdate(enquiryId, { lastActivityDate: date });
        console.log(`[Activity Force] Updated enquiry ${enquiryId} to ${date} - Reason: ${reason}`);
    } catch (err) {
        console.error(`[Activity Error] Force update failed:`, err.message);
        throw err;
    }
};
