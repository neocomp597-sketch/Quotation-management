const User = require('../models/User');
const Vendor = require('../models/Vendor');
const bcrypt = require('bcryptjs');

/**
 * Ensures a User account exists for a given vendor.
 * - Login ID: Vendor email address (or username, trimmed, lowercase)
 * - Default Password: 123456
 * - Auto enables login on Vendor record
 */
const syncUserForVendor = async (vendorOrId, customPassword = null) => {
    try {
        let vendor = vendorOrId;
        if (!vendor || typeof vendor === 'string' || vendor instanceof require('mongoose').Types.ObjectId) {
            vendor = await Vendor.findById(vendorOrId);
        }

        if (!vendor) return null;

        const effectiveEmail = String(vendor.username || vendor.email || '').trim().toLowerCase();
        if (!effectiveEmail) {
            console.log(`[Vendor User Sync] Skipping vendor "${vendor.name}" - no email address found.`);
            return null;
        }

        const rawPassword = (customPassword && String(customPassword).trim().length >= 6) ? String(customPassword).trim() : '123456';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(rawPassword, salt);

        const escapedEmail = effectiveEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let user = null;
        if (vendor.vendorUserId) {
            user = await User.findById(vendor.vendorUserId);
        }
        if (!user) {
            user = await User.findOne({
                email: { $regex: new RegExp("^" + escapedEmail + "$", "i") }
            });
        }

        if (user) {
            user.role = 'vendor';
            user.vendorId = vendor._id;
            user.email = effectiveEmail;
            user.name = vendor.name || user.name;
            user.passwordHash = passwordHash;
            user.status = true;
            user.isActive = true;
            if (vendor.companyId && !user.companyId) {
                user.companyId = vendor.companyId;
            }
            await user.save();
        } else {
            user = await User.create({
                name: vendor.name || 'Vendor',
                email: effectiveEmail,
                passwordHash,
                role: 'vendor',
                companyId: vendor.companyId || null,
                vendorId: vendor._id,
                status: true,
                isActive: true,
                mustChangePassword: false
            });
        }

        // Update vendor model with login details
        let vendorDoc = vendor;
        if (typeof vendor.save !== 'function') {
            vendorDoc = await Vendor.findById(vendor._id);
        }

        if (vendorDoc) {
            vendorDoc.loginEnabled = true;
            vendorDoc.username = effectiveEmail;
            if (!vendorDoc.email) {
                vendorDoc.email = effectiveEmail;
            }
            vendorDoc.vendorUserId = user._id;
            vendorDoc.passwordHash = passwordHash;
            await vendorDoc.save();
        }

        console.log(`[Vendor User Sync] Synced vendor user account: ${vendor.name} (${effectiveEmail}) with password '123456'`);
        return user;
    } catch (error) {
        console.error(`[Vendor User Sync Error] Failed to sync user for vendor:`, error.message);
        return null;
    }
};

/**
 * Syncs user accounts for all existing vendors.
 * Finds all Vendors with an email, sets loginEnabled=true, updates password to 123456, and links/creates User accounts.
 */
const syncUsersForExistingVendors = async (companyId = null) => {
    try {
        const query = {};
        if (companyId) {
            query.companyId = companyId;
        }

        const vendors = await Vendor.find(query);
        let createdCount = 0;
        let updatedCount = 0;

        for (const vendor of vendors) {
            const emailStr = String(vendor.username || vendor.email || '').trim().toLowerCase();
            if (!emailStr) continue;

            const existingUser = await User.findOne({
                $or: [
                    { _id: vendor.vendorUserId },
                    { email: { $regex: new RegExp("^" + emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }
                ]
            });

            const syncedUser = await syncUserForVendor(vendor);
            if (syncedUser) {
                if (existingUser) updatedCount++;
                else createdCount++;
            }
        }

        console.log(`[Vendor User Sync Batch] Complete. Processed ${vendors.length} vendors: Created ${createdCount} users, Updated ${updatedCount} users.`);
        return { total: vendors.length, createdCount, updatedCount };
    } catch (error) {
        console.error('[Vendor User Sync Batch Error]:', error.message);
        return { total: 0, createdCount: 0, updatedCount: 0, error: error.message };
    }
};

module.exports = {
    syncUserForVendor,
    syncUsersForExistingVendors
};
