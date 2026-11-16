'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's verbs (§14) — `review round` and `review
// notes` (review-round.cjs), and here:
// - `review ask <unit>`: a quick-fix's review asked for at its close, its
//   row there (19.5.13) — the request recorded on its manifest,
//   `fixes.review_asked`, the instant it was asked, and committed, so its
//   review phase can be entered (derivations.cjs) and its finish's
//   checklist carries the review passed (finish-checks.cjs); it answers
//   `next`, the review phase's skill invoked in the same conversation,
//   which enters it (19.5.14, 24.1.3). Asked again, it answers `already` with the same `next`,
//   writing nothing. It refuses, writing nothing: a unit that is no
//   quick-fix built by its own arm, and one whose close does not stand,
//   as its screen refuses it (finish.cjs) — the row being the close's.
// - `review reads <unit> <area|tests> …`: the areas a later round reads, as
//   Claude names them once the round before's fix tasks are done, from what
//   they changed (14.3.3) — written at `review/round-{N}-reads.json` in the
//   spec's order, the test surface last, and committed, before the round's
//   briefs are filled; the round opening there, its snapshot of the working
//   tree is taken where none is held (review-phase.cjs), so naming more
//   reads keeps the one held. It refuses, writing nothing: a unit whose review
//   phase cannot be entered; no round under review (review-phase.cjs,
//   `openRefusal`); round 1, which reads every area; a name that is no area
//   of the spec and not `tests`; a set leaving out an area whose findings
//   made fix tasks in the round before, or one named for the round before —
//   areas are added, never dropped.
// - `review accept-tree <unit>`: the working tree taken as it is, on the
//   person's word, the round's snapshot taken again over any held (12.7.8,
//   14.S13); nothing else written. It refuses a unit whose review phase
//   cannot be entered, and one with no round under review.
// - `review restore-tree <unit> --listed <print>`: the tree put back as the
//   round's snapshot found it, at the person's word on the gate over it
//   (review-tree.cjs).
// Each runs under the writer lock (engine.cjs).
// ---------------------------------------------------------------------------

const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { withWorkUnitLock, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { quickFixBuild, reviewAsked } = require('./derivations.cjs');
const { isoNow } = require('./dates.cjs');
const { finishStanding } = require('./finish.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { refusing } = require('./staged-payload.cjs');
const { refuserFor, committed } = require('./task-account.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { reviewHeld } = require('./review-entry.cjs');
const { reading, reposOf } = require('./phase-checks.cjs');
const { recordRound, answerNotes } = require('./review-round.cjs');
const { restoreTree } = require('./review-tree.cjs');
const {
  TESTS, openRefusal, everyRead, readsWords, roundReadsPath, takeSnapshot, openSnapshot,
} = require('./review-phase.cjs');

const REVIEW_USAGE = [
  'review ask <work-unit>',
  'review round <work-unit> --file <round.json>',
  'review notes <work-unit> --file <notes.json>',
  'review reads <work-unit> <area|tests> [<area|tests> …]',
  'review accept-tree <work-unit>',
  'review restore-tree <work-unit> --listed <print>',
].join('\n');

/**
 * The unit's review phase with a round under review, and the project's
 * repos, refused where it cannot be entered or none is.
 * @param {string} cwd @param {string} unit @param {string} said
 */
function roundOpen(cwd, unit, said) {
  const at = reading(cwd, unit, refusing(said, () => unitInProgress(cwd, unit)));
  return { refuse: refuserFor(said), standing: refusing(said, () => reviewHeld(at, openRefusal)), repos: reposOf(at) };
}

/**
 * `review reads`: the areas the round under review reads, as Claude named
 * them (the header's).
 * @param {string} cwd @param {string} unit @param {string[]} named
 */
function nameReads(cwd, unit, named) {
  const { refuse, standing, repos } = roundOpen(cwd, unit, 'review reads');
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
  openSnapshot(cwd, unit, round, repos);
  return committed(cwd, [rel], `review(${unit}): round ${round} reads ${reads.join(', ')}`, [], { round, reads });
}

/** `review accept-tree`: the tree taken as it is, its snapshot taken again (the header's). @param {string} cwd @param {string} unit */
function acceptTree(cwd, unit) {
  const { standing, repos } = roundOpen(cwd, unit, 'review accept-tree');
  takeSnapshot(cwd, unit, standing.round, repos);
  return { round: standing.round, snapshot: 'taken' };
}

/**
 * `review ask`: a quick-fix's review asked for at its close, recorded, and
 * its review phase's skill next, in place (the header's).
 * @param {string} cwd @param {string} unit
 */
function askReview(cwd, unit) {
  const said = 'review ask';
  const next = { kind: 'invoke', skill: phaseSkill('review', 'quick-fix'), args: ['quick-fix', unit] };
  return refusing(said, () => withWorkUnitLock(cwd, unit, () => {
    const manifest = unitInProgress(cwd, unit);
    if (!quickFixBuild(manifest)) throw new Error(`${unit} is no quick-fix built as one — a review is asked for at a quick-fix's close; any other unit's review phase follows its build`);
    if (reviewAsked(manifest)) return { unit, review_asked: manifest.fixes.review_asked, already: true, next };
    const { warnings } = finishStanding(cwd, unit);
    const asked = isoNow();
    manifest.fixes = { ...manifest.fixes, review_asked: asked };
    saveWorkUnitManifest(cwd, unit, manifest);
    return committed(cwd, [`${unit}/manifest.json`], `review(${unit}): asked for at its close`, [...warnings], { unit, review_asked: asked, next });
  }));
}

/**
 * `review <verb>`, its words and flags as the engine parsed them.
 * @param {string} cwd @param {string[]} argv @param {Record<string, string>} opts
 */
function runReviewVerb(cwd, argv, opts) {
  const [verb, unit, ...rest] = argv;
  const named = Object.keys(opts).sort().join();
  if (unit !== undefined) {
    if (verb === 'ask' && rest.length === 0 && named === '') return askReview(cwd, unit);
    if (verb === 'round' && rest.length === 0 && named === 'file' && opts.file) return recordRound(cwd, unit, opts.file);
    if (verb === 'notes' && rest.length === 0 && named === 'file' && opts.file) return answerNotes(cwd, unit, opts.file);
    if (verb === 'reads' && rest.length > 0 && named === '') return nameReads(cwd, unit, rest);
    if (verb === 'accept-tree' && rest.length === 0 && named === '') return acceptTree(cwd, unit);
    if (verb === 'restore-tree' && rest.length === 0 && named === 'listed' && opts.listed) return restoreTree(cwd, unit, opts.listed);
  }
  throw new Error(`Usage: ${REVIEW_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

module.exports = { REVIEW_USAGE, runReviewVerb };
