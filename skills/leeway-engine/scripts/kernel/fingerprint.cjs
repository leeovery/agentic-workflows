'use strict';

// ---------------------------------------------------------------------------
// Kernel: a text's fingerprint — the first 12 hex digits of the SHA-256 of
// its UTF-8 bytes. The review page's own scripts compute a line's the same
// way (spec-page-model.cjs), so its form is a contract.
// ---------------------------------------------------------------------------

const crypto = require('crypto');

/** The first 12 hex digits of the SHA-256 of `text`. @param {string} text @returns {string} */
function fingerprint(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
}

module.exports = { fingerprint };
