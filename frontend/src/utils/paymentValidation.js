/**
 * Frontend Payment Validation & Formatting Helpers
 */

export function formatCardNumber(value) {
    if (!value) return '';
    const clean = value.replace(/\D/g, '').slice(0, 19);
    // Format in blocks of 4
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value) {
    if (!value) return '';
    const clean = value.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
        return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    return clean;
}

export function detectCardBrand(number) {
    if (!number) return 'unknown';
    const clean = number.replace(/\D/g, '');

    if (/^(508[5-9]|606[1-9]|607[0-9]|608[0-5]|652[1-9]|653[0-1]|817[2-9]|353|356)/.test(clean)) {
        return 'rupay';
    }
    if (/^4/.test(clean)) {
        return 'visa';
    }
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) {
        return 'mastercard';
    }
    if (/^3[47]/.test(clean)) {
        return 'amex';
    }
    if (/^(5018|5020|5038|5893|6304|6759|676[1-3])/.test(clean)) {
        return 'maestro';
    }
    if (/^(30[0-5]|36|38)/.test(clean)) {
        return 'diners';
    }
    if (/^(6011|622|64[4-9]|65)/.test(clean)) {
        return 'discover';
    }
    return 'generic';
}

export function validateLuhn(number) {
    if (!number) return false;
    const clean = number.replace(/\D/g, '');
    if (clean.length < 13 || clean.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;
    for (let i = clean.length - 1; i >= 0; i--) {
        let digit = parseInt(clean.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

export function validateVpa(vpa) {
    if (!vpa) return false;
    const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    return vpaRegex.test(String(vpa).trim());
}
