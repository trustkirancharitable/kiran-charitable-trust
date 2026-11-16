import React, { useState } from 'react';
import axios from 'axios';
import {
    FaCreditCard,
    FaLock,
    FaShieldAlt,
    FaSyncAlt,
    FaGlobeAmericas,
    FaCheckSquare,
    FaSquare
} from 'react-icons/fa';
import { formatCardNumber, formatExpiry, detectCardBrand, validateLuhn } from '../../utils/paymentValidation';
import { API_BASE_URL } from '../../config';

export default function CreditCardForm({
    amount = 1000,
    purpose = 'Charitable Contribution via Credit Card',
    donorDetails = {},
    onSuccess,
    onError
}) {
    const [cardNumber, setCardNumber] = useState('');
    const [cardHolder, setCardHolder] = useState(donorDetails.fullName || '');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [saveCard, setSaveCard] = useState(true); // RBI Tokenization consent
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [brand, setBrand] = useState('generic');

    const handleNumberChange = (e) => {
        const formatted = formatCardNumber(e.target.value);
        setCardNumber(formatted);
        setBrand(detectCardBrand(formatted));
    };

    const handleExpiryChange = (e) => {
        setExpiry(formatExpiry(e.target.value));
    };

    const isAmex = brand === 'amex';

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cleanNumber = cardNumber.replace(/\s/g, '');

        if (!validateLuhn(cleanNumber)) {
            alert('Invalid credit card number. Please verify all digits.');
            return;
        }

        const [month, year] = expiry.split('/');
        if (!month || !year) {
            alert('Please enter a valid expiry date (MM/YY).');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                donorDetails: {
                    fullName: cardHolder || donorDetails.fullName,
                    email: donorDetails.email || '',
                    mobile: donorDetails.mobile || '',
                    address: donorDetails.address || '',
                    panNumber: donorDetails.panNumber || ''
                },
                cardDetails: {
                    cardNumber: cleanNumber,
                    expiryMonth: month,
                    expiryYear: year,
                    cvv,
                    cardHolderName: cardHolder
                },
                amount: Number(amount),
                saveCard,
                purpose
            };

            const res = await axios.post(`${API_BASE_URL}/payments/credit/initiate`, payload);
            if (res.data && res.data.success) {
                if (onSuccess) onSuccess(res.data);
                if (res.data.checkoutUrl) {
                    window.location.href = res.data.checkoutUrl;
                }
            } else {
                throw new Error(res.data.message || 'Credit card payment initiation failed.');
            }
        } catch (err) {
            console.error('Credit card submit error:', err);
            const msg = err.response?.data?.message || err.message || 'Payment initiation error.';
            if (onError) onError(msg);
            else alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="credit-card-form">
            {/* Visual Card Preview */}
            <div className={`card-preview credit-theme ${brand}`}>
                <div className="card-top">
                    <span className="card-chip"></span>
                    <span className="card-brand-badge">{brand.toUpperCase()} CREDIT</span>
                </div>
                <div className="card-number-display">
                    {cardNumber || '•••• •••• •••• ••••'}
                </div>
                <div className="card-bottom">
                    <div>
                        <small>CARD HOLDER</small>
                        <p>{cardHolder || 'VALUED DONOR'}</p>
                    </div>
                    <div>
                        <small>EXPIRES</small>
                        <p>{expiry || 'MM/YY'}</p>
                    </div>
                </div>
            </div>

            {/* Inputs */}
            <div className="form-group">
                <label>Credit Card Number</label>
                <div className="input-with-icon">
                    <input
                        type="text"
                        placeholder="•••• •••• •••• ••••"
                        value={cardNumber}
                        onChange={handleNumberChange}
                        maxLength="23"
                        required
                    />
                    <FaCreditCard className="input-icon" />
                </div>
            </div>

            <div className="form-group">
                <label>Cardholder Name (as printed on card)</label>
                <input
                    type="text"
                    placeholder="Full Name"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    required
                />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                        type="text"
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={handleExpiryChange}
                        maxLength="5"
                        required
                    />
                </div>
                <div className="form-group">
                    <label>CVV / CVC {isAmex ? '(4 digits for Amex)' : '(3 digits)'}</label>
                    <input
                        type="password"
                        placeholder={isAmex ? '4 Digits' : '3 Digits'}
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, isAmex ? 4 : 3))}
                        maxLength={isAmex ? 4 : 3}
                        required
                    />
                </div>
            </div>

            {/* RBI Tokenization Consent */}
            <label className="checkbox-tokenization">
                <input
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                />
                <span className="token-text">
                    <strong>Securely save card as per RBI Tokenization Guidelines</strong>
                    <small>Your raw card number is never saved; an encrypted bank token is generated.</small>
                </span>
            </label>

            <div className="international-badge">
                <FaGlobeAmericas />
                <span>Supports Indian & International Visa, MasterCard, and American Express.</span>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pay-credit"
            >
                {isSubmitting ? (
                    <span><FaSyncAlt className="animate-spin" /> Verifying 3DS 2.0...</span>
                ) : (
                    <span><FaLock /> Pay ₹{amount} with Credit Card</span>
                )}
            </button>
        </form>
    );
}
