const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'kiran_secret_key_2024';

const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId).select('-__v');
        if (!user) {
            return res.status(401).json({ success: false, message: 'User account not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session token' });
    }
};

const requireAdmin = async (req, res, next) => {
    return requireAuth(req, res, () => {
        // Allow if role is admin or if admin email matches
        const adminEmail = (process.env.EMAIL_USER || 'trustkirancharitable@gmail.com').toLowerCase();
        if (req.user.role === 'admin' || req.user.email.toLowerCase() === adminEmail) {
            return next();
        }
        return res.status(403).json({ success: false, message: 'Admin access required' });
    });
};

module.exports = {
    requireAuth,
    requireAdmin,
    JWT_SECRET
};
