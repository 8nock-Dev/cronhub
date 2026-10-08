const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');

const BLOCKED = new Set(['unspecified', 'broadcast', 'multicast', 'linkLocal', 'loopback', 'private', 'reserved', 'carrierGradeNat', 'uniqueLocal', 'ipv4Mapped']);

function assertPublicAddress(address) {
  const range = ipaddr.parse(address).range();
  if (BLOCKED.has(range)) throw new Error(`Blocked network address range: ${range}`);
}

async function assertSafeUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are allowed');
  if (url.username || url.password) throw new Error('Credentials in URLs are not allowed');
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error('Hostname did not resolve');
  addresses.forEach(({ address }) => assertPublicAddress(address));
  return url.toString();
}

module.exports = { assertPublicAddress, assertSafeUrl };
