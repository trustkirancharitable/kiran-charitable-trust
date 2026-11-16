import React, { useState } from 'react';
import {
    FaSyncAlt,
    FaIdCard,
    FaCreditCard,
    FaShieldAlt,
    FaCheckCircle,
    FaLock
} from 'react-icons/fa';
import AutoPayForm from './AutoPayForm';
import DebitCardForm from './DebitCardForm';
import CreditCardForm from './CreditCardForm';
import './PaymentIntegrationHub.css';

export default function PaymentIntegrationHub({
    defaultTab = 'autopay',
    amount = 1000,
    purpose = 'General Charitable Trust Contribution',
    donorDetails = {},
    onPaymentSuccess,
    onPaymentError
}) {
    const [activeTab, setActiveTab] = useState(defaultTab); // 'autopay' | 'debit' | 'credit'

    return (
        <div className="payment-integration-hub">
            <div className="payment-hub-header">
                <h3>Secure Payment Gateway</h3>
                <div className="trust-badges">
                    <span className="badge"><FaShieldAlt /> 256-Bit SSL</span>
                    <span className="badge"><FaLock /> PCI-DSS</span>
                    <span className="badge"><FaCheckCircle /> RBI Mandate Verified</span>
                </div>
            </div>

            {/* Integration Method Tabs */}
            <div className="payment-method-nav">
                <button
                    type="button"
                    className={`method-nav-btn ${activeTab === 'autopay' ? 'active' : ''}`}
                    onClick={() => setActiveTab('autopay')}
                >
                    <FaSyncAlt className="tab-icon" />
                    <div>
                        <strong>AutoPay</strong>
                        <small>UPI & e-NACH Recurring</small>
                    </div>
                </button>

                <button
                    type="button"
                    className={`method-nav-btn ${activeTab === 'debit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('debit')}
                >
                    <FaIdCard className="tab-icon" />
                    <div>
                        <strong>Debit Card</strong>
                        <small>RuPay, Visa, MC (0% MDR)</small>
                    </div>
                </button>

                <button
                    type="button"
                    className={`method-nav-btn ${activeTab === 'credit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('credit')}
                >
                    <FaCreditCard className="tab-icon" />
                    <div>
                        <strong>Credit Card</strong>
                        <small>Domestic & Global (3DS 2.0)</small>
                    </div>
                </button>
            </div>

            {/* Tab Contents */}
            <div className="payment-tab-content">
                {activeTab === 'autopay' && (
                    <AutoPayForm
                        amount={amount}
                        purpose={purpose}
                        donorDetails={donorDetails}
                        onSuccess={onPaymentSuccess}
                        onError={onPaymentError}
                    />
                )}

                {activeTab === 'debit' && (
                    <DebitCardForm
                        amount={amount}
                        purpose={purpose}
                        donorDetails={donorDetails}
                        onSuccess={onPaymentSuccess}
                        onError={onPaymentError}
                    />
                )}

                {activeTab === 'credit' && (
                    <CreditCardForm
                        amount={amount}
                        purpose={purpose}
                        donorDetails={donorDetails}
                        onSuccess={onPaymentSuccess}
                        onError={onPaymentError}
                    />
                )}
            </div>
        </div>
    );
}
