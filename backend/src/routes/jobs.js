const express      = require('express');
const cronParser   = require('cron-parser');
const { pool }     = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { scheduleJob, unscheduleJob, runJobNow } = require('../services/scheduler');
const { assertSafeUrl } = require('../security/urlSafety');
const { protectHeaders, redactJob } = require('../security/secrets');

const router = express.Router();
router.use(authenticate);

// ─── helpers ──────────────────────────────────────────────
function nextRun(schedule, timezone = 'UTC') {
  try {
    const interval = cronParser.parseExpression(schedule, { tz: timezone });
    return interval.next().toDate();
  } catch { return null; }
}

function validateCron(schedule) {
  try { cronParser.parseExpression(schedule); return true; }
  catch { return false; }
}

function validTimezone(timezone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); return true; }
  catch { return false; }
}

function validateBounds({ method, timeout_seconds, retry_count, retry_delay_seconds, alert_after_failures }) {
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (method && !allowedMethods.includes(String(method).toUpperCase())) return 'Unsupported HTTP method';
  if (timeout_seconds !== undefined && (Number(timeout_seconds) < 1 || Number(timeout_seconds) > 60)) return 'timeout_seconds must be between 1 and 60';
  if (retry_count !== undefined && (Number(retry_count) < 0 || Number(retry_count) > 5)) return 'retry_count must be between 0 and 5';
  if (retry_delay_seconds !== undefined && (Number(retry_delay_seconds) < 5 || Number(retry_delay_seconds) > 3600)) return 'retry_delay_seconds must be between 5 and 3600';
  if (alert_after_failures !== undefined && (Number(alert_after_failures) < 1 || Number(alert_after_failures) > 20)) return 'alert_after_failures must be between 1 and 20';
  return null;
}

// ─── GET /api/jobs ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.*,
          (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id) AS total_executions,
          (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id AND e.status = 'success') AS success_count,
          (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id AND e.status IN ('failed','timeout')) AS failure_count
        FROM jobs j WHERE j.user_id=$1 ORDER BY j.created_at DESC`,
      [req.user.userId]
    );
    res.json(rows.map(redactJob));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── GET /api/jobs/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(redactJob(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─── GET /api/jobs/:id/executions ──────────────────────────
router.get('/:id/executions', async (req, res) => {
  try {
    const job = await pool.query('SELECT id FROM jobs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (!job.rows.length) return res.status(404).json({ error: 'Job not found' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      'SELECT * FROM executions WHERE job_id=$1 ORDER BY started_at DESC LIMIT $2',
      [req.params.id, limit]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─── POST /api/jobs ────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    name, url, method = 'GET', headers = {}, body,
    schedule, timezone = 'UTC',
    timeout_seconds = 30, retry_count = 2, retry_delay_seconds = 60,
    notify_email, notify_webhook, alert_after_failures = 3,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Job name is required' });
  if (!url?.trim())  return res.status(400).json({ error: 'URL is required' });
  if (!schedule)     return res.status(400).json({ error: 'Schedule (cron expression) is required' });
  if (!validateCron(schedule)) return res.status(400).json({ error: 'Invalid cron expression' });
  if (!validTimezone(timezone)) return res.status(400).json({ error: 'Invalid timezone' });
  const boundsError = validateBounds({ method, timeout_seconds, retry_count, retry_delay_seconds, alert_after_failures });
  if (boundsError) return res.status(400).json({ error: boundsError });
  if (JSON.stringify(headers).length > 8192 || String(body || '').length > 65536) return res.status(400).json({ error: 'Headers or body exceed allowed size' });
  try {
    await assertSafeUrl(url);
    if (notify_webhook) await assertSafeUrl(notify_webhook);
  } catch (error) { return res.status(400).json({ error: error.message }); }

  const next = nextRun(schedule, timezone);

  try {
    const { rows } = await pool.query(
      `INSERT INTO jobs
          (user_id,name,url,method,headers,body,schedule,timezone,next_run_at,
           timeout_seconds,retry_count,retry_delay_seconds,
           notify_email,notify_webhook,alert_after_failures)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *`,
      [
        req.user.userId, name.trim(), url.trim(), method.toUpperCase(),
        JSON.stringify(protectHeaders(headers)), body || null,
        schedule, timezone, next,
        timeout_seconds, retry_count, retry_delay_seconds,
        notify_email || null, notify_webhook || null, alert_after_failures,
      ]
    );
    const job = rows[0];
    await scheduleJob(job);
    res.status(201).json(redactJob(job));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── PUT /api/jobs/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    name, url, method, headers, body,
    schedule, timezone,
    timeout_seconds, retry_count, retry_delay_seconds,
    is_active, notify_email, notify_webhook, alert_after_failures,
  } = req.body;

  if (schedule && !validateCron(schedule))
    return res.status(400).json({ error: 'Invalid cron expression' });
  if (timezone && !validTimezone(timezone)) return res.status(400).json({ error: 'Invalid timezone' });
  const boundsError = validateBounds({ method, timeout_seconds, retry_count, retry_delay_seconds, alert_after_failures });
  if (boundsError) return res.status(400).json({ error: boundsError });
  if ((headers && JSON.stringify(headers).length > 8192) || String(body || '').length > 65536) return res.status(400).json({ error: 'Headers or body exceed allowed size' });
  try {
    if (url) await assertSafeUrl(url);
    if (notify_webhook) await assertSafeUrl(notify_webhook);
  } catch (error) { return res.status(400).json({ error: error.message }); }

  const next = schedule ? nextRun(schedule, timezone || 'UTC') : undefined;

  try {
    const existing = await pool.query('SELECT headers FROM jobs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Job not found' });
    const protectedHeaders = headers ? protectHeaders(headers, existing.rows[0].headers || {}) : null;
    const { rows } = await pool.query(
      `UPDATE jobs SET
          name                = COALESCE($1,  name),
          url                 = COALESCE($2,  url),
          method              = COALESCE($3,  method),
          headers             = COALESCE($4,  headers),
          body                = $5,
          schedule            = COALESCE($6,  schedule),
          timezone            = COALESCE($7,  timezone),
          next_run_at         = COALESCE($8,  next_run_at),
          timeout_seconds     = COALESCE($9,  timeout_seconds),
          retry_count         = COALESCE($10, retry_count),
          retry_delay_seconds = COALESCE($11, retry_delay_seconds),
          is_active           = COALESCE($12, is_active),
          notify_email        = $13,
          notify_webhook      = $14,
          alert_after_failures= COALESCE($15, alert_after_failures),
          updated_at          = NOW()
        WHERE id=$16 AND user_id=$17
        RETURNING *`,
      [
        name, url, method ? method.toUpperCase() : null,
        protectedHeaders ? JSON.stringify(protectedHeaders) : null,
        body !== undefined ? body : null,
        schedule, timezone, next || null,
        timeout_seconds, retry_count, retry_delay_seconds,
        is_active != null ? Boolean(is_active) : null,
        notify_email || null, notify_webhook || null,
        alert_after_failures,
        req.params.id, req.user.userId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    const job = rows[0];
    await unscheduleJob(job.id);
    if (job.is_active) await scheduleJob(job);
    res.json(redactJob(job));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── DELETE /api/jobs/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM jobs WHERE id=$1 AND user_id=$2 RETURNING name', [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    await unscheduleJob(req.params.id);
    res.json({ message: `Job "${rows[0].name}" deleted` });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─── POST /api/jobs/:id/trigger ────────────────────────────
// Manual trigger — runs immediately regardless of schedule
router.post('/:id/trigger', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    await runJobNow(rows[0]);
    res.status(202).json({ message: 'Job accepted — check executions for result.' });
  } catch (err) {
    if (err.message.includes('already running')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/cancel', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE jobs SET cancel_requested=true WHERE id=$1 AND user_id=$2 AND lease_until>NOW() RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (!rows.length) return res.status(409).json({ error: 'Job is not currently running' });
  res.status(202).json({ message: 'Cancellation requested' });
});

// ─── GET /api/jobs/validate-cron ──────────────────────────
router.post('/validate-cron', (req, res) => {
  const { schedule, timezone = 'UTC' } = req.body;
  if (!schedule) return res.status(400).json({ error: 'Schedule is required' });
  if (!validateCron(schedule)) return res.status(400).json({ valid: false, error: 'Invalid cron expression' });
  const next = nextRun(schedule, timezone);
  res.json({ valid: true, next_run: next });
});

module.exports = router;
