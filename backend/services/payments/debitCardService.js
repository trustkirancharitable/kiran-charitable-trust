/**
 * Debit Card Payment Integration Service
 * 
 * Specialized handling for Indian & International Debit Cards:
 * - RuPay Debit Cards: Zero MDR / compliant fee exemptions under RBI mandates
 * - Visa, MasterCard, Maestro Debit processing
 * - Two-factor authentication (3D Secure 2.0 OTP / ATM PIN redirection)
 * - Granular Debit-specific failure diagnostics:
 *   - Insufficient funds in bank account
 *   - Daily ATM/POS transaction limits exceeded
 *   - Online / E-commerce usage disabled by issuer bank
 *   - Expired card / Invalid CVV
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { validateCard, maskCardNumber, detectCardBrand, lookupBank } = require('./cardValidation');
const Donation = require('../../models/Donation');
const { syncPayment } = require('../supabaseService');
const { sendPaymentSuccessEmail, sendPaymentFailureEmail } = require('../emailService');

const CLIENT_CODE = process.env.SABPAISA_CLIENT_CODE || 'KIRA99';
const API_KEY = process.env.SABPAISA_API_KEY || 'sp_pT78w4hwe1hgNvUe-8yeK6DA1mYckbGXEiSsuzthxzk';
const SECRET_KEY = process.env.SABPAISA_SECRET_KEY || 'sec_TiRVAAILsA2XJwN3V5TOHgCaKfi7NWAz5E72i3XxM1Q';
const BASE_URL = process.env.SABPAISA_BASE_URL || 'https://merchant-api.sabpaisa.in';

// Debit card error mapping dictionary for user-friendly advice
const DEBIT_ERROR_CODES = {
    'INSUFFICIENT_FUNDS': {
        code: 'INSUFFICIENT_FUNDS',
        title: 'Insufficient Balance',
        message: 'The linked bank account does not have sufficient funds to complete this charitable contribution. Please try with another debit card or UPI.'
    },
    'LIMIT_EXCEEDED': {
        code: 'LIMIT_EXCEEDED',
        title: 'Daily Limit Exceeded',
        message: 'The transaction exceeds your debit card’s daily online payment limit set by your bank. You can temporarily raise this limit in your mobile banking app.'
    },
    'ECOMMERCE_DISABLED': {
        code: 'ECOMMERCE_DISABLED',
        title: 'Online Payments Disabled',
        message: 'As per RBI guidelines, online e-commerce transactions might be disabled on this new debit card. Please enable "Online/E-commerce Transactions" in your bank app and retry.'
    },
    'INCORRECT_OTP': {
        code: 'INCORRECT_OTP',
        title: '3DS Authentication Failed',
        message: 'The One-Time Password (OTP) entered was incorrect or expired. Please request a new OTP.'
    },
    'CARD_EXPIRED': {
        code: 'CARD_EXPIRED',
        title: 'Card Expired',
        message: 'This debit card is past its expiration date. Please use an active card.'
    },
    'SUSPECTED_FRAUD': {
        code: 'SUSPECTED_FRAUD',
        title: 'Declined by Bank',
        message: 'Your bank declined this transaction for security verification. Please approve the prompt from your bank or contact their customer care.'
    }
};

/**
 * Generate Debit Transaction ID (TXN_DC_YYYYMMDD_XXXX)
 */
function generateDebitTxnId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `TXN_DC_${dateStr}_${randomHex}`;
}

/**
 * 1. Validate Debit Card before submission
 * @param {Object} cardDetails
 * @returns {Object} validation result
 */
function validateDebitCardInput(cardDetails) {
    const val = validateCard(cardDetails);
    if (!val.isValid) {
        return {
            isValid: false,
            errors: val.errors
        };
    }

    const brand = val.brand;
    const isRupay = brand === 'rupay';
    const isDomesticZeroMdr = isRupay; // RuPay Debit cards have 0% MDR benefit

    return {
        isValid: true,
        brand,
        bank: val.bank,
        last4: val.last4,
        maskedNumber: val.maskedNumber,
        isRupay,
        zeroMdrApplicable: isDomesticZeroMdr,
        feeNotice: isRupay ? 'Zero processing surcharge applicable for RuPay Debit Cards' : 'Standard bank gateway routing'
    };
}

/**
 * 2. Prepare & Initiate Debit Card Payment
 * Builds secure gateway request payload without exposing CVV in storage.
 * 
 * @param {Object} params
 * @param {Object} params.donorDetails { fullName, email, mobile, address, panNumber }
 * @param {Object} params.cardDetails { cardNumber, expiryMonth, expiryYear, cvv, cardHolderName }
 * @param {number} params.amount Amount in INR
 * @param {string} [params.purpose]
 * @param {string} [params.returnUrl]
 * @param {string} [params.memberId]
 * @param {string} [params.userId]
 * @returns {Promise<Object>} Checkout session and 3DS redirection URL
 */
async function initiateDebitCardPayment({
    donorDetails,
    cardDetails,
    amount,
    purpose = 'Charitable Contribution via Debit Card',
    returnUrl,
    memberId,
    userId
}) {
    if (!donorDetails || !cardDetails || !amount) {
        throw new Error('Donor details, card details, and donation amount are required.');
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1) {
        throw new Error('Please enter a valid donation amount (minimum ₹1).');
    }

    // Step 1: Rigorous Card Validation
    const cardValidationResult = validateDebitCardInput(cardDetails);
    if (!cardValidationResult.isValid) {
        throw new Error(cardValidationResult.errors.join(' '));
    }

    const clientTxnId = generateDebitTxnId();
    const timestamp = Date.now();
    const amountInPaise = Math.round(numAmount * 100);

    // Step 2: Compute HMAC SHA-256 Checksum for Gateway
    const rawString = `${CLIENT_CODE}|${clientTxnId}|${amountInPaise}|INR|${timestamp}`;
    const checksum = crypto.createHmac('sha256', SECRET_KEY).update(rawString).digest('hex');

    const redirectUrl = returnUrl || `${process.env.CLIENT_URL || 'https://www.kirancharitabletrust.org'}/donate?status=processed`;

    // Gateway payload format for direct card processing
    const gatewayPayload = {
        clientCode: CLIENT_CODE,
        merchantTxnId: clientTxnId,
        amount: numAmount,
        currency: 'INR',
        paymentMode: 'DebitCard',
        cardBrand: cardValidationResult.brand.toUpperCase(),
        payerName: donorDetails.fullName || cardDetails.cardHolderName,
        payerEmail: donorDetails.email,
        payerMobile: donorDetails.mobile,
        payerAddress: donorDetails.address || 'India',
        panNumber: donorDetails.panNumber || undefined,
        purpose,
        callbackUrl: redirectUrl,
        timestamp,
        checksum,
        // Masked identifier for audit
        maskedCard: cardValidationResult.maskedNumber,
        issuingBank: cardValidationResult.bank
    };

    // Pre-record Pending Donation in DB (Audit trail)
    try {
        if (mongoose.connection && mongoose.connection.readyState >= 1) {
            await Donation.create({
                fullName: donorDetails.fullName,
                mobile: donorDetails.mobile,
                email: donorDetails.email.toLowerCase(),
                address: donorDetails.address || 'India',
                amount: numAmount,
                panNumber: donorDetails.panNumber || '',
                donationType: 'cash',
                donorCategory: memberId ? 'trust_member_contribution' : 'general',
                memberId: memberId || undefined,
                userId: userId || undefined,
                paymentMode: `DebitCard_${cardValidationResult.brand}`,
                status: 'pending',
                transactionId: clientTxnId,
                purpose,
                notes: `Debit Card Payment [${cardValidationResult.bank} - ${cardValidationResult.maskedNumber}]`
            });
        }

        // Sync initial pending state to Supabase
        syncPayment({
            clientTxnId,
            amount: numAmount,
            donorName: donorDetails.fullName,
            email: donorDetails.email,
            mobile: donorDetails.mobile,
            status: 'pending',
            paymentMode: 'debit_card'
        }).catch(() => {});
    } catch (dbErr) {
        console.warn('Debit card pre-record notice:', dbErr.message);
    }

    return {
        success: true,
        clientTxnId,
        paymentMode: 'debit_card',
        cardBrand: cardValidationResult.brand,
        issuingBank: cardValidationResult.bank,
        maskedCard: cardValidationResult.maskedNumber,
        amount: numAmount,
        checkoutPayload: gatewayPayload,
        // Live 3DS 2.0 Gateway Checkout Endpoint
        checkoutUrl: `${BASE_URL}/v2/checkout/card?clientTxnId=${clientTxnId}&authMode=3DS2`
    };
}

/**
 * 3. Interpret & Parse Debit Card Callback / Response
 * Diagnoses response and maps errors to actionable donor guidance.
 * 
 * @param {Object} callbackData 
 * @returns {Object} normalized result
 */
function interpretDebitCallback(callbackData) {
    const rawStatus = String(callbackData.status || callbackData.statusCode || '').toLowerCase();
    const responseCode = String(callbackData.responseCode || callbackData.errorCode || '').toUpperCase();

    const isSuccess = rawStatus === 'success' || rawStatus === '0000' || rawStatus === 'paid';
    const isPending = rawStatus === 'pending' || rawStatus === 'in_progress';

    let errorDetail = null;
    if (!isSuccess && !isPending) {
        if (responseCode.includes('INSUFFICIENT') || responseCode === '51') {
            errorDetail = DEBIT_ERROR_CODES.INSUFFICIENT_FUNDS;
        } else if (responseCode.includes('LIMIT') || responseCode === '61') {
            errorDetail = DEBIT_ERROR_CODES.LIMIT_EXCEEDED;
        } else if (responseCode.includes('ECOMM') || responseCode.includes('NOT_ALLOWED') || responseCode === '57') {
            errorDetail = DEBIT_ERROR_CODES.ECOMMERCE_DISABLED;
        } else if (responseCode.includes('OTP') || responseCode.includes('AUTH_FAIL') || responseCode === '33') {
            errorDetail = DEBIT_ERROR_CODES.INCORRECT_OTP;
        } else if (responseCode.includes('EXPIRED') || responseCode === '54') {
            errorDetail = DEBIT_ERROR_CODES.CARD_EXPIRED;
        } else {
            errorDetail = {
                code: responseCode || 'DEBIT_DECLINE',
                title: 'Transaction Declined',
                message: callbackData.errorMessage || callbackData.message || 'Your bank was unable to process this debit transaction. Please retry or use UPI.'
            };
        }
    }

    return {
        isSuccess,
        isPending,
        isFailed: !isSuccess && !isPending,
        clientTxnId: callbackData.clientTxnId || callbackData.merchantTxnId,
        bankRefNo: callbackData.bankRefNo || callbackData.rrn || '',
        paidAmount: Number(callbackData.paidAmount || callbackData.amount || 0),
        errorDetail
    };
}

module.exports = {
    DEBIT_ERROR_CODES,
    generateDebitTxnId,
    validateDebitCardInput,
    initiateDebitCardPayment,
    interpretDebitCallback
};
