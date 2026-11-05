'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a unit stands on the board — the one derivation the
// unit's tab, the epic's page, All work's row and count and WAITING ON YOU
// read, from the records each phase's banner reads, so no view knows less
// of a unit than another.
//
// - Its phases run from discovery through its type's pipeline (20.15.2),
//   each complete, under way, or later, by the phase's status
//   (derivations.cjs); an epic's discovery runs until its map is first
//   approved, each phase after it later until then. A phase complete
//   carries the day it closed, as its records keep it: a linear unit's
//   discovery the day the unit was made, an epic's the map last approved
//   (state-history.cjs), the discussion its last topic decided, the
//   specification ready to build's yes, the build its last phase closed,
//   the review the unit completed.
// - Where it has come to (`now`): the furthest phase under way, else the
//   first not complete — an epic past its discovery by its stages, the
//   specification once every topic is decided, the build once begun, the
//   review once the build has finished — or complete, since the day the
//   phase before it closed.
// - How the phase it is in stands: stopped where nothing of its build, the
//   review's fix tasks among it, can go on without an answer
//   (board-build.cjs); waiting on the person where something asked in the
//   conversation waits — the map, a gap, ready to build's yes, finish; else
//   under way.
// - What waits on the person, in order: approve the map while a map is
//   staged; the spec's gaps (spec-passes.cjs) and then ready to build's yes,
//   while it is written and the build not begun; the questions its build
//   and the review's fix tasks wait on (questions.cjs); and finish, once a
//   round ended the review and its fix tasks and builders' notes are done
//   (D18) — the unit's tracker read for that alone, once a round ended it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { stagedOrNone, liveInOrder } = require('../approve-map.cjs');
const { pastItsSpec } = require('../spec-standing.cjs');
const { specPath } = require('../spec-sections.cjs');
const { waitingGaps } = require('../spec-passes.cjs');
const { waitingAndFreed } = require('../questions.cjs');
const { recordedRounds, endsReview } = require('../review-phase.cjs');
const { mapApproved } = require('../state-history.cjs');
const { dayBefore } = require('../dates.cjs');
const { phaseStatus, buildPlaceStatus, buildBegun, buildFinished } = require('../derivations.cjs');
const { counted } = require('./map.cjs');
const { buildView, reviewStandingAt } = require('./board-build.cjs');
const { readyWaits } = require('./board-spec.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').UnitNow} UnitNow */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {'complete'|'running'|'later'} Status */
/** A phase of a unit, by its tab's name and the phase whose status it reads, where it stands and the day it closed. @typedef {{phase: string, reads: string, status: Status, on: string|null}} PhaseAt */
/** How the phase a unit is in stands (the header's). @typedef {'running'|'stopped'|'waits'|'complete'} PhaseStanding */

/** Each type's phases after discovery, as its tab names them, each with the phase whose status it reads. @type {Readonly<Record<string, [string, string][]>>} */
const LINEAR_PHASES = Object.freeze({
  epic: [['discussion', 'discussion'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  feature: [['discussion', 'discussion'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  bugfix: [['investigation', 'investigation'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  'quick-fix': [['implementation', 'implementation']],
  'cross-cutting': [['discussion', 'discussion'], ['specification', 'specification']],
});

/** The day the unit started, null where its manifest holds none. @param {BoardAt} at */
const startedOf = ({ manifest }) => (typeof manifest.created === 'string' ? manifest.created : null);

/** The latest of the days given, null where none is one. @param {unknown[]} days @returns {string|null} */
const latest = (days) => /** @type {string[]} */ (days.filter((day) => typeof day === 'string')).sort().at(-1) ?? null;

/** When the unit's map was last approved, read once a call. @param {BoardAt} at @returns {string|null} */
const approvedAt = (at) => at.once('map-approved', () => mapApproved(at.cwd, at.unit, dayBefore(at.manifest.created)));

/** The day each phase closed, by the phase it reads (the header's). @type {Readonly<Record<string, (at: BoardAt) => string|null>>} */
const CLOSED = Object.freeze({
  discovery: (at) => (at.manifest.work_type === 'epic' ? approvedAt(at) : startedOf(at)),
  discussion: ({ manifest }) => latest(Object.values(manifest.checklists?.decided ?? {}).map((record) => record?.closed)),
  specification: ({ manifest }) => latest([manifest.checklists?.['ready-to-build']?.closed]),
  implementation: ({ manifest }) => latest(Object.entries(manifest.checklists ?? {}).filter(([key]) => /^phase-\d+-close$/.test(key)).map(([, record]) => record?.closed)),
  review: ({ manifest }) => latest([manifest.completed_at]),
});

/** The day a phase closed, by the phase it reads, null where its records keep none. @param {BoardAt} at @param {string} reads */
const closedOn = (at, reads) => /** @type {Record<string, (at: BoardAt) => string|null>} */ (CLOSED)[reads]?.(at) ?? null;

/** Whether an epic has a topic yet: its map approved at least once. @param {Record<string, any>} manifest */
const hasTopics = (manifest) => Object.keys(manifest.phases?.discovery?.items ?? {}).length > 0;

/** Where a phase stands, by the status of the phase it reads. @param {BoardAt} at @param {string} reads @returns {Status} */
function statusOf(at, reads) {
  if (reads === 'discovery') return 'complete';
  const status = reads === 'review' ? buildPlaceStatus(at.manifest, reads) : phaseStatus(at.manifest, reads, pastItsSpec(at.cwd, at.manifest));
  if (status === 'completed') return 'complete';
  return status === 'in-progress' ? 'running' : 'later';
}

/** The unit's phases from discovery (the header's), read once a call. @param {BoardAt} at @returns {PhaseAt[]} */
const phasesAt = (at) => at.once('phases', () => {
  const after = LINEAR_PHASES[at.manifest.work_type] ?? [];
  const shaping = at.manifest.work_type === 'epic' && !hasTopics(at.manifest);
  /** @param {string} phase @param {string} reads @returns {PhaseAt} */
  const of = (phase, reads) => {
    const status = shaping ? (reads === 'discovery' ? 'running' : 'later') : statusOf(at, reads);
    return { phase, reads, status, on: status === 'complete' ? closedOn(at, reads) : null };
  };
  return [of('discovery', 'discovery'), ...after.map(([phase, reads]) => of(phase, reads))];
});

/** Where an epic past its discovery has come to, by its stages (the header's). @param {BoardAt} at @returns {UnitNow} */
function epicNow(at) {
  const { manifest } = at;
  if (manifest.status === 'completed') return { phase: 'complete', since: closedOn(at, 'review') };
  if (buildFinished(manifest)) return { phase: 'review', since: closedOn(at, 'implementation') };
  if (buildBegun(manifest)) return { phase: 'build', since: closedOn(at, 'specification') };
  if (pastItsSpec(at.cwd, manifest)) return { phase: 'specification', since: closedOn(at, 'discussion') };
  return { phase: 'discussion', since: closedOn(at, 'discovery') };
}

/** Where any other unit has come to: complete, else the furthest phase under way — the first not complete where none is — since the one before it closed. @param {BoardAt} at @returns {UnitNow} */
function linearNow(at) {
  const phases = phasesAt(at);
  const running = phases.map(({ status }) => status).lastIndexOf('running');
  const now = running === -1 ? phases.findIndex(({ status }) => status !== 'complete') : running;
  if (at.manifest.status === 'completed' || now === -1) return { phase: 'complete', since: closedOn(at, 'review') };
  return { phase: phases[now].phase, since: phases[now - 1]?.on ?? null };
}

/** Where the unit has come to (the header's). @param {BoardAt} at @returns {UnitNow} */
const nowOf = (at) => at.once('now', () => (at.manifest.work_type === 'epic' && hasTopics(at.manifest) ? epicNow(at) : linearNow(at)));

/** Approve the map, while a map is staged: its topics and what it parks on the roadmap. @param {BoardAt} at @returns {WaitingLine[]} */
function mapWaits(at) {
  const staged = at.manifest.work_type === 'epic' ? stagedOrNone(at.cwd, at.unit) : null;
  if (staged === null) return [];
  const parks = staged.parks?.length ?? 0;
  return [{ kind: 'map', id: 'approve-the-map', text: `${counted(staged.topics.length, 'topic')} in this order${parks === 0 ? '' : `, and ${parks} to the roadmap`}` }];
}

/** The spec's gaps and then ready to build's yes, while it is written and the build not begun. @param {BoardAt} at @returns {WaitingLine[]} */
function specWaits(at) {
  if (buildBegun(at.manifest) || !fs.existsSync(specPath(at.cwd, at.unit))) return [];
  return [
    ...waitingGaps(at.cwd, at.unit, at.warnings).map(({ short, text }) => ({ kind: /** @type {const} */ ('gap'), id: short, text })),
    ...(readyWaits(at.cwd, at.unit, at.warnings) ? [{ kind: /** @type {const} */ ('ready'), id: 'ready-to-build', text: '' }] : []),
  ];
}

/** The questions its build and the review's fix tasks wait on, oldest first. @param {BoardAt} at @returns {WaitingLine[]} */
function questionWaits(at) {
  if (!buildBegun(at.manifest)) return [];
  return waitingAndFreed(at.cwd, at.unit, at.warnings).waiting.map(({ question, asks }) => ({ kind: /** @type {const} */ ('question'), id: question, text: asks }));
}

/** Finish, once the review is over: a round ended it, and its fix tasks and builders' notes are done (D18). @param {BoardAt} at @returns {boolean} */
function finishWaits(at) {
  if (at.manifest.status === 'completed' || !buildFinished(at.manifest)) return false;
  const last = recordedRounds(at.cwd, at.unit).at(-1);
  return last !== undefined && endsReview(last) && reviewStandingAt(at).over;
}

/** What waits on the person in the unit (the header's), read once a call. @param {BoardAt} at @returns {WaitingLine[]} */
const waitingOn = (at) => at.once('waiting-on', () => [
  ...mapWaits(at),
  ...specWaits(at),
  ...questionWaits(at),
  ...(finishWaits(at) ? [{ kind: /** @type {const} */ ('finish'), id: 'finish', text: '' }] : []),
]);

/** What waits on the person that is asked in the conversation, holding the phase: all but a build's questions. @param {WaitingLine} line */
const holds = ({ kind }) => kind !== 'question';

/** How the phase the unit is in stands (the header's). @param {BoardAt} at @returns {PhaseStanding} */
function standingOf(at) {
  const { phase } = nowOf(at);
  if (phase === 'complete') return 'complete';
  if (waitingOn(at).some(holds)) return 'waits';
  return buildBegun(at.manifest) && buildView(at).view.progress.stopped ? 'stopped' : 'running';
}

module.exports = { phasesAt, nowOf, waitingOn, standingOf, closedOn, startedOf, hasTopics };
