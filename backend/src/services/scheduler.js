const cronParser = require('cron-parser');
const { pool } = require('../config/db');
const { executeJob } = require('./executor');

const POLL_MS = 10000;
let polling = false;
let timer;
let lastCleanupAt = 0;

function calcNextRun(schedule, timezone = 'UTC') {
  return cronParser.parseExpression(schedule, { tz: timezone }).next().toDate();
}

async function claimDueJobs(limit = 20) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM jobs
       WHERE is_active=true AND COALESCE(next_run_at, NOW()) <= NOW()
         AND (lease_until IS NULL OR lease_until < NOW())
       ORDER BY next_run_at NULLS FIRST FOR UPDATE SKIP LOCKED LIMIT $1`,
      [limit]
    );
    for (const job of rows) {
      await client.query(
        `UPDATE jobs SET next_run_at=$1, lease_until=NOW() + make_interval(secs => timeout_seconds + 60) WHERE id=$2`,
        [calcNextRun(job.schedule, job.timezone), job.id]
      );
    }
    await client.query('COMMIT');
    return rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function claimDueRetries(limit = 20) {
  const { rows } = await pool.query(
    `WITH due AS (
       SELECT e.id FROM executions e JOIN jobs j ON j.id=e.job_id
       WHERE e.status='retry_pending' AND e.scheduled_for <= NOW() AND j.is_active=true
       ORDER BY e.scheduled_for FOR UPDATE OF e SKIP LOCKED LIMIT $1
     )
     UPDATE executions e SET status='running', started_at=NOW()
     FROM due WHERE e.id=due.id RETURNING e.*`,
    [limit]
  );
  if (!rows.length) return [];
  const jobs = await pool.query('SELECT * FROM jobs WHERE id = ANY($1::uuid[])', [rows.map((row) => row.job_id)]);
  const byId = new Map(jobs.rows.map((job) => [job.id, job]));
  return rows.map((execution) => ({ execution, job: byId.get(execution.job_id) })).filter((item) => item.job);
}

async function cleanupHistory() {
  if (Date.now() - lastCleanupAt < 24 * 60 * 60 * 1000) return;
  await pool.query("DELETE FROM executions WHERE started_at < NOW() - INTERVAL '90 days'");
  lastCleanupAt = Date.now();
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const [jobs, retries] = await Promise.all([claimDueJobs(), claimDueRetries()]);
    await Promise.allSettled([
      ...jobs.map((job) => executeJob(job, 'scheduled')),
      ...retries.map(({ job, execution }) => executeJob(job, 'retry', execution.attempt, execution.id)),
    ]);
    await cleanupHistory();
  } finally { polling = false; }
}

async function scheduleJob(job) {
  await pool.query('UPDATE jobs SET next_run_at=$1, lease_until=NULL WHERE id=$2', [calcNextRun(job.schedule, job.timezone), job.id]);
}

async function unscheduleJob(jobId) {
  await pool.query('UPDATE jobs SET next_run_at=NULL, lease_until=NULL WHERE id=$1', [jobId]);
}

async function runJobNow(job) {
  const { rows } = await pool.query(
    `UPDATE jobs SET lease_until=NOW() + make_interval(secs => timeout_seconds + 60)
     WHERE id=$1 AND (lease_until IS NULL OR lease_until < NOW()) RETURNING *`,
    [job.id]
  );
  if (!rows.length) throw new Error('Job is already running or waiting for retry');
  executeJob(rows[0], 'manual').catch((error) => console.error('[Manual execution]', error.message));
  return { accepted: true };
}

async function initScheduler() {
  await poll();
  timer = setInterval(() => poll().catch((error) => console.error('[Scheduler]', error.message)), POLL_MS);
  timer.unref?.();
  console.log(`[Scheduler] Durable database poller started (${POLL_MS / 1000}s interval)`);
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { calcNextRun, claimDueJobs, claimDueRetries, cleanupHistory, scheduleJob, unscheduleJob, runJobNow, initScheduler, stopScheduler, poll };
