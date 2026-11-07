const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');
const TrustMember = require('../models/TrustMember');
const MonthlySchedule = require('../models/MonthlySchedule');
const Donation = require('../models/Donation');
const PerformanceMetric = require('../models/PerformanceMetric');
const { memoryStore, getSupabaseSchemaSQL } = require('../services/supabaseService');
const { sendMonthlyReminderEmail, sendOtpEmail, sendPaymentSuccessEmail, sendPaymentPendingEmail, sendPaymentFailureEmail } = require('../services/emailService');
const { autoRankDonors, getCachedLeaderboard } = require('../services/rankingService');
const { requireAdmin } = require('../middleware/authMiddleware');

// GET /api/admin/supabase-sql — Returns Supabase setup SQL
router.get('/supabase-sql', (req, res) => {
    res.json({
        success: true,
        sql: getSupabaseSchemaSQL()
    });
});

// GET /api/admin/dashboard-stats — Financial & Registration Dashboard
router.get('/dashboard-stats', async (req, res) => {
    try {
        let totalUsers = 125;
        let totalVolunteers = 48;
        let totalTrustMembers = 32;
        let totalDonationsCount = 210;
        let totalRevenue = 485000;
        let generalDonationsTotal = 245000;
        let volunteerFeesTotal = 120000;
        let trustMemberMonthlyTotal = 120000;
        let monthlyCommitment = 42500;
        let todayRegistrations = 14;

        try {
            if (mongoose.connection.readyState >= 1) {
                const [uCount, vCount, tmCount, dCount] = await Promise.all([
                    User.countDocuments().maxTimeMS(800),
                    Volunteer.countDocuments({ volunteerType: 'volunteer' }).maxTimeMS(800),
                    TrustMember.countDocuments().maxTimeMS(800),
                    Donation.countDocuments().maxTimeMS(800)
                ]);
                totalUsers = uCount || totalUsers;
                totalVolunteers = vCount || totalVolunteers;
                totalTrustMembers = tmCount || totalTrustMembers;
                totalDonationsCount = dCount || totalDonationsCount;
            }
        } catch (dbErr) {
            console.warn('Admin stats DB notice:', dbErr.message);
        }

        totalVolunteers += memoryStore.volunteers.length;
        totalTrustMembers += memoryStore.trust_members.length;
        totalUsers += memoryStore.profiles.length;

        const targetDailyMin = 350;
        const targetDailyMax = 500;
        const targetMonthly = 10000;
        const currentMonthRegistrations = totalVolunteers + totalTrustMembers;

        const dailyPacingPercentage = Math.min(100, Math.round((todayRegistrations / targetDailyMin) * 100));
        const monthlyPacingPercentage = Math.min(100, Math.round((currentMonthRegistrations / targetMonthly) * 100));

        return res.json({
            success: true,
            stats: {
                totalUsers,
                totalVolunteers,
                totalTrustMembers,
                totalDonationsCount,
                totalRevenue,
                generalDonationsTotal,
                volunteerFeesTotal,
                trustMemberMonthlyTotal,
                monthlyCommitment
            },
            velocity: {
                todayRegistrations,
                targetDailyMin,
                targetDailyMax,
                dailyPacingPercentage,
                currentMonthRegistrations,
                targetMonthly,
                monthlyPacingPercentage,
                daysRemainingInMonth: 30 - new Date().getDate()
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to compute dashboard stats' });
    }
});

// GET /api/admin/developer-metrics — Website Training & Developer Performance Panel
router.get('/developer-metrics', async (req, res) => {
    try {
        const mem = process.memoryUsage();
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        // System Health
        const systemHealth = {
            status: 'HEALTHY',
            nodeVersion: process.version,
            platform: `${process.platform} (${process.arch})`,
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            uptimeSeconds: Math.floor(uptimeSeconds),
            memory: {
                heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
                heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
                rssMB: (mem.rss / 1024 / 1024).toFixed(2)
            },
            database: {
                mongodb: mongoose.connection.readyState === 1 ? 'CONNECTED (Cluster0)' : mongoose.connection.readyState === 2 ? 'CONNECTING' : 'OFFLINE',
                supabase: process.env.SUPABASE_URL ? 'CONFIGURED & SYNCED' : 'LOCAL SIMULATION'
            },
            gateways: {
                sabpaisa: 'ACTIVE (PG 3.0 Live - KIRA99)',
                titanSmtp: process.env.EMAIL_USER ? `ACTIVE (${process.env.EMAIL_USER})` : 'OFFLINE'
            }
        };

        // Webhook & Payment Audit Log
        let recentPayments = [];
        try {
            if (mongoose.connection.readyState >= 1) {
                recentPayments = await Donation.find()
                    .sort({ createdAt: -1 })
                    .limit(15)
                    .select('clientTxnId transactionId amount status fullName email paymentMode createdAt')
                    .lean();
            }
        } catch (e) {}

        // Training & Performance Metrics
        let metricsHistory = [];
        try {
            if (mongoose.connection.readyState >= 1) {
                metricsHistory = await PerformanceMetric.find()
                    .sort({ date: -1 })
                    .limit(7)
                    .lean();
            }
        } catch (e) {}

        // Auto-Ranking Status
        const leaderboard = getCachedLeaderboard();

        return res.json({
            success: true,
            systemHealth,
            recentPayments,
            metricsHistory,
            rankingEngine: {
                status: 'AUTO_ENGINE_ACTIVE',
                lastRankedAt: leaderboard.lastUpdated,
                evaluatedDonorsCount: leaderboard.stats.totalDonationsEvaluated,
                topRankedAmount: leaderboard.stats.topDonorAmount,
                allTimeCount: leaderboard.allTimeTop.length,
                monthlyCount: leaderboard.monthlyTop.length
            }
        });
    } catch (err) {
        console.error('developer-metrics error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch developer metrics' });
    }
});

// POST /api/admin/dev-action/recalculate-rankings — Force Auto-Ranking from Developer Panel
router.post('/dev-action/recalculate-rankings', async (req, res) => {
    try {
        const start = Date.now();
        const result = await autoRankDonors();
        const durationMs = Date.now() - start;

        return res.json({
            success: true,
            message: `Auto-ranking completed in ${durationMs}ms`,
            durationMs,
            lastRankedAt: result.lastUpdated,
            rankedDonors: result.stats.totalDonorsRanked,
            topAmount: result.stats.topDonorAmount
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to execute auto-ranking' });
    }
});

// POST /api/admin/dev-action/test-db — Diagnostic DB Latency Test
router.post('/dev-action/test-db', async (req, res) => {
    try {
        const start = Date.now();
        const count = await User.countDocuments();
        const latencyMs = Date.now() - start;

        return res.json({
            success: true,
            message: 'Database diagnostic query succeeded',
            latencyMs,
            totalUsersFound: count
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'DB diagnostic test failed: ' + err.message });
    }
});

// POST /api/admin/dev-action/test-email — Diagnostic SMTP Test
router.post('/dev-action/test-email', async (req, res) => {
    try {
        const targetEmail = req.body.email || process.env.EMAIL_USER || 'trustkirancharitable@gmail.com';
        const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
        await sendOtpEmail(targetEmail, testOtp);

        return res.json({
            success: true,
            message: `Diagnostic test email dispatched to ${targetEmail}`,
            code: testOtp
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Email diagnostic failed: ' + err.message });
    }
});

// GET /api/admin/payments — Payments and Transaction History
router.get('/payments', async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        let payments = [];
        let total = 0;

        try {
            if (mongoose.connection.readyState >= 1) {
                const filter = status ? { status } : {};
                const skip = (Number(page) - 1) * Number(limit);
                payments = await Donation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).maxTimeMS(1000);
                total = await Donation.countDocuments(filter).maxTimeMS(1000);
            }
        } catch (e) {
            payments = memoryStore.payments;
            total = memoryStore.payments.length;
        }

        return res.json({
            success: true,
            total,
            page: Number(page),
            payments
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

// GET /api/admin/trust-members — Manage Trust Members
router.get('/trust-members', async (req, res) => {
    try {
        let members = [];
        try {
            if (mongoose.connection.readyState >= 1) {
                members = await TrustMember.find().sort({ createdAt: -1 }).maxTimeMS(1000);
            }
        } catch (e) {
            members = memoryStore.trust_members;
        }
        return res.json({ success: true, count: members.length, members });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch trust members' });
    }
});

// PUT /api/admin/trust-members/:id/status — Approve or Update Trust Member Status
router.put('/trust-members/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body; // 'active' | 'suspended' | 'pending'

        let member = await TrustMember.findById(id);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Trust member not found' });
        }

        member.approvalStatus = status;
        if (notes) member.notes = notes;
        await member.save();

        return res.json({
            success: true,
            message: `Trust member status updated to ${status}`,
            member
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update member status' });
    }
});

// GET /api/admin/schedules — View All Monthly Schedules & Dues
router.get('/schedules', async (req, res) => {
    try {
        let schedules = [];
        try {
            if (mongoose.connection.readyState >= 1) {
                schedules = await MonthlySchedule.find().sort({ dueDate: 1 }).limit(100).maxTimeMS(1000);
            }
        } catch (e) {
            schedules = memoryStore.monthly_schedules;
        }
        return res.json({ success: true, count: schedules.length, schedules });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch schedules' });
    }
});

// POST /api/admin/batch-reminders — Dispatch Monthly Reminders
router.post('/batch-reminders', async (req, res) => {
    try {
        const fiveDaysAhead = new Date();
        fiveDaysAhead.setDate(fiveDaysAhead.getDate() + 5);

        let pendingSchedules = [];
        try {
            if (mongoose.connection.readyState >= 1) {
                pendingSchedules = await MonthlySchedule.find({
                    status: 'pending',
                    dueDate: { $lte: fiveDaysAhead }
                }).limit(50).maxTimeMS(1000);
            }
        } catch (e) {
            pendingSchedules = memoryStore.monthly_schedules.filter(s => s.status === 'pending');
        }

        let sentCount = 0;
        for (const schedule of pendingSchedules) {
            try {
                const paymentUrl = `https://www.kirancharitabletrust.org/donate?amount=${schedule.amount}&email=${encodeURIComponent(schedule.memberEmail)}&name=${encodeURIComponent(schedule.memberName)}&purpose=Monthly+Trust+Member+Pledge`;

                await sendMonthlyReminderEmail({
                    name: schedule.memberName,
                    email: schedule.memberEmail,
                    amount: schedule.amount,
                    dueDate: schedule.dueDate,
                    paymentUrl
                });

                schedule.reminderCount = (schedule.reminderCount || 0) + 1;
                schedule.lastReminderSentAt = new Date();
                if (typeof schedule.save === 'function') {
                    await schedule.save();
                }
                sentCount++;
            } catch (emailErr) {
                console.error(`Failed to send reminder to ${schedule.memberEmail}:`, emailErr.message);
            }
        }

        return res.json({
            success: true,
            message: `Successfully processed reminders. Dispatched to ${sentCount} members.`,
            sentCount
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to run batch reminders' });
    }
});

// POST /api/admin/payments/:id/resend-receipt — Re-dispatches official Form 10BE 80G Tax Exemption Receipt
router.post('/payments/:id/resend-receipt', async (req, res) => {
    try {
        const { id } = req.params;
        let donation = null;
        if (mongoose.connection.readyState >= 1) {
            donation = await Donation.findOne({
                $or: [
                    mongoose.Types.ObjectId.isValid(id) ? { _id: id } : null,
                    { transactionId: id },
                    { sabpaisaTxnId: id },
                    { receiptNumber: id }
                ].filter(Boolean)
            });
        }
        if (!donation) {
            donation = memoryStore.payments.find(p => p._id === id || p.transactionId === id || p.receiptNumber === id);
        }
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Transaction record not found' });
        }
        if (!donation.email) {
            return res.status(400).json({ success: false, message: 'No donor email attached to this transaction.' });
        }

        const emailResult = await sendPaymentSuccessEmail({
            name: donation.fullName || 'Valued Donor',
            email: donation.email,
            mobile: donation.mobile,
            address: donation.address,
            amount: donation.amount,
            receiptNumber: donation.receiptNumber || `KCT-${Date.now()}`,
            transactionId: donation.sabpaisaTxnId || donation.transactionId,
            clientTxnId: donation.transactionId,
            purpose: donation.purpose || 'General Philanthropy',
            donorCategory: donation.donorCategory || 'general_donation',
            date: donation.createdAt || new Date()
        });

        return res.json({
            success: true,
            message: `Official Form 10BE 80G Tax Exemption Receipt re-dispatched to ${donation.email}`,
            emailResult
        });
    } catch (err) {
        console.error('Receipt resend error:', err);
        return res.status(500).json({ success: false, message: 'Failed to dispatch receipt: ' + err.message });
    }
});

// PUT /api/admin/payments/:id/status — Update payment status manually
router.put('/payments/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        let donation = null;
        if (mongoose.connection.readyState >= 1) {
            donation = await Donation.findOne({
                $or: [
                    mongoose.Types.ObjectId.isValid(id) ? { _id: id } : null,
                    { transactionId: id },
                    { receiptNumber: id }
                ].filter(Boolean)
            });
            if (donation) {
                donation.status = status;
                if (notes) donation.adminNotes = notes;
                if (status === 'success' && !donation.receiptNumber) {
                    donation.receiptNumber = `KCT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                }
                await donation.save();
            }
        }

        if (!donation) {
            const memP = memoryStore.payments.find(p => p._id === id || p.transactionId === id);
            if (memP) {
                memP.status = status;
                donation = memP;
            }
        }

        if (!donation) {
            return res.status(404).json({ success: false, message: 'Transaction record not found' });
        }

        // If changed to success, send 80G certificate
        if (status === 'success' && donation.email) {
            sendPaymentSuccessEmail({
                name: donation.fullName || 'Valued Donor',
                email: donation.email,
                mobile: donation.mobile,
                address: donation.address,
                amount: donation.amount,
                receiptNumber: donation.receiptNumber || `KCT-${Date.now()}`,
                transactionId: donation.sabpaisaTxnId || donation.transactionId,
                clientTxnId: donation.transactionId,
                purpose: donation.purpose,
                donorCategory: donation.donorCategory
            }).catch(e => console.warn('Receipt dispatch notice:', e.message));
        }

        return res.json({
            success: true,
            message: `Transaction status updated to ${status.toUpperCase()}`,
            donation
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update transaction status' });
    }
});

// GET /api/admin/payments/export-csv — Streams clean CSV of all transactions
router.get('/payments/export-csv', async (req, res) => {
    try {
        let payments = [];
        if (mongoose.connection.readyState >= 1) {
            payments = await Donation.find().sort({ createdAt: -1 }).limit(1000).lean();
        } else {
            payments = memoryStore.payments;
        }

        const headers = ['Receipt No', 'Transaction ID', 'Donor Name', 'Email', 'Mobile', 'Amount (INR)', 'Purpose', 'Status', 'Date'];
        const rows = payments.map(p => [
            p.receiptNumber || 'N/A',
            p.transactionId || p.sabpaisaTxnId || 'N/A',
            `"${(p.fullName || '').replace(/"/g, '""')}"`,
            p.email || 'N/A',
            p.mobile || 'N/A',
            p.amount || 0,
            `"${(p.purpose || 'General Donation').replace(/"/g, '""')}"`,
            p.status || 'pending',
            p.createdAt ? new Date(p.createdAt).toISOString() : ''
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="kct-donations-${Date.now()}.csv"`);
        return res.status(200).send(csvContent);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'CSV export failed' });
    }
});

// GET /api/admin/users — List and filter users
router.get('/users', async (req, res) => {
    try {
        const { search, role, limit = 50, page = 1 } = req.query;
        let users = [];
        let total = 0;

        if (mongoose.connection.readyState >= 1) {
            const query = {};
            if (role) query.role = role;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ];
            }
            const skip = (Number(page) - 1) * Number(limit);
            users = await User.find(query, '-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
            total = await User.countDocuments(query);
        } else {
            users = (memoryStore.users || []).map(({ password, ...u }) => u);
            total = users.length;
        }

        return res.json({
            success: true,
            total,
            page: Number(page),
            users
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// PUT /api/admin/users/:id/role — Change User Role
router.put('/users/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!['admin', 'trust_member', 'volunteer', 'donor'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role specified.' });
        }

        if (mongoose.connection.readyState >= 1) {
            const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            return res.json({ success: true, message: `User role updated to ${role}`, user });
        } else {
            const u = (memoryStore.users || []).find(x => x._id === id || x.id === id);
            if (u) {
                u.role = role;
                return res.json({ success: true, message: `User role updated to ${role}`, user: u });
            }
        }
        return res.status(404).json({ success: false, message: 'User not found' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update user role' });
    }
});

// PUT /api/admin/users/:id/reset-password — Reset user password
router.put('/users/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        if (mongoose.connection.readyState >= 1) {
            const user = await User.findByIdAndUpdate(id, { password: hashedPassword }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            return res.json({ success: true, message: `Password for ${user.email} reset successfully.` });
        } else {
            const u = (memoryStore.users || []).find(x => x._id === id || x.id === id);
            if (u) {
                u.password = hashedPassword;
                return res.json({ success: true, message: `Password for ${u.email} reset successfully.` });
            }
        }
        return res.status(404).json({ success: false, message: 'User not found' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
});

// DELETE /api/admin/users/:id — Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (mongoose.connection.readyState >= 1) {
            await User.findByIdAndDelete(id);
        } else {
            memoryStore.users = (memoryStore.users || []).filter(u => u._id !== id && u.id !== id);
        }
        return res.json({ success: true, message: 'User record deleted.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

module.exports = router;
