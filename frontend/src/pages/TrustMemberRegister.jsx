import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    FaUserCheck, FaCalendarCheck, FaCamera, FaIdCard, FaCheckCircle,
    FaHeart, FaLock, FaEnvelope, FaPhone, FaMapMarkerAlt, FaArrowRight
} from 'react-icons/fa';
import './TrustMemberRegister.css';

const TIERS = [
    { id: 'test', name: 'Test Patron (₹2)', amount: 2, desc: 'Live ₹2 testing tier for verification' },
    { id: 'starter', name: 'Starter Patron', amount: 500, desc: 'Supports daily nutritious meals' },
    { id: 'silver', name: 'Silver Patron', amount: 1000, desc: 'Sponsors school kits & medicine' },
    { id: 'gold', name: 'Gold Patron', amount: 2500, desc: 'Provides comprehensive elder care' },
    { id: 'custom', name: 'Custom Contribution', amount: 5000, desc: 'Tailored humanitarian impact' }
];

export default function TrustMemberRegister() {
    const { user, isAuthenticated, openAuthModal, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [selectedTier, setSelectedTier] = useState('test');
    const [customAmount, setCustomAmount] = useState('5000');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [aadharNumber, setAadharNumber] = useState('');
    const [panNumber, setPanNumber] = useState('');
    const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registeredMember, setRegisteredMember] = useState(null);

    // Auto-fill from logged-in user
    useEffect(() => {
        if (user) {
            if (user.name) setName(user.name);
            if (user.email) setEmail(user.email);
            if (user.phone) setPhone(user.phone);
        }
    }, [user]);

    // Format Aadhaar: 12 digits with spaces (XXXX XXXX XXXX)
    const handleAadharChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
        const parts = [];
        for (let i = 0; i < raw.length; i += 4) {
            parts.push(raw.slice(i, i + 4));
        }
        setAadharNumber(parts.join(' '));
    };

    const handlePanChange = (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        setPanNumber(val);
    };

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 6 * 1024 * 1024) {
                toast.error('Profile photo must be under 6MB');
                return;
            }
            setProfilePhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const activeAmount = selectedTier === 'custom' ? Number(customAmount) || 500 : (TIERS.find(t => t.id === selectedTier)?.amount || 500);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanAadhar = aadharNumber.replace(/\s/g, '');
        if (cleanAadhar.length !== 12) {
            toast.error('Please enter a valid 12-digit Aadhaar number');
            return;
        }

        if (!name || !email || !phone || !address) {
            toast.error('Please fill all required personal details');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('phone', phone);
            formData.append('address', address);
            formData.append('aadharNumber', cleanAadhar);
            formData.append('panNumber', panNumber.toUpperCase().trim());
            formData.append('donationAmount', activeAmount);
            formData.append('subscriptionTier', TIERS.find(t => t.id === selectedTier)?.name || 'Patron');
            formData.append('showOnLeaderboard', showOnLeaderboard);

            if (profilePhotoFile) {
                formData.append('profilePhoto', profilePhotoFile);
            }

            const response = await axios.post(`${API_BASE_URL}/trust-members/register`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data?.success) {
                setRegisteredMember(response.data.member);
                toast.success('Registration successful! Welcome as an Honored Trust Member.');
                if (refreshUser) refreshUser();
            } else {
                toast.error(response.data?.message || 'Registration failed');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Server error during registration';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="tm-register-page">
            <ToastContainer />

            <div className="tm-hero">
                <div className="tm-hero-badge">
                    <FaUserCheck /> Official Trust Member Enrollment
                </div>
                <h1>Join as an Honored Trust Member</h1>
                <p>
                    Become a sustained pillar of Kiran Charitable Trust. Empower children, seniors, and rural families across Guntur & Palnadu with monthly giving.
                </p>
            </div>

            <div className="tm-content-wrap">
                <div className="tm-card">
                    <div className="tm-card-header">
                        <h3>Trust Membership & Monthly Giving Plan</h3>
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                            Step 2 of 2 • Member Enrollment
                        </span>
                    </div>

                    <div className="tm-body">
                        {registeredMember ? (
                            <div className="tm-success-wrap">
                                <FaCheckCircle className="tm-success-icon" />
                                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                                    Welcome, {registeredMember.name}!
                                </h2>
                                <p style={{ fontSize: 15, color: '#475569', maxWidth: 520, margin: '0 auto 16px' }}>
                                    Your enrollment as an Official Trust Member is confirmed. Your profile photo and name are now scheduled for our Top Donors Marquee!
                                </p>

                                <div>
                                    <span style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Assigned Member ID
                                    </span>
                                    <div className="tm-success-id">
                                        {registeredMember.memberId || 'KCT-MEM-1001'}
                                    </div>
                                </div>

                                <div className="tm-schedule-banner" style={{ textAlign: 'left', maxWidth: 550, margin: '0 auto 28px' }}>
                                    <FaCalendarCheck />
                                    <div>
                                        <h4>First Monthly Donation Scheduled After 1 Month</h4>
                                        <p>
                                            Your monthly pledge of <strong>₹{registeredMember.donationAmount || activeAmount}</strong> is scheduled for{' '}
                                            <strong>
                                                {new Date(registeredMember.nextPaymentDueDate || Date.now() + 30 * 86400000).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </strong>.
                                            You will receive an automated email reminder with a direct 1-click payment link.
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <Link to="/dashboard" className="btn btn-primary" style={{ padding: '14px 28px' }}>
                                        Go to Member Dashboard <FaArrowRight />
                                    </Link>
                                    <Link
                                        to={`/donate?amount=${registeredMember.donationAmount || activeAmount}&purpose=Initial+Trust+Member+Contribution&email=${encodeURIComponent(registeredMember.email)}&name=${encodeURIComponent(registeredMember.name)}`}
                                        className="btn btn-outline"
                                        style={{ padding: '14px 28px' }}
                                    >
                                        <FaHeart style={{ color: '#ef4444' }} /> Donate Initial Amount Now (Optional)
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {/* Step 1: Select Monthly Plan */}
                                <div>
                                    <label style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                                        1. Select Your Monthly Subscription Pledge *
                                    </label>
                                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 12px' }}>
                                        Recurring patrons empower reliable food distributions and health clinics. Choose a tier or customize.
                                    </p>

                                    <div className="tm-tiers-grid">
                                        {TIERS.map(tier => (
                                            <div
                                                key={tier.id}
                                                className={`tm-tier-btn ${selectedTier === tier.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedTier(tier.id)}
                                            >
                                                <div className="tm-tier-tag">{tier.name}</div>
                                                <div className="tm-tier-amount">₹{tier.amount}</div>
                                                <div className="tm-tier-period">per month</div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.3 }}>
                                                    {tier.desc}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedTier === 'custom' && (
                                        <div style={{ maxWidth: 300, marginBottom: 20 }}>
                                            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                                                Enter Custom Monthly Amount (₹) *
                                            </label>
                                            <input
                                                type="number"
                                                min="2"
                                                step="100"
                                                value={customAmount}
                                                onChange={e => setCustomAmount(e.target.value)}
                                                className="tm-input"
                                                placeholder="e.g. 5000"
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* 1 Month Grace Period Alert */}
                                    <div className="tm-schedule-banner">
                                        <FaCalendarCheck />
                                        <div>
                                            <h4>Payment Starts After 1 Month</h4>
                                            <p>
                                                As a valued Trust Member, your first monthly contribution of <strong>₹{activeAmount}</strong> will be due exactly <strong>1 month from today</strong>. You will receive an automated email reminder with a direct 1-click payment link.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Member Details */}
                                <div style={{ marginTop: 24 }}>
                                    <label style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12, display: 'block' }}>
                                        2. Member Information & Verification
                                    </label>

                                    <div className="tm-form-grid">
                                        <div className="tm-field">
                                            <label><FaIdCard /> Full Name (As per records) *</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="e.g. K. Srinivas Rao"
                                                className="tm-input"
                                                required
                                            />
                                        </div>

                                        <div className="tm-field">
                                            <label><FaEnvelope /> Email Address *</label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="yourname@gmail.com"
                                                className="tm-input"
                                                required
                                            />
                                        </div>

                                        <div className="tm-field">
                                            <label><FaPhone /> Mobile Number (WhatsApp) *</label>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                placeholder="+91 XXXXX XXXXX"
                                                className="tm-input"
                                                required
                                            />
                                        </div>

                                        <div className="tm-field">
                                            <label><FaIdCard /> Aadhaar Number (12 Digits) *</label>
                                            <input
                                                type="text"
                                                value={aadharNumber}
                                                onChange={handleAadharChange}
                                                placeholder="XXXX XXXX XXXX"
                                                className="tm-input"
                                                maxLength={14}
                                                required
                                            />
                                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                                                Record entry only • No verification / OTP needed
                                            </span>
                                        </div>

                                        <div className="tm-field">
                                            <label><FaIdCard /> PAN Card Number (Optional)</label>
                                            <input
                                                type="text"
                                                value={panNumber}
                                                onChange={handlePanChange}
                                                placeholder="e.g. ABCDE1234F"
                                                className="tm-input"
                                                maxLength={10}
                                            />
                                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                                                Optional • For 80G tax exemption receipts
                                            </span>
                                        </div>

                                        <div className="tm-field full">
                                            <label><FaMapMarkerAlt /> Complete Residential Address *</label>
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={e => setAddress(e.target.value)}
                                                placeholder="Door No, Street, City / Village, District, Pincode"
                                                className="tm-input"
                                                required
                                            />
                                        </div>

                                        {/* Profile Photo Upload */}
                                        <div className="tm-field full">
                                            <label><FaCamera /> Profile Photo (For Donor Marquee & ID Card)</label>
                                            <div
                                                className="tm-photo-upload-box"
                                                onClick={() => document.getElementById('photoInput').click()}
                                            >
                                                {photoPreview ? (
                                                    <img src={photoPreview} alt="Preview" className="tm-photo-preview" />
                                                ) : (
                                                    <div style={{ fontSize: 32, color: '#94a3b8', marginBottom: 8 }}>
                                                        <FaCamera />
                                                    </div>
                                                )}
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>
                                                    {photoPreview ? 'Change Selected Photo' : 'Click to Upload Profile Photo'}
                                                </span>
                                                <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                                                    Stored securely on Cloudflare R2 • JPG, PNG or WebP up to 6MB
                                                </p>
                                                <input
                                                    id="photoInput"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoSelect}
                                                    style={{ display: 'none' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Leaderboard Marquee Toggle */}
                                        <div className="tm-field full" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '12px 16px', borderRadius: 10 }}>
                                            <input
                                                type="checkbox"
                                                id="leaderboardToggle"
                                                checked={showOnLeaderboard}
                                                onChange={e => setShowOnLeaderboard(e.target.checked)}
                                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                                            />
                                            <label htmlFor="leaderboardToggle" style={{ margin: 0, cursor: 'pointer', fontSize: 13.5, color: '#334155' }}>
                                                <strong>Display my photo & name on the Live Donor Marquee</strong> to inspire others in the community.
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="tm-submit-btn"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Registering...' : (
                                        <>Complete Trust Member Registration <FaArrowRight /></>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
