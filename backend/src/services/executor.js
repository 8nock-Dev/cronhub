const { pool } = require('../config/db');
const { sendAlert, sendRecoveryAlert } = require('./alerting');
const { safeRequest } = require('../security/safeHttp');
const { revealHeaders } = require('../security/secrets');

const MAX_RESPONSE_BODY = 2000;

function redactResponseBody(value) {
  return String(value ?? '')
    .slice(0, MAX_RESPONSE_BODY)
    .replace(/("?(?:password|token|secret|authorization|api[_-]?key)"?\s*[:=]\s*)"?[^",\s}]+/gi, '$1[REDACTED]');
}

async function createExecution(job, attempt, triggeredBy, existingId) {
  if (existingId) {
    await pool.query(
      `UPDATE executions SET status='running', started_at=NOW(), completed_at=NULL WHERE id=$1`,
      [existingId]
    );
    return existingId;
  }
  const { rows } = await pool.query(
    `INSERT INTO executions (job_id, status, attempt, triggered_by)
     VALUES ($1, 'running', $2, $3) RETURNING id`,
    [job.id, attempt, triggeredBy]
  );
  return rows[0].id;
}

async function scheduleRetry(job, attempt, errorMessage) {
  const delaySeconds = Math.min(Number(job.retry_delay_seconds) || 60, 3600) * (2 ** Math.max(attempt - 1, 0));
  const { rows } = await pool.query(
    `INSERT INTO executions (job_id, status, attempt, triggered_by, error_message, scheduled_for)
     VALUES ($1, 'retry_pending', $2, 'retry', $3, NOW() + make_interval(secs => $4))
     RETURNING scheduled_for`,
    [job.id, attempt + 1, errorMessage, delaySeconds]
  );
  await pool.query(
    `UPDATE jobs SET last_status='retrying', lease_until=$1 + make_interval(secs => timeout_seconds + 60) WHERE id=$2`,
    [rows[0].scheduled_for, job.id]
  );
}

async function finalizeJob(job, result) {
  const { rows } = await pool.query(
    `UPDATE jobs SET
       last_run_at=NOW(), last_status=$1, lease_until=NULL,
       consecutive_failures=CASE WHEN $2 THEN 0 WHEN $3 THEN consecutive_failures ELSE consecutive_failures + 1 END
     WHERE id=$4
     RETURNING consecutive_failures`,
    [result.status, result.status === 'success', result.status === 'cancelled', job.id]
  );
  if (!rows.length) return;
  const failures = Number(rows[0].consecutive_failures);
  const threshold = Number(job.alert_after_failures) || 3;
  if (['failed', 'timeout'].includes(result.status) && failures === threshold) {
    await sendAlert(job, failures, result.errorMessage);
  } else if (result.status === 'success' && Number(job.consecutive_failures) >= threshold) {
    await sendRecoveryAlert(job);
  }
}

async function executeJob(job, triggeredBy = 'scheduled', attempt = 1, existingExecutionId = null) {
  const executionId = await createExecution(job, attempt, triggeredBy, existingExecutionId);
  const startedAt = Date.now();
  let result;
  const controller = new AbortController();
  await pool.query('UPDATE jobs SET cancel_requested=false WHERE id=$1', [job.id]);
  const cancelPoll = setInterval(async () => {
    try {
      const { rows } = await pool.query('SELECT cancel_requested FROM jobs WHERE id=$1', [job.id]);
      if (rows[0]?.cancel_requested) controller.abort();
    } catch {}
  }, 1000);

  try {
    const method = String(job.method || 'GET').toUpperCase();
    const response = await safeRequest({
      method,
      url: job.url,
      timeout: Math.min(Number(job.timeout_seconds) || 30, 60) * 1000,
      headers: { 'User-Agent': 'CronHub-Scheduler/1.0', ...revealHeaders(job.headers || {}) },
      data: job.body && ['POST', 'PUT', 'PATCH'].includes(method) ? job.body : undefined,
      signal: controller.signal,
    });
    const success = response.status >= 200 && response.status < 400;
    result = {
      status: success ? 'success' : 'failed',
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      responseBody: redactResponseBody(response.data),
      errorMessage: success ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const cancelled = controller.signal.aborted;
    const timeout = !cancelled && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout'));
    result = {
      status: cancelled ? 'cancelled' : timeout ? 'timeout' : 'failed', statusCode: null,
      durationMs: Date.now() - startedAt, responseBody: null,
      errorMessage: cancelled ? 'Cancelled by user' : timeout ? `Timed out after ${job.timeout_seconds}s` : error.message,
    };
  } finally {
    clearInterval(cancelPoll);
  }

  await pool.query(
    `UPDATE executions SET status=$1, status_code=$2, duration_ms=$3, response_body=$4,
      error_message=$5, completed_at=NOW() WHERE id=$6`,
    [result.status, result.statusCode, result.durationMs, result.responseBody, result.errorMessage, executionId]
  );

  if (!['success', 'cancelled'].includes(result.status) && attempt <= Number(job.retry_count || 0)) {
    await scheduleRetry(job, attempt, result.errorMessage);
  } else {
    await finalizeJob(job, result);
    await pool.query('UPDATE jobs SET cancel_requested=false WHERE id=$1', [job.id]);
  }
  return result;
}

module.exports = { executeJob, redactResponseBody };
