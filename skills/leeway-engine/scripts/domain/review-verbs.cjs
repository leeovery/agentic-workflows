'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's verbs (§14) — `review round` (review-
// round.cjs), and here:
// - `review reads <unit> <area|tests> …`: the areas a later round reads, as
//   Claude names them once the round before's fix tasks are done, from what
//   they changed (14.3.3) — written at `review/round-{N}-reads.json` in the
//   spec's order, the test surface last, and committed, before the round's
//   briefs are filled. It refuses, writing nothing: a unit whose review
//   phase cannot be entered; no round under review (review-phase.cjs,
//   `openRefusal`); round 1, which reads every area; a name that is no area
//   of the spec and not `tests`; a set leaving out an area whose findings
//   made fix tasks in the round before, or one named for the round before —
//   areas are added, never dropped.
// - `review accept-tree <unit>`: the working tree taken as it is, on the
//   person's word, its snapshot taken again over the one held (12.7.8,
//   14.S13); nothing else written. It refuses a unit whose review phase
//   cannot be entered, and one with no round under review.
// Both run under the writer lock (engine.cjs).
// ---------------------------------------------------------------------------

const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { refusing } = require('./staged-payload.cjs');
const { refuserFor, committed } = require('./task-account.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { reviewHeld } = require('./review-entry.cjs');
const { recordRound } = require('./review-round.cjs');
const {
  TESTS, openRefusal, everyRead, readsWords, roundReadsPath, takeSnapshot,
} = require('./review-phase.cjs');

const REVIEW_USAGE = [
  'review round <work-unit> --file <round.json>',
  'review reads <work-unit> <area|tests> [<area|tests> …]',
  'review accept-tree <work-unit>',
].join('\n');

/**
 * The unit's review phase with a round under review, refused where it
 * cannot be entered or none is.
 * @param {string} cwd @param {string} unit @param {string} said
 */
function roundOpen(cwd, unit, said) {
  const manifest = refusing(said, () => unitInProgress(cwd, unit));
  return { refuse: refuserFor(said), standing: refusing(said, () => reviewHeld(cwd, unit, manifest, openRefusal)) };
}

/**
 * `review reads`: the areas the round under review reads, as Claude named
 * them (the header's).
 * @param {string} cwd @param {string} unit @param {string[]} named
 */
function nameReads(cwd, unit, named) {
  const { refuse, standing } = roundOpen(cwd, unit, 'review reads');
  const { areas, round, required, reads: before } = standing;
  if (round === 1) refuse(`round 1 reads every area and the test surface (${TESTS}) — a later round's are named`);
  const known = everyRead(areas);
  const unknown = named.filter((name) => !known.includes(name));
  if (unknown.length > 0) refuse(`${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} no area of ${unit}'s spec — name its areas by ${known.join(', ')}`);
  const dropped = required.filter((name) => !named.includes(name));
  if (dropped.length > 0) refuse(`round ${round} reads every area whose findings made fix tasks in round ${round - 1}, and leaves out ${readsWords(dropped)}`);
  const unnamed = (before ?? []).filter((name) => !named.includes(name));
  if (unnamed.length > 0) refuse(`round ${round} already reads ${readsWords(unnamed)} — areas are added, never dropped`);
  const reads = known.filter((name) => named.includes(name));
  const rel = roundReadsPath(unit, round);
  writeJsonAtomic(statePath(cwd, rel), { reads });
  return committed(cwd, [rel], `review(${unit}): round ${round} reads ${reads.join(', ')}`, [], { round, reads });
}

/** `review accept-tree`: the tree taken as it is, its snapshot taken again (the header's). @param {string} cwd @param {string} unit */
function acceptTree(cwd, unit) {
  const { standing } = roundOpen(cwd, unit, 'review accept-tree');
  takeSnapshot(cwd, unit);
  return { round: standing.round, snapshot: 'taken' };
}

/**
 * `review <verb>`, its words and flags as the engine parsed them.
 * @param {string} cwd @param {string[]} argv @param {Record<string, string>} opts
 */
function runReviewVerb(cwd, argv, opts) {
  const [verb, unit, ...rest] = argv;
  const named = Object.keys(opts).sort().join();
  if (unit !== undefined) {
    if (verb === 'round' && rest.length === 0 && named === 'file' && opts.file) return recordRound(cwd, unit, opts.file);
    if (verb === 'reads' && rest.length > 0 && named === '') return nameReads(cwd, unit, rest);
    if (verb === 'accept-tree' && rest.length === 0 && named === '') return acceptTree(cwd, unit);
  }
  throw new Error(`Usage: ${REVIEW_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

module.exports = { REVIEW_USAGE, runReviewVerb };
