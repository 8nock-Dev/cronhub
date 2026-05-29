require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { initDb }        = require('./config/db');
const { initScheduler } = require('./services/scheduler');
const authRoutes        = require('./routes/auth');
const jobRoutes         = require('./routes/jobs');
const executionRoutes   = require('./routes/executions');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5176', credentials: true }));
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/jobs',       jobRoutes);
app.use('/api/executions', executionRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'cronhub' }));
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

const PORT = process.env.PORT || 3004;

async function start() {
  await initDb();
  await initScheduler();
  app.listen(PORT, () => {
    console.log(`\n⏰  CronHub backend → http://localhost:${PORT}\n`);
  });
}

start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
module.exports = app;
