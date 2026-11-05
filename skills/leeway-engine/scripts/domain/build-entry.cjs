'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the build's row of the entry (enter.cjs) — `enter
// implementation <unit>`, at the work unit, whose build it is — and the
// build's standing (P13), which everything showing where a build stands
// reads: the entry and its recovery note (position.cjs), the review phase's
// entry, the menus, the screens and the board.
//
// A quick-fix is built by its own arm of the row (below), wherever
// `quickFixBuild` says it is one (derivations.cjs). The entry refuses,
// before anything else: a unit built under the old plan, its old scoping's,
// spec's, planning's or implementation's items standing until the reshape's
// 29.17 migration cuts it (`legacyBuild`, P12), which the menus show
// waiting on that cut with no route — a quick-fix today's scoping made
// among them; and a unit whose build has not begun, ready to build's yes
// beginning it (11.8.3).
// Another
// session holding the checkout's code stops it with the code gate alone,
// nothing written, and `--take` enters all the same (12.7.8) — the refusals
// and the gate the review phase's entry makes too (review-entry.cjs). It starts
// nothing and names no log of the conversation's: the build's log is
// Claude's to append as it goes (12.2.1), a log of the layout's, which
// every state commit carries. As the conversation arrives — here, or at the
// review phase's entry, whose fix tasks the same loop builds (14.3.2) —
// every task the tracker holds in progress in a phase the build has written
// is put in flight on its position at the place entered (position.cjs), a
// task already there kept as it stands (`takeInFlight`): one another
// conversation left comes with no builder and no pair, which are dispatched
// afresh on its branch, as its line names the way: a round briefed and not
// reported whole is its new pair's to read, each reviewer whose report is
// not in or does not read briefed again for it, never its builder's, which
// goes once the round is read (round-report.cjs); a round that failed, its
// fix not yet read, a new builder's, briefed with its brief and then the
// fix round's; a round that passed, its way by how far the task stands
// towards landing — its account taken, to its landing; written and not
// taken, to its taking; else the orchestrator's to read for its notes for
// later and the nits the task's commits do not yet fix, fixed in the
// worktree that has its branch out, then the new builder's for the account
// (task-account.cjs, `reviewOverWay`); anything else its new builder's. A task a question parks is
// put in flight as well, but no builder goes to it until the person answers
// (12.13.2); one at its step gate waits on the person's go there, the gate
// drawn again, its builder never sent afresh (12.7.9, 12.14.3); and one
// behind the task in flight waits for that one to be done, no builder going
// to it until then (12.7.9). That conversation's own record is left as it
// stands.
//
// It answers, and its recovery note with it (12.1.6, 24.2.2): where the
// build stands, a line a phase, and a line for each fix its failed review
// owes, as the phase close's `phase-review-passed` reads it — no settlement
// answering it, or a fix it names not done or closed (phase-checks.cjs);
// in step, a phase of the cut closed whose stack waits at its merge gate,
// the lowest, and its gate; else, once every phase of the cut has closed,
// that the review phase is next;
// each task in flight with its builder and its pair, or the question
// parking it, its gate, or the task it waits behind; each question waiting
// on the person; the entries affected since the spec concluded, by their
// call (11.9.1); the unit's record, by its call; and the build's log, read
// beside the ledger (12.2.2, 24.2.5). The entry's tasks in flight are the calling
// conversation's; the note's, those of the conversation it is asked for, as
// its position holds them — a compaction's note is asked for from outside
// that conversation.
//
// The standing is worked out at each read, never kept: only the position,
// auto or step, is stored, as `build`. Each phase of the cut is not yet
// written, the tracker holding none of it (7.4.1); written, its start
// checklist not closed; running; in review, every task not closed done;
// closed, its close checklist closed; or merged, closed with its stack
// merged (phase-checks.cjs). Past the cut, each fix phase the review phase
// has written (P14) — round k's numbered k past it, read to one past the
// rounds recorded (review-phase.cjs) — is the review's fixes of its round,
// relying on nothing and owing no phase review (13.10.1): written, no task
// of it started; running; closed, every task not closed done; or merged,
// each landed. Each task stands as the tracker holds it, with the questions
// waiting that park it and, one not started, the tasks not yet done it is
// linked after (12.6.4) — and, in step, behind the task in flight where it
// goes on beside it, held until that one is done (task-verbs.cjs,
// `stepTurn`); else at its gate once it lands: in progress, parked by no
// question, its pair passed and its account taken (task-account.cjs), with
// nothing added to it since and nothing changed under its last round
// (round-report.cjs) — an addition, the person's Comment at its gate among
// them (13.11.3), is reworked and read again first, the task in progress
// until a new account counts it — and, a bugfix's reproducing task, its
// bug proven, its line naming the series until then (bug-proven.cjs) —
// until the person's go there and `task done`. The
// build is finished once every phase of the cut has closed, so "nothing
// ready" with a phase not yet written never reads finished (7.4.3, 12.6.7)
// — the rule `phaseStatus` reads off the manifest (derivations.cjs) — its
// fix phases never counted in it; in step its stacks merge at their gates
// first (7.2.4), so the review phase is next only once none waits there
// (`mergeWaiting`, phase-checks.cjs).
//
// A quick-fix's arm (19.5.1–19.5.5, E2, E4) is entered as the row is, the
// code gate first (12.7.8, 19.5.18), with no cut, no ready to build and no
// position: its build is its one phase, the fixes, each fix its own task,
// which the arm starts — the phase written into the tracker where it is
// missing, the tracker's verb committing it, and the fixes' beginning
// recorded on the manifest (`fixesBegun`), which the entry commits and the
// phase's status reads — and the review's fixes, asked for at its close,
// numbered past it (`buildLength`, P14). The tasks in progress are put in
// flight as the row puts them. It answers, as the tracker held its fixes on
// arrival: the change, the unit's description, then each of its seeds; each
// fix by its id and title and where it stands, none yet before the first;
// its short record, `summary.md`, once written (19.5.6); the unit's record,
// by its call; the build's log; and the engine. Its recovery note re-reads
// the same, the record by its call, the build's log, then the change and
// the fixes a line each (`fixesRecovery`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { ENGINE_COMMAND, ENGINE_RUN, messageOf } = require('../kernel/call.cjs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const {
  buildBegun, buildFinished, phaseStarted, phaseClosed, buildRefusal, cutPhases, cutLength, buildLength, quickFixBuild, fixesBegun, FIXES_PHASE,
} = require('./derivations.cjs');
const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { isoNow } = require('./dates.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { seedFiles } = require('./reads.cjs');
const { summaryFile } = require('./knowledge/artifacts.cjs');
const { STATUS_WORDS, goesOn, turnOf, writePhase, trackedPhase } = require('./task-verbs.cjs');
const { heldCodeSessions } = require('./presence.cjs');
const { codeGate } = require('./projections/enter.cjs');
const { tasksInFlight } = require('./conversation.cjs');
const { recordTasksAt } = require('./position.cjs');
const { waitingAndFreed, parkedTasks } = require('./questions.cjs');
const { reading, phaseLists, phaseTasks, phaseLanded, mergeWaiting, fixesOwed, passed } = require('./phase-checks.cjs');
const { takenFigures, reviewOverWay } = require('./task-account.cjs');
const { recordedRounds, mergingWords } = require('./review-phase.cjs');
const { shownTask, parseShownTask } = require('./task-id.cjs');
const { roundStanding, taskRounds, pairPassed } = require('./round-report.cjs');
const { reproducingHold } = require('./bug-proven.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./enter.cjs').HeldWays} HeldWays */
/** @typedef {import('./topic-standing.cjs').Standing} Standing */
/** @typedef {import('./phase-checks.cjs').Reading} Reading */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskStatus} TaskStatus */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */
/** @typedef {import('./questions.cjs').Waiting} Waiting */
/** @typedef {import('./task-verbs.cjs').StepTurn} StepTurn */
/** What a recovery note re-reads beside its skill: the calls, the documents, and the lines where the work stands. @typedef {{calls: string[], documents: string[], lines: string[]}} Recovery */

/** Where a phase of the build stands. @typedef {'not yet written'|'written'|'running'|'in review'|'closed'|'merged'} PhaseState */
/** Where a task of the build stands: as the tracker holds it, or, in step, behind the task in flight or at its gate. @typedef {TaskStatus|'behind'|'at-gate'} TaskState */
/**
 * A task of a phase: its id shown, its title, where it stands, the
 * questions waiting that park it, by number, and, one not started, the
 * tasks not yet done it is linked after; and, a bugfix's reproducing task
 * that would stand at its gate, why it waits on its bug proven first.
 * @typedef {{task: string, title: string, status: TaskState, parked: string[], after: string[], unproven?: string}} StandingTask
 */
/**
 * A phase of the build: its number and name; the review round whose fixes
 * it holds, null for a phase of the cut; what it relies on; where it
 * stands; its tasks, none where it is not written; and the fixes its
 * failed review owes, as `phase-review-passed` reads them, each saying its
 * way on — none where the review is not complete, passed, or settled with
 * every fix done (phase-checks.cjs), nor for a fix phase.
 * @typedef {{phase: number, name: string, round: number|null, relies_on: Array<number|string>, state: PhaseState, tasks: StandingTask[], fixes_owed: string[]}} StandingPhase
 */
/**
 * Where a build stands: its unit and position; each phase of its cut, then
 * each of the review's fix phases written; the tasks in flight there of the
 * conversation it is read for; the questions waiting on the person, as
 * `raise waiting` answers them; whether every phase of the cut has closed;
 * in step, the phase of the cut whose stack waits at its merge gate, the
 * lowest, null where none does; and, in step, the task in flight and those
 * behind it, null where none goes on.
 * @typedef {{
 *   unit: string, position: string, phases: StandingPhase[], in_flight: InFlight[], waiting: Waiting[], finished: boolean, merging: number|null,
 *   turn: StepTurn|null,
 * }} BuildStanding
 */

/** The build's log, state-relative (12.2.3). @param {string} unit */
const buildLogOf = (unit) => `${unit}/build/log.md`;

/** A phase's name: the cut's, or for a phase past it, the review's fixes of its round (P14). @param {Record<string, any>} manifest @param {number} phase */
function phaseNamed(manifest, phase) {
  const cut = cutLength(manifest);
  return phase > cut ? `the review's fixes, round ${phase - cut}` : cutPhases(manifest)[phase - 1].name ?? '';
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

/**
 * The phases the build may have written, in order: each of its own — its
 * cut's, or a quick-fix's fixes — then, once the cut is through, the
 * review's fix phases to one past the rounds recorded — a round's fix phase
 * is written before it is recorded (the header's).
 * @param {Reading} at @returns {number[]}
 */
function buildPhases(at) {
  const fixes = buildFinished(at.manifest) ? recordedRounds(at.cwd, at.unit).length + 1 : 0;
  return Array.from({ length: buildLength(at.manifest) + fixes }, (_, i) => i + 1);
}

/** Where a phase of the cut stands, or not yet written. @param {Reading} at @param {number} phase @param {TaskRow[]|null} rows @returns {PhaseState} */
function phaseState(at, phase, rows) {
  if (rows === null) return 'not yet written';
  if (phaseClosed(at.manifest, phase)) return phaseLanded(at, phase) ? 'merged' : 'closed';
  if (!phaseStarted(at.manifest, phase)) return 'written';
  const live = rows.filter(({ status }) => status !== 'closed');
  return live.length > 0 && live.every(({ status }) => status === 'done') ? 'in review' : 'running';
}

/** Where a fix phase written stands (the header's). @param {Reading} at @param {number} phase @param {TaskRow[]} rows @returns {PhaseState} */
function fixState(at, phase, rows) {
  if (phaseLanded(at, phase)) return 'merged';
  const live = rows.filter(({ status }) => status !== 'closed');
  if (live.every(({ status }) => status === 'done')) return 'closed';
  return live.some(({ status }) => status !== 'open') ? 'running' : 'written';
}

/**
 * The tasks not yet done that each task of a phase not started is linked
 * after, by task: read whole only for a phase holding one, given every task
 * of the build's status.
 * @param {Reading} at @param {number} phase @param {TaskRow[]|null} rows @param {Map<string, TaskStatus>} statuses
 * @returns {Map<string, string[]>}
 */
function linkedAfter(at, phase, rows, statuses) {
  if (!rows?.some(({ status }) => status === 'open')) return new Map();
  const unfinished = (/** @type {string} */ task) => ['open', 'in-progress'].includes(String(statuses.get(task)));
  return new Map((phaseTasks(at, phase) ?? []).map(({ ref, status, after }) => [shownTask(ref), status === 'open' ? after.map(shownTask).filter(unfinished) : []]));
}

/** How many additions the task holds now. @param {Reading} at @param {TaskRef} ref */
const additionsOf = (at, ref) => phaseTasks(at, ref.phase)?.find((task) => shownTask(task.ref) === shownTask(ref))?.additions.length;

/**
 * Whether a task in progress stands at its gate: in step, parked by no
 * question, its account taken with nothing added to it since, and its pair
 * passed (the header's).
 * @param {Reading} at @param {TaskRow} row @param {string[]} parked
 */
function atGate(at, { ref, status }, parked) {
  if (at.manifest.build.position !== 'step' || status !== 'in-progress' || parked.length > 0) return false;
  const figures = takenFigures(at.cwd, ref);
  return figures !== null && figures.additions === additionsOf(at, ref) && passed(at, ref);
}

/**
 * In step, the task in flight and those held behind it, which go on once it
 * is done (the header's, `stepTurn`'s), from the phases' lists, the parks
 * and when an answer last freed each task, as the standing read them; null
 * in auto, and where none goes on.
 * @param {Reading} at @param {(TaskRow[]|null)[]} lists @param {Map<string, string[]>} parked @param {Map<string, number>} freed
 * @returns {StepTurn|null}
 */
function turnIn(at, lists, parked, freed) {
  if (at.manifest.build.position !== 'step') return null;
  return turnOf(goesOn(parked, { phases: lists, ready: [] }, () => false), () => freed);
}

/**
 * Where a task stands as the standing gives it (the header's), and, a
 * bugfix's reproducing task that would stand at its gate, why it waits on
 * its bug proven first.
 * @param {Reading} at @param {TaskRow} row @param {string[]} parked @param {Set<string>} behind
 * @returns {{status: TaskState, unproven?: string}}
 */
function taskState(at, row, parked, behind) {
  if (behind.has(shownTask(row.ref))) return { status: 'behind' };
  if (!atGate(at, row, parked)) return { status: row.status };
  const unproven = reproducingHold(at.cwd, at.manifest, row.ref, 'lands');
  return unproven === null ? { status: 'at-gate' } : { status: row.status, unproven };
}

/**
 * A phase's tasks as the standing gives them.
 * @param {Reading} at @param {number} phase @param {TaskRow[]|null} rows @param {Map<string, string[]>} parked @param {Map<string, TaskStatus>} statuses @param {Set<string>} behind
 * @returns {StandingTask[]}
 */
function standingTasks(at, phase, rows, parked, statuses, behind) {
  const after = linkedAfter(at, phase, rows, statuses);
  return (rows ?? []).map((row) => {
    const task = shownTask(row.ref);
    const on = parked.get(task) ?? [];
    const { status, unproven } = taskState(at, row, on, behind);
    return { task, title: row.title, status, parked: on, after: after.get(task) ?? [], ...(unproven === undefined ? {} : { unproven }) };
  });
}

/**
 * A phase of the build as the standing gives it: one of the cut's, or past
 * it one of the review's fixes (the header's).
 * @param {Reading} at @param {number} phase @param {TaskRow[]|null} rows @param {StandingTask[]} tasks
 * @returns {StandingPhase}
 */
function standingPhase(at, phase, rows, tasks) {
  const name = phaseNamed(at.manifest, phase);
  const cut = cutLength(at.manifest);
  if (phase > cut) return { phase, name, round: phase - cut, relies_on: [], state: fixState(at, phase, rows ?? []), tasks, fixes_owed: [] };
  return { phase, name, round: null, relies_on: cutPhases(at.manifest)[phase - 1].relies_on, state: phaseState(at, phase, rows), tasks, fixes_owed: fixesOwed(at, phase) };
}

/**
 * The questions parking each task, by task, oldest first, from the
 * questions waiting.
 * @param {{question: string, parks: string[]}[]} waiting @returns {Map<string, string[]>}
 */
function parkingQuestions(waiting) {
  /** @type {Map<string, string[]>} */
  const parked = new Map();
  for (const { question, parks } of waiting) {
    for (const task of parks) parked.set(task, [...(parked.get(task) ?? []), question]);
  }
  return parked;
}

/**
 * The build's standing, as a call reads the unit, for the conversation
 * whose tasks in flight are given, the ledger read once.
 * @param {Reading} at @param {InFlight[]} inFlight @returns {BuildStanding}
 */
function standingOf(at, inFlight) {
  const cut = cutLength(at.manifest);
  const phases = buildPhases(at);
  const lists = phaseLists(at, phases);
  const statuses = new Map(lists.flatMap((rows) => (rows ?? []).map(({ ref, status }) => /** @type {[string, TaskStatus]} */ ([shownTask(ref), status]))));
  const { waiting, freed } = waitingAndFreed(at.cwd, at.unit, at.warnings);
  const parked = parkingQuestions(waiting);
  const turn = turnIn(at, lists, parked, freed);
  const behind = new Set(turn?.behind);
  return {
    unit: at.unit,
    position: at.manifest.build.position,
    phases: phases.filter((phase, i) => phase <= cut || lists[i] !== null)
      .map((phase) => standingPhase(at, phase, lists[phase - 1], standingTasks(at, phase, lists[phase - 1], parked, statuses, behind))),
    in_flight: inFlight,
    waiting,
    finished: buildFinished(at.manifest),
    merging: mergeWaiting(at, cut),
    turn,
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
 * has no such unit, it is a quick-fix, whose fixes have no cut to build by
 * and no stop, its raises drawn in the conversation, or its build has not
 * begun.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function builtUnit(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}"`);
  if (quickFixBuild(manifest)) throw new Error(`${unit} is a quick-fix, whose fixes have no cut to build by — they are entered at enter implementation ${unit}`);
  if (!buildBegun(manifest)) throw new Error(`${unit}'s build has not begun — ready to build's yes begins it: render ready-to-build ${unit}`);
  return manifest;
}

/** How many phases the build's cut holds: its phases the review's fixes do not number. @param {BuildStanding} standing */
const cutCount = ({ phases }) => phases.filter(({ round }) => round === null).length;

/** A task of a phase, as its phase's line says it. @param {StandingTask} task */
const taskWords = ({ task, status, parked }) => (parked.length > 0 ? `${task} parked on ${parked.join(', ')}` : `${task} ${STATUS_WORDS[status]}`);

/**
 * What holds a task in flight, as its line says it after its agents: a
 * question parking it, its builder's stop, the task in flight it waits
 * behind, a bugfix's reproducing task's bug not yet proven, or its gate;
 * null where nothing does.
 * @param {string} unit @param {InFlight} inFlight @param {StandingTask|undefined} standing the task as the standing gives it
 * @returns {{holds: string, then: string}|null}
 */
function heldBy(unit, { task, stopped }, standing) {
  const parked = standing?.parked ?? [];
  if (parked.length > 0) return { holds: `parked on ${parked.join(', ')}`, then: 'it waits on the person\'s answer, and no builder goes to it until then' };
  if (stopped !== undefined) {
    return { holds: 'its builder stopped, unable to build past a problem', then: `send its builder back in with brief builder ${unit} ${task}, or raise what stopped it to the person` };
  }
  if (standing?.status === 'behind') return { holds: STATUS_WORDS.behind, then: 'it goes on once that task is done, and no builder goes to it until then' };
  if (standing?.unproven !== undefined) return { holds: 'its account taken, its bug not yet proven', then: standing.unproven };
  if (standing?.status === 'at-gate') {
    return { holds: STATUS_WORDS['at-gate'], then: `it waits on the person's go there, the gate drawn again with render step-gate ${unit} ${task}, and its builder is never sent afresh` };
  }
  return null;
}

/** How a reviewer of a round not reported whole stands, as a task's line says it. */
const READER_WORDS = Object.freeze({
  reading: (/** @type {string} */ letter) => `reviewer ${letter} is reading it here`,
  again: (/** @type {string} */ letter) => `reviewer ${letter} is briefed again for it`,
  unread: (/** @type {string} */ letter) => `reviewer ${letter}'s report goes back to it`,
});

/**
 * Where a task this conversation dispatched no builder for goes (the
 * header's), as the conversation `session` stands to its review.
 * @param {string} cwd @param {string|null} session @param {string} unit @param {string} task
 */
function afreshWords(cwd, session, unit, task) {
  const ref = parseShownTask(unit, task);
  const standing = roundStanding(cwd, ref, session);
  if (standing !== null) {
    const open = standing.readers.filter(({ state }) => state !== 'reported');
    const readers = open.map(({ letter, state }) => READER_WORDS[/** @type {'reading'|'again'|'unread'} */ (state)](letter));
    const brief = open.some(({ state }) => state !== 'reading') ? `: engine brief reviewer ${unit} ${task} --letter <letter>` : '';
    return `round ${standing.round} of its review is not reported whole — ${readers.join(', ')}${brief}; its builder goes afresh once the round is read`;
  }
  let last;
  try {
    last = taskRounds(cwd, ref).at(-1);
  } catch {
    last = undefined;
  }
  if (last !== undefined && !pairPassed(last)) {
    return `round ${last.round} of its review failed — a new builder goes with its brief, then its fix brief, engine brief fix ${unit} ${task}`;
  }
  const over = reviewOverWay(cwd, ref);
  if (over !== null) return `${over.said} — ${over.way}`;
  return 'its builder and pair go afresh on its branch';
}

/**
 * A task in flight, with its builder and its pair where recorded — what a
 * fix round goes back to (24.2.4); one parked waits on the person's answer,
 * no builder going to it until then (12.13.2); one whose builder stopped,
 * on its builder sent back in or the stop raised to the person (20.4.9);
 * one behind the task in flight, for that one to be done (12.7.9); one at
 * its gate, on the person's go there, its gate drawn again and its builder
 * never sent afresh (12.7.9); one with no builder dispatched here, where it
 * goes (the header's).
 * @param {string} cwd @param {string|null} session @param {string} unit @param {InFlight} inFlight @param {StandingTask|undefined} standing the task as the standing gives it
 */
function inFlightWords(cwd, session, unit, inFlight, standing) {
  const { task, builder, reviewers } = inFlight;
  const agents = [
    ...(builder === null ? [] : [`its builder agent \`${builder}\``]),
    ...(reviewers.length === 0 ? [] : [`its reviewer agent${reviewers.length === 1 ? '' : 's'} ${reviewers.map((id) => `\`${id}\``).join(' and ')}`]),
  ];
  const held = heldBy(unit, inFlight, standing);
  if (held !== null) return `task ${task}, ${[...agents, held.holds].join(', ')} — ${held.then}`;
  if (builder !== null) return `task ${task}, ${agents.join(', ')}`;
  return `task ${task}, ${[...agents, 'no builder dispatched here'].join(', ')} — ${afreshWords(cwd, session, unit, task)}`;
}

/**
 * Each of the standing's tasks in flight, a line each, as the entries and
 * the notes give them, for the conversation `session`.
 * @param {string} cwd @param {string|null} session @param {BuildStanding} standing @returns {Line[]}
 */
function inFlightLines(cwd, session, standing) {
  const tasks = new Map(standing.phases.flatMap(({ tasks: held }) => held.map((task) => [task.task, task])));
  return standing.in_flight.map((task) => ['in flight', inFlightWords(cwd, session, standing.unit, task, tasks.get(task.task))]);
}

/** A phase's line: one of the cut's by its place in it, a fix phase by its number alone. @param {StandingPhase} phase @param {number} of the cut's phases */
function phaseLine({ phase, name, round, state, tasks }, of) {
  return `phase ${phase}${round === null ? ` of ${of}` : ''}, "${name}": ${state}${tasks.length === 0 ? '' : ` — tasks ${tasks.map(taskWords).join(', ')}`}`;
}

/**
 * What comes after the build's phases: in step, the merge waiting at its
 * gate; else, once the cut is through, the review phase.
 * @param {BuildStanding} standing @returns {Line[]}
 */
function nextLines({ unit, finished, merging }) {
  if (merging !== null) return [['merge waiting', mergingWords(unit, merging)]];
  return finished ? [['finished', `every phase of the cut has closed — the review phase is next: enter review ${unit}`]] : [];
}

/**
 * Where the build stands, a line a phase — and a line for each fix its
 * failed review owes, saying the way on — what comes after them, the tasks
 * in flight and the questions waiting, as the entry and the recovery note
 * give them, for the conversation `session`.
 * @param {string} cwd @param {string|null} session @param {BuildStanding} standing @returns {Line[]}
 */
function standingLines(cwd, session, standing) {
  const of = cutCount(standing);
  return [
    ['position', standing.position],
    ...standing.phases.flatMap((phase) => /** @type {Line[]} */ ([['phase', phaseLine(phase, of)], ...phase.fixes_owed.map((fault) => ['fixes owed', fault])])),
    ...nextLines(standing),
    ...inFlightLines(cwd, session, standing),
    ...waitingLines(standing),
  ];
}

/** The questions waiting on the person, a line each, as the entries and the notes give them. @param {{waiting: Waiting[]}} standing @returns {Line[]} */
const waitingLines = ({ waiting }) => waiting.map(({ question, asks, parks }) => /** @type {Line} */ (['waiting', `${question} — ${asks} — parks ${parkedTasks(parks)}`]));

/** The ledger's calls the build reads beside its log: the entries affected since the spec concluded, and the unit's record. @param {string} unit */
const ledgerCalls = (unit) => [`${ENGINE_COMMAND} ledger affected ${unit}`, `${ENGINE_COMMAND} ledger record ${unit}`];

/**
 * What the build's recovery note re-reads beside its skill, as the entry
 * reads it: the ledger's calls, the build's log, and where the build
 * stands, a line each — its tasks in flight those of the conversation the
 * note is for, `session`, as its position holds them, never the calling
 * process's — or why that cannot be read, in their place; a quick-fix's,
 * as its arm reads it (`fixesRecovery`).
 * @param {string} cwd @param {string} unit @param {InFlight[]} inFlight @param {string} session
 * @returns {Recovery}
 */
function buildRecovery(cwd, unit, inFlight, session) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest !== null && quickFixBuild(manifest)) return fixesRecovery({ cwd, phase: 'implementation', unit, manifest });
  /** @type {string[]} */
  let lines;
  try {
    lines = standingLines(cwd, session, buildStanding(cwd, unit, inFlight)).map(([key, value]) => `${key}: ${value}`);
  } catch (err) {
    lines = [`Where the build stands could not be read: ${messageOf(err)}`];
  }
  return { calls: ledgerCalls(unit), documents: [statePath(cwd, buildLogOf(unit))], lines };
}

/**
 * Every task the tracker holds in progress in a phase the build has
 * written, put in flight on this conversation's position at the place
 * entered, one there already kept as it stands (the header's).
 * @param {Standing} at
 */
function takeInFlight(at) {
  const read = readingOf(at);
  const steps = phaseLists(read, buildPhases(read)).flatMap((rows) => rows ?? []).filter(({ status }) => status === 'in-progress').map(({ ref }) => shownTask(ref));
  recordTasksAt(at.cwd, at.unit, /** @type {'implementation'|'review'} */ (at.phase), steps);
}

/** The engine by its absolute path, as an entry names it for a call made from a task's worktree. @type {Line} */
const ENGINE_LINE = ['engine', `\`${ENGINE_RUN}\` — the engine by its absolute path, for a call made from a task's worktree`];

/** What the build reads at its entry (the header's). @param {Entering} at @returns {Line[]} */
function buildReads(at) {
  const read = readingOf(at);
  const lines = standingLines(at.cwd, handedSession(), standingOf(read, ownInFlight(at.unit)));
  at.notes.push(...read.warnings);
  const [affected, record] = ledgerCalls(at.unit);
  return [
    ...lines,
    ['affected', `\`${affected}\``],
    ['record', `\`${record}\``],
    ['build log', statePath(at.cwd, buildLogOf(at.unit))],
    ENGINE_LINE,
  ];
}

/** A quick-fix's fixes as the tracker holds them on arrival, null where their phase is not written. @param {Standing} at */
const fixesOf = (at) => phaseLists(readingOf(at), [FIXES_PHASE.number])[0];

/** A fix as its quick-fix's line of them says it: its id, its title and where it stands. @param {TaskRow} row */
const fixWords = ({ ref, title, status }) => `${shownTask(ref)} "${title}" ${STATUS_WORDS[status]}`;

/** A quick-fix's change and its fixes, as its entry and its note read them (the header's). @param {Standing} at @returns {Line[]} */
function fixesLines(at) {
  const fixes = fixesOf(at) ?? [];
  const summary = statePath(at.cwd, summaryFile(at.unit));
  return [
    ['change', at.manifest.description],
    ...seedFiles(at.cwd, at.unit, at.manifest).map((seed) => /** @type {Line} */ (['seed', seed])),
    ['tasks', fixes.length === 0 ? 'none yet' : fixes.map(fixWords).join(', ')],
    ...(fs.existsSync(summary) ? [/** @type {Line} */ (['summary', summary])] : []),
  ];
}

/** What a quick-fix's entry reads (the header's). @param {Entering} at @returns {Line[]} */
function fixesReads(at) {
  at.notes.push(...readingOf(at).warnings);
  return [...fixesLines(at), ['record', `\`${ledgerCalls(at.unit)[1]}\``], ['build log', statePath(at.cwd, buildLogOf(at.unit))], ENGINE_LINE];
}

/**
 * What a quick-fix's recovery note re-reads beside its skill, as its entry
 * reads it: the record's call, the build's log, and its change and fixes, a
 * line each — or why they cannot be read, in their place.
 * @param {Standing} at @returns {Recovery}
 */
function fixesRecovery(at) {
  /** @type {string[]} */
  let lines;
  try {
    lines = fixesLines(at).map(([key, value]) => `${key}: ${value}`);
  } catch (err) {
    lines = [`Where the fixes stand could not be read: ${messageOf(err)}`];
  }
  return { calls: [ledgerCalls(at.unit)[1]], documents: [statePath(at.cwd, buildLogOf(at.unit))], lines };
}

/**
 * A quick-fix's fixes begun, as its start: their one phase written into the
 * tracker where it lacks it, the tracker's verb committing it, then the
 * record of their beginning on the manifest, which the entry commits —
 * answering what the tracker's commit warned of.
 * @param {string} cwd @param {string} unit @returns {string[]}
 */
function beginFixes(cwd, unit) {
  const written = trackedPhase(cwd, unit, FIXES_PHASE.number).tasks !== null;
  const { warnings = [] } = written ? {} : writePhase(cwd, unit, String(FIXES_PHASE.number), FIXES_PHASE.name);
  const manifest = loadWorkUnitManifest(cwd, unit);
  manifest.fixes = { began: isoNow() };
  saveWorkUnitManifest(cwd, unit, manifest);
  return warnings;
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
const QUICK_FIX = Object.freeze({
  level: /** @type {const} */ ('unit'),
  standing: () => null,
  held: codeHeld,
  unstarted: ({ manifest }) => !fixesBegun(manifest),
  start: beginFixes,
  questions: () => [],
  reads: fixesReads,
  closes: takeInFlight,
});

/** @type {Entry} */
const IMPLEMENTATION = Object.freeze({
  level: /** @type {const} */ ('unit'),
  arm: (manifest) => (quickFixBuild(manifest) ? QUICK_FIX : null),
  standing: ({ manifest }) => buildRefusal(manifest),
  held: codeHeld,
  unstarted: () => false,
  start: () => {},
  questions: () => [],
  reads: buildReads,
  closes: takeInFlight,
});

module.exports = {
  IMPLEMENTATION, phaseNamed, buildStanding, standingOf, buildPhases, builtUnit, cutCount, buildRecovery, ownInFlight, inFlightLines, waitingLines, takeInFlight, readingOf, codeHeld, buildLogOf,
};
