require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { initDb, pool }  = require('./config/db');
const { initScheduler, stopScheduler } = require('./services/scheduler');
const authRoutes        = require('./routes/auth');
const jobRoutes         = require('./routes/jobs');
const executionRoutes   = require('./routes/executions');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5176', credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth',       authRoutes);
app.use('/api/jobs',       jobRoutes);
app.use('/api/executions', executionRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'cronhub' }));
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

const PORT = process.env.PORT || 3004;
let server;

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('change_this')) {
    throw new Error('JWT_SECRET must be a non-default value of at least 32 characters');
  }
  if (!process.env.SECRETS_ENCRYPTION_KEY || process.env.SECRETS_ENCRYPTION_KEY.length < 32 || process.env.SECRETS_ENCRYPTION_KEY.includes('change_this')) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be a non-default value of at least 32 characters');
  }
  await initDb();
  await initScheduler();
  server = app.listen(PORT, () => {
    console.log(`\n⏰  CronHub backend → http://localhost:${PORT}\n`);
  });
}

async function shutdown(signal) {
  console.log(`[Shutdown] ${signal} received`);
  stopScheduler();
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => { console.error(error); process.exit(1); }));
process.once('SIGINT', () => shutdown('SIGINT').catch((error) => { console.error(error); process.exit(1); }));

start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
module.exports = app;
