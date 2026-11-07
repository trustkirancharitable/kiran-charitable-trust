const mongoose = require('mongoose');

const performanceMetricSchema = new mongoose.Schema({
    date: {
        type: String, // YYYY-MM-DD
        required: true,
        unique: true,
        index: true
    },
    pageViews: {
        type: Number,
        default: 0
    },
    uniqueVisitors: {
        type: Number,
        default: 0
    },
    volunteerRegistrations: {
        type: Number,
        default: 0
    },
    trustMemberRegistrations: {
        type: Number,
        default: 0
    },
    totalRegistrations: {
        type: Number,
        default: 0
    },
    successfulDonations: {
        type: Number,
        default: 0
    },
    failedDonations: {
        type: Number,
        default: 0
    },
    donationRevenue: {
        type: Number,
        default: 0
    },
    emailsDispatched: {
        type: Number,
        default: 0
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PerformanceMetric', performanceMetricSchema);
