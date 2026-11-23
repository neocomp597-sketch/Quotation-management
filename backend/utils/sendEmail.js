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

        // If a custom template failed (e.g. 422 because template_id like "password_reset" doesn't exist yet in MSG91 dashboard),
        // fallback to the default approved template (e.g. "global_otp")
        const defaultTemplate = (process.env.MSG91_TEMPLATE_ID || 'global_otp').trim();
        if (templateId !== defaultTemplate && defaultTemplate) {
            console.log(`[MSG91 Email] Retrying with fallback approved template "${defaultTemplate}"...`);
            return await sendMsg91Email({
                to,
                name,
                otp: otp || variables.otp || '000000',
                company_name: companyName,
                variables: {
                    ...variables,
                    company_name: companyName,
                    otp: otp || variables.otp || '000000'
                },
                template_id: defaultTemplate,
                domain: regDomain,
                fromEmail: senderEmail,
                authkey: key
            });
        }

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
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (envUser ? `"ARCRM Support" <${envUser}>` : '');
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!nodemailer) {
        return { success: false, provider: 'smtp', error: 'Nodemailer is not installed on the server.' };
    }
    if (!envUser || !envPass) {
        return { success: false, provider: 'smtp', error: 'SMTP_USER and SMTP_PASS are not configured.' };
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { success: false, provider: 'smtp', error: 'SMTP_PORT must be a valid port number.' };
    }

    const isGmail = host.includes('gmail') || envUser.endsWith('@gmail.com');
    const smtpHost = isGmail ? 'smtp.gmail.com' : host;
    const smtpPort = isGmail ? 465 : port;
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: isGmail || secure,
        auth: { user: envUser, pass: envPass.replace(/\s+/g, '') }
    });

    console.log(`[Email Service] Initiating SMTP send to: ${to} | Sender: ${envUser} | Host: ${smtpHost}:${smtpPort}`);

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
        console.error(`[Email Service] SMTP transport error:`, error.message);
        return { success: false, provider: 'smtp', error: error.message };
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
