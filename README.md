# ⏰ CronHub

**Self-hosted cron job scheduler. Register any HTTP endpoint — CronHub calls it on schedule, logs every run, and alerts you when things fail.**

CronHub is an open-source alternative to EasyCron, Cron-job.org, and Cronitor. Point it at any publicly accessible HTTP endpoint, set a cron expression, and CronHub takes care of execution, retry logic, failure alerting, and a full execution history dashboard.

---

## Features

- **Any HTTP method** — GET, POST, PUT, PATCH, DELETE with custom headers and body
- **Standard cron expressions** — full 5-field support with timezone control
- **Cron presets** — one-click common schedules with live "next run" preview
- **Exponential backoff retry** — configurable attempts + base delay that doubles each retry
- **Execution timeline** — 60-bar visual history with height proportional to response time
- **Detailed run logs** — status, HTTP code, duration, response body, error message per run
- **Manual trigger** — run any job instantly from the dashboard
- **Failure alerting** — email + webhook alerts after N consecutive failures
- **Pause/resume** — disable individual jobs without deleting them
- **Self-hostable** — Docker Compose, Railway, Render, or Fly.io

---

## Tech Stack

| Layer      | Technology                       |
|------------|----------------------------------|
| Backend    | Node.js 20, Express 4            |
| Scheduling | node-cron + cron-parser          |
| Database   | PostgreSQL 16                    |
| HTTP exec  | axios (with timeout + retry)     |
| Frontend   | React 18, Vite, Tailwind CSS     |
| Auth       | JWT (bcrypt + jsonwebtoken)      |
| Email      | Nodemailer (SMTP)                |
| Deploy     | Docker + Docker Compose          |

---

## Project Structure

```
cronhub/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js           # PostgreSQL pool + auto-migration
│   │   │   └── mailer.js       # Nodemailer SMTP
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT verification
│   │   ├── routes/
│   │   │   ├── auth.js         # Register, login, /me
│   │   │   ├── jobs.js         # CRUD + trigger + cron validation
│   │   │   └── executions.js   # Recent executions feed
│   │   └── services/
│   │       ├── executor.js     # HTTP execution + exponential retry
│   │       ├── scheduler.js    # node-cron task registry
│   │       └── alerting.js     # Email + webhook failure alerts
│   ├── migrations/001_initial.sql
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
└── frontend/
    └── src/
        ├── components/
        │   ├── Header.jsx
        │   ├── JobCard.jsx           # List item: status, schedule, success rate
        │   ├── JobModal.jsx          # 3-tab form: basic / request / alerts
        │   └── ExecutionTimeline.jsx # 60-bar visual history
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx         # Job list with stats
            └── JobDetail.jsx         # Timeline, metrics, run logs table
```

---

## Quick Start

### Option A — Docker

```bash
git clone https://github.com/yourusername/cronhub.git
cd cronhub

docker compose up -d db backend

cd frontend && npm install && npm run dev
# → http://localhost:5176
```

### Option B — Manual

```bash
# Backend
cd backend
cp .env.example .env   # edit DATABASE_URL + JWT_SECRET
npm install
npm run dev            # → http://localhost:3004

# Frontend
cd frontend
npm install
npm run dev            # → http://localhost:5176
```

---

## Cron Expression Reference

| Expression     | Meaning                  |
|----------------|--------------------------|
| `* * * * *`    | Every minute             |
| `*/5 * * * *`  | Every 5 minutes          |
| `0 * * * *`    | Every hour at :00        |
| `0 9 * * *`    | Daily at 9:00 AM         |
| `0 9 * * 1`    | Every Monday at 9:00 AM  |
| `0 9 1 * *`    | First of every month     |
| `*/15 * * * *` | Every 15 minutes         |

Format: `minute hour day-of-month month day-of-week`

---

## How Retry Works

```
Job fires → HTTP request
  ├── Success (2xx–3xx) → execution marked success, consecutive_failures = 0
  └── Failure / timeout
        ├── attempt 2 after base_delay seconds      (e.g. 60s)
        ├── attempt 3 after base_delay × 2 seconds  (e.g. 120s)
        └── attempt 4 after base_delay × 4 seconds  (e.g. 240s)
              → all failed → update consecutive_failures
              → if consecutive_failures >= alert_threshold → send alert
```

---

## API Reference

### Auth
| Method | Endpoint             | Description      |
|--------|----------------------|------------------|
| POST   | `/api/auth/register` | Create account   |
| POST   | `/api/auth/login`    | Get JWT token    |
| GET    | `/api/auth/me`       | Current user     |

### Jobs
| Method | Endpoint                       | Description                        |
|--------|--------------------------------|------------------------------------|
| GET    | `/api/jobs`                    | List all jobs (with exec counts)   |
| POST   | `/api/jobs`                    | Create job                         |
| GET    | `/api/jobs/:id`                | Get job details                    |
| PUT    | `/api/jobs/:id`                | Update job                         |
| DELETE | `/api/jobs/:id`                | Delete job + history               |
| GET    | `/api/jobs/:id/executions`     | Execution history                  |
| POST   | `/api/jobs/:id/trigger`        | Manual run (async)                 |
| POST   | `/api/jobs/validate-cron`      | Validate cron + get next run time  |

### Executions
| Method | Endpoint          | Description                       |
|--------|-------------------|-----------------------------------|
| GET    | `/api/executions` | Recent executions across all jobs |

---

## Deployment

### Railway
```bash
railway new && railway add postgresql
# Set env vars in dashboard
railway up
```

### Render
1. Web Service → `backend/` → start: `npm start`
2. PostgreSQL database → link via `DATABASE_URL`
3. Static Site → `frontend/` → build: `npm run build`, publish: `dist/`

### Fly.io
```bash
cd backend
fly launch
fly secrets set JWT_SECRET=... DATABASE_URL=...
fly deploy
```

---

## Why CronHub vs alternatives

| Feature              | CronHub       | EasyCron Free | cron-job.org |
|----------------------|---------------|---------------|--------------|
| Self-hosted          | ✅            | ❌            | ❌           |
| Unlimited jobs       | ✅            | ❌ (5 jobs)   | ✅           |
| Retry on failure     | ✅ (exp. backoff) | ❌ (paid)  | ❌           |
| Response body logs   | ✅            | ❌ (paid)     | Partial      |
| Webhook alerts       | ✅            | ❌ (paid)     | ❌           |
| Custom HTTP headers  | ✅            | ❌ (paid)     | ❌           |
| Monthly cost         | $0 (self)     | $0–$24        | $0–$14       |

---

## License

MIT — use it, host it, build on it.

---

*Built with Node.js, React, and PostgreSQL.*
