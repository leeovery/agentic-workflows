'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's position — where in Ledger a
// conversation is working, kept as `position.json` in its folder
// (conversation.cjs) for whatever carries the conversation on: the session
// label's resume (session-label.cjs), the gate mod's spinner, and
// `conversation position`, the note the gate mod appends to a compaction,
// naming what to re-read to carry on there. A conversation carrying the
// migration on holds no position, the migration's row at its place its own
// (presence.cjs): its note names the start skill, whose boot, run again,
// stops where the migration stands.
//
// Every place records itself on arrival, through the calls that label it,
// labels on or off: a phase's entry (`enter`, or `session label {wu}
// {phase} {topic}` inside a phase not yet entered through it), the epic's
// menu's render, `session label roadmap|product` at the project-level
// places — a place this project lacks
// is refused before anything is labelled or recorded. Inside a unit's build
// the position holds every task in flight there (4.11.14, 24.2.4) — at its
// implementation, or at its review phase, whose fix tasks the same loop
// builds (14.3.2). The tracker's `task start` adds one where the
// conversation is at either of the unit's, the place kept, else at the
// unit's review for a task of one of its fix phases and its implementation
// for any other, and its `task done` and `task close` take it off, with
// every other of the unit's the tracker holds ended (task-verbs.cjs); an
// entry into either puts the tasks another conversation left in flight
// there, as the conversation arrives, and keeps only those the tracker
// holds neither done nor closed (build-entry.cjs). A `task start` re-run for
// a task already in flight keeps it as it stands; an arrival anywhere in
// the same unit carries them all — the epic's menu on the way back into its
// build among it — and an arrival at other work leaves none. The gate mod's
// `conversation builder` records the agent id of a builder or a reviewer
// it saw dispatched against the task its brief was issued for
// (brief-names.cjs), only while that task is in flight: the builder's
// replacing any before it, each reviewer's joining the pair the later
// rounds go back to (13.3.3). `task worktree`
// records the worktree it laid out for a task in flight (task-worktree.cjs),
// and `task stopped` when its builder stopped, unable to build past a
// problem (task-verbs.cjs), its first stop kept; the task's next builder's
// or fix round's brief (brief.cjs), or a raise parking it (raise.cjs), takes
// the stop off.
// They ride with their task and go with it. The start menu is no position:
// boot drops the calling conversation's own before anything else it does,
// whatever it answers, keeping the place it left where that names a phase,
// until a position is recorded again; and `session repair` drops it too. A
// menu's render leaves the conversation as these do (menus.cjs): the start
// menu and the project's menus beside it drop the position as `session
// repair` does, and the epic's menu and the roadmap arrive as `session
// label` does. Leaving never drops a task in flight: a position holding any
// is kept for them, at the place left, which `left.json` names, so the
// conversation is at no place while its builders go on (conversation.cjs) —
// until each task closes, the position going with the last, or a position
// is recorded again, which carries them only to a place of the same unit.
// A quick-fix closed or cancelled from inside its session is the exception:
// the conversation carries on there, so it leaves the unit's place whole,
// its tasks in flight with it, the place it left kept for the board to draw
// the close (`leaveUnit`, topic-leave.cjs) — nothing holds a commit it
// makes afterwards. Its start, made at a project-level place — the
// product's conversation or the roadmap — keeps that place beside the
// position (`keepCameFrom`), and its close or cancel puts the conversation
// back there (`takeCameFrom`); leaving the position, as boot and the start
// menu do, or the quick-fix's move, forgets it (`forgetCameFrom`).
//
// The engine is the file's one writer, and writes only for a conversation
// that runs Ledger: recording a position marks the conversation first
// (conversation.cjs — a session id, a call run in a Ledger project), since
// a conversation a handoff began can arrive at its first place before any
// other engine call has marked it; an agent is recorded only on a position
// already there. Each write reads the position and writes it whole under the
// lock beside it, and a drop deletes it under the same lock, so a pair
// dispatched side by side, or a builder recorded as a task starts, never
// loses the other's write, and no write brings back a dropped position. A
// position that cannot be written costs the verb nothing. It is read
// through conversation.cjs alone.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT, PROJECT_IDENTITIES, TERMINAL_STATUSES, VALID_PHASES, illegalNameReason, isTopicPhase } = require('../kernel/manifest-schema.cjs');
const { LOCK_TIMEOUT_MS, isObject, withStateLockFile, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { positionPath, leftPath, cameFromPath, storedPosition, readPosition, isMarked, markConversation, runningTranscript } = require('./conversation.cjs');
const { ROLES, issuedOf } = require('./brief-names.cjs');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { buildBegun, buildRefusal, quickFixReviewRefusal, isFixPhase, computeTopicLifecycle, itemOf, phaseData, UNIT_PHASES, briefFile } = require('./derivations.cjs');
const { latestSessionLog, productSession, sessionLogs } = require('./discovery-session.cjs');
const { PRODUCT_SESSIONS, PRODUCT_PICTURE } = require('./layout.cjs');
const { FROM_BEFORE } = require('./from-before.cjs');
const { phaseSkill, HANDOFF_TARGETS } = require('./handoff.cjs');
const { stepOfId, shownTask } = require('./task-id.cjs');
const { section, dataSection, GATE_MOD_INSTRUCTION } = require('./projections/surfaces.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { topicLog, ledgerView, recordCall, mapCall, owedHeader, namedConversations } = require('./topic-log.cjs');
const { staysDecided } = require('./topic-standing.cjs');
const { carriesMigration } = require('./presence.cjs');

const COMPACTED = 'The conversation was just compacted.';

// The skill a conversation carrying the migration on re-reads, and what it
// runs again there.
const START_SKILL = 'ledger';
const MIGRATION_BOOT = '- its boot, run again as it says: boot stops where the migration stands, and names what to carry on with';

const PLACE_SEPARATOR = ' › ';

// The phases under a topic on an epic's discovery map — the Discovery unit's,
// its experiment series riding along: a cancel or a postpone of the topic is
// recorded on its map row, whatever each item reads.
const MAP_PHASES = [...UNIT_PHASES.discovery, 'experiment'];

const ROADMAP = 'roadmap';
const EPIC_MENU_SKILL = 'ledger-continue-epic';

/** @typedef {import('./conversation.cjs').Position} Position */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */

/** @typedef {Record<string, unknown>|null} Manifest  a work unit's manifest; null where the project has none */

const POSITION_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the conversation\'s position' };

/** A write recording where the conversation is, and one changing its tasks in flight alone (`updatePosition`). */
const ARRIVING = Object.freeze({ arriving: true });
const TASKS_ALONE = Object.freeze({ arriving: false });

/** Which of a task's agents a dispatch of each agent is. @type {Readonly<Record<string, 'builder'|'reviewers'>>} */
const SLOTS = Object.freeze({ [ROLES.builder.agent]: 'builder', [ROLES.reviewer.agent]: 'reviewers' });

/** Whether a place is a project-level one, named by its identity alone. @param {string} name @param {string} [phase] */
function isProjectPlace(name, phase) {
  return phase === undefined && PROJECT_IDENTITIES.includes(name);
}

/** The calling conversation where the engine has marked it, else null. @returns {string|null} */
function ownConversation() {
  const sessionId = handedSession();
  return sessionId !== null && isMarked(sessionId) ? sessionId : null;
}

/**
 * The calling conversation, marked first: arriving at a place is running
 * Ledger. Null where no mark stands — no session id, a call run outside a
 * Ledger project, a mark that could not be written.
 * @param {string} cwd @returns {string|null}
 */
function arrivingConversation(cwd) {
  markConversation(cwd);
  return ownConversation();
}

/**
 * `write` run on the conversation `sessionId`'s position file under its lock:
 * whether it wrote — never where the lock or the file could not be had.
 * @param {string} sessionId @param {(file: string) => boolean} write @returns {boolean}
 */
function underPositionLock(sessionId, write) {
  const file = positionPath(sessionId);
  try {
    return withStateLockFile(`${file}.lock`, () => write(file), POSITION_LOCK);
  } catch {
    return false;
  }
}

/**
 * The conversation `sessionId`'s position changed: read and written whole
 * under its lock, `change` answering the position to write from the one
 * recorded — at the place left, where it was left — or null to write
 * nothing. Whether it was written. An arrival takes the place left away
 * before it writes, so one cut short never reads as left; a change to the
 * tasks alone keeps it, and where the place was left, the position goes
 * with its last task.
 * @param {string} sessionId @param {(prior: Position|null) => Position|null} change @param {{arriving: boolean}} how
 * @returns {boolean}
 */
function updatePosition(sessionId, change, { arriving }) {
  return underPositionLock(sessionId, (file) => {
    const next = change(storedPosition(sessionId));
    if (next === null) return false;
    const left = leftPath(sessionId);
    if (arriving) fs.rmSync(left, { force: true });
    if (next.tasks === undefined && fs.existsSync(left)) fs.rmSync(file, { force: true });
    else writeJsonAtomic(file, next);
    return true;
  });
}

/** A place with its tasks in flight, none held where none is. @param {Position} place @param {InFlight[]} tasks @returns {Position} */
function withTasks(place, tasks) {
  return tasks.length === 0 ? place : { ...place, tasks };
}

/** A unit's build, the place its tasks are in flight. @param {string} workUnit @returns {Position} */
const implementationOf = (workUnit) => ({ name: workUnit, phase: 'implementation', topic: workUnit });

/** The phases a unit's tasks are in flight at, each at the unit: its build, and its review phase's fixes (14.3.2). */
const BUILD_PLACES = Object.freeze(['implementation', 'review']);

/** Whether a place is one a unit's tasks are in flight at. @param {Position} place */
const inBuild = ({ name, phase, topic }) => topic === name && BUILD_PLACES.includes(phase ?? '');

/**
 * Where the conversation holds the unit's tasks in flight: its own place,
 * where that is the unit's implementation or review phase; null elsewhere.
 * @param {Position|null} prior @param {string} workUnit @returns {Position|null}
 */
function buildPlaceOf(prior, workUnit) {
  return prior !== null && prior.name === workUnit && inBuild(prior) ? { name: workUnit, phase: prior.phase, topic: workUnit } : null;
}

/**
 * Why the arguments name no place this project has, or null where they do:
 * a work unit, a phase and legal topic in one, or a project identity, which
 * has no phase.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 * @returns {string|null}
 */
function placeError(cwd, name, phase, topic) {
  if (isProjectPlace(name, phase)) return null;
  if (phase !== undefined && !VALID_PHASES.includes(phase)) return `unknown phase "${phase}" — one of ${VALID_PHASES.join('|')}`;
  const illegal = (phase === undefined ? null : illegalNameReason('topic', topic)) ?? illegalNameReason('work unit', name);
  if (illegal !== null) return illegal;
  return fs.existsSync(statePath(cwd, name)) ? null : `no work unit directory: ${statePath(cwd, name)}`;
}

/**
 * Refuses arguments that name no place this project has — before anything
 * is labelled or recorded, whatever the opt-in: an authoring bug.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function assertPlace(cwd, name, phase, topic) {
  const error = placeError(cwd, name, phase, topic);
  if (error !== null) throw new Error(error);
}

/** @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic] */
function isPlace(cwd, name, phase, topic) {
  return placeError(cwd, name, phase, topic) === null;
}

/**
 * The unit's tasks in flight a position holds, wherever in the unit it
 * stands (the header's); none at other work.
 * @param {Position|null} prior @param {string} workUnit @returns {InFlight[]}
 */
const unitTasks = (prior, workUnit) => (prior !== null && prior.name === workUnit ? prior.tasks ?? [] : []);

/** The place a position stands at, its tasks aside. @param {Position} position @returns {Position} */
const placeOf = ({ tasks: _tasks, ...place }) => place;

/**
 * The position with the unit's tasks in flight changed, at the place it
 * stands: `change` answers the tasks to keep from those it holds, or null
 * to write nothing; null where it holds none of the unit's.
 * @param {Position|null} prior @param {string} workUnit @param {(held: InFlight[]) => InFlight[]|null} change
 * @returns {Position|null}
 */
function withUnitTasks(prior, workUnit, change) {
  const held = unitTasks(prior, workUnit);
  const changed = held.length === 0 ? null : change(held);
  return prior === null || changed === null ? null : withTasks(placeOf(prior), changed);
}

/** The plan step an internal id ends in, `{phase}.{task}`. @param {string} internalId @returns {string|null} */
function taskStep(internalId) {
  const step = stepOfId(internalId);
  return step === null ? null : shownTask(step);
}

/**
 * Record the calling conversation's arrival at a place `assertPlace` passed,
 * and at the laboratory the experiment its entry named, `record`.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic] @param {string} [record]
 */
function recordPosition(cwd, name, phase, topic, record) {
  const own = arrivingConversation(cwd);
  if (!own) return;
  /** @type {Position} */
  const position = phase === undefined ? { name } : { name, phase, topic, ...(record === undefined ? {} : { record }) };
  updatePosition(own, (prior) => withTasks(position, unitTasks(prior, name)), ARRIVING);
}

/** Tasks in flight with those of `steps` not among them added after, none with an agent yet. @param {InFlight[]} held @param {string[]} steps @returns {InFlight[]} */
function joined(held, steps) {
  return [...held, ...steps.filter((step) => !held.some((t) => t.task === step)).map((step) => ({ task: step, builder: null, reviewers: [] }))];
}

/**
 * The place `task start` puts a unit's task in flight (the header's): where
 * the conversation holds the unit's tasks, else its review phase for a task
 * of one of its fix phases and its implementation for any other.
 * @param {string} cwd @param {Position|null} prior @param {string} workUnit @param {string} step
 * @returns {Position}
 */
function startedAt(cwd, prior, workUnit, step) {
  const held = buildPlaceOf(prior, workUnit);
  if (held !== null) return held;
  const manifest = loadManifest(cwd, workUnit);
  const fix = isObject(manifest) && isFixPhase(manifest, Number(step.split('.')[0]));
  return fix ? { name: workUnit, phase: 'review', topic: workUnit } : implementationOf(workUnit);
}

/**
 * Record the task `task start` put in flight beside those already there —
 * as it stands where it is one of them.
 * @param {string} cwd @param {string} workUnit @param {string} internalId
 */
function recordTask(cwd, workUnit, internalId) {
  const own = arrivingConversation(cwd);
  const step = taskStep(internalId);
  if (!own || step === null || !isPlace(cwd, workUnit, 'implementation', workUnit)) return;
  updatePosition(own, (prior) => withTasks(startedAt(cwd, prior, workUnit, step), joined(unitTasks(prior, workUnit), [step])), ARRIVING);
}

/**
 * Record the tasks an entry into the unit's build or its review phase puts
 * in flight on the calling conversation, at that place, beside those the
 * position holds of the unit but those of `ended` — each kept as it stands
 * where it is one of them (build-entry.cjs).
 * @param {string} cwd @param {string} workUnit @param {'implementation'|'review'} phase @param {string[]} steps each `{phase}.{n}` @param {string[]} ended each `{phase}.{n}`
 */
function recordTasksAt(cwd, workUnit, phase, steps, ended) {
  const own = arrivingConversation(cwd);
  if (!own) return;
  const place = { name: workUnit, phase, topic: workUnit };
  updatePosition(own, (prior) => {
    const held = unitTasks(prior, workUnit);
    const going = held.filter((t) => !ended.includes(t.task));
    return steps.length === 0 && going.length === held.length ? null : withTasks(place, joined(going, steps));
  }, ARRIVING);
}

/**
 * Where a dispatch's agent goes on the position: the unit and the task it
 * is for, and which of the task's agents it is — the task its brief was
 * issued for, a builder's or a reviewer's by the agent it was issued for.
 * Null where it goes nowhere.
 * @param {string} sessionId @param {string} briefId
 * @returns {{unit: string, task: string, slot: 'builder'|'reviewers'}|null}
 */
function dispatchedFor(sessionId, briefId) {
  const issued = issuedOf(sessionId, briefId);
  if (issued === null || !Object.hasOwn(SLOTS, issued.agent) || issued.unit === null || issued.task === null) return null;
  return { unit: issued.unit, task: issued.task, slot: SLOTS[issued.agent] };
}

/**
 * A task in flight with an agent recorded: a builder in place of any before
 * it, a reviewer beside those already there.
 * @param {InFlight} task @param {'builder'|'reviewers'} slot @param {string} agentId @returns {InFlight}
 */
function withAgent(task, slot, agentId) {
  if (slot === 'builder') return { ...task, builder: agentId };
  return task.reviewers.includes(agentId) ? task : { ...task, reviewers: [...task.reviewers, agentId] };
}

/**
 * Record the agent a dispatch answered with against its task in flight on
 * the conversation `sessionId`'s position (`dispatchedFor`).
 * @param {string} sessionId @param {string} agentId @param {string} briefId
 * @returns {{recorded: boolean}}
 */
function recordBuilder(sessionId, agentId, briefId) {
  return {
    recorded: updatePosition(sessionId, (prior) => {
      const at = dispatchedFor(sessionId, briefId);
      return at === null ? null : withUnitTasks(prior, at.unit, (held) => (held.some((t) => t.task === at.task) ? held.map((t) => (t.task === at.task ? withAgent(t, at.slot, agentId) : t)) : null));
    }, TASKS_ALONE),
  };
}

/**
 * The unit's task in flight on the conversation `sessionId`'s position
 * changed — only while it is in flight there: `change` answers the task to
 * write from the one held, or null to write nothing. The task as held
 * before the change, null where it is not in flight, and whether the change
 * was written.
 * @param {string} sessionId @param {string} workUnit @param {string} step `{phase}.{n}`
 * @param {(task: InFlight) => InFlight|null} change @returns {{held: InFlight|null, written: boolean}}
 */
function changeInFlight(sessionId, workUnit, step, change) {
  /** @type {InFlight|null} */
  let held = null;
  const written = updatePosition(sessionId, (prior) => withUnitTasks(prior, workUnit, (tasks) => {
    held = tasks.find((t) => t.task === step) ?? null;
    const changed = held === null ? null : change(held);
    return changed === null ? null : tasks.map((t) => (t.task === step ? changed : t));
  }), TASKS_ALONE);
  return { held: /** @type {InFlight|null} */ (held), written };
}

/**
 * Record the worktree `task worktree` laid out against the unit's task in
 * flight on the conversation `sessionId`'s position — only while it is in
 * flight there.
 * @param {string} sessionId @param {string} workUnit @param {string} step `{phase}.{n}` @param {string} worktree absolute
 * @returns {{recorded: boolean}}
 */
function recordWorktree(sessionId, workUnit, step, worktree) {
  return { recorded: changeInFlight(sessionId, workUnit, step, (task) => ({ ...task, worktree })).written };
}

/**
 * Record when the builder of the unit's task in flight on the conversation
 * `sessionId`'s position stopped, an earlier stop kept. The stop it holds,
 * null where the task is not in flight there.
 * @param {string} sessionId @param {string} workUnit @param {string} step `{phase}.{n}` @param {string} at ISO
 * @returns {string|null}
 */
function recordStop(sessionId, workUnit, step, at) {
  const { held, written } = changeInFlight(sessionId, workUnit, step, (task) => (task.stopped === undefined ? { ...task, stopped: at } : null));
  return held?.stopped ?? (written ? at : null);
}

/**
 * Take the stop off the unit's task in flight on the conversation
 * `sessionId`'s position, where it holds one.
 * @param {string} sessionId @param {string} workUnit @param {string} step `{phase}.{n}`
 */
function clearStop(sessionId, workUnit, step) {
  changeInFlight(sessionId, workUnit, step, ({ stopped, ...task }) => (stopped === undefined ? null : task));
}

/**
 * Take the unit's tasks that ended off the position, their agents with
 * them — only those of `steps` in flight there.
 * @param {string} workUnit @param {string[]} steps each `{phase}.{n}`
 */
function clearTasks(workUnit, steps) {
  const own = ownConversation();
  if (!own || steps.length === 0) return;
  updatePosition(own, (prior) => withUnitTasks(prior, workUnit, (held) => (held.some((t) => steps.includes(t.task)) ? held.filter((t) => !steps.includes(t.task)) : null)), TASKS_ALONE);
}

/** Take a task that ended off the position, its agents with it (`clearTasks`). @param {string} workUnit @param {string} internalId */
function clearTask(workUnit, internalId) {
  const step = taskStep(internalId);
  if (step !== null) clearTasks(workUnit, [step]);
}

/** The place `position` names left for the start menu, `left.json` naming it. @param {string} sessionId @param {Position} position */
function leaveFor(sessionId, { name, phase }) {
  writeJsonAtomic(leftPath(sessionId), { name, phase });
}

/** The place `prior` names kept as left where it names a phase, else none. @param {string} sessionId @param {Position|null} prior */
function keepLeft(sessionId, prior) {
  if (prior?.phase === undefined) fs.rmSync(leftPath(sessionId), { force: true });
  else leaveFor(sessionId, prior);
}

/**
 * The conversation `sessionId` leaves its position for the start menu, the
 * place left kept where it names a phase, else none — the position kept for
 * its tasks in flight where it holds any (conversation.cjs). One that has
 * left already, sitting nowhere, keeps the place it left: a finish or a
 * cancel leaves the unit before a start's boot (`leaveUnit`), its done
 * banner kept through it. The place a quick-fix was started from is
 * forgotten: the conversation has left it.
 * @param {string|null|undefined} sessionId
 */
function leavePosition(sessionId) {
  if (!sessionId) return;
  forgetCameFrom(sessionId);
  underPositionLock(sessionId, (file) => {
    if (!fs.existsSync(file)) return false;
    const prior = storedPosition(sessionId);
    keepLeft(sessionId, prior);
    if (prior?.tasks === undefined) fs.rmSync(file, { force: true });
    return true;
  });
}

/**
 * The conversation `sessionId`'s position dropped, the place left as it
 * stands — but one holding tasks in flight, which is left as boot leaves it
 * — and the place a quick-fix was started from forgotten.
 * @param {string|null|undefined} sessionId
 */
function dropPosition(sessionId) {
  if (!sessionId) return;
  forgetCameFrom(sessionId);
  underPositionLock(sessionId, (file) => {
    const prior = storedPosition(sessionId);
    if (prior?.tasks === undefined) fs.rmSync(file, { force: true });
    else leaveFor(sessionId, prior);
    return true;
  });
}

/**
 * The conversation `sessionId` leaves the unit's place whole, where its
 * position names it: the position gone with the unit's tasks in flight,
 * the place left kept where it names a phase (the header's). Whether it
 * left.
 * @param {string|null} sessionId @param {string} workUnit @returns {boolean}
 */
function leaveUnit(sessionId, workUnit) {
  if (!sessionId) return false;
  return underPositionLock(sessionId, (file) => {
    const prior = storedPosition(sessionId);
    if (prior?.name !== workUnit) return false;
    keepLeft(sessionId, prior);
    fs.rmSync(file, { force: true });
    return true;
  });
}

/**
 * The place the calling conversation is in kept, its tasks aside, as the
 * one it started the quick-fix `workUnit` from (the header's); nothing kept
 * where it is at no place.
 * @param {string} workUnit
 */
function keepCameFrom(workUnit) {
  const own = ownConversation();
  const at = own === null ? null : readPosition(own);
  if (own === null || at === null || !isProjectPlace(at.name, at.phase)) return;
  try {
    writeJsonAtomic(cameFromPath(own), { unit: workUnit, place: { name: at.name } });
  } catch {
    // A place that cannot be kept costs the start nothing: its close leaves the conversation at no place.
  }
}

/** The place the conversation `sessionId` started a quick-fix from, forgotten. @param {string|null|undefined} sessionId */
function forgetCameFrom(sessionId) {
  if (!sessionId) return;
  try {
    fs.rmSync(cameFromPath(sessionId), { force: true });
  } catch {
    // Left behind, it names a unit no later close of another matches.
  }
}

/**
 * The project-level place the calling conversation started the quick-fix
 * `workUnit` from, taken: null where it kept none for that unit.
 * @param {string} workUnit @returns {string|null}
 */
function takeCameFrom(workUnit) {
  const own = ownConversation();
  if (own === null) return null;
  let kept;
  try {
    kept = JSON.parse(fs.readFileSync(cameFromPath(own), 'utf8'));
  } catch {
    return null;
  }
  if (!isObject(kept) || kept.unit !== workUnit || !isObject(kept.place) || !isProjectPlace(kept.place.name)) return null;
  forgetCameFrom(own);
  return kept.place.name;
}

// ---------------------------------------------------------------------------
// What a conversation re-reads to carry on from its position: the skill that
// runs the work there, then the topic's documents. A linear unit's place
// with no phase carries nothing on, so it names neither; nor does a place
// this project no longer has open — the work unit gone or closed, the item
// closed, a topic on the map cancelled or postponed, a spec concluded — nor
// one whose skill this project lacks. No skill carries a recovery section
// of its own: the note carries it whole (24.2.6) — the skill and its
// framework, then the engine calls the place re-reads beside its documents,
// and the log its conversation keeps, where it keeps one, which is caught
// up from the conversation's transcript (8.14.9). An epic's menu and the
// roadmap name their skill alone; the laboratory's, what its entry reads
// of the experiment the position holds, named in a line, and until its
// approval the spawning topic's record and log (experiment-entry.cjs);
// discussion's names the topic's record, its brief and its log (24.2.1–
// 24.2.3), and a bugfix investigation's the same, its log the
// investigation (19.4.3);
// discovery's, at an epic, the unit's map, the open log, each section of
// the product's sessions its first log points at and the points from before
// it carries (from-before.cjs), and at the product's
// conversation its open log (24.2.8, 8.14.6) — the latest on disk where
// none is open — or, once its picture is written, the picture, the log
// named only to be caught up; specification's, at the unit whatever topic
// its place names, what its entry reads to carry it on — an epic's each live topic's
// record, each topic's log, the unit's own record, the canonical assets, then the spec once written and the cut once cut,
// and while the person's review page is open, its address and where its
// marks are read back to (spec-entry.cjs), the spec keeping no log;
// implementation's, once the unit's build has begun, what its entry reads
// to carry it on — the entries affected and the unit's record by their
// calls, the build's log, and where the build stands, its tasks in flight
// and its questions waiting (build-entry.cjs, 12.1.6, 24.2.2), a
// quick-fix's, in the quick-fix's own skill, what its arm reads, its change
// and its fixes; and the
// review phase's, of a unit whose build runs by its cut, what its entry
// reads, its fix tasks in flight among it (review-entry.cjs).
// ---------------------------------------------------------------------------

/**
 * The skill that runs the work at a place — a phase's own for the unit's
 * work type, a quick-fix's implementation its own skill; discovery's, which
 * the product's conversation is too; a project place's; or, at an epic with
 * no phase, its menu's — null at any other unit's, and at a phase no
 * conversation works in: a phase no type's pipeline holds.
 * @param {string} name @param {string} [phase] @param {string} [type] the unit's work type
 * @returns {string|null}
 */
function skillAt(name, phase, type) {
  if (phase === undefined) {
    if (!PROJECT_IDENTITIES.includes(name)) return type === 'epic' ? EPIC_MENU_SKILL : null;
    return name === PRODUCT ? 'ledger-discovery' : `ledger-${name}`;
  }
  if (phase === 'discovery') return 'ledger-discovery';
  const skill = phaseSkill(phase, type);
  return HANDOFF_TARGETS.includes(skill) ? skill : null;
}

/** @param {string} skill */
const skillFile = (skill) => `.claude/skills/${skill}/SKILL.md`;

/**
 * The session log a place's session writes: the open one the marker names,
 * else the latest on disk.
 * @param {string} dir absolute @param {unknown} active
 * @returns {string[]}
 */
function sessionLog(dir, active) {
  if (typeof active === 'string' && /^\d+$/.test(active)) return [path.join(dir, `session-${active}.md`)];
  const latest = latestSessionLog(dir);
  return latest === null ? [] : [path.join(dir, latest.file)];
}

/** A task in flight's internal id, `{topic}-{phase}-{n}`. @param {string} topic @param {InFlight} inFlight */
function internalIdOf(topic, { task }) {
  return `${topic}-${task.replace('.', '-')}`;
}

/**
 * The laboratory's note, carried whole, as its entry reads it
 * (experiment-entry.cjs): the experiment the position holds, its documents
 * and its splits', and until the approval the spawning topic's record and
 * log.
 * @param {string} cwd @param {string} unit @param {string} topic @param {Record<string, any>} manifest @param {string|undefined} record
 * @returns {Omit<Work, 'skill'>}
 */
function labWork(cwd, unit, topic, manifest, record) {
  // Required here, as the laboratory's entry reaches this module through the
  // way onto a menu.
  const { calls, documents, lines } = record === undefined
    ? { calls: [], documents: [], lines: [] }
    : require('./experiment-entry.cjs').labRecovery(cwd, unit, topic, manifest, record);
  return { documents, whole: { calls, log: null, lines } };
}

/**
 * The product's session the project manifest marks open, or null.
 * @param {string} cwd @returns {string|null}
 */
function productActive(cwd) {
  const project = loadProjectManifest(cwd);
  return isObject(project) ? productSession(project) : null;
}

/**
 * What carries the work on at a position: the skill that runs it, and the
 * topic's documents, whether or not they exist — neither at a work unit's
 * menu; and, where the place has any, the engine calls it re-reads and the
 * log its conversation keeps.
 * @typedef {{skill: string|null, documents: string[], whole?: {calls: string[], log: string|null, picture?: string, lines?: string[]}}} Work
 */

/**
 * A discovery home's note, carried whole: its calls, its log — the open
 * one, else the latest on disk — read and caught up, and what it re-reads
 * beside the log.
 * @param {string} skill @param {string[]} calls @param {string[]} log @param {string[]} [beside]
 * @returns {Work}
 */
function discoveryWork(skill, calls, log, beside = []) {
  return { skill, documents: [...log, ...beside], whole: { calls, log: log[0] ?? null } };
}

/**
 * The product's conversation's note: once its picture is written, the
 * picture re-read, then the log and the picture caught up; else its log, as
 * any home's.
 * @param {string} cwd @param {string} skill @returns {Work}
 */
function productWork(cwd, skill) {
  const log = sessionLog(statePath(cwd, PRODUCT_SESSIONS), productActive(cwd));
  const picture = statePath(cwd, PRODUCT_PICTURE);
  return fs.existsSync(picture) ? { skill, documents: [picture], whole: { calls: [], log: log[0] ?? null, picture } } : discoveryWork(skill, [], log);
}

/**
 * Each section of the product's sessions an epic's first log points at,
 * `{path}#{anchor}` (discovery-entry.cjs).
 * @param {string} dir the epic's discovery folder, absolute @returns {string[]}
 */
function shapingSections(dir) {
  // Required here, as discovery-entry.cjs requires this module.
  const { shapedBy } = require('./discovery-entry.cjs');
  const first = sessionLogs(dir)[0];
  return first === undefined ? [] : shapedBy(path.join(dir, first.file));
}

/**
 * A decided topic's note, entered for its affected entries alone
 * (topic-standing.cjs): a topic's, with the call reading those entries, and
 * where the conversation goes once each is answered.
 * @param {{calls: string[], log: string}} whole the topic's note @param {string} unit @param {string} topic
 * @returns {{calls: string[], log: string, lines: string[]}}
 */
function staysDecidedWhole(whole, unit, topic) {
  return {
    ...whole,
    calls: [...whole.calls, ledgerView('affected', unit, topic)],
    lines: ['The topic stays decided, entered for its affected entries alone: once each is confirmed or replaced, the conversation hands back to the epic\'s menu.'],
  };
}

/**
 * A build's note, carried whole, as its entry reads it (build-entry.cjs):
 * the ledger's calls, the build's log, and where the build stands, with
 * the tasks in flight of the conversation the note is for.
 * @param {string} cwd @param {string} unit @param {InFlight[]} inFlight @param {string} sessionId @returns {Omit<Work, 'skill'>}
 */
function buildWork(cwd, unit, inFlight, sessionId) {
  // Required here, as the build's entry puts its tasks in flight through
  // this module.
  const { calls, documents, lines } = require('./build-entry.cjs').buildRecovery(cwd, unit, inFlight, sessionId);
  return { documents, whole: { calls, log: null, lines } };
}

/**
 * The review phase's note, carried whole, as its entry reads it
 * (review-entry.cjs): the record's call, each round's report, the spec, the
 * build's log, and where the phase stands, with the fix tasks in flight of
 * the conversation the note is for.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {InFlight[]} inFlight @param {string} sessionId @returns {Omit<Work, 'skill'>}
 */
function reviewWork(cwd, unit, manifest, inFlight, sessionId) {
  // Required here, as the review phase's entry reaches this module through
  // the build's.
  const { calls, documents, lines } = require('./review-entry.cjs').reviewRecovery(cwd, unit, manifest, inFlight, sessionId);
  return { documents, whole: { calls, log: null, lines } };
}

/**
 * What the conversation `sessionId`, at `position`, re-reads; in a phase
 * whose entry names the reference on decisions from before Ledger, that
 * line beside it, where the work holds one (decisions-from-before.cjs).
 * @param {string} cwd @param {Position} position @param {Manifest} manifest @param {string} sessionId
 * @returns {Work}
 */
function workAt(cwd, position, manifest, sessionId) {
  const work = placeWork(cwd, position, manifest, sessionId);
  if (work.whole === undefined || position.phase === undefined) return work;
  // Required here, as the ledger's read it makes reaches this module.
  const { fromBeforeLines } = require('./decisions-from-before.cjs');
  const noted = fromBeforeLines(cwd, position.phase, position.name, []).map(([key, value]) => `${key}: ${value}`);
  return noted.length === 0 ? work : { ...work, whole: { ...work.whole, lines: [...(work.whole.lines ?? []), ...noted] } };
}

/**
 * What the conversation `sessionId`, at `position`, re-reads of the place
 * itself.
 * @param {string} cwd @param {Position} position @param {Manifest} manifest @param {string} sessionId
 * @returns {Work}
 */
function placeWork(cwd, position, manifest, sessionId) {
  const { name, phase } = position;
  const skill = skillAt(name, phase, typeof manifest?.work_type === 'string' ? manifest.work_type : undefined);
  if (skill === null) return { skill: null, documents: [] };
  if (phase === undefined) {
    if (name === PRODUCT) return productWork(cwd, skill);
    if (name === ROADMAP) return { skill, documents: [] };
    return { skill, documents: [], whole: { calls: [], log: null } };
  }
  if (manifest === null) return { skill: null, documents: [] };
  const wu = statePath(cwd, name);
  const topic = /** @type {string} */ (position.topic);
  switch (phase) {
    case 'discovery':
      return discoveryWork(skill, [mapCall(name)], sessionLog(path.join(wu, 'discovery'), phaseData(manifest, 'discovery').active_session), [...shapingSections(path.join(wu, 'discovery')), path.join(wu, FROM_BEFORE)]);
    case 'discussion':
    case 'investigation': {
      const log = statePath(cwd, topicLog(name, topic));
      const whole = { calls: [recordCall(name, topic)], log };
      const stays = phase === 'discussion' && staysDecided({ cwd, phase, unit: name, topic, manifest });
      return { skill, documents: [statePath(cwd, briefFile(name, topic)), log], whole: stays ? staysDecidedWhole(whole, name, topic) : whole };
    }
    case 'specification': {
      // Required here, as the ledger read it makes requires this module; a
      // compaction's note has no reader for what that read says.
      const { specSources } = require('./spec-entry.cjs');
      const { records, logs, assets, spec, cut, page } = specSources(cwd, manifest, []);
      const open = page === null ? [] : [`The review page is open at ${page.url}; its marks are read back into ${page.readBack}.`];
      return { skill, documents: [...logs, ...assets, ...spec], whole: { calls: [...records, ...cut], log: null, lines: open } };
    }
    case 'experiment':
      return { skill, ...labWork(cwd, name, topic, /** @type {Record<string, any>} */ (manifest), position.record) };
    case 'implementation':
      return { skill, ...buildWork(cwd, name, position.tasks ?? [], sessionId) };
    case 'review':
      return { skill, ...reviewWork(cwd, name, manifest, position.tasks ?? [], sessionId) };
    default:
      return { skill: null, documents: [] };
  }
}

/**
 * Where the position is, named for the conversation — the work unit by its
 * work type where the project has it.
 * @param {Position} position @param {Manifest} manifest
 */
function placeName(position, manifest) {
  const { name, phase, topic } = position;
  if (isProjectPlace(name, phase)) return name === PRODUCT ? 'the product\'s conversation' : `the project's ${name}`;
  const unit = typeof manifest?.work_type === 'string' ? `the ${manifest.work_type} "${name}"` : `"${name}"`;
  if (phase === undefined) return unit;
  const at = topic === name ? `the ${phase} of ${unit}` : `the ${phase} of "${topic}" in ${unit}`;
  const tasks = (position.tasks ?? []).map((t) => taskNamed(/** @type {string} */ (topic), t));
  if (tasks.length === 0) return at;
  return tasks.length === 1 ? `${at}, on ${tasks[0]}` : `${at}, on ${tasks.length} tasks: ${tasks.join('; ')}`;
}

/**
 * A task in flight as the note names it: its step and internal id, then its
 * builder and its reviewers, where recorded, by their agent ids — what a fix
 * round or a re-review is sent back to (24.2.4, 13.3.3).
 * @param {string} topic @param {InFlight} inFlight
 */
function taskNamed(topic, inFlight) {
  const { task, builder, reviewers } = inFlight;
  const code = (/** @type {string} */ id) => `\`${id}\``;
  return [
    `task ${task} (internal id ${code(internalIdOf(topic, inFlight))})`,
    ...(builder === null ? [] : [`its builder agent ${code(builder)}`]),
    ...(reviewers.length === 0 ? [] : [`its reviewer agent${reviewers.length === 1 ? '' : 's'} ${reviewers.map(code).join(' and ')}`]),
  ].join(', ');
}

/**
 * A position as one line — the work unit, its phase and its topic, the topic
 * left out where it is the work unit.
 * @param {Position} position @param {string} separator @returns {string}
 */
function placeLine({ name, phase, topic }, separator) {
  return [name, phase, topic === name ? undefined : topic]
    .filter(/** @returns {word is string} */ (word) => typeof word === 'string')
    .join(separator);
}

/**
 * Why a work unit's place is no longer open to carry on from, or null where
 * it is: the work unit gone from this project or closed, its spec concluded
 * at the spec's place, its build not to be entered at the build's places
 * (P12) — a quick-fix's review not until the person asks for one — the
 * place's item closed, or — in a phase a topic on the map holds — the topic
 * cancelled or postponed.
 * @param {Position} position @param {Manifest} manifest
 * @returns {string|null}
 */
function closedReason(position, manifest) {
  const { name, phase, topic } = position;
  if (isProjectPlace(name, phase)) return null;
  if (manifest === null) return `this project has no work unit "${name}"`;
  if (manifest.status !== 'in-progress') return `"${name}" is ${typeof manifest.status === 'string' ? manifest.status : 'not in progress'}`;
  if (phase === 'specification' && buildBegun(manifest)) return 'its spec is concluded';
  if (phase !== undefined && BUILD_PLACES.includes(phase)) {
    const refused = buildRefusal(manifest) ?? (phase === 'review' ? quickFixReviewRefusal(manifest) : null);
    if (refused !== null) return refused;
  }
  if (phase === undefined || typeof topic !== 'string') return null;
  const status = isTopicPhase(phase) ? itemOf(manifest, phase, topic)?.status : undefined;
  if (typeof status === 'string' && TERMINAL_STATUSES.includes(status)) return `the ${phase} is ${status}`;
  if (!MAP_PHASES.includes(phase)) return null;
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  return lifecycle === 'cancelled' || lifecycle === 'postponed' ? `the topic is ${lifecycle}` : null;
}

/**
 * The lines a whole note gives the log its conversation keeps, and the
 * product's picture with it where one is given: caught up from the
 * conversation's transcript, or the transcript's loss said in one line; and
 * the line the conversation's next write to the log opens with, where it has
 * not written there yet or another conversation has since.
 * @param {string} log absolute @param {string} sessionId @param {string} [picture] absolute
 */
function logLines(log, sessionId, picture) {
  const transcript = runningTranscript(sessionId);
  const header = owedHeader(log, sessionId, transcript);
  const written = namedConversations(log).some((conversation) => conversation.session === sessionId);
  const caught = picture === undefined ? `the log, ${log},` : `the log, ${log}, and the picture, ${picture},`;
  return [
    transcript === null
      ? `This conversation's transcript cannot be found: say so in one line, and carry on from ${picture === undefined ? 'the log' : `the log, ${log}, and the picture, ${picture}`}.`
      : `Catch ${caught} up from this conversation's transcript, ${transcript}, from the log's last write onward.`,
    ...(header === null ? [] : [written
      ? `Another conversation has written to the log since this one did: its next write opens with this line again: \`${header}\``
      : `This conversation has not written to the log yet: its first write opens with this line: \`${header}\``]),
  ];
}

/** A document's line in the note: a section of one named as that section, read alone. @param {string} file absolute */
function fileLine(file) {
  const at = file.indexOf('#');
  return at === -1 ? `- ${file}` : `- ${file.slice(0, at)}, its section \`${file.slice(at)}\` alone`;
}

/**
 * The note: the skill and what its Instructions section loads re-read, then the place's engine
 * calls and its documents; what else the phase holds open, a line each; its
 * log, where it keeps one, caught up (`logLines`); and the conversation
 * carried on.
 * @param {string} where @param {string} skill absolute @param {string[]} calls @param {string[]} files absolute
 * @param {string|null} log absolute @param {string} sessionId @param {string[]} [lines] @param {string} [picture] absolute, caught up with the log
 */
function wholeNote(where, skill, calls, files, log, sessionId, lines = [], picture = undefined) {
  return [
    `${COMPACTED} This conversation is working in ${where}. Before anything else, re-read these in full, running each engine call:`,
    `- ${skill} and what its Instructions section loads`,
    ...calls.map((c) => `- \`${c}\``),
    ...files.map(fileLine),
    ...lines,
    ...(log === null ? [] : logLines(log, sessionId, picture)),
    'Then carry on from where the conversation was, as if the break never happened — no recap and no announcement.',
  ].join('\n');
}

/**
 * @typedef {object} PositionReads
 * @property {string} session_id
 * @property {Position|null} position
 * @property {string|null} place  the position as one line; null where there is none
 * @property {string|null} skill  the skill that runs the work there, by absolute path; null where nothing carries on
 * @property {string[]} files     the topic's documents this project has, by absolute path, a section of one by its anchor, read after the skill
 * @property {string} text        the note naming where the conversation is and what to re-read
 */

/**
 * What the conversation `sessionId` re-reads to carry on from its position —
 * only what this project has of it, each file by its absolute path under the
 * project root, so a conversation with nothing else in context never guesses
 * the root — and the note the gate mod appends to the conversation's
 * compaction, composed here so the mod hands it on unchanged. No position, a
 * work unit's menu, and a place no longer open carry nothing on.
 * @param {string} cwd @param {string} sessionId @returns {PositionReads}
 */
function positionReads(cwd, sessionId) {
  const position = readPosition(sessionId);
  const place = position === null ? null : placeLine(position, PLACE_SEPARATOR);
  /** @param {string} text @returns {PositionReads} */
  const nothing = (text) => ({ session_id: sessionId, position, place, skill: null, files: [], text });
  if (position === null && carriesMigration(cwd, sessionId)) {
    const skill = path.resolve(codeRoot(cwd), skillFile(START_SKILL));
    return { session_id: sessionId, position, place, skill, files: [], text: wholeNote('the migration', skill, [], [], null, sessionId, [MIGRATION_BOOT]) };
  }
  if (position === null) return nothing('This conversation holds no position in Ledger, so there is nothing to carry on from.');
  const isUnit = !isProjectPlace(position.name, position.phase) && illegalNameReason('work unit', position.name) === null;
  /** @type {Manifest} */
  const manifest = isUnit ? loadManifest(cwd, position.name) : null;
  const where = placeName(position, manifest);
  const closed = closedReason(position, manifest);
  if (closed !== null) return nothing(`This conversation was working in ${where}, but ${closed}, so there is nothing to carry on from.`);
  const work = workAt(cwd, position, manifest, sessionId);
  if (work.skill === null) return nothing(`This conversation is at ${where}, outside any phase, so there is nothing to carry on from.`);
  const root = codeRoot(cwd);
  const absolute = (/** @type {string} */ f) => path.resolve(root, f);
  const skill = absolute(skillFile(work.skill));
  if (!fs.existsSync(skill)) return nothing(`This conversation was working in ${where}, but this project has no ${work.skill} skill, so there is nothing to carry on from.`);
  const files = [...new Set(work.documents)].map(absolute).filter((f) => fs.existsSync(f.split('#')[0]));
  const { calls, log, lines, picture } = work.whole ?? { calls: [], log: null };
  const text = wholeNote(where, skill, calls, files, log, sessionId, lines, picture);
  return { session_id: sessionId, position, place, skill, files, text };
}

/**
 * `conversation position`'s answer: the note, and all of it as one line of
 * JSON for the gate mod.
 * @param {PositionReads} reads @returns {string}
 */
function positionSections(reads) {
  return dataSection([reads.text]) + section('POSITION', GATE_MOD_INSTRUCTION, JSON.stringify(reads));
}

module.exports = {
  readPosition, assertPlace, isPlace, recordPosition, recordTask, recordTasksAt, recordBuilder, recordWorktree, recordStop, clearStop, clearTask, clearTasks, leavePosition, dropPosition, leaveUnit, keepCameFrom, forgetCameFrom, takeCameFrom,
  placeLine, skillAt, positionReads, positionSections,
};
