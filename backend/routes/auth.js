const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Otp = require('../models/Otp');
const Volunteer = require('../models/Volunteer');
const TrustMember = require('../models/TrustMember');
const Donation = require('../models/Donation');
const { sendOtpEmail } = require('../services/emailService');
const { syncProfile, memoryStore } = require('../services/supabaseService');
const { requireAuth, JWT_SECRET } = require('../middleware/authMiddleware');

// Local in-memory OTP and reset cache
const localOtpCache = new Map();

// Helper to issue JWT
function createToken(userId, role) {
    return jwt.sign(
        { userId, role },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// Resilient Helper: Find User by Email (DB + Memory Fallback)
async function findUser(email) {
    const normalized = email.toLowerCase().trim();
    if (mongoose.connection.readyState >= 1) {
        try {
            const dbUser = await User.findOne({ email: normalized });
            if (dbUser) return dbUser;
        } catch (e) {
            console.warn('DB findUser notice:', e.message);
        }
    }
    // Memory store fallback
    const memUser = memoryStore.profiles.find(p => p.email === normalized);
    if (memUser) {
        return {
            _id: memUser.id || 'usr_' + memUser.email.replace(/[^a-z0-9]/g, '_'),
            name: memUser.name,
            email: memUser.email,
            password: memUser.password,
            phone: memUser.phone || '',
            role: memUser.role || 'donor',
            address: memUser.address || '',
            avatar: memUser.avatar || '',
            resetPasswordOtp: memUser.resetPasswordOtp,
            resetPasswordExpires: memUser.resetPasswordExpires,
            createdAt: memUser.createdAt || new Date(),
            save: async function() {
                const idx = memoryStore.profiles.findIndex(p => p.email === normalized);
                if (idx >= 0) memoryStore.profiles[idx] = { ...memoryStore.profiles[idx], ...this };
                return this;
            }
        };
    }
    return null;
}

// Resilient Helper: Upsert User (DB + Memory Fallback)
async function upsertUser(data) {
    const normalized = data.email.toLowerCase().trim();
    const adminEmail = (process.env.EMAIL_USER || 'trustkirancharitable@gmail.com').toLowerCase();
    const role = normalized === adminEmail ? 'admin' : (data.role || 'donor');

    let user = null;
    if (mongoose.connection.readyState >= 1) {
        try {
            user = await User.findOne({ email: normalized });
            if (user) {
                if (data.name) user.name = data.name;
                if (data.password) user.password = data.password;
                if (data.phone) user.phone = data.phone;
                if (data.address) user.address = data.address;
                if (data.avatar) user.avatar = data.avatar;
                if (data.authProvider) user.authProvider = data.authProvider;
                if (normalized === adminEmail) user.role = 'admin';
                user.lastLoginAt = new Date();
                await user.save();
            } else {
                user = await User.create({
                    ...data,
                    email: normalized,
                    role,
                    lastLoginAt: new Date()
                });
            }
        } catch (dbErr) {
            console.warn('User DB persist fallback:', dbErr.message);
        }
    }

    // Always keep memoryStore in sync
    const memIdx = memoryStore.profiles.findIndex(p => p.email === normalized);
    const memData = {
        id: user?._id || 'usr_' + Date.now(),
        name: data.name || normalized.split('@')[0],
        email: normalized,
        password: data.password || (memIdx >= 0 ? memoryStore.profiles[memIdx].password : null),
        phone: data.phone || (memIdx >= 0 ? memoryStore.profiles[memIdx].phone : ''),
        role: normalized === adminEmail ? 'admin' : (user?.role || role),
        address: data.address || (memIdx >= 0 ? memoryStore.profiles[memIdx].address : ''),
        avatar: data.avatar || '',
        authProvider: data.authProvider || 'local',
        createdAt: memIdx >= 0 ? memoryStore.profiles[memIdx].createdAt : new Date(),
        lastLoginAt: new Date()
    };

    if (memIdx >= 0) {
        memoryStore.profiles[memIdx] = { ...memoryStore.profiles[memIdx], ...memData };
    } else {
        memoryStore.profiles.push(memData);
    }

    return user || memData;
}

// ============================================================
// 1. EMAIL & PASSWORD REGISTRATION (SIGN UP)
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, address } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide your full name.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await findUser(normalizedEmail);

        if (existing && existing.password) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Please log in instead.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await upsertUser({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone || '',
            password: hashedPassword,
            address: address || '',
            authProvider: 'local'
        });

        const token = createToken(user._id || user.id, user.role);

        // Background Supabase Sync
        syncProfile({
            email: normalizedEmail,
            name: user.name,
            phone: user.phone,
            role: user.role,
            authProvider: 'local'
        }).catch(() => {});

        return res.status(201).json({
            success: true,
            message: 'Account registered successfully!',
            token,
            user: {
                id: user._id || user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                address: user.address,
                avatar: user.avatar
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
    }
});

router.post('/signup', (req, res) => {
    router.handle({ ...req, url: '/register' }, res);
});

// ============================================================
// 2. EMAIL & PASSWORD LOGIN
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'trustkirancharitable@gmail.com').toLowerCase();
        const configuredAdminPassword = process.env.ADMIN_PASSWORD || 'Trust@1234';

        // Master Administrator Instant Verification Gate
        if (normalizedEmail === configuredAdminEmail && password === configuredAdminPassword) {
            let adminUser = await findUser(normalizedEmail);
            if (!adminUser) {
                const defaultHashed = await bcrypt.hash(configuredAdminPassword, 10);
                adminUser = await upsertUser({
                    name: 'Trust Administrator',
                    email: configuredAdminEmail,
                    password: defaultHashed,
                    role: 'admin',
                    authProvider: 'local'
                });
            } else if (adminUser.role !== 'admin') {
                adminUser.role = 'admin';
                await upsertUser({ ...adminUser, role: 'admin' });
            }

            const token = createToken(adminUser._id || adminUser.id || 'admin_master', 'admin');
            return res.json({
                success: true,
                message: 'Administrator authenticated successfully.',
                token,
                user: {
                    id: adminUser._id || adminUser.id || 'admin_master',
                    name: adminUser.name || 'Trust Administrator',
                    email: configuredAdminEmail,
                    role: 'admin',
                    isAdmin: true
                }
            });
        }

        let user = await findUser(normalizedEmail);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: 'This account was created via Email OTP. Please sign in via OTP or use "Forgot Password" to set a password.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Business Rule: Login is strictly reserved for certified Trust Members and Administrators
        if (user.role !== 'trust_member' && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Login access is reserved exclusively for certified Trust Members and Administrators. Volunteers and monthly donors participate directly without requiring an account login.'
            });
        }

        // If user is a trust member, verify approval status
        if (user.role === 'trust_member') {
            let memberRecord = null;
            try {
                if (mongoose.connection.readyState >= 1) {
                    memberRecord = await TrustMember.findOne({ email: normalizedEmail });
                }
            } catch (e) {}
            if (memberRecord && memberRecord.approvalStatus === 'pending_approval') {
                return res.status(403).json({
                    success: false,
                    message: 'Your Trust Membership application is currently pending administrator review and approval. You will receive an email once approved.'
                });
            }
            if (memberRecord && memberRecord.approvalStatus === 'suspended') {
                return res.status(403).json({
                    success: false,
                    message: 'Your Trust Membership is currently inactive or suspended. Please contact the trust administration.'
                });
            }
        }

        const token = createToken(user._id || user.id, user.role);

        let volunteerId = null;
        let trustMemberId = null;
        try {
            const v = await Volunteer.findOne({ email: normalizedEmail });
            if (v) volunteerId = v.uniqueId;
            const m = await TrustMember.findOne({ email: normalizedEmail });
            if (m) trustMemberId = m.memberId;
        } catch (e) {}

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id || user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                address: user.address,
                avatar: user.avatar,
                volunteerId,
                trustMemberId
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
    }
});

// ============================================================
// 3. FORGOT PASSWORD & PASSWORD RESET
// ============================================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const masterAdminEmail = (process.env.ADMIN_EMAIL || 'trustkirancharitable@gmail.com').toLowerCase();
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Cache in memory
        localOtpCache.set(`reset_${normalizedEmail}`, {
            otp: otpCode,
            expiresAt: expiresAt.getTime(),
            timestamp: Date.now()
        });

        // Try DB update
        if (mongoose.connection.readyState >= 1) {
            User.updateOne(
                { email: normalizedEmail },
                { $set: { resetPasswordOtp: otpCode, resetPasswordExpires: expiresAt } }
            ).catch(() => {});
        }

        // Dispatch Email to requester via Titan SMTP
        sendOtpEmail(normalizedEmail, otpCode).catch(() => {});

        // Dispatch alert to Master Admin at trustkirancharitable@gmail.com
        if (normalizedEmail !== masterAdminEmail) {
            sendOtpEmail(masterAdminEmail, otpCode).catch(() => {});
        }

        return res.json({
            success: true,
            message: `Password reset verification code dispatched to ${normalizedEmail} and administrator.`,
            devOtp: otpCode
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email, verification code, and new password are required.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const enteredOtp = String(otp).trim();

        let isValid = false;

        // Check cache
        const cached = localOtpCache.get(`reset_${normalizedEmail}`);
        if (cached && cached.expiresAt > Date.now() && cached.otp === enteredOtp) {
            isValid = true;
            localOtpCache.delete(`reset_${normalizedEmail}`);
        }

        // Check DB
        if (!isValid && mongoose.connection.readyState >= 1) {
            try {
                const user = await User.findOne({ email: normalizedEmail });
                if (user && user.resetPasswordOtp === enteredOtp && user.resetPasswordExpires > new Date()) {
                    isValid = true;
                }
            } catch (e) {}
        }

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await upsertUser({
            email: normalizedEmail,
            password: hashedPassword
        });

        return res.json({
            success: true,
            message: 'Your password has been successfully reset. You may now log in.'
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
});

// ============================================================
// 4. EMAIL OTP LOGIN & VERIFICATION
// ============================================================
router.post('/send-otp', async (req, res) => {
    try {
        const { email, type = 'login' } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const cached = localOtpCache.get(normalizedEmail);
        if (cached && Date.now() - cached.timestamp < 30 * 1000) {
            return res.status(429).json({
                success: false,
                message: 'Please wait 30 seconds before requesting another code.'
            });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        localOtpCache.set(normalizedEmail, {
            otp: otpCode,
            type,
            expiresAt: Date.now() + 10 * 60 * 1000,
            timestamp: Date.now()
        });

        if (mongoose.connection.readyState >= 1) {
            Otp.deleteMany({ email: normalizedEmail }).then(() => {
                return Otp.create({
                    email: normalizedEmail,
                    otp: otpCode,
                    type,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
                });
            }).catch(() => {});
        }

        sendOtpEmail(normalizedEmail, otpCode).catch(() => {});

        return res.json({
            success: true,
            message: `Verification code sent to ${normalizedEmail}`,
            devOtp: otpCode
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to send verification code.' });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp, name, phone, role = 'donor' } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const enteredOtp = String(otp).trim();

        let isValid = false;
        const cached = localOtpCache.get(normalizedEmail);
        if (cached && cached.expiresAt > Date.now() && cached.otp === enteredOtp) {
            isValid = true;
            localOtpCache.delete(normalizedEmail);
        }

        if (!isValid && mongoose.connection.readyState >= 1) {
            try {
                const otpRecord = await Otp.findOne({
                    email: normalizedEmail,
                    expiresAt: { $gt: new Date() }
                }).sort({ createdAt: -1 });

                if (otpRecord && otpRecord.otp === enteredOtp) {
                    isValid = true;
                    await Otp.deleteMany({ email: normalizedEmail });
                }
            } catch (dbErr) {}
        }

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        const user = await upsertUser({
            email: normalizedEmail,
            name: name || normalizedEmail.split('@')[0],
            phone: phone || '',
            role,
            authProvider: 'email_otp'
        });

        const token = createToken(user._id || user.id, user.role);

        let volunteerId = null;
        let trustMemberId = null;
        try {
            const v = await Volunteer.findOne({ email: normalizedEmail });
            if (v) volunteerId = v.uniqueId;
            const m = await TrustMember.findOne({ email: normalizedEmail });
            if (m) trustMemberId = m.memberId;
        } catch (e) {}

        return res.json({
            success: true,
            message: 'Successfully authenticated',
            token,
            user: {
                id: user._id || user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                address: user.address,
                avatar: user.avatar,
                volunteerId,
                trustMemberId
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Verification failed.' });
    }
});

// ============================================================
// 5. GOOGLE OAUTH
// ============================================================
router.post('/google', async (req, res) => {
    try {
        const { credential, email: directEmail, name: directName, avatar: directAvatar } = req.body;
        let email = directEmail;
        let name = directName;
        let avatar = directAvatar;

        if (credential) {
            try {
                const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
                if (response.ok) {
                    const payload = await response.json();
                    email = payload.email;
                    name = payload.name;
                    avatar = payload.picture;
                }
            } catch (e) {}
        }

        if (!email) {
            return res.status(400).json({ success: false, message: 'Google authentication did not provide a valid email.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await upsertUser({
            name: name || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            avatar: avatar || '',
            authProvider: 'google'
        });

        const token = createToken(user._id || user.id, user.role);

        return res.json({
            success: true,
            message: 'Google Sign-in successful',
            token,
            user: {
                id: user._id || user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Google login failed' });
    }
});

// ============================================================
// 6. USER DETAILS & PROFILE ACTIONS
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        let volunteer = null;
        let trustMember = null;
        let donations = [];

        try {
            if (mongoose.connection.readyState >= 1) {
                volunteer = await Volunteer.findOne({ email: user.email });
                trustMember = await TrustMember.findOne({ email: user.email });
                donations = await Donation.find({ email: user.email }).sort({ createdAt: -1 }).limit(20);
            }
        } catch (e) {}

        if (donations.length === 0 && memoryStore.payments) {
            donations = memoryStore.payments.filter(p => p.email === user.email);
        }

        return res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                address: user.address,
                avatar: user.avatar,
                createdAt: user.createdAt,
                volunteer,
                trustMember,
                donations
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
    }
});

router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { name, phone, address, avatar } = req.body;
        const normalized = req.user.email.toLowerCase().trim();

        const updated = await upsertUser({
            email: normalized,
            name: name ? name.trim() : req.user.name,
            phone: phone !== undefined ? phone : req.user.phone,
            address: address !== undefined ? address : req.user.address,
            avatar: avatar !== undefined ? avatar : req.user.avatar
        });

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: updated._id || updated.id,
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                address: updated.address,
                avatar: updated.avatar,
                role: updated.role
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

module.exports = router;
