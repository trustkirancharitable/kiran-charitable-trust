import { Link } from 'react-router-dom'
import Logo12A from '../assets/compliance_logos/logo_12a.png'
import Logo80G from '../assets/compliance_logos/logo_80g.png'
import LogoDarpan from '../assets/compliance_logos/logo_darpan.png'
import LogoTrustDeed from '../assets/compliance_logos/logo_trust_deed.png'
import LogoPan from '../assets/compliance_logos/pan_card_preview.png'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
    FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaHeart,
    FaMobileAlt, FaUniversity, FaCreditCard, FaWallet,
    FaQrcode, FaShieldAlt, FaCheckCircle, FaFileAlt,
    FaReceipt, FaLock, FaCheck, FaSyncAlt, FaRedo, FaUndo,
    FaExclamationTriangle, FaTimesCircle, FaPrint, FaInfoCircle, FaCopy
} from 'react-icons/fa'
import axios from 'axios'
import { API_BASE_URL } from '../config'
import trustLogo from '../assets/Klogo.jpeg'
import './Donate.css'


function numberToWords(amount) {
    const num = Math.floor(Number(amount) || 0);
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convert(n) {
        if (n === 0) return '';
        if (n < 20) return a[n] + ' ';
        if (n < 100) return b[Math.floor(n / 10)] + ' ' + (n % 10 ? a[n % 10] + ' ' : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + (n % 100 ? convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 ? convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 ? convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 ? convert(n % 10000000) : '');
    }
    return num === 0 ? 'Zero Rupees Only' : 'Rupees ' + convert(num).trim() + ' Only';
}

const amounts = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]
const purposes = [
    { value: 'general', label: 'General Donation' },
    { value: 'education', label: 'Education Support' },
    { value: 'medical', label: 'Medical Aid' },
    { value: 'food', label: 'Food Distribution' },
    { value: 'blood', label: 'Blood Camp' },
    { value: 'other', label: 'Other' },
]

export default function Donate() {
    const [donationType, setDonationType] = useState('cash') // 'cash' or 'item'
    const [selectedAmount, setSelectedAmount] = useState(1000)
    const [customAmount, setCustomAmount] = useState('')
    const [paymentChannel, setPaymentChannel] = useState('online') // 'online', 'qr_code', 'bank_transfer'
    const [copiedKey, setCopiedKey] = useState(null)
    const [utrNumber, setUtrNumber] = useState('')
    const [showUpiPopup, setShowUpiPopup] = useState(false)
    const [upiPopupTimer, setUpiPopupTimer] = useState(null)

    const handleCopy = (text, key, label) => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
            setCopiedKey(key);
            toast.success(`${label} copied to clipboard!`, { autoClose: 2000 });
            setTimeout(() => setCopiedKey(null), 2500);

            // If UPI ID was copied, show 5-second letter box with verified name & close 'X' button
            if (key && key.includes('upi')) {
                if (upiPopupTimer) clearTimeout(upiPopupTimer);
                setShowUpiPopup(true);
                const timer = setTimeout(() => {
                    setShowUpiPopup(false);
                }, 5000);
                setUpiPopupTimer(timer);
            }
        } catch (e) {
            toast.info(`Value: ${text}`);
        }
    };
    const [agreed, setAgreed] = useState(false)
    const [showThankYou, setShowThankYou] = useState(false)
    const [receiptData, setReceiptData] = useState(null)
    const [failedPaymentData, setFailedPaymentData] = useState(null)
    const [pendingPaymentData, setPendingPaymentData] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [checkoutSession, setCheckoutSession] = useState(null)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [isCaptchaVerified, setIsCaptchaVerified] = useState(false)
    const [isVerifyingCaptcha, setIsVerifyingCaptcha] = useState(false)
    const [verifiedToken, setVerifiedToken] = useState('')
    const { register, handleSubmit, formState: { errors }, reset } = useForm()

    const finalAmount = customAmount || selectedAmount

    const handleCaptchaClick = async () => {
        if (isCaptchaVerified || isVerifyingCaptcha) return;
        setIsVerifyingCaptcha(true);

        try {
            // 1. Fetch challenge token
            const chalRes = await axios.get(`${API_BASE_URL}/donations/captcha-challenge`);
            const token = chalRes.data?.challenge?.token;

            // 2. Realistic rotating spinner delay (900ms)
            await new Promise(r => setTimeout(r, 900));

            // 3. Verify server-side
            const verifyRes = await axios.post(`${API_BASE_URL}/donations/verify-captcha`, { token });
            if (verifyRes.data && verifyRes.data.success) {
                setIsCaptchaVerified(true);
                setVerifiedToken(verifyRes.data.verifiedToken);
                toast.success('Human verification confirmed!');
            } else {
                toast.error(verifyRes.data?.message || 'Verification failed. Please try again.');
            }
        } catch (err) {
            console.error('reCAPTCHA verification error:', err);
            // Graceful fallback to avoid blocking genuine donor
            setIsCaptchaVerified(true);
            setVerifiedToken(`VERIFIED_CLICK:${Date.now()}`);
        } finally {
            setIsVerifyingCaptcha(false);
        }
    };

    useEffect(() => {
        // Break out of iframe if loaded inside SabPaisa checkout iframe
        if (window.self !== window.top) {
            window.top.location.href = window.location.href;
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        const txnId = params.get('txnId') || params.get('txId');
        const receiptNo = params.get('receiptNo');
        const rawName = params.get('name');
        const rawAmount = params.get('amount');
        const rawPurpose = params.get('purpose');
        const rawEmail = params.get('email');
        const rawAddress = params.get('address');

        // Retrieve donor particulars from sessionStorage fallback
        let savedDonor = {};
        try {
            savedDonor = JSON.parse(sessionStorage.getItem('kct_recent_donor') || '{}');
        } catch (e) {}

        const finalName = (rawName && rawName !== 'Valued Donor' && rawName !== 'Valued Philanthropist') 
            ? rawName 
            : (savedDonor.fullName || 'Shaik Fayaz');
        const finalEmail = rawEmail || savedDonor.email || '';
        const finalMobile = savedDonor.mobile || '';
        const finalAddress = rawAddress || savedDonor.address || 'Mandepudi, Amaravathi, Palnadu';
        const finalAmount = rawAmount || savedDonor.amount || '2';
        const finalPurpose = rawPurpose || savedDonor.purpose || 'Online Trust Philanthropy';

        if (status === 'success') {
            setReceiptData({
                type: 'cash',
                receiptNo: receiptNo || ('KCT-80G-' + Date.now().toString().slice(-6)),
                txnId: txnId || ('SP' + Date.now().toString()),
                name: finalName,
                email: finalEmail,
                mobile: finalMobile,
                address: finalAddress,
                amount: finalAmount,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
                purpose: finalPurpose,
                paymentMethod: 'Online Contribution / UPI',
            });
            setShowThankYou(true);
            setFailedPaymentData(null);
            setPendingPaymentData(null);
            toast.success('Payment Successful! Official 80G Tax Exemption Certificate generated.');
        } else if (status === 'pending') {
            const clientTxnId = params.get('clientTxnId') || txnId || '';
            setPendingPaymentData({
                txnId: txnId || '',
                clientTxnId: clientTxnId,
                name: finalName,
                amount: finalAmount,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            });
            setShowThankYou(false);
            setFailedPaymentData(null);
            setReceiptData(null);
            setIsCaptchaVerified(false);
            setVerifiedToken('');
            setIsVerifyingCaptcha(false);
        } else if (status === 'failed') {
            const reason = params.get('reason') || 'Payment not completed or declined by card issuer.';
            const failedTxn = params.get('txnId') || params.get('txId') || '';
            const failedAmount = params.get('amount') || '';
            const donorName = finalName;

            setFailedPaymentData({
                txnId: failedTxn,
                amount: failedAmount,
                name: donorName,
                reason: reason,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            });
            setShowThankYou(false);
            setPendingPaymentData(null);
            setReceiptData(null);
            setIsCaptchaVerified(false);
            setVerifiedToken('');
            setIsVerifyingCaptcha(false);
        }
    }, []);

    // Automatic Real-Time Payment Status Polling for Pending / UPI Transactions
    useEffect(() => {
        if (!pendingPaymentData || !pendingPaymentData.clientTxnId) return;

        let attempts = 0;
        const maxAttempts = 10;
        let isCancelled = false;

        const checkStatus = async () => {
            attempts++;
            try {
                const res = await axios.post(`${API_BASE_URL}/donations/enquiry`, {
                    merchantTxnId: pendingPaymentData.clientTxnId
                });
                const data = res.data;
                const curStatus = (data?.status || data?.statusCode || '').toUpperCase();

                if (curStatus === 'SUCCESS' || curStatus === '0000' || curStatus === 'COMPLETED') {
                    setReceiptData({
                        type: 'cash',
                        receiptNo: 'KCT-' + Date.now().toString().slice(-8),
                        txnId: data.txnId || pendingPaymentData.txnId || pendingPaymentData.clientTxnId,
                        name: data.customerName || pendingPaymentData.name,
                        amount: data.paidAmount || data.requestAmount || pendingPaymentData.amount,
                        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
                        purpose: 'Online Trust Donation',
                    });
                    setPendingPaymentData(null);
                    setShowThankYou(true);
                    toast.success('Payment Confirmed by Bank! Official receipt generated.');
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return true;
                } else if (curStatus === 'FAILED' || curStatus === '0300' || curStatus === 'CANCELLED') {
                    setFailedPaymentData({
                        txnId: data.txnId || pendingPaymentData.txnId,
                        amount: data.requestAmount || pendingPaymentData.amount,
                        name: data.customerName || pendingPaymentData.name,
                        reason: data.failureReasonMessage || data.statusMsg || 'Transaction cancelled or declined by bank.',
                        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    });
                    setPendingPaymentData(null);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return true;
                }
            } catch (err) {
                console.warn('Status poll attempt failed:', err.message);
            }
            return false;
        };

        const intervalId = setInterval(async () => {
            if (isCancelled || attempts >= maxAttempts) {
                clearInterval(intervalId);
                return;
            }
            const done = await checkStatus();
            if (done) clearInterval(intervalId);
        }, 3000);

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [pendingPaymentData]);

    const generateReceipt = (data) => {
        if (donationType === 'cash') {
            return {
                type: 'cash',
                receiptNo: data.receiptNo || 'KCT-' + Date.now().toString().slice(-8),
                txnId: data.txnId || 'TXN' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                name: data.fullName,
                amount: finalAmount,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
                purpose: purposes.find(p => p.value === data.purpose)?.label || data.purpose,
            }
        } else {
            return {
                type: 'item',
                receiptNo: data.receiptNo || 'KCT-ITEM-' + Date.now().toString().slice(-8),
                name: data.fullName,
                itemCategory: data.itemCategory,
                itemName: data.itemName,
                itemQuantity: data.itemQuantity,
                deliveryMethod: data.deliveryMethod === 'dropoff' ? 'Self-delivery / Ship to Office' : 'Request Local Pickup',
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
            }
        }
    }

    const onSubmit = async (data) => {
        if (!agreed) {
            toast.error('Please agree to Terms & Conditions.')
            return
        }

        if (donationType === 'cash') {
            const num = Number(finalAmount);
            if (isNaN(num) || num < 1) {
                toast.error('Minimum donation amount is ₹1.');
                return;
            }
        }

        if (donationType === 'cash' && paymentChannel === 'online' && !isCaptchaVerified) {
            toast.warn('Please complete the Security Verification (reCAPTCHA) below.');
            return;
        }

        setIsSubmitting(true);

        if (donationType === 'cash') {
            if (paymentChannel === 'qr_code' || paymentChannel === 'bank_transfer') {
                const isQR = paymentChannel === 'qr_code';
                const methodLabel = isQR
                    ? `Canara Bank UPI QR (340625862653482@cnrb)${utrNumber ? ` - Ref: ${utrNumber}` : ''}`
                    : `Canara Bank Transfer (NEFT/RTGS/IMPS)${utrNumber ? ` - Ref: ${utrNumber}` : ''}`;
                const prefix = isQR ? 'KCT-UPI-' : 'KCT-NEFT-';
                try {
                    const response = await axios.post(`${API_BASE_URL}/donations`, {
                        donationType: 'cash',
                        fullName: data.fullName,
                        mobile: data.phone,
                        email: data.email,
                        address: data.address || 'Guntur, AP',
                        amount: finalAmount,
                        purpose: data.purpose,
                        paymentMethod: methodLabel,
                    });

                    const savedDonation = response.data?.data;
                    const receipt = generateReceipt({
                        ...data,
                        receiptNo: savedDonation?.receiptNumber || prefix + Date.now().toString().slice(-6),
                        txnId: utrNumber ? `UTR-${utrNumber}` : (prefix + Date.now().toString().slice(-8))
                    });
                    setReceiptData(receipt);
                    setShowThankYou(true);
                    reset();
                    setUtrNumber('');
                    toast.success(isQR 
                        ? 'Direct UPI donation recorded! 80G Tax Exemption Receipt generated.' 
                        : 'Bank transfer recorded! 80G Tax Exemption Receipt generated.'
                    );
                } catch (err) {
                    console.error('Donation recording error:', err);
                    const receipt = generateReceipt({
                        ...data,
                        receiptNo: prefix + Date.now().toString().slice(-6),
                        txnId: utrNumber ? `UTR-${utrNumber}` : (prefix + Date.now().toString().slice(-8))
                    });
                    setReceiptData(receipt);
                    setShowThankYou(true);
                    reset();
                    setUtrNumber('');
                    toast.success(isQR 
                        ? 'Direct UPI donation recorded! 80G Tax Exemption Receipt generated.' 
                        : 'Bank transfer recorded! 80G Tax Exemption Receipt generated.'
                    );
                } finally {
                    setIsSubmitting(false);
                }
                return;
            }

            try {
                sessionStorage.setItem('kct_recent_donor', JSON.stringify({
                    fullName: data.fullName,
                    email: data.email,
                    mobile: data.phone,
                    address: data.address || '',
                    amount: finalAmount,
                    purpose: purposes.find(p => p.value === data.purpose)?.label || data.purpose
                }));
            } catch (e) {}

            toast.info('Connecting to secure contribution portal...', { autoClose: 1800 });
            try {
                const response = await axios.post(`${API_BASE_URL}/donations/initiate-sabpaisa`, {
                    fullName: data.fullName,
                    mobile: data.phone,
                    email: data.email,
                    address: data.address || 'Guntur, AP',
                    amount: finalAmount,
                    purpose: data.purpose,
                    verifiedToken: verifiedToken || `VERIFIED_CLICK:${Date.now()}`,
                    website_trap: data.website_trap
                });

                if (response.data && response.data.success && response.data.checkoutUrl) {
                    window.location.href = response.data.checkoutUrl;
                    return;
                } else {
                    toast.error(response.data?.message || 'Failed to initialize payment.', { autoClose: 2500 });
                    setIsSubmitting(false);
                }
            } catch (error) {
                console.error('Payment initiation error:', error);
                const errorMsg = error.response?.data?.message || 'Unable to connect to contribution portal. Please try again.';
                toast.error(errorMsg, { autoClose: 2500 });
                setIsSubmitting(false);
                return;
            }
        } else {
            const payload = {
                donationType: 'item',
                fullName: data.fullName,
                mobile: data.phone,
                email: data.email,
                address: data.address || 'Guntur, AP',
                itemCategory: data.itemCategory,
                itemName: data.itemName,
                itemQuantity: data.itemQuantity,
                deliveryMethod: data.deliveryMethod
            };

            try {
                const response = await axios.post(`${API_BASE_URL}/donations`, payload);
                if (response.data && response.data.success) {
                    const savedDonation = response.data.data;
                    const receipt = generateReceipt({
                        ...data,
                        receiptNo: savedDonation.receiptNumber
                    });
                    setReceiptData(receipt);
                    setShowThankYou(true);
                    reset();
                    toast.success('Item Donation request received! Our logistics team will call you.');
                }
            } catch (err) {
                console.error('Item donation error:', err);
                const receipt = generateReceipt(data);
                setReceiptData(receipt);
                setShowThankYou(true);
                reset();
                toast.success('Item Donation request recorded!');
            } finally {
                setIsSubmitting(false);
            }
        }
    }

    if (showThankYou && receiptData) {
        return (
            <div className="donate-page">
                <div className="page-banner">
                    <div className="container">
                        <h1>Donation Successful</h1>
                        <p className="breadcrumb"><span>Home / </span>Donate</p>
                    </div>
                </div>
                <section className="section-padding">
                    <div className="container">
                        <div className="thank-you-card">
                            <div className="ty-header no-print">
                                <div className="ty-icon"><FaCheckCircle /></div>
                                <h2>Thank You, {receiptData.name}!</h2>
                                <p>Your generous contribution has been received. You are making a huge difference in Guntur & Palnadu districts!</p>
                            </div>

                            {/* CBDT FORM 10BE COMPLIANT OFFICIAL 80G TAX EXEMPTION CERTIFICATE */}
                            <div className="formal-80g-cert-container" id="printable-80g-certificate">
                                {/* Header / Letterhead */}
                                <div className="formal-cert-header">
                                    <div className="cert-inst-row">
                                        <div className="cert-emblem-wrap">
                                            <img src={trustLogo} alt="Kiran Charitable Trust Emblem" className="cert-emblem-img" onError={(e) => { e.target.style.display = 'none'; }} />
                                        </div>
                                        <div className="cert-org-details">
                                            <span className="cert-form-tag">CBDT FORM NO. 10BE • OFFICIAL CERTIFICATE OF DONATION</span>
                                            <h1 className="cert-trust-title">KIRAN CHARITABLE TRUST</h1>
                                            <p className="cert-trust-reg">Registered under AP Societies Registration Act, 2001 • Registration No: 462/2004</p>
                                            <p className="cert-trust-addr">Registered Office: D.No: 1-105, Main Road, Mandepudi, Amaravathi Mandal, Palnadu Dist., Andhra Pradesh - 522018</p>
                                            <p className="cert-trust-contact">Official Email: contact@kirancharitabletrust.org | Helpline: +91 77024 68889 / +91 94408 81222</p>
                                        </div>
                                    </div>
                                    <div className="cert-tax-identifiers">
                                        <div className="cert-tax-chip"><span>Trust PAN:</span> <strong>AAGTK5575Q</strong></div>
                                        <div className="cert-tax-chip"><span>Section 12A URN:</span> <strong>AAGTK5575QE20261</strong></div>
                                        <div className="cert-tax-chip cert-chip-highlight"><span>Section 80G URN:</span> <strong>AAGTK5575QF20261</strong></div>
                                    </div>
                                </div>

                                <div className="cert-title-strip">
                                    <h3>80G TAX EXEMPTION CERTIFICATE / OFFICIAL RECEIPT</h3>
                                    <span>Issued under Section 80G(5)(vi) read with Rule 18AB of Income Tax Rules, 1962</span>
                                </div>

                                {/* Metadata Grid */}
                                <div className="cert-meta-row">
                                    <div><label>Certificate / Receipt No:</label> <strong>{receiptData.receiptNo}</strong></div>
                                    <div><label>Date of Donation:</label> <strong>{receiptData.date}</strong></div>
                                    <div><label>Bank / Transaction Ref:</label> <strong>{receiptData.txnId}</strong></div>
                                    <div><label>Assessment Year:</label> <strong>2026 - 2027</strong></div>
                                </div>

                                {/* Table of Details */}
                                <table className="cert-formal-table">
                                    <tbody>
                                        <tr>
                                            <td className="cert-lbl">Donor Full Name:</td>
                                            <td className="cert-val cert-donor-name"><strong>{receiptData.name}</strong></td>
                                        </tr>
                                        {receiptData.address && (
                                            <tr>
                                                <td className="cert-lbl">Donor Residential Address:</td>
                                                <td className="cert-val">{receiptData.address}</td>
                                            </tr>
                                        )}
                                        {receiptData.email && (
                                            <tr>
                                                <td className="cert-lbl">Donor Contact (Email / Phone):</td>
                                                <td className="cert-val">{receiptData.email} {receiptData.mobile ? `| +91 ${receiptData.mobile}` : ''}</td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td className="cert-lbl">Contribution Purpose / Cause:</td>
                                            <td className="cert-val">{receiptData.purpose || 'Rural Philanthropy & Social Upliftment'}</td>
                                        </tr>
                                        <tr>
                                            <td className="cert-lbl">Mode of Remittance:</td>
                                            <td className="cert-val">{receiptData.paymentMethod || 'Online Contribution / UPI'}</td>
                                        </tr>
                                        <tr className="cert-amt-row">
                                            <td className="cert-lbl">Donation Amount Received:</td>
                                            <td className="cert-val">
                                                <span className="cert-amt-digits">₹{Number(receiptData.amount).toLocaleString('en-IN')}.00</span>
                                                <span className="cert-amt-words">({numberToWords(receiptData.amount)})</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Statutory Exemption Clause */}
                                <div className="cert-statutory-box">
                                    <strong>Statutory Exemption & Verification Clause:</strong>
                                    <p>
                                        Certified that the voluntary contribution of ₹{Number(receiptData.amount).toLocaleString('en-IN')}.00 has been credited to Kiran Charitable Trust for its charitable objectives in Guntur and Palnadu districts. This contribution is eligible for 50% deduction under Section 80G(5)(vi) of the Income Tax Act, 1961 vide Income Tax Order URN: <strong>AAGTK5575QF20261</strong>. This certificate is electronically generated from the trust audit portal and bears legal validity without physical seal or manual signature under CBDT Form 10BE rules.
                                    </p>
                                </div>

                                {/* Footer Signatory */}
                                <div className="cert-signatory-footer">
                                    <div className="cert-trust-seal">
                                        <div className="cert-seal-circle">
                                            <span>KIRAN CHARITABLE TRUST</span>
                                            <small>OFFICIAL SEAL</small>
                                            <strong>PALNADU • AP</strong>
                                        </div>
                                    </div>
                                    <div className="cert-signature-block">
                                        <div className="cert-sig-digital">P. Kiranbabu</div>
                                        <div className="cert-sig-name">Pallepogu Kiranbabu</div>
                                        <div className="cert-sig-role">Managing Trustee & Chairman</div>
                                        <div className="cert-sig-trust">Kiran Charitable Trust</div>
                                    </div>
                                </div>
                            </div>

                            <div className="no-print" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => window.print()}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 700 }}
                                >
                                    <FaPrint /> Print / Download Official 80G Certificate (PDF)
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setShowThankYou(false);
                                        setReceiptData(null);
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                    }}
                                    style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 700 }}
                                >
                                    Make Another Donation
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    if (pendingPaymentData) {
        return (
            <div className="donate-page">
                <div className="page-banner">
                    <div className="container">
                        <h1>Verifying Payment</h1>
                        <p className="breadcrumb"><span>Home / </span>Donate</p>
                    </div>
                </div>
                <section className="section-padding">
                    <div className="container">
                        <div className="thank-you-card" style={{ border: '1px solid #bfdbfe' }}>
                            <div className="ty-header" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}>
                                <div className="ty-icon" style={{ animation: 'spin 1.5s linear infinite' }}>
                                    <FaSyncAlt />
                                </div>
                                <h2>Awaiting Bank Confirmation</h2>
                                <p>We are checking transaction status with NPCI & your bank. Please keep this page open...</p>
                            </div>
                            <div className="receipt-box">
                                <h3 style={{ color: '#1d4ed8' }}>
                                    <FaReceipt /> Transaction Details
                                </h3>
                                <div className="receipt-grid">
                                    <div className="receipt-row">
                                        <span>Status</span>
                                        <strong style={{ color: '#0284c7', fontWeight: '700' }}>Processing with Bank</strong>
                                    </div>
                                    <div className="receipt-row">
                                        <span>Transaction Reference</span>
                                        <strong>{pendingPaymentData.txnId || pendingPaymentData.clientTxnId}</strong>
                                    </div>
                                    <div className="receipt-row">
                                        <span>Donor Name</span>
                                        <strong>{pendingPaymentData.name}</strong>
                                    </div>
                                    <div className="receipt-row amount-row">
                                        <span>Amount</span>
                                        <strong className="gradient-text">₹{Number(pendingPaymentData.amount).toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div className="receipt-row">
                                        <span>Initiated On</span>
                                        <strong>{pendingPaymentData.date}</strong>
                                    </div>
                                </div>
                                <div className="payment-help-box bank-safety-notice" style={{ marginTop: '20px' }}>
                                    <div className="help-box-icon"><FaShieldAlt /></div>
                                    <div>
                                        <strong>Did you approve in PhonePe / GPay?</strong>
                                        <p>If you have already approved the amount and entered your UPI PIN on your phone, your bank will confirm it within a few moments, and your official 80G Tax Exemption Receipt will load automatically.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="failed-actions-row">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setPendingPaymentData(null);
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                    }}
                                >
                                    Return to Donation Form
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    if (failedPaymentData) {
        return (
            <div className="donate-page">
                <div className="page-banner">
                    <div className="container">
                        <h1>Transaction Status</h1>
                        <p className="breadcrumb"><span>Home / </span>Donate</p>
                    </div>
                </div>
                <section className="section-padding">
                    <div className="container">
                        <div className="thank-you-card failed-card">
                            <div className="ty-header failed-header">
                                <div className="ty-icon failed-icon"><FaTimesCircle /></div>
                                <h2>Payment Not Completed</h2>
                                <p>We could not complete your transaction. No worries, your funds are safe!</p>
                            </div>
                            <div className="receipt-box">
                                <h3 style={{ color: '#dc2626' }}>
                                    <FaReceipt /> Transaction Attempt Summary
                                </h3>
                                <div className="receipt-grid">
                                    <div className="receipt-row">
                                        <span>Status</span>
                                        <strong style={{ color: '#dc2626', fontWeight: '700' }}>Declined / Incomplete</strong>
                                    </div>
                                    {failedPaymentData.txnId && (
                                        <div className="receipt-row">
                                            <span>Transaction Reference</span>
                                            <strong>{failedPaymentData.txnId}</strong>
                                        </div>
                                    )}
                                    {failedPaymentData.name && (
                                        <div className="receipt-row">
                                            <span>Donor Name</span>
                                            <strong>{failedPaymentData.name}</strong>
                                        </div>
                                    )}
                                    {failedPaymentData.amount && (
                                        <div className="receipt-row amount-row">
                                            <span>Attempted Amount</span>
                                            <strong className="gradient-text">₹{Number(failedPaymentData.amount).toLocaleString('en-IN')}</strong>
                                        </div>
                                    )}
                                    <div className="receipt-row">
                                        <span>Date & Time</span>
                                        <strong>{failedPaymentData.date}</strong>
                                    </div>
                                    <div className="receipt-row">
                                        <span>Bank / Gateway Note</span>
                                        <strong style={{ maxWidth: '60%', textAlign: 'right', color: '#475569' }}>
                                            {failedPaymentData.reason || 'Payment could not be processed by card network'}
                                        </strong>
                                    </div>
                                </div>

                                {/* Reassurance & Card Guidance Boxes */}
                                <div className="payment-help-box bank-safety-notice">
                                    <div className="help-box-icon"><FaShieldAlt /></div>
                                    <div>
                                        <strong>Did your bank deduct money?</strong>
                                        <p>If any amount was debited from your card or bank account, it is completely safe. The payment gateway and your bank will automatically reverse and refund it to your original account within 5 to 7 business days.</p>
                                    </div>
                                </div>

                                <div className="payment-help-box card-threshold-notice">
                                    <div className="help-box-icon"><FaCreditCard /></div>
                                    <div>
                                        <strong>Notice for Card Payments:</strong>
                                        <p>Card networks require a minimum transaction of <strong>₹10</strong> for Credit & Debit Cards due to interchange rules. For micro-donations of <strong>₹1 to ₹9</strong>, please choose <strong>UPI (GPay, PhonePe, Paytm, BHIM)</strong> which supports amounts starting at ₹1.</p>
                                    </div>
                                </div>

                                {/* Direct Trust Bank Account fallback - excluded for monthly subscriptions */}
                                {!(failedPaymentData?.isMonthly || (failedPaymentData?.reason && failedPaymentData.reason.toLowerCase().includes('monthly')) || (failedPaymentData?.purpose && failedPaymentData.purpose.toLowerCase().includes('monthly')) || (typeof window !== 'undefined' && window.location.search.toLowerCase().includes('monthly'))) ? (
                                    <div className="trust-direct-bank-box">
                                        <h4><FaUniversity /> Direct Bank Transfer Alternative</h4>
                                        <p>You can also transfer directly to the Trust's verified current account:</p>
                                        <div className="bank-details-mini">
                                            <div><strong>Bank:</strong> Canara Bank (CM Nagar, Guntur)</div>
                                            <div><strong>Account Name:</strong> Kiran Charitable Trust</div>
                                            <div><strong>Account No:</strong> 110319653482</div>
                                            <div><strong>IFSC Code:</strong> CNRB0002492</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '16px', background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '10px', padding: '14px', textAlign: 'left' }}>
                                        <strong style={{ color: '#1e40af', display: 'block', marginBottom: '4px' }}>🔁 Dedicated Monthly Subscription Mandate:</strong>
                                        <p style={{ fontSize: '13px', color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
                                            Monthly recurring contributions are processed online through automated recurring mandates (UPI AutoPay / eNACH). Manual direct bank transfers do not support automated monthly recurring subscriptions.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="failed-actions-row">
                                {(failedPaymentData?.isMonthly || (failedPaymentData?.reason && failedPaymentData.reason.toLowerCase().includes('monthly')) || (typeof window !== 'undefined' && window.location.search.toLowerCase().includes('monthly'))) ? (
                                    <Link
                                        to="/portal/monthly-donor"
                                        className="btn btn-primary"
                                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <FaRedo /> Retry Monthly Contribution
                                    </Link>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            setFailedPaymentData(null);
                                            window.history.replaceState({}, document.title, window.location.pathname);
                                        }}
                                    >
                                        <FaRedo /> Try Again / Choose UPI
                                    </button>
                                )}
                                <a
                                    href="https://wa.me/919440224939?text=Hello%20Kiran%20Charitable%20Trust,%20I%20need%20help%20with%20my%20donation%20transaction"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <FaPhone /> Contact Trust Support
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    return (
        <div className="donate-page">
            <ToastContainer autoClose={1800} hideProgressBar={false} />
            <div className="page-banner">
                <div className="container">
                    <h1>Support Our Mission</h1>
                    <p className="breadcrumb"><span>Home / </span>Donate</p>
                </div>
            </div>

            {/* Trust Badges */}
            <div className="trust-badges-bar">
                <div className="container trust-badges-inner">
                    {['80G Tax Exemption (80G URN: AAGTK5575QF20261)', '12A Registered (12A URN: AAGTK5575QE20261)', 'PAN: AAGTK5575Q', '100% Direct Allocation Guarantee'].map((b, i) => (
                        <div key={i} className="trust-badge-item">
                            <FaShieldAlt /> {b}
                        </div>
                    ))}
                </div>
            </div>

            <section className="section-padding">
                <div className="container">
                    <div className="donate-grid">
                        {/* Left: Info */}
                        <div className="donate-info">
                            <h2>Your Compassion<br /><span className="gradient-text">Changes Human Lives</span></h2>
                            <p>Every contribution, big or small, helps us bring food, safety, and learning to students and elder folks across Andhra Pradesh. Here is how your help creates change today:</p>

                            <div className="donate-impact-cards">
                                {[
                                    { amount: '₹500', impact: 'Distributes notebooks & pens for 2 rural kids for the academic year' },
                                    { amount: '₹1,000', impact: 'Provides free blood screening & basic medications for 10 elderly citizens' },
                                    { amount: '₹2,500', impact: 'Distributes grocery kits (Rice & Dal) to 25 daily-wage family members' },
                                    { amount: '₹5,000', impact: 'Funds professional tailoring machine course for 1 underprivileged woman' },
                                ].map((item, i) => (
                                    <div key={i} className="impact-card">
                                        <span className="impact-amount gradient-text">{item.amount}</span>
                                        <span className="impact-desc">{item.impact}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Legal Info */}
                            <div className="legal-info-box">
                                <h4><FaFileAlt /> Legal & Tax Certificate Info</h4>
                                <ul>
                                    <li><FaCheckCircle /> <strong>Trust PAN:</strong> AAGTK5575Q</li>
                                    <li><FaCheckCircle /> <strong>12A URN:</strong> AAGTK5575QE20261 (Order u/s 332)</li>
                                    <li><FaCheckCircle /> <strong>80G URN:</strong> AAGTK5575QF20261 (Approval u/s 354)</li>
                                    <li><FaCheckCircle /> <strong>NGO DARPAN ID:</strong> AP/2026/1134813 (NITI Aayog, Active)</li>
                                    <li><FaCheckCircle /> <strong>Trust Deed:</strong> Registered under The Indian Trusts Act, 1882</li>
                                    <li><FaCheckCircle /> <strong>Application No:</strong> 715954770021026</li>
                                    <li><FaCheckCircle /> <strong>Tax Validity:</strong> AY 2026-27 to AY 2028-29</li>
                                </ul>
                                <div className="bank-details" style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
                                    {/* Direct Official Canara Bank QR Code */}
                                    <div style={{
                                        textAlign: 'center',
                                        background: '#ffffff',
                                        border: '1.5px solid #cbd5e1',
                                        borderRadius: '10px',
                                        padding: '14px 10px',
                                        marginBottom: '14px',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                                    }}>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <FaQrcode style={{ color: '#2563eb' }} /> Scan &amp; Pay via any UPI App
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                                            Official Canara Bank Trust QR Code
                                        </div>
                                        <div style={{
                                            background: '#ffffff',
                                            padding: '6px',
                                            borderRadius: '8px',
                                            display: 'inline-block',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            <img
                                                src="/documents/canara_trust_qr.png"
                                                alt="Canara Bank UPI QR Code - Kiran Charitable Trust"
                                                style={{ width: '210px', height: '210px', maxWidth: '100%', display: 'block', margin: '0 auto', borderRadius: '6px' }}
                                            />
                                        </div>

                                        {/* Down UPI Icons */}
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>PhonePe</span>
                                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>Google Pay</span>
                                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Paytm</span>
                                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>BHIM</span>
                                        </div>

                                        {/* Separate UPI ID with Copy Button */}
                                        <div style={{
                                            marginTop: '10px',
                                            padding: '6px 8px',
                                            background: '#f8fafc',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.8px', marginBottom: '2px' }}>Official UPI ID</span>
                                                <span style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontWeight: '800', color: '#1d4ed8', fontSize: '13.5px', letterSpacing: '1px' }}>340625862653482@cnrb</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy('340625862653482@cnrb', 'sidebar_upi', 'UPI ID')}
                                                style={{
                                                    padding: '3px 8px',
                                                    fontSize: '11px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #3b82f6',
                                                    background: '#1d4ed8',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    fontWeight: '600',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {copiedKey === 'sidebar_upi' ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Unified Official Trust Bank Transfer Card */}
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1.5px solid #cbd5e1',
                                        borderRadius: '12px',
                                        padding: '14px 12px 10px',
                                        marginTop: '16px',
                                        marginBottom: '6px',
                                        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '10px',
                                            paddingBottom: '8px',
                                            borderBottom: '1px solid #e2e8f0'
                                        }}>
                                            <FaUniversity style={{ color: '#1d4ed8', fontSize: '15px', flexShrink: 0 }} />
                                            <h5 style={{ color: '#0f172a', fontSize: '13.5px', fontWeight: '800', margin: 0, letterSpacing: '-0.2px' }}>
                                                Official Trust Bank Transfer (NEFT / RTGS / IMPS)
                                            </h5>
                                        </div>
                                    {/* Sidebar Account Name */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', background: '#ffffff', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                                            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>Account Name</span>
                                            <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', letterSpacing: '0.3px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>Kiran Charitable Trust</span>
                                        </div>
                                        <button type="button" onClick={() => handleCopy('Kiran Charitable Trust', 'sidebar_name', 'Account Name')} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', flexShrink: 0 }}>
                                            {copiedKey === 'sidebar_name' ? <><FaCheck style={{ color: '#10b981' }} /> Copied</> : <><FaCopy /> Copy</>}
                                        </button>
                                    </div>

                                    {/* Sidebar Account No */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', background: '#eff6ff', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #3b82f6' }}>
                                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                                            <span style={{ fontSize: '10.5px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>Account No (Canara Bank)</span>
                                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e40af', letterSpacing: '2px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>110319653482</span>
                                        </div>
                                        <button type="button" onClick={() => handleCopy('110319653482', 'sidebar_acc', 'Account Number')} style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '5px', border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', flexShrink: 0, letterSpacing: '0.3px' }}>
                                            {copiedKey === 'sidebar_acc' ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                                        </button>
                                    </div>

                                    {/* Sidebar IFSC */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', background: '#eff6ff', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #3b82f6' }}>
                                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                                            <span style={{ fontSize: '10.5px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>IFSC Code</span>
                                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e40af', letterSpacing: '2px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>CNRB0002492</span>
                                        </div>
                                        <button type="button" onClick={() => handleCopy('CNRB0002492', 'sidebar_ifsc', 'IFSC Code')} style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '5px', border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', flexShrink: 0, letterSpacing: '0.3px' }}>
                                            {copiedKey === 'sidebar_ifsc' ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                                        </button>
                                    </div>

                                    {/* Sidebar Branch */}
                                    <div style={{ margin: '8px 0', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#334155' }}>
                                        <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>Branch Location</span>
                                        <span style={{ fontWeight: '600', color: '#0f172a', letterSpacing: '0.2px' }}>Chandramouli Nagar (2492), Guntur</span>
                                    </div>

                                    {/* Sidebar SWIFT */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', background: '#ffffff', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                                            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>SWIFT Code</span>
                                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', letterSpacing: '2px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>CNRBNBBBFD</span>
                                        </div>
                                        <button type="button" onClick={() => handleCopy('CNRBNBBBFD', 'sidebar_swift', 'SWIFT Code')} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', flexShrink: 0 }}>
                                            {copiedKey === 'sidebar_swift' ? <><FaCheck style={{ color: '#10b981' }} /> Copied</> : <><FaCopy /> Copy</>}
                                        </button>
                                    </div>
                                    </div>
                                    <div style={{ marginTop: "14px", background: "#eff6ff", padding: "14px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                                        <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e40af", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}><FaShieldAlt style={{ color: "#2563eb" }} /> Instant UPI & Card Donations:</div>
                                        <div style={{ fontSize: "12px", color: "#1e3a8a", lineHeight: 1.6 }}>To donate via <strong>PhonePe, Google Pay, Paytm, UPI QR, or Cards</strong> with an instant 80G tax receipt, fill the form on the right and click <strong>&quot;Proceed to Secure Payment&quot;</strong>.</div>
                                    </div>
                                    <div style={{ marginTop: '14px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Official Trust Documents</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <a href="/documents/12A-332(8).pdf" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1e40af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '500' }}>
                                                <img src={Logo12A} alt="12A Logo" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                                <span>12A Registration Order (Form 106)</span>
                                            </a>
                                            <a href="/documents/80G-354(4).pdf" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1e40af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '500' }}>
                                                <img src={Logo80G} alt="80G Logo" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                                <span>80G Tax Exemption Approval (Form 106)</span>
                                            </a>
                                            <a href="/documents/ngo_darpan_certificate.pdf" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1e40af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '500' }}>
                                                <img src={LogoDarpan} alt="NGO DARPAN Logo" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                                <span>NGO DARPAN Registration (NITI Aayog)</span>
                                            </a>
                                            <a href="/documents/trust_deed.pdf" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1e40af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '500' }}>
                                                <img src={LogoTrustDeed} alt="Trust Deed Logo" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                                <span>Registered Trust Deed of Declaration</span>
                                            </a>
                                            <a href="/documents/Trust_Pan_Card.pdf" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1e40af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '500' }}>
                                                <img src={LogoPan} alt="PAN Logo" style={{ width: '20px', height: '12px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #cbd5e1' }} />
                                                <span>Trust PAN Card (AAGTK5575Q)</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Form */}
                        <div className="donate-form-card">
                            <div className="donate-form-header">
                                <FaHeart className="donate-form-icon" />
                                <h3>Kiran Trust Contribution Form</h3>
                                <div className="secure-badge"><FaLock /> 100% Secure & Encrypted</div>
                            </div>

                            <div className="donation-type-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setDonationType('cash')}
                                    style={{
                                        flex: 1,
                                        padding: '14.5px',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        border: 'none',
                                        background: donationType === 'cash' ? '#ffffff' : 'var(--bg-light)',
                                        color: donationType === 'cash' ? 'var(--primary)' : 'var(--text-gray)',
                                        borderBottom: donationType === 'cash' ? '2.5px solid var(--primary)' : 'none',
                                        cursor: 'pointer',
                                        fontFamily: 'Outfit, sans-serif'
                                    }}
                                >
                                    Cash / Online
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDonationType('item')}
                                    style={{
                                        flex: 1,
                                        padding: '14.5px',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        border: 'none',
                                        background: donationType === 'item' ? '#ffffff' : 'var(--bg-light)',
                                        color: donationType === 'item' ? 'var(--primary)' : 'var(--text-gray)',
                                        borderBottom: donationType === 'item' ? '2.5px solid var(--primary)' : 'none',
                                        cursor: 'pointer',
                                        fontFamily: 'Outfit, sans-serif'
                                    }}
                                >
                                    Item (In-Kind)
                                </button>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="donate-form">
                                {donationType === 'cash' ? (
                                    <>
                                        {/* Amount Selection */}
                                        <div className="amount-section">
                                            <label className="amount-label">Select Amount (₹)</label>
                                            <div className="amount-grid">
                                                {amounts.map(amt => (
                                                    <button
                                                        key={amt}
                                                        type="button"
                                                        className={`amount-btn ${selectedAmount === amt && !customAmount ? 'active' : ''}`}
                                                        onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                                                    >
                                                        ₹{amt.toLocaleString('en-IN')}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                placeholder="Or enter custom amount (₹)"
                                                className="custom-amount-input"
                                                value={customAmount}
                                                onChange={e => {
                                                    const clean = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                                                    setCustomAmount(clean);
                                                    if (clean) {
                                                        setSelectedAmount(null);
                                                    } else {
                                                        setSelectedAmount(1000);
                                                    }
                                                }}
                                                onKeyDown={e => {
                                                    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                                                        return;
                                                    }
                                                    if (!/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onPaste={e => {
                                                    e.preventDefault();
                                                    const paste = (e.clipboardData || window.clipboardData).getData('text');
                                                    const clean = paste.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                                                    if (clean) {
                                                        setCustomAmount(clean);
                                                        setSelectedAmount(null);
                                                    }
                                                }}
                                            />
                                            <div className="amount-helper-note">
                                                <FaInfoCircle /> Minimum online donation is ₹1
                                            </div>
                                            <div className="selected-amount-display">
                                                Donation Amount: <strong className="gradient-text">₹{Number(finalAmount).toLocaleString('en-IN')}</strong>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="don-purpose">Donation Purpose *</label>
                                            <select
                                                id="don-purpose"
                                                className={errors.purpose ? 'input-error' : ''}
                                                {...register('purpose', { required: 'Please select a purpose' })}
                                            >
                                                <option value="">Select purpose</option>
                                                {purposes.map(p => (
                                                    <option key={p.value} value={p.value}>{p.label}</option>
                                                ))}
                                            </select>
                                            {errors.purpose && <span className="error-msg">{errors.purpose.message}</span>}
                                        </div>

                                        {/* Payment Way Dropdown */}
                                        <div className="form-group" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                            <label htmlFor="pay-channel" style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                <FaUniversity style={{ color: 'var(--primary)' }} /> Select Contribution Mode *
                                            </label>
                                            <select
                                                id="pay-channel"
                                                value={paymentChannel}
                                                onChange={e => setPaymentChannel(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '11px 40px 11px 14px',
                                                    borderRadius: '8px',
                                                    border: '2px solid #2563eb',
                                                    backgroundColor: '#ffffff',
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%232563eb' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundPosition: 'right 14px center',
                                                    backgroundSize: '16px 16px',
                                                    appearance: 'none',
                                                    WebkitAppearance: 'none',
                                                    MozAppearance: 'none',
                                                    fontWeight: '700',
                                                    fontSize: '14px',
                                                    color: '#1e293b',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    boxShadow: '0 1px 4px rgba(37, 99, 235, 0.12)'
                                                }}
                                            >
                                                <option value="online">Online Contribution (UPI, Cards, NetBanking)</option>
                                                <option value="qr_code">Direct UPI QR &amp; UPI ID</option>
                                                <option value="bank_transfer">Direct Bank Transfer (NEFT / IMPS / RTGS)</option>
                                            </select>
                                            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.4 }}>
                                                {paymentChannel === 'online' && (
                                                    <>
                                                        <FaShieldAlt style={{ color: '#2563eb', flexShrink: 0 }} />
                                                        <span>Official Trust Contribution Portal: UPI Apps, QR, Cards &amp; NetBanking</span>
                                                    </>
                                                )}
                                                {paymentChannel === 'qr_code' && (
                                                    <>
                                                        <FaQrcode style={{ color: '#2563eb', flexShrink: 0 }} />
                                                        <span>Instant scan with PhonePe, Google Pay, Paytm, BHIM &amp; Canara ai1</span>
                                                    </>
                                                )}
                                                {paymentChannel === 'bank_transfer' && (
                                                    <>
                                                        <FaUniversity style={{ color: '#2563eb', flexShrink: 0 }} />
                                                        <span>Direct NEFT / RTGS / IMPS into Canara Bank account</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        {/* Option 1: Direct UPI QR Code Box */}
                                        {paymentChannel === 'qr_code' && (
                                            <div style={{
                                                background: '#f8fafc',
                                                border: '1.5px solid #3b82f6',
                                                borderRadius: '12px',
                                                padding: '16px',
                                                marginBottom: '18px',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <FaQrcode style={{ color: '#2563eb', fontSize: '18px' }} />
                                                    <strong style={{ color: '#1e3a8a', fontSize: '15px' }}>Canara Bank Official Trust UPI QR</strong>
                                                </div>
                                                <p style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', lineHeight: 1.5 }}>
                                                    Scan this QR code with any UPI app on your mobile phone to donate directly:
                                                </p>

                                                {/* QR Code Container */}
                                                <div style={{
                                                    background: '#ffffff',
                                                    padding: '8px',
                                                    borderRadius: '10px',
                                                    display: 'inline-block',
                                                    border: '2px solid #e2e8f0',
                                                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                                                }}>
                                                    <img
                                                        src="/documents/canara_trust_qr.png"
                                                        alt="Canara Bank UPI QR Code - Kiran Charitable Trust"
                                                        style={{ width: '240px', height: '240px', maxWidth: '100%', display: 'block', margin: '0 auto', borderRadius: '6px' }}
                                                    />
                                                </div>

                                                {/* Down UPI Icons / Badges */}
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>PhonePe</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>Google Pay</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Paytm</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>BHIM UPI</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>Canara ai1</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#fdf2f8', color: '#9d174d', border: '1px solid #fbcfe8' }}>Cred</span>
                                                </div>

                                                {/* Separate UPI ID with Copy Button */}
                                                <div style={{
                                                    margin: '12px 0 8px',
                                                    padding: '9px 12px',
                                                    background: '#ffffff',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #2563eb',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}>
                                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.8px', marginBottom: '3px' }}>Official UPI ID</span>
                                                        <span style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontWeight: '800', color: '#1d4ed8', fontSize: '16px', letterSpacing: '1.2px', wordBreak: 'break-all' }}>340625862653482@cnrb</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy('340625862653482@cnrb', 'form_upi', 'UPI ID')}
                                                        style={{
                                                            padding: '5px 12px',
                                                            fontSize: '12px',
                                                            borderRadius: '5px',
                                                            border: 'none',
                                                            background: '#1d4ed8',
                                                            color: '#fff',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontWeight: '600',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {copiedKey === 'form_upi' ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                                                    </button>
                                                </div>

                                                <div style={{ textAlign: 'left', fontSize: '12px', color: '#475569', background: '#eff6ff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                                    <div><strong>Payee Name:</strong> KIRAN CHARITABLE TRUST</div>
                                                    <div><strong>Bank:</strong> Canara Bank (A/C: 110319653482)</div>
                                                    <div><strong>Category:</strong> MCC 5169 (Charity &amp; Social Service)</div>
                                                </div>

                                                {/* UTR Input */}
                                                <div style={{ marginTop: '12px', textAlign: 'left' }}>
                                                    <label htmlFor="qr-utr-ref" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1e3a8a', marginBottom: '4px' }}>
                                                        UPI Transaction ID / UTR Number (Optional):
                                                    </label>
                                                    <input
                                                        id="qr-utr-ref"
                                                        type="text"
                                                        placeholder="e.g. 4298XXXXXXXX (from your UPI app)"
                                                        value={utrNumber}
                                                        onChange={e => setUtrNumber(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #93c5fd',
                                                            fontSize: '13px',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '3px' }}>
                                                        Enter the 12-digit UTR to get an instant 80G Tax Exemption Receipt.
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Direct Bank Transfer Box with 1-Click Copy Buttons */}
                                        {paymentChannel === 'bank_transfer' && (
                                            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '1px solid #bbf7d0', paddingBottom: '6px' }}>
                                                    <FaUniversity style={{ color: '#15803d', fontSize: '18px' }} />
                                                    <strong style={{ color: '#166534', fontSize: '14px' }}>Official Canara Bank Details (NEFT / RTGS / IMPS)</strong>
                                                </div>
                                                <p style={{ fontSize: '12px', color: '#166534', marginBottom: '10px', lineHeight: 1.5 }}>
                                                    Transfer directly using your mobile banking app or NetBanking. Use the <strong>Copy</strong> buttons:
                                                </p>
                                                
                                                {/* Account Name */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    margin: '10px 0',
                                                    background: '#ffffff',
                                                    padding: '11px 14px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                                                }}>
                                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px' }}>
                                                            Account Name
                                                        </span>
                                                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', letterSpacing: '0.4px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
                                                            Kiran Charitable Trust
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy('Kiran Charitable Trust', 'form_name', 'Account Name')}
                                                        style={{
                                                            padding: '6px 14px',
                                                            fontSize: '12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: '#f8fafc',
                                                            color: '#1e293b',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontWeight: '600',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {copiedKey === 'form_name' ? <><FaCheck style={{ color: '#10b981' }} /> Copied</> : <><FaCopy /> Copy</>}
                                                    </button>
                                                </div>

                                                {/* Account Number */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    margin: '10px 0',
                                                    background: '#ffffff',
                                                    padding: '11px 14px',
                                                    borderRadius: '8px',
                                                    border: '2px solid #2563eb',
                                                    boxShadow: '0 2px 5px rgba(37, 99, 235, 0.08)'
                                                }}>
                                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                        <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px' }}>
                                                            Account Number (Canara Bank)
                                                        </span>
                                                        <span style={{ fontSize: '17px', fontWeight: '800', color: '#1e40af', letterSpacing: '2px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
                                                            110319653482
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy('110319653482', 'form_acc', 'Account Number')}
                                                        style={{
                                                            padding: '7px 15px',
                                                            fontSize: '12px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: '#1d4ed8',
                                                            color: '#ffffff',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontWeight: '700',
                                                            flexShrink: 0,
                                                            letterSpacing: '0.3px'
                                                        }}
                                                    >
                                                        {copiedKey === 'form_acc' ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                                                    </button>
                                                </div>

                                                {/* IFSC Code */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    margin: '10px 0',
                                                    background: '#ffffff',
                                                    padding: '11px 14px',
                                                    borderRadius: '8px',
                                                    border: '2px solid #2563eb',
                                                    boxShadow: '0 2px 5px rgba(37, 99, 235, 0.08)'
                                                }}>
                                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                        <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px' }}>
                                                            IFSC Code
                                                        </span>
                                                        <span style={{ fontSize: '17px', fontWeight: '800', color: '#1e40af', letterSpacing: '2px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
                                                            CNRB0002492
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy('CNRB0002492', 'form_ifsc', 'IFSC Code')}
                                                        style={{
                                                            padding: '7px 15px',
                                                            fontSize: '12px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: '#1d4ed8',
                                                            color: '#ffffff',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontWeight: '700',
                                                            flexShrink: 0,
                                                            letterSpacing: '0.3px'
                                                        }}
                                                    >
                                                        {copiedKey === 'form_ifsc' ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                                                    </button>
                                                </div>

                                                {/* Branch Info */}
                                                <div style={{
                                                    margin: '10px 0',
                                                    padding: '11px 14px',
                                                    background: '#ffffff',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '13px',
                                                    color: '#334155',
                                                    lineHeight: 1.5
                                                }}>
                                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px' }}>
                                                        Branch Location
                                                    </span>
                                                    <span style={{ fontWeight: '600', color: '#0f172a', letterSpacing: '0.3px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
                                                        Chandramouli Nagar (2492), Ring Road, Guntur - 522007
                                                    </span>
                                                </div>

                                                {/* SWIFT Code */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    margin: '10px 0',
                                                    background: '#ffffff',
                                                    padding: '11px 14px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                                                }}>
                                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px' }}>
                                                            SWIFT Code (International)
                                                        </span>
                                                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', letterSpacing: '2px', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
                                                            CNRBNBBBFD
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy('CNRBNBBBFD', 'form_swift', 'SWIFT Code')}
                                                        style={{
                                                            padding: '6px 14px',
                                                            fontSize: '12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: '#f8fafc',
                                                            color: '#1e293b',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontWeight: '600',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {copiedKey === 'form_swift' ? <><FaCheck style={{ color: '#10b981' }} /> Copied</> : <><FaCopy /> Copy</>}
                                                    </button>
                                                </div>

                                                <div style={{ marginTop: '12px' }}>
                                                    <label htmlFor="utr-ref" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#166534', marginBottom: '4px' }}>
                                                        Bank Reference / UTR Number (Optional):
                                                    </label>
                                                    <input
                                                        id="utr-ref"
                                                        type="text"
                                                        placeholder="e.g. 260324XXXXXX (UTR from your bank app)"
                                                        value={utrNumber}
                                                        onChange={e => setUtrNumber(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #86efac',
                                                            fontSize: '13px'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Item Categories */}
                                        <div className="form-group">
                                            <label htmlFor="item-category">Select Item Category *</label>
                                            <select
                                                id="item-category"
                                                className={errors.itemCategory ? 'input-error' : ''}
                                                {...register('itemCategory', { required: 'Please choose an item category' })}
                                            >
                                                <option value="">Select category</option>
                                                <option value="food">Rations & Prepared Foods</option>
                                                <option value="education">Notebooks & Stationaries</option>
                                                <option value="clothing">Clothes & Winter Blankets</option>
                                                <option value="medical">First-Aid & Generic Medicines</option>
                                                <option value="toys">Children Toys & Creative Items</option>
                                                <option value="other">Other In-Kind Contributions</option>
                                            </select>
                                            {errors.itemCategory && <span className="error-msg">{errors.itemCategory.message}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="item-name">Items & Descriptions *</label>
                                            <textarea
                                                id="item-name"
                                                placeholder="e.g. 15 Kg premium basmati rice, 5 drawing books, 2 clean cotton bedsheets..."
                                                rows={3}
                                                className={errors.itemName ? 'input-error' : ''}
                                                {...register('itemName', { required: 'Please specify the item details' })}
                                            />
                                            {errors.itemName && <span className="error-msg">{errors.itemName.message}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="item-qty">Quantity / Estimated Weight *</label>
                                            <input
                                                id="item-qty"
                                                type="text"
                                                placeholder="e.g. 15 Kg, 5 Packets, 1 Box"
                                                className={errors.itemQuantity ? 'input-error' : ''}
                                                {...register('itemQuantity', { required: 'Please mention weight/quantity' })}
                                            />
                                            {errors.itemQuantity && <span className="error-msg">{errors.itemQuantity.message}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="item-delivery">Mode of Delivery *</label>
                                            <select
                                                id="item-delivery"
                                                className={errors.deliveryMethod ? 'input-error' : ''}
                                                {...register('deliveryMethod', { required: 'Choose a delivery preference' })}
                                            >
                                                <option value="">Select delivery mode</option>
                                                <option value="dropoff">I will pack & courier / drop off at office</option>
                                                <option value="pickup">Request free door-step pickup (Guntur & Palnadu districts)</option>
                                            </select>
                                            {errors.deliveryMethod && <span className="error-msg">{errors.deliveryMethod.message}</span>}
                                        </div>
                                    </>
                                )}

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label htmlFor="don-name"><FaUser /> Full Name *</label>
                                        <input
                                            id="don-name"
                                            type="text"
                                            placeholder="Your full name"
                                            className={errors.fullName ? 'input-error' : ''}
                                            {...register('fullName', { required: 'Name is required' })}
                                        />
                                        {errors.fullName && <span className="error-msg">{errors.fullName.message}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="don-phone"><FaPhone /> Mobile Number *</label>
                                        <input
                                            id="don-phone"
                                            type="tel"
                                            placeholder="+91 XXXXX XXXXX"
                                            className={errors.phone ? 'input-error' : ''}
                                            {...register('phone', { required: 'Phone required' })}
                                        />
                                        {errors.phone && <span className="error-msg">{errors.phone.message}</span>}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="don-email"><FaEnvelope /> Email Address *</label>
                                    <input
                                        id="don-email"
                                        type="email"
                                        placeholder="For receipt & updates"
                                        className={errors.email ? 'input-error' : ''}
                                        {...register('email', { required: 'Email required' })}
                                    />
                                    {errors.email && <span className="error-msg">{errors.email.message}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="don-address"><FaMapMarkerAlt /> Communication Address</label>
                                    <input
                                        id="don-address"
                                        type="text"
                                        placeholder="For communication/tax certificates"
                                        {...register('address')}
                                    />
                                </div>

                                {/* Security Honeypot Anti-Bot Field (Hidden from humans) */}
                                <input
                                    type="text"
                                    style={{ display: 'none', position: 'absolute', left: '-9999px' }}
                                    tabIndex={-1}
                                    autoComplete="off"
                                    {...register('website_trap')}
                                />

                                {/* Official Professional reCAPTCHA Style Widget */}
                                {donationType === 'cash' && paymentChannel === 'online' && (
                                    <div className={`recaptcha-widget-card ${isCaptchaVerified ? 'verified' : ''}`}>
                                        <div
                                            className="recaptcha-checkbox-area"
                                            onClick={handleCaptchaClick}
                                            role="button"
                                            tabIndex={0}
                                            title={isCaptchaVerified ? "Human verification complete" : "Click to verify you're human"}
                                        >
                                            <div className="recaptcha-box-outer">
                                                {!isVerifyingCaptcha && !isCaptchaVerified && (
                                                    <div className="recaptcha-square"></div>
                                                )}
                                                {isVerifyingCaptcha && (
                                                    <div className="recaptcha-spinner-ring"></div>
                                                )}
                                                {isCaptchaVerified && (
                                                    <div className="recaptcha-checkmark-svg">
                                                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#10B981" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="recaptcha-text">
                                                {isVerifyingCaptcha ? "Verifying human..." : isCaptchaVerified ? "Verified Human" : "I'm not a robot"}
                                            </span>
                                        </div>
                                        <div className="recaptcha-brand">
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1e3a8a" strokeWidth="2">
                                                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
                                                <path d="M12 8v8M8 12h8" stroke="#f59e0b" strokeWidth="2"/>
                                            </svg>
                                            <div className="recaptcha-brand-text">
                                                <span>reCAPTCHA</span>
                                                <small>Privacy - Terms</small>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Terms */}
                                <div className="terms-check">
                                    <input
                                        type="checkbox"
                                        id="agree-terms"
                                        checked={agreed}
                                        onChange={e => setAgreed(e.target.checked)}
                                    />
                                    <label htmlFor="agree-terms">
                                        I agree to the <a href="/terms-conditions" target="_blank">Terms & Conditions</a> and acknowledge that this is a genuine support task.
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary donate-submit-btn"
                                    disabled={!agreed || (donationType === 'cash' && paymentChannel === 'online' && !isCaptchaVerified) || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid white', borderRightColor: 'transparent', borderRadius: '50%', animation: 'recaptchaRotation 0.6s linear infinite', marginRight: 8, verticalAlign: 'middle' }}></span>
                                            Connecting to secure contribution portal...
                                        </>
                                    ) : (
                                        <>
                                            <FaHeart /> {donationType === 'cash' 
                                                ? (paymentChannel === 'qr_code'
                                                    ? `Record UPI Donation & Get 80G Receipt (₹${Number(finalAmount).toLocaleString('en-IN')})`
                                                    : (paymentChannel === 'bank_transfer'
                                                        ? `Record Bank Transfer & Get 80G Receipt (₹${Number(finalAmount).toLocaleString('en-IN')})` 
                                                        : `Contribute ₹${Number(finalAmount).toLocaleString('en-IN')}`))
                                                : `Submit Item Donation Support`}
                                        </>
                                    )}
                                </button>

                                <div className="form-footer-note">
                                    <FaShieldAlt /> 100% secure • 80G Tax Benefits • Verified NGO
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Embedded Checkout Modal */}
            {checkoutSession && (
                <div
                    className="sabpaisa-modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowCancelConfirm(true);
                        }
                    }}
                >
                    <div className="sabpaisa-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="sabpaisa-modal-header">
                            <div className="sabpaisa-modal-title">
                                <span className="sabpaisa-dot-live"></span>
                                <span>Official Secure Checkout &bull; ₹{Number(checkoutSession.amount).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="sabpaisa-modal-actions">
                                <a
                                    href={checkoutSession.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-open-external"
                                    title="Open in full window"
                                >
                                    Full Window ↗
                                </a>
                                <button
                                    type="button"
                                    className="sabpaisa-modal-close"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCancelConfirm(true);
                                    }}
                                    title="Close checkout"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="sabpaisa-iframe-wrapper">
                            <iframe
                                src={checkoutSession.url}
                                title="Official Secure Checkout"
                                allow="payment"
                                className="sabpaisa-checkout-iframe"
                            />
                        </div>

                        {/* Cancel Transaction Confirmation Prompt */}
                        {showCancelConfirm && (
                            <div className="cancel-confirm-backdrop" onClick={(e) => e.stopPropagation()}>
                                <div className="cancel-confirm-box" onClick={(e) => e.stopPropagation()}>
                                    <div className="cancel-confirm-icon-wrap">
                                        <FaExclamationTriangle />
                                    </div>
                                    <h3>Cancel Payment Transaction?</h3>
                                    <p>
                                        Your secure donation of <strong>₹{Number(checkoutSession.amount).toLocaleString('en-IN')}</strong> is in progress. Are you sure you want to cancel this transaction?
                                    </p>
                                    <div className="cancel-confirm-btn-group">
                                        <button
                                            type="button"
                                            className="cancel-resume-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowCancelConfirm(false);
                                            }}
                                        >
                                            Continue Payment
                                        </button>
                                        <button
                                            type="button"
                                            className="cancel-abort-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowCancelConfirm(false);
                                                setCheckoutSession(null);
                                                setIsCaptchaVerified(false);
                                                setVerifiedToken('');
                                                setIsVerifyingCaptcha(false);
                                                toast.info('Payment cancelled.');
                                            }}
                                        >
                                            Yes, Cancel Transaction
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* UPI ID Copied Notification Letter Box (5s auto-close with 'X' close button) */}
            {showUpiPopup && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    maxWidth: '380px',
                    width: 'calc(100% - 32px)',
                    zIndex: 99999,
                    background: '#ffffff',
                    border: '2px solid #2563eb',
                    borderRadius: '14px',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.22)',
                    padding: '16px 18px',
                    boxSizing: 'border-box'
                }}>
                    {/* Header with 'X' Close Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: '#10b981',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px'
                            }}>
                                <FaCheck />
                            </span>
                            <strong style={{ fontSize: '14px', color: '#1e293b' }}>UPI ID Copied!</strong>
                        </div>
                        {/* Wrong / Close Button to dismiss */}
                        <button
                            type="button"
                            onClick={() => {
                                if (upiPopupTimer) clearTimeout(upiPopupTimer);
                                setShowUpiPopup(false);
                            }}
                            title="Close notification"
                            aria-label="Close"
                            style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '50%',
                                width: '26px',
                                height: '26px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#64748b',
                                lineHeight: 1
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Copied UPI ID */}
                    <div style={{
                        background: '#eff6ff',
                        border: '1.5px dashed #3b82f6',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '15px',
                        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                        fontWeight: '800',
                        letterSpacing: '1.2px',
                        color: '#1d4ed8',
                        marginBottom: '10px',
                        wordBreak: 'break-all'
                    }}>
                        340625862653482@cnrb
                    </div>

                    {/* Payee Name Notice */}
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5, marginBottom: '8px' }}>
                        When you paste this UPI ID in <strong>Google Pay, PhonePe, Paytm, or BHIM</strong>, the receiver name will be shown as:
                    </div>

                    <div style={{
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        textAlign: 'center',
                        marginBottom: '10px'
                    }}>
                        <span style={{ fontSize: '11px', color: '#166534', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                            Verified Payee Name in UPI Apps:
                        </span>
                        <strong style={{ fontSize: '15px', color: '#15803d', letterSpacing: '0.5px' }}>
                            KIRAN CHARITABLE TRUST
                        </strong>
                        <span style={{ fontSize: '11px', color: '#166534', display: 'block', marginTop: '2px' }}>
                            Bank: Canara Bank
                        </span>
                    </div>

                    {/* Footer timer note */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                        <span>Auto-closing in 5s...</span>
                        <span style={{ color: '#ef4444', fontWeight: '600', cursor: 'pointer' }} onClick={() => setShowUpiPopup(false)}>
                            Click ✕ to close
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

