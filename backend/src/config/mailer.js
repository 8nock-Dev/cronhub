const nodemailer = require('nodemailer');
let _t = null;

function transport() {
  if (!process.env.SMTP_HOST) return null;
  if (_t) return _t;
  _t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _t;
}

async function sendEmail({ to, subject, html }) {
  const t = transport();
  if (!t) { console.log(`[Email disabled] ${subject}`); return null; }
  return t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
}

module.exports = { sendEmail };
