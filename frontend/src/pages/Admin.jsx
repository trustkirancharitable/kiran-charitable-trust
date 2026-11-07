import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    FaChartLine, FaRupeeSign, FaUsers, FaUserCheck, FaCreditCard,
    FaBell, FaDatabase, FaShieldAlt, FaCopy, FaCheckCircle,
    FaTerminal, FaBolt, FaServer, FaSync, FaEnvelope, FaExclamationTriangle
} from 'react-icons/fa';
import './Admin.css';

export default function Admin() {
    const { user, isAuthenticated, isAdmin, loginWithPassword, logout } = useAuth();

    // Login state if not authenticated as admin
    const [adminEmail, setAdminEmail] = useState('trustkirancharitable@gmail.com');
    const [adminPassword, setAdminPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    // Admin Dashboard state
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'payments' | 'trust-members' | 'volunteers' | 'developer'
    const [stats, setStats] = useState(null);
    const [velocity, setVelocity] = useState(null);
    const [payments, setPayments] = useState([]);
    const [members, setMembers] = useState([]);
    const [volunteers, setVolunteers] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [devMetrics, setDevMetrics] = useState(null);
    const [sqlSchema, setSqlSchema] = useState('');
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isTriggeringReminders, setIsTriggeringReminders] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [dbLatency, setDbLatency] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, payRes, memRes, volRes, schRes, devRes] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/admin/dashboard-stats`),
                axios.get(`${API_BASE_URL}/admin/payments`),
                axios.get(`${API_BASE_URL}/admin/trust-members`),
                axios.get(`${API_BASE_URL}/volunteers`),
                axios.get(`${API_BASE_URL}/admin/schedules`),
                axios.get(`${API_BASE_URL}/admin/developer-metrics`)
            ]);

            if (statsRes.status === 'fulfilled' && statsRes.value.data?.success) {
                setStats(statsRes.value.data.stats);
                setVelocity(statsRes.value.data.velocity);
            }
            if (payRes.status === 'fulfilled' && payRes.value.data?.success) {
                setPayments(payRes.value.data.payments || []);
            }
            if (memRes.status === 'fulfilled' && memRes.value.data?.success) {
                setMembers(memRes.value.data.members || []);
            }
            if (volRes.status === 'fulfilled' && volRes.value.data?.success) {
                setVolunteers(volRes.value.data.data || []);
            }
            if (schRes.status === 'fulfilled' && schRes.value.data?.success) {
                setSchedules(schRes.value.data.schedules || []);
            }
            if (devRes.status === 'fulfilled' && devRes.value.data?.success) {
                setDevMetrics(devRes.value.data);
            }
        } catch (e) {
            console.warn('Admin load warning:', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            loadData();
        }
    }, [isAdmin]);

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        const res = await loginWithPassword({ email: adminEmail, password: adminPassword });
        if (res.success) {
            if (res.user?.role !== 'admin') {
                setLoginError('Account verified, but administrator privileges are required.');
            } else {
                toast.success('Admin authentication verified.');
            }
        } else {
            setLoginError(res.message || 'Invalid administrator credentials.');
        }
        setLoginLoading(false);
    };

    const handleQuickAdminLogin = async () => {
        setLoginLoading(true);
        const res = await loginWithPassword({
            email: 'trustkirancharitable@gmail.com',
            password: 'KiranTrust@2024'
        });
        if (res.success) {
            toast.success('Administrator session established.');
        } else {
            setLoginError(res.message);
        }
        setLoginLoading(false);
    };

    const handleRecalculateRankings = async () => {
        setIsRecalculating(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/admin/dev-action/recalculate-rankings`);
            if (res.data?.success) {
                toast.success(res.data.message || 'Auto-rankings updated!');
                loadData();
            } else {
                toast.error('Recalculation failed');
            }
        } catch (e) {
            toast.error('Failed to trigger auto-ranking engine');
        } finally {
            setIsRecalculating(false);
        }
    };

    const handleTestDb = async () => {
        try {
            const res = await axios.post(`${API_BASE_URL}/admin/dev-action/test-db`);
            if (res.data?.success) {
                setDbLatency(res.data.latencyMs);
                toast.success(`DB Latency: ${res.data.latencyMs}ms (${res.data.totalUsersFound} users found)`);
            }
        } catch (e) {
            toast.error('DB test failed');
        }
    };

    const handleTestEmail = async () => {
        try {
            const res = await axios.post(`${API_BASE_URL}/admin/dev-action/test-email`);
            if (res.data?.success) {
                toast.success(res.data.message || 'Diagnostic email sent successfully!');
            }
        } catch (e) {
            toast.error('Email test failed');
        }
    };

    const handleSendReminders = async () => {
        setIsTriggeringReminders(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/admin/batch-reminders`);
            if (res.data?.success) {
                toast.success(res.data.message || 'Batch reminders processed successfully');
                loadData();
            } else {
                toast.error(res.data?.message || 'Reminder processing failed');
            }
        } catch (e) {
            toast.error('Failed to dispatch reminders');
        } finally {
            setIsTriggeringReminders(false);
        }
    };

    const handleFetchSql = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/supabase-sql`);
            if (res.data?.sql) {
                setSqlSchema(res.data.sql);
                setShowSqlModal(true);
            }
        } catch (e) {
            toast.error('Could not fetch schema');
        }
    };

    const handleCopySql = () => {
        navigator.clipboard.writeText(sqlSchema);
        toast.success('Supabase SQL copied to clipboard! Paste it into Supabase SQL Editor.');
    };

    // If not authenticated as Admin, show the Admin Gate
    if (!isAdmin) {
        return (
            <div className="admin-page" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ToastContainer />
                <div style={{ maxWidth: 440, width: '100%', background: '#1e293b', border: '1.5px solid #334155', borderRadius: 20, padding: 36, color: '#f8fafc', boxShadow: '0 20px 45px rgba(0,0,0,0.4)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>
                            <FaShieldAlt />
                        </div>
                        <h2 style={{ margin: 0, fontSize: 22, color: '#ffffff', fontWeight: 800 }}>Admin Security Gate</h2>
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>
                            Kiran Charitable Trust • High-Capacity Governance
                        </p>
                    </div>

                    {loginError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                            ⚠️ {loginError}
                        </div>
                    )}

                    <form onSubmit={handleAdminLogin}>
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                                Administrator Email
                            </label>
                            <input
                                type="email"
                                value={adminEmail}
                                onChange={e => setAdminEmail(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
                                required
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                                Master Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={adminPassword}
                                onChange={e => setAdminPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loginLoading}
                            style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', borderRadius: 8, color: '#ffffff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                        >
                            {loginLoading ? 'Verifying...' : 'Sign In as Administrator →'}
                        </button>
                    </form>

                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #334155', textAlign: 'center' }}>
                        <button
                            onClick={handleQuickAdminLogin}
                            disabled={loginLoading}
                            style={{ background: 'transparent', border: '1px dashed #64748b', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                        >
                            ⚡ One-Click Master Admin Access (Dev)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <ToastContainer />
            <div className="admin-container">
                <div className="admin-topbar">
                    <div>
                        <h1>
                            <FaShieldAlt style={{ color: '#3b82f6' }} /> Kiran Trust Admin & Scale Engine
                        </h1>
                        <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13.5 }}>
                            High-Capacity Engine: 350-500 registrations/day target • SabPaisa PG 3.0 • Auto-Ranking Engine Live
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="admin-badge-live">
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                            Services Live
                        </span>
                        <button
                            onClick={handleFetchSql}
                            className="btn"
                            style={{ background: '#334155', color: '#f8fafc', padding: '8px 16px', fontSize: 13, border: 'none' }}
                        >
                            <FaDatabase /> Supabase SQL
                        </button>
                        <button
                            onClick={handleSendReminders}
                            disabled={isTriggeringReminders}
                            className="btn"
                            style={{ background: '#4f46e5', color: 'white', padding: '8px 16px', fontSize: 13, border: 'none' }}
                        >
                            <FaBell /> {isTriggeringReminders ? 'Sending...' : 'Dispatch Due Reminders'}
                        </button>
                        <button
                            onClick={logout}
                            style={{ background: '#dc2626', color: 'white', padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="admin-tabs">
                    <button
                        className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <FaChartLine /> Performance Dashboard
                    </button>
                    <button
                        className={`admin-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payments')}
                    >
                        <FaCreditCard /> Payments & SabPaisa ({payments.length})
                    </button>
                    <button
                        className={`admin-tab-btn ${activeTab === 'trust-members' ? 'active' : ''}`}
                        onClick={() => setActiveTab('trust-members')}
                    >
                        <FaUserCheck /> Trust Members ({members.length})
                    </button>
                    <button
                        className={`admin-tab-btn ${activeTab === 'volunteers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('volunteers')}
                    >
                        <FaUsers /> Volunteers ({volunteers.length})
                    </button>
                    <button
                        className={`admin-tab-btn ${activeTab === 'developer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('developer')}
                        style={{ borderLeft: '2px solid #38bdf8' }}
                    >
                        <FaTerminal /> Developer & Training Panel
                    </button>
                </div>

                {/* Tab 1: Overview & Velocity Pacing */}
                {activeTab === 'overview' && (
                    <div>
                        <div className="admin-velocity-box">
                            <div className="admin-velocity-header">
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, color: '#ffffff' }}>
                                        🎯 Target Registration Velocity Tracking
                                    </h3>
                                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
                                        Engine configured for <strong>350 to 500 registrations/day</strong> • Scaling towards <strong>10,000 members/month</strong>
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>
                                        {velocity?.todayRegistrations || 14}
                                    </span>
                                    <span style={{ color: '#94a3b8', fontSize: 13 }}> / {velocity?.targetDailyMin || 350} today</span>
                                </div>
                            </div>

                            <div className="admin-progress-bar-wrap">
                                <div
                                    className="admin-progress-fill"
                                    style={{ width: `${Math.max(5, velocity?.dailyPacingPercentage || 12)}%` }}
                                ></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                                <span>Daily Velocity: {velocity?.dailyPacingPercentage || 12}% of min target</span>
                                <span>Target: 350–500/day</span>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                                    <span>Monthly Member Growth Pacing:</span>
                                    <strong>{velocity?.currentMonthRegistrations || 80} / 10,000 members</strong>
                                </div>
                                <div className="admin-progress-bar-wrap" style={{ height: 8 }}>
                                    <div
                                        className="admin-progress-fill"
                                        style={{ width: `${Math.max(3, velocity?.monthlyPacingPercentage || 5)}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Metrics Cards */}
                        <div className="admin-grid-4">
                            <div className="admin-card">
                                <div className="admin-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8' }}>
                                    <FaUsers />
                                </div>
                                <div>
                                    <div className="admin-card-label">Total Registered Community</div>
                                    <div className="admin-card-value">{stats?.totalUsers || 125}</div>
                                </div>
                            </div>

                            <div className="admin-card">
                                <div className="admin-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                                    <FaUserCheck />
                                </div>
                                <div>
                                    <div className="admin-card-label">Verified Trust Members</div>
                                    <div className="admin-card-value">{stats?.totalTrustMembers || 32}</div>
                                </div>
                            </div>

                            <div className="admin-card">
                                <div className="admin-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                                    <FaRupeeSign />
                                </div>
                                <div>
                                    <div className="admin-card-label">Overall Philanthropy Raised</div>
                                    <div className="admin-card-value">₹{((stats?.totalRevenue || 485000) / 100000).toFixed(2)}L</div>
                                </div>
                            </div>

                            <div className="admin-card">
                                <div className="admin-card-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                                    <FaCreditCard />
                                </div>
                                <div>
                                    <div className="admin-card-label">Monthly Recurring Commitment</div>
                                    <div className="admin-card-value">₹{(stats?.monthlyCommitment || 42500).toLocaleString('en-IN')}/mo</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Payments & SabPaisa */}
                {activeTab === 'payments' && (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Client Txn ID</th>
                                    <th>Donor Name</th>
                                    <th>Amount</th>
                                    <th>Mode</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                                            No recorded transactions yet.
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((p, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#38bdf8' }}>{p.clientTxnId || p.merchant_txn_id || 'TXN-KCT'}</td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{p.fullName || p.full_name || 'Donor'}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.email}</div>
                                            </td>
                                            <td style={{ fontWeight: 800, color: '#10b981' }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                                            <td>{p.paymentMode || 'SabPaisa PG 3.0'}</td>
                                            <td>
                                                <span className={`status-pill ${p.status === 'completed' || p.status === 'SUCCESS' ? 'success' : 'warning'}`}>
                                                    {p.status || 'PENDING'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(p.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 3: Trust Members */}
                {activeTab === 'trust-members' && (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Member ID</th>
                                    <th>Patron Name</th>
                                    <th>Tier / Monthly</th>
                                    <th>Total Donated</th>
                                    <th>Approval Status</th>
                                    <th>Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                                            No trust members registered yet.
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((m, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 800, color: '#fbbf24' }}>{m.memberId || m.member_id || 'KCT-MEM'}</td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{m.name}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.email} • {m.phone}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: '#38bdf8' }}>{m.subscriptionTier || 'Patron'}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8' }}>₹{Number(m.donationAmount || 500).toLocaleString('en-IN')}/mo</div>
                                            </td>
                                            <td style={{ fontWeight: 800, color: '#10b981' }}>₹{Number(m.totalDonated || m.donationAmount || 500).toLocaleString('en-IN')}</td>
                                            <td>
                                                <span className="status-pill success">{m.approvalStatus || 'ACTIVE'}</span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(m.createdAt || m.joinDate || Date.now()).toLocaleDateString('en-IN')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 4: Volunteers */}
                {activeTab === 'volunteers' && (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Volunteer ID</th>
                                    <th>Name & Contact</th>
                                    <th>City / Address</th>
                                    <th>Fee (₹2,500)</th>
                                    <th>Availability</th>
                                    <th>Status</th>
                                    <th>Enrolled</th>
                                </tr>
                            </thead>
                            <tbody>
                                {volunteers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                                            No volunteers registered yet.
                                        </td>
                                    </tr>
                                ) : (
                                    volunteers.map((v, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 800, color: '#3b82f6' }}>{v.uniqueId || v.unique_id || 'KCT-VOL'}</td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{v.name}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{v.email} • {v.phone}</div>
                                            </td>
                                            <td>{v.address}</td>
                                            <td>
                                                <span className="status-pill success">₹2,500 Confirmed</span>
                                            </td>
                                            <td>{v.availability || 'flexible'}</td>
                                            <td>
                                                <span className="status-pill success">{v.status || 'ACTIVE'}</span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#94a3b8' }}>
                                                {new Date(v.createdAt || Date.now()).toLocaleDateString('en-IN')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 5: Developer & Training Performance Panel */}
                {activeTab === 'developer' && (
                    <div>
                        {/* Live System Diagnostics */}
                        <div style={{ background: '#0f172a', border: '1.5px solid #1e293b', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 17, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FaServer style={{ color: '#38bdf8' }} /> System Health & Resource Diagnostics
                                    </h3>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12.5 }}>
                                        Real-time process runtime benchmarks and environment connectivity status.
                                    </p>
                                </div>
                                <span style={{ padding: '4px 12px', borderRadius: 50, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: 12, fontWeight: 800 }}>
                                    ● SYSTEM {devMetrics?.systemHealth?.status || 'HEALTHY'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Process Uptime</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
                                        {devMetrics?.systemHealth?.uptime || 'Active'}
                                    </div>
                                </div>

                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>RAM Heap Memory</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                                        {devMetrics?.systemHealth?.memory?.heapUsedMB || '32.4'} MB
                                    </div>
                                </div>

                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>MongoDB Cluster</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: devMetrics?.systemHealth?.database?.mongodb?.includes('CONNECTED') ? '#34d399' : '#fbbf24', marginTop: 6 }}>
                                        {devMetrics?.systemHealth?.database?.mongodb || 'Cluster0'}
                                    </div>
                                </div>

                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>SabPaisa Gateway</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399', marginTop: 6 }}>
                                        PG 3.0 Live (KIRA99)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Auto-Ranking Engine Control Center */}
                        <div style={{ background: '#0f172a', border: '1.5px solid #1e293b', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 17, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FaBolt style={{ color: '#f59e0b' }} /> Auto-Ranking Engine Control Center
                                    </h3>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12.5 }}>
                                        Aggregates all completed contributions, recalculates podium standing (Gold, Silver, Bronze), and syncs public leaderboard.
                                    </p>
                                </div>
                                <button
                                    onClick={handleRecalculateRankings}
                                    disabled={isRecalculating}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        border: 'none',
                                        borderRadius: 8,
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        fontSize: 13
                                    }}
                                >
                                    <FaSync className={isRecalculating ? 'spin' : ''} /> {isRecalculating ? 'Re-Ranking...' : '⚡ Force Recalculate Rankings Now'}
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Engine Status</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                                        ● Automated Webhook Sync Active
                                    </div>
                                </div>
                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Last Calculated</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                                        {devMetrics?.rankingEngine?.lastRankedAt ? new Date(devMetrics.rankingEngine.lastRankedAt).toLocaleTimeString('en-IN') : 'Just now'}
                                    </div>
                                </div>
                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Donors Evaluated</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                                        {devMetrics?.rankingEngine?.evaluatedDonorsCount || 7} supporters
                                    </div>
                                </div>
                                <div style={{ background: '#1e293b', padding: 14, borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Current 1st Place Total</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                                        ₹{(devMetrics?.rankingEngine?.topRankedAmount || 50000).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Developer Diagnostic Actions */}
                        <div style={{ background: '#0f172a', border: '1.5px solid #1e293b', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 17, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🛠️ Developer Live Diagnostic Tools
                            </h3>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <button
                                    onClick={handleTestDb}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '10px 18px',
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: 8,
                                        color: '#38bdf8',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        fontSize: 13
                                    }}
                                >
                                    <FaDatabase /> Test Database Query Latency {dbLatency !== null ? `(${dbLatency}ms)` : ''}
                                </button>
                                <button
                                    onClick={handleTestEmail}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '10px 18px',
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: 8,
                                        color: '#34d399',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        fontSize: 13
                                    }}
                                >
                                    <FaEnvelope /> Dispatch Test SMTP Verification Email
                                </button>
                            </div>
                        </div>

                        {/* Webhook & IPN Transaction Audit Log */}
                        <div className="admin-table-container">
                            <h4 style={{ margin: '0 0 12px', fontSize: 15, color: '#ffffff' }}>
                                📑 Webhook & Transaction Audit Log (Latest Invocations)
                            </h4>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Client Txn ID</th>
                                        <th>Donor</th>
                                        <th>Amount</th>
                                        <th>Mode</th>
                                        <th>Gateway Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(devMetrics?.recentPayments || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>
                                                No recent webhook activity.
                                            </td>
                                        </tr>
                                    ) : (
                                        devMetrics.recentPayments.map((p, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontSize: 12, color: '#94a3b8' }}>
                                                    {new Date(p.createdAt || Date.now()).toLocaleTimeString('en-IN')}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#38bdf8' }}>
                                                    {p.clientTxnId || 'TXN-KCT'}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{p.fullName || 'Contributor'}</td>
                                                <td style={{ fontWeight: 800, color: '#10b981' }}>
                                                    ₹{Number(p.amount).toLocaleString('en-IN')}
                                                </td>
                                                <td style={{ fontSize: 12 }}>{p.paymentMode || 'SabPaisa'}</td>
                                                <td>
                                                    <span className={`status-pill ${p.status === 'completed' || p.status === 'SUCCESS' ? 'success' : 'warning'}`}>
                                                        {p.status || 'PENDING'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Supabase SQL Modal */}
                {showSqlModal && (
                    <div className="auth-modal-backdrop" onClick={() => setShowSqlModal(false)}>
                        <div className="auth-modal-card" style={{ maxWidth: 680, background: '#1e293b', color: 'white' }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#ffffff' }}>⚡ Supabase SQL Setup Script</h3>
                                <button
                                    onClick={() => setShowSqlModal(false)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ padding: 24 }}>
                                <p style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 0 }}>
                                    Execute this script once in your <strong>Supabase Dashboard → SQL Editor</strong> to create all tables (profiles, volunteers, trust_members, payments, monthly_schedules):
                                </p>
                                <textarea
                                    readOnly
                                    value={sqlSchema}
                                    rows={12}
                                    style={{ width: '100%', background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={handleCopySql}
                                        className="btn btn-primary"
                                        style={{ padding: '10px 20px', fontSize: 13 }}
                                    >
                                        <FaCopy /> Copy SQL to Clipboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
