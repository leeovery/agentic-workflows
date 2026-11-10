'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a unit stands on the board — the one derivation every
// view reads, the banner in every phase and at the unit's menu, the unit's
// tab, the epic's page and its stages, and All work's row and count, so no
// view knows less of a unit than another.
//
// - Its phases run from discovery through its type's pipeline (20.15.2),
//   each complete, under way, or later, by the phase's status
//   (derivations.cjs); an epic's discovery runs until its map is first
//   approved, as the yes records it (`phases.discovery.approved_at`,
//   approve-map.cjs), each phase after it later until then. A feature's
//   discussion is complete once it has closed into its spec (11.2.1). The
//   specification is under way from its entry, once the topics are settled
//   (spec-standing.cjs). A quick-fix's phases are discovery and its
//   implementation, its one session, and its review once the person asks
//   for one at its close (`fixes.review_asked`, 19.5.13): its
//   implementation under way from its fixes' beginning until then, its
//   review from then, each complete once it closes. A phase complete
//   carries the day it closed, as its records keep it: a linear unit's
//   discovery the day the unit was made, an epic's the map last approved,
//   the discussion its last topic decided, the investigation its conclude
//   (`concluded_at`, P2), the specification ready to build's yes, the
//   build its last phase closed, a quick-fix's implementation its review
//   asked for, else its close, and the review the unit completed.
// - Where it has come to (`now`): the first phase not complete — an epic
//   past its discovery by its stages, the specification once the topics are
//   settled, the build once begun, the review once the build has finished —
//   or complete, since the day the phase before it closed; a migrated unit
//   of a type the reshape retires, the migration's cut it waits on (E6).
//   The menus' rows read it too (progress.cjs), so it reads the unit alone.
// - How the phase it is in stands: stopped where nothing of its tasks can
//   go on without an answer — its build's, the review's round and fix tasks
//   among it, a quick-fix's fixes and its review's alike, by the build's
//   rule (board-build.cjs) — worked out once, which every view reads
//   (`tasksStopped`); waiting on the person where something asked in the
//   conversation and holding it waits — the map, an investigation's raise
//   or its conclude, a gap, ready to build's yes, finish or a quick-fix's
//   close; else under way.
// - What waits on the person is the unit's one list, in order, each wait
//   with its words and the page a press on it opens, where it opens one:
//   approve the map while a map is staged, the sweep's candidates among it
//   after the sweep (8.10.9); each raise its investigation asks in this
//   conversation, with what raised it, then its conclude once its screen
//   draws (board-investigation.cjs); the spec's gaps (spec-passes.cjs),
//   each opening the finding that raised it, and then ready to build's yes
//   once its screen draws (ready-to-build.cjs, `readyDraws`), while the
//   build has not begun; the questions the build and the review wait on
//   (questions.cjs), each opening the page of the first task it parks, one
//   parking none its question's entry — a replacement's, the decision it
//   would replace; a quick-fix's questions its builders parked its fixes on
//   among them, then each raise this conversation sealed at its place still
//   waiting, parking nothing (19.5.25); and finish once its screen draws
//   (finish.cjs, `finishDraws`) and no question waits (D18), a quick-fix's
//   its close. Each gate's wait is read by that gate's own check, never a
//   copy of it.
// - The banner counts that list, flagged — the map alone by its own words —
//   and at a menu says it unflagged (D40).
// ---------------------------------------------------------------------------

const { stagedOrNone, candidatesStanding } = require('../approve-map.cjs');
const { specBegun, specUnderWay } = require('../spec-standing.cjs');
const { waitingAndFreed } = require('../questions.cjs');
const {
  phaseStatus, buildPlaceStatus, buildBegun, buildFinished, retiredRefusal, closedIntoSpec, quickFixBuild, tasksBegun, fixesBegun, reviewAsked, startedOn,
} = require('../derivations.cjs');
const { counted } = require('./map.cjs');
const { finishDraws } = require('../finish.cjs');
const { buildView } = require('./board-build.cjs');
const { specWaits } = require('./board-spec.cjs');
const { investigationWaits } = require('./board-investigation.cjs');
const { raisedWaits, closeWait } = require('./board-quick-fix.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** What where a unit has come to reads of it: the project, the unit and its manifest, and one read of anything read twice. @typedef {Pick<BoardAt, 'cwd'|'unit'|'manifest'|'once'>} UnitRead */
/** @typedef {import('../board-model.cjs').UnitNow} UnitNow */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').Fact} Fact */
/** @typedef {'complete'|'running'|'later'} Status */
/** A phase of a unit, by its tab's name and the phase whose status it reads, where it stands and the day it closed. @typedef {{phase: string, reads: string, status: Status, on: string|null}} PhaseAt */
/** How the phase a unit is in stands (the header's). @typedef {'running'|'stopped'|'waits'|'complete'} PhaseStanding */

/** Each type's phases after discovery, as its tab names them, each with the phase whose status it reads: a quick-fix's review once it is asked for (`phasesAfter`). @type {Readonly<Record<string, [string, string][]>>} */
const LINEAR_PHASES = Object.freeze({
  epic: [['discussion', 'discussion'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  feature: [['discussion', 'discussion'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  bugfix: [['investigation', 'investigation'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  'quick-fix': [['implementation', 'implementation'], ['review', 'review']],
});

/** The unit's phases after discovery (the header's): a quick-fix's review only once the person asked for it. @param {Record<string, any>} manifest */
function phasesAfter(manifest) {
  const after = LINEAR_PHASES[manifest.work_type] ?? [];
  return manifest.work_type === 'quick-fix' && !reviewAsked(manifest) ? after.filter(([, reads]) => reads !== 'review') : after;
}

/** The latest of the days given, null where none is one. @param {unknown[]} days @returns {string|null} */
const latest = (days) => /** @type {string[]} */ (days.filter((day) => typeof day === 'string')).sort().at(-1) ?? null;

/** When an epic's map was last approved, null while it never was. @param {Record<string, any>} manifest @returns {string|null} */
function approvedOn(manifest) {
  const at = manifest.phases?.discovery?.approved_at;
  return typeof at === 'string' ? at : null;
}

/** Whether an epic is past its discovery: its map approved at least once. @param {Record<string, any>} manifest */
const pastDiscovery = (manifest) => manifest.work_type === 'epic' && approvedOn(manifest) !== null;

/** The day a build's last phase closed, or a quick-fix's implementation: its review asked for, else its close (the header's). @param {Record<string, any>} manifest */
function builtOn(manifest) {
  if (quickFixBuild(manifest)) return latest([reviewAsked(manifest) ? manifest.fixes.review_asked : manifest.completed_at]);
  return latest(Object.entries(manifest.checklists ?? {}).filter(([key]) => /^phase-\d+-close$/.test(key)).map(([, record]) => record?.closed));
}

/** The day each phase closed, by the phase it reads (the header's). @type {Readonly<Record<string, (at: UnitRead) => string|null>>} */
const CLOSED = Object.freeze({
  discovery: ({ manifest }) => (manifest.work_type === 'epic' ? approvedOn(manifest) : startedOn(manifest)),
  discussion: ({ manifest }) => latest(Object.values(manifest.checklists?.decided ?? {}).map((record) => record?.closed)),
  investigation: ({ manifest, unit }) => latest([manifest.phases?.investigation?.items?.[unit]?.concluded_at]),
  specification: ({ manifest }) => latest([manifest.checklists?.['ready-to-build']?.closed]),
  implementation: ({ manifest }) => builtOn(manifest),
  review: ({ manifest }) => latest([manifest.completed_at]),
});

/** The day a phase closed, by the phase it reads, null where its records keep none. @param {UnitRead} at @param {string} reads */
const closedOn = (at, reads) => /** @type {Record<string, (at: UnitRead) => string|null>} */ (CLOSED)[reads]?.(at) ?? null;

/**
 * Where a quick-fix's phase stands (the header's): its implementation from
 * its fixes' beginning until its review is asked for, its review from
 * then, each complete once it closes.
 * @param {Record<string, any>} manifest @param {string} reads @returns {Status}
 */
function quickFixStatus(manifest, reads) {
  if (manifest.status === 'completed') return 'complete';
  if (reads === 'review') return reviewAsked(manifest) ? 'running' : 'later';
  if (reviewAsked(manifest)) return 'complete';
  return fixesBegun(manifest) ? 'running' : 'later';
}

/** Where a phase stands, by the status of the phase it reads. @param {UnitRead} at @param {string} reads @returns {Status} */
function statusOf(at, reads) {
  if (reads === 'discovery' || (reads === 'discussion' && closedIntoSpec(at.manifest))) return 'complete';
  if (quickFixBuild(at.manifest)) return quickFixStatus(at.manifest, reads);
  const status = reads === 'review' ? buildPlaceStatus(at.manifest, reads) : phaseStatus(at.manifest, reads, reads === 'specification' && specBegun(at.cwd, at.manifest));
  if (status === 'completed') return 'complete';
  return status === 'in-progress' ? 'running' : 'later';
}

/** The unit's phases from discovery (the header's), read once a call. @param {UnitRead} at @returns {PhaseAt[]} */
const phasesAt = (at) => at.once('phases', () => {
  const after = phasesAfter(at.manifest);
  const shaping = at.manifest.work_type === 'epic' && !pastDiscovery(at.manifest);
  /** @param {string} phase @param {string} reads @returns {PhaseAt} */
  const of = (phase, reads) => {
    const status = shaping ? (reads === 'discovery' ? 'running' : 'later') : statusOf(at, reads);
    return { phase, reads, status, on: status === 'complete' ? closedOn(at, reads) : null };
  };
  return [of('discovery', 'discovery'), ...after.map(([phase, reads]) => of(phase, reads))];
});

/** Where an epic past its discovery has come to, by its stages (the header's). @param {UnitRead} at @returns {UnitNow} */
function epicNow(at) {
  const { manifest } = at;
  if (manifest.status === 'completed') return { phase: 'complete', since: closedOn(at, 'review') };
  if (buildFinished(manifest)) return { phase: 'review', since: closedOn(at, 'implementation') };
  if (buildBegun(manifest)) return { phase: 'build', since: closedOn(at, 'specification') };
  if (specBegun(at.cwd, at.manifest)) return { phase: 'specification', since: closedOn(at, 'discussion') };
  return { phase: 'discussion', since: closedOn(at, 'discovery') };
}

/** Where any other unit has come to: the first phase not complete, since the one before it closed, else complete. @param {UnitRead} at @returns {UnitNow} */
function linearNow(at) {
  const phases = phasesAt(at);
  const now = phases.findIndex(({ status }) => status !== 'complete');
  if (at.manifest.status === 'completed' || now === -1) return { phase: 'complete', since: closedOn(at, 'review') };
  return { phase: phases[now].phase, since: phases[now - 1]?.on ?? null };
}

/** Where a unit of a type the reshape retires has come to: the migration's cut, which it waits on. @type {UnitNow} */
const AT_THE_CUT = Object.freeze({ phase: 'cut', since: null });

/** Where the unit has come to (the header's). @param {UnitRead} at @returns {UnitNow} */
function unitNow(at) {
  if (retiredRefusal(at.manifest) !== null) return AT_THE_CUT;
  return pastDiscovery(at.manifest) ? epicNow(at) : linearNow(at);
}

/** Where the unit has come to, read once a call. @param {UnitRead} at @returns {UnitNow} */
const nowOf = (at) => at.once('now', () => unitNow(at));

/**
 * A unit as where it has come to reads it outside a board call — a menu's
 * row, what waits on the person — its own one read of anything read twice.
 * @param {string} cwd @param {Record<string, any>} manifest @returns {UnitRead}
 */
function unitRead(cwd, manifest) {
  /** @type {Map<string, unknown>} */
  const reads = new Map();
  /** @type {UnitRead['once']} */
  const once = (key, read) => {
    if (!reads.has(key)) reads.set(key, read());
    return /** @type {any} */ (reads.get(key));
  };
  return { cwd, unit: manifest.name, manifest, once };
}

/**
 * Approve the map, while a map is staged: its topics in order and what it
 * parks on the roadmap, or after the sweep its candidates still standing,
 * to take or strike.
 * @param {BoardAt} at @returns {WaitingLine[]}
 */
function mapWaits(at) {
  const staged = at.manifest.work_type === 'epic' ? stagedOrNone(at.cwd, at.unit) : null;
  if (staged === null) return [];
  const parks = staged.parks?.length ?? 0;
  const holds = staged.candidates === undefined
    ? `${counted(staged.topics.length, 'topic')} in this order${parks === 0 ? '' : `, and ${parks} to the roadmap`}`
    : `${counted(candidatesStanding(staged.candidates).length, 'candidate')} the sweep found, to take or strike`;
  return [{ kind: 'map', id: 'approve-the-map', text: `Approve the map: ${holds}`, page: null }];
}

/**
 * The questions its build and the review wait on, oldest first, each
 * opening the page of the first task it parks, which holds it whole, or
 * one parking none its question's entry — a replacement's, the decision it
 * would replace.
 * @param {BoardAt} at @returns {WaitingLine[]}
 */
function questionWaits(at) {
  if (!tasksBegun(at.manifest)) return [];
  return waitingAndFreed(at.cwd, at.unit, at.warnings).waiting.map(({ question, asks, about, parks }) => ({
    kind: /** @type {const} */ ('question'), id: question, text: `${question} ${asks}`, page: parks.length === 0 ? `entry:${about}` : `task:${parks[0]}`,
  }));
}

/** Finish, once its screen draws: its checklist closed, every item the engine checks of it holding — the review over among them (D18). @param {BoardAt} at @returns {boolean} */
const finishWaits = (at) => finishDraws(at.cwd, at.unit);

/** Finish, as what waits on the person. @type {WaitingLine} */
const FINISH = Object.freeze({ kind: 'finish', id: 'finish', text: 'Finish: the report of every round, and your verdict on each call you changed', page: null });

/** Finish once its screen draws and no question waits (D18): a quick-fix's its close (board-quick-fix.cjs). @param {BoardAt} at @returns {WaitingLine[]} */
function finishLine(at) {
  if (quickFixBuild(at.manifest)) return [closeWait(at)].filter((line) => line !== null);
  return finishWaits(at) ? [FINISH] : [];
}

/** What waits on the person in the unit (the header's), read once a call. @param {BoardAt} at @returns {WaitingLine[]} */
const waitingOn = (at) => at.once('waiting-on', () => {
  const questions = questionWaits(at);
  return [
    ...mapWaits(at),
    ...investigationWaits(at),
    ...(specUnderWay(at.cwd, at.manifest) ? specWaits(at) : []),
    ...questions,
    ...raisedWaits(at),
    ...(questions.length === 0 ? finishLine(at) : []),
  ];
});

/** Whether a wait holds the phase: all but a build's questions, which wait on the board, and a quick-fix's raises, asked in the conversation and holding nothing. @param {WaitingLine} line */
const holds = ({ kind }) => kind !== 'question' && kind !== 'raised';

/**
 * Whether nothing of the unit's tasks can go on without an answer (the
 * header's), by the build's rule (board-build.cjs) whatever the type; read
 * once a call.
 * @param {BoardAt} at @returns {boolean}
 */
const tasksStopped = (at) => at.once('stopped', () => tasksBegun(at.manifest) && buildView(at).view.progress.stopped);

/** How the phase the unit is in stands (the header's). @param {BoardAt} at @returns {PhaseStanding} */
function standingOf(at) {
  if (nowOf(at).phase === 'complete') return 'complete';
  if (waitingOn(at).some(holds)) return 'waits';
  return tasksStopped(at) ? 'stopped' : 'running';
}

/**
 * The banner's fact for what waits on the person (the header's): how many,
 * the map alone by its own words; flagged in a phase, said unflagged at a
 * menu (D40); none where nothing waits.
 * @param {WaitingLine[]} waiting @param {boolean} atMenu @returns {Fact[]}
 */
function waitsFacts(waiting, atMenu) {
  if (waiting.length === 0) return [];
  const text = waiting.every(({ kind }) => kind === 'map') ? 'the map waits on you' : `${waiting.length} waiting on you`;
  return [atMenu ? { text, needs: false, waits: true } : { text, needs: true }];
}

module.exports = { phasesAt, nowOf, unitRead, waitingOn, standingOf, tasksStopped, holds, waitsFacts, closedOn, pastDiscovery };
