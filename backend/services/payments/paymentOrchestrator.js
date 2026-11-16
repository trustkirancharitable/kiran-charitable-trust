/**
 * Central Payment Orchestrator
 * Unifies AutoPay (UPI / eNACH / Card SI), Debit Card, and Credit Card integrations.
 */

const autoPayService = require('./autoPayService');
const debitCardService = require('./debitCardService');
const creditCardService = require('./creditCardService');
const cardValidation = require('./cardValidation');

/**
 * Route payment initiation to the appropriate payment processor
 * @param {Object} request
 * @param {'autopay' | 'debit_card' | 'credit_card'} request.mode
 * @param {Object} request.data
 * @returns {Promise<Object>}
 */
async function routePaymentInitiation({ mode, data }) {
    switch (String(mode).toLowerCase()) {
        case 'autopay':
        case 'upi_autopay':
            return await autoPayService.createUpiAutoPayMandate(data);

        case 'enach':
        case 'enach_netbanking':
        case 'enach_debit_card':
            return await autoPayService.createEnachMandate(data);

        case 'debit_card':
        case 'debit':
            return await debitCardService.initiateDebitCardPayment(data);

        case 'credit_card':
        case 'credit':
        case 'cc':
            return await creditCardService.initiateCreditCardPayment(data);

        default:
            throw new Error(`Unsupported payment mode: "${mode}". Valid modes: autopay, debit_card, credit_card.`);
    }
}

/**
 * Get available payment methods and system capabilities
 */
function getSupportedPaymentMethods() {
    return {
        success: true,
        methods: [
            {
                id: 'autopay',
                name: 'AutoPay Recurring Mandate',
                types: ['UPI AutoPay', 'e-NACH NetBanking', 'e-NACH Debit Card', 'Card Standing Instruction'],
                frequencies: ['MONTHLY', 'QUARTERLY', 'YEARLY'],
                rbiCompliant: true,
                maxLimitWithoutAfa: 15000,
                icon: 'FaSyncAlt'
            },
            {
                id: 'debit_card',
                name: 'Debit Card Direct Payment',
                supportedNetworks: ['RuPay', 'Visa', 'MasterCard', 'Maestro'],
                rupayZeroMdr: true,
                twoFactorAuth: '3D Secure 2.0 / OTP',
                icon: 'FaIdCard'
            },
            {
                id: 'credit_card',
                name: 'Credit Card (Domestic & International)',
                supportedNetworks: ['Visa', 'MasterCard', 'American Express', 'Diners Club'],
                tokenization: 'RBI Card-on-File (CoF) compliant',
                twoFactorAuth: '3DS 2.0 Dynamic Challenge Flow',
                icon: 'FaCreditCard'
            }
        ]
    };
}

module.exports = {
    autoPayService,
    debitCardService,
    creditCardService,
    cardValidation,
    routePaymentInitiation,
    getSupportedPaymentMethods
};
