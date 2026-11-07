const mongoose = require('mongoose');

const monthlyScheduleSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrustMember',
        required: true,
        index: true
    },
    memberName: {
        type: String,
        required: true
    },
    memberEmail: {
        type: String,
        required: true,
        index: true
    },
    monthYear: {
        type: String, // e.g., "Nov 2026"
        required: true
    },
    dueDate: {
        type: Date,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'overdue'],
        default: 'pending',
        index: true
    },
    paidDate: {
        type: Date
    },
    transactionId: {
        type: String,
        default: ''
    },
    reminderCount: {
        type: Number,
        default: 0
    },
    lastReminderSentAt: {
        type: Date
    },
    notes: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index so a member doesn't have duplicate schedules for the same month
monthlyScheduleSchema.index({ memberId: 1, monthYear: 1 }, { unique: true });

module.exports = mongoose.model('MonthlySchedule', monthlyScheduleSchema);
