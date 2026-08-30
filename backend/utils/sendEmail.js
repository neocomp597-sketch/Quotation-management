let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (err) {
    nodemailer = null;
}

/**
 * Sends an email using Nodemailer with SMTP transport.
 * Reads environment variables:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const envUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const envPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();

    const user = (!envUser || envUser.includes('your-email')) ? 'rrtechgrove@gmail.com' : envUser;
    const rawPass = (!envPass || envPass.includes('your-email')) ? 'zaplvruahsxmlmyc' : envPass;
    const pass = rawPass.replace(/\s+/g, '');
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"ARCRM Support" <${user}>`;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    console.log(`[Email Service] Attempting to send email to: ${to} | Subject: "${subject}"`);

    if (nodemailer && (host || user) && pass) {
        const isGmail = (host && host.includes('gmail')) || user.endsWith('@gmail.com');
        
        let transporter;
        if (isGmail) {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user,
                    pass
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
                text: text || html.replace(/<[^>]*>?/gm, ''),
                html
            });

            console.log(`[Email Service] Email sent successfully via Nodemailer! MessageId: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`[Email Service] Primary transport error (${isGmail ? 'Gmail Service' : 'SMTP'}):`, error.message);

            if (isGmail) {
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
                        text: text || html.replace(/<[^>]*>?/gm, ''),
                        html
                    });

                    console.log(`[Email Service] Email sent successfully via Gmail SSL fallback! MessageId: ${info.messageId}`);
                    return { success: true, messageId: info.messageId };
                } catch (fallbackError) {
                    console.error(`[Email Service] Gmail SSL fallback failed:`, fallbackError.message);
                    return { success: false, error: fallbackError.message };
                }
            }

            return { success: false, error: error.message };
        }
    } else {
        console.warn(`[Email Service] SMTP configuration missing (SMTP_HOST/USER/PASS not set). Email simulated for ${to}.`);
        return { success: true, simulated: true };
    }
};

module.exports = sendEmail;
