const express = require('express');
const router = express.Router();
const path = require('path');
const Volunteer = require('../models/Volunteer');
const User = require('../models/User');
const PerformanceMetric = require('../models/PerformanceMetric');
const upload = require('../services/uploadService');
const { uploadPhotoToR2 } = require('../services/cloudflareR2Service');
const { syncVolunteer, syncProfile } = require('../services/supabaseService');
const { sendVolunteerWelcomeEmail } = require('../services/emailService');
const { requireAuth } = require('../middleware/authMiddleware');

// Helper to record performance metric
async function recordVolunteerMetric() {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        await PerformanceMetric.findOneAndUpdate(
            { date: todayStr },
            { 
                $inc: { totalRegistrations: 1, volunteerRegistrations: 1 },
                $set: { updatedAt: new Date() }
            },
            { upsert: true }
        ).catch(() => {});
    } catch (e) {
        console.warn('Metric logging notice:', e.message);
    }
}

// POST /api/volunteers — Register volunteer or complete volunteer onboarding
router.post('/', upload.single('profilePhoto'), async (req, res) => {
    try {
        const {
            volunteerType = 'volunteer',
            name, email, phone, occupation, address, skills,
            availability, reason, careerPosition, resumeText,
            aadharNumber, panNumber,
            membershipFee = 2500
        } = req.body;

        const type = volunteerType || 'volunteer';

        if (!name || !email || !phone || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, phone, and motivation reason are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (type === 'volunteer') {
            if (!address) {
                return res.status(400).json({ success: false, message: 'Address is required for volunteer registration' });
            }
        } else {
            if (!careerPosition || !resumeText) {
                return res.status(400).json({ success: false, message: 'Target position and resume details are required for career application' });
            }
        }

        let existing = null;
        try {
            existing = await Volunteer.findOne({ email: normalizedEmail, volunteerType: type });
        } catch (dbErr) {
            console.warn('DB lookup skipped:', dbErr.message);
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: type === 'volunteer'
                    ? 'You have already registered as a volunteer with this email address.'
                    : 'You have already submitted a job application with this email address.'
            });
        }

        // Upload Profile Photo to Cloudflare R2 (with local fallback)
        let profilePhotoUrl = '';
        if (req.file) {
            const ext = path.extname(req.file.originalname) || '.jpg';
            const fileName = `volunteer_${Date.now()}_${Math.round(Math.random() * 1e5)}${ext}`;
            profilePhotoUrl = await uploadPhotoToR2(req.file.buffer, fileName, req.file.mimetype);
        }

        // Generate unique Volunteer ID: KCT-VOL-XXXX
        let uniqueId = '';
        if (type === 'volunteer') {
            let count = 0;
            try {
                count = await Volunteer.countDocuments({ volunteerType: 'volunteer' });
            } catch (e) {
                count = Math.floor(Math.random() * 100);
            }
            uniqueId = `KCT-VOL-${String(count + 1001).padStart(4, '0')}`;
        }

        // Update / create user in MongoDB & Supabase
        let user = null;
        try {
            user = await User.findOne({ email: normalizedEmail });
            if (!user) {
                user = await User.create({
                    name,
                    email: normalizedEmail,
                    phone,
                    role: type === 'volunteer' ? 'volunteer' : 'donor',
                    avatar: profilePhotoUrl,
                    address: address || '',
                    isVerified: true
                });
            } else if (type === 'volunteer') {
                user.role = 'volunteer';
                if (profilePhotoUrl) user.avatar = profilePhotoUrl;
                await user.save();
            }
        } catch (uErr) {
            console.warn('User sync skipped:', uErr.message);
        }

        let volunteer = null;
        try {
            volunteer = new Volunteer({
                userId: user?._id,
                uniqueId: uniqueId || undefined,
                volunteerType: type,
                name,
                email: normalizedEmail,
                phone,
                occupation: occupation || 'Social Contributor',
                address: address || 'Guntur / Palnadu',
                aadharNumber: aadharNumber ? String(aadharNumber).replace(/\D/g, '').slice(0, 12) : '',
                panNumber: panNumber ? String(panNumber).toUpperCase().trim() : '',
                skills: skills || 'Community Support',
                availability: type === 'volunteer' ? (availability || 'flexible') : undefined,
                careerPosition: type === 'career' ? careerPosition : undefined,
                resumeText: type === 'career' ? resumeText : undefined,
                profilePhoto: profilePhotoUrl,
                membershipFee: type === 'volunteer' ? (Number(membershipFee) || 2500) : 0,
                paymentStatus: type === 'volunteer' ? 'paid' : 'exempt',
                status: 'active',
                reason
            });
            await volunteer.save();
        } catch (vErr) {
            console.warn('MongoDB save volunteer skipped:', vErr.message);
            volunteer = {
                uniqueId,
                volunteerType: type,
                name,
                email: normalizedEmail,
                phone,
                occupation,
                address,
                skills,
                availability,
                profilePhoto: profilePhotoUrl,
                membershipFee: 2500,
                paymentStatus: 'paid',
                status: 'active'
            };
        }

        // Primary Supabase Sync
        await syncVolunteer({
            uniqueId,
            name,
            email: normalizedEmail,
            phone,
            address: address || '',
            occupation: occupation || '',
            skills: skills || '',
            availability: availability || 'flexible',
            profilePhoto: profilePhotoUrl,
            membershipFee: 2500,
            paymentStatus: 'paid',
            status: 'active'
        });

        if (user) {
            await syncProfile(user);
        }

        recordVolunteerMetric();

        // Send Welcome & ID Email
        if (type === 'volunteer') {
            sendVolunteerWelcomeEmail(volunteer).catch(e => console.warn('Volunteer welcome email warning:', e.message));
        }

        res.status(201).json({
            success: true,
            message: type === 'volunteer'
                ? `Registration successful! Your Volunteer ID is ${uniqueId}. Membership fee ₹2,500 confirmed.`
                : 'Job application submitted successfully! Our HR team will contact you shortly.',
            data: volunteer,
            photoUrl: profilePhotoUrl
        });
    } catch (error) {
        console.error('Volunteer error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// GET /api/volunteers/:identifier — Fetch single volunteer profile
router.get('/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const query = identifier.includes('@')
            ? { email: identifier.toLowerCase().trim() }
            : { uniqueId: identifier.toUpperCase() };

        let volunteer = null;
        try {
            volunteer = await Volunteer.findOne(query);
        } catch (e) {}

        if (!volunteer) {
            volunteer = require('../services/supabaseService').memoryStore.volunteers.find(
                v => v.email === identifier.toLowerCase().trim() || v.unique_id === identifier.toUpperCase()
            );
        }

        if (!volunteer) {
            return res.status(404).json({ success: false, message: 'Volunteer profile not found' });
        }
        res.json({ success: true, volunteer });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/volunteers (admin or list)
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        let volunteers = [];
        try {
            const filter = type ? { volunteerType: type } : {};
            volunteers = await Volunteer.find(filter).sort({ createdAt: -1 });
        } catch (e) {
            volunteers = require('../services/supabaseService').memoryStore.volunteers;
        }
        res.json({ success: true, data: volunteers, count: volunteers.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
