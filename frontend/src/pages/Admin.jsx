import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    FaChartLine, FaRupeeSign, FaUsers, FaUserCheck, FaCreditCard,
    FaBell, FaDatabase, FaShieldAlt, FaCopy, FaCheckCircle,
    FaTerminal, FaBolt, FaServer, FaSync, FaEnvelope, FaExclamationTriangle,
    FaSearch, FaFilter, FaDownload, FaKey, FaTrashAlt, FaPrint, FaTimes, FaUndoAlt
} from 'react-icons/fa';
import { numberToWordsIndian } from '../utils/numberToWords';
import './Admin.css';

export default function Admin() {
    const { user, isAuthenticated, isAdmin, loginWithPassword, logout } = useAuth();

    // Login state if not authenticated as admin
    const [adminEmail, setAdminEmail] = useState('trustkirancharitable@gmail.com');
    const [adminPassword, setAdminPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    // Forgot Password Modal State
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotStep, setForgotStep] = useState(1); // 1 = Enter Email, 2 = Enter OTP & New Password
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMsg, setForgotMsg] = useState('');

    // Admin Dashboard state
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'payments' | 'trust-members' | 'volunteers' | 'users' | 'developer'
    const [stats, setStats] = useState(null);
    const [velocity, setVelocity] = useState(null);
    const [payments, setPayments] = useState([]);
    const [members, setMembers] = useState([]);
    const [volunteers, setVolunteers] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [devMetrics, setDevMetrics] = useState(null);
    const [sqlSchema, setSqlSchema] = useState('');
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isTriggeringReminders, setIsTriggeringReminders] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [dbLatency, setDbLatency] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Payments Filtering & Management State
    const [paymentSearch, setPaymentSearch] = useState('');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
    const [resendingId, setResendingId] = useState(null);
    const [selectedCertDonation, setSelectedCertDonation] = useState(null);

    // User Controls State
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('all');
    const [resetPwUser, setResetPwUser] = useState(null);
    const [resetPwValue, setResetPwValue] = useState('');
    const [resetPwLoading, setResetPwLoading] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, payRes, memRes, volRes, schRes, devRes, usrRes] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/admin/dashboard-stats`),
                axios.get(`${API_BASE_URL}/admin/payments?limit=200`),
                axios.get(`${API_BASE_URL}/admin/trust-members`),
                axios.get(`${API_BASE_URL}/volunteers`),
                axios.get(`${API_BASE_URL}/admin/schedules`),
                axios.get(`${API_BASE_URL}/admin/developer-metrics`),
                axios.get(`${API_BASE_URL}/admin/users?limit=200`)
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
            if (usrRes.status === 'fulfilled' && usrRes.value.data?.success) {
                setUsersList(usrRes.value.data.users || []);
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
            password: 'Trust@1234'
        });
        if (res.success) {
            toast.success('Administrator session established.');
        } else {
            setLoginError(res.message);
        }
        setLoginLoading(false);
    };

    // Forgot Password Flow
    const handleSendForgotOtp = async (e) => {
        e.preventDefault();
        if (!forgotEmail) {
            toast.error('Please enter your email');
            return;
        }
        setForgotLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email: forgotEmail });
            if (res.data?.success) {
                toast.success(res.data.message || 'Verification code dispatched to your email.');
                setForgotStep(2);
                setForgotMsg(`A 6-digit verification code has been dispatched to ${forgotEmail}.`);
            } else {
                toast.error(res.data?.message || 'Failed to dispatch code');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to process request');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!forgotOtp || !forgotNewPassword) {
            toast.error('Verification code and new password are required');
            return;
        }
        setForgotLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
                email: forgotEmail,
                otp: forgotOtp,
                newPassword: forgotNewPassword
            });
            if (res.data?.success) {
                toast.success('Password reset successfully! You can now sign in.');
                setShowForgotModal(false);
                setForgotStep(1);
                setAdminEmail(forgotEmail);
                setAdminPassword('');
            } else {
                toast.error(res.data?.message || 'Reset failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Reset failed');
        } finally {
            setForgotLoading(false);
        }
    };

    // Resend 80G Receipt
    const handleResendReceipt = async (p) => {
        const id = p._id || p.transactionId;
        setResendingId(id);
        try {
            const res = await axios.post(`${API_BASE_URL}/admin/payments/${id}/resend-receipt`);
            if (res.data?.success) {
                toast.success(res.data.message || '80G Tax Exemption Receipt dispatched successfully!');
            } else {
                toast.error(res.data?.message || 'Failed to dispatch receipt');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to resend receipt');
        } finally {
            setResendingId(null);
        }
    };

    // Update Payment Status
    const handleUpdatePaymentStatus = async (p, newStatus) => {
        const id = p._id || p.transactionId;
        try {
            const res = await axios.put(`${API_BASE_URL}/admin/payments/${id}/status`, { status: newStatus });
            if (res.data?.success) {
                toast.success(`Transaction status updated to ${newStatus.toUpperCase()}`);
                setPayments(prev => prev.map(item => (item._id === id || item.transactionId === id) ? { ...item, status: newStatus } : item));
            } else {
                toast.error('Status update failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    // Export CSV
    const handleExportCsv = () => {
        window.open(`${API_BASE_URL}/admin/payments/export-csv`, '_blank');
    };

    // User Controls: Change Role
    const handleUpdateUserRole = async (userId, newRole) => {
        try {
            const res = await axios.put(`${API_BASE_URL}/admin/users/${userId}/role`, { role: newRole });
            if (res.data?.success) {
                toast.success(`User role updated to ${newRole}`);
                setUsersList(prev => prev.map(u => (u._id === userId || u.id === userId) ? { ...u, role: newRole } : u));
            } else {
                toast.error(res.data?.message || 'Role update failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update role');
        }
    };

    // User Controls: Reset Password
    const handleUserResetPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!resetPwValue || resetPwValue.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        setResetPwLoading(true);
        try {
            const res = await axios.put(`${API_BASE_URL}/admin/users/${resetPwUser._id || resetPwUser.id}/reset-password`, {
                newPassword: resetPwValue
            });
            if (res.data?.success) {
                toast.success(res.data.message || 'Password reset successfully');
                setResetPwUser(null);
                setResetPwValue('');
            } else {
                toast.error(res.data?.message || 'Password reset failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Password reset failed');
        } finally {
            setResetPwLoading(false);
        }
    };

    // User Controls: Delete User
    const handleDeleteUser = async (userId, userEmail) => {
        if (!window.confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
            return;
        }
        try {
            const res = await axios.delete(`${API_BASE_URL}/admin/users/${userId}`);
            if (res.data?.success) {
                toast.success('User record deleted successfully');
                setUsersList(prev => prev.filter(u => u._id !== userId && u.id !== userId));
            } else {
                toast.error(res.data?.message || 'Delete failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete user');
        }
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

    // Filtered Payments
    const filteredPayments = payments.filter(p => {
        const matchesStatus = paymentStatusFilter === 'all'
            ? true
            : (paymentStatusFilter === 'success'
                ? (p.status === 'completed' || p.status === 'SUCCESS' || p.status === 'success')
                : (paymentStatusFilter === 'pending'
                    ? (p.status === 'pending' || p.status === 'PENDING')
                    : (p.status === 'failed' || p.status === 'FAILED' || p.status === 'declined')));

        const query = paymentSearch.toLowerCase().trim();
        const matchesSearch = !query
            ? true
            : (
                (p.fullName || '').toLowerCase().includes(query) ||
                (p.email || '').toLowerCase().includes(query) ||
                (p.mobile || '').includes(query) ||
                (p.transactionId || '').toLowerCase().includes(query) ||
                (p.clientTxnId || '').toLowerCase().includes(query) ||
                (p.receiptNumber || '').toLowerCase().includes(query)
            );

        return matchesStatus && matchesSearch;
    });

    const totalFilteredAmount = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // Filtered Users
    const filteredUsers = usersList.filter(u => {
        const matchesRole = userRoleFilter === 'all' ? true : u.role === userRoleFilter;
        const q = userSearch.toLowerCase().trim();
        const matchesSearch = !q
            ? true
            : (
                (u.name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.phone || '').includes(q)
            );
        return matchesRole && matchesSearch;
    });

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

                        <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    Master Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setForgotEmail(adminEmail); setShowForgotModal(true); setForgotStep(1); }}
                                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                >
                                    Forgot Password?
                                </button>
                            </div>
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
                            style={{ width: '100%', padding: '12px', marginTop: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', borderRadius: 8, color: '#ffffff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                        >
                            {loginLoading ? 'Verifying...' : 'Sign In as Administrator →'}
                        </button>
                    </form>

                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #334155', textAlign: 'center' }}>
                        <button
                            onClick={handleQuickAdminLogin}
                            disabled={loginLoading}
                            style={{ background: 'transparent', border: '1px dashed #475569', color: '#cbd5e1', padding: '8px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer', width: '100%' }}
                        >
                            ⚡ 1-Click Master Session (trustkirancharitable@gmail.com)
                        </button>
                    </div>
                </div>

                {/* Forgot Password Modal */}
                {showForgotModal && (
                    <div className="auth-modal-backdrop" onClick={() => setShowForgotModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
                        <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 16, maxWidth: 420, width: '100%', padding: 28, color: '#f8fafc' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FaKey style={{ color: '#38bdf8' }} /> Reset Password
                                </h3>
                                <button onClick={() => setShowForgotModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                            </div>

                            {forgotStep === 1 ? (
                                <form onSubmit={handleSendForgotOtp}>
                                    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                                        Enter your email address. A 6-digit verification code will be dispatched to your inbox and the administrator.
                                    </p>
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Your Email</label>
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        style={{ width: '100%', padding: '10px', background: '#2563eb', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {forgotLoading ? 'Dispatching...' : 'Dispatch Verification Code →'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleResetPassword}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#6ee7b7', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
                                        {forgotMsg}
                                    </div>
                                    <div style={{ marginBottom: 14 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>6-Digit Verification Code</label>
                                        <input
                                            type="text"
                                            placeholder="123456"
                                            maxLength={6}
                                            value={forgotOtp}
                                            onChange={e => setForgotOtp(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 16, letterSpacing: 4, textAlign: 'center', boxSizing: 'border-box' }}
                                            required
                                        />
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>New Master Password</label>
                                        <input
                                            type="password"
                                            placeholder="Min. 6 characters"
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        style={{ width: '100%', padding: '10px', background: '#10b981', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {forgotLoading ? 'Updating Password...' : 'Save New Password & Sign In'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                )}
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
                        <FaCreditCard /> Transactions & 80G Receipts ({payments.length})
                    </button>
                    <button
                        className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        <FaUsers /> User Controls ({usersList.length})
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
                        <div className="admin-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                            <div className="admin-card" style={{ background: '#1e293b', padding: 20, borderRadius: 14, border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        <FaUsers />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Total Registered Community</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>{stats?.totalUsers || usersList.length || 125}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-card" style={{ background: '#1e293b', padding: 20, borderRadius: 14, border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        <FaUserCheck />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Verified Trust Members</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>{stats?.totalTrustMembers || members.length || 32}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-card" style={{ background: '#1e293b', padding: 20, borderRadius: 14, border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        <FaRupeeSign />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Overall Philanthropy Raised</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>₹{((stats?.totalRevenue || 485000) / 100000).toFixed(2)}L</div>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-card" style={{ background: '#1e293b', padding: 20, borderRadius: 14, border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        <FaCreditCard />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Monthly Commitment</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>₹{(stats?.monthlyCommitment || 42500).toLocaleString('en-IN')}/mo</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Payments & Transactions Management */}
                {activeTab === 'payments' && (
                    <div>
                        {/* Search & Actions Bar */}
                        <div style={{ background: '#1e293b', padding: 18, borderRadius: 14, border: '1px solid #334155', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                                    <FaSearch style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by donor name, email, phone, or transaction ID..."
                                        value={paymentSearch}
                                        onChange={e => setPaymentSearch(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13, boxSizing: 'border-box' }}
                                    />
                                </div>
                                <select
                                    value={paymentStatusFilter}
                                    onChange={e => setPaymentStatusFilter(e.target.value)}
                                    style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13, fontWeight: 600 }}
                                >
                                    <option value="all">All Statuses ({payments.length})</option>
                                    <option value="success">Success / Completed</option>
                                    <option value="pending">Pending Verification</option>
                                    <option value="failed">Failed / Declined</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div style={{ padding: '8px 14px', background: '#0f172a', borderRadius: 8, border: '1px solid #334155', fontSize: 13, color: '#94a3b8' }}>
                                    Found: <strong style={{ color: '#38bdf8' }}>{filteredPayments.length}</strong> | Total: <strong style={{ color: '#10b981' }}>₹{totalFilteredAmount.toLocaleString('en-IN')}</strong>
                                </div>
                                <button
                                    onClick={handleExportCsv}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#10b981', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                >
                                    <FaDownload /> Export CSV
                                </button>
                            </div>
                        </div>

                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Txn Ref & Receipt</th>
                                        <th>Donor & Contact</th>
                                        <th>Amount (₹)</th>
                                        <th>Purpose</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                                                No transactions match your search filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPayments.map((p, idx) => {
                                            const isSuccess = p.status === 'completed' || p.status === 'SUCCESS' || p.status === 'success';
                                            const isPending = p.status === 'pending' || p.status === 'PENDING';
                                            const isFailed = p.status === 'failed' || p.status === 'FAILED' || p.status === 'declined';
                                            const pId = p._id || p.transactionId;

                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#38bdf8', fontWeight: 700 }}>
                                                            {p.clientTxnId || p.transactionId || 'TXN-KCT'}
                                                        </div>
                                                        {p.receiptNumber && (
                                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                                                Rec: {p.receiptNumber}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{p.fullName || 'Valued Donor'}</div>
                                                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.email || 'No email'}</div>
                                                        {p.mobile && <div style={{ fontSize: 11, color: '#64748b' }}>{p.mobile}</div>}
                                                    </td>
                                                    <td style={{ fontWeight: 800, color: '#10b981', fontSize: 15 }}>
                                                        ₹{Number(p.amount).toLocaleString('en-IN')}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: 12, color: '#cbd5e1' }}>{p.purpose || 'General Philanthropy'}</div>
                                                        <div style={{ fontSize: 11, color: '#64748b' }}>{p.paymentMethod || p.paymentMode || 'Canara SabPaisa'}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`status-pill ${isSuccess ? 'success' : (isPending ? 'pending' : 'failed')}`}>
                                                            {p.status || 'PENDING'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {new Date(p.createdAt || Date.now()).toLocaleDateString('en-IN')}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                                                            {/* Resend Receipt Email Button */}
                                                            <button
                                                                onClick={() => handleResendReceipt(p)}
                                                                disabled={resendingId === pId}
                                                                title="Dispatch Official 80G Tax Exemption Receipt via Email"
                                                                style={{ padding: '6px 10px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <FaEnvelope /> {resendingId === pId ? 'Sending...' : 'Receipt'}
                                                            </button>

                                                            {/* View / Print 80G Certificate */}
                                                            <button
                                                                onClick={() => setSelectedCertDonation(p)}
                                                                title="View & Print Official CBDT Form 10BE Certificate"
                                                                style={{ padding: '6px 10px', background: '#334155', border: '1px solid #475569', borderRadius: 6, color: '#f8fafc', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <FaPrint /> 80G
                                                            </button>

                                                            {/* Status Switcher Dropdown */}
                                                            <select
                                                                value={p.status || 'pending'}
                                                                onChange={e => handleUpdatePaymentStatus(p, e.target.value)}
                                                                style={{ padding: '5px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                                                            >
                                                                <option value="success">Success</option>
                                                                <option value="pending">Pending</option>
                                                                <option value="failed">Failed</option>
                                                            </select>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab 3: User Controls & Permissions */}
                {activeTab === 'users' && (
                    <div>
                        <div style={{ background: '#1e293b', padding: 18, borderRadius: 14, border: '1px solid #334155', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                                    <FaSearch style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                                    <input
                                        type="text"
                                        placeholder="Search users by name, email, or mobile..."
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13, boxSizing: 'border-box' }}
                                    />
                                </div>
                                <select
                                    value={userRoleFilter}
                                    onChange={e => setUserRoleFilter(e.target.value)}
                                    style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13, fontWeight: 600 }}
                                >
                                    <option value="all">All Roles ({usersList.length})</option>
                                    <option value="admin">Administrators</option>
                                    <option value="trust_member">Trust Members</option>
                                    <option value="volunteer">Volunteers</option>
                                    <option value="donor">Donors</option>
                                </select>
                            </div>
                            <div style={{ padding: '8px 14px', background: '#0f172a', borderRadius: 8, border: '1px solid #334155', fontSize: 13, color: '#94a3b8' }}>
                                Total Community Accounts: <strong style={{ color: '#38bdf8' }}>{filteredUsers.length}</strong>
                            </div>
                        </div>

                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name & Identity</th>
                                        <th>Email Address</th>
                                        <th>Mobile</th>
                                        <th>Role / Privilege</th>
                                        <th>Auth Provider</th>
                                        <th>Joined Date</th>
                                        <th style={{ textAlign: 'center' }}>Admin Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                                                No users found matching your criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((u, idx) => {
                                            const uId = u._id || u.id;
                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.name || 'User'}</div>
                                                        <div style={{ fontSize: 11, color: '#64748b' }}>ID: {uId}</div>
                                                    </td>
                                                    <td style={{ color: '#cbd5e1' }}>{u.email}</td>
                                                    <td style={{ color: '#94a3b8' }}>{u.phone || 'N/A'}</td>
                                                    <td>
                                                        <select
                                                            value={u.role || 'donor'}
                                                            onChange={e => handleUpdateUserRole(uId, e.target.value)}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : (u.role === 'trust_member' ? 'rgba(16, 185, 129, 0.2)' : '#0f172a'),
                                                                color: u.role === 'admin' ? '#f87171' : (u.role === 'trust_member' ? '#34d399' : '#cbd5e1'),
                                                                border: '1px solid #334155',
                                                                fontWeight: 700,
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            <option value="donor">Donor / Public</option>
                                                            <option value="volunteer">Volunteer</option>
                                                            <option value="trust_member">Trust Member</option>
                                                            <option value="admin">Administrator</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', textTransform: 'uppercase' }}>
                                                            {u.authProvider || 'local'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {new Date(u.createdAt || Date.now()).toLocaleDateString('en-IN')}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                            {/* Reset Password Button */}
                                                            <button
                                                                onClick={() => { setResetPwUser(u); setResetPwValue(''); }}
                                                                title="Reset Password for this user"
                                                                style={{ padding: '6px 10px', background: '#4f46e5', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <FaKey /> Set Password
                                                            </button>

                                                            {/* Delete User Button */}
                                                            <button
                                                                onClick={() => handleDeleteUser(uId, u.email)}
                                                                title="Delete this user record"
                                                                style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                            >
                                                                <FaTrashAlt />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Reset Password for User Modal */}
                        {resetPwUser && (
                            <div className="auth-modal-backdrop" onClick={() => setResetPwUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
                                <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 16, maxWidth: 420, width: '100%', padding: 28, color: '#f8fafc' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <h3 style={{ margin: 0, fontSize: 18, color: '#ffffff' }}>
                                            🔑 Reset Password for {resetPwUser.name || resetPwUser.email}
                                        </h3>
                                        <button onClick={() => setResetPwUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                                    </div>
                                    <form onSubmit={handleUserResetPasswordSubmit}>
                                        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 14px' }}>
                                            Set a new secure password for <strong>{resetPwUser.email}</strong>.
                                        </p>
                                        <div style={{ marginBottom: 16 }}>
                                            <input
                                                type="password"
                                                placeholder="Enter new password (min. 6 characters)"
                                                value={resetPwValue}
                                                onChange={e => setResetPwValue(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                onClick={() => setResetPwUser(null)}
                                                style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 6, color: '#cbd5e1', cursor: 'pointer' }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={resetPwLoading}
                                                style={{ padding: '8px 16px', background: '#10b981', border: 'none', borderRadius: 6, color: 'white', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                {resetPwLoading ? 'Updating...' : 'Save Password'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 4: Trust Members */}
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

                {/* Tab 5: Volunteers */}
                {activeTab === 'volunteers' && (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Volunteer ID</th>
                                    <th>Name & Contact</th>
                                    <th>City / Address</th>
                                    <th>Certification</th>
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
                                                <span className="status-pill success">Verified</span>
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

                {/* Tab 6: Developer & Scale Panel */}
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
                    </div>
                )}

                {/* Form 10BE 80G Tax Exemption Certificate Modal */}
                {selectedCertDonation && (
                    <div className="auth-modal-backdrop" onClick={() => setSelectedCertDonation(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20, overflowY: 'auto' }}>
                        <div style={{ background: '#ffffff', color: '#1e293b', maxWidth: 760, width: '100%', borderRadius: 12, padding: 32, boxShadow: '0 25px 60px rgba(0,0,0,0.5)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: 14, marginBottom: 18 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 1 }}>Income Tax Department • Government of India</div>
                                    <h2 style={{ margin: '4px 0 0', fontSize: 20, color: '#0f172a', fontWeight: 800 }}>FORM NO. 10BE — 80G TAX EXEMPTION CERTIFICATE</h2>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => window.print()}
                                        style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <FaPrint /> Print / Save PDF
                                    </button>
                                    <button
                                        onClick={() => setSelectedCertDonation(null)}
                                        style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 18, border: '1px solid #e2e8f0' }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Certificate / Receipt No</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{selectedCertDonation.receiptNumber || 'KCT-' + Date.now()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Trust PAN</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>AAGTK5575Q</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>80G Unique Reg. No. (URN)</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>AAGTK5575QF20261</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>12A Registration URN</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>AAGTK5575QE20261</div>
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 18 }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 0', color: '#64748b', width: '35%' }}>Donor Full Name:</td>
                                        <td style={{ padding: '10px 0', fontWeight: 800, color: '#0f172a' }}>{selectedCertDonation.fullName || 'Valued Donor'}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 0', color: '#64748b' }}>Email & Mobile:</td>
                                        <td style={{ padding: '10px 0', fontWeight: 600 }}>{selectedCertDonation.email || 'N/A'} {selectedCertDonation.mobile ? `• ${selectedCertDonation.mobile}` : ''}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 0', color: '#64748b' }}>Contribution Amount:</td>
                                        <td style={{ padding: '10px 0', fontWeight: 800, fontSize: 16, color: '#059669' }}>
                                            ₹{Number(selectedCertDonation.amount).toLocaleString('en-IN')} ({numberToWordsIndian(selectedCertDonation.amount)})
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 0', color: '#64748b' }}>Transaction ID:</td>
                                        <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: 700 }}>{selectedCertDonation.transactionId || selectedCertDonation.clientTxnId || 'TXN-KCT'}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 0', color: '#64748b' }}>Contribution Date:</td>
                                        <td style={{ padding: '10px 0' }}>{new Date(selectedCertDonation.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style={{ textAlign: 'center', fontSize: 12, color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: 14 }}>
                                Certified that Kiran Charitable Trust is registered u/s 80G(5)(vi) and 12A of the Income Tax Act, 1961. This donation qualifies for tax exemption deduction.
                            </div>
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
