import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { FaHeart, FaStar, FaAward, FaUser } from 'react-icons/fa';
import './DonorTicker.css';

export default function DonorTicker() {
    const [donors, setDonors] = useState([]);

    useEffect(() => {
        let isMounted = true;
        const fetchTicker = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/donors/ticker`);
                if (isMounted && res.data?.success && res.data.ticker) {
                    setDonors(res.data.ticker);
                }
            } catch (e) {
                console.warn('Ticker load notice:', e.message);
            }
        };

        fetchTicker();
        const interval = setInterval(fetchTicker, 60000); // Refresh every minute
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    if (donors.length === 0) return null;

    // Duplicate list for seamless infinite loop
    const displayList = [...donors, ...donors];

    return (
        <div className="donor-ticker-wrap">
            <div className="donor-ticker-badge">
                <FaStar style={{ color: '#ffffff' }} />
                <span>Honored Donors</span>
            </div>

            <div className="donor-ticker-track">
                {displayList.map((donor, idx) => {
                    const initials = donor.name
                        ? donor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        : 'KCT';

                    return (
                        <div key={idx} className={`donor-ticker-card ${donor.highlight ? 'highlight' : ''}`}>
                            {donor.photo ? (
                                <img
                                    src={donor.photo.startsWith('http') ? donor.photo : `${donor.photo}`}
                                    alt={donor.name}
                                    className="donor-ticker-avatar"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div
                                className="donor-ticker-avatar"
                                style={{ display: donor.photo ? 'none' : 'flex' }}
                            >
                                {initials}
                            </div>

                            <div className="donor-ticker-info">
                                <span className="donor-ticker-name">
                                    {donor.name}
                                    {donor.highlight && <FaAward style={{ color: '#f59e0b', fontSize: 11 }} />}
                                </span>
                                <span className="donor-ticker-tag">
                                    <span>{donor.tag}</span>
                                    <span>•</span>
                                    <span className="amount">₹{Number(donor.amount).toLocaleString('en-IN')}</span>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
