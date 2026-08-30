const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
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

const normalizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    vendorId: user.vendorId || null,
    mustChangePassword: !!user.mustChangePassword,
});

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
    return { accessToken, deviceId, user: normalizeUser(user) };
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

        const user = await User.findOne({ email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } });
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
        const user = await User.findById(decoded.id);
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

        const user = await User.findOne({ email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } });

        // Always return positive security response to prevent user enumeration
        if (!user) {
            return res.json({ 
                success: true,
                message: 'If an account exists for this email address, a password reset link has been sent. Please check your inbox.' 
            });
        }

        // Generate unhashed reset token & store hashed version in DB
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour validity
        await user.save();

        const requestOrigin = req.get('origin');
        const defaultFrontend = process.env.FRONTEND_URL || 'https://arcrm.co.in';
        const frontendUrl = (requestOrigin && !requestOrigin.includes('null')) ? requestOrigin.replace(/\/$/, '') : defaultFrontend;
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        // Send Email via Nodemailer SMTP
        const emailResult = await sendEmail({
            to: user.email,
            subject: 'Password Reset Request - Acczite',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Acczite Management</h2>
                        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Password Reset Request</p>
                    </div>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6;">We received a request to reset your password for your account associated with <strong>${user.email}</strong>.</p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6;">Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.</p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${resetUrl}" target="_blank" style="background-color: #0d9488; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);">Reset Password</a>
                    </div>
                    <p style="font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all;">
                        If the button above does not work, copy and paste this link into your browser:<br/>
                        <a href="${resetUrl}" style="color: #0d9488;">${resetUrl}</a>
                    </p>
                    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">If you did not request a password reset, please ignore this email.</p>
                </div>
            `
        });

        res.json({ 
            success: true,
            message: 'Password reset link sent to your email address! Please check your inbox.',
            resetToken // Provided for dev convenience if SMTP not configured locally
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

