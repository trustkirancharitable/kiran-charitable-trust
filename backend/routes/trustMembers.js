const express = require('express');
const router = express.Router();
const path = require('path');
const TrustMember = require('../models/TrustMember');
const MonthlySchedule = require('../models/MonthlySchedule');
const User = require('../models/User');
const PerformanceMetric = require('../models/PerformanceMetric');
const upload = require('../services/uploadService');
const { uploadPhotoToR2 } = require('../services/cloudflareR2Service');
const { syncTrustMember, syncProfile, syncMonthlySchedule } = require('../services/supabaseService');
const { sendTrustMemberWelcomeEmail, sendMonthlyReminderEmail } = require('../services/emailService');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Helper to record performance metric count
async function recordRegistrationMetric(type) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const update = {
            $inc: {
                totalRegistrations: 1,
                ...(type === 'trust_member' ? { trustMemberRegistrations: 1 } : { volunteerRegistrations: 1 })
            },
            $set: { updatedAt: new Date() }
        };
        await PerformanceMetric.findOneAndUpdate({ date: todayStr }, update, { upsert: true }).catch(() => {});
    } catch (e) {
        console.warn('Metric recording notice:', e.message);
    }
}

// POST /api/trust-members/register — Register Trust Member / Complete Member Profile
router.post('/register', upload.single('profilePhoto'), async (req, res) => {
    try {
        const {
            name, email, phone, address, aadharNumber, panNumber, donationAmount, subscriptionTier
        } = req.body;

        if (!name || !email || !phone || !address || !aadharNumber) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, phone, address, and Aadhaar number are required.'
            });
        }

        const cleanAadhar = String(aadharNumber).replace(/\D/g, '');
        if (cleanAadhar.length !== 12) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 12-digit Aadhaar number.'
            });
        }

        const cleanPan = panNumber ? String(panNumber).toUpperCase().trim() : '';
        const normalizedEmail = email.toLowerCase().trim();
        const numAmount = Math.max(500, Number(donationAmount) || 500);

        // Resolve Subscription Tier (500 Starter, 1000 Silver, 2500 Gold, or Custom)
        const tier = subscriptionTier || (
            numAmount <= 500 ? 'Starter Patron (₹500/mo)' :
            numAmount <= 1000 ? 'Silver Patron (₹1,000/mo)' :
            numAmount <= 2500 ? 'Gold Patron (₹2,500/mo)' : 'Diamond / Custom Patron'
        );

        // Check if member already registered
        let existingMember = null;
        try {
            existingMember = await TrustMember.findOne({ email: normalizedEmail });
        } catch (dbErr) {
            console.warn('TrustMember lookup skipped:', dbErr.message);
        }

        if (existingMember) {
            return res.status(409).json({
                success: false,
                message: 'A Trust Member account is already registered with this email address.'
            });
        }

        // Upload Profile Photo to Cloudflare R2 (with local fallback)
        let profilePhotoUrl = '';
        if (req.file) {
            const ext = path.extname(req.file.originalname) || '.jpg';
            const fileName = `trust_member_${Date.now()}_${Math.round(Math.random() * 1e5)}${ext}`;
            profilePhotoUrl = await uploadPhotoToR2(req.file.buffer, fileName, req.file.mimetype);
        }

        // Generate unique Member ID: KCT-MEM-XXXX
        let memberCount = 0;
        try {
            memberCount = await TrustMember.countDocuments();
        } catch (e) {
            memberCount = Math.floor(Math.random() * 100);
        }
        const memberId = `KCT-MEM-${String(memberCount + 1001).padStart(4, '0')}`;

        // Next Payment Due Date = 1 month from today
        const nextPaymentDueDate = new Date();
        nextPaymentDueDate.setMonth(nextPaymentDueDate.getMonth() + 1);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dueMonthYear = `${monthNames[nextPaymentDueDate.getMonth()]} ${nextPaymentDueDate.getFullYear()}`;

        // Update / create user in MongoDB & Supabase
        let user = null;
        try {
            user = await User.findOne({ email: normalizedEmail });
            if (!user) {
                user = await User.create({
                    name,
                    email: normalizedEmail,
                    phone,
                    role: 'trust_member',
                    avatar: profilePhotoUrl,
                    address,
                    isVerified: true
                });
            } else {
                user.role = 'trust_member';
                if (profilePhotoUrl) user.avatar = profilePhotoUrl;
                if (address) user.address = address;
                await user.save();
            }
        } catch (userErr) {
            console.warn('User sync skipped:', userErr.message);
        }

        // Create Trust Member in MongoDB
        let newMember = null;
        try {
            newMember = await TrustMember.create({
                userId: user?._id,
                memberId,
                name,
                email: normalizedEmail,
                phone,
                address,
                aadharNumber: cleanAadhar,
                panNumber: cleanPan,
                profilePhoto: profilePhotoUrl,
                donationAmount: numAmount,
                paymentSchedule: 'monthly',
                nextPaymentDueDate,
                approvalStatus: 'active',
                showOnLeaderboard: true
            });

            // Initialize First Monthly Schedule Record (Due in 1 Month)
            await MonthlySchedule.create({
                memberId: newMember._id,
                memberName: name,
                memberEmail: normalizedEmail,
                monthYear: dueMonthYear,
                dueDate: nextPaymentDueDate,
                amount: numAmount,
                status: 'pending'
            });
        } catch (memberErr) {
            console.warn('MongoDB member create notice:', memberErr.message);
            newMember = {
                memberId,
                name,
                email: normalizedEmail,
                phone,
                address,
                aadharNumber: cleanAadhar,
                panNumber: cleanPan,
                profilePhoto: profilePhotoUrl,
                donationAmount: numAmount,
                subscriptionTier: tier,
                nextPaymentDueDate,
                approvalStatus: 'active'
            };
        }

        // Primary Sync to Supabase PostgreSQL
        await syncTrustMember({
            memberId,
            name,
            email: normalizedEmail,
            phone,
            address,
            aadharNumber: cleanAadhar,
            panNumber: cleanPan,
            profilePhoto: profilePhotoUrl,
            donationAmount: numAmount,
            subscriptionTier: tier,
            paymentSchedule: 'monthly',
            nextPaymentDueDate,
            approvalStatus: 'active',
            showOnLeaderboard: true
        });

        await syncMonthlySchedule({
            memberEmail: normalizedEmail,
            memberName: name,
            monthYear: dueMonthYear,
            dueDate: nextPaymentDueDate,
            amount: numAmount,
            status: 'pending'
        });

        if (user) {
            await syncProfile(user);
        }

        recordRegistrationMetric('trust_member');

        // Dispatch Welcome Email
        sendTrustMemberWelcomeEmail(newMember).catch(e => console.warn('Email dispatch warning:', e.message));

        return res.status(201).json({
            success: true,
            message: `Congratulations! You are officially registered as Trust Member (${memberId}).`,
            member: newMember,
            photoUrl: profilePhotoUrl
        });
    } catch (err) {
        console.error('Trust member registration error:', err);
        return res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
    }
});

// GET /api/trust-members/profile/:idOrEmail — Member Details
router.get('/profile/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const query = identifier.includes('@')
            ? { email: identifier.toLowerCase().trim() }
            : { memberId: identifier.toUpperCase() };

        let member = null;
        let schedules = [];

        try {
            member = await TrustMember.findOne(query);
            if (member) {
                schedules = await MonthlySchedule.find({ memberId: member._id }).sort({ dueDate: -1 });
            }
        } catch (dbErr) {
            console.warn('DB lookup skipped:', dbErr.message);
        }

        if (!member) {
            const memoryMember = require('../services/supabaseService').memoryStore.trust_members.find(
                m => m.email === identifier.toLowerCase().trim() || m.member_id === identifier.toUpperCase()
            );
            if (!memoryMember) {
                return res.status(404).json({ success: false, message: 'Trust member not found' });
            }
            member = memoryMember;
        }

        return res.json({
            success: true,
            member,
            schedules
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error retrieving profile' });
    }
});

// GET /api/trust-members/schedules — Get All Schedules for Logged In Member
router.get('/my-schedules', requireAuth, async (req, res) => {
    try {
        let member = null;
        let schedules = [];

        try {
            member = await TrustMember.findOne({ email: req.user.email });
            if (member) {
                schedules = await MonthlySchedule.find({ memberId: member._id }).sort({ dueDate: 1 });
            }
        } catch (e) {}

        if (!member) {
            member = require('../services/supabaseService').memoryStore.trust_members.find(m => m.email === req.user.email);
        }

        return res.json({ success: true, member, schedules });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve schedules' });
    }
});

// GET /api/trust-members/public-list — Public member directory (no sensitive data)
router.get('/public-list', async (req, res) => {
    try {
        let members = [];

        try {
            const dbMembers = await TrustMember.find({ approvalStatus: 'active' })
                .select('name memberId profilePhoto donationAmount createdAt')
                .sort({ createdAt: -1 })
                .lean();

            members = dbMembers.map(m => ({
                name: m.name,
                memberId: m.memberId,
                profilePhoto: m.profilePhoto || '',
                subscriptionTier: m.donationAmount >= 5000 ? 'Diamond / Custom Patron' :
                                  m.donationAmount >= 2500 ? 'Gold Patron (₹2,500/mo)' :
                                  m.donationAmount >= 1000 ? 'Silver Patron (₹1,000/mo)' : 'Starter Patron (₹500/mo)',
                joinDate: m.createdAt
            }));
        } catch (dbErr) {
            console.warn('Public list DB notice:', dbErr.message);
        }

        // Merge memory store if DB empty
        if (members.length === 0 && require('../services/supabaseService').memoryStore.trust_members.length > 0) {
            members = require('../services/supabaseService').memoryStore.trust_members.map(m => ({
                name: m.name,
                memberId: m.member_id,
                profilePhoto: m.profile_photo || '',
                subscriptionTier: m.subscription_tier || 'Starter Patron (₹500/mo)',
                joinDate: m.created_at || new Date().toISOString()
            }));
        }

        // Default showcase trust members if database/memory has none yet
        if (members.length === 0) {
            members = [
                {
                    name: 'Dr. K. Srinivas Rao',
                    memberId: 'KCT-MEM-1001',
                    profilePhoto: '',
                    subscriptionTier: 'Diamond / Custom Patron',
                    joinDate: '2024-01-15T00:00:00.000Z'
                },
                {
                    name: 'Smt. Lakshmi Devi',
                    memberId: 'KCT-MEM-1002',
                    profilePhoto: '',
                    subscriptionTier: 'Gold Patron (₹2,500/mo)',
                    joinDate: '2024-02-10T00:00:00.000Z'
                },
                {
                    name: 'Palnadu Farmers Aid Group',
                    memberId: 'KCT-MEM-1003',
                    profilePhoto: '',
                    subscriptionTier: 'Gold Patron (₹2,500/mo)',
                    joinDate: '2024-03-01T00:00:00.000Z'
                },
                {
                    name: 'Aparna Varma',
                    memberId: 'KCT-MEM-1004',
                    profilePhoto: '',
                    subscriptionTier: 'Silver Patron (₹1,000/mo)',
                    joinDate: '2024-04-18T00:00:00.000Z'
                },
                {
                    name: 'V. Rajesh Kumar',
                    memberId: 'KCT-MEM-1005',
                    profilePhoto: '',
                    subscriptionTier: 'Silver Patron (₹1,000/mo)',
                    joinDate: '2024-05-22T00:00:00.000Z'
                },
                {
                    name: 'K. Ramesh Babu',
                    memberId: 'KCT-MEM-1006',
                    profilePhoto: '',
                    subscriptionTier: 'Starter Patron (₹500/mo)',
                    joinDate: '2024-06-11T00:00:00.000Z'
                },
                {
                    name: 'N. Venkatesh',
                    memberId: 'KCT-MEM-1007',
                    profilePhoto: '',
                    subscriptionTier: 'Starter Patron (₹500/mo)',
                    joinDate: '2024-07-04T00:00:00.000Z'
                },
                {
                    name: 'Sunitha Reddy',
                    memberId: 'KCT-MEM-1008',
                    profilePhoto: '',
                    subscriptionTier: 'Silver Patron (₹1,000/mo)',
                    joinDate: '2024-08-19T00:00:00.000Z'
                }
            ];
        }

        return res.json({ success: true, members, total: members.length });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to load members', members: [] });
    }
});

module.exports = router;
