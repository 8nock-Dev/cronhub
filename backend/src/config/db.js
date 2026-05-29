const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 15,
});

pool.on('error', err => console.error('[DB] Pool error:', err.message));

async function initDb() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../../migrations/001_initial.sql'), 'utf8');
    await client.query(sql);
    console.log('[DB] Schema ready');
  } catch (err) {
    console.error('[DB] Init failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
