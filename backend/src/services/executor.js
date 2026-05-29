const axios    = require('axios');
const { pool } = require('../config/db');
const { sendAlert } = require('./alerting');

const MAX_RESPONSE_BODY = 2000; // chars to store

/**
 * Executes a job with retry logic.
 * Creates an execution record in the DB for each attempt.
 * Updates job.last_status and job.consecutive_failures after completion.
 */
async function executeJob(job, triggeredBy = 'scheduled') {
  const maxAttempts = 1 + (job.retry_count || 0);
  let lastResult    = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      // Exponential backoff: base * 2^(attempt-2)  →  60s, 120s, 240s…
      const delay = (job.retry_delay_seconds || 60) * Math.pow(2, attempt - 2) * 1000;
      console.log(`[Executor] Retry ${attempt}/${maxAttempts} for job "${job.name}" in ${delay / 1000}s`);
      await sleep(delay);
    }

    lastResult = await executeOnce(job, attempt, attempt === 1 ? triggeredBy : 'retry');
    if (lastResult.status === 'success') break;
  }

  // Update job state
  const isSuccess = lastResult.status === 'success';
  const failures  = isSuccess ? 0 : (job.consecutive_failures || 0) + 1;

  await pool.query(
    `UPDATE jobs SET
        last_run_at          = NOW(),
        last_status          = $1,
        consecutive_failures = $2,
        next_run_at          = (SELECT next_run_at FROM jobs WHERE id=$3)
      WHERE id=$3`,
    [lastResult.status, failures, job.id]
  );

  // Alert on consecutive failure threshold
  if (!isSuccess && failures >= (job.alert_after_failures || 3)) {
    sendAlert(job, failures, lastResult.error_message).catch(e =>
      console.error('[Alert failed]', e.message)
    );
  }

  return lastResult;
}

/**
 * Single HTTP request attempt — creates an execution row and updates it.
 */
async function executeOnce(job, attempt, triggeredBy) {
  // Insert an execution row in 'running' state
  const { rows } = await pool.query(
    `INSERT INTO executions (job_id, status, attempt, triggered_by)
      VALUES ($1, 'running', $2, $3) RETURNING id`,
    [job.id, attempt, triggeredBy]
  );
  const execId = rows[0].id;

  const startTime = Date.now();
  let status = 'failed';
  let statusCode = null;
  let responseBody = null;
  let errorMessage = null;

  try {
    // Build request config
    const config = {
      method:       job.method || 'GET',
      url:          job.url,
      timeout:      (job.timeout_seconds || 30) * 1000,
      headers: {
        'User-Agent':   'CronHub-Scheduler/1.0',
        ...(job.headers || {}),
      },
      validateStatus: () => true,   // never throw on HTTP status
      maxRedirects:   5,
    };

    if (job.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      config.data = job.body;
      if (!config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }
    }

    const response  = await axios(config);
    const durationMs = Date.now() - startTime;

    statusCode   = response.status;
    responseBody = String(response.data || '').slice(0, MAX_RESPONSE_BODY);
    status       = response.status >= 200 && response.status < 400 ? 'success' : 'failed';

    if (status === 'failed') {
      errorMessage = `HTTP ${response.status}`;
    }

    await pool.query(
      `UPDATE executions SET
          status=$1, status_code=$2, duration_ms=$3,
          response_body=$4, error_message=$5, completed_at=NOW()
        WHERE id=$6`,
      [status, statusCode, durationMs, responseBody, errorMessage, execId]
    );

    console.log(`[Executor] ${job.name} → ${status} (${statusCode}, ${durationMs}ms, attempt ${attempt})`);
  } catch (err) {
    const durationMs = Date.now() - startTime;

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      status = 'timeout';
      errorMessage = `Timed out after ${job.timeout_seconds}s`;
    } else if (err.code === 'ENOTFOUND') {
      errorMessage = `DNS resolution failed: ${err.hostname}`;
    } else if (err.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
    } else {
      errorMessage = err.message;
    }

    await pool.query(
      `UPDATE executions SET
          status=$1, duration_ms=$2, error_message=$3, completed_at=NOW()
        WHERE id=$4`,
      [status, durationMs, errorMessage, execId]
    );

    console.log(`[Executor] ${job.name} → ${status}: ${errorMessage} (attempt ${attempt})`);
  }

  return { status, statusCode, errorMessage };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { executeJob };
