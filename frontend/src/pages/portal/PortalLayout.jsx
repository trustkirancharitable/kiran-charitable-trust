import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import KLogo from '../../assets/Klogo.jpeg';
import './Portal.css';

export default function PortalLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="pt-shell">
      {/* ── Fixed Portal Header ── */}
      <header className="pt-nav">
        <div className="pt-nav-container">
          <div className="pt-nav-left">
            <Link to="/portal" className="pt-nav-logo-link" onClick={() => setMobileOpen(false)}>
              <div className="pt-nav-logo-wrap">
                <img src={KLogo} alt="Kiran Charitable Trust" className="pt-nav-logo-img" />
              </div>
              <span className="pt-nav-badge">Trust Portal</span>
            </Link>

            <nav className="pt-nav-links pt-desktop-only">
              <NavLink to="/portal" end className={({ isActive }) => `pt-nav-item ${isActive ? 'active' : ''}`}>
                🏠 Overview
              </NavLink>
              <NavLink to="/portal/join" className={({ isActive }) => `pt-nav-item ${isActive ? 'active' : ''}`}>
                🏛️ Become a Member
              </NavLink>
              <NavLink to="/portal/members" className={({ isActive }) => `pt-nav-item ${isActive ? 'active' : ''}`}>
                👥 Trust Members
              </NavLink>
              <NavLink to="/portal/donors" className={({ isActive }) => `pt-nav-item ${isActive ? 'active' : ''}`}>
                🏆 Top Donors
              </NavLink>
              <NavLink to="/portal/monthly-donor" className={({ isActive }) => `pt-nav-item ${isActive ? 'active' : ''}`}>
                💖 Monthly Giving
              </NavLink>
              <NavLink to="/portal/stats" className={({ isActive }) => `pt-nav-item ${isActive ? 'active' : ''}`}>
                📊 Impact Dashboard
              </NavLink>
            </nav>
          </div>

          <div className="pt-nav-right pt-desktop-only">
            <Link to="/" className="pt-nav-home-btn" title="Back to main website">
              ← Main Site
            </Link>

            {isAuthenticated && user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Link
                  to="/portal/profile"
                  className="pt-user-badge"
                >
                  <div className="pt-user-avatar">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <span>{user.name.split(' ')[0]}</span>
                </Link>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="pt-signout-btn"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <Link
                  to="/portal/login"
                  className="pt-btn-login"
                >
                  🔑 Sign In
                </Link>
                <Link to="/portal/join" className="pt-btn-cta">
                  🏛️ Join as Member
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className="pt-nav-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* ── Mobile Dropdown Drawer ── */}
        {mobileOpen && (
          <div className="pt-mobile-drawer">
            <nav className="pt-mobile-nav-links">
              <NavLink
                to="/portal"
                end
                className={({ isActive }) => `pt-mobile-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                🏠 Overview
              </NavLink>
              <NavLink
                to="/portal/join"
                className={({ isActive }) => `pt-mobile-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                🏛️ Become a Trust Member
              </NavLink>
              <NavLink
                to="/portal/members"
                className={({ isActive }) => `pt-mobile-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                👥 Trust Members Directory
              </NavLink>
              <NavLink
                to="/portal/donors"
                className={({ isActive }) => `pt-mobile-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                🏆 Top Donors Leaderboard
              </NavLink>
              <NavLink
                to="/portal/monthly-donor"
                className={({ isActive }) => `pt-mobile-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                💖 Monthly Giving Society
              </NavLink>
              <NavLink
                to="/portal/stats"
                className={({ isActive }) => `pt-mobile-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                📊 Impact & Velocity Dashboard
              </NavLink>
            </nav>

            <div className="pt-mobile-actions">
              <Link
                to="/"
                className="pt-mobile-home-btn"
                onClick={() => setMobileOpen(false)}
              >
                ← Back to Main Website
              </Link>

              {isAuthenticated && user ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <Link
                    to="/portal/profile"
                    className="pt-btn-cta"
                    style={{ justifyContent: 'center' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    👤 My Member Account ({user.name})
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="pt-signout-btn"
                    style={{ padding: '0.7rem', width: '100%' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <Link
                    to="/portal/login"
                    className="pt-btn-login"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    🔑 Sign In
                  </Link>
                  <Link
                    to="/portal/join"
                    className="pt-btn-cta"
                    style={{ flex: 1.3, justifyContent: 'center' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    🏛️ Join as Member
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Main Route Outlet ── */}
      <main className="pt-main">
        <Outlet />
      </main>

      {/* ── Fixed Portal Footer ── */}
      <footer className="pt-footer">
        <div>
          <strong>Kiran Charitable Trust</strong> • Official Membership & Donor Portal • Regd. No. 462/2004 under AP Societies Act • 80G & 12A Certified
        </div>
        <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <Link to="/">Main Website</Link>
          <Link to="/portal/join">Become a Member</Link>
          <Link to="/portal/members">Trust Members</Link>
          <Link to="/portal/donors">Top Donors</Link>
          <Link to="/portal/monthly-donor">Monthly Giving</Link>
          <Link to="/portal/stats">Dashboard</Link>
          <Link to="/portal/login">Supporter Sign In</Link>
          <Link to="/donate">Direct Donation</Link>
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/terms-conditions">Terms</Link>
        </div>
        <div style={{ marginTop: '1.25rem', color: '#64748B', fontSize: '0.8rem' }}>
          © {new Date().getFullYear()} Kiran Charitable Trust. All rights reserved. Mandepudi, Amaravathi, Palnadu - 522018
        </div>
      </footer>
    </div>
  );
}
