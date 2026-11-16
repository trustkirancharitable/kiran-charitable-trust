import React, { useState } from 'react';
import axios from 'axios';
import {
    FaCreditCard,
    FaLock,
    FaCheckCircle,
    FaShieldAlt,
    FaSyncAlt,
    FaInfoCircle,
    FaCheck
} from 'react-icons/fa';
import { formatCardNumber, formatExpiry, detectCardBrand, validateLuhn } from '../../utils/paymentValidation';
import { API_BASE_URL } from '../../config';

export default function DebitCardForm({
    amount = 1000,
    purpose = 'Charitable Contribution via Debit Card',
    donorDetails = {},
    onSuccess,
    onError
}) {
    const [cardNumber, setCardNumber] = useState('');
    const [cardHolder, setCardHolder] = useState(donorDetails.fullName || '');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cleanNumber = cardNumber.replace(/\s/g, '');

        if (!validateLuhn(cleanNumber)) {
            alert('Invalid debit card number. Please check the digits.');
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
                purpose
            };

            const res = await axios.post(`${API_BASE_URL}/payments/debit/initiate`, payload);
            if (res.data && res.data.success) {
                if (onSuccess) onSuccess(res.data);
                if (res.data.checkoutUrl) {
                    window.location.href = res.data.checkoutUrl;
                }
            } else {
                throw new Error(res.data.message || 'Debit card payment initiation failed.');
            }
        } catch (err) {
            console.error('Debit card submit error:', err);
            const msg = err.response?.data?.message || err.message || 'Payment initiation error.';
            if (onError) onError(msg);
            else alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isRupay = brand === 'rupay';

    return (
        <form onSubmit={handleSubmit} className="debit-card-form">
            {/* Visual Card Preview */}
            <div className={`card-preview debit-theme ${brand}`}>
                <div className="card-top">
                    <span className="card-chip"></span>
                    <span className="card-brand-badge">{brand.toUpperCase()} DEBIT</span>
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

            {/* RuPay Zero MDR Promotion Banner */}
            {isRupay && (
                <div className="rupay-banner">
                    <FaCheck className="text-emerald-500" />
                    <span>RuPay Debit Card: 100% of your contribution reaches our charitable causes with 0% gateway deductions.</span>
                </div>
            )}

            {/* Inputs */}
            <div className="form-group">
                <label>Debit Card Number</label>
                <div className="input-with-icon">
                    <input
                        type="text"
                        placeholder="4591 •••• •••• ••••"
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
                    <label>CVV / CVC</label>
                    <input
                        type="password"
                        placeholder="3 Digits"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        maxLength="3"
                        required
                    />
                </div>
            </div>

            <div className="debit-security-note">
                <FaLock />
                <span>256-bit Bank-grade encryption. You will be redirected to your bank’s 3D Secure OTP authentication page.</span>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pay-card"
            >
                {isSubmitting ? (
                    <span><FaSyncAlt className="animate-spin" /> Connecting to 3D Secure...</span>
                ) : (
                    <span><FaLock /> Pay ₹{amount} Securely via Debit Card</span>
                )}
            </button>
        </form>
    );
}
