/**
 * Card Validation & Identification Engine
 * Handles Luhn check, Brand detection, Expiry, CVV, BIN lookup, and Card Type (Debit/Credit).
 * Fully compliant with PCI-DSS: Does NOT persist or log raw card numbers.
 */

// Known Bank Identification Number (BIN) mapping for Indian Banks & Global Networks
const BANK_BINS = [
    { prefix: ['4052', '4143', '4585', '4628', '5241', '5520', '6521'], bank: 'HDFC Bank', defaultType: 'debit' },
    { prefix: ['4591', '4055', '4214', '6070', '6522'], bank: 'State Bank of India (SBI)', defaultType: 'debit' },
    { prefix: ['4060', '4166', '4315', '5120', '5243'], bank: 'ICICI Bank', defaultType: 'debit' },
    { prefix: ['4160', '4220', '5128', '6074'], bank: 'Axis Bank', defaultType: 'debit' },
    { prefix: ['4001', '4386', '5044', '6071', '6523'], bank: 'Canara Bank', defaultType: 'debit' },
    { prefix: ['4033', '4600', '5046', '6072'], bank: 'Punjab National Bank (PNB)', defaultType: 'debit' },
    { prefix: ['4282', '5245', '6073'], bank: 'Kotak Mahindra Bank', defaultType: 'debit' },
    { prefix: ['4123', '4587', '5129', '6075'], bank: 'Bank of Baroda', defaultType: 'debit' }
];

/**
 * Validate card number using Luhn Algorithm (Mod 10 Checksum)
 * @param {string} cardNumber 
 * @returns {boolean}
 */
function validateLuhn(cardNumber) {
    if (!cardNumber) return false;
    const sanitized = String(cardNumber).replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(sanitized)) return false;

    let sum = 0;
    let shouldDouble = false;

    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
}

/**
 * Detect card network/brand based on IIN (Issuer Identification Number) ranges
 * Special coverage for RuPay (India National Payment Corporation), Visa, MasterCard, Amex, Maestro, Diners, Discover
 * @param {string} cardNumber 
 * @returns {string} 'rupay' | 'visa' | 'mastercard' | 'amex' | 'maestro' | 'diners' | 'discover' | 'unknown'
 */
function detectCardBrand(cardNumber) {
    if (!cardNumber) return 'unknown';
    const clean = String(cardNumber).replace(/[\s-]/g, '');

    // RuPay: 508, 60, 65, 81, 82, 353, 356
    // Specific ranges: 6061-6085, 6521-6531, 5085-5089, 8172-8179
    if (/^(508[5-9]|606[1-9]|607[0-9]|608[0-5]|652[1-9]|653[0-1]|817[2-9]|353|356)/.test(clean)) {
        return 'rupay';
    }

    // Visa: Starts with 4
    if (/^4\d{12}(\d{3})?(\d{3})?$/.test(clean) || /^4/.test(clean)) {
        return 'visa';
    }

    // MasterCard: 51-55, 2221-2720
    if (/^(5[1-5]\d{4}|222[1-9]\d{2}|22[3-9]\d{3}|2[3-6]\d{4}|27[01]\d{3}|2720\d{2})/.test(clean)) {
        return 'mastercard';
    }

    // American Express: 34 or 37 (15 digits)
    if (/^3[47]\d{2}/.test(clean)) {
        return 'amex';
    }

    // Maestro: 5018, 5020, 5038, 5893, 6304, 6759, 6761, 6762, 6763
    if (/^(5018|5020|5038|5893|6304|6759|676[1-3])/.test(clean)) {
        return 'maestro';
    }

    // Diners Club: 300-305, 36, 38
    if (/^(30[0-5]|36|38)/.test(clean)) {
        return 'diners';
    }

    // Discover: 6011, 622126-622925, 644-649, 65
    if (/^(6011|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5])|64[4-9]|65)/.test(clean)) {
        return 'discover';
    }

    return 'unknown';
}

/**
 * Validate Card Expiry (Month & Year)
 * @param {number|string} month 1-12
 * @param {number|string} year 2-digit or 4-digit year
 * @returns {{ isValid: boolean, message?: string }}
 */
function validateExpiry(month, year) {
    const m = parseInt(month, 10);
    let y = parseInt(year, 10);

    if (isNaN(m) || m < 1 || m > 12) {
        return { isValid: false, message: 'Invalid expiry month. Must be between 01 and 12.' };
    }

    if (isNaN(y)) {
        return { isValid: false, message: 'Invalid expiry year.' };
    }

    // Support 2-digit year (e.g. 26 -> 2026)
    if (y < 100) {
        y += 2000;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    if (y < currentYear || (y === currentYear && m < currentMonth)) {
        return { isValid: false, message: 'Card has expired. Please enter an active card.' };
    }

    // Card should not have expiry greater than 20 years into the future
    if (y > currentYear + 20) {
        return { isValid: false, message: 'Invalid expiry year. Year is too far in the future.' };
    }

    return { isValid: true, normalizedMonth: String(m).padStart(2, '0'), normalizedYear: String(y) };
}

/**
 * Validate Card CVV / CVC
 * 4 digits for American Express; 3 digits for Visa, MasterCard, RuPay, Maestro, etc.
 * @param {string} cvv 
 * @param {string} brand 
 * @returns {boolean}
 */
function validateCvv(cvv, brand = 'unknown') {
    if (!cvv) return false;
    const clean = String(cvv).trim();
    if (!/^\d+$/.test(clean)) return false;

    if (brand.toLowerCase() === 'amex') {
        return clean.length === 4;
    }

    return clean.length === 3;
}

/**
 * Identify Card Type (Debit vs Credit) based on BIN patterns
 * @param {string} cardNumber 
 * @returns {'debit' | 'credit'}
 */
function identifyCardType(cardNumber) {
    if (!cardNumber) return 'debit';
    const clean = String(cardNumber).replace(/[\s-]/g, '');

    // Amex is predominantly Credit Card
    if (/^3[47]/.test(clean)) return 'credit';

    // Check specific known bank BIN lists
    for (const item of BANK_BINS) {
        for (const prefix of item.prefix) {
            if (clean.startsWith(prefix)) {
                return item.defaultType || 'debit';
            }
        }
    }

    // Indian RuPay cards are heavily Debit-oriented unless specific platinum credit BIN
    if (detectCardBrand(clean) === 'rupay') {
        if (clean.startsWith('6521') || clean.startsWith('6522')) return 'debit';
    }

    return 'debit'; // Default safe assumption for donations
}

/**
 * Lookup Issuing Bank from BIN
 * @param {string} cardNumber 
 * @returns {string} Bank name or 'Standard Commercial Bank'
 */
function lookupBank(cardNumber) {
    if (!cardNumber) return 'Standard Commercial Bank';
    const clean = String(cardNumber).replace(/[\s-]/g, '');

    for (const item of BANK_BINS) {
        for (const prefix of item.prefix) {
            if (clean.startsWith(prefix)) {
                return item.bank;
            }
        }
    }

    return 'Indian / International Bank';
}

/**
 * Mask card number for display and receipt generation (PCI-DSS compliant)
 * @param {string} cardNumber 
 * @returns {string} e.g. "•••• •••• •••• 1234"
 */
function maskCardNumber(cardNumber) {
    if (!cardNumber) return '';
    const clean = String(cardNumber).replace(/[\s-]/g, '');
    if (clean.length < 4) return '••••';
    const last4 = clean.slice(-4);
    return `•••• •••• •••• ${last4}`;
}

/**
 * Full Comprehensive Card Verification
 * @param {Object} card 
 * @param {string} card.cardNumber 
 * @param {string|number} card.expiryMonth 
 * @param {string|number} card.expiryYear 
 * @param {string} card.cvv 
 * @param {string} [card.cardHolderName] 
 * @returns {Object} validation result
 */
function validateCard({ cardNumber, expiryMonth, expiryYear, cvv, cardHolderName }) {
    const errors = [];
    const brand = detectCardBrand(cardNumber);
    const cardType = identifyCardType(cardNumber);
    const bank = lookupBank(cardNumber);

    if (!cardNumber) {
        errors.push('Card number is required.');
    } else if (!validateLuhn(cardNumber)) {
        errors.push('Invalid card number. Failed checksum verification.');
    }

    const expiryCheck = validateExpiry(expiryMonth, expiryYear);
    if (!expiryCheck.isValid) {
        errors.push(expiryCheck.message || 'Invalid expiry date.');
    }

    if (!cvv) {
        errors.push('CVV/CVC is required.');
    } else if (!validateCvv(cvv, brand)) {
        errors.push(brand === 'amex' ? 'American Express CVV must be 4 digits.' : 'CVV must be 3 digits.');
    }

    if (cardHolderName !== undefined && cardHolderName !== null) {
        if (String(cardHolderName).trim().length < 2) {
            errors.push('Cardholder name is required (minimum 2 characters).');
        }
    }

    const clean = String(cardNumber || '').replace(/[\s-]/g, '');
    const last4 = clean.length >= 4 ? clean.slice(-4) : '';

    return {
        isValid: errors.length === 0,
        errors,
        brand,
        cardType,
        bank,
        last4,
        maskedNumber: maskCardNumber(cardNumber),
        expiryFormatted: expiryCheck.isValid ? `${expiryCheck.normalizedMonth}/${expiryCheck.normalizedYear.slice(-2)}` : null
    };
}

module.exports = {
    validateLuhn,
    detectCardBrand,
    validateExpiry,
    validateCvv,
    identifyCardType,
    lookupBank,
    maskCardNumber,
    validateCard
};
