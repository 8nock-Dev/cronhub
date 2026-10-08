const dns = require('dns').promises;
const { assertPublicAddress, assertSafeUrl } = require('./urlSafety');
const { MASK, encrypt, decrypt, protectHeaders, redactJob, revealHeaders } = require('./secrets');
const { redactResponseBody } = require('../services/executor');

jest.mock('dns', () => ({ promises: { lookup: jest.fn() } }));

beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY = 'test-key-that-is-longer-than-thirty-two-characters'; });

test.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1'])(
  'blocks private address %s',
  (address) => expect(() => assertPublicAddress(address)).toThrow('Blocked network')
);

test('accepts a public HTTP URL', async () => {
  dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  await expect(assertSafeUrl('https://example.com/run')).resolves.toBe('https://example.com/run');
});

test('encrypts, decrypts and masks request headers', () => {
  const encrypted = encrypt('Bearer secret');
  expect(encrypted).not.toContain('Bearer secret');
  expect(decrypt(encrypted)).toBe('Bearer secret');
  const protectedHeaders = protectHeaders({ Authorization: 'Bearer secret' });
  expect(revealHeaders(protectedHeaders)).toEqual({ Authorization: 'Bearer secret' });
  expect(redactJob({ headers: protectedHeaders }).headers).toEqual({ Authorization: MASK });
});

test('preserves an encrypted header when a masked value is submitted', () => {
  const existing = protectHeaders({ Authorization: 'Bearer secret' });
  expect(protectHeaders({ Authorization: MASK }, existing)).toEqual(existing);
});

test('redacts common secrets from response logs', () => {
  expect(redactResponseBody('{"token":"abc123","name":"safe"}')).toContain('[REDACTED]');
  expect(redactResponseBody('{"token":"abc123"}')).not.toContain('abc123');
});
