let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (err) {
    console.error('[Email Service] Failed to load nodemailer package:', err.message);
    nodemailer = null;
}

/**
 * Sends an email using MSG91 Email API (v5).
 * API Endpoint: https://control.msg91.com/api/v5/email/send
 * Headers: Content-Type: application/json, authkey: {MSG91_AUTHKEY}
 */
const sendMsg91Email = async ({
    to,
    name,
    otp,
    company_name,
    variables = {},
    template_id,
    domain,
    fromEmail,
    authkey,
}) => {
    const key = (authkey || process.env.MSG91_AUTHKEY || '').trim();
    const regDomain = (domain || process.env.MSG91_DOMAIN || process.env.MSG91_REGISTERED_DOMAIN || 'arcrm.co.in').trim();
    const templateId = (template_id || process.env.MSG91_TEMPLATE_ID || 'global_otp').trim();
    const senderEmail = (fromEmail || process.env.MSG91_FROM_EMAIL || `no-reply@${regDomain}`).trim();
    const companyName = (company_name || variables.company_name || process.env.MSG91_COMPANY_NAME || 'ARCRM').trim();

    if (!key) {
        throw new Error('MSG91_AUTHKEY is missing. Please set MSG91_AUTHKEY in your environment.');
    }
    if (!regDomain) {
        throw new Error('MSG91_DOMAIN is missing. Please set MSG91_DOMAIN in your environment.');
    }
    if (!senderEmail) {
        throw new Error('Sender email is missing. Please set MSG91_FROM_EMAIL or MSG91_DOMAIN.');
    }

    const recipientList = Array.isArray(to) ? to : [to];
    const recipients = recipientList.map((target) => {
        const email = typeof target === 'string' ? target : target.email;
        const recipientName = typeof target === 'string' ? (name || email) : (target.name || email);
        return {
            to: [
                {
                    email: String(email).trim().toLowerCase(),
                    name: recipientName || email
                }
            ],
            variables: {
                company_name: companyName,
                ...(otp !== undefined && otp !== null ? { otp: String(otp) } : {}),
                ...variables
            }
        };
    });

    const payload = {
        recipients,
        from: {
            email: senderEmail
        },
        domain: regDomain,
        template_id: templateId
    };

    console.log(`[MSG91 Email] Initiating send: template "${templateId}" to ${recipientList.map(r => typeof r === 'string' ? r : r.email).join(', ')} from ${senderEmail}`);

    const response = await fetch('https://control.msg91.com/api/v5/email/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authkey': key
        },
        body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch {
        data = { raw: responseText };
    }

    if (!response.ok || (data && (data.status === 'error' || data.type === 'error'))) {
        const errorMsg = data.message || data.error || responseText || `HTTP ${response.status}`;
        console.error(`[MSG91 Email Error] (${response.status}):`, errorMsg);
        return {
            success: false,
            provider: 'msg91',
            error: errorMsg,
            status: response.status,
            data
        };
    }

    console.log(`[MSG91 Email] Email sent successfully via MSG91!`, data);
    return {
        success: true,
        provider: 'msg91',
        data
    };
};

/**
 * Sends an email using Nodemailer with SMTP transport.
 * Reads environment variables:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 */
const sendSmtpEmail = async ({ to, subject, html, text }) => {
    const envUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const envPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();

    const user = (!envUser || envUser.includes('your-email')) ? 'rrtechgrove@gmail.com' : envUser;
    const rawPass = (!envPass || envPass.includes('your-email')) ? 'vmueoxdfdbjiqzmh' : envPass;
    const pass = rawPass.replace(/\s+/g, '');
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"ARCRM Support" <${user}>`;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    console.log(`[Email Service] Initiating SMTP send to: ${to} | Sender: ${user} | Host: ${host}:${port}`);

    if (nodemailer && host && user && pass) {
        const isGmail = (host && host.includes('gmail')) || user.endsWith('@gmail.com');

        let transporter;
        if (isGmail) {
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user,
                    pass
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        } else {
            transporter = nodemailer.createTransport({
                host,
                port,
                secure,
                auth: {
                    user,
                    pass
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        }

        try {
            const info = await transporter.sendMail({
                from,
                to,
                subject,
                text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
                html
            });

            console.log(`[Email Service] Email sent successfully via Nodemailer! MessageId: ${info.messageId}`);
            return { success: true, provider: 'smtp', messageId: info.messageId };
        } catch (error) {
            console.error(`[Email Service] Primary transport error (${isGmail ? 'Gmail Service' : 'SMTP'}):`, error.message);

            let isGmailAuthError = error.message && (error.message.includes('534') || error.message.includes('Invalid login') || error.message.includes('WebLoginRequired'));

            if (isGmail && !isGmailAuthError) {
                try {
                    console.log(`[Email Service] Attempting Gmail fallback on port 465 SSL...`);
                    const fallbackTransporter = nodemailer.createTransport({
                        host: 'smtp.gmail.com',
                        port: 465,
                        secure: true,
                        auth: { user, pass },
                        tls: { rejectUnauthorized: false }
                    });

                    const info = await fallbackTransporter.sendMail({
                        from,
                        to,
                        subject,
                        text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
                        html
                    });

                    console.log(`[Email Service] Email sent successfully via Gmail SSL fallback! MessageId: ${info.messageId}`);
                    return { success: true, provider: 'smtp', messageId: info.messageId };
                } catch (fallbackError) {
                    console.error(`[Email Service] Gmail SSL fallback failed:`, fallbackError.message);
                }
            }

            if (isGmailAuthError) {
                return {
                    success: false,
                    provider: 'smtp',
                    error: `Gmail SMTP authentication failed (534 5.7.9). Please update SMTP_PASS in backend/.env with a valid 16-character App Password generated from https://myaccount.google.com/apppasswords`
                };
            }

            return { success: false, provider: 'smtp', error: error.message };
        }
    } else {
        console.warn(`[Email Service] SMTP configuration missing (SMTP_HOST/USER/PASS not set). Email simulated for ${to}.`);
        return { success: true, provider: 'smtp', simulated: true };
    }
};

/**
 * Universal email dispatcher: routes to MSG91 or SMTP based on configuration and parameters.
 */
const sendEmail = async ({
    to,
    subject,
    html,
    text,
    name,
    otp,
    company_name,
    variables = {},
    template_id,
    provider,
}) => {
    const preferredProvider = (provider || process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    const hasMsg91Key = Boolean((process.env.MSG91_AUTHKEY || '').trim());
    const hasSmtpConfig = Boolean((process.env.SMTP_USER || process.env.EMAIL_USER || '').trim());

    // Route to MSG91 if:
    // 1. Explicitly requested via provider='msg91' or EMAIL_PROVIDER=msg91
    // 2. OR an OTP / template_id is supplied and MSG91 authkey is present
    // 3. OR SMTP configuration is missing but MSG91 is available
    const shouldUseMsg91 = preferredProvider === 'msg91' || (hasMsg91Key && (template_id || otp || !hasSmtpConfig));

    if (shouldUseMsg91) {
        try {
            const result = await sendMsg91Email({
                to,
                name,
                otp,
                company_name,
                variables,
                template_id
            });
            if (result.success) {
                return result;
            }
            console.warn(`[Email Service] Primary MSG91 dispatch failed: ${result.error}. Trying SMTP fallback...`);
        } catch (msg91Err) {
            console.warn(`[Email Service] Primary MSG91 dispatch threw: ${msg91Err.message}. Trying SMTP fallback...`);
        }
    }

    // Attempt SMTP dispatch
    const smtpResult = await sendSmtpEmail({ to, subject, html, text });
    if (smtpResult.success) {
        return smtpResult;
    }

    // If SMTP failed, attempt MSG91 as fallback if configured and not yet attempted
    if (!shouldUseMsg91 && hasMsg91Key) {
        try {
            console.log(`[Email Service] Attempting MSG91 as fallback for failed SMTP...`);
            const fallbackResult = await sendMsg91Email({
                to,
                name,
                otp,
                company_name,
                variables,
                template_id
            });
            if (fallbackResult.success) {
                return fallbackResult;
            }
        } catch (fallbackErr) {
            console.error(`[Email Service] MSG91 fallback attempt failed:`, fallbackErr.message);
        }
    }

    return smtpResult;
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendMsg91Email = sendMsg91Email;
module.exports.sendSmtpEmail = sendSmtpEmail;
