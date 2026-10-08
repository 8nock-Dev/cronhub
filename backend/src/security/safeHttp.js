const axios = require('axios');
const { assertSafeUrl } = require('./urlSafety');

async function safeRequest(config, { maxRedirects = 3, maxContentLength = 1024 * 1024 } = {}) {
  let url = await assertSafeUrl(config.url);
  for (let count = 0; count <= maxRedirects; count += 1) {
    const response = await axios({ ...config, url, maxRedirects: 0, maxContentLength, maxBodyLength: maxContentLength, validateStatus: () => true });
    if (response.status < 300 || response.status >= 400 || !response.headers.location) return response;
    if (count === maxRedirects) throw new Error('Too many redirects');
    url = await assertSafeUrl(new URL(response.headers.location, url).toString());
  }
  throw new Error('Request failed');
}

module.exports = { safeRequest };
