
function numberToWords(amount) {
    const num = Math.floor(Number(amount) || 0);
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convert(n) {
        if (n === 0) return '';
        if (n < 20) return a[n] + ' ';
        if (n < 100) return b[Math.floor(n / 10)] + ' ' + (n % 10 ? a[n % 10] + ' ' : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + (n % 100 ? convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 ? convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 ? convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 ? convert(n % 10000000) : '');
    }
    return num === 0 ? 'Zero Rupees Only' : 'Rupees ' + convert(num).trim() + ' Only';
}

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtpout.secureserver.net';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const EMAIL_USER = process.env.EMAIL_USER || 'contact@kirancharitabletrust.org';
const EMAIL_PASS = process.env.EMAIL_PASS || 'Kir@n_Charity@1988';

let transporter = null;

function getTransporter() {
    if (!transporter && EMAIL_PASS && EMAIL_PASS !== 'your_email_password') {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE, // true for 465 SSL
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }
    return transporter;
}

/**
 * Universal email dispatcher with fallback to console logging
 */
async function dispatchEmail({ to, subject, html, text }) {
    console.log(`📧 [EMAIL OUTBOUND] To: ${to} | Subject: "${subject}"`);
    const mailer = getTransporter();

    if (!mailer) {
        console.log(`ℹ️ [EMAIL SIMULATION MODE - No SMTP password configured]`);
        console.log(`Body preview:\n${text || html.slice(0, 300)}...`);
        return { success: true, simulated: true, to };
    }

    try {
        const info = await mailer.sendMail({
            from: `"Kiran Charitable Trust" <${EMAIL_USER}>`,
            to,
            subject,
            text,
            html
        });
        console.log(`✅ [EMAIL DISPATCHED] ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`❌ [EMAIL DISPATCH ERROR]:`, err.message);
        // Do not crash registration or payment flows if SMTP encounters error
        return { success: false, error: err.message };
    }
}

// 1. Send 6-Digit OTP Email
async function sendOtpEmail(email, otp) {
    const subject = `Your Verification Code: ${otp} - Kiran Charitable Trust`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #2563EB; padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Kiran Charitable Trust</h1>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Serving Guntur & Palnadu Since 2026</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">One-Time Verification Code</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                Use the security code below to complete your login / registration with Kiran Charitable Trust. This code will expire in <strong>10 minutes</strong>.
            </p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; text-align: center; margin: 28px 0; border: 2px dashed #cbd5e1;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563EB;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
                If you did not request this OTP, please disregard this email. Never share this code with anyone.
            </p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Kiran Charitable Trust • Regd No: 2026/GNT • Guntur, Andhra Pradesh, India
        </div>
    </div>`;

    return dispatchEmail({
        to: email,
        subject,
        html,
        text: `Your Kiran Charitable Trust verification code is: ${otp}. Valid for 10 minutes.`
    });
}

// 2. Send Volunteer Welcome & ID Confirmation
async function sendVolunteerWelcomeEmail(volunteer) {
    const subject = `Welcome to the Kiran Trust Family, ${volunteer.name}! (Volunteer ID: ${volunteer.uniqueId || 'KCT-VOL'})`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #10B981; padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Welcome Volunteer! 🤝</h1>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Kiran Charitable Trust • Dedicated Community Member</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">Dear ${volunteer.name},</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for stepping forward to serve the community of Guntur and Palnadu districts! Your registration as an Official Volunteer is officially active.
            </p>
            <div style="background: #f8fafc; border-left: 4px solid #10B981; padding: 18px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Volunteer ID:</strong> <span style="color: #2563EB; font-weight: 700;">${volunteer.uniqueId}</span></p>
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Membership Fee:</strong> ₹${volunteer.membershipFee} (Confirmed)</p>
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Contact Phone:</strong> ${volunteer.phone}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Registered Address:</strong> ${volunteer.address}</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                You can log into your member dashboard anytime to download your Official Digital Volunteer ID Card and track upcoming service programs.
            </p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Kiran Charitable Trust • Serving Humanity With Love & Compassion
        </div>
    </div>`;

    return dispatchEmail({
        to: volunteer.email,
        subject,
        html,
        text: `Welcome ${volunteer.name}! Your Volunteer ID is ${volunteer.uniqueId}. Membership fee ₹${volunteer.membershipFee} confirmed.`
    });
}

// 3. Send Trust Member Welcome & Next Month Schedule Notice
async function sendTrustMemberWelcomeEmail(member) {
    const dueDateFormatted = new Date(member.nextPaymentDueDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    const subject = `Welcome as an Honored Trust Member, ${member.name}! (Member ID: ${member.memberId})`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #6366F1; padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Trust Member Enrolled 🌟</h1>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Kiran Charitable Trust • Pillar of Sustained Giving</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">Dear ${member.name},</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                We are deeply grateful for your commitment to Kiran Charitable Trust as an official Trust Member. Your monthly pledge empowers our ongoing food distribution, orphan child care, and medical aid missions.
            </p>
            <div style="background: #f8fafc; border-left: 4px solid #6366F1; padding: 18px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Member ID:</strong> <span style="color: #6366F1; font-weight: 700;">${member.memberId}</span></p>
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Monthly Donation Pledge:</strong> ₹${member.donationAmount} / month</p>
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>First Payment Due Date:</strong> ${dueDateFormatted} (After 1 Month)</p>
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Aadhaar Record:</strong> Registered ending in ...${String(member.aadharNumber).slice(-4)}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Donor Wall Ranking:</strong> Enabled (Your photo & name will appear on our live donor marquee)</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                You will receive a gentle email reminder when your monthly pledge is due with a direct 1-click payment link.
            </p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Kiran Charitable Trust • Guntur & Palnadu Districts, Andhra Pradesh
        </div>
    </div>`;

    return dispatchEmail({
        to: member.email,
        subject,
        html,
        text: `Welcome ${member.name}! Your Trust Member ID is ${member.memberId}. Next payment of ₹${member.donationAmount} is scheduled on ${dueDateFormatted}.`
    });
}


// 4. Send Official 80G Tax Exemption Detailed Receipt Email
async function sendPaymentSuccessEmail({ name, email, mobile, address, amount, receiptNumber, transactionId, clientTxnId, purpose, donorCategory, date }) {
    const formattedAmount = Number(amount || 0).toLocaleString('en-IN');
    const amountWords = numberToWords(amount);
    const receiptNo = receiptNumber || ('KCT-80G-' + Date.now().toString().slice(-6));
    const txnRef = transactionId || clientTxnId || 'SP-VERIFIED';
    const issueDate = date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' }) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
    const isMonthly = (donorCategory && donorCategory.toLowerCase().includes('monthly')) || (purpose && purpose.toLowerCase().includes('monthly'));

    const subject = `Official 80G Donation Receipt [Receipt #${receiptNo}] - Kiran Charitable Trust`;

    const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 2px solid #0f52ba; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <!-- Official Trust Header -->
        <div style="background: linear-gradient(135deg, #0b132b 0%, #0f52ba 100%); padding: 26px 24px; color: #ffffff; text-align: center;">
            <div style="font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; color: #fcd34d; font-weight: 800; margin-bottom: 6px;">
                Government of India Recognized NGO • Section 80G & 12A Certified
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                KIRAN CHARITABLE TRUST
            </h1>
            <p style="margin: 6px 0 0; font-size: 12px; color: #e0e7ff; line-height: 1.5;">
                Registered Office: Mandepudi, Nemalikallu, Amaravathi, Palnadu, Guntur - 522018, Andhra Pradesh<br/>
                Email: contact@kirancharitabletrust.org | Helpline: +91 77024 68889 | www.kirancharitabletrust.org
            </p>
        </div>

        <!-- Compliance Banner -->
        <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 18px; font-size: 11.5px; color: #334155; display: flex; flex-wrap: wrap; justify-content: space-between; text-align: center;">
            <span style="display: inline-block; margin: 2px 8px;"><strong>Trust PAN:</strong> AAGTK5575Q</span>
            <span style="display: inline-block; margin: 2px 8px;"><strong>12A URN:</strong> AAGTK5575QE20261 (u/s 332)</span>
            <span style="display: inline-block; margin: 2px 8px;"><strong>80G URN:</strong> AAGTK5575QF20261 (u/s 354, Form 106)</span>
            <span style="display: inline-block; margin: 2px 8px; color: #059669;"><strong>Tax Exemption:</strong> 50% under Sec 80G(5)(vi)</span>
        </div>

        <!-- Certificate Title -->
        <div style="padding: 24px 28px 12px; text-align: center;">
            <div style="display: inline-block; background: #ecfdf5; border: 1.5px solid #10b981; color: #065f46; font-size: 13px; font-weight: 800; padding: 6px 18px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">
                ✓ Official Donation & Tax Exemption Receipt
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
                Issued under Rule 18AB of the Income Tax Rules, 1962 (CBDT Form 10BE Format)
            </div>
        </div>

        <div style="padding: 12px 28px 28px; color: #1e293b;">
            <!-- Receipt Meta Row -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12.5px; background: #f8fafc; border-radius: 8px; padding: 10px;">
                <tr>
                    <td style="padding: 8px 12px; color: #475569;"><strong>Receipt No:</strong> <span style="color: #0f52ba; font-weight: 800;">${receiptNo}</span></td>
                    <td style="padding: 8px 12px; text-align: right; color: #475569;"><strong>Date & Time:</strong> ${issueDate}</td>
                </tr>
            </table>

            <!-- Donor Details Box -->
            <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px; background: #ffffff;">
                <div style="font-size: 11px; font-weight: 800; color: #0f52ba; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    Donor Identification Particulars
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.6;">
                    <tr>
                        <td style="width: 35%; color: #64748b; padding: 3px 0;">Donor Full Name:</td>
                        <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">${name || 'Valued Philanthropist'}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Email Address:</td>
                        <td style="color: #0f172a; padding: 3px 0;">${email}</td>
                    </tr>
                    ${mobile ? `<tr><td style="color: #64748b; padding: 3px 0;">Contact Mobile:</td><td style="color: #0f172a; padding: 3px 0;">${mobile}</td></tr>` : ''}
                    ${address ? `<tr><td style="color: #64748b; padding: 3px 0;">Residential Address:</td><td style="color: #0f172a; padding: 3px 0;">${address}</td></tr>` : ''}
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Contribution Mode:</td>
                        <td style="color: #0f172a; font-weight: 600; padding: 3px 0;">${isMonthly ? '💖 Monthly Giving Society (Recurring Pillar)' : '🌟 One-Time Charitable Contribution'}</td>
                    </tr>
                </table>
            </div>

            <!-- Financial Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <thead>
                    <tr style="background: #0f52ba; color: #ffffff;">
                        <th style="padding: 10px 14px; text-align: left; border-top-left-radius: 8px;">Description / Charitable Cause</th>
                        <th style="padding: 10px 14px; text-align: right; border-top-right-radius: 8px;">Amount (INR)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eff6ff; border-bottom: 1px solid #bfdbfe;">
                        <td style="padding: 14px; font-weight: 600; color: #1e3a8a;">
                            ${purpose || 'General Philanthropy & Social Upliftment'}<br/>
                            <span style="font-size: 11.5px; font-weight: normal; color: #3b82f6;">Payment Gateway: SabPaisa PG (Canara Bank Verified)</span>
                        </td>
                        <td style="padding: 14px; text-align: right; font-weight: 800; font-size: 18px; color: #1e40af;">
                            ₹${formattedAmount}
                        </td>
                    </tr>
                    <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <td colspan="2" style="padding: 10px 14px; font-size: 12.5px; color: #334155;">
                            <strong>Amount in Words:</strong> ${amountWords}
                        </td>
                    </tr>
                    <tr style="background: #ffffff; font-size: 11.5px; color: #64748b;">
                        <td style="padding: 8px 14px;"><strong>Transaction Reference:</strong> ${txnRef}</td>
                        <td style="padding: 8px 14px; text-align: right;"><strong>Payment Status:</strong> <span style="color: #16a34a; font-weight: 700;">CONFIRMED / PAID</span></td>
                    </tr>
                </tbody>
            </table>

            <!-- Statutory Exemption Declaration -->
            <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px; font-size: 12px; color: #78350f; line-height: 1.6;">
                <strong>Statutory 80G Certification:</strong><br/>
                Certified that this donation has been received for the charitable objectives of Kiran Charitable Trust (Healthcare, Education, Orphan Support, Food Security & Rural Empowerment). This donation is eligible for deduction under Section 80G(5)(vi) of the Income Tax Act, 1961. This computer-generated receipt is electronically verified and does not require a physical seal or signature under IT Rules.
            </div>

            <!-- Signatory & Verification Footer -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
                <tr>
                    <td style="width: 60%; vertical-align: bottom; color: #64748b;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">🛡️</span>
                            <span>
                                <strong>Computer Verified Certificate</strong><br/>
                                Form 10BE compliant electronic receipt record.
                            </span>
                        </div>
                    </td>
                    <td style="width: 40%; text-align: right; vertical-align: bottom;">
                        <div style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">
                            P. Kiranbabu
                        </div>
                        <div style="font-weight: 700; color: #0f52ba; font-size: 11px;">Pallepogu Kiranbabu</div>
                        <div style="color: #64748b; font-size: 10.5px;">Founder & Managing Trustee</div>
                        <div style="color: #94a3b8; font-size: 10px;">Kiran Charitable Trust</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Print & Help Note -->
        <div style="background: #0b132b; color: #94a3b8; padding: 14px 24px; text-align: center; font-size: 11.5px; border-top: 1px solid #1e293b;">
            💡 <em>Tip: You can print or save this email as a PDF for your annual income tax filing.</em><br/>
            Need assistance? Email contact@kirancharitabletrust.org or WhatsApp +91 77024 68889.
        </div>
    </div>`;

    return dispatchEmail({
        to: email,
        subject,
        html,
        text: `Official 80G Tax Exemption Receipt #${receiptNo} - Kiran Charitable Trust. Donor: ${name}. Amount: ₹${formattedAmount} (${amountWords}). Txn ID: ${txnRef}. 80G URN: AAGTK5575QF20261. PAN: AAGTK5575Q. Exempt under Section 80G(5)(vi) of the Income Tax Act.`
    });
}

// 5. Send Payment Failure Email with Proper Transaction Details & 1-Click Retry
async function sendPaymentFailureEmail({ name, email, amount, reason, transactionId, retryUrl }) {
    const formattedAmount = Number(amount || 0).toLocaleString('en-IN');
    const defaultUrl = 'https://www.kirancharitabletrust.org/donate';
    const actionUrl = retryUrl || defaultUrl;
    const failureDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
    const txnRef = transactionId || ('ATTEMPT-' + Date.now().toString().slice(-6));

    const subject = `Payment Incomplete Notice (Attempt of ₹${formattedAmount}) - Kiran Charitable Trust`;

    const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1.5px solid #ef4444; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <!-- Warning Header -->
        <div style="background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%); padding: 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 32px; margin-bottom: 4px;">⚠️</div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase;">
                Payment Not Completed
            </h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #fee2e2;">
                Kiran Charitable Trust • Transaction Attempt Notice
            </p>
        </div>

        <div style="padding: 28px 24px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 18px; color: #0f172a;">Dear ${name || 'Valued Donor'},</h2>
            <p style="font-size: 14.5px; line-height: 1.6; color: #475569;">
                We noticed that your recent contribution attempt of <strong>₹${formattedAmount}</strong> could not be processed by your bank or payment gateway network.
            </p>

            <!-- Attempt Details Table -->
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; margin: 20px 0;">
                <div style="font-size: 11px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                    Attempt Summary Details
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.6;">
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Attempted Amount:</td>
                        <td style="font-weight: 800; color: #991b1b; padding: 3px 0; text-align: right;">₹${formattedAmount}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Attempt Reference:</td>
                        <td style="color: #0f172a; padding: 3px 0; text-align: right; font-family: monospace;">${txnRef}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Attempt Date & Time:</td>
                        <td style="color: #0f172a; padding: 3px 0; text-align: right;">${failureDate}</td>
                    </tr>
                    ${reason ? `
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Bank / Gateway Response:</td>
                        <td style="color: #dc2626; font-weight: 600; padding: 3px 0; text-align: right;">${reason}</td>
                    </tr>` : ''}
                </table>
            </div>

            <!-- Reassurance Note -->
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                <strong>Did your bank deduct money?</strong><br/>
                If any amount was debited from your account, it is 100% safe. The banking network will automatically reverse and refund it back to your source account within <strong>3 to 5 business days</strong> per RBI guidelines.
            </div>

            <!-- Retry Button -->
            <div style="text-align: center; margin: 26px 0;">
                <a href="${actionUrl}" style="background: linear-gradient(135deg, #0f52ba 0%, #1d4ed8 100%); color: #ffffff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(15, 82, 186, 0.35);">
                    ⚡ Retry Your Contribution
                </a>
            </div>

            <!-- Contact & Assistance -->
            <div style="text-align: center; font-size: 12.5px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 18px;">
                Need help or wish to donate directly? Contact Kiran Charitable Trust:<br/>
                📞 Call: <strong>+91 77024 68889</strong> | 💬 WhatsApp: <a href="https://wa.me/917702468889" style="color: #059669; font-weight: 700; text-decoration: none;">+91 77024 68889</a>
            </div>
        </div>

        <div style="background: #f8fafc; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Kiran Charitable Trust • Mandepudi, Amaravathi, Palnadu, Guntur - 522018, Andhra Pradesh
        </div>
    </div>`;

    return dispatchEmail({
        to: email,
        subject,
        html,
        text: `Hello ${name}, your transaction attempt of ₹${formattedAmount} at Kiran Charitable Trust was not completed (${reason || 'Bank declined'}). If debited, funds will be auto-refunded within 3-5 business days. Retry here: ${actionUrl}`
    });
}

// 5b. Send Payment Pending / Verification In Progress Notice
async function sendPaymentPendingEmail({ name, email, amount, transactionId, purpose }) {
    const formattedAmount = Number(amount || 0).toLocaleString('en-IN');
    const txnRef = transactionId || ('TXN-' + Date.now().toString().slice(-6));
    const txnDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
    const subject = `Payment Under Verification (₹${formattedAmount}) - Kiran Charitable Trust`;

    const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1.5px solid #f59e0b; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <!-- Pending Header -->
        <div style="background: linear-gradient(135deg, #b45309 0%, #d97706 100%); padding: 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 32px; margin-bottom: 4px;">⏳</div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase;">
                Payment Processing / Verification
            </h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #fef3c7;">
                Kiran Charitable Trust • Banking Network Confirmation Awaited
            </p>
        </div>

        <div style="padding: 28px 24px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 18px; color: #0f172a;">Dear ${name || 'Valued Donor'},</h2>
            <p style="font-size: 14.5px; line-height: 1.6; color: #475569;">
                Your donation of <strong>₹${formattedAmount}</strong> has been received by our payment gateway (SabPaisa) and is awaiting final clearance from your bank / UPI application.
            </p>

            <!-- Verification Table -->
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px; margin: 20px 0;">
                <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                    Transaction Status Details
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.6;">
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Amount:</td>
                        <td style="font-weight: 800; color: #b45309; padding: 3px 0; text-align: right;">₹${formattedAmount}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Transaction ID:</td>
                        <td style="color: #0f172a; padding: 3px 0; text-align: right; font-family: monospace;">${txnRef}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Date & Time:</td>
                        <td style="color: #0f172a; padding: 3px 0; text-align: right;">${txnDate}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Current Status:</td>
                        <td style="color: #d97706; font-weight: 700; padding: 3px 0; text-align: right;">UNDER VERIFICATION</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 3px 0;">Purpose:</td>
                        <td style="color: #0f172a; padding: 3px 0; text-align: right;">${purpose || 'Rural Philanthropy'}</td>
                    </tr>
                </table>
            </div>

            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                <strong>What happens next?</strong><br/>
                UPI and NetBanking settlements can sometimes take 5 to 15 minutes to reconcile. As soon as your bank confirms the transfer, your official <strong>80G Tax Exemption Certificate</strong> will be emailed to this address automatically.
            </div>

            <div style="text-align: center; font-size: 12.5px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 18px;">
                Have questions regarding your transfer? WhatsApp Trust Coordinator:<br/>
                💬 <a href="https://wa.me/917702468889" style="color: #059669; font-weight: 700; text-decoration: none;">+91 77024 68889</a> | 📧 contact@kirancharitabletrust.org
            </div>
        </div>

        <div style="background: #f8fafc; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Kiran Charitable Trust • Mandepudi, Amaravathi, Palnadu, Guntur - 522018, Andhra Pradesh
        </div>
    </div>`;

    return dispatchEmail({
        to: email,
        subject,
        html,
        text: `Dear ${name}, your donation of ₹${formattedAmount} (Txn ID: ${txnRef}) is currently being confirmed by your bank. Your 80G tax receipt will be emailed as soon as confirmation is received.`
    });
}

// 6. Send Monthly Recurring Reminder Email
async function sendMonthlyReminderEmail({ name, email, amount, dueDate, paymentUrl }) {
    const formattedDate = new Date(dueDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const subject = `Monthly Trust Donation Due Reminder (₹${amount}) - Kiran Charitable Trust`;
    const actionUrl = paymentUrl || 'https://www.kirancharitabletrust.org/donate';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #4F46E5; padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Monthly Contribution Reminder 📅</h1>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Kiran Charitable Trust Monthly Patron Program</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 18px; color: #0f172a;">Dear ${name},</h2>
            <p style="font-size: 14.5px; line-height: 1.6; color: #475569;">
                Thank you for being a pillar of Kiran Charitable Trust. This is a gentle reminder that your monthly donation pledge of <strong>₹${amount}</strong> is due on <strong>${formattedDate}</strong>.
            </p>
            <div style="background: #eef2ff; border-left: 4px solid #4F46E5; padding: 18px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0 0 6px; font-size: 14px;"><strong>Pledged Amount:</strong> ₹${amount}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Due Date:</strong> ${formattedDate}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${actionUrl}" style="background: #4F46E5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">
                    Complete Monthly Donation (₹${amount})
                </a>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; text-align: center;">
                After payment, your name and photo will be refreshed on our Monthly Top Donors Leaderboard!
            </p>
        </div>
    </div>`;

    return dispatchEmail({
        to: email,
        subject,
        html,
        text: `Dear ${name}, your monthly donation of ₹${amount} is due on ${formattedDate}. Complete it here: ${actionUrl}`
    });
}

module.exports = {
    dispatchEmail,
    sendOtpEmail,
    sendVolunteerWelcomeEmail,
    sendTrustMemberWelcomeEmail,
    sendPaymentSuccessEmail,
    sendPaymentPendingEmail,
    sendPaymentFailureEmail,
    sendMonthlyReminderEmail
};
