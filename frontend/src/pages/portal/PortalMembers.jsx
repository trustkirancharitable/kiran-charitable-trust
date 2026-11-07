import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Portal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function getTierPillClass(tier = '') {
  const t = tier.toLowerCase();
  if (t.includes('diamond') || t.includes('custom')) return 'pt-pill-diamond';
  if (t.includes('gold')) return 'pt-pill-gold';
  if (t.includes('silver')) return 'pt-pill-silver';
  return 'pt-pill-starter';
}

function getTierLabel(tier = '') {
  const t = tier.toLowerCase();
  if (t.includes('diamond') || t.includes('custom')) return '💎 Diamond Patron';
  if (t.includes('gold')) return '🥇 Gold Patron';
  if (t.includes('silver')) return '🥈 Silver Patron';
  return '🥉 Starter Patron';
}

export default function PortalMembers() {
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await fetch(`${API}/api/trust-members/public-list`);
        const json = await res.json();
        if (json.success && json.members) {
          setMembers(json.members);
          setFiltered(json.members);
        }
      } catch (e) {
        console.warn('Member fetch error:', e.message);
      }
      setLoading(false);
    }
    loadMembers();
  }, []);

  useEffect(() => {
    let list = members;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q));
    }
    if (tierFilter !== 'ALL') {
      list = list.filter(m => (m.subscriptionTier || '').toLowerCase().includes(tierFilter.toLowerCase()));
    }
    setFiltered(list);
  }, [search, tierFilter, members]);

  return (
    <div>
      {/* ── Banner ── */}
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Public Directory</span>
        <h1 className="pt-page-heading">
          Official <span>Trust Members</span>
        </h1>
        <p className="pt-page-sub">
          Honoring our certified Trust Members whose ongoing commitment sustains Kiran Charitable Trust's mission across Andhra Pradesh.
        </p>
      </section>

      {/* ── Grid Container ── */}
      <div className="pt-container">
        {/* Search & Filter Bar */}
        <div className="pt-filter-bar">
          <input
            type="text"
            className="pt-search-input"
            placeholder="🔍 Search by name or Member ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['ALL', 'Diamond', 'Gold', 'Silver', 'Starter'].map(tier => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: 50,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1.5px solid var(--pt-border)',
                  background: tierFilter === tier ? 'var(--pt-primary)' : '#FFFFFF',
                  color: tierFilter === tier ? '#FFFFFF' : 'var(--pt-text-gray)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tier === 'ALL' ? 'All Members' : `${tier} Patrons`}
              </button>
            ))}
          </div>
        </div>

        {/* Member Cards Grid */}
        {loading ? (
          <div className="pt-members-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="pt-member-card" style={{ opacity: 0.6 }}>
                <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#E2E8F0', margin: '0 auto 1rem' }} />
                <div style={{ height: 18, background: '#E2E8F0', borderRadius: 4, width: '60%', margin: '0 auto 8px' }} />
                <div style={{ height: 14, background: '#E2E8F0', borderRadius: 4, width: '40%', margin: '0 auto' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--pt-text-light)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👥</div>
            <h3 style={{ color: 'var(--pt-secondary)', marginBottom: '0.5rem' }}>No Trust Members Found</h3>
            <p>Try adjusting your search criteria or register as a new member.</p>
          </div>
        ) : (
          <div className="pt-members-grid">
            {filtered.map((m, idx) => (
              <div key={m.memberId || idx} className="pt-member-card">
                <div className="pt-member-avatar">
                  {m.profilePhoto ? (
                    <img src={m.profilePhoto} alt={m.name} />
                  ) : (
                    getInitials(m.name)
                  )}
                </div>
                <h4 className="pt-member-name">{m.name}</h4>
                <div className="pt-member-id">{m.memberId}</div>
                <div className={`pt-member-pill ${getTierPillClass(m.subscriptionTier || '')}`}>
                  {getTierLabel(m.subscriptionTier || '')}
                </div>
                <div className="pt-member-date">
                  Member since {m.joinDate ? new Date(m.joinDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '2024'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Call to action footer */}
        <div style={{ marginTop: '4rem', textAlign: 'center', background: 'var(--pt-bg-light)', padding: '2.5rem', borderRadius: 16, border: '1.5px solid var(--pt-border)' }}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.5rem' }}>
            Want to Join Our Official Trust Directory?
          </h3>
          <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.95rem', marginBottom: '1.5rem', maxWidth: 480, margin: '0 auto 1.5rem' }}>
            Register as a Trust Member to receive your official membership card, 80G tax exemptions, and featured recognition on this directory.
          </p>
          <Link to="/portal/join" className="pt-btn-cta" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
            🏛️ Become a Member Today
          </Link>
        </div>
      </div>
    </div>
  );
}
