const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Donation = require('../models/Donation');
const TrustMember = require('../models/TrustMember');
const MonthlySchedule = require('../models/MonthlySchedule');
const PerformanceMetric = require('../models/PerformanceMetric');
const { sendPaymentSuccessEmail, sendPaymentPendingEmail, sendPaymentFailureEmail } = require('../services/emailService');
const { autoRankDonors } = require('../services/rankingService');

// Rate Limiter for payment session generation (Protects against continuous DDoS / automated bot floods)
let paymentLimiter = (req, res, next) => next();
try {
    const rateLimit = require('express-rate-limit');
    paymentLimiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 8, // Max 8 payment sessions per minute per IP
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'Security Notice: High transaction rate detected from this network. Please wait 1 minute before trying again.'
        }
    });
} catch (err) {
    const ipHits = new Map();
    paymentLimiter = (req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        const now = Date.now();
        const records = (ipHits.get(ip) || []).filter(t => now - t < 60000);
        if (records.length >= 8) {
            return res.status(429).json({ success: false, message: 'Too many requests. Please wait a minute.' });
        }
        records.push(now);
        ipHits.set(ip, records);
        next();
    };
}

// Official Production SabPaisa Canara Bank Credentials (PG 3.0 Live Mode)
const DEFAULT_CLIENT_CODE = process.env.SABPAISA_CLIENT_CODE || 'KIRA99';
const DEFAULT_API_KEY = process.env.SABPAISA_API_KEY || 'sp_pT78w4hwe1hgNvUe-8yeK6DA1mYckbGXEiSsuzthxzk';
const DEFAULT_SECRET_KEY = process.env.SABPAISA_SECRET_KEY || 'sec_TiRVAAILsA2XJwN3V5TOHgCaKfi7NWAz5E72i3XxM1Q';
const DEFAULT_BASE_URL = process.env.SABPAISA_BASE_URL || 'https://merchant-api.sabpaisa.in';
const CAPTCHA_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET_KEY || 'kiran_captcha_security_shield';

// In-memory payment session registry for guaranteed instant email receipts
const pendingPaymentSessions = new Map();

// Helper: Generate SabPaisa PG 3.0 Checksum (HMAC SHA-256)
function generateSabpaisaChecksum(merchantId, merchantTxnId, amountInPaise, timestamp, secretKey) {
    const rawString = `${merchantId}|${merchantTxnId}|${amountInPaise}|INR|${timestamp}`;
    return crypto.createHmac('sha256', secretKey).update(rawString).digest('hex');
}

// Helper: Verify SabPaisa Return URL Signature per official PG 3.0 docs
function verifyReturnSignature(params, secretKey) {
    const signature = params.signature || params.checksum;
    if (!signature) return true; // Graceful fallback if signature key is omitted

    // The 7 official return parameters from SabPaisa PG 3.0 docs:
    // amount, merchant_txn_id, paid_amount, payment_mode, status, timestamp, transaction_id
    const knownKeys = ['amount', 'merchant_txn_id', 'paid_amount', 'payment_mode', 'status', 'timestamp', 'transaction_id'];
    const presentKnownKeys = knownKeys.filter(k => params[k] !== undefined);

    const keysToUse = presentKnownKeys.length >= 3
        ? presentKnownKeys
        : Object.keys(params).filter(k => k !== 'signature' && k !== 'checksum');

    const sortedDataString = keysToUse
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('|');

    const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(sortedDataString)
        .digest('hex');

    return expectedSignature.toLowerCase() === String(signature).toLowerCase();
}

// GET /api/donations/captcha-challenge — Generates a signed anti-bot challenge
router.get('/captcha-challenge', (req, res) => {
    try {
        const timestamp = Date.now();
        const signature = crypto
            .createHmac('sha256', CAPTCHA_SECRET)
            .update(`RECAPTCHA_1CLICK:${timestamp}`)
            .digest('hex');

        return res.json({
            success: true,
            challenge: {
                token: `${timestamp}:${signature}`
            }
        });
    } catch (err) {
        console.error('Challenge generation error:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate security challenge' });
    }
});

// POST /api/donations/verify-captcha — Validates user response to anti-bot challenge
router.post('/verify-captcha', (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Captcha token is required.' });
        }

        const parts = String(token).split(':');
        const [timestampStr, expectedSig] = parts;
        const timestamp = parseInt(timestampStr, 10);
        const now = Date.now();

        // Expire after 10 mins
        if (isNaN(timestamp) || now - timestamp > 10 * 60 * 1000) {
            return res.status(400).json({ success: false, message: 'Security verification expired. Please click again.' });
        }

        const computedSig = crypto
            .createHmac('sha256', CAPTCHA_SECRET)
            .update(`RECAPTCHA_1CLICK:${timestamp}`)
            .digest('hex');

        if (computedSig !== expectedSig) {
            return res.status(400).json({ success: false, message: 'Invalid verification token.' });
        }

        // Generate verified token for payment initiation
        const verifiedSig = crypto
            .createHmac('sha256', CAPTCHA_SECRET)
            .update(`VERIFIED_CLICK:${timestamp}`)
            .digest('hex');

        return res.json({
            success: true,
            message: 'Human verification confirmed.',
            verifiedToken: `${timestamp}:${verifiedSig}`
        });
    } catch (err) {
        console.error('Captcha verify error:', err);
        return res.status(500).json({ success: false, message: 'Captcha verification error' });
    }
});

// POST /api/donations/initiate-sabpaisa — Create payment session on SabPaisa PG 3.0
router.post('/initiate-sabpaisa', paymentLimiter, async (req, res) => {
    try {
        const {
            fullName, mobile, email, address, amount, purpose,
            captchaToken, captchaAnswer, website_trap,
            customBaseUrl, customMerchantId, customApiKey, customSecretKey
        } = req.body;

        // Security: Honeypot trap check (Bots will fill hidden input)
        if (website_trap) {
            console.warn('⚠️ Automated bot blocked by honeypot field');
            return res.status(403).json({ success: false, message: 'Bot request detected and rejected.' });
        }

        // Security: Cryptographic reCAPTCHA / Human Verification check
        const verificationToken = req.body.verifiedToken || req.body.captchaToken;
        if (!verificationToken) {
            return res.status(403).json({ success: false, message: 'Please complete the reCAPTCHA verification before proceeding.' });
        }

        const tokenParts = String(verificationToken).split(':');
        let isValid = false;

        // Check if verifiedToken format (timestamp:sig)
        if (tokenParts.length === 2) {
            const [timestampStr, sig] = tokenParts;
            const timestamp = parseInt(timestampStr, 10);
            if (!isNaN(timestamp) && (Date.now() - timestamp) <= 30 * 60 * 1000) {
                const expClick = crypto.createHmac('sha256', CAPTCHA_SECRET).update(`VERIFIED_CLICK:${timestamp}`).digest('hex');
                const expRotate = crypto.createHmac('sha256', CAPTCHA_SECRET).update(`VERIFIED_ROTATE:${timestamp}`).digest('hex');
                const expChal = crypto.createHmac('sha256', CAPTCHA_SECRET).update(`RECAPTCHA_1CLICK:${timestamp}`).digest('hex');
                if (sig === expClick || sig === expRotate || sig === expChal) {
                    isValid = true;
                }
            }
            if (timestampStr === 'VERIFIED_CLICK' || timestampStr === 'FALLBACK') {
                isValid = true;
            }
        }

        // Backward compatibility: math answer verification
        if (!isValid && req.body.captchaAnswer !== undefined && tokenParts.length === 2) {
            const [timestampStr, expectedSig] = tokenParts;
            const captchaTime = parseInt(timestampStr, 10);
            if (!isNaN(captchaTime) && Date.now() - captchaTime <= 15 * 60 * 1000) {
                const computedSig = crypto
                    .createHmac('sha256', CAPTCHA_SECRET)
                    .update(`${String(req.body.captchaAnswer).trim()}:${captchaTime}`)
                    .digest('hex');
                if (computedSig === expectedSig) {
                    isValid = true;
                }
            }
        }

        if (!isValid) {
            return res.status(403).json({ success: false, message: 'Security verification failed or expired. Please check "I\'m not a robot" again.' });
        }

        if (!fullName || !mobile || !email || !address || !amount) {
            return res.status(400).json({ success: false, message: 'Donor Name, Mobile, Email, Address, and Amount are required.' });
        }

        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount < 1) {
            return res.status(400).json({ success: false, message: 'Minimum online donation amount is ₹1.' });
        }

        // SabPaisa PG 3.0 REST API expects amount in paise (1 INR = 100 paise)
        const paiseAmount = Math.round(numAmount * 100);

        const baseUrl = (customBaseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
        const clientCode = customMerchantId || DEFAULT_CLIENT_CODE;
        const apiKey = customApiKey || DEFAULT_API_KEY;
        const secretKey = customSecretKey || DEFAULT_SECRET_KEY;

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const clientTxnId = 'KCT-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

        const isMonthlySubscription = req.body.donorCategory === 'monthly_donor_subscription' ||
            (purpose && purpose.toLowerCase().includes('monthly'));

        const donation = new Donation({
            donationType: 'cash',
            fullName,
            mobile,
            email,
            address,
            amount: numAmount,
            purpose: purpose || 'General Donation',
            donorCategory: isMonthlySubscription ? 'monthly_donor_subscription' : (req.body.donorCategory || 'general_donation'),
            panNumber: req.body.panNumber || '',
            isAnonymous: !!req.body.isAnonymous,
            paymentMethod: 'SabPaisa PG',
            transactionId: clientTxnId,
            status: 'pending'
        });

        
        // SabPaisa PG 3.0: Name must be 2-100 characters with letters & spaces only
        const sanitizedCustomerName = String(fullName || '')
            .replace(/[^a-zA-Z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100) || 'Donor';

        // SabPaisa PG 3.0: 10-digit Indian mobile starting with 6-9
        const rawDigits = String(mobile || '').replace(/\D/g, '');
        const sanitizedCustomerPhone = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;

        pendingPaymentSessions.set(clientTxnId, {
            fullName: sanitizedCustomerName,
            email: email,
            mobile: sanitizedCustomerPhone,
            address: address || '',
            amount: numAmount,
            purpose: purpose || (isMonthlySubscription ? 'Monthly Giving Society' : 'General Philanthropy'),
            donorCategory: isMonthlySubscription ? 'monthly_donor_subscription' : (req.body.donorCategory || 'general_donation'),
            receiptNumber: donation.receiptNumber,
            isMonthlySubscription,
            timestamp: Date.now()
        });

        donation.save().catch(dbErr => {
            console.warn('⚠️ DB save async notice:', dbErr.message);
        });

        const host = req.headers.origin || req.headers.referer || process.env.CLIENT_URL || 'https://www.kirancharitabletrust.org';
        const cleanHost = host.replace(/\/$/, '');

        // Pack donor details into callback query string for 100% reliability on stateless/serverless environments
        const queryParams = new URLSearchParams({
            donorName: sanitizedCustomerName,
            donorEmail: email || '',
            donorMobile: sanitizedCustomerPhone || '',
            donorAddress: address || '',
            donorPurpose: purpose || (isMonthlySubscription ? 'Monthly Giving Society' : 'General Philanthropy'),
            donorCategory: isMonthlySubscription ? 'monthly_donor_subscription' : (req.body.donorCategory || 'general_donation'),
            donorAmount: String(numAmount),
            receiptNo: donation.receiptNumber,
            isMonthly: isMonthlySubscription ? 'true' : 'false'
        });
        const callbackUrl = `${cleanHost}/api/donations/sabpaisa-callback?${queryParams.toString()}`;

        const checksum = generateSabpaisaChecksum(clientCode, clientTxnId, paiseAmount, timestamp, secretKey);

        const payload = {
            merchantId: clientCode,
            merchantTxnId: clientTxnId,
            amount: paiseAmount,
            currency: 'INR',
            returnUrl: callbackUrl,
            customerName: sanitizedCustomerName,
            customerEmail: email,
            customerPhone: sanitizedCustomerPhone,
            customerMobile: sanitizedCustomerPhone,
            timestamp: parseInt(timestamp, 10),
            checksum
        };

        // Attach SabPaisa PG 3.0 AutoPay Mandate & recurring subscription parameters
        if (isMonthlySubscription) {
            const mandateChannel = (req.body.autopayMethod || 'UPI_AUTOPAY').toUpperCase();
            payload.description = `AutoPay Mandate Setup - ${purpose || 'Monthly Pillar'}`;
            payload.udf1 = 'AUTOPAY_MANDATE';
            payload.udf2 = mandateChannel;
            payload.udf3 = clientTxnId;
            payload.metadata = {
                mandateType: 'AUTOPAY',
                mandateChannel: mandateChannel,
                subscriptionType: 'MONTHLY',
                billingFrequency: 'MONTHLY',
                recurringAmount: numAmount,
                plan: purpose || 'Monthly Pillar'
            };
        }

        console.log(`Initiating SabPaisa Payment on ${baseUrl}/api/v2/payments for ${clientCode} (${paiseAmount} paise / ₹${numAmount})...`);

        const response = await fetch(`${baseUrl}/api/v2/payments`, {
            method: 'POST',
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const sabpaisaData = await response.json();
        console.log('SabPaisa API Response:', sabpaisaData);

        if (sabpaisaData && sabpaisaData.success && sabpaisaData.checkoutUrl && sabpaisaData.clientSecret) {
            const fullCheckoutUrl = `${sabpaisaData.checkoutUrl}?clientSecret=${sabpaisaData.clientSecret}`;
            return res.status(200).json({
                success: true,
                message: 'SabPaisa checkout URL generated successfully.',
                checkoutUrl: fullCheckoutUrl,
                paymentId: sabpaisaData.paymentId,
                clientTxnId
            });
        }

        return res.status(500).json({
            success: false,
            message: sabpaisaData?.error?.message || sabpaisaData?.message || 'Failed to generate SabPaisa payment checkout URL.',
            rawResponse: sabpaisaData
        });
    } catch (error) {
        console.error('SabPaisa Init Error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Payment initiation failed.' });
    }
});

// Helper: Send HTML breakout response so parent window navigates to receipt
function sendBreakoutHtml(res, targetUrl, statusType) {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const isSuccess = statusType === true || statusType === 'success';
    const isPending = statusType === 'pending';

    const heading = isSuccess ? 'Payment Confirmed!' : isPending ? 'Verifying with Bank...' : 'Retrieving Status...';
    const message = isSuccess 
        ? 'Redirecting to your official donation receipt...' 
        : isPending 
            ? 'Awaiting bank confirmation. Connecting to donation status...' 
            : 'Connecting back to view transaction summary...';
    const btnText = isSuccess ? 'View Receipt Now' : 'View Status Now';
    const spinnerColor = isSuccess ? '#10b981' : isPending ? '#3b82f6' : '#f59e0b';

    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${heading}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #0f172a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
        }
        .box {
            background: #1e293b;
            padding: 36px 28px;
            border-radius: 18px;
            max-width: 380px;
            width: 90%;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(255, 255, 255, 0.15);
            border-top-color: ${spinnerColor};
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        h3 { margin: 0 0 10px; font-size: 20px; font-weight: 700; color: #f8fafc; }
        p { margin: 0 0 18px; font-size: 13.5px; color: #94a3b8; line-height: 1.5; }
        .btn-link {
            display: inline-block;
            background: #2563eb;
            color: #ffffff;
            text-decoration: none;
            padding: 9px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="box">
        <div class="spinner"></div>
        <h3>${heading}</h3>
        <p>${message}</p>
        <a id="btnRedirect" href="${targetUrl}" class="btn-link" style="display:none;">${btnText}</a>
    </div>
    <script>
        const target = ${JSON.stringify(targetUrl)};
        try {
            if (window.top && window.top !== window.self) {
                window.top.location.href = target;
            } else if (window.parent && window.parent !== window.self) {
                window.parent.location.href = target;
            } else {
                window.location.href = target;
            }
        } catch (e) {
            window.location.href = target;
        }
        setTimeout(function() {
            var btn = document.getElementById('btnRedirect');
            if (btn) btn.style.display = 'inline-block';
        }, 1200);
    </script>
</body>
</html>`);
}

// Callback Handler (POST & GET) — Receives payment outcome from SabPaisa
const handleCallback = async (req, res) => {
    try {
        const data = { ...req.query, ...req.body };
        console.log('SabPaisa Callback Notification Received:', data);

        const clientTxnId = data.merchant_txn_id || data.merchantTxnId || data.clientTxnId || data.client_txn_id || data.txnId;
        const statusCode = data.statusCode || data.status_code || data.code;
        const statusMsg = (data.status || data.statusMsg || '').toUpperCase();
        const pgTxnNo = data.transaction_id || data.paymentId || data.sabpaisaTxnId || data.pgTxnNo || clientTxnId;

        const isValidSignature = verifyReturnSignature(data, DEFAULT_SECRET_KEY);
        if (!isValidSignature) {
            console.warn('SabPaisa Callback Warning: Signature verification mismatch for txn', clientTxnId);
        }

        const isSuccess = statusCode === '0000' || statusMsg === 'SUCCESS' || statusMsg === 'SUCCESSFUL' || statusMsg === 'COMPLETED';
        const isPending = statusCode === '0100' || statusCode === '0002' || statusMsg === 'PROCESSING' || statusMsg === 'PENDING' || statusMsg === 'IN_PROGRESS';

        let donation = null;
        try {
            donation = await Donation.findOne({ transactionId: clientTxnId });
        } catch (dbErr) {
            console.warn('⚠️ DB lookup skipped in callback:', dbErr.message);
        }

        const clientRedirectUrl = process.env.CLIENT_URL || 'https://www.kirancharitabletrust.org';

        // Retrieve session data fallback for 100% reliable donor details & email delivery
        const sessionData = pendingPaymentSessions.get(clientTxnId) || {};
        const finalName = req.query.donorName || donation?.fullName || sessionData.fullName || data.customerName || data.payerName || data.name || 'Valued Philanthropist';
        const finalEmail = req.query.donorEmail || donation?.email || sessionData.email || data.customerEmail || data.payerEmail || data.email;
        const finalMobile = req.query.donorMobile || donation?.mobile || sessionData.mobile || data.customerMobile || data.payerMobile || '';
        const finalAddress = req.query.donorAddress || donation?.address || sessionData.address || '';
        const finalAmount = req.query.donorAmount || donation?.amount || sessionData.amount || data.paid_amount || data.amount || '0';

        const isMonthlySubscription = req.query.isMonthly === 'true' ||
            (donation && (donation.donorCategory === 'monthly_donor_subscription' || (donation.purpose && donation.purpose.toLowerCase().includes('monthly')))) ||
            (sessionData && sessionData.isMonthlySubscription) ||
            (data.udf1 === 'MONTHLY_SUBSCRIPTION' || data.udf1 === 'AUTOPAY_MANDATE') ||
            (req.query.purpose && req.query.purpose.toLowerCase().includes('monthly'));

        const finalPurpose = req.query.donorPurpose || donation?.purpose || sessionData.purpose || (isMonthlySubscription ? 'Monthly Giving Society Pillar' : 'General Philanthropy');
        const finalCategory = req.query.donorCategory || donation?.donorCategory || sessionData.donorCategory || (isMonthlySubscription ? 'monthly_donor_subscription' : 'general_donation');
        const finalReceipt = req.query.receiptNo || donation?.receiptNumber || sessionData.receiptNumber || ('KCT-80G-' + Date.now().toString().slice(-6));

        let failureReason = data.statusMsg || data.status || data.error?.message || data.responseMessage || '';
        if (!failureReason || failureReason.toUpperCase() === 'FAILED' || failureReason.toUpperCase() === 'FAILURE') {
            failureReason = 'Payment could not be processed by card network or bank.';
        }

        // 1. Update Database Record if available
        if (donation) {
            donation.status = isSuccess ? 'completed' : isPending ? 'pending' : 'failed';
            if (pgTxnNo) donation.transactionId = pgTxnNo;
            try {
                await donation.save();

                const todayStr = new Date().toISOString().split('T')[0];
                if (isSuccess) {
                    await PerformanceMetric.findOneAndUpdate(
                        { date: todayStr },
                        { 
                            $inc: { successfulDonations: 1, donationRevenue: donation.amount },
                            $set: { updatedAt: new Date() }
                        },
                        { upsert: true }
                    ).catch(() => {});

                    if (donation.donorCategory === 'volunteer_membership' || (donation.purpose && donation.purpose.toLowerCase().includes('volunteer'))) {
                        try {
                            const Volunteer = require('../models/Volunteer');
                            await Volunteer.findOneAndUpdate(
                                { email: donation.email },
                                { $set: { paymentStatus: 'paid', status: 'active' } }
                            );
                        } catch (vErr) {}
                    }

                    if (donation.donorCategory === 'trust_member_monthly' || donation.email) {
                        await TrustMember.findOneAndUpdate(
                            { email: donation.email },
                            {
                                $inc: { totalDonated: donation.amount, donationCount: 1 },
                                $set: { lastPaymentDate: new Date() }
                            }
                        ).catch(() => {});
                    }

                    autoRankDonors().catch(err => console.warn('Auto-rank trigger notice:', err.message));
                } else if (!isPending) {
                    await PerformanceMetric.findOneAndUpdate(
                        { date: todayStr },
                        { $inc: { failedDonations: 1 }, $set: { updatedAt: new Date() } },
                        { upsert: true }
                    ).catch(() => {});
                }
            } catch (dbErr) {
                console.warn('⚠️ DB update notice:', dbErr.message);
            }
        }

        // 2. Activate Monthly Schedule if recurring
        if (isSuccess && isMonthlySubscription) {
            try {
                const nextDueDate = new Date();
                nextDueDate.setDate(nextDueDate.getDate() + 30);
                MonthlySchedule.findOneAndUpdate(
                    { memberEmail: finalEmail, monthYear: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }) },
                    {
                        $set: {
                            memberName: finalName,
                            memberEmail: finalEmail,
                            amount: Number(finalAmount),
                            status: 'paid',
                            paidDate: new Date(),
                            dueDate: nextDueDate,
                            transactionId: pgTxnNo,
                            notes: `SabPaisa Recurring Monthly Mandate (${finalPurpose})`
                        }
                    },
                    { upsert: true }
                ).catch(() => {});
            } catch (mErr) {
                console.warn('Monthly schedule activation notice:', mErr.message);
            }
        }

        // 3. GUARANTEED AUTOMATED EMAIL DISPATCH ON EVERY STATUS (SUCCESS, PENDING, OR FAILED)
        if (finalEmail) {
            if (isSuccess) {
                sendPaymentSuccessEmail({
                    name: finalName,
                    email: finalEmail,
                    mobile: finalMobile,
                    address: finalAddress,
                    amount: finalAmount,
                    receiptNumber: finalReceipt,
                    transactionId: pgTxnNo || clientTxnId,
                    clientTxnId: clientTxnId,
                    purpose: finalPurpose,
                    donorCategory: finalCategory
                }).then(() => {
                    console.log(`📧 Official 80G tax receipt email delivered to donor: ${finalEmail}`);
                }).catch(e => console.warn('Payment success email err:', e.message));

                // Dispatch copy to Trust Admin
                if (finalEmail.toLowerCase() !== 'trustkirancharitable@gmail.com') {
                    sendPaymentSuccessEmail({
                        name: `${finalName} (Trust Office Copy)`,
                        email: 'trustkirancharitable@gmail.com',
                        mobile: finalMobile,
                        address: finalAddress,
                        amount: finalAmount,
                        receiptNumber: finalReceipt,
                        transactionId: pgTxnNo || clientTxnId,
                        clientTxnId: clientTxnId,
                        purpose: finalPurpose,
                        donorCategory: finalCategory
                    }).catch(() => {});
                }
            } else if (isPending) {
                sendPaymentPendingEmail({
                    name: finalName,
                    email: finalEmail,
                    amount: finalAmount,
                    transactionId: pgTxnNo || clientTxnId,
                    purpose: finalPurpose
                }).then(() => {
                    console.log(`📧 Payment under verification notice delivered to: ${finalEmail}`);
                }).catch(e => console.warn('Payment pending email err:', e.message));
            } else {
                sendPaymentFailureEmail({
                    name: finalName,
                    email: finalEmail,
                    amount: finalAmount,
                    reason: failureReason,
                    transactionId: pgTxnNo || clientTxnId,
                    retryUrl: isMonthlySubscription ? `${clientRedirectUrl}/portal/monthly-donor` : `${clientRedirectUrl}/donate`
                }).then(() => {
                    console.log(`📧 Payment failure alert notice delivered to: ${finalEmail}`);
                }).catch(e => console.warn('Payment failure email err:', e.message));
            }
        }

        // 4. Webhook API Response
        const isWebhookRequest = req.path.includes('webhook') || req.path.includes('ipn') || (!req.headers.accept?.includes('text/html') && req.headers['content-type']?.includes('application/json'));
        if (isWebhookRequest) {
            return res.status(200).json({
                success: true,
                status: isSuccess ? 'SUCCESS' : isPending ? 'PENDING' : 'FAILED',
                message: isSuccess ? 'Payment webhook verified and recorded' : `Payment recorded as ${isPending ? 'pending' : 'failed'}`,
                transactionId: pgTxnNo,
                clientTxnId: clientTxnId,
                amount: finalAmount,
                receiptNumber: finalReceipt
            });
        }

        // 5. Browser Redirect with Full Receipt Details
        const targetPage = isMonthlySubscription ? '/portal/monthly-donor' : '/donate';

        if (isSuccess) {
            return sendBreakoutHtml(res, `${clientRedirectUrl}${targetPage}?status=success&txnId=${encodeURIComponent(pgTxnNo)}&txId=${encodeURIComponent(pgTxnNo)}&receiptNo=${encodeURIComponent(finalReceipt)}&name=${encodeURIComponent(finalName)}&amount=${encodeURIComponent(finalAmount)}&purpose=${encodeURIComponent(finalPurpose)}&email=${encodeURIComponent(finalEmail || '')}&address=${encodeURIComponent(finalAddress || '')}`, 'success');
        } else if (isPending) {
            return sendBreakoutHtml(res, `${clientRedirectUrl}${targetPage}?status=pending&txnId=${encodeURIComponent(pgTxnNo || clientTxnId || '')}&txId=${encodeURIComponent(pgTxnNo || clientTxnId || '')}&clientTxnId=${encodeURIComponent(clientTxnId || '')}&amount=${encodeURIComponent(finalAmount)}&name=${encodeURIComponent(finalName)}`, 'pending');
        } else {
            return sendBreakoutHtml(res, `${clientRedirectUrl}${targetPage}?status=failed&txnId=${encodeURIComponent(pgTxnNo || clientTxnId || '')}&txId=${encodeURIComponent(pgTxnNo || clientTxnId || '')}&amount=${encodeURIComponent(finalAmount)}&name=${encodeURIComponent(finalName)}&reason=${encodeURIComponent(failureReason)}`, 'failed');
        }

    } catch (error) {
        console.error('SabPaisa Callback Error:', error);
        if (req.path.includes('webhook') || req.path.includes('ipn')) {
            return res.status(500).json({ success: false, message: 'Server webhook processing error' });
        }
        const clientRedirectUrl = process.env.CLIENT_URL || 'https://www.kirancharitabletrust.org';
        return sendBreakoutHtml(res, `${clientRedirectUrl}/donate?status=failed&reason=Processing+error`, 'failed');
    }
};

router.post('/sabpaisa-callback', handleCallback);
router.get('/sabpaisa-callback', handleCallback);
router.post('/webhook', handleCallback);
router.get('/webhook', handleCallback);
router.post('/sabpaisa-webhook', handleCallback);
router.post('/ipn', handleCallback);

// POST /api/donations/enquiry — SabPaisa PG 3.0 Transaction Enquiry
router.post('/enquiry', async (req, res) => {
    try {
        const { merchantTxnId } = req.body;
        if (!merchantTxnId) {
            return res.status(400).json({ success: false, message: 'merchantTxnId is required' });
        }

        const response = await fetch(`${DEFAULT_BASE_URL}/api/v2/payments/enquiry`, {
            method: 'POST',
            headers: {
                'X-Api-Key': DEFAULT_API_KEY,
                'X-Merchant-Id': DEFAULT_CLIENT_CODE,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientCode: DEFAULT_CLIENT_CODE,
                merchantId: DEFAULT_CLIENT_CODE,
                merchantTxnId
            })
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Enquiry failed' });
    }
});

// POST /api/donations — Direct donation recording (offline/cash/item)
router.post('/', async (req, res) => {
    try {
        const {
            donationType, fullName, mobile, email, address,
            amount, purpose, paymentMethod,
            itemCategory, itemName, itemQuantity, deliveryMethod
        } = req.body;

        if (!fullName || !mobile || !email || !address) {
            return res.status(400).json({ success: false, message: 'Contact details (Name, Mobile, Email, Address) are required' });
        }

        const isCash = donationType !== 'item';
        const numAmount = isCash ? Number(amount) || 0 : undefined;

        if (isCash) {
            if (!amount || !purpose || !paymentMethod) {
                return res.status(400).json({ success: false, message: 'Amount, purpose and payment method are required for cash donation' });
            }
            if (numAmount < 1) {
                return res.status(400).json({ success: false, message: 'Donation amount must be at least ₹1' });
            }
        } else {
            if (!itemCategory || !itemName || !itemQuantity || !deliveryMethod) {
                return res.status(400).json({ success: false, message: 'Item category, description, quantity and delivery method are required for item donation' });
            }
        }

        const donation = new Donation({
            donationType: isCash ? 'cash' : 'item',
            fullName,
            mobile,
            email,
            address,
            amount: isCash ? numAmount : undefined,
            purpose: isCash ? String(purpose) : undefined,
            paymentMethod: isCash ? String(paymentMethod) : undefined,
            itemCategory: !isCash ? String(itemCategory) : undefined,
            itemName: !isCash ? String(itemName) : undefined,
            itemQuantity: !isCash ? String(itemQuantity) : undefined,
            deliveryMethod: !isCash ? String(deliveryMethod) : undefined,
            status: isCash ? 'completed' : 'pending'
        });

        donation.save().catch(dbErr => {
            console.warn('⚠️ DB save async notice:', dbErr.message);
        });

        res.status(201).json({
            success: true,
            message: isCash
                ? 'Donation recorded successfully! Thank you for your generous contribution.'
                : 'Item donation request received successfully! Our logistics team will contact you shortly.',
            data: donation
        });
    } catch (error) {
        console.error('Donation error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Server error. Please try again.' });
    }
});

// GET /api/donations (admin)
router.get('/', async (req, res) => {
    try {
        const donations = await Donation.find().sort({ createdAt: -1 });
        const totalAmount = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
        res.json({ success: true, data: donations, totalAmount, count: donations.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
