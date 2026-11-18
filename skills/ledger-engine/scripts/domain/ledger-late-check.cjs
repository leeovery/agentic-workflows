'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the late one-decision check (16.19.8, 5.S34) — a decision
// that landed unchecked, the separate call unable to judge it as it was
// written, judged at a later start.
//
// - Boot folds the ledger for the decisions owed a check — landed unchecked,
//   no `checked` event naming them, none the migration carried, which the
//   records step held to one thing (21.6.3) — and, where any is, launches
//   the check as a detached `engine ledger late-check`, so a start never
//   waits on it. One check works at a time: a second finds the first's
//   claim, in the state's cache, and ends at once.
// - Each owed decision is judged outside the writer lock, and what it found
//   is recorded with the batch it falls in: under the lock, the ledger is
//   read again as every read takes it — a line written outside the engine
//   since the check's own read stops it, never committed with its results
//   (5.4.4) — and a `checked` event for each decision, naming it and the
//   rules it holds, `one` or `several`, is appended, the batch as one, and
//   committed as one, so a long pass makes a commit a batch, not one a
//   decision; a check cut short loses the judgements of its last batch
//   alone, and the next pass, folding the ledger afresh, judges only the
//   decisions no `checked` event names. The event is recorded beside the
//   entry, tagged as the entry is — its unit, topic, phase and session —
//   and the entry's own line is never touched (5.4.1).
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
const { appendEntries, carrying, checkLines, commitLedger } = require('./ledger.cjs');
const { CARRIED_SESSION, entryKind } = require('./ledger-events.cjs');
const { readFolded } = require('./ledger-fold.cjs');
const { newId } = require('./ledger-ids.cjs');
const { judgeDecision } = require('./ledger-one-decision.cjs');
const { withStateLock } = require('./state-worktree.cjs');

/** @typedef {import('./ledger.cjs').EntryPlace} EntryPlace */
/** @typedef {import('../kernel/claude-call.cjs').CannotRun} CannotRun */

/** The verb the detached check runs. */
const LATE_CHECK_VERB = 'late-check';

const LATE_CHECK_USAGE = `ledger ${LATE_CHECK_VERB}   (the late one-decision check, which boot launches)`;

/** The most results a commit records: a check cut short loses no more judgements than this. */
const BATCH = 25;


/**
 * The decisions owed a check, by id, each where its line sits: landed
 * unchecked, no `checked` event naming them, the migration's session
 * tagging none.
 * @type {import('./ledger-fold.cjs').Fold<Map<string, EntryPlace>>}
 */
const OWED = {
  start: () => new Map(),
  step: (owed, event, place) => {
    if (entryKind(event) === 'decision' && event.unchecked === true && event.session !== CARRIED_SESSION) owed.set(/** @type {string} */ (event.id), place);
    if (event.event === 'checked') owed.delete(/** @type {string} */ (event.entry));
  },
};

/** The check's claim, in the state's cache. @param {string} root */
function claimFile(root) {
  return path.join(root, '.cache', '.late-check');
}

/** What the check found of one decision. @typedef {{entry: Record<string, unknown>, rules: 'one'|'several'}} Result */

/**
 * Record what the check found of each decision beside it: under the writer
 * lock, the ledger's lines read again, then a `checked` event for each
 * appended as one and committed.
 * @param {string} cwd @param {string} root @param {Result[]} results @param {string[]} warnings
 */
function recordChecked(cwd, root, results, warnings) {
  if (results.length === 0) return;
  withStateLock(root, () => {
    checkLines(root, warnings);
    appendEntries(root, results.map(({ entry, rules }) => {
      const { unit, topic, phase, session, id } = entry;
      return { fields: { event: 'checked', unit, topic, phase, session, entry: id, rules }, id: newId() };
    }), warnings);
    commitLedger(cwd, `ledger: the late check, ${results.length} ${results.length === 1 ? 'decision' : 'decisions'} checked`, warnings);
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
  /** @type {Result[]} */
  const batch = [];
  for (const entry of owed) {
    const judged = judgeDecision(entry, { cwd, unit: /** @type {string} */ (entry.unit), verb: LATE_CHECK_VERB, warnings });
    if ('cannot' in judged) {
      done.cannot = { reason: judged.cannot, detail: judged.detail };
      if (judged.cannot !== 'misfit') break;
      continue;
    }
    const rules = judged.rules.length === 1 ? 'one' : 'several';
    batch.push({ entry, rules });
    done.checked += 1;
    done.owed -= 1;
    if (rules === 'several') done.several += 1;
    if (batch.length === BATCH) recordChecked(cwd, root, batch.splice(0), warnings);
  }
  recordChecked(cwd, root, batch, warnings);
  return done;
}

/**
 * `ledger late-check`: every decision owed a check judged, the results
 * recorded and committed a batch at a time — where no other check holds the
 * claim.
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

module.exports = { BATCH, LATE_CHECK_VERB, LATE_CHECK_USAGE, launchLateCheck, lateCheck };
