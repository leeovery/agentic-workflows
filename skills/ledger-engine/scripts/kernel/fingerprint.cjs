'use strict';

// ---------------------------------------------------------------------------
// Kernel: a fingerprint — the first 12 hex digits of the SHA-256 of a text's
// UTF-8 bytes, or of a file's content as it is. The review page's own
// scripts compute a line's the same way (spec-page-model.cjs), so its form
// is a contract.
// ---------------------------------------------------------------------------

const crypto = require('crypto');

/** The first 12 hex digits of the SHA-256 of `content`, a text by its UTF-8 bytes. @param {string|Buffer} content @returns {string} */
function fingerprint(content) {
  return crypto.createHash('sha256').update(typeof content === 'string' ? Buffer.from(content, 'utf8') : content).digest('hex').slice(0, 12);
}

module.exports = { fingerprint };
