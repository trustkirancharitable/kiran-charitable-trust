import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Portal.css';

export default function PortalForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword } = useAuth();

  const [step, setStep] = useState(1); // 1: Request OTP, 2: Reset with OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

  async function handleRequestOtp(e) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      return setError('Please enter a valid email address.');
    }
    setError(''); setSuccess(''); setLoading(true);

    const res = await forgotPassword(email);
    if (res.success) {
      setStep(2);
      setSuccess(`A 6-digit verification code has been dispatched to ${email}`);
      if (res.devOtp) setDevOtpHint(res.devOtp);
    } else {
      setError(res.message || 'Failed to send reset code.');
    }
    setLoading(false);
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      return setError('Enter the 6-digit verification code.');
    }
    if (newPassword.length < 6) {
      return setError('New password must be at least 6 characters long.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match. Please re-enter.');
    }

    setError(''); setSuccess(''); setLoading(true);

    const res = await resetPassword({ email, otp, newPassword });
    if (res.success) {
      setSuccess('Your password has been successfully reset! You can now log in.');
      setTimeout(() => {
        navigate('/portal/login');
      }, 1500);
    } else {
      setError(res.message || 'Failed to reset password. Please check your verification code.');
    }
    setLoading(false);
  }

  return (
    <div>
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Account Recovery</span>
        <h1 className="pt-page-heading">
          Forgot Your <span>Password?</span>
        </h1>
        <p className="pt-page-sub">
          Verify your email address to receive a secure recovery code and reset your password.
        </p>
      </section>

      <div className="pt-container">
        <div className="pt-auth-card">
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

          {devOtpHint && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', marginBottom: '1rem' }}>
              💡 Quick-Test OTP: <strong>{devOtpHint}</strong>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <div className="pt-form-group">
                <label className="pt-label">Enter Registered Email <span className="star">*</span></label>
                <input
                  type="email"
                  className="pt-input"
                  placeholder="yourname@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)', marginTop: 4, display: 'block' }}>
                  We will send a 6-digit recovery OTP to this email address.
                </span>
              </div>

              <button type="submit" className="pt-btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
                {loading ? 'Sending Verification Code...' : 'Send Recovery Code →'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword}>
              <div className="pt-form-group">
                <label className="pt-label">Enter 6-Digit Code <span className="star">*</span></label>
                <input
                  type="text"
                  maxLength={6}
                  className="pt-input"
                  placeholder="••••••"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.2rem' }}
                  required
                />
              </div>

              <div className="pt-form-group">
                <label className="pt-label">New Password <span className="star">*</span></label>
                <input
                  type="password"
                  className="pt-input"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-form-group">
                <label className="pt-label">Confirm New Password <span className="star">*</span></label>
                <input
                  type="password"
                  className="pt-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="pt-btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
                {loading ? 'Resetting Password...' : 'Save New Password & Log In →'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  width: '100%',
                  marginTop: '0.8rem',
                  background: 'transparent',
                  border: '1.5px solid var(--pt-border)',
                  padding: '0.75rem',
                  borderRadius: 10,
                  fontWeight: 700,
                  color: 'var(--pt-text-gray)',
                  cursor: 'pointer'
                }}
              >
                ← Back to Email Step
              </button>
            </form>
          )}

          <div className="pt-auth-footer">
            Remembered your password?{' '}
            <Link to="/portal/login">Back to Sign In →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
