'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the engine checks of a unit's finish (6.4.10) — the
// engine's items of finish's checklist (checklist.cjs), worked out at each
// call and never kept (6.4.3). The build's log closed stays Claude's mark.
//
// - The review phase passed and its report written: where the unit has a
//   review phase — every type the build takes, and a quick-fix only once
//   the person asked for its review at its close (`reviewAsked`,
//   derivations.cjs; 19.5.13, 19.5.14) — the review phase over, as
//   its rounds' records say (review-phase.cjs): a round passed or settled,
//   its report written by `review round` as it recorded it, and every task
//   of that round's fix phase done or closed, its findings' fixes and any
//   written there beyond them. Its way on is the entry's
//   refusal where the review cannot be entered yet, else what the review
//   waits on.
// - No question waiting on the person: the unit's questions waiting, as
//   `raise waiting` reads them (questions.cjs) — the build never concludes
//   over one (12.13.22), wherever it was raised, the review phase's among
//   them — and a quick-fix's questions asked in its conversation still open
//   (`askedOpen`), which park nothing (19.5.25). Its way on names each, and
//   the build's stop that puts them to the person (build-screens.cjs), or
//   the raise that asks each again.
// - A quick-fix's notes for later answered, where no review was asked for:
//   none standing (review-phase.cjs, `notesStanding`), each filed or
//   dropped at the close (`quick-fix notes`, R24); its way on names each.
//   With a review asked for, the review answers them, and its item holds.
// - The resolved inbox items closed (E9): no item a `Resolved: {path}` line
//   of the build's log claims is left live in the inbox — each closed
//   through `inbox close`, or archived in triage meanwhile. A mention
//   elsewhere in the log is no claim. A unit whose log claims none owes
//   nothing. Its way on names each, the close, and the claim taken out
//   where the work did not resolve the item after all.
// - The records indexed: where this checkout's knowledge base is set up —
//   setting it up is the person's choice (knowledge/sync.cjs) — every
//   record of the unit's (22.6.2), a quick-fix's short record among them
//   (22.6.9), held by the store as it stands now (knowledge/status.cjs);
//   its way on is the unit's index. A base set up
//   that does not read takes the item off, said as a warning.
//
// A call reads each once for all its items (phase-checks.cjs, `once`),
// and finish's refusals read through the same (`reviewOverRefusal`,
// `stillOpen`, `notesLeft`; finish.cjs).
//
// Finish waits on the review phase over where the unit has one — a phase
// of the cut not closed, in step one not merged, a fix task neither done
// nor closed, a quick-fix's review asked for not passed — refused before
// its close is read, so its screen and its landing say so
// (`reviewOverRefusal`, finish.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { once } = require('./phase-checks.cjs');
const { reviewAsked, quickFixBuild } = require('./derivations.cjs');
const { reviewRefusal } = require('./review-entry.cjs');
const { reviewStanding, endedRefusal, notesStanding, recordedRounds } = require('./review-phase.cjs');
const { readiness, unindexedRecords } = require('./knowledge/status.cjs');
const { waitingAndFreed, askedOpen } = require('./questions.cjs');
const { liveResolved } = require('./inbox.cjs');
const { buildLogOf } = require('./build-entry.cjs');

/** @typedef {import('./phase-checks.cjs').Reading} Reading */
/** @typedef {import('./review-phase.cjs').ReviewStanding} ReviewStanding */

/** Whether the unit has a review phase: every type the build takes, and a quick-fix once the person asked for one (19.5.13, 19.5.14). @param {Reading} at */
const hasReviewPhase = ({ manifest }) => manifest.work_type !== 'quick-fix' || reviewAsked(manifest);

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

/** A quick-fix's questions asked in its conversation still open: read once a call; none for any other unit. @param {Reading} at */
const stillOpen = (at) => once(at, 'asked', () => (quickFixBuild(at.manifest) ? askedOpen(at.cwd, at.unit, at.warnings) : []));

/** No question of the unit waits on the person, nor stands open in a quick-fix's conversation. @param {Reading} at */
const questionsAnswered = (at) => waiting(at).length === 0 && stillOpen(at).length === 0;

/** The questions waiting, and those still open, each with the way on. @param {Reading} at */
function questionsWay(at) {
  const asked = waiting(at).map(({ question, asks }) => `${question}, ${asks}`).join('; ');
  const parked = asked === '' ? [] : [`${asked} — the unit never finishes over a question waiting on the person: stop for them, render build-stop ${at.unit}, and take each once they are ready to discuss it`];
  return [...parked, ...stillOpen(at).map(askedWay)].join('; ');
}

/** A question still open in a quick-fix's conversation, with the raise that asks it again. @param {import('./questions.cjs').AskedOpen} open */
const askedWay = ({ id, place, asks }) => `${id}, ${asks}, asked in the conversation and still open — raise it again for the person to answer: raise ${place} --answers ${id}`;

/** Whether a quick-fix's close answers its notes for later: no review was asked for, which answers them. @param {Reading} at */
const answersNotes = ({ manifest }) => quickFixBuild(manifest) && !reviewAsked(manifest);

/** A quick-fix's notes for later standing, each `notes#{k}`: read once a call. @param {Reading} at */
const notesLeft = (at) => once(at, 'notes', () => notesStanding(at.cwd, at.unit, recordedRounds(at.cwd, at.unit)));

/** No note for later stands unanswered. @param {Reading} at */
const notesAnswered = (at) => notesLeft(at).length === 0;

/** The notes for later standing, with the way on. @param {Reading} at */
const notesWay = (at) => `${notesLeft(at).join(', ')} — each note for later is filed to the inbox or dropped before the close: quick-fix notes ${at.unit} --file <notes.json>`;

/** The live inbox items the build's log claims resolved: read once a call. @param {Reading} at @returns {string[]} */
const claimedLive = (at) => once(at, 'inbox', () => {
  const log = statePath(at.cwd, buildLogOf(at.unit));
  return fs.existsSync(log) ? liveResolved(at.cwd, fs.readFileSync(log, 'utf8')) : [];
});

/** No item the build's log claims resolved is left live. @param {Reading} at */
const inboxClosed = (at) => claimedLive(at).length === 0;

/** The claimed items still live, with the close and the claim taken back. @param {Reading} at */
const inboxWay = (at) => `the build's log claims ${claimedLive(at).join(', ')} resolved, still in the inbox — close each the work resolved: inbox close ${at.unit} <path> …; where the work did not resolve one after all, take its Resolved: line out of the log`;

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

/**
 * Why the unit's finish waits on its review phase, with the way on (the
 * header's) — null where it has none, or it is over.
 * @param {Reading} at @returns {string|null}
 */
function reviewOverRefusal(at) {
  return hasReviewPhase(at) && !reviewPassed(at) ? `${at.unit} finishes once its review phase is over — ${reviewWay(at)}` : null;
}

module.exports = {
  reviewOverRefusal, stillOpen, notesLeft,
  hasReviewPhase, reviewPassed, reviewWay, questionsAnswered, questionsWay, answersNotes, notesAnswered, notesWay, askedWay, inboxClosed, inboxWay, knowledgeSetUp, recordsIndexed, recordsWay,
};
