const crypto = require('crypto');

const MASK = '••••••••';

function key() {
  const secret = process.env.SECRETS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32 || secret.includes('change_this')) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be a non-default value of at least 32 characters');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function decrypt(value) {
  if (typeof value !== 'string' || !value.startsWith('enc:v1:')) return value;
  const [, , iv, tag, ciphertext] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function protectHeaders(headers = {}, existing = {}) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name,
    value === MASK && existing[name] ? existing[name] : encrypt(value),
  ]));
}

function revealHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, decrypt(value)]));
}

function redactJob(job) {
  return { ...job, headers: Object.fromEntries(Object.keys(job.headers || {}).map((name) => [name, MASK])) };
}

module.exports = { MASK, decrypt, encrypt, protectHeaders, redactJob, revealHeaders };
