const mongoose = require('mongoose');

const paymentMandateSchema = new mongoose.Schema({
    mandateId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // NPCI Unique Mandate Number or Bank Mandate Reference
    umn: {
        type: String,
        sparse: true,
        index: true
    },
    donorName: {
        type: String,
        required: true,
        trim: true
    },
    donorEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    donorMobile: {
        type: String,
        required: true,
        trim: true
    },
    memberId: {
        type: String,
        sparse: true,
        index: true
    },
    userId: {
        type: String,
        sparse: true,
        index: true
    },
    mandateType: {
        type: String,
        enum: ['upi_autopay', 'enach_netbanking', 'enach_debit_card', 'card_si'],
        default: 'upi_autopay',
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'paused', 'revoked', 'expired', 'failed'],
        default: 'pending',
        index: true
    },
    frequency: {
        type: String,
        enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ASPRESENTED'],
        default: 'MONTHLY'
    },
    recurringAmount: {
        type: Number,
        required: true
    },
    maxAmountCap: {
        type: Number,
        default: 15000 // RBI default limit for contactless/e-mandate without AFA
    },
    currency: {
        type: String,
        default: 'INR'
    },
    purpose: {
        type: String,
        default: 'Monthly Trust Charitable Contribution'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    nextDebitDate: {
        type: Date,
        index: true
    },
    lastDebitDate: {
        type: Date
    },
    debitCount: {
        type: Number,
        default: 0
    },
    totalDebitedAmount: {
        type: Number,
        default: 0
    },
    // UPI AutoPay specific fields
    vpa: {
        type: String,
        trim: true
    },
    upiApp: {
        type: String, // phonepe, gpay, paytm, bhim, cred, other
        default: 'other'
    },
    // Card Standing Instruction specific fields (Tokenized, PCI-DSS compliant)
    cardTokenRefId: {
        type: String
    },
    cardLast4: {
        type: String
    },
    cardBrand: {
        type: String
    },
    cardExpiry: {
        type: String
    },
    // e-NACH Bank Account details (Masked)
    bankDetails: {
        bankName: String,
        accountNumberMasked: String,
        ifsc: String,
        accountType: {
            type: String,
            default: 'SAVINGS'
        }
    },
    // RBI 24h/48h Pre-Debit Notification Log
    preDebitNotifications: [{
        scheduledDate: Date,
        amount: Number,
        notificationSentAt: {
            type: Date,
            default: Date.now
        },
        channel: {
            type: String,
            default: 'email'
        },
        status: {
            type: String,
            enum: ['delivered', 'failed'],
            default: 'delivered'
        }
    }],
    // Execution History Log
    debitExecutions: [{
        transactionId: String,
        gatewayRefNo: String,
        amount: Number,
        debitDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['success', 'failed', 'pending'],
            default: 'success'
        },
        failureReason: String
    }],
    gatewayMeta: {
        type: Object,
        default: {}
    },
    revokedAt: {
        type: Date
    },
    revocationReason: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

paymentMandateSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('PaymentMandate', paymentMandateSchema);
