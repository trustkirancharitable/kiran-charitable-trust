import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Portal.css';

export default function PortalSignup() {
  const navigate = useNavigate();
  const { registerUser } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleRegister(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      return setError('Please fill in all required fields.');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match. Please verify.');
    }

    setError(''); setSuccess(''); setLoading(true);

    const res = await registerUser({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      address: form.address
    });

    if (res.success) {
      setSuccess('Account created successfully! Redirecting...');
      setTimeout(() => {
        navigate('/portal/profile');
      }, 1000);
    } else {
      setError(res.message || 'Registration failed.');
    }
    setLoading(false);
  }

  return (
    <div>
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Join Our Mission</span>
        <h1 className="pt-page-heading">
          Create Supporter <span>Account</span>
        </h1>
        <p className="pt-page-sub">
          Register to maintain your tax exemption receipts, subscribe as a monthly Trust Member, and monitor social impact across Andhra Pradesh.
        </p>
      </section>

      <div className="pt-container">
        <div className="pt-auth-card" style={{ maxWidth: 540 }}>
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

          <form onSubmit={handleRegister}>
            <div className="pt-form-group">
              <label className="pt-label">Full Name <span className="star">*</span></label>
              <input
                type="text"
                className="pt-input"
                placeholder="Dr. / Mr. / Ms. Full Name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>

            <div className="pt-form-row">
              <div className="pt-form-group">
                <label className="pt-label">Email Address <span className="star">*</span></label>
                <input
                  type="email"
                  className="pt-input"
                  placeholder="yourname@domain.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  required
                />
              </div>

              <div className="pt-form-group">
                <label className="pt-label">Mobile Number <span className="opt">(Optional)</span></label>
                <input
                  type="tel"
                  className="pt-input"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>
            </div>

            <div className="pt-form-row">
              <div className="pt-form-group">
                <label className="pt-label">Create Password <span className="star">*</span></label>
                <input
                  type="password"
                  className="pt-input"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                />
              </div>

              <div className="pt-form-group">
                <label className="pt-label">Confirm Password <span className="star">*</span></label>
                <input
                  type="password"
                  className="pt-input"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pt-form-group">
              <label className="pt-label">Residential Address <span className="opt">(Optional for 80G Receipts)</span></label>
              <input
                type="text"
                className="pt-input"
                placeholder="City, District, State, PIN"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </div>

            <button type="submit" className="pt-btn-primary" disabled={loading} style={{ marginTop: '1.25rem' }}>
              {loading ? 'Creating Account...' : 'Complete Registration & Sign In →'}
            </button>
          </form>

          <div className="pt-auth-footer">
            Already have an account?{' '}
            <Link to="/portal/login">Sign in here →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
