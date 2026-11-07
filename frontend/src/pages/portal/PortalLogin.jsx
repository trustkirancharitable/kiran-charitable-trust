import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initiateGoogleSignIn } from '../../utils/googleAuth';
import './Portal.css';

export default function PortalLogin() {
  const navigate = useNavigate();
  const { loginWithPassword, sendOtp, verifyOtp, loginWithGoogle, user, isAuthenticated } = useAuth();

  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (isAuthenticated && user) {
    return (
      <div>
        <section className="pt-page-banner">
          <span className="pt-page-tag">✦ Account Session Active</span>
          <h1 className="pt-page-heading">Welcome, <span>{user.name}</span></h1>
          <p className="pt-page-sub">You are currently signed in as {user.email}.</p>
          <div style={{ marginTop: '2rem' }}>
            <button className="pt-btn-cta" onClick={() => navigate('/portal/profile')}>
              👤 Go to My Account & Profile →
            </button>
          </div>
        </section>
      </div>
    );
  }

  async function handlePasswordLogin(e) {
    e.preventDefault();
    if (!email || !password) return setError('Please enter both email and password.');
    setError(''); setSuccess(''); setLoading(true);

    const res = await loginWithPassword({ email, password });
    if (res.success) {
      if (res.user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/portal/profile');
      }
    } else {
      setError(res.message || 'Login failed.');
    }
    setLoading(false);
  }

  async function handleSendOtp() {
    if (!email || !email.includes('@')) return setError('Please enter a valid email address.');
    setError(''); setSuccess(''); setLoading(true);

    const res = await sendOtp(email);
    if (res.success) {
      setOtpSent(true);
      setSuccess(`Verification code sent to ${email}`);
      setOtpCountdown(60);
      const timer = setInterval(() => {
        setOtpCountdown(c => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      setError(res.message || 'Failed to send OTP.');
    }
    setLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp || otp.length !== 6) return setError('Please enter the 6-digit verification code.');
    setError(''); setSuccess(''); setLoading(true);

    const res = await verifyOtp({ email, otp });
    if (res.success) {
      if (res.user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/portal/profile');
      }
    } else {
      setError(res.message || 'Verification failed.');
    }
    setLoading(false);
  }

  return (
    <div>
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Secure Access</span>
        <h1 className="pt-page-heading">
          Supporter & Member <span>Sign In</span>
        </h1>
        <p className="pt-page-sub">
          Access your official Trust Member standing, track donation receipts, and manage your patron profile.
        </p>
      </section>

      <div className="pt-container">
        <div className="pt-auth-card">
          {/* Mode Switcher */}
          <div className="pt-auth-switch">
            <button
              className={`pt-auth-tab ${mode === 'password' ? 'active' : ''}`}
              onClick={() => { setMode('password'); setError(''); setSuccess(''); }}
            >
              🔑 Password Login
            </button>
            <button
              className={`pt-auth-tab ${mode === 'otp' ? 'active' : ''}`}
              onClick={() => { setMode('otp'); setError(''); setSuccess(''); }}
            >
              📱 Instant OTP
            </button>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', color: '#991B1B', padding: '0.85rem', borderRadius: 10, fontSize: '0.88rem', marginBottom: '1.25rem', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#ECFDF5', border: '1.5px solid #6EE7B7', color: '#065F46', padding: '0.85rem', borderRadius: 10, fontSize: '0.88rem', marginBottom: '1.25rem', fontWeight: 600 }}>
              ✓ {success}
            </div>
          )}

          {/* Mode 1: Password Login Form */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin}>
              <div className="pt-form-group">
                <label className="pt-label">Email Address <span className="star">*</span></label>
                <input
                  type="email"
                  className="pt-input"
                  placeholder="yourname@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="pt-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label className="pt-label" style={{ margin: 0 }}>Password <span className="star">*</span></label>
                  <Link to="/portal/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--pt-primary)', fontWeight: 700, textDecoration: 'none' }}>
                    Forgot Password?
                  </Link>
                </div>
                <input
                  type="password"
                  className="pt-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="pt-btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
                {loading ? 'Authenticating...' : 'Sign In with Password →'}
              </button>
            </form>
          )}

          {/* Mode 2: OTP Login Form */}
          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <div className="pt-form-group">
                <label className="pt-label">Email Address <span className="star">*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="email"
                    className="pt-input"
                    placeholder="yourname@domain.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setOtpSent(false); }}
                    required
                  />
                  {!otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      style={{
                        padding: '0 1.25rem',
                        background: 'var(--pt-primary-soft)',
                        border: '1.5px solid rgba(15, 82, 186, 0.25)',
                        color: 'var(--pt-primary)',
                        borderRadius: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {loading ? 'Sending...' : 'Send OTP'}
                    </button>
                  )}
                </div>
              </div>

              {otpSent && (
                <div className="pt-form-group">
                  <label className="pt-label">Enter 6-Digit Code <span className="star">*</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      maxLength={6}
                      className="pt-input"
                      placeholder="••••••"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.15rem' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpCountdown > 0 || loading}
                      style={{
                        padding: '0 1rem',
                        background: 'var(--pt-bg-light)',
                        border: '1.5px solid var(--pt-border)',
                        color: 'var(--pt-text-gray)',
                        borderRadius: 10,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {otpCountdown > 0 ? `${otpCountdown}s` : 'Resend'}
                    </button>
                  </div>

                  <button type="submit" className="pt-btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
                    {loading ? 'Verifying Code...' : 'Verify Code & Sign In →'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Alternative Google Sign In */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.75rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--pt-border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--pt-text-light)', fontWeight: 700, textTransform: 'uppercase' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--pt-border)' }} />
          </div>

          <button
            type="button"
            onClick={() => {
              initiateGoogleSignIn({
                onSuccess: async (profile) => {
                  let payload = {};
                  if (profile.credential) {
                    payload = { credential: profile.credential };
                  } else {
                    payload = {
                      email: profile.email,
                      name: profile.name,
                      avatar: profile.picture,
                      googleId: profile.sub
                    };
                  }
                  setLoading(true);
                  const res = await loginWithGoogle(payload);
                  setLoading(false);
                  if (res?.success) {
                    navigate('/portal/profile');
                  } else {
                    setError(res?.message || 'Google sign-in failed.');
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
              borderRadius: 12,
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
            Continue with Google
          </button>

          {/* Footer Link */}
          <div className="pt-auth-footer">
            Don't have an account yet?{' '}
            <Link to="/portal/signup">Create New Supporter Account →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
