'use strict';

// ---------------------------------------------------------------------------
// The ledger copies' seams (test-engine-ledger-copies.cjs,
// test-engine-ledger-copies-race.cjs): a test hooks the render's claim, and
// the moment its fold has read the ledger and what is live. Required before
// anything loads the engine, so the copies' render binds the hooked
// functions.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const manifestIo = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const projection = require(path.join(SCRIPTS, 'domain/projections/ledger-copy.cjs'));
/** @type {{claimed: ((release: () => void) => () => void)|null, folded: (() => void)|null}} */
const seams = { claimed: null, folded: null };
const { tryClaimFile, productCopy } = { tryClaimFile: manifestIo.tryClaimFile, productCopy: projection.productCopy };
manifestIo.tryClaimFile = (/** @type {string} */ file, /** @type {number|undefined} */ staleMs) => {
  const release = tryClaimFile(file, staleMs);
  return release && seams.claimed ? seams.claimed(release) : release;
};
projection.productCopy = (/** @type {any} */ view) => {
  if (seams.folded) seams.folded();
  return productCopy(view);
};

/** Every seam unhooked, for the next test. */
function clearSeams() {
  seams.claimed = null;
  seams.folded = null;
}

module.exports = { seams, clearSeams };
