require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const sendEmail = require('../utils/sendEmail');

async function test() {
    console.log('Testing SMTP connection with host:', process.env.SMTP_HOST, 'user:', process.env.SMTP_USER);
    const res = await sendEmail({
        to: 'rrtechgrove@gmail.com',
        subject: 'Test Email - ARCRM Password Reset Verification',
        html: '<h3>ARCRM Email Integration Successful</h3><p>This email confirms that Gmail SMTP with App Password is working correctly for password reset requests.</p>'
    });
    console.log('Result:', res);
    process.exit(0);
}

test();
