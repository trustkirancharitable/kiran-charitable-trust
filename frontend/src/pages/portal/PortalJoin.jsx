import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { initiateGoogleSignIn } from '../../utils/googleAuth';
import './Portal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TIERS = [
  { id: 'starter', icon: '🥉', label: 'Starter Patron', price: 500,  desc: 'Official digital ID card, certificate & monthly newsletter' },
  { id: 'silver',  icon: '🥈', label: 'Silver Patron',  price: 1000, desc: 'Silver privileges, quarterly impact reports & member directory listing' },
  { id: 'gold',    icon: '🥇', label: 'Gold Patron',    price: 2500, desc: 'All Silver perks + annual summit invitation', featured: true },
  { id: 'diamond', icon: '💎', label: 'Diamond Patron', price: 5000, desc: 'VIP Council invitation + direct program governance & review' },
];

export default function PortalJoin() {
  const [step, setStep] = useState(1); // 1: Auth, 2: Profile Details, 3: Review & Payment, 4: Active Member
  const [authMode, setAuthMode] = useState('otp'); // 'otp' | 'verify'
  const [form, setForm] = useState({
    email: '',
    otp: '',
    name: '',
    phone: '',
    address: '',
    aadharNumber: '',
    panNumber: '',
    amount: 500,
    tier: 'starter',
    profilePhoto: null,
    photoPreview: null,
  });

  const [loading, setLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [authToken, setAuthToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [memberId, setMemberId] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedTier = TIERS.find(t => t.id === form.tier) || TIERS[0];

  async function sendOtp() {
    if (!form.email || !form.email.includes('@')) {
      return setError('Please enter a valid email address.');
    }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, type: 'trust_member_register' }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpCountdown(60);
        setSuccess(`Verification code sent to ${form.email}`);
        setAuthMode('verify');
        if (data.devOtp) console.log('[DEV CODE]:', data.devOtp);
      } else {
        setError(data.message || 'Failed to send OTP code.');
      }
    } catch {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  }

  async function verifyOtp() {
    if (!form.otp || form.otp.length !== 6) {
      return setError('Enter the 6-digit verification code.');
    }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp: form.otp, type: 'trust_member_register' }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthToken(data.token || '');
        setStep(2);
        setError(''); setSuccess('');
      } else {
        setError(data.message || 'Invalid code.');
      }
    } catch {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    set('profilePhoto', file);
    const reader = new FileReader();
    reader.onload = ev => set('photoPreview', ev.target.result);
    reader.readAsDataURL(file);
  }

  function handleProfileSubmit(e) {
    e.preventDefault();
    const cleanAadhar = form.aadharNumber.replace(/\D/g, '');
    if (!form.name.trim()) return setError('Full name is required.');
    if (!form.phone || form.phone.replace(/\D/g, '').length < 10) return setError('Enter a valid 10-digit phone number.');
    if (!form.address.trim()) return setError('Residential address is required.');
    if (cleanAadhar.length !== 12) return setError('Please enter a 12-digit Aadhaar number.');
    setError(''); setStep(3);
  }

  async function processMembershipPayment() {
    setError(''); setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('address', form.address);
      fd.append('aadharNumber', form.aadharNumber.replace(/\D/g, ''));
      fd.append('panNumber', form.panNumber || '');
      fd.append('donationAmount', form.amount);
      fd.append('subscriptionTier', selectedTier.label + ` (₹${form.amount}/mo)`);
      if (form.profilePhoto) fd.append('profilePhoto', form.profilePhoto);

      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`${API}/api/trust-members/register`, { method: 'POST', headers, body: fd });
      const data = await res.json();

      if (data.success) {
        setMemberId(data.member?.memberId || data.member?.member_id || 'KCT-MEM-1048');
        setStep(4);
      } else {
        setError(data.message || 'Payment initiation failed. Please try again.');
      }
    } catch {
      setError('Network error processing payment. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div>
      {/* ── Banner ── */}
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Become a Member</span>
        <h1 className="pt-page-heading">
          Join as an Official <span>Trust Member</span>
        </h1>
        <p className="pt-page-sub">
          Complete your registration, submit your details, and activate your monthly subscription to be officially recognized as a Kiran Charitable Trust Member.
        </p>
      </section>

      {/* ── Main Join Container ── */}
      <div className="pt-container">
        <div className="pt-join-layout">
          {/* Form Card */}
          <div className="pt-join-form-card">
            {/* Stepper */}
            <div className="pt-stepper">
              {['1. Authentication', '2. Member Details', '3. Payment', '4. Membership ID'].map((label, idx) => (
                <div key={idx} className={`pt-step-item ${step > idx + 1 ? 'done' : step === idx + 1 ? 'active' : ''}`}>
                  <div className="pt-step-circle">{step > idx + 1 ? '✓' : idx + 1}</div>
                  <span className="pt-step-label">{label}</span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                ⚠ {error}
              </div>
            )}

            {success && step === 1 && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                ✓ {success}
              </div>
            )}

            {/* ── STEP 1: Email / OAuth Authentication ── */}
            {step === 1 && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
                  Step 1: Sign In or Register
                </h3>
                <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Enter your email address to receive a secure 6-digit login code.
                </p>

                <div className="pt-form-group">
                  <label className="pt-label">Email Address <span className="star">*</span></label>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <input
                      type="email"
                      className="pt-input"
                      placeholder="yourname@domain.com"
                      value={form.email}
                      disabled={authMode === 'verify'}
                      onChange={e => { set('email', e.target.value); setAuthMode('otp'); }}
                    />
                    {authMode !== 'verify' && (
                      <button
                        type="button"
                        onClick={sendOtp}
                        disabled={loading}
                        style={{
                          background: 'var(--pt-primary-soft)',
                          border: '1.5px solid rgba(15, 82, 186, 0.3)',
                          color: 'var(--pt-primary)',
                          fontWeight: 700,
                          padding: '0 1.25rem',
                          borderRadius: 10,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {loading ? 'Sending...' : 'Send OTP'}
                      </button>
                    )}
                  </div>
                </div>

                {authMode === 'verify' && (
                  <div className="pt-form-group">
                    <label className="pt-label">Enter 6-Digit Code <span className="star">*</span></label>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <input
                        type="text"
                        maxLength={6}
                        className="pt-input"
                        placeholder="••••••"
                        style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.15rem' }}
                        value={form.otp}
                        onChange={e => set('otp', e.target.value.replace(/\D/g, ''))}
                      />
                      <button
                        type="button"
                        onClick={sendOtp}
                        disabled={otpCountdown > 0 || loading}
                        style={{
                          background: 'var(--pt-bg-light)',
                          border: '1.5px solid var(--pt-border)',
                          color: 'var(--pt-text-gray)',
                          fontWeight: 700,
                          padding: '0 1rem',
                          borderRadius: 10,
                          cursor: 'pointer'
                        }}
                      >
                        {otpCountdown > 0 ? `${otpCountdown}s` : 'Resend'}
                      </button>
                    </div>

                    <button type="button" className="pt-btn-primary" onClick={verifyOtp} disabled={loading} style={{ marginTop: '1.25rem' }}>
                      {loading ? 'Verifying...' : 'Verify Code & Proceed to Details →'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.75rem 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--pt-border)' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)', fontWeight: 600 }}>OR SIGN IN WITH</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--pt-border)' }} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    initiateGoogleSignIn({
                      onSuccess: (profile) => {
                        if (profile.email) {
                          setForm(prev => ({
                            ...prev,
                            email: profile.email,
                            name: profile.name || prev.name,
                            photoPreview: profile.picture || prev.photoPreview
                          }));
                          setStep(2);
                        } else if (profile.credential) {
                          fetch(`${API}/api/auth/google`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ credential: profile.credential })
                          })
                            .then(r => r.json())
                            .then(res => {
                              if (res.success && res.user) {
                                setForm(prev => ({
                                  ...prev,
                                  email: res.user.email,
                                  name: res.user.name || prev.name
                                }));
                                setStep(2);
                              }
                            })
                            .catch(() => setStep(2));
                        }
                      },
                      onError: (err) => setError(err)
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    background: '#FFFFFF',
                    border: '1.5px solid var(--pt-border-strong)',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    color: 'var(--pt-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13 17.7 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z" />
                    <path fill="#FBBC05" d="M10.4 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.9-4.6l-7.8-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6.1z"/>
                    <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.4-5.7c-2.1 1.4-4.8 2.3-8.2 2.3-6.3 0-11.7-3.5-13.6-8.6l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
                  </svg>
                  Continue with Google Account
                </button>
              </div>
            )}

            {/* ── STEP 2: Profile Details ── */}
            {step === 2 && (
              <form onSubmit={handleProfileSubmit}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
                  Step 2: Profile & Verification Information
                </h3>
                <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Provide your official details. Aadhaar is required; PAN is optional.
                </p>

                {/* Profile Photo */}
                <div className="pt-form-group">
                  <label className="pt-label">Profile Photo <span className="optional">(Optional)</span></label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.9rem',
                      background: 'var(--pt-bg-light)',
                      border: '1.5px dashed var(--pt-border-strong)',
                      borderRadius: 10,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#E2E8F0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                      {form.photoPreview ? <img src={form.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📷'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{form.photoPreview ? 'Photo selected ✓' : 'Upload your photo'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)' }}>Shown on your official digital ID card</div>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                </div>

                <div className="pt-input-grid">
                  <div className="pt-form-group">
                    <label className="pt-label">Full Name <span className="star">*</span></label>
                    <input
                      type="text"
                      className="pt-input"
                      placeholder="As per Government ID"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                    />
                  </div>
                  <div className="pt-form-group">
                    <label className="pt-label">Mobile Number <span className="star">*</span></label>
                    <input
                      type="tel"
                      className="pt-input"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-form-group">
                  <label className="pt-label">Residential Address <span className="star">*</span></label>
                  <input
                    type="text"
                    className="pt-input"
                    placeholder="House/Street, Village/City, District, State, PIN"
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                  />
                </div>

                <div className="pt-input-grid">
                  <div className="pt-form-group">
                    <label className="pt-label">Aadhaar Number <span className="star">*</span></label>
                    <input
                      type="text"
                      maxLength={14}
                      className="pt-input"
                      placeholder="XXXX XXXX XXXX"
                      value={form.aadharNumber}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 12);
                        v = v.replace(/(\d{4})(\d{4})?(\d{4})?/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
                        set('aadharNumber', v);
                      }}
                    />
                  </div>
                  <div className="pt-form-group">
                    <label className="pt-label">PAN Card Number <span className="optional">(Optional)</span></label>
                    <input
                      type="text"
                      maxLength={10}
                      className="pt-input"
                      placeholder="ABCDE1234F"
                      value={form.panNumber}
                      onChange={e => set('panNumber', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* Tier Selection */}
                <div className="pt-form-group">
                  <label className="pt-label">Choose Patron Tier <span className="star">*</span></label>
                  <div className="pt-tier-selection">
                    {TIERS.map(t => (
                      <div
                        key={t.id}
                        className={`pt-tier-option ${form.tier === t.id ? 'selected' : ''}`}
                        onClick={() => { set('tier', t.id); set('amount', t.price); }}
                      >
                        <div className="pt-tier-price">{t.icon} ₹{t.price.toLocaleString('en-IN')}</div>
                        <div className="pt-tier-title">{t.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-form-group">
                  <label className="pt-label">Monthly Contribution (₹) <span className="star">*</span></label>
                  <input
                    type="number"
                    min="500"
                    className="pt-input"
                    value={form.amount}
                    onChange={e => set('amount', Math.max(500, Number(e.target.value)))}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)', marginTop: 4, display: 'block' }}>
                    Minimum ₹500/month recurring contribution. Eligible for 80G tax benefit receipt.
                  </span>
                </div>

                <button type="submit" className="pt-btn-primary">
                  Review & Proceed to Payment →
                </button>
              </form>
            )}

            {/* ── STEP 3: Review & Payment ── */}
            {step === 3 && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
                  Step 3: Review & Payment Confirmation
                </h3>
                <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Verify your profile details and confirm your first monthly contribution online.
                </p>

                <div style={{ background: 'var(--pt-bg-light)', border: '1.5px solid var(--pt-border)', borderRadius: 12, padding: '1.4rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--pt-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--pt-primary)' }}>
                      {form.photoPreview ? <img src={form.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '👤'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--pt-secondary)' }}>{form.name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--pt-text-gray)' }}>{form.email}</div>
                    </div>
                  </div>

                  {[
                    ['Mobile Number', form.phone],
                    ['Address', form.address],
                    ['Aadhaar Number', `•••• ${form.aadharNumber.replace(/\s/g, '').slice(-4)}`],
                    form.panNumber ? ['PAN Card', form.panNumber] : null,
                    ['Membership Tier', `${selectedTier.icon} ${selectedTier.label}`],
                    ['Contribution Frequency', 'Monthly Recurring'],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--pt-text-gray)' }}>{label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--pt-secondary)' }}>{value}</span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--pt-secondary)' }}>Initial Month Payment:</span>
                    <span style={{ fontWeight: 900, color: 'var(--pt-primary)', fontSize: '1.35rem' }}>
                      ₹{Number(form.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="pt-btn-primary"
                  onClick={processMembershipPayment}
                  disabled={loading}
                >
                  {loading ? 'Processing contribution...' : `Contribute ₹${Number(form.amount).toLocaleString('en-IN')} & Join as Member`}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%',
                    marginTop: '0.8rem',
                    background: 'transparent',
                    border: '1.5px solid var(--pt-border)',
                    padding: '0.8rem',
                    borderRadius: 10,
                    fontWeight: 700,
                    color: 'var(--pt-text-gray)',
                    cursor: 'pointer'
                  }}
                >
                  ← Edit Information
                </button>
              </div>
            )}

            {/* ── STEP 4: Success & Official ID Card ── */}
            {step === 4 && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--pt-primary), var(--pt-primary-light))', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 1.5rem', boxShadow: '0 8px 25px rgba(15, 82, 186, 0.3)' }}>
                  ✓
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.5rem' }}>
                  Congratulations, Trust Member!
                </h2>
                <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.95rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
                  Your subscription payment succeeded and your account has been officially registered as a Kiran Charitable Trust Member.
                </p>

                <div style={{ background: 'var(--pt-primary-soft)', border: '1.5px solid rgba(15, 82, 186, 0.25)', borderRadius: 12, padding: '1.4rem', maxWidth: 360, margin: '0 auto 1.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pt-primary)' }}>
                    Official Member ID
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--pt-primary)', margin: '0.4rem 0' }}>
                    {memberId}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--pt-secondary)', fontWeight: 700 }}>
                    {form.name} • {selectedTier.label}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to="/portal/members" className="pt-btn-cta" style={{ textDecoration: 'none' }}>
                    👥 View Trust Members Directory
                  </Link>
                  <Link to="/portal" style={{ padding: '0.6rem 1.4rem', borderRadius: 50, border: '1.5px solid var(--pt-border)', color: 'var(--pt-secondary)', textDecoration: 'none', fontWeight: 700 }}>
                    Portal Home
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Perks & Benefits Sidebar */}
          <div className="pt-join-perks-box">
            <h3>✦ Member Privileges & Impact</h3>
            <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Your recurring contribution guarantees consistent funding for our grassroots community initiatives in Amaravathi and Palnadu.
            </p>

            <div className="pt-perk-item">
              <span className="pt-perk-check">✓</span>
              <div>
                <strong>Official Membership ID & Certificate</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--pt-text-light)', margin: '2px 0 0' }}>Verified registration under Regd. No. 462/2004</p>
              </div>
            </div>

            <div className="pt-perk-item">
              <span className="pt-perk-check">✓</span>
              <div>
                <strong>80G Income Tax Exemption</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--pt-text-light)', margin: '2px 0 0' }}>Tax deductible receipts dispatched for all monthly payments</p>
              </div>
            </div>

            <div className="pt-perk-item">
              <span className="pt-perk-check">✓</span>
              <div>
                <strong>Featured on Public Member Wall</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--pt-text-light)', margin: '2px 0 0' }}>Recognized on our official online Trust Member directory</p>
              </div>
            </div>

            <div className="pt-perk-item">
              <span className="pt-perk-check">✓</span>
              <div>
                <strong>Quarterly Transparency Reports</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--pt-text-light)', margin: '2px 0 0' }}>Full audit breakdown of fund allocation across causes</p>
              </div>
            </div>

            <div className="pt-perk-item">
              <span className="pt-perk-check">✓</span>
              <div>
                <strong>Ground Program Invitations</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--pt-text-light)', margin: '2px 0 0' }}>Special invitations to annual celebrations & distribution drives</p>
              </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#FFFFFF', borderRadius: 10, border: '1px solid var(--pt-border)' }}>
              <div style={{ fontWeight: 800, color: 'var(--pt-secondary)', fontSize: '0.88rem' }}>🔒 Secure Gateway</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)', marginTop: '4px' }}>
                All contributions processed with 256-bit SSL encryption.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
