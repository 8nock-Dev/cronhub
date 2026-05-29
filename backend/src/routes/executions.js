const express  = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/executions — recent executions across all jobs
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const { rows } = await pool.query(
      `SELECT e.*, j.name AS job_name, j.url AS job_url
        FROM executions e
        JOIN jobs j ON j.id = e.job_id
        WHERE j.user_id = $1
        ORDER BY e.started_at DESC
        LIMIT $2`,
      [req.user.userId, limit]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
