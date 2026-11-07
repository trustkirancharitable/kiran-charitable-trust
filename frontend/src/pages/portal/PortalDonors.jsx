import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Portal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function formatINR(n) {
  if (!n && n !== 0) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

export default function PortalDonors() {
  const [tab, setTab] = useState('alltime');
  const [data, setData] = useState({ allTimeTop: [], monthlyTop: [], month: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const res = await fetch(`${API}/api/donors/leaderboard`);
        const json = await res.json();
        if (json.success) setData(json);
      } catch (e) {
        console.warn('Leaderboard error:', e.message);
      }
      setLoading(false);
    }
    loadLeaderboard();
  }, []);

  const list = (tab === 'alltime' ? data.allTimeTop : data.monthlyTop).slice(0, 10);
  const top3 = list.slice(0, 3);

  const getRankBadgeClass = r => r === 1 ? 'badge-gold' : r === 2 ? 'badge-silver' : r === 3 ? 'badge-bronze' : 'badge-reg';
  const getRowClass = r => r === 1 ? 'top-1' : r === 2 ? 'top-2' : r === 3 ? 'top-3' : '';

  return (
    <div>
      {/* ── Banner ── */}
      <section className="pt-page-banner">
        <span className="pt-page-tag">✦ Hall of Fame</span>
        <h1 className="pt-page-heading">
          Top <span>Donors Leaderboard</span>
        </h1>
        <p className="pt-page-sub">
          Recognizing our top 10 contributors ordered from highest to lowest in appreciation of their dedication to transforming lives.
        </p>
      </section>

      {/* ── Leaderboard Container ── */}
      <div className="pt-container">
        {/* Tab switcher */}
        <div className="pt-donors-tabs">
          <button className={`pt-tab-btn ${tab === 'alltime' ? 'active' : ''}`} onClick={() => setTab('alltime')}>
            🏆 All-Time Top 10
          </button>
          <button className={`pt-tab-btn ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>
            📅 {data.month || 'This Month'}
          </button>
        </div>

        <div className="pt-leaderboard-box">
          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div className="pt-podium">
              {/* Rank 2 */}
              <div className="pt-podium-col">
                <div className="pt-podium-avatar p-2">
                  {top3[1]?.photo ? <img src={top3[1].photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(top3[1]?.name)}
                </div>
                <div className="pt-podium-name">{top3[1]?.name}</div>
                <div className="pt-podium-amt">{formatINR(top3[1]?.totalDonated)}</div>
                <div className="pt-podium-base p-base-2">2</div>
              </div>

              {/* Rank 1 */}
              <div className="pt-podium-col">
                <div className="pt-podium-avatar p-1">
                  <span className="pt-crown">👑</span>
                  {top3[0]?.photo ? <img src={top3[0].photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(top3[0]?.name)}
                </div>
                <div className="pt-podium-name" style={{ fontWeight: 800 }}>{top3[0]?.name}</div>
                <div className="pt-podium-amt" style={{ fontSize: '1.25rem' }}>{formatINR(top3[0]?.totalDonated)}</div>
                <div className="pt-podium-base p-base-1">1</div>
              </div>

              {/* Rank 3 */}
              <div className="pt-podium-col">
                <div className="pt-podium-avatar p-3">
                  {top3[2]?.photo ? <img src={top3[2].photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(top3[2]?.name)}
                </div>
                <div className="pt-podium-name">{top3[2]?.name}</div>
                <div className="pt-podium-amt">{formatINR(top3[2]?.totalDonated)}</div>
                <div className="pt-podium-base p-base-3">3</div>
              </div>
            </div>
          )}

          {/* Ranked rows (Rank 1 to 10 High to Low) */}
          {list.map((d, idx) => (
            <div key={idx} className={`pt-donor-row ${getRowClass(d.rank)}`}>
              <div className={`pt-rank-badge ${getRankBadgeClass(d.rank)}`}>{d.rank}</div>
              <div className="pt-donor-photo">
                {d.photo ? <img src={d.photo} alt="" /> : getInitials(d.name)}
              </div>
              <div className="pt-donor-body">
                <div className="pt-donor-title">{d.name || 'Valued Donor'}</div>
                <div className="pt-donor-sub">{d.count} recorded contribution{d.count !== 1 ? 's' : ''}</div>
              </div>
              <div className="pt-donor-amount">
                {formatINR(d.totalDonated)}
                <span>Total Contributed</span>
              </div>
            </div>
          ))}

          {/* Bottom Donate Call to Action */}
          <div style={{ textAlign: 'center', marginTop: '3.5rem', background: '#F8FAFC', padding: '2.5rem', borderRadius: 16, border: '1.5px solid var(--pt-border)' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
              Every Contribution Creates Lasting Impact
            </h3>
            <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
              Support education, healthcare, and nutrition initiatives in Andhra Pradesh. All donations qualify for 80G tax exemptions.
            </p>
            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/donate" className="pt-btn-cta" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
                ❤️ Make a Donation
              </Link>
              <Link to="/portal/join" style={{ padding: '0.8rem 1.8rem', borderRadius: 50, border: '1.5px solid var(--pt-border)', color: 'var(--pt-secondary)', textDecoration: 'none', fontWeight: 700 }}>
                🏛️ Join as Monthly Member
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
