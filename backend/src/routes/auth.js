const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (email,password_hash,name) VALUES ($1,$2,$3) RETURNING id,email,name',
      [email.toLowerCase(), hash, name.trim()]
    );
    res.status(201).json({ token: sign(rows[0]), user: rows[0] });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await pool.query(
      'SELECT id,email,name,password_hash FROM users WHERE email=$1', [email.toLowerCase()]
    );
    if (!rows.length || !await bcrypt.compare(password, rows[0].password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: rows[0].id, email: rows[0].email, name: rows[0].name };
    res.json({ token: sign(user), user });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT id,email,name FROM users WHERE id=$1', [req.user.userId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

const sign = u => jwt.sign({ userId: u.id, email: u.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
module.exports = router;
