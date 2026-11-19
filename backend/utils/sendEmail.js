let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (err) {
    console.error('[Email Service] Failed to load nodemailer package:', err.message);
    nodemailer = null;
}

/**
 * Sends an email over SMTP: MSG91 Email (client, 2026-11-19: "use msg91 for sending mail for smtp").
 *
 * The server's environment holds the account, never this file or the repository:
 *   SMTP_HOST    MSG91 > Email > Domains > (verified domain) > SMTP: the hostname shown there
 *   SMTP_PORT    the port shown there (587 by default; 465 is SSL)
 *   SMTP_USER    the SMTP username shown there
 *   SMTP_PASS    the SMTP password shown there
 *   SMTP_FROM    the sender, an address of the domain verified in MSG91, e.g.
 *                "ARCRM <no-reply@mail.example.com>"
 *   SMTP_SECURE  "true" for SSL from the start (port 465 sets it too)
 * EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS / EMAIL_FROM are read when the SMTP_ ones are
 * not set. Any other SMTP service works with the same settings.
 *
 * Returns { success, messageId } or { success: false, error }. Without settings, nothing is sent:
 * in production that is an error (so a password reset never says "sent" for an email that was
 * not); elsewhere the email is only simulated, for local development.
 */
const settingsFromEnv = (env = process.env) => {
    const pick = (...names) => names.map((name) => String(env[name] || '').trim()).find(Boolean) || '';
    const host = pick('SMTP_HOST', 'EMAIL_HOST');
    const port = parseInt(pick('SMTP_PORT', 'EMAIL_PORT') || '587', 10);
    const user = pick('SMTP_USER', 'EMAIL_USER');
    // Passwords copied with spaces in them (as shown in groups) still work
    const pass = pick('SMTP_PASS', 'EMAIL_PASS').replace(/\s+/g, '');
    const from = pick('SMTP_FROM', 'EMAIL_FROM') || (user.includes('@') ? `"ARCRM" <${user}>` : '');
    const secure = pick('SMTP_SECURE').toLowerCase() === 'true' || port === 465;
    return { host, port, user, pass, from, secure };
};

const missingSettings = ({ host, user, pass, from }) => [
    !host && 'SMTP_HOST',
    !user && 'SMTP_USER',
    !pass && 'SMTP_PASS',
    !from && 'SMTP_FROM'
].filter(Boolean);

const sendEmail = async ({ to, subject, html, text }) => {
    const settings = settingsFromEnv();
    const missing = missingSettings(settings);

    if (!nodemailer || missing.length) {
        const reason = !nodemailer
            ? 'the nodemailer package is not installed'
            : `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set`;
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`[Email Service] Email not sent (${reason}); simulated for ${to}.`);
            return { success: true, simulated: true };
        }
        console.error(`[Email Service] Email to ${to} not sent: ${reason}.`);
        return { success: false, error: `Email is not set up on the server (${reason}). Add the MSG91 SMTP settings.` };
    }

    const { host, port, user, pass, from, secure } = settings;
    console.log(`[Email Service] Sending email to ${to} via ${host}:${port}`);
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        // A reset request should not wait minutes for an unreachable server
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000
    });

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text: text || String(html || '').replace(/<[^>]*>?/gm, ''),
            html
        });
        console.log(`[Email Service] Email sent. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email Service] Sending via ${host}:${port} failed:`, error.message);
        const authFailed = error.code === 'EAUTH' || /\b535\b|\b534\b|Invalid login|authentication/i.test(error.message || '');
        return {
            success: false,
            error: authFailed
                ? 'The SMTP login was refused. Check SMTP_USER and SMTP_PASS against MSG91 > Email > Domains > SMTP.'
                : error.message
        };
    }
};

module.exports = sendEmail;
module.exports.settingsFromEnv = settingsFromEnv;
