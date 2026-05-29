const axios = require('axios');
const { sendEmail } = require('../config/mailer');

const APP_URL = () => process.env.APP_URL || 'http://localhost:5176';

async function sendAlert(job, consecutiveFailures, lastError) {
  const subject = `🔴 [CronHub] "${job.name}" has failed ${consecutiveFailures} times`;

  const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#F8FAFC;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:#0F172A;padding:20px 24px;">
      <h2 style="color:white;margin:0;font-size:18px;">🔴 Job Failing</h2>
      <p style="color:#94A3B8;margin:4px 0 0;font-size:13px;">CronHub Alert</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#1E293B;">
        The job <strong>"${job.name}"</strong> has failed <strong>${consecutiveFailures} consecutive times</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#64748B;width:120px;">URL</td><td style="color:#0F172A;">${job.url}</td></tr>
        <tr><td style="padding:6px 0;color:#64748B;">Schedule</td><td style="color:#0F172A;font-family:monospace;">${job.schedule}</td></tr>
        <tr><td style="padding:6px 0;color:#64748B;">Last error</td><td style="color:#DC2626;">${lastError || 'Unknown'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748B;">Failures</td><td style="color:#0F172A;">${consecutiveFailures} in a row</td></tr>
      </table>
    </div>
    <div style="padding:16px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <a href="${APP_URL()}/jobs/${job.id}" style="display:inline-block;background:#0F172A;color:white;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;">
        View job →
      </a>
    </div>
  </div>
</body></html>`;

  if (job.notify_email) {
    await sendEmail({ to: job.notify_email, subject, html }).catch(e =>
      console.error('[Alert/email]', e.message)
    );
  }

  if (job.notify_webhook) {
    await axios.post(job.notify_webhook, {
      job_name: job.name, url: job.url, schedule: job.schedule,
      consecutive_failures: consecutiveFailures, last_error: lastError,
      timestamp: new Date().toISOString(),
      text: `🔴 CronHub: "${job.name}" has failed ${consecutiveFailures} times in a row`,
    }, { timeout: 8000 }).catch(e => console.error('[Alert/webhook]', e.message));
  }
}

module.exports = { sendAlert };
