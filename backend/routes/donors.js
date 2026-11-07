const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const TrustMember = require('../models/TrustMember');
const { autoRankDonors, getCachedLeaderboard } = require('../services/rankingService');

// GET /api/donors/ticker — Lightweight endpoint for real-time scrolling marquee
router.get('/ticker', async (req, res) => {
    try {
        const leaderboard = getCachedLeaderboard();
        const tickerItems = (leaderboard.allTimeTop || []).map(d => ({
            name: d.name,
            photo: d.photo || '',
            tag: d.tierBadge || 'Valued Patron',
            amount: d.totalDonated,
            highlight: d.rank <= 3
        }));

        return res.json({
            success: true,
            ticker: tickerItems.length > 0 ? tickerItems : [
                { name: 'Dr. K. Srinivas Rao', photo: '', tag: 'Chief Patron', amount: 50000, highlight: true },
                { name: 'Smt. Lakshmi Devi', photo: '', tag: 'Honorary Trustee', amount: 25000, highlight: true }
            ]
        });
    } catch (err) {
        return res.json({
            success: true,
            ticker: [
                { name: 'Dr. K. Srinivas Rao', photo: '', tag: 'Chief Patron', amount: 50000, highlight: true }
            ]
        });
    }
});

// GET /api/donors/leaderboard — Auto-Ranked Leaderboard (Monthly & All-Time)
router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = getCachedLeaderboard();
        let trustMembersWall = [];

        try {
            if (mongoose.connection.readyState >= 1) {
                trustMembersWall = await TrustMember.find({ showOnLeaderboard: true, approvalStatus: 'active' })
                    .select('name profilePhoto donationAmount memberId totalDonated createdAt subscriptionTier')
                    .sort({ totalDonated: -1, donationAmount: -1 })
                    .limit(20)
                    .lean();
            }
        } catch (dbErr) {
            console.warn('Leaderboard trust member read notice:', dbErr.message);
        }

        return res.json({
            success: true,
            month: leaderboard.month,
            lastUpdated: leaderboard.lastUpdated,
            allTimeTop: leaderboard.allTimeTop,
            monthlyTop: leaderboard.monthlyTop,
            stats: leaderboard.stats,
            trustMembers: trustMembersWall
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to load leaderboard' });
    }
});

// POST /api/donors/recalculate-rankings — Manual / Webhook trigger to re-compute rankings
router.post('/recalculate-rankings', async (req, res) => {
    try {
        const updated = await autoRankDonors();
        return res.json({
            success: true,
            message: 'Donor rankings successfully re-calculated and cached.',
            lastUpdated: updated.lastUpdated,
            rankedCount: updated.stats.totalDonorsRanked,
            topAmount: updated.stats.topDonorAmount
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to recalculate rankings' });
    }
});

module.exports = router;
