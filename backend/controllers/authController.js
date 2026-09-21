const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const { getRedis } = require('../config/redis');
const { enqueueLegacyRefreshSession } = require('../queues/authSessionQueue');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '20m';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const REFRESH_TOKEN_SECONDS = REFRESH_TOKEN_DAYS * 24 * 60 * 60;
const REFRESH_COOKIE_NAME = 'refreshToken';
const DEVICE_COOKIE_NAME = 'deviceId';

const getJwtSecret = () => process.env.JWT_SECRET || 'secret123';
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || `${getJwtSecret()}_refresh`;

const normalizeUser = (user, fallbackBranches = []) => {
    let assigned = [];
    if (Array.isArray(user.assignedBranches) && user.assignedBranches.length > 0) {
        assigned = user.assignedBranches;
    } else if (fallbackBranches && fallbackBranches.length > 0) {
        assigned = fallbackBranches;
    } else if (user.branchId) {
        assigned = [user.branchId];
    }

    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        branchId: user.branchId?._id || user.branchId || (assigned[0]?._id || assigned[0] || null),
        assignedBranches: assigned,
        vendorId: user.vendorId || null,
        mustChangePassword: !!user.mustChangePassword,
    };
};

const ensureLoginAllowed = async (user) => {
    if (user.status === false || user.isActive === false) {
        return 'Account deactivated';
    }

    if (!isSuperAdminRole(user.role) && user.companyId) {
        const company = await Company.findById(user.companyId).select('isActive status').lean();
        if (!company || company.isActive === false || ['SUSPENDED', 'DISABLED'].includes(company.status)) {
            return 'Company account is suspended';
        }
    }

    return null;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const parseCookie = (cookieHeader = '') => cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) return cookies;
        const key = decodeURIComponent(part.slice(0, separatorIndex));
        const value = decodeURIComponent(part.slice(separatorIndex + 1));
        cookies[key] = value;
        return cookies;
    }, {});

const createAccessToken = (user) => jwt.sign(
    {
        id: user._id,
        role: user.role,
        companyId: user.companyId,
        tokenVersion: user.tokenVersion || 0,
        jti: crypto.randomUUID(),
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_TTL }
);

const createRefreshToken = (user, deviceId) => jwt.sign(
    {
        id: user._id,
        tokenVersion: user.tokenVersion || 0,
        deviceId,
        jti: crypto.randomUUID(),
    },
    getRefreshSecret(),
    { expiresIn: `${REFRESH_TOKEN_DAYS}d` }
);

const isSecure = (req) => {
    if (!req) return false;
    return req.secure || 
           req.headers['x-forwarded-proto'] === 'https' || 
           req.headers['x-forwarded-ssl'] === 'on' ||
           process.env.NODE_ENV === 'production';
};

const setRefreshCookie = (res, token, req) => {
    const secure = isSecure(req);
    res.cookie(REFRESH_COOKIE_NAME, token, {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth',
    });
};

const setDeviceCookie = (res, deviceId, req) => {
    const secure = isSecure(req);
    res.cookie(DEVICE_COOKIE_NAME, deviceId, {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth',
    });
};

const clearRefreshCookie = (res, req) => {
    const secure = isSecure(req);
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        path: '/api/auth',
    });
    res.clearCookie(DEVICE_COOKIE_NAME, {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        path: '/api/auth',
    });
};

const getDeviceId = (req, decoded) => (
    decoded?.deviceId ||
    parseCookie(req.headers.cookie)[DEVICE_COOKIE_NAME] ||
    req.header('x-device-id') ||
    crypto.randomUUID()
);

const refreshKey = (userId, deviceId) => `refresh:${userId}:${deviceId}`;
const sessionSetKey = (userId) => `sessions:${userId}`;

const storeRefreshSession = async (user, deviceId, refreshToken) => {
    const redis = await getRedis();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_SECONDS * 1000);
    const payload = JSON.stringify({
        tokenHash,
        userId: user._id.toString(),
        deviceId,
        role: user.role,
        createdAt: new Date().toISOString(),
    });

    if (redis) {
        await redis.set(refreshKey(user._id, deviceId), payload, { EX: REFRESH_TOKEN_SECONDS });
        await redis.sAdd(sessionSetKey(user._id), deviceId);
        await redis.expire(sessionSetKey(user._id), REFRESH_TOKEN_SECONDS);
        let queued = false;
        try {
            queued = await enqueueLegacyRefreshSession({
                userId: user._id.toString(),
                tokenHash,
                expiresAt: expiresAt.toISOString(),
            });
        } catch (error) {
            console.error('Failed to enqueue legacy refresh session persistence:', error.message);
        }
        if (!queued) {
            await User.findByIdAndUpdate(user._id, {
                refreshTokenHash: tokenHash,
                refreshTokenExpiresAt: expiresAt,
            });
        }
        return;
    }

    user.refreshTokenHash = tokenHash;
    user.refreshTokenExpiresAt = expiresAt;
    await user.save();
};

const loadRefreshSession = async (userId, deviceId) => {
    const redis = await getRedis();
    if (!redis) return null;

    const raw = await redis.get(refreshKey(userId, deviceId));
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const revokeRefreshSession = async (userId, deviceId) => {
    const redis = await getRedis();
    if (!redis || !userId || !deviceId) return;

    await redis.del(refreshKey(userId, deviceId));
    await redis.sRem(sessionSetKey(userId), deviceId);
};

const revokeAllRefreshSessions = async (userId) => {
    const redis = await getRedis();
    if (!redis || !userId) return;

    const deviceIds = await redis.sMembers(sessionSetKey(userId));
    if (deviceIds.length) {
        await redis.del(deviceIds.map((deviceId) => refreshKey(userId, deviceId)));
    }
    await redis.del(sessionSetKey(userId));
};

const blacklistAccessToken = async (req) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return;

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (!decoded.jti || !decoded.exp) return;

        const ttl = Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
        const redis = await getRedis();
        if (redis) {
            await redis.set(`blacklist:access:${decoded.jti}`, '1', { EX: ttl });
        }
    } catch {
        // Logout should still clear the refresh token even if the access token is already expired.
    }
};

const issueSession = async (user, res, req, deviceId = getDeviceId(req)) => {
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user, deviceId);

    await storeRefreshSession(user, deviceId, refreshToken);

    setDeviceCookie(res, deviceId, req);
    setRefreshCookie(res, refreshToken, req);

    let fallbackBranches = [];
    if ((!user.assignedBranches || user.assignedBranches.length === 0) && user.companyId) {
        fallbackBranches = await Branch.find({ companyId: user.companyId, status: { $ne: 'Inactive' } })
            .select('_id name code branchPrefix address city state')
            .lean();
    }

    return { accessToken, deviceId, user: normalizeUser(user, fallbackBranches) };
};

exports.register = async (req, res) => {
    let newCompany = null;

    try {
        const { name, email, password, companyName } = req.body;
        const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

        const existingUser = await User.findOne({ email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }).select('_id').lean();
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const resolvedCompanyName = (companyName || `${name}'s Company`).trim();
        if (!resolvedCompanyName) {
            return res.status(400).json({ message: 'Company name is required' });
        }

        newCompany = await Company.create({ name: resolvedCompanyName });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            email: normalizedEmail,
            passwordHash,
            role: 'admin',
            companyId: newCompany._id,
        });

        const session = await issueSession(newUser, res, req);
        res.status(201).json(session);
    } catch (error) {
        if (newCompany?._id) {
            await Company.deleteOne({ _id: newCompany._id }).catch(() => {});
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

        const user = await User.findOne({ email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } })
            .populate('assignedBranches', '_id name code branchPrefix address city state')
            .populate('branchId', '_id name code branchPrefix address city state');
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const blockedReason = await ensureLoginAllowed(user);
        if (blockedReason) {
            return res.status(403).json({ message: blockedReason });
        }

        const session = await issueSession(user, res, req);
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.refresh = async (req, res) => {
    try {
        const cookies = parseCookie(req.headers.cookie);
        const refreshToken = cookies[REFRESH_COOKIE_NAME];

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing' });
        }

        const decoded = jwt.verify(refreshToken, getRefreshSecret());
        const user = await User.findById(decoded.id)
            .populate('assignedBranches', '_id name code branchPrefix address city state')
            .populate('branchId', '_id name code branchPrefix address city state');
        const deviceId = getDeviceId(req, decoded);
        const redisSession = await loadRefreshSession(decoded.id, deviceId);
        const hasValidRedisSession = redisSession?.tokenHash === hashToken(refreshToken);
        const hasLegacySession = user?.refreshTokenHash === hashToken(refreshToken);

        if (
            !user ||
            (!hasValidRedisSession && !hasLegacySession) ||
            user.tokenVersion !== decoded.tokenVersion ||
            (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date())
        ) {
            clearRefreshCookie(res, req);
            return res.status(401).json({ message: 'Refresh token invalid' });
        }

        const blockedReason = await ensureLoginAllowed(user);
        if (blockedReason) {
            clearRefreshCookie(res, req);
            return res.status(403).json({ message: blockedReason });
        }

        // Keep refresh idempotent. A page reload can trigger overlapping refresh
        // requests; rotating the refresh token here lets the later request treat
        // the earlier token as stolen and clear the cookie.
        setDeviceCookie(res, deviceId, req);
        setRefreshCookie(res, refreshToken, req);
        res.json({
            accessToken: createAccessToken(user),
            deviceId,
            user: normalizeUser(user),
        });
    } catch (error) {
        clearRefreshCookie(res, req);
        res.status(401).json({ message: 'Refresh token invalid' });
    }
};

exports.logout = async (req, res) => {
    try {
        const cookies = parseCookie(req.headers.cookie);
        const refreshToken = cookies[REFRESH_COOKIE_NAME];

        if (refreshToken) {
            let decoded;
            try {
                decoded = jwt.verify(refreshToken, getRefreshSecret());
                await revokeRefreshSession(decoded.id, decoded.deviceId);
            } catch {
                decoded = null;
            }

            const user = decoded
                ? await User.findById(decoded.id)
                : await User.findOne({ refreshTokenHash: hashToken(refreshToken) });
            if (user) {
                user.refreshTokenHash = undefined;
                user.refreshTokenExpiresAt = undefined;
                await user.save();
            }
        }

        await blacklistAccessToken(req);
        clearRefreshCookie(res, req);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        clearRefreshCookie(res, req);
        res.json({ message: 'Logged out successfully' });
    }
};

exports.logoutAll = async (req, res) => {
    try {
        if (req.user?.id) {
            await revokeAllRefreshSessions(req.user.id);
            await User.findByIdAndUpdate(req.user.id, {
                $inc: { tokenVersion: 1 },
                $unset: { refreshTokenHash: '', refreshTokenExpiresAt: '' },
            });
        }

        clearRefreshCookie(res, req);
        res.json({ message: 'Logged out from all devices successfully' });
    } catch (error) {
        clearRefreshCookie(res, req);
        res.status(500).json({ message: 'Error logging out from all devices' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('_id name email role status companyId vendorId mustChangePassword createdAt updatedAt')
            .lean();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.mustChangePassword && currentPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                return res.status(400).json({ message: 'Incorrect current password' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        user.mustChangePassword = false;
        user.passwordChangedAt = new Date();
        await user.save();

        res.json({ message: 'Password updated successfully', user: normalizeUser(user) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to change password', error: error.message });
    }
};

const sendEmail = require('../utils/sendEmail');

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

        if (!normalizedEmail) {
            return res.status(400).json({ message: 'Please provide a valid email address' });
        }

        console.log(`[forgotPassword] Processing request for email: "${normalizedEmail}"`);

        const user = await User.findOne({ email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } });

        // Always return positive security response to prevent user enumeration
        if (!user) {
            console.warn(`[forgotPassword] No user found in database matching email: "${normalizedEmail}"`);
            return res.json({ 
                success: true,
                message: 'If an account exists for this email address, a password reset link has been sent. Please check your inbox.' 
            });
        }

        console.log(`[forgotPassword] User found: ${user.name} (${user.email}). Dispatching email...`);

        // Generate unhashed reset token & store hashed version in DB
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour validity
        await user.save();

        const requestOrigin = req.get('origin');
        const defaultFrontend = process.env.FRONTEND_URL || 'https://arcrm.co.in';
        let frontendUrl = (requestOrigin && !requestOrigin.includes('null') && !requestOrigin.includes('localhost')) 
            ? requestOrigin.replace(/\/$/, '') 
            : defaultFrontend;

        if (frontendUrl.includes('localhost')) {
            frontendUrl = 'https://arcrm.co.in';
        }
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        // Send Email via Nodemailer SMTP
        const emailResult = await sendEmail({
            to: user.email,
            subject: 'Reset your password - ARCRM',
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Reset Your Password - ARCRM</title>
                </head>
                <body style="margin: 0; padding: 0; width: 100%; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 48px 20px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                          
                          <!-- Header -->
                          <tr>
                            <td style="padding: 40px 40px 0 40px; text-align: left;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="vertical-align: middle;">
                                    <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 10px; text-align: center; line-height: 38px; color: #ffffff; font-weight: 800; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                                      A
                                    </div>
                                  </td>
                                  <td style="padding-left: 12px; vertical-align: middle;">
                                    <span style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase;">ARCRM</span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>

                          <!-- Content -->
                          <tr>
                            <td style="padding: 32px 40px 40px 40px;">
                              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                                Reset your password
                              </h1>
                              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                                Hi <strong>${user.name}</strong>,
                              </p>
                              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                                We received a request to reset your password for your account associated with <span style="color: #0f172a; font-weight: 600;">${user.email}</span>.
                              </p>

                              <!-- Button -->
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                                <tr>
                                  <td align="left" style="border-radius: 10px; background-color: #2563eb;">
                                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #2563eb; letter-spacing: 0.2px;">
                                      Reset password
                                    </a>
                                  </td>
                                </tr>
                              </table>

                              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                                This link will expire in <strong>1 hour</strong>. If you did not request this password reset, no further action is required and your account remains safe.
                              </p>

                              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;" />

                              <!-- Link Fallback -->
                              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                                If you're having trouble clicking the button, copy and paste the URL below into your web browser:
                              </p>
                              <p style="margin: 0; font-size: 12px; line-height: 1.5; word-break: break-all;">
                                <a href="${resetUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">
                                  ${resetUrl}
                                </a>
                              </p>
                            </td>
                          </tr>

                          <!-- Footer -->
                          <tr>
                            <td style="padding: 0 40px 32px 40px; text-align: left;">
                              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                                &copy; ${new Date().getFullYear()} ARCRM. All rights reserved.
                              </p>
                            </td>
                          </tr>

                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
            `
        });

        if (!emailResult || (!emailResult.success && !emailResult.simulated)) {
            console.error('[forgotPassword] Email dispatch failed:', emailResult?.error);
            return res.status(500).json({ 
                message: `Failed to send password reset email: ${emailResult?.error || 'Email service error'}` 
            });
        }

        res.json({ 
            success: true,
            message: 'Password reset link sent to your email address! Please check your inbox.'
        });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Failed to process password reset request', error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, newPassword } = req.body;
        const passwordToSet = password || newPassword;

        if (!token) {
            return res.status(400).json({ message: 'Reset token is required' });
        }

        if (!passwordToSet || passwordToSet.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Hash token to query database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired password reset link. Please request a new password reset.' });
        }

        // Update user password and clear token fields
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(passwordToSet, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.mustChangePassword = false;
        user.passwordChangedAt = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successfully! You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Failed to reset password', error: error.message });
    }
};

