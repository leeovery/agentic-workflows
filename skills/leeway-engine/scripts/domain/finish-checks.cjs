'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the engine checks of a unit's finish (6.4.10) — the
// engine's items of finish's checklist (checklist.cjs), worked out at each
// call and never kept (6.4.3). Inbox items closed and the build's log
// closed stay Claude's marks.
//
// - The review phase passed and its report written: where the unit has a
//   review phase — every type the build takes but a quick-fix, whose review
//   runs only when the person asks (19.5.14) — the review phase over, as
//   its rounds' records say (review-phase.cjs): a round passed or settled,
//   its report written by `review round` as it recorded it, and every fix
//   task that round made done or closed. Its way on is the entry's
//   refusal where the review cannot be entered yet, else what the review
//   waits on.
// - No question waiting on the person: the unit's questions waiting, as
//   `raise waiting` reads them (questions.cjs) — the build never concludes
//   over one (12.13.22), wherever it was raised, the review phase's among
//   them. Its way on names each, and the build's stop that puts them to
//   the person (build-screens.cjs).
// - The records indexed: where this checkout's knowledge base is set up —
//   setting it up is the person's choice (knowledge/sync.cjs) — every
//   record of the unit's (22.6.2) held by the store as it stands now
//   (knowledge/status.cjs); its way on is the unit's index. A base set up
//   that does not read takes the item off, said as a warning.
//
// A call reads each once for all its items (phase-checks.cjs, `once`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { once } = require('./phase-checks.cjs');
const { reviewRefusal } = require('./review-entry.cjs');
const { reviewStanding, endedRefusal } = require('./review-phase.cjs');
const { readiness, unindexedRecords } = require('./knowledge/status.cjs');
const { waitingAndFreed } = require('./questions.cjs');

/** @typedef {import('./phase-checks.cjs').Reading} Reading */
/** @typedef {import('./review-phase.cjs').ReviewStanding} ReviewStanding */

/** Whether the unit has a review phase: every type the build takes but a quick-fix (19.5.14). @param {Reading} at */
const hasReviewPhase = ({ manifest }) => manifest.work_type !== 'quick-fix';

/**
 * Why the unit's review phase cannot be entered, or where it stands: read
 * once a call.
 * @param {Reading} at @returns {{refused: string, standing: null}|{refused: null, standing: ReviewStanding}}
 */
const reviewRead = (at) => once(at, 'review', () => {
  const refused = reviewRefusal(at);
  return refused === null ? { refused, standing: reviewStanding(at) } : { refused, standing: null };
});

/** The review phase is over. @param {Reading} at */
const reviewPassed = (at) => reviewRead(at).standing?.over === true;

/** What stands between the unit and its review phase over, with the way on. @param {Reading} at */
function reviewWay(at) {
  const { refused, standing } = reviewRead(at);
  if (standing === null) return refused;
  return endedRefusal(at.unit, standing) ?? `${at.unit}'s review phase is in round ${standing.round} — enter review ${at.unit}`;
}

/** The unit's questions waiting on the person: read once a call. @param {Reading} at */
const waiting = (at) => once(at, 'questions', () => waitingAndFreed(at.cwd, at.unit, at.warnings).waiting);

/** No question of the unit waits on the person. @param {Reading} at */
const questionsAnswered = (at) => waiting(at).length === 0;

/** The questions waiting, with the way on. @param {Reading} at */
function questionsWay(at) {
  const asked = waiting(at).map(({ question, asks }) => `${question}, ${asks}`).join('; ');
  return `${asked} — the unit never finishes over a question waiting on the person: stop for them, render build-stop ${at.unit}, and take each once they are ready to discuss it`;
}

/**
 * Whether this checkout's knowledge base is set up and reads: read once a
 * call. One set up that does not read is said as a warning, so the item it
 * takes off is never dropped silently.
 * @param {Reading} at
 */
const knowledgeSetUp = (at) => once(at, 'knowledge', () => {
  const root = stateRoot(at.cwd);
  /** @type {string[]} */
  const said = [];
  if (readiness(root, (text) => said.push(text.trim())) !== 'not-ready') return true;
  if (fs.existsSync(knowledgeFiles(root).config)) {
    at.warnings.push(`the knowledge base is set up but does not read${said.length === 0 ? '' : ` (${said.join('; ')})`}, so the records indexed are not checked — knowledge status says why`);
  }
  return false;
});

/** The unit's records the store does not hold as they stand: read once a call. @param {Reading} at @returns {string[]} */
const unindexed = (at) => once(at, 'records', () => unindexedRecords(stateRoot(at.cwd), at.unit));

/** Every record of the unit's indexed as it stands. @param {Reading} at */
const recordsIndexed = (at) => unindexed(at).length === 0;

/** The records not indexed, with the way on. @param {Reading} at */
function recordsWay(at) {
  const files = unindexed(at);
  return `the knowledge base does not hold ${files.join(', ')} as ${files.length === 1 ? 'it stands' : 'they stand'} — knowledge index --work-unit ${at.unit}`;
}

module.exports = {
  hasReviewPhase, reviewPassed, reviewWay, questionsAnswered, questionsWay, knowledgeSetUp, recordsIndexed, recordsWay,
};
