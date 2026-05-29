const cron     = require('node-cron');
const cronParser = require('cron-parser');
const { pool } = require('../config/db');
const { executeJob } = require('./executor');

const tasks = new Map(); // jobId → ScheduledTask

function scheduleJob(job) {
  if (tasks.has(job.id)) { tasks.get(job.id).stop(); tasks.delete(job.id); }

  if (!isValidCron(job.schedule)) {
    console.error(`[Scheduler] Invalid cron for job "${job.name}": ${job.schedule}`);
    return;
  }

  const task = cron.schedule(job.schedule, async () => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM jobs WHERE id=$1 AND is_active=true', [job.id]
      );
      if (!rows.length) { unscheduleJob(job.id); return; }

      const fresh = rows[0];
      // Update next_run_at before executing
      const next = calcNextRun(fresh.schedule, fresh.timezone);
      await pool.query('UPDATE jobs SET next_run_at=$1 WHERE id=$2', [next, fresh.id]);

      await executeJob(fresh, 'scheduled');
    } catch (err) {
      console.error(`[Scheduler] Execution error for job ${job.id}:`, err.message);
    }
  }, {
    timezone: job.timezone || 'UTC',
    scheduled: true,
  });

  tasks.set(job.id, task);
  console.log(`[Scheduler] Scheduled "${job.name}" → ${job.schedule} (${job.timezone || 'UTC'})`);
}

function unscheduleJob(jobId) {
  if (tasks.has(jobId)) {
    tasks.get(jobId).stop();
    tasks.delete(jobId);
    console.log(`[Scheduler] Unscheduled job ${jobId}`);
  }
}

async function runJobNow(job, triggeredBy = 'manual') {
  return executeJob(job, triggeredBy);
}

async function initScheduler() {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE is_active=true');
  rows.forEach(scheduleJob);
  console.log(`[Scheduler] Initialized with ${rows.length} active job(s)`);
}

function isValidCron(expr) {
  return cron.validate(expr);
}

function calcNextRun(schedule, timezone = 'UTC') {
  try {
    return cronParser.parseExpression(schedule, { tz: timezone }).next().toDate();
  } catch { return null; }
}

module.exports = { scheduleJob, unscheduleJob, runJobNow, initScheduler };
