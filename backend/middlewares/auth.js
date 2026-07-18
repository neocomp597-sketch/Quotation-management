const jwt = require('jsonwebtoken');
const { getRedis } = require('../config/redis');

const auth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        if (decoded.jti) {
            const redis = await getRedis();
            const isRevoked = redis && await redis.get(`blacklist:access:${decoded.jti}`);
            if (isRevoked) {
                return res.status(401).json({ message: 'Token has been revoked' });
            }
        }

        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = auth;
