'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the build's row of the entry (enter.cjs) — `enter
// implementation <unit>`, at the work unit, whose build it is — and the
// build's standing (P13), which everything showing where a build stands
// reads: the entry and its recovery note (position.cjs), the menus, the
// screens and the board.
//
// The entry refuses, before anything else: a quick-fix, whose delivery
// moves onto the build with the reshape's 29.15 (P9); a unit built under
// the old plan, its old spec's, planning's or implementation's items
// standing until the reshape's 29.17 migration cuts it (`legacyBuild`,
// P12), which a handoff still sends into the phase's skill at its topic;
// and a unit whose build has not begun, ready to build's yes beginning it
// (11.8.3). Another
// session holding the checkout's code stops it with the code gate alone,
// nothing written, and `--take` enters all the same (12.7.8). It starts
// nothing and names no log of the conversation's: the build's log is
// Claude's to append as it goes (12.2.1), a log of the layout's, which
// every state commit carries. As the conversation arrives, every task the
// tracker holds in progress in a phase of the cut is put in flight on its
// position (position.cjs), a task already there kept as it stands: one
// another conversation left comes with no builder and no pair, which are
// dispatched afresh on its branch — the pair that conversation sent is
// abandoned, its round's reports written again by the new pair. A task a
// question parks is put in flight as well, but no builder goes to it until
// the person answers (12.13.2). That conversation's own record is left as
// it stands.
//
// It answers, and its recovery note with it (12.1.6, 24.2.2): where the
// build stands, a line a phase, and a line for each fix its failed review
// owes, as the phase close's `phase-review-passed` reads it — no settlement
// answering it, or a fix it names not done or closed (phase-checks.cjs);
// each task in flight with its builder and its pair, or the question
// parking it; each question waiting on the person; the entries affected
// since the spec concluded, by their call (11.9.1); the unit's record, by
// its call; and the build's log, read beside the ledger (12.2.2, 24.2.5).
// The entry's tasks in flight are the calling conversation's; the note's,
// those of the conversation it is asked for, as its position holds them —
// a compaction's note is asked for from outside that conversation.
//
// The standing is worked out at each read, never kept: only the position,
// auto or step, is stored, as `build`. Each phase of the cut is not yet
// written, the tracker holding none of it (7.4.1); written, its start
// checklist not closed; running; in review, every task not closed done;
// closed, its close checklist closed; or merged, closed with its stack
// merged (phase-checks.cjs). Each task stands as the tracker holds it, with
// the questions waiting that park it and, one not started, the tasks not
// yet done it is linked after (12.6.4). The build is finished once every
// phase of the cut has closed, so "nothing ready" with a phase not yet
// written never reads finished (7.4.3, 12.6.7) — the rule `phaseStatus`
// reads off the manifest (derivations.cjs). The review phase's fix phases,
// past the cut, are not the build's (P14).
// ---------------------------------------------------------------------------

const { ENGINE_COMMAND, messageOf } = require('../kernel/call.cjs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { buildBegun, buildFinished, phaseStarted, phaseClosed, legacyBuild, buildByCut } = require('./derivations.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { heldCodeSessions } = require('./presence.cjs');
const { codeGate } = require('./projections/enter.cjs');
const { tasksInFlight } = require('./conversation.cjs');
const { recordTask } = require('./position.cjs');
const { waitingQuestions, parkedTasks, parkedTasksOf } = require('./questions.cjs');
const { reading, cutPhases, phaseLists, phaseTasks, phaseLanded, fixesOwed } = require('./phase-checks.cjs');
const { taskId, shownTask } = require('./task-id.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./enter.cjs').HeldWays} HeldWays */
/** @typedef {import('./topic-standing.cjs').Standing} Standing */
/** @typedef {import('./phase-checks.cjs').Reading} Reading */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./drivers.cjs').TaskStatus} TaskStatus */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */
/** @typedef {import('./questions.cjs').Waiting} Waiting */

/** Where a phase of the cut stands. @typedef {'not yet written'|'written'|'running'|'in review'|'closed'|'merged'} PhaseState */
/**
 * A task of a phase: its id shown, its title, where the tracker holds it,
 * the questions waiting that park it, by number, and, one not started, the
 * tasks not yet done it is linked after.
 * @typedef {{task: string, title: string, status: TaskStatus, parked: string[], after: string[]}} StandingTask
 */
/**
 * A phase of the cut: its number, name and what it relies on, where it
 * stands, its tasks, none where it is not written, and the fixes its failed
 * review owes, as `phase-review-passed` reads them, each saying its way on
 * — none where the review is not complete, passed, or settled with every
 * fix done (phase-checks.cjs).
 * @typedef {{phase: number, name: string, relies_on: Array<number|string>, state: PhaseState, tasks: StandingTask[], fixes_owed: string[]}} StandingPhase
 */
/**
 * Where a build stands: its unit and position; each phase of its cut; the
 * tasks in flight there of the conversation it is read for; the questions
 * waiting on the person, as `raise waiting` answers them; and whether every
 * phase of the cut has closed.
 * @typedef {{unit: string, position: string, phases: StandingPhase[], in_flight: InFlight[], waiting: Waiting[], finished: boolean}} BuildStanding
 */

/** A task's status, as a line says it. @type {Readonly<Record<TaskStatus, string>>} */
const STATUS_WORDS = Object.freeze({ open: 'not started', 'in-progress': 'in progress', done: 'done', closed: 'closed' });

/** The build's log, state-relative (12.2.3). @param {string} unit */
const buildLogOf = (unit) => `${unit}/build/log.md`;

/**
 * Why the unit's build cannot be entered, with its way on, or null where it
 * can: a quick-fix, a unit built under the old plan, a build not begun.
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function buildRefusal(manifest) {
  const unit = manifest.name;
  if (manifest.work_type === 'quick-fix') return `${unit} is a quick-fix, whose delivery is built with the reshape's 29.15 — until then a quick-fix stops at its scoping`;
  if (legacyBuild(manifest)) return `${unit} was built under the old plan, and its build is entered once the reshape's 29.17 migration has cut it`;
  return buildBegun(manifest) ? null : `${unit}'s build has not begun — ready to build's yes begins it: render ready-to-build ${unit}`;
}

/** The readings of an entry, one each, shared by what it closes and what it reads. @type {WeakMap<Record<string, any>, Reading>} */
const readings = new WeakMap();

/** The unit as an entry reads it, once. @param {Standing} at @returns {Reading} */
function readingOf({ cwd, unit, manifest }) {
  const made = readings.get(manifest) ?? reading(cwd, unit, manifest);
  readings.set(manifest, made);
  return made;
}

/** The calling conversation's tasks in flight in the unit's build. @param {string} unit @returns {InFlight[]} */
function ownInFlight(unit) {
  const session = handedSession();
  return session === null ? [] : tasksInFlight(session).filter((task) => task.unit === unit).map(({ unit: _unit, ...task }) => task);
}

/** Where a phase written in the tracker stands, or not yet written. @param {Reading} at @param {number} phase @param {TaskRow[]|null} rows @returns {PhaseState} */
function phaseState(at, phase, rows) {
  if (rows === null) return 'not yet written';
  if (phaseClosed(at.manifest, phase)) return phaseLanded(at, phase) ? 'merged' : 'closed';
  if (!phaseStarted(at.manifest, phase)) return 'written';
  const live = rows.filter(({ status }) => status !== 'closed');
  return live.length > 0 && live.every(({ status }) => status === 'done') ? 'in review' : 'running';
}

/**
 * The tasks not yet done that each task of a phase not started is linked
 * after, by task: read whole only for a phase holding one, given every task
 * of the cut's status.
 * @param {Reading} at @param {number} phase @param {TaskRow[]|null} rows @param {Map<string, TaskStatus>} statuses
 * @returns {Map<string, string[]>}
 */
function linkedAfter(at, phase, rows, statuses) {
  if (!rows?.some(({ status }) => status === 'open')) return new Map();
  const unfinished = (/** @type {string} */ task) => ['open', 'in-progress'].includes(String(statuses.get(task)));
  return new Map((phaseTasks(at, phase) ?? []).map(({ ref, status, after }) => [shownTask(ref), status === 'open' ? after.map(shownTask).filter(unfinished) : []]));
}

/**
 * The build's standing, as a call reads the unit, for the conversation
 * whose tasks in flight are given.
 * @param {Reading} at @param {InFlight[]} inFlight @returns {BuildStanding}
 */
function standingOf(at, inFlight) {
  const cut = cutPhases(at.manifest);
  const lists = phaseLists(at, cut.map((_, i) => i + 1));
  const statuses = new Map(lists.flatMap((rows) => (rows ?? []).map(({ ref, status }) => /** @type {[string, TaskStatus]} */ ([shownTask(ref), status]))));
  const { waiting, warnings = [] } = waitingQuestions(at.cwd, [at.unit]);
  at.warnings.push(...warnings);
  const parked = parkedTasksOf(stateRoot(at.cwd), at.unit, at.warnings);
  return {
    unit: at.unit,
    position: at.manifest.build.position,
    phases: cut.map(({ name = '', relies_on: reliesOn }, i) => {
      const after = linkedAfter(at, i + 1, lists[i], statuses);
      return {
        phase: i + 1,
        name,
        relies_on: reliesOn,
        state: phaseState(at, i + 1, lists[i]),
        tasks: (lists[i] ?? []).map(({ ref, title, status }) => ({
          task: shownTask(ref), title, status, parked: parked.get(shownTask(ref)) ?? [], after: after.get(shownTask(ref)) ?? [],
        })),
        fixes_owed: fixesOwed(at, i + 1),
      };
    }),
    in_flight: inFlight,
    waiting,
    finished: buildFinished(at.manifest),
  };
}

/**
 * Where the unit's build stands (the header's), for the conversation whose
 * tasks in flight there are given, what its reads said pushed to
 * `warnings`; refused where the project has no such unit, or its build has
 * not begun.
 * @param {string} cwd @param {string} unit @param {InFlight[]} inFlight @param {string[]} [warnings]
 * @returns {BuildStanding}
 */
function buildStanding(cwd, unit, inFlight, warnings = []) {
  return standingOf(reading(cwd, unit, builtUnit(cwd, unit), warnings), inFlight);
}

/**
 * The manifest of a unit whose build has begun, refused where the project
 * has no such unit, or its build has not begun.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function builtUnit(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}"`);
  if (!buildBegun(manifest)) throw new Error(`${unit}'s build has not begun — ready to build's yes begins it: render ready-to-build ${unit}`);
  return manifest;
}

/** A task of a phase, as its phase's line says it. @param {StandingTask} task */
const taskWords = ({ task, status, parked }) => (parked.length > 0 ? `${task} parked on ${parked.join(', ')}` : `${task} ${STATUS_WORDS[status]}`);

/**
 * A task in flight, with its builder and its pair where recorded — what a
 * fix round goes back to (24.2.4); one parked waits on the person's answer,
 * no builder going to it until then (12.13.2).
 * @param {InFlight} inFlight @param {string[]} parked the questions waiting that park it
 */
function inFlightWords({ task, builder, reviewers }, parked) {
  const agents = [
    ...(builder === null ? [] : [`its builder agent \`${builder}\``]),
    ...(reviewers.length === 0 ? [] : [`its reviewer agent${reviewers.length === 1 ? '' : 's'} ${reviewers.map((id) => `\`${id}\``).join(' and ')}`]),
  ];
  if (parked.length > 0) return `task ${task}, ${[...agents, `parked on ${parked.join(', ')}`].join(', ')} — it waits on the person's answer, and no builder goes to it until then`;
  return `task ${task}, ${agents.length === 0 ? 'no builder dispatched — its builder and pair go afresh on its branch' : agents.join(', ')}`;
}

/**
 * Where the build stands, a line a phase — and a line for each fix its
 * failed review owes, saying the way on — the tasks in flight and the
 * questions waiting, as the entry and the recovery note give them.
 * @param {BuildStanding} standing @returns {Line[]}
 */
function standingLines(standing) {
  const of = standing.phases.length;
  const parked = new Map(standing.phases.flatMap(({ tasks }) => tasks.map(({ task, parked: on }) => [task, on])));
  return [
    ['position', standing.position],
    ...standing.phases.flatMap(({ phase, name, state, tasks, fixes_owed: owed }) => /** @type {Line[]} */ ([
      ['phase', `phase ${phase} of ${of}, "${name}": ${state}${tasks.length === 0 ? '' : ` — tasks ${tasks.map(taskWords).join(', ')}`}`],
      ...owed.map((fault) => ['fixes owed', fault]),
    ])),
    ...standing.in_flight.map((task) => /** @type {Line} */ (['in flight', inFlightWords(task, parked.get(task.task) ?? [])])),
    ...standing.waiting.map(({ question, asks, parks }) => /** @type {Line} */ (['waiting', `${question} — ${asks} — parks ${parkedTasks(parks)}`])),
  ];
}

/** The ledger's calls the build reads beside its log: the entries affected since the spec concluded, and the unit's record. @param {string} unit */
const ledgerCalls = (unit) => [`${ENGINE_COMMAND} ledger affected ${unit}`, `${ENGINE_COMMAND} ledger record ${unit}`];

/**
 * What the build's recovery note re-reads beside its skill, as the entry
 * reads it: the ledger's calls, the build's log, and where the build
 * stands, a line each — its tasks in flight those of the conversation the
 * note is for, as its position holds them, never the calling process's —
 * or why that cannot be read, in their place.
 * @param {string} cwd @param {string} unit @param {InFlight[]} inFlight
 * @returns {{calls: string[], documents: string[], lines: string[]}}
 */
function buildRecovery(cwd, unit, inFlight) {
  /** @type {string[]} */
  let lines;
  try {
    lines = standingLines(buildStanding(cwd, unit, inFlight)).map(([key, value]) => `${key}: ${value}`);
  } catch (err) {
    lines = [`Where the build stands could not be read: ${messageOf(err)}`];
  }
  return { calls: ledgerCalls(unit), documents: [statePath(cwd, buildLogOf(unit))], lines };
}

/**
 * Every task the tracker holds in progress in a phase of the cut, put in
 * flight on this conversation's position, one there already kept as it
 * stands (the header's).
 * @param {Standing} at
 */
function takeInFlight(at) {
  const read = readingOf(at);
  const cut = cutPhases(at.manifest).map((_, i) => i + 1);
  for (const row of phaseLists(read, cut).flatMap((rows) => rows ?? [])) {
    if (row.status === 'in-progress') recordTask(at.cwd, at.unit, at.unit, taskId(row.ref));
  }
}

/** What the build reads at its entry (the header's). @param {Entering} at @returns {Line[]} */
function buildReads(at) {
  const read = readingOf(at);
  const lines = standingLines(standingOf(read, ownInFlight(at.unit)));
  at.notes.push(...read.warnings);
  const [affected, record] = ledgerCalls(at.unit);
  return [
    ...lines,
    ['affected', `\`${affected}\``],
    ['record', `\`${record}\``],
    ['build log', statePath(at.cwd, buildLogOf(at.unit))],
  ];
}

/**
 * The code gate, where another session holds the checkout's code (12.7.8):
 * back to the epic's menu, or carrying on; the entry again with `--take`.
 * @param {Standing} at @param {HeldWays} ways @returns {string|null}
 */
function codeHeld({ cwd }, { take, menu }) {
  const holders = heldCodeSessions(cwd);
  if (holders.length === 0) return null;
  return codeGate(holders, {
    back: menu === null ? { kind: 'continue' } : { kind: 'handoff', ...menu },
    take: { kind: 'engine', argv: take },
  });
}

/** @type {Entry} */
const IMPLEMENTATION = Object.freeze({
  level: /** @type {const} */ ('unit'),
  takes: buildByCut,
  standing: ({ manifest }) => buildRefusal(manifest),
  held: codeHeld,
  unstarted: () => false,
  start: () => {},
  questions: () => [],
  reads: buildReads,
  closes: takeInFlight,
});

module.exports = { IMPLEMENTATION, STATUS_WORDS, buildStanding, builtUnit, buildRecovery, ownInFlight };
