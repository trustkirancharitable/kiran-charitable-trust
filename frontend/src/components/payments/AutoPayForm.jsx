import React, { useState } from 'react';
import axios from 'axios';
import {
    FaSyncAlt,
    FaShieldAlt,
    FaCheckCircle,
    FaMobileAlt,
    FaUniversity,
    FaBell,
    FaInfoCircle,
    FaArrowRight,
    FaLock
} from 'react-icons/fa';
import { API_BASE_URL } from '../../config';

const POPULAR_UPI_APPS = [
    { id: 'phonepe', name: 'PhonePe', color: '#5f259f' },
    { id: 'gpay', name: 'Google Pay', color: '#4285F4' },
    { id: 'paytm', name: 'Paytm', color: '#00b9f5' },
    { id: 'bhim', name: 'BHIM UPI', color: '#00796B' },
    { id: 'cred', name: 'CRED', color: '#1A1A1A' }
];

export default function AutoPayForm({
    amount = 10,
    purpose = 'Monthly Trust Donation',
    donorDetails = {},
    onSuccess,
    onError
}) {
    const [mandateType, setMandateType] = useState('upi_autopay'); // 'upi_autopay' | 'enach_netbanking'
    const [selectedApp, setSelectedApp] = useState('phonepe');
    const [vpa, setVpa] = useState('');
    const [frequency, setFrequency] = useState('MONTHLY');
    const [recurringAmount, setRecurringAmount] = useState(amount);
    const [maxAmountCap, setMaxAmountCap] = useState(Math.max(amount * 2, 5000));
    const [agreeRbiTerms, setAgreeRbiTerms] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mandateResult, setMandateResult] = useState(null);

    // Bank details state for e-NACH
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifsc, setIfsc] = useState('');

    const handleCreateMandate = async (e) => {
        e.preventDefault();
        if (!agreeRbiTerms) {
            alert('Please consent to the RBI e-Mandate terms to continue.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                mandateType,
                donorName: donorDetails.fullName || 'Valued Donor',
                donorEmail: donorDetails.email || '',
                donorMobile: donorDetails.mobile || '',
                amount: Number(recurringAmount),
                maxAmount: Number(maxAmountCap),
                frequency,
                purpose,
                vpa: mandateType === 'upi_autopay' ? vpa : undefined,
                bankDetails: mandateType === 'enach_netbanking' ? { bankName, accountNumber, ifsc } : undefined,
                authMode: 'netbanking'
            };

            const res = await axios.post(`${API_BASE_URL}/payments/autopay/create-mandate`, payload);
            if (res.data && res.data.success) {
                setMandateResult(res.data);
                if (onSuccess) onSuccess(res.data);

                // If UPI intent URI is returned, prompt user or open
                if (res.data.upiMandateIntentUri && /Android|iPhone/i.test(navigator.userAgent)) {
                    window.location.href = res.data.upiMandateIntentUri;
                }
            } else {
                throw new Error(res.data.message || 'Failed to initiate AutoPay mandate.');
            }
        } catch (err) {
            console.error('AutoPay submit error:', err);
            const msg = err.response?.data?.message || err.message || 'AutoPay setup error.';
            if (onError) onError(msg);
            else alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (mandateResult) {
        return (
            <div className="autopay-mandate-success-card">
                <div className="success-badge">
                    <FaCheckCircle className="text-emerald-500 text-3xl" />
                </div>
                <h3>AutoPay Mandate Initiated!</h3>
                <p className="mandate-id">Mandate ID: <strong>{mandateResult.mandateId}</strong></p>
                <div className="mandate-summary-box">
                    <div><span>Frequency:</span> <strong>{mandateResult.frequency}</strong></div>
                    <div><span>Recurring Amount:</span> <strong>₹{mandateResult.recurringAmount}/month</strong></div>
                    <div><span>Next Debit Date:</span> <strong>{new Date(mandateResult.nextDebitDate).toLocaleDateString('en-IN')}</strong></div>
                </div>
                {mandateResult.upiMandateIntentUri && (
                    <div className="upi-app-prompt">
                        <p>Approve the recurring mandate request directly in your UPI App:</p>
                        <a
                            href={mandateResult.upiMandateIntentUri}
                            className="btn-open-upi-app"
                        >
                            Open UPI App to Authorize Mandate <FaArrowRight />
                        </a>
                    </div>
                )}
                <div className="rbi-security-note">
                    <FaBell className="text-amber-500" />
                    <span>RBI Compliance: You will receive an alert SMS/Email 24 hours prior to each debit. You can pause or cancel anytime.</span>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleCreateMandate} className="autopay-form-container">
            {/* Mandate Type Selector */}
            <div className="mandate-type-tabs">
                <button
                    type="button"
                    className={`mandate-tab ${mandateType === 'upi_autopay' ? 'active' : ''}`}
                    onClick={() => setMandateType('upi_autopay')}
                >
                    <FaMobileAlt /> UPI AutoPay (Instant)
                </button>
                <button
                    type="button"
                    className={`mandate-tab ${mandateType === 'enach_netbanking' ? 'active' : ''}`}
                    onClick={() => setMandateType('enach_netbanking')}
                >
                    <FaUniversity /> Bank e-NACH
                </button>
            </div>

            {/* Amount & Frequency Selector */}
            <div className="form-group-grid">
                <div className="form-group">
                    <label>Recurring Monthly Amount (₹)</label>
                    <input
                        type="number"
                        min="10"
                        value={recurringAmount}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setRecurringAmount(val);
                            setMaxAmountCap(Math.max(val * 2, 5000));
                        }}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Frequency</label>
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                        <option value="MONTHLY">Monthly (Recommended)</option>
                        <option value="QUARTERLY">Quarterly (Every 3 months)</option>
                        <option value="YEARLY">Annual (Yearly)</option>
                    </select>
                </div>
            </div>

            {mandateType === 'upi_autopay' ? (
                <>
                    <div className="upi-app-selector">
                        <label className="section-label">Select Your UPI App</label>
                        <div className="app-chips">
                            {POPULAR_UPI_APPS.map((app) => (
                                <button
                                    key={app.id}
                                    type="button"
                                    className={`app-chip ${selectedApp === app.id ? 'active' : ''}`}
                                    onClick={() => setSelectedApp(app.id)}
                                >
                                    <span className="dot" style={{ backgroundColor: app.color }}></span>
                                    {app.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Your UPI ID / VPA (Optional for mobile browser auto-open)</label>
                        <input
                            type="text"
                            placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                            value={vpa}
                            onChange={(e) => setVpa(e.target.value)}
                        />
                        <small className="help-text">Leave blank to open installed UPI apps directly on your phone.</small>
                    </div>
                </>
            ) : (
                <div className="enach-bank-inputs">
                    <div className="form-group">
                        <label>Bank Name</label>
                        <input
                            type="text"
                            placeholder="e.g. State Bank of India, HDFC Bank"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Bank Account Number</label>
                        <input
                            type="password"
                            placeholder="Account Number"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>IFSC Code</label>
                        <input
                            type="text"
                            placeholder="e.g. SBIN0001234"
                            value={ifsc}
                            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                            required
                        />
                    </div>
                </div>
            )}

            {/* RBI Compliance Notice */}
            <div className="rbi-disclosure-box">
                <FaShieldAlt className="shield-icon" />
                <div className="disclosure-text">
                    <strong>RBI e-Mandate Protection:</strong>
                    <p>
                        Advance notification is delivered via SMS/Email 24 hours prior to every debit. 
                        No surprise charges, and you can pause or revoke this AutoPay mandate at any time from your bank or UPI app.
                    </p>
                </div>
            </div>

            {/* Consent Checkbox */}
            <label className="checkbox-consent">
                <input
                    type="checkbox"
                    checked={agreeRbiTerms}
                    onChange={(e) => setAgreeRbiTerms(e.target.checked)}
                />
                <span>I authorize Kiran Charitable Trust to set up a recurring {frequency.toLowerCase()} mandate of ₹{recurringAmount} for charitable causes.</span>
            </label>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={isSubmitting}
                className="btn-submit-autopay"
            >
                {isSubmitting ? (
                    <span><FaSyncAlt className="animate-spin" /> Registering Mandate...</span>
                ) : (
                    <span><FaLock /> Authorize AutoPay of ₹{recurringAmount}/mo</span>
                )}
            </button>
        </form>
    );
}
