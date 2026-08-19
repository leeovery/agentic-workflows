'use strict';

async function withRetry(fn) {
  for (let attempt = 1; ; attempt += 1) {
    try { return await fn(); } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
}

module.exports = { withRetry };
