const express = require('express');
const router = express.Router();
const {
    autoPayService,
    debitCardService,
    creditCardService,
    cardValidation,
    getSupportedPaymentMethods
} = require('../services/payments/paymentOrchestrator');

// GET /api/payments/methods â€” Return available payment modes and specifications
router.get('/methods', (req, res) => {
    return res.json(getSupportedPaymentMethods());
});

// POST /api/payments/cards/validate â€” Validates card without charging
router.post('/cards/validate', (req, res) => {
    try {
        const { cardNumber, expiryMonth, expiryYear, cvv, cardHolderName } = req.body;
        const result = cardValidation.validateCard({
            cardNumber,
            expiryMonth,
            expiryYear,
            cvv,
            cardHolderName
        });
        return res.json({ success: true, ...result });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/payments/debit/initiate â€” Initiate Debit Card payment session
router.post('/debit/initiate', async (req, res) => {
    try {
        const { donorDetails, cardDetails, amount, purpose, returnUrl, memberId, userId } = req.body;
        const result = await debitCardService.initiateDebitCardPayment({
            donorDetails,
            cardDetails,
            amount,
            purpose,
            returnUrl,
            memberId,
            userId
        });
        return res.status(200).json(result);
    } catch (err) {
        console.error('Debit Card Initiate Error:', err);
        return res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/payments/credit/initiate â€” Initiate Credit Card payment session
router.post('/credit/initiate', async (req, res) => {
    try {
        const { donorDetails, cardDetails, amount, saveCard, purpose, returnUrl, memberId, userId } = req.body;
        const result = await creditCardService.initiateCreditCardPayment({
            donorDetails,
            cardDetails,
            amount,
            saveCard,
            purpose,
            returnUrl,
            memberId,
            userId
        });
        return res.status(200).json(result);
    } catch (err) {
        console.error('Credit Card Initiate Error:', err);
        return res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/payments/credit/tokenize â€” Request RBI Card-on-File Tokenization
router.post('/credit/tokenize', (req, res) => {
    try {
        const { cardDetails, customerEmail } = req.body;
        if (!customerEmail) {
            return res.status(400).json({ success: false, message: 'Customer email is required for card tokenization.' });
        }
        const result = creditCardService.tokenizeCard(cardDetails, customerEmail);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/payments/autopay/create-mandate â€” Create recurring UPI / eNACH mandate
router.post('/autopay/create-mandate', async (req, res) => {
    try {
        const {
            mandateType = 'upi_autopay',
            donorName,
            donorEmail,
            donorMobile,
            amount,
            maxAmount,
            vpa,
            frequency,
            purpose,
            bankDetails,
            authMode,
            returnUrl,
            memberId,
            userId
        } = req.body;

        if (mandateType === 'upi_autopay') {
            const result = await autoPayService.createUpiAutoPayMandate({
                donorName,
                donorEmail,
                donorMobile,
                amount,
                maxAmount,
                vpa,
                frequency,
                purpose,
                returnUrl,
                memberId,
                userId
            });
            return res.status(200).json(result);
        } else {
            const result = await autoPayService.createEnachMandate({
                donorName,
                donorEmail,
                donorMobile,
                amount,
                frequency,
                bankDetails,
                authMode,
                purpose,
                memberId,
                userId
            });
            return res.status(200).json(result);
        }
    } catch (err) {
        console.error('AutoPay Create Mandate Error:', err);
        return res.status(400).json({ success: false, message: err.message });
    }
});

// GET /api/payments/autopay/mandate/:mandateId â€” Check mandate details & status
router.get('/autopay/mandate/:mandateId', async (req, res) => {
    try {
        const details = await autoPayService.getMandateDetails(req.params.mandateId);
        return res.json({ success: true, mandate: details });
    } catch (err) {
        return res.status(404).json({ success: false, message: err.message });
    }
});

// POST /api/payments/autopay/cancel-mandate â€” Cancel / Revoke mandate
router.post('/autopay/cancel-mandate', async (req, res) => {
    try {
        const { mandateId, reason } = req.body;
        if (!mandateId) {
            return res.status(400).json({ success: false, message: 'Mandate ID is required.' });
        }
        const result = await autoPayService.cancelMandate(mandateId, reason);
        return res.json(result);
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/payments/autopay/notify-pre-debit â€” Dispatch 24h RBI notification
router.post('/autopay/notify-pre-debit', async (req, res) => {
    try {
        const { mandateId } = req.body;
        const result = await autoPayService.sendPreDebitNotification(mandateId);
        return res.json(result);
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/payments/autopay/execute-debit â€” Trigger recurring debit
router.post('/autopay/execute-debit', async (req, res) => {
    try {
        const { mandateId, amount } = req.body;
        const result = await autoPayService.executeRecurringDebit(mandateId, amount);
        return res.json(result);
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;
