'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's row of the entry (enter.cjs) — `enter
// review <unit>`, at the work unit, as the build's is (build-entry.cjs),
// taking a unit whose build runs by its cut.
//
// It refuses what the build's entry refuses — a quick-fix, a unit built
// under the old plan, a build not begun — and a build not finished: the
// review phase starts once every phase of the cut has closed
// (`buildFinished`, 14.6.1), and the refusal names each phase not closed.
// Another session holding the checkout's code stops it at the build's code
// gate, nothing written, and `--take` enters all the same (12.7.8, 12.S50).
//
// As the conversation arrives, the working tree outside `.leeway/` is
// snapshotted (review-phase.cjs), what `review round` holds the tree to
// (14.1.5). Each entry takes it afresh: dirt a round named and the person
// settled is taken as the tree stands by entering again.
//
// It answers, in its DATA: the round under review, or that the review
// phase is over, finish next; the spec's areas, each by its name in the
// layout and its title; the areas the round reads, and the test surface;
// each fix task of the round before not yet done, which the round waits on
// (14.3.3); each earlier round's report; the spec; the unit's record, by
// its call; and the build's log.
// ---------------------------------------------------------------------------

const { ENGINE_COMMAND } = require('../kernel/call.cjs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { buildByCut, buildFinished, phaseClosed } = require('./derivations.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { trackedLists } = require('./task-verbs.cjs');
const { cutPhases } = require('./phase-checks.cjs');
const { buildRefusal, codeHeld, buildLogOf } = require('./build-entry.cjs');
const { specPath } = require('./spec-sections.cjs');
const { shownTask } = require('./task-id.cjs');
const {
  TESTS, reviewStanding, fixesOf, fixPhase, roundReportFile, takeSnapshot,
} = require('./review-phase.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./topic-standing.cjs').Standing} Standing */

/** A task's status, as a line says it. @type {Readonly<Record<string, string>>} */
const STATUS_WORDS = Object.freeze({ open: 'not started', 'in-progress': 'in progress', closed: 'closed' });

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
 * The fix tasks of the last round not yet done, each with where it stands:
 * the round under review waits on them (14.3.3).
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {import('./review-phase.cjs').RoundRecord[]} rounds
 * @returns {string[]}
 */
function fixesWaiting(cwd, unit, manifest, rounds) {
  const last = rounds.at(-1);
  if (last === undefined) return [];
  const [rows] = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, [fixPhase(manifest, rounds.length)])).phases;
  const statuses = new Map((rows ?? []).map(({ ref, status }) => [shownTask(ref), status]));
  return fixesOf(last).filter((fix) => statuses.get(fix) !== 'done').map((fix) => `${fix} ${STATUS_WORDS[statuses.get(fix) ?? ''] ?? 'not in the tracker'}`);
}

/** Why a round cannot be read yet: its fix tasks of the round before not done, as `fixesWaiting` says them. @param {number} round @param {string[]} waiting */
const fixesWaitingWords = (round, waiting) => `round ${round} reads the areas round ${round - 1}'s fix tasks changed once every one is done — task ${waiting.join(', task ')}`;

/** What the review phase reads at its entry (the header's). @param {Entering} at @returns {Line[]} */
function reviewReads({ cwd, unit, manifest }) {
  const { areas, rounds, over, round, reads } = reviewStanding(cwd, unit);
  const names = new Map(areas.map(({ name, number, title }) => [name, `§${number} ${title}`]));
  return [
    ['round', over ? `the review phase passed in round ${round} — finish is next` : `round ${round}`],
    ...areas.map(({ name }) => /** @type {Line} */ (['area', `${name} — ${names.get(name)}`])),
    ...(over ? [] : [/** @type {Line} */ (['reads', [...reads, `the test surface (${TESTS})`].join(', ')])]),
    ...(over ? [] : fixesWaiting(cwd, unit, manifest, rounds).map((fix) => /** @type {Line} */ (['fix task waiting', fix]))),
    ...rounds.map((_, at) => /** @type {Line} */ (['round report', statePath(cwd, roundReportFile(unit, at + 1))])),
    ['spec', specPath(cwd, unit)],
    ['record', `\`${ENGINE_COMMAND} ledger record ${unit}\``],
    ['build log', statePath(cwd, buildLogOf(unit))],
  ];
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
  reads: reviewReads,
  closes: ({ cwd, unit }) => { takeSnapshot(cwd, unit); },
});

module.exports = { REVIEW, reviewRefusal, fixesWaiting, fixesWaitingWords };
