// Email over MSG91 SMTP (utils/sendEmail.js; client, 2026-11-19: "use msg91 for sending mail for
// smtp"). The account comes from the server's environment only. Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// A stand-in for nodemailer: records the connection and the message instead of sending
const nodemailerPath = require.resolve('nodemailer');
let transports;
let sendResult;
const nodemailerStub = new Module(nodemailerPath);
Object.assign(nodemailerStub, {
    filename: nodemailerPath,
    loaded: true,
    exports: {
        createTransport: (options) => {
            const transport = { options, sent: [] };
            transports.push(transport);
            return {
                sendMail: async (message) => {
                    transport.sent.push(message);
                    if (sendResult instanceof Error) throw sendResult;
                    return sendResult;
                }
            };
        }
    }
});
const realNodemailer = require.cache[nodemailerPath];
require.cache[nodemailerPath] = nodemailerStub;
const sendEmail = require('../utils/sendEmail');

const EMAIL_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_SECURE', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'NODE_ENV'];
const saved = Object.fromEntries(EMAIL_VARS.map((name) => [name, process.env[name]]));
const setEnv = (values) => {
    for (const name of EMAIL_VARS) delete process.env[name];
    Object.assign(process.env, values);
};
after(() => {
    setEnv(Object.fromEntries(Object.entries(saved).filter(([, value]) => value !== undefined)));
    if (realNodemailer) require.cache[nodemailerPath] = realNodemailer; else delete require.cache[nodemailerPath];
});

// Made-up MSG91 settings, as copied from MSG91 > Email > Domains > SMTP
const MSG91 = {
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.msg91.example',
    SMTP_PORT: '587',
    SMTP_USER: 'msg91-smtp-user',
    SMTP_PASS: 'not-a-real-password',
    SMTP_FROM: 'ARCRM <no-reply@mail.example.com>'
};
beforeEach(() => {
    transports = [];
    sendResult = { messageId: '<abc@msg91>' };
    setEnv(MSG91);
});

const resetEmail = () => sendEmail({ to: 'rohit@example.com', subject: 'Reset your password - ARCRM', html: '<p>Click <b>here</b></p>' });

test('sends through the MSG91 SMTP server of the environment, with its login and sender', async () => {
    const result = await resetEmail();

    assert.deepEqual(result, { success: true, messageId: '<abc@msg91>' });
    assert.equal(transports.length, 1);
    const { options, sent } = transports[0];
    assert.equal(options.host, 'smtp.msg91.example');
    assert.equal(options.port, 587);
    assert.equal(options.secure, false, 'port 587 starts plain and upgrades (STARTTLS)');
    assert.deepEqual(options.auth, { user: 'msg91-smtp-user', pass: 'not-a-real-password' });
    assert.equal(options.tls, undefined, 'the server certificate is checked');
    assert.equal(sent[0].from, 'ARCRM <no-reply@mail.example.com>');
    assert.equal(sent[0].to, 'rohit@example.com');
    assert.equal(sent[0].text, 'Click here');
});

test('port 465 or SMTP_SECURE=true uses SSL from the start', async () => {
    setEnv({ ...MSG91, SMTP_PORT: '465' });
    await resetEmail();
    assert.equal(transports[0].options.secure, true);

    setEnv({ ...MSG91, SMTP_SECURE: 'true' });
    await resetEmail();
    assert.equal(transports[1].options.secure, true);
});

test('in production, missing settings are an error and nothing is sent (no built-in account)', async () => {
    setEnv({ NODE_ENV: 'production' });
    const result = await resetEmail();
    assert.equal(transports.length, 0);
    assert.equal(result.success, false);
    assert.match(result.error, /SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM are not set/);
});

test('outside production, missing settings only simulate the email', async () => {
    setEnv({ NODE_ENV: 'development' });
    assert.deepEqual(await resetEmail(), { success: true, simulated: true });
    assert.equal(transports.length, 0);
});

test('a refused login says which settings to check', async () => {
    sendResult = Object.assign(new Error('Invalid login: 535 Authentication failed'), { code: 'EAUTH' });
    const result = await resetEmail();
    assert.equal(result.success, false);
    assert.match(result.error, /SMTP_USER and SMTP_PASS/);
});

test('the EMAIL_ names are read when the SMTP_ ones are not set', async () => {
    setEnv({ NODE_ENV: 'production', EMAIL_HOST: 'smtp.msg91.example', EMAIL_USER: 'u', EMAIL_PASS: 'p', EMAIL_FROM: 'no-reply@mail.example.com' });
    const result = await resetEmail();
    assert.equal(result.success, true);
    assert.equal(transports[0].options.host, 'smtp.msg91.example');
});

test('no email account or password is written in the code', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'utils', 'sendEmail.js'), 'utf8');
    assert.doesNotMatch(source, /@gmail\.com/);
    assert.doesNotMatch(source, /smtp\.gmail\.com/);
});
