const sendEmail = require('../utils/sendEmail');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testResetTemplate() {
    const user = { name: 'Rajshri Jadhav', email: 'jrajshri11@gmail.com' };
    const resetUrl = 'https://arcrm.co.in/reset-password/sample-test-token-12345';
    
    console.log(`[Test] Sending original password reset email template to ${user.email}...`);

    const result = await sendEmail({
        to: user.email,
        subject: 'Reset your password - ARCRM',
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Password - ARCRM</title>
            </head>
            <body style="margin: 0; padding: 0; width: 100%; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 48px 20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                      
                      <!-- Header -->
                      <tr>
                        <td style="padding: 40px 40px 0 40px; text-align: left;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 10px; text-align: center; line-height: 38px; color: #ffffff; font-weight: 800; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                                  A
                                </div>
                              </td>
                              <td style="padding-left: 12px; vertical-align: middle;">
                                <span style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase;">ARCRM</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Content -->
                      <tr>
                        <td style="padding: 32px 40px 40px 40px;">
                          <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                            Reset your password
                          </h1>
                          <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                            Hi <strong>${user.name}</strong>,
                          </p>
                          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                            We received a request to reset your password for your account associated with <span style="color: #0f172a; font-weight: 600;">${user.email}</span>.
                          </p>

                          <!-- Button -->
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                            <tr>
                              <td align="left" style="border-radius: 10px; background-color: #2563eb;">
                                <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #2563eb; letter-spacing: 0.2px;">
                                  Reset password
                                </a>
                              </td>
                            </tr>
                          </table>

                          <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                            This link will expire in <strong>1 hour</strong>. If you did not request this password reset, no further action is required and your account remains safe.
                          </p>

                          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;" />

                          <!-- Link Fallback -->
                          <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                            If you're having trouble clicking the button, copy and paste the URL below into your web browser:
                          </p>
                          <p style="margin: 0; font-size: 12px; line-height: 1.5; word-break: break-all;">
                            <a href="${resetUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">
                              ${resetUrl}
                            </a>
                          </p>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding: 0 40px 32px 40px; text-align: left;">
                          <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                            &copy; ${new Date().getFullYear()} ARCRM. All rights reserved.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
        `
    });

    console.log('[Test Result]', result);
}

testResetTemplate().catch(console.error);
