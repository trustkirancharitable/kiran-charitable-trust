import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './Portal.css';

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '👤';
}

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function PortalProfile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, updateProfile, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'donations' | 'membership' | 'security'
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Receipt modal state
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/portal/login');
      return;
    }

    async function loadFullProfile() {
      try {
        const res = await axios.get(`${API_BASE_URL}/auth/me`);
        if (res.data?.success && res.data.user) {
          setProfileData(res.data.user);
          setName(res.data.user.name || '');
          setPhone(res.data.user.phone || '');
          setAddress(res.data.user.address || '');
        }
      } catch (e) {
        console.warn('Profile load notice:', e.message);
      }
      setLoading(false);
    }

    loadFullProfile();
  }, [isAuthenticated, navigate]);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setSaveLoading(true);
    setMsg({ text: '', type: '' });

    const res = await updateProfile({ name, phone, address });
    if (res.success) {
      setMsg({ text: 'Profile details saved successfully! ✓', type: 'success' });
      refreshUser();
    } else {
      setMsg({ text: res.message || 'Failed to save changes.', type: 'error' });
    }
    setSaveLoading(false);
  }

  const donations = profileData?.donations || [];
  const trustMember = profileData?.trustMember || null;
  const isMember = !!trustMember || user?.role === 'trust_member';

  return (
    <div>
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Supporter Dashboard</span>
        <h1 className="pt-page-heading">
          My Account & <span>Patron Standing</span>
        </h1>
        <p className="pt-page-sub">
          Manage your personal information, view official Trust Member credentials, and retrieve 80G tax exemption donation receipts.
        </p>
      </section>

      <div className="pt-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--pt-text-light)' }}>
            Loading your account details...
          </div>
        ) : (
          <div className="pt-profile-grid">
            {/* Left Sidebar */}
            <div className="pt-profile-sidebar">
              <div className="pt-profile-avatar-large">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  getInitials(user?.name)
                )}
              </div>

              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 800, color: 'var(--pt-secondary)', margin: '0 0 0.35rem' }}>
                {user?.name}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--pt-text-gray)', marginBottom: '0.85rem' }}>
                {user?.email}
              </div>

              {/* Status Badge */}
              <div>
                {isMember ? (
                  <span className="pt-pill pt-pill-gold">
                    🏛️ Official Trust Member
                  </span>
                ) : user?.role === 'admin' ? (
                  <span className="pt-pill pt-pill-diamond">
                    🛡️ System Administrator
                  </span>
                ) : (
                  <span className="pt-pill pt-pill-starter">
                    ❤️ Valued Supporter
                  </span>
                )}
              </div>

              {trustMember?.memberId && (
                <div style={{ background: 'var(--pt-primary-soft)', border: '1px solid rgba(15, 82, 186, 0.2)', padding: '0.6rem 0.8rem', borderRadius: 10, marginTop: '0.8rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--pt-primary)', fontWeight: 800, textTransform: 'uppercase' }}>Member ID</div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.15rem', fontWeight: 900, color: 'var(--pt-primary)' }}>
                    {trustMember.memberId}
                  </div>
                </div>
              )}

              {/* Menu Links */}
              <div className="pt-profile-menu">
                <button
                  className={`pt-profile-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveTab('details')}
                >
                  👤 Personal Profile
                </button>
                <button
                  className={`pt-profile-tab-btn ${activeTab === 'donations' ? 'active' : ''}`}
                  onClick={() => setActiveTab('donations')}
                >
                  📜 Contribution History ({donations.length})
                </button>
                <button
                  className={`pt-profile-tab-btn ${activeTab === 'membership' ? 'active' : ''}`}
                  onClick={() => setActiveTab('membership')}
                >
                  🏛️ Trust Membership
                </button>
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="pt-profile-tab-btn"
                    style={{ textDecoration: 'none', color: '#1E40AF', background: '#EFF6FF' }}
                  >
                    ⚙️ Open Admin Panel →
                  </Link>
                )}
                <button
                  className="pt-profile-tab-btn"
                  onClick={logout}
                  style={{ color: 'var(--pt-danger)', marginTop: '1rem', borderTop: '1px solid var(--pt-border)', paddingTop: '1rem' }}
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>

            {/* Right Content Area */}
            <div>
              {/* TAB 1: Personal Details */}
              {activeTab === 'details' && (
                <div className="pt-profile-content-card">
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
                    Personal Information
                  </h3>
                  <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.92rem', marginBottom: '2rem' }}>
                    Update your profile details used for 80G tax exemption certificates and donor recognition.
                  </p>

                  {msg.text && (
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 10,
                      marginBottom: '1.5rem',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      background: msg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                      color: msg.type === 'success' ? '#065F46' : '#991B1B',
                      border: `1.5px solid ${msg.type === 'success' ? '#6EE7B7' : '#FCA5A5'}`
                    }}>
                      {msg.text}
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile}>
                    <div className="pt-form-group">
                      <label className="pt-label">Full Name <span className="star">*</span></label>
                      <input
                        type="text"
                        className="pt-input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="pt-form-row">
                      <div className="pt-form-group">
                        <label className="pt-label">Email Address (Read-only)</label>
                        <input
                          type="email"
                          className="pt-input"
                          value={user?.email || ''}
                          disabled
                          style={{ background: '#F8FAFC', color: 'var(--pt-text-gray)' }}
                        />
                      </div>

                      <div className="pt-form-group">
                        <label className="pt-label">Phone Number</label>
                        <input
                          type="tel"
                          className="pt-input"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="pt-form-group">
                      <label className="pt-label">Residential Address</label>
                      <input
                        type="text"
                        className="pt-input"
                        placeholder="House/Street, City, District, State, PIN"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="pt-btn-primary"
                      disabled={saveLoading}
                      style={{ width: 'auto', padding: '0.85rem 2.2rem', marginTop: '1rem' }}
                    >
                      {saveLoading ? 'Saving Changes...' : 'Save Profile Details'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: Donation History */}
              {activeTab === 'donations' && (
                <div className="pt-profile-content-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'var(--pt-secondary)', margin: 0 }}>
                        My Contribution History
                      </h3>
                      <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.92rem', margin: '4px 0 0' }}>
                        All contributions are 80G tax-exempted under Regd. No. 462/2004.
                      </p>
                    </div>
                    <Link to="/donate" className="pt-btn-cta" style={{ textDecoration: 'none', fontSize: '0.84rem', padding: '0.55rem 1.25rem' }}>
                      ❤️ Make Donation
                    </Link>
                  </div>

                  {donations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--pt-text-light)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📜</div>
                      <h4 style={{ color: 'var(--pt-secondary)', marginBottom: '0.3rem' }}>No Recorded Donations Yet</h4>
                      <p style={{ fontSize: '0.9rem' }}>Support one of our social causes to receive your first official 80G receipt.</p>
                      <Link to="/donate" className="pt-btn-cta" style={{ textDecoration: 'none', marginTop: '1rem', display: 'inline-block' }}>
                        Donate Now
                      </Link>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="pt-data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Cause / Purpose</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donations.map((d, i) => (
                            <tr key={d._id || i}>
                              <td>{new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                              <td style={{ fontWeight: 800, color: 'var(--pt-primary)' }}>{formatINR(d.amount)}</td>
                              <td>{d.purpose || 'General Social Welfare'}</td>
                              <td>
                                <span style={{
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: 50,
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: d.status === 'completed' ? '#ECFDF5' : '#FEF3C7',
                                  color: d.status === 'completed' ? '#065F46' : '#B45309'
                                }}>
                                  {d.status === 'completed' ? '✓ Verified' : d.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => setSelectedReceipt(d)}
                                  style={{
                                    padding: '0.35rem 0.85rem',
                                    borderRadius: 8,
                                    border: '1.5px solid var(--pt-border)',
                                    background: '#FFFFFF',
                                    color: 'var(--pt-primary)',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  📄 80G Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Trust Membership */}
              {activeTab === 'membership' && (
                <div className="pt-profile-content-card">
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
                    Trust Membership Status
                  </h3>
                  <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.92rem', marginBottom: '2rem' }}>
                    Recurring monthly patronage guaranteeing continuous welfare operations in Amaravathi and Palnadu.
                  </p>

                  {isMember ? (
                    <div>
                      <div style={{ background: 'var(--pt-primary-soft)', border: '1.5px solid rgba(15, 82, 186, 0.25)', borderRadius: 16, padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--pt-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Official Standing
                            </div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 900, color: 'var(--pt-secondary)', marginTop: '0.2rem' }}>
                              {trustMember?.subscriptionTier || 'Active Patron'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--pt-text-gray)', marginTop: '0.2rem' }}>
                              Member ID: <strong>{trustMember?.memberId || 'KCT-MEM-1008'}</strong>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--pt-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>Monthly Pledge</div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 900, color: 'var(--pt-primary)' }}>
                              {formatINR(trustMember?.donationAmount || 1000)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '1rem' }}>
                        Active Member Privileges
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        {[
                          'Verified Digital ID Card',
                          '80G Income Tax Receipts',
                          'Public Directory Listing',
                          'Quarterly Audit Reports',
                          'Annual Meeting Invitation'
                        ].map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: 10, fontSize: '0.88rem', fontWeight: 600 }}>
                            <span style={{ color: 'var(--pt-emerald)', fontWeight: 900 }}>✓</span> {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--pt-bg-light)', borderRadius: 16, border: '1.5px solid var(--pt-border)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏛️</div>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.5rem' }}>
                        Become an Official Trust Member
                      </h4>
                      <p style={{ color: 'var(--pt-text-gray)', maxWidth: 460, margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>
                        Join our patron society starting at ₹500/month. Receive your official ID card, 80G tax deductions, and public directory standing.
                      </p>
                      <Link to="/portal/join" className="pt-btn-cta" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
                        🏛️ Subscribe as Trust Member →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 80G Tax Receipt Preview Modal */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', maxWidth: 520, width: '100%', borderRadius: 20, padding: '2.5rem', border: '1.5px solid var(--pt-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1.5px solid var(--pt-border)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--pt-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Official 80G Tax Exemption Receipt</div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 900, color: 'var(--pt-secondary)', margin: '4px 0' }}>Kiran Charitable Trust</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)' }}>Regd. No. 462/2004 under AP Societies Act • 80G & 12A Certified</div>
            </div>

            <div style={{ fontSize: '0.88rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--pt-text-gray)' }}>Donor Name:</span>
                <strong>{selectedReceipt.fullName || user?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--pt-text-gray)' }}>Receipt No:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedReceipt.receiptNumber || 'KCT-REC-' + Date.now().toString().slice(-6)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--pt-text-gray)' }}>Date:</span>
                <span>{new Date(selectedReceipt.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--pt-text-gray)' }}>Purpose:</span>
                <span>{selectedReceipt.purpose || 'Social Welfare Donation'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--pt-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--pt-secondary)' }}>Amount Donated:</span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 900, color: 'var(--pt-primary)' }}>
                  {formatINR(selectedReceipt.amount)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="pt-btn-primary"
                onClick={() => window.print()}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                🖨️ Print / Save PDF
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: 12,
                  border: '1.5px solid var(--pt-border)',
                  background: '#F1F5F9',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
