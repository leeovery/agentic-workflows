'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's row of the entry (enter.cjs) — `enter
// review <unit>`, at the work unit, as the build's is (build-entry.cjs),
// taking a unit whose build runs by its cut — and its recovery note
// (position.cjs), which re-reads what the entry reads (24.2.2).
//
// It refuses what the build's entry refuses — a quick-fix, a unit built
// under the old plan, a build not begun — and a build not finished: the
// review phase starts once every phase of the cut has closed
// (`buildFinished`, 14.6.1), and the refusal names each phase not closed.
// Another session holding the checkout's code stops it at the build's code
// gate, nothing written, and `--take` enters all the same (12.7.8, 12.S50).
//
// As the conversation arrives, every task the tracker holds in progress in
// a phase the build has written — a fix task, the review's fix phases built
// in the same loop (14.3.2) — is put in flight on its position, at the
// review phase, as the build's entry takes them over (build-entry.cjs,
// `takeInFlight`); and at round 1, the working tree outside `.leeway/` is
// snapshotted for it (review-phase.cjs) where no snapshot is held — what
// `review round` holds the tree to (14.1.5); a later round's is taken as
// `review reads` opens it. Entering again never takes one, so dirt met
// before a `/clear` still stops for the person.
//
// It answers, in its DATA: the round under review, or how the round that
// ended the phase did, and what is next; the spec's areas, each by its name
// in the layout and its title; the areas the round reads, the test surface
// among them, or that a later round's are not yet named, with those it must
// take (14.3.3); each fix task of the last round not yet done, and in step
// its fix phase waiting at its merge's gate once they are (14.6.2); each
// of the conversation's fix tasks in flight, as the build's entry gives it;
// each round's report; the spec; the unit's record, by its call; and the
// build's log. Its recovery note re-reads the same, the fix tasks in
// flight those of the conversation the note is for.
// ---------------------------------------------------------------------------

const { ENGINE_COMMAND, messageOf } = require('../kernel/call.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { buildByCut, buildFinished, phaseClosed } = require('./derivations.cjs');
const { cutPhases } = require('./phase-checks.cjs');
const {
  buildRefusal, codeHeld, buildLogOf, buildStanding, ownInFlight, inFlightLines, takeInFlight,
} = require('./build-entry.cjs');
const { specPath } = require('./spec-sections.cjs');
const {
  reviewStanding, endedWords, readsWords, mergingWords, roundReportFile, openSnapshot,
} = require('./review-phase.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./review-phase.cjs').ReviewStanding} ReviewStanding */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */

/**
 * Why the unit's review phase cannot be entered, with its way on, or null
 * where it can: the build's refusals, then a build not finished.
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function reviewRefusal(manifest) {
  const refused = buildRefusal(manifest);
  if (refused !== null || buildFinished(manifest)) return refused;
  const open = cutPhases(manifest).map((_, at) => at + 1).filter((phase) => !phaseClosed(manifest, phase));
  return `${manifest.name}'s review phase starts once every phase of its cut has closed — phase${open.length === 1 ? '' : 's'} ${open.join(', ')} of ${cutPhases(manifest).length} ${open.length === 1 ? 'has' : 'have'} not: enter implementation ${manifest.name}`;
}

/**
 * Where the unit's review phase stands, refused where it cannot be entered,
 * or where `held` — `openRefusal` or `roundRefusal` (review-phase.cjs) —
 * says why the step asked for cannot be taken yet.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 * @param {(unit: string, standing: ReviewStanding) => string|null} held
 * @returns {ReviewStanding}
 */
function reviewHeld(cwd, unit, manifest, held) {
  const refused = reviewRefusal(manifest);
  if (refused !== null) throw new Error(refused);
  const standing = reviewStanding(cwd, unit, manifest);
  const not = held(unit, standing);
  if (not !== null) throw new Error(not);
  return standing;
}

/** The round line: the round under review, or how the round that ended the phase did and what is next. @param {string} unit @param {ReviewStanding} standing */
function roundWords(unit, standing) {
  if (!standing.ended) return `round ${standing.round}`;
  return `${endedWords(unit, standing).replace(`${unit}'s`, 'the')} — ${standing.over ? 'finish is next' : 'its fix tasks are built, then finish'}`;
}

/** The reads line, while a round waits to be read — in step, on its fix phase's merge too. @param {string} unit @param {ReviewStanding} standing @param {boolean} step */
function readsLine(unit, { round, required, reads }, step) {
  if (reads !== null) return readsWords(reads);
  const once = `round ${round - 1}'s fix tasks are done${step ? ' and their phase has merged' : ''}`;
  return `not yet named — once ${once}, review reads ${unit} names them from what those changed, among them ${readsWords(required)}`;
}

/** Where the review phase stands, a line each: the round, the areas, the reads, the fix tasks waiting and, in step, their phase's merge. @param {string} unit @param {ReviewStanding} standing @param {boolean} step @returns {Line[]} */
function standingLines(unit, standing, step) {
  return [
    ['round', roundWords(unit, standing)],
    ...standing.areas.map(({ name, number, title }) => /** @type {Line} */ (['area', `${name} — §${number} ${title}`])),
    ...(standing.ended ? [] : [/** @type {Line} */ (['reads', readsLine(unit, standing, step)])]),
    ...standing.waiting.map((fix) => /** @type {Line} */ (['fix task waiting', fix])),
    ...(standing.merging === null ? [] : [/** @type {Line} */ (['merge waiting', mergingWords(unit, standing.merging)])]),
  ];
}

/** The conversation's fix tasks in flight, a line each, as the build's entry gives them; none where it has none. @param {string} cwd @param {string} unit @param {InFlight[]} inFlight @returns {Line[]} */
const fixesInFlight = (cwd, unit, inFlight) => (inFlight.length === 0 ? [] : inFlightLines(buildStanding(cwd, unit, inFlight)));

/** Each round's report recorded, by its path. @param {string} cwd @param {string} unit @param {ReviewStanding} standing */
const roundReports = (cwd, unit, { rounds }) => rounds.map((_, at) => statePath(cwd, roundReportFile(unit, at + 1)));

/** The record's call. @param {string} unit */
const recordCall = (unit) => `${ENGINE_COMMAND} ledger record ${unit}`;

/** What the review phase reads at its entry (the header's). @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {InFlight[]} inFlight @returns {Line[]} */
function reviewReads(cwd, unit, manifest, inFlight) {
  const standing = reviewStanding(cwd, unit, manifest);
  return [
    ...standingLines(unit, standing, manifest.build.position === 'step'),
    ...fixesInFlight(cwd, unit, inFlight),
    ...roundReports(cwd, unit, standing).map((report) => /** @type {Line} */ (['round report', report])),
    ['spec', specPath(cwd, unit)],
    ['record', `\`${recordCall(unit)}\``],
    ['build log', statePath(cwd, buildLogOf(unit))],
  ];
}

/** The entry's reads the recovery note re-reads as documents; the record it re-reads by its call. */
const DOCUMENTS = new Set(['round report', 'spec', 'build log']);

/**
 * What the review phase's recovery note re-reads beside its skill: what the
 * entry reads — the record by its call; each round's report, the spec and
 * the build's log; where the phase stands, a line each, its fix tasks in
 * flight those of the conversation the note is for — or why that cannot be
 * read, in its place.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {InFlight[]} inFlight
 * @returns {{calls: string[], documents: string[], lines: string[]}}
 */
function reviewRecovery(cwd, unit, manifest, inFlight) {
  const calls = [recordCall(unit)];
  try {
    const read = reviewReads(cwd, unit, manifest, inFlight);
    return {
      calls,
      documents: read.filter(([key]) => DOCUMENTS.has(key)).map(([, value]) => value),
      lines: read.filter(([key]) => key !== 'record' && !DOCUMENTS.has(key)).map(([key, value]) => `${key}: ${value}`),
    };
  } catch (err) {
    return { calls, documents: [specPath(cwd, unit), statePath(cwd, buildLogOf(unit))], lines: [`Where the review phase stands could not be read: ${messageOf(err)}`] };
  }
}

/** The tasks in progress taken over, and round 1's snapshot taken as it opens, where none is held (the header's). @param {Entering} at */
function arriving(at) {
  takeInFlight(at);
  if (reviewStanding(at.cwd, at.unit, at.manifest).rounds.length === 0) openSnapshot(at.cwd, at.unit, 1);
}

/** @type {Entry} */
const REVIEW = Object.freeze({
  level: /** @type {const} */ ('unit'),
  takes: buildByCut,
  standing: ({ manifest }) => reviewRefusal(manifest),
  held: codeHeld,
  unstarted: () => false,
  start: () => {},
  questions: () => [],
  reads: ({ cwd, unit, manifest }) => reviewReads(cwd, unit, manifest, ownInFlight(unit)),
  closes: arriving,
});

module.exports = { REVIEW, reviewRefusal, reviewHeld, reviewRecovery };
