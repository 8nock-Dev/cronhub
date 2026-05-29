-- CronHub Database Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- JOBS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identity
  name                  VARCHAR(255) NOT NULL,

  -- HTTP request config
  url                   TEXT NOT NULL,
  method                VARCHAR(10)  DEFAULT 'GET',
  headers               JSONB        DEFAULT '{}',
  body                  TEXT,

  -- Schedule
  schedule              VARCHAR(100) NOT NULL,   -- standard cron expression (5 fields)
  timezone              VARCHAR(60)  DEFAULT 'UTC',
  next_run_at           TIMESTAMPTZ,

  -- Execution config
  timeout_seconds       INTEGER DEFAULT 30,
  retry_count           INTEGER DEFAULT 2,       -- additional attempts after first failure
  retry_delay_seconds   INTEGER DEFAULT 60,      -- base delay; doubles each attempt

  -- State
  is_active             BOOLEAN DEFAULT true,
  last_run_at           TIMESTAMPTZ,
  last_status           VARCHAR(20)  DEFAULT 'pending',  -- pending|running|success|failed|timeout

  -- Alerting
  notify_email          VARCHAR(255),
  notify_webhook        TEXT,
  consecutive_failures  INTEGER DEFAULT 0,
  alert_after_failures  INTEGER DEFAULT 3,        -- alert when this many consecutive failures

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- EXECUTIONS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  status         VARCHAR(20) NOT NULL,   -- success|failed|timeout|running
  status_code    INTEGER,
  duration_ms    INTEGER,
  response_body  TEXT,                   -- first 2000 chars of response
  error_message  TEXT,

  attempt        INTEGER DEFAULT 1,      -- 1 = first try, 2+ = retry
  triggered_by   VARCHAR(20) DEFAULT 'scheduled',  -- scheduled|manual|retry

  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_user_id          ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_active           ON jobs(is_active, next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_executions_job_id     ON executions(job_id);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_job_time   ON executions(job_id, started_at DESC);
