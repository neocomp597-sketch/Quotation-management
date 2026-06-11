const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Creates notifications for all users in a company.
 * @param {Object} params
 * @param {String} params.companyId - The company/tenant ID
 * @param {String} params.title - The title of the notification
 * @param {String} params.message - The detailed notification message
 * @param {String} params.type - The type of notification (e.g. Quotation, Planning, Alert)
 * @param {String} [params.relatedId] - Associated entity ID (e.g., Enquiry or Quotation ID)
 * @param {String} [params.excludeUserId] - Optional user ID to exclude (e.g. the performer of the action)
 */
const createCompanyNotifications = async ({
    companyId,
    title,
    message,
    type,
    relatedId,
    excludeUserId
}) => {
    try {
        if (!companyId) {
            console.warn('[Notification Helper] No companyId provided for notification');
            return;
        }

        // Find all users in the same company
        const users = await User.find({ companyId }).select('_id').lean();
        
        const notifications = users
            .filter(u => !excludeUserId || String(u._id) !== String(excludeUserId))
            .map(u => ({
                userId: u._id,
                companyId,
                title,
                message,
                type,
                relatedId,
                isRead: false,
                isDismissed: false
            }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
            console.log(`[Notification Helper] Created ${notifications.length} "${type}" notifications for company: ${companyId}`);
        }
    } catch (err) {
        console.error('[Notification Helper Error] Failed to create company notifications:', err);
    }
};

module.exports = {
    createCompanyNotifications
};
