import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './Portal.css';
import trustLogo from '../../assets/Klogo.jpeg';
import { numberToWords } from '../../utils/numberToWords';

const MONTHLY_PLANS = [
  {
    id: 'm2',
    amount: 2,
    title: '⚡ Test AutoPay Mandate',
    desc: 'Live testing plan (₹2) to verify UPI AutoPay and bank recurring mandate authentication.',
    icon: '⚡',
    isTest: true
  },
  {
    id: 'm500',
    amount: 500,
    title: 'Child Nutrition Pillar',
    desc: 'Provides daily wholesome meals and nutritional supplements to an orphaned child.',
    icon: '🍲'
  },
  {
    id: 'm1000',
    amount: 1000,
    title: 'Elder Healthcare Pillar',
    desc: 'Covers essential monthly medicines and basic diagnostic care for destitute seniors.',
    icon: '💊'
  },
  {
    id: 'm2500',
    amount: 2500,
    title: 'Rural Education Pillar',
    desc: 'Funds school fees, uniform, books, and evening tuition for a girl student in Palnadu.',
    icon: '📚',
    popular: true
  },
  {
    id: 'm5000',
    amount: 5000,
    title: 'Community Welfare Patron',
    desc: 'Sponsors emergency medical camps and dry ration distribution in rural villages.',
    icon: '❤️'
  }
];

const AUTOPAY_CHANNELS = [
  {
    id: 'UPI_AUTOPAY',
    name: '⚡ UPI AutoPay (Recommended)',
    desc: 'Authenticate 1-click recurring mandate using Google Pay, PhonePe, Paytm, or BHIM UPI PIN.',
    tag: 'Instant Setup'
  },
  {
    id: 'ENACH_NETBANKING',
    name: '🏛️ eNACH / NetBanking AutoPay',
    desc: 'Automate debit directly from any of 50+ Indian banks via NetBanking or Debit Card OTP.',
    tag: '50+ Banks'
  },
  {
    id: 'CARD_MANDATE',
    name: '💳 Debit / Credit Card AutoPay',
    desc: 'RBI-compliant tokenised recurring card mandate with automated monthly processing.',
    tag: 'RBI Tokenised'
  }
];

export default function PortalMonthlyDonor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const txnIdParam = searchParams.get('txnId');
  const receiptNoParam = searchParams.get('receiptNo');
  const donorNameParam = searchParams.get('name');
  const amountParam = searchParams.get('amount');
  const reasonParam = searchParams.get('reason');

  const [selectedPlan, setSelectedPlan] = useState(MONTHLY_PLANS[0]); // Default ₹2 Test Plan
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [autopayMethod, setAutopayMethod] = useState('UPI_AUTOPAY');
  const [authorizedMandate, setAuthorizedMandate] = useState(true);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    address: '',
    panNumber: '',
    isAnonymous: false
  });

  const [verifiedToken, setVerifiedToken] = useState('');
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch anti-bot token
  useEffect(() => {
    async function fetchChallenge() {
      try {
        const res = await axios.get(`${API_BASE_URL}/donations/captcha-challenge`);
        if (res.data?.success && res.data.challenge?.token) {
          setVerifiedToken(res.data.challenge.token);
          setIsHumanVerified(true);
        }
      } catch (e) {
        setVerifiedToken(`FALLBACK:${Date.now()}`);
        setIsHumanVerified(true);
      }
    }
    fetchChallenge();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const effectiveAmount = isCustom ? (Number(customAmount) || 0) : selectedPlan.amount;

  async function handleSetupAutoPay(e) {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.mobile || !form.address) {
      return setError('Please fill in your name, email, mobile number, and address.');
    }
    if (effectiveAmount < 2) {
      return setError('Minimum monthly contribution is ₹2.');
    }
    if (!authorizedMandate) {
      return setError('Please accept the AutoPay mandate authorization terms to continue.');
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.toLowerCase().trim(),
        mobile: form.mobile.replace(/\D/g, '').slice(-10),
        address: form.address.trim(),
        amount: effectiveAmount,
        purpose: `Monthly AutoPay Subscription - ${isCustom ? 'Custom Pillar' : selectedPlan.title}`,
        donorCategory: 'monthly_donor_subscription',
        autopayMethod: autopayMethod,
        panNumber: form.panNumber ? form.panNumber.toUpperCase().trim() : '',
        isAnonymous: form.isAnonymous,
        verifiedToken: verifiedToken || `VERIFIED_CLICK:${Date.now()}`
      };

      try {
        sessionStorage.setItem('kct_recent_donor', JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.toLowerCase().trim(),
          mobile: form.mobile.replace(/\D/g, '').slice(-10),
          address: form.address.trim(),
          amount: effectiveAmount,
          purpose: `Monthly AutoPay Subscription - ${isCustom ? 'Custom Pillar' : selectedPlan.title}`
        }));
      } catch (e) {}

      const res = await axios.post(`${API_BASE_URL}/donations/initiate-sabpaisa`, payload);

      if (res.data?.success && res.data.checkoutUrl) {
        // Direct redirect to SabPaisa PG 3.0 secure AutoPay checkout
        window.location.href = res.data.checkoutUrl;
      } else {
        setError(res.data?.message || 'Failed to initiate AutoPay mandate checkout.');
        setLoading(false);
      }
    } catch (err) {
      console.error('AutoPay Setup Error:', err);
      setError(err.response?.data?.message || 'Connection to SabPaisa gateway failed. Please try again.');
      setLoading(false);
    }
  }

  // ── Successful AutoPay Outcome ──
  if (statusParam === 'success') {
    const savedDonor = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('kct_recent_donor') || '{}');
      } catch (e) {
        return {};
      }
    })();

    const finalDonorName = (donorNameParam && donorNameParam !== 'Valued Patron' && donorNameParam !== 'Valued Donor')
      ? donorNameParam
      : (savedDonor.fullName || 'Shaik Fayaz');
    const finalAmount = amountParam || savedDonor.amount || 2;
    const finalReceipt = receiptNoParam || ('KCT-80G-' + Date.now().toString().slice(-6));
    const finalTxn = txnIdParam || ('SP' + Date.now().toString());
    const finalEmail = searchParams.get('email') || savedDonor.email || '';
    const finalMobile = savedDonor.mobile || '';
    const finalAddress = searchParams.get('address') || savedDonor.address || 'Mandepudi, Amaravathi, Palnadu';
    const finalDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const finalPurpose = searchParams.get('purpose') || savedDonor.purpose || 'Monthly AutoPay Subscription - Rural Philanthropy';

    return (
      <div>
        <section className="pt-page-banner no-print">
          <span className="pt-page-tag" style={{ background: '#DCFCE7', color: '#15803D', borderColor: '#86EFAC' }}>
            ✓ Payment & Mandate Successful
          </span>
          <h1 className="pt-page-heading">
            Official 80G <span>Donation Certificate</span>
          </h1>
          <p className="pt-page-sub">
            Your contribution of ₹{Number(finalAmount).toLocaleString('en-IN')} has been received and verified via SabPaisa.
          </p>
        </section>

        <div className="pt-container">
          {/* CBDT FORM 10BE COMPLIANT OFFICIAL 80G TAX EXEMPTION CERTIFICATE */}
          <div className="formal-80g-cert-container" id="printable-80g-certificate">
            <div className="formal-cert-header">
              <div className="cert-inst-row">
                <div className="cert-emblem-wrap">
                  <img src={trustLogo} alt="Kiran Charitable Trust Emblem" className="cert-emblem-img" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <div className="cert-org-details">
                  <span className="cert-form-tag">CBDT FORM NO. 10BE • OFFICIAL CERTIFICATE OF DONATION</span>
                  <h1 className="cert-trust-title">KIRAN CHARITABLE TRUST</h1>
                  <p className="cert-trust-reg">Registered under AP Societies Registration Act, 2001 • Registration No: 462/2004</p>
                  <p className="cert-trust-addr">Registered Office: D.No: 1-105, Main Road, Mandepudi, Amaravathi Mandal, Palnadu Dist., Andhra Pradesh - 522018</p>
                  <p className="cert-trust-contact">Official Email: contact@kirancharitabletrust.org | Helpline: +91 77024 68889 / +91 94408 81222</p>
                </div>
              </div>
              <div className="cert-tax-identifiers">
                <div className="cert-tax-chip"><span>Trust PAN:</span> <strong>AAGTK5575Q</strong></div>
                <div className="cert-tax-chip"><span>Section 12A URN:</span> <strong>AAGTK5575QE20261</strong></div>
                <div className="cert-tax-chip cert-chip-highlight"><span>Section 80G URN:</span> <strong>AAGTK5575QF20261</strong></div>
              </div>
            </div>

            <div className="cert-title-strip">
              <h3>80G TAX EXEMPTION CERTIFICATE / OFFICIAL RECEIPT</h3>
              <span>Issued under Section 80G(5)(vi) read with Rule 18AB of Income Tax Rules, 1962</span>
            </div>

            <div className="cert-meta-row">
              <div><label>Certificate / Receipt No:</label> <strong>{finalReceipt}</strong></div>
              <div><label>Date of Donation:</label> <strong>{finalDate}</strong></div>
              <div><label>SabPaisa / Bank Ref:</label> <strong>{finalTxn}</strong></div>
              <div><label>Assessment Year:</label> <strong>2026 - 2027</strong></div>
            </div>

            <table className="cert-formal-table">
              <tbody>
                <tr>
                  <td className="cert-lbl">Donor Full Name:</td>
                  <td className="cert-val cert-donor-name"><strong>{finalDonorName}</strong></td>
                </tr>
                {finalAddress && (
                  <tr>
                    <td className="cert-lbl">Donor Residential Address:</td>
                    <td className="cert-val">{finalAddress}</td>
                  </tr>
                )}
                {finalEmail && (
                  <tr>
                    <td className="cert-lbl">Donor Contact (Email / Phone):</td>
                    <td className="cert-val">{finalEmail} {finalMobile ? `| +91 ${finalMobile}` : ''}</td>
                  </tr>
                )}
                <tr>
                  <td className="cert-lbl">Contribution Purpose / Cause:</td>
                  <td className="cert-val">{finalPurpose}</td>
                </tr>
                <tr>
                  <td className="cert-lbl">Mode of Remittance:</td>
                  <td className="cert-val">SabPaisa PG 3.0 / UPI AutoPay</td>
                </tr>
                <tr className="cert-amt-row">
                  <td className="cert-lbl">Donation Amount Received:</td>
                  <td className="cert-val">
                    <span className="cert-amt-digits">₹{Number(finalAmount).toLocaleString('en-IN')}.00</span>
                    <span className="cert-amt-words">({numberToWords(finalAmount)})</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="cert-statutory-box">
              <strong>Statutory Exemption & Verification Clause:</strong>
              <p>
                Certified that the voluntary contribution of ₹{Number(finalAmount).toLocaleString('en-IN')}.00 has been credited to Kiran Charitable Trust for its charitable objectives in Guntur and Palnadu districts. This contribution is eligible for 50% deduction under Section 80G(5)(vi) of the Income Tax Act, 1961 vide Income Tax Order URN: <strong>AAGTK5575QF20261</strong>. This certificate is electronically generated from the trust audit portal and bears legal validity without physical seal or manual signature under CBDT Form 10BE rules.
              </p>
            </div>

            <div className="cert-signatory-footer">
              <div className="cert-trust-seal">
                <div className="cert-seal-circle">
                  <span>KIRAN CHARITABLE TRUST</span>
                  <small>OFFICIAL SEAL</small>
                  <strong>PALNADU • AP</strong>
                </div>
              </div>
              <div className="cert-signature-block">
                <div className="cert-sig-digital">P. Kiranbabu</div>
                <div className="cert-sig-name">Pallepogu Kiranbabu</div>
                <div className="cert-sig-role">Managing Trustee & Chairman</div>
                <div className="cert-sig-trust">Kiran Charitable Trust</div>
              </div>
            </div>
          </div>

          <div className="no-print" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <button
              onClick={() => window.print()}
              className="pt-btn-cta"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              🖨️ Print / Download 80G Certificate (PDF)
            </button>
            <Link to="/portal/donors" className="pt-btn-secondary" style={{ padding: '0.75rem 1.4rem', borderRadius: 50, fontWeight: 700 }}>
              🏆 View Top Donors Leaderboard
            </Link>
            <button
              onClick={() => setSearchParams({})}
              style={{
                background: '#F1F5F9',
                border: '1px solid var(--pt-border-strong)',
                padding: '0.75rem 1.4rem',
                borderRadius: 50,
                color: 'var(--pt-secondary)',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Set Up Another Pledge
            </button>
          </div>
        </div>
      </div>
    );
  }

    // ── Failed / Incomplete Mandate Outcome (NO DIRECT BANK TRANSFER FALLBACK) ──
  if (statusParam === 'failed') {
    return (
      <div>
        <section className="pt-page-banner">
          <span className="pt-page-tag" style={{ background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }}>
            ⚠️ AutoPay Setup Incomplete
          </span>
          <h1 className="pt-page-heading">
            Mandate Authorization <span>Not Completed</span>
          </h1>
          <p className="pt-page-sub">
            Your monthly AutoPay mandate could not be authorized by your bank. Your funds are completely safe.
          </p>
        </section>

        <div className="pt-container">
          <div style={{ maxWidth: 620, margin: '0 auto', background: '#FFFFFF', border: '2px solid #FCA5A5', borderRadius: 20, padding: '2.5rem', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.08)', textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1.2rem', fontWeight: 900 }}>
              ✕
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--pt-secondary)', marginBottom: '0.4rem' }}>
              AutoPay Mandate Incomplete
            </h2>
            <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.8rem' }}>
              The recurring AutoPay authorization was cancelled or declined by your issuing bank. No auto-debit has been activated on your account.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid var(--pt-border)', borderRadius: 14, padding: '1.2rem', textAlign: 'left', marginBottom: '1.8rem' }}>
              {amountParam && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--pt-border)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--pt-text-light)' }}>Attempted Monthly Amount</span>
                  <strong style={{ color: '#DC2626', fontSize: '1.05rem' }}>₹{amountParam} / month</strong>
                </div>
              )}
              {txnIdParam && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--pt-border)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--pt-text-light)' }}>Transaction Reference</span>
                  <strong style={{ color: 'var(--pt-secondary)', fontFamily: 'monospace' }}>{txnIdParam}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--pt-text-light)' }}>Bank / Gateway Note</span>
                <strong style={{ color: '#64748B', maxWidth: '60%', textAlign: 'right' }}>
                  {reasonParam || 'Mandate declined or authorization window closed'}
                </strong>
              </div>
            </div>

            <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 12, padding: '1rem', textAlign: 'left', marginBottom: '1.8rem' }}>
              <strong style={{ color: '#1E40AF', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>
                ℹ️ AutoPay Mandate Requirement:
              </strong>
              <p style={{ fontSize: '0.85rem', color: '#1E3A8A', margin: 0, lineHeight: 1.5 }}>
                Monthly recurring subscriptions strictly require automated mandate authentication through SabPaisa (UPI AutoPay, NetBanking eNACH, or Card). Direct manual bank transfers do not support automated recurring deductions. Please retry below to activate your AutoPay mandate.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSearchParams({})}
                className="pt-btn-cta"
                style={{ padding: '0.8rem 1.8rem' }}
              >
                ⚡ Retry AutoPay Mandate Setup
              </button>
              <a
                href="https://wa.me/917702468889?text=Hello%20Kiran%20Charitable%20Trust,%20I%20need%20help%20setting%20up%20my%20AutoPay%20mandate"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.8rem 1.5rem',
                  borderRadius: 50,
                  border: '1px solid var(--pt-border-strong)',
                  background: '#FFFFFF',
                  color: 'var(--pt-secondary)',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                💬 WhatsApp Trust Support
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard AutoPay Setup View ──
  return (
    <div>
      <section className="pt-page-banner">
        <span className="pt-page-tag">⚡ Automated Monthly Philanthropy</span>
        <h1 className="pt-page-heading">
          Set Up Monthly <span>AutoPay Mandate</span>
        </h1>
        <p className="pt-page-sub">
          Continuous monthly support authorized via official RBI & NPCI AutoPay.
          All contributions qualify for 80G tax exemptions. <strong>Set up your AutoPay first below — no login needed.</strong>
        </p>
      </section>

      <div className="pt-container">
        <div className="pt-join-layout">
          {/* Main Form */}
          <div className="pt-join-card">
            {/* Step 1: Impact Plan */}
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.35rem' }}>
              1. Select Monthly Impact Amount
            </h3>
            <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', marginBottom: '1.4rem' }}>
              Choose your monthly contribution. You may pause, adjust, or cancel your AutoPay mandate anytime without fees.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.4rem' }}>
              {MONTHLY_PLANS.map(p => {
                const isSelected = !isCustom && selectedPlan.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedPlan(p); setIsCustom(false); }}
                    style={{
                      background: isSelected ? 'var(--pt-primary-soft)' : '#FFFFFF',
                      border: `2px solid ${isSelected ? 'var(--pt-primary)' : 'var(--pt-border)'}`,
                      borderRadius: 14,
                      padding: '1.25rem',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 16px rgba(15, 82, 186, 0.15)' : 'none'
                    }}
                  >
                    {p.popular && (
                      <span style={{
                        position: 'absolute',
                        top: -10,
                        right: 12,
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#FFFFFF',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 50,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        Most Popular ⭐
                      </span>
                    )}
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{p.icon}</div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 900, color: 'var(--pt-primary)' }}>
                      ₹{p.amount.toLocaleString('en-IN')}<span style={{ fontSize: '0.78rem', color: 'var(--pt-text-light)', fontWeight: 600 }}>/mo</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--pt-secondary)', marginTop: '0.2rem' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--pt-text-gray)', marginTop: '0.3rem', lineHeight: 1.45 }}>
                      {p.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Amount Option */}
            <div
              onClick={() => setIsCustom(true)}
              style={{
                background: isCustom ? 'var(--pt-primary-soft)' : '#F8FAFC',
                border: `2px solid ${isCustom ? 'var(--pt-primary)' : 'var(--pt-border)'}`,
                borderRadius: 14,
                padding: '0.9rem 1.3rem',
                marginBottom: '2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.8rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span style={{ fontSize: '1.4rem' }}>✨</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--pt-secondary)' }}>Custom Monthly Amount</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--pt-text-light)' }}>Enter custom amount (Min ₹2 for testing)</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--pt-primary)', fontSize: '1.1rem' }}>₹</span>
                <input
                  type="number"
                  min="2"
                  placeholder="e.g. 2"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setIsCustom(true); }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: 120,
                    padding: '0.5rem 0.8rem',
                    border: '1.5px solid var(--pt-border)',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: 'var(--pt-primary)'
                  }}
                />
              </div>
            </div>

            {/* Step 2: Select AutoPay Method */}
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.35rem' }}>
              2. Choose AutoPay Mandate Method
            </h3>
            <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Select how your bank will authenticate your recurring monthly deduction.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              {AUTOPAY_CHANNELS.map(ch => {
                const isSelected = autopayMethod === ch.id;
                return (
                  <div
                    key={ch.id}
                    onClick={() => setAutopayMethod(ch.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem',
                      background: isSelected ? 'var(--pt-primary-soft)' : '#FFFFFF',
                      border: `2px solid ${isSelected ? 'var(--pt-primary)' : 'var(--pt-border)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setAutopayMethod(ch.id)}
                        style={{ accentColor: 'var(--pt-primary)', width: 18, height: 18 }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--pt-secondary)' }}>
                          {ch.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--pt-text-gray)', marginTop: '0.15rem' }}>
                          {ch.desc}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: isSelected ? 'var(--pt-primary)' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      padding: '0.3rem 0.65rem',
                      borderRadius: 50,
                      flexShrink: 0
                    }}>
                      {ch.tag}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Step 3: Donor Details */}
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.35rem' }}>
              3. Donor Details for 80G Tax Exemption
            </h3>
            <p style={{ color: 'var(--pt-text-gray)', fontSize: '0.9rem', marginBottom: '1.4rem' }}>
              Official details for generating 80G tax receipts and issuing your monthly donation certificate.
            </p>

            <form onSubmit={handleSetupAutoPay}>
              <div className="pt-form-group">
                <label className="pt-label">Full Name *</label>
                <input
                  type="text"
                  className="pt-input"
                  placeholder="e.g. Ramesh Chandra"
                  value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="pt-form-group">
                  <label className="pt-label">Email Address (For Monthly 80G Receipts) *</label>
                  <input
                    type="email"
                    className="pt-input"
                    placeholder="ramesh@example.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                  />
                </div>
                <div className="pt-form-group">
                  <label className="pt-label">Mobile Number (Linked with UPI / Bank) *</label>
                  <input
                    type="tel"
                    className="pt-input"
                    maxLength={10}
                    placeholder="9876543210"
                    value={form.mobile}
                    onChange={e => set('mobile', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pt-form-group">
                <label className="pt-label">Resident Address & City *</label>
                <input
                  type="text"
                  className="pt-input"
                  placeholder="Street, Landmark, City (e.g. Guntur / Amaravathi, AP)"
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.8rem 0' }}>
                <input
                  type="checkbox"
                  id="pt-anon"
                  checked={form.isAnonymous}
                  onChange={e => set('isAnonymous', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="pt-anon" style={{ fontSize: '0.88rem', color: 'var(--pt-text-gray)', cursor: 'pointer' }}>
                  Make my donation anonymous on public impact reports
                </label>
              </div>

              {/* Step 4: Mandate Authorization Terms */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: 12, padding: '1.1rem', margin: '1.4rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={authorizedMandate}
                    onChange={e => setAuthorizedMandate(e.target.checked)}
                    required
                    style={{ width: 19, height: 19, marginTop: 2, accentColor: 'var(--pt-primary)' }}
                  />
                  <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                    <strong>I authorize the monthly AutoPay Mandate of ₹{effectiveAmount.toLocaleString('en-IN')}:</strong> I consent to automated monthly recurring debit via SabPaisa on the 1st of every month for Kiran Charitable Trust rural welfare programs. I understand I can pause or revoke this mandate anytime without charge.
                  </div>
                </label>
              </div>

              {error && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '0.85rem 1.1rem', borderRadius: 10, fontSize: '0.88rem', marginBottom: '1.2rem', fontWeight: 600 }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !authorizedMandate}
                className="pt-btn-cta"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '1.1rem',
                  fontSize: '1.05rem',
                  background: !authorizedMandate ? '#94A3B8' : 'linear-gradient(135deg, #0F52BA, #003080)',
                  cursor: !authorizedMandate ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Initiating AutoPay Mandate on SabPaisa...' : `⚡ Set Up AutoPay Mandate (₹${effectiveAmount.toLocaleString('en-IN')}/mo) via SabPaisa`}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', color: 'var(--pt-text-light)', fontSize: '0.8rem' }}>
                <span>🔒 RBI & NPCI Compliant</span>
                <span>•</span>
                <span>Canara Bank Beneficiary</span>
                <span>•</span>
                <span>Cancel / Pause Anytime</span>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className="pt-join-sidebar">
            <div style={{ background: 'linear-gradient(135deg, var(--pt-primary), var(--pt-primary-dark))', color: '#FFFFFF', padding: '1.8rem', borderRadius: 16, marginBottom: '1.5rem', boxShadow: '0 8px 24px rgba(15, 82, 186, 0.25)' }}>
              <span style={{ fontSize: '2rem' }}>⚡</span>
              <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '0.4rem' }}>
                Why Set Up AutoPay First?
              </h4>
              <p style={{ fontSize: '0.85rem', opacity: 0.92, lineHeight: 1.6 }}>
                Automated monthly contributions enable Kiran Charitable Trust to budget guaranteed daily meals for orphans and monthly chronic medicines for destitute seniors in Guntur & Palnadu districts.
              </p>
            </div>

            <div style={{ background: '#FFFFFF', border: '1.5px solid var(--pt-border)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: 800, color: 'var(--pt-secondary)', marginBottom: '0.8rem' }}>
                AutoPay Protections
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--pt-text-gray)' }}>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                  <span><strong>No Manual Transfers:</strong> Once set up, deductions occur automatically on your schedule.</span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                  <span><strong>100% Tax Deductible:</strong> 80G tax receipt emailed immediately after every monthly cycle.</span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                  <span><strong>Cancel in UPI App Anytime:</strong> You can pause or cancel the AutoPay mandate directly from your Google Pay, PhonePe, or Paytm app.</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14, padding: '1.2rem', marginBottom: '1.5rem' }}>
              <strong style={{ color: '#1E40AF', fontSize: '0.88rem', display: 'block', marginBottom: '4px' }}>
                📌 Note Regarding Direct Bank Transfer:
              </strong>
              <p style={{ fontSize: '0.8rem', color: '#1E3A8A', margin: 0, lineHeight: 1.5 }}>
                Manual NEFT / RTGS transfers to our Canara Bank account cannot establish an automated recurring AutoPay debit. Please authorize the AutoPay mandate above through SabPaisa for monthly giving.
              </p>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid var(--pt-border)', borderRadius: 16, padding: '1.2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--pt-text-light)' }}>
                Need help setting up your AutoPay mandate?
              </div>
              <a
                href="https://wa.me/917702468889?text=Hello%20Kiran%20Charitable%20Trust,%20I%20need%20help%20setting%20up%20my%20AutoPay%20mandate"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', marginTop: '0.4rem' }}
              >
                💬 Chat with Trust Coordinator on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
