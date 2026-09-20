'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the walkthrough — the one home for reading the project
// manifest's `walkthrough` object. Boot's status field and workflow-start's
// one-time offer both derive from this state, so the vocabulary exists
// exactly once. The answer write lives here too, one confined transaction:
// the offer is answered once and the answer is the record. Nothing else is
// stored — no seen-set, no screen position.
// ---------------------------------------------------------------------------

const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { commitPathspecScoped, noteIfNothingCommitted, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');

/** The two answers a project manifest records; `none` is their absence. */
const ANSWERS = /** @type {const} */ (['walked', 'skipped']);

/** @typedef {typeof ANSWERS[number]} WalkthroughAnswer */
/** @typedef {'none' | WalkthroughAnswer} WalkthroughStatus */

/**
 * @typedef {object} WalkthroughState
 * @property {WalkthroughStatus} status
 */

/** @type {Record<WalkthroughAnswer, string>} */
const ANSWER_MESSAGES = {
  walked: 'chore(help): walkthrough walked',
  skipped: 'chore(help): walkthrough skipped',
};

/**
 * Read the walkthrough state. Anything other than a recorded answer —
 * including a missing or corrupt project manifest, or a malformed field
 * shape — reads `none`: the nothing-recorded state the one-time offer keys
 * on. Corruption surfaces loudly at the first manifest write, not here —
 * boot and the menus must stay usable.
 * @param {string} cwd
 * @returns {WalkthroughState}
 */
function walkthroughState(cwd) {
  /** @type {Record<string, any>} */
  let manifest = {};
  try {
    manifest = readProjectManifest(cwd);
  } catch (_) {
    return { status: 'none' };
  }
  const w = manifest && manifest.walkthrough;
  const raw = w && typeof w === 'object' && !Array.isArray(w) && typeof w.status === 'string' ? w.status : 'none';
  if (!ANSWERS.includes(/** @type {WalkthroughAnswer} */ (raw))) return { status: 'none' };
  return { status: /** @type {WalkthroughAnswer} */ (raw) };
}

/**
 * Record the answer to workflow-start's one-time offer — `walked` (the eight
 * screens were opened) or `skipped` (the offer was declined) — and commit it
 * confined to the project manifest. Refuses any other value, and refuses
 * once anything is recorded: the offer is answered once.
 * @param {string} cwd @param {string} answer
 * @returns {{status: WalkthroughAnswer, committed: string|null, note?: string}}
 */
function recordWalkthrough(cwd, answer) {
  if (!ANSWERS.includes(/** @type {WalkthroughAnswer} */ (answer))) {
    throw new Error(`walkthrough record: the answer is one of ${ANSWERS.join(', ')} — got "${answer}"`);
  }
  const status = /** @type {WalkthroughAnswer} */ (answer);
  const current = walkthroughState(cwd).status;
  if (current !== 'none') {
    throw new Error(`walkthrough record: the walkthrough is "${current}" — the answer is recorded once, while nothing is recorded`);
  }
  withProjectLock(cwd, () => {
    /** @type {Record<string, any>} */
    const manifest = readProjectManifest(cwd);
    const w = manifest.walkthrough && typeof manifest.walkthrough === 'object' && !Array.isArray(manifest.walkthrough) ? manifest.walkthrough : {};
    manifest.walkthrough = { ...w, status };
    writeProjectManifestAtomic(cwd, manifest);
  });
  const committed = commitPathspecScoped(cwd, PROJECT_MANIFEST_SPEC, ANSWER_MESSAGES[status]);
  /** @type {{status: WalkthroughAnswer, committed: string|null, note?: string}} */
  const result = { status, committed };
  noteIfNothingCommitted(result, committed);
  return result;
}

module.exports = { walkthroughState, recordWalkthrough };
