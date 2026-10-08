const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../config/mailer');

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

router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const genericResponse = { message: 'If an account exists for that email, a password reset link has been sent.' };
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const { rows } = await pool.query('SELECT id,email,name FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.json(genericResponse);
    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
       VALUES($1,$2,NOW()+INTERVAL '30 minutes')
       ON CONFLICT(user_id) DO UPDATE SET token_hash=$2,expires_at=NOW()+INTERVAL '30 minutes',created_at=NOW()`,
      [user.id,tokenHash]
    );
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5176'}/reset-password?token=${token}`;
    const safeName = user.name.replace(/[&<>"']/g, '');
    await sendEmail({
      to: user.email,
      subject: 'Reset your CronHub password',
      html: `<p>Hello ${safeName},</p><p>Use the link below to reset your password. It expires in 30 minutes and can only be used once.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
    res.json(genericResponse);
  } catch (err) {
    console.error('[Auth/forgot-password]', err.message);
    res.json(genericResponse);
  }
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (!token || password.length < 8) return res.status(400).json({ error: 'A valid token and password of at least 8 characters are required' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'DELETE FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>NOW() RETURNING user_id',
      [tokenHash]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash,rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Auth/reset-password]', err.message);
    res.status(500).json({ error: 'Unable to reset password' });
  } finally { client.release(); }
});

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT id,email,name FROM users WHERE id=$1', [req.user.userId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

const sign = u => jwt.sign({ userId: u.id, email: u.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
module.exports = router;
