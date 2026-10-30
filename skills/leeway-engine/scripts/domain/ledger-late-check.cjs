'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the late one-decision check (16.19.8, 5.S34) — a decision
// that landed unchecked, the separate call unable to judge it as it was
// written, judged at a later start.
//
// - Boot folds the ledger for the decisions owed a check — landed unchecked,
//   no `checked` event naming them — and, where any is, launches the check
//   as a detached `engine ledger late-check`, so a start never waits on it.
//   One check works at a time: a second finds the first's claim, in the
//   state's cache, and ends at once.
// - Each owed decision is judged outside the writer lock; then, under it,
//   the ledger is read again as every read takes it — a line written
//   outside the engine since the check's own read stops it, never committed
//   with its result (5.4.4) — and a `checked` event naming the decision and
//   the rules it holds, `one` or `several`, is appended and committed, one
//   decision at a time, so a check cut short keeps what it found. The event
//   is recorded beside the entry, tagged as the entry is — its unit, topic,
//   phase and session — and the entry's own line is never touched (5.4.1).
// - A decision the call still cannot judge stays owed, for the next start.
//   An answer that does not fit is the decision's own, and the check goes
//   on to the next; any other failure — no login, a rate limit, a timeout,
//   an outage — would meet every decision after it, which stay owed too.
// - A decision found holding several rules shows flagged wherever its
//   record is read: the fold carries the result (ledger-fold.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf, launcher } = require('../kernel/call.cjs');
const { tryClaimFile } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { appendEntry, carrying, checkLines } = require('./ledger.cjs');
const { LEDGER, entryKind } = require('./ledger-events.cjs');
const { readFolded } = require('./ledger-fold.cjs');
const { ledgerMessage } = require('./ledger-write.cjs');
const { judgeDecision } = require('./ledger-one-decision.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail } = require('./commit.cjs');

/** @typedef {import('./ledger.cjs').EntryPlace} EntryPlace */
/** @typedef {import('../kernel/claude-call.cjs').CannotRun} CannotRun */

/** The verb the detached check runs. */
const LATE_CHECK_VERB = 'late-check';

const LATE_CHECK_USAGE = `ledger ${LATE_CHECK_VERB}   (the late one-decision check, which boot launches)`;


/**
 * The decisions owed a check, by id, each where its line sits: landed
 * unchecked, no `checked` event naming them.
 * @type {import('./ledger-fold.cjs').Fold<Map<string, EntryPlace>>}
 */
const OWED = {
  start: () => new Map(),
  step: (owed, event, place) => {
    if (entryKind(event) === 'decision' && event.unchecked === true) owed.set(/** @type {string} */ (event.id), place);
    if (event.event === 'checked') owed.delete(/** @type {string} */ (event.entry));
  },
};

/** The check's claim, in the state's cache. @param {string} root */
function claimFile(root) {
  return path.join(root, '.cache', '.late-check');
}

/**
 * Record what the check found of `entry` beside it: under the writer lock,
 * the ledger's lines read again, then a `checked` event appended and
 * committed.
 * @param {string} cwd @param {string} root @param {Record<string, unknown>} entry @param {'one'|'several'} rules
 * @param {string[]} warnings
 */
function recordChecked(cwd, root, entry, rules, warnings) {
  withStateLock(root, () => {
    checkLines(root, warnings);
    const { unit, topic, phase, session, id } = /** @type {Record<string, string>} */ (entry);
    const checked = appendEntry(root, { event: 'checked', unit, topic, phase, session, entry: id, rules }, warnings);
    commitStateTail(cwd, LEDGER, ledgerMessage(unit, 'checked', /** @type {string} */ (checked.id), topic), warnings);
  });
}

/**
 * What a late check that ran did: how many decisions it checked and found
 * holding several rules, how many stay owed, and why the call could not
 * judge one, where it could not.
 * @typedef {{ran: true, checked: number, several: number, owed: number, cannot?: {reason: CannotRun, detail: string}, warnings?: string[]}} Checked
 */

/** What the late check did: ran, or not, another holding the claim. @typedef {Checked|{ran: false}} LateCheck */

/**
 * Judge each owed decision and record the result beside it.
 * @param {string} cwd @param {string} root @param {string[]} warnings
 * @returns {Checked}
 */
function checkOwed(cwd, root, warnings) {
  const owed = readFolded(root, OWED, warnings, (places, entryAt) => [...places.values()].map(entryAt));
  /** @type {Checked} */
  const done = { ran: true, checked: 0, several: 0, owed: owed.length };
  for (const entry of owed) {
    const judged = judgeDecision(entry, { cwd, unit: /** @type {string} */ (entry.unit), verb: LATE_CHECK_VERB, warnings });
    if ('cannot' in judged) {
      done.cannot = { reason: judged.cannot, detail: judged.detail };
      if (judged.cannot !== 'misfit') break;
      continue;
    }
    const rules = judged.rules.length === 1 ? 'one' : 'several';
    recordChecked(cwd, root, entry, rules, warnings);
    done.checked += 1;
    done.owed -= 1;
    if (rules === 'several') done.several += 1;
  }
  return done;
}

/**
 * `ledger late-check`: every decision owed a check judged, each result
 * recorded and committed — where no other check holds the claim.
 * @param {string} cwd @param {string[]} args
 * @returns {LateCheck}
 */
function lateCheck(cwd, args) {
  if (args.length > 0) throw new Error(`Usage: engine ${LATE_CHECK_USAGE}`);
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    fs.mkdirSync(path.dirname(claimFile(root)), { recursive: true });
    const release = tryClaimFile(claimFile(root));
    if (release === null) return { ran: false };
    try {
      const done = checkOwed(cwd, root, warnings);
      return warnings.length > 0 ? { ...done, warnings } : done;
    } finally {
      release();
    }
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * Boot's step: launch the late check, detached, where a decision is owed
 * one. Never stops the start: what keeps it from launching is a warning, and
 * a check that could not start leaves its decisions owed, for the next.
 * @param {string} root @param {string[]} warnings
 * @returns {boolean} whether it launched
 */
function launchLateCheck(root, warnings) {
  try {
    if (readFolded(root, OWED, warnings, (owed) => owed.size) === 0) return false;
    launcher.launch(root, ['ledger', LATE_CHECK_VERB]);
    return true;
  } catch (err) {
    warnings.push(`the late one-decision check did not start: ${messageOf(err)}`);
    return false;
  }
}

module.exports = { LATE_CHECK_VERB, LATE_CHECK_USAGE, launchLateCheck, lateCheck };
