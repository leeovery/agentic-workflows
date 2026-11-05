'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's position — where in the workflows a
// conversation is working, kept as `position.json` in its folder
// (conversation.cjs) for whatever carries the conversation on: the tmux
// label's resume (session-label.cjs), the gate mod's spinner, and
// `conversation position`, the note the gate mod appends to a compaction,
// naming what to re-read to carry on there.
//
// Every place records itself on arrival, through the calls that label it,
// labels on or off: a phase's entry (`enter`, or `session label {wu}
// {phase} {topic}` inside a phase not yet entered through it),
// `session label {wu}` at a work unit's menu, `session label
// roadmap|product` at the project-level places — a place this project lacks
// is refused before anything is labelled or recorded. Inside a unit's build
// the position holds every task in flight there (4.11.14, 24.2.4) — at its
// implementation, or at its review phase, whose fix tasks the same loop
// builds (14.3.2). The tracker's `task start` adds one where the
// conversation is at either of the unit's, the place kept, else at the
// unit's review for a task of one of its fix phases and its implementation
// for any other, and its `task done` and `task close` take it off
// (task-verbs.cjs); an entry into either puts the tasks another
// conversation left in flight there, as the conversation arrives
// (build-entry.cjs). A `task start` re-run for a task already in flight
// keeps it as it stands; a re-label of the same place keeps them all, a move
// between the unit's implementation and its review phase carries them, and
// any other place leaves none. The gate mod's `conversation builder`
// records the agent id of a builder or a reviewer it saw dispatched against
// the task its brief was issued for (brief-names.cjs), only while that task
// is in flight: the builder's replacing any before it, each reviewer's
// joining the pair the later rounds go back to (13.3.3). `task worktree`
// records the worktree it laid out for a task in flight (task-worktree.cjs),
// and `task stopped` when its builder stopped, unable to build past a
// problem (task-verbs.cjs), its first stop kept; the task's next builder's
// or fix round's brief (brief.cjs), or a raise parking it (raise.cjs), takes
// the stop off.
// They ride with their task and go with it. The start menu is no position:
// boot drops the calling conversation's own before anything else it does,
// keeping the place it left where that names a phase, until a position is
// recorded again; and `session repair` drops it too.
//
// The engine is the file's one writer, and writes only for a conversation
// that runs the workflows: recording a position marks the conversation first
// (conversation.cjs — a session id, a call run in a workflows project), since
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
const { PRODUCT, PROJECT_IDENTITIES, TERMINAL_STATUSES, VALID_PHASES, illegalNameReason } = require('../kernel/manifest-schema.cjs');
const { LOCK_TIMEOUT_MS, isObject, withStateLockFile, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { positionPath, leftPath, readPosition, isMarked, markConversation, runningTranscript } = require('./conversation.cjs');
const { ROLES, issuedOf } = require('./brief-names.cjs');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { buildBegun, buildRefusal, isFixPhase, computeTopicLifecycle, itemOf, openRecords, phaseData, UNIT_PHASES } = require('./derivations.cjs');
const { recordDir } = require('./experiment-paths.cjs');
const { latestSessionLog, productSession } = require('./discovery-session.cjs');
const { PRODUCT_SESSIONS } = require('./layout.cjs');
const { phaseSkill, HANDOFF_TARGETS } = require('./handoff.cjs');
const { stepOfId, shownTask } = require('./task-id.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');
const { section, dataSection, GATE_MOD_INSTRUCTION } = require('./projections/surfaces.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { topicLog, recordCall, mapCall, owedHeader, namedConversations } = require('./topic-log.cjs');

const COMPACTED = 'The conversation was just compacted.';

const PLACE_SEPARATOR = ' › ';

// The phases under a topic on an epic's discovery map — the Discovery unit's,
// its experiment series riding along: a cancel or a postpone of the topic is
// recorded on its map row, whatever each item reads.
const MAP_PHASES = [...UNIT_PHASES.discovery, 'experiment'];

const ROADMAP = 'roadmap';

/** @typedef {import('./conversation.cjs').Position} Position */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */

/** @typedef {Record<string, unknown>|null} Manifest  a work unit's manifest; null where the project has none */

const POSITION_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the conversation\'s position' };

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
 * The calling conversation, marked first: arriving at a place is running the
 * workflows. Null where no mark stands — no session id, a call run outside a
 * workflows project, a mark that could not be written.
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
 * recorded, or null to write nothing. Whether it was written.
 * @param {string} sessionId @param {(prior: Position|null) => Position|null} change @returns {boolean}
 */
function updatePosition(sessionId, change) {
  return underPositionLock(sessionId, (file) => {
    const next = change(readPosition(sessionId));
    if (next === null) return false;
    writeJsonAtomic(file, next);
    fs.rmSync(leftPath(sessionId), { force: true });
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
 * The tasks in flight a position holds at `place` — at either of a unit's
 * build places for the other, which its tasks ride between; none where it
 * is elsewhere.
 * @param {Position|null} prior @param {Position} place @returns {InFlight[]}
 */
function tasksAt(prior, place) {
  if (prior === null || prior.name !== place.name || prior.topic !== place.topic) return [];
  return prior.phase === place.phase || (inBuild(prior) && inBuild(place)) ? prior.tasks ?? [] : [];
}

/** The plan step an internal id ends in, `{phase}.{task}`. @param {string} internalId @returns {string|null} */
function taskStep(internalId) {
  const step = stepOfId(internalId);
  return step === null ? null : shownTask(step);
}

/**
 * Record the calling conversation's arrival at a place `assertPlace` passed.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function recordPosition(cwd, name, phase, topic) {
  const own = arrivingConversation(cwd);
  if (!own) return;
  /** @type {Position} */
  const position = phase === undefined ? { name } : { name, phase, topic };
  updatePosition(own, (prior) => (BUILD_PLACES.includes(phase ?? '') ? withTasks(position, tasksAt(prior, position)) : position));
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
  updatePosition(own, (prior) => {
    const place = startedAt(cwd, prior, workUnit, step);
    return withTasks(place, joined(tasksAt(prior, place), [step]));
  });
}

/**
 * Record the tasks an entry into the unit's build or its review phase puts
 * in flight on the calling conversation, at that place, beside those there
 * — each kept as it stands where it is one of them (build-entry.cjs).
 * @param {string} cwd @param {string} workUnit @param {'implementation'|'review'} phase @param {string[]} steps each `{phase}.{n}`
 */
function recordTasksAt(cwd, workUnit, phase, steps) {
  const own = arrivingConversation(cwd);
  if (!own || steps.length === 0) return;
  const place = { name: workUnit, phase, topic: workUnit };
  updatePosition(own, (prior) => withTasks(place, joined(tasksAt(prior, place), steps)));
}

/**
 * Where a dispatch's agent goes on the position: the task it is for, at the
 * place that task is in flight, and which of the task's agents it is — the
 * task its brief was issued for, a builder's or a reviewer's by the agent
 * it was issued for. Null where it goes nowhere.
 * @param {string} sessionId @param {Position|null} prior @param {string} briefId
 * @returns {{place: Position, task: string, slot: 'builder'|'reviewers'}|null}
 */
function dispatchedFor(sessionId, prior, briefId) {
  const issued = issuedOf(sessionId, briefId);
  if (issued === null || !Object.hasOwn(SLOTS, issued.agent) || issued.unit === null || issued.task === null) return null;
  return { place: buildPlaceOf(prior, issued.unit) ?? implementationOf(issued.unit), task: issued.task, slot: SLOTS[issued.agent] };
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
      const at = dispatchedFor(sessionId, prior, briefId);
      const held = at === null ? [] : tasksAt(prior, at.place);
      if (at === null || !held.some((t) => t.task === at.task)) return null;
      return withTasks(at.place, held.map((t) => (t.task === at.task ? withAgent(t, at.slot, agentId) : t)));
    }),
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
  const written = updatePosition(sessionId, (prior) => {
    const place = buildPlaceOf(prior, workUnit) ?? implementationOf(workUnit);
    const tasks = tasksAt(prior, place);
    held = tasks.find((t) => t.task === step) ?? null;
    const changed = held === null ? null : change(held);
    return changed === null ? null : withTasks(place, tasks.map((t) => (t.task === step ? changed : t)));
  });
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
 * Take a task that ended off the position, its agents with it — only the
 * one it names, where the unit's tasks are in flight.
 * @param {string} workUnit @param {string} internalId
 */
function clearTask(workUnit, internalId) {
  const own = ownConversation();
  if (!own) return;
  const step = taskStep(internalId);
  updatePosition(own, (prior) => {
    const place = buildPlaceOf(prior, workUnit) ?? implementationOf(workUnit);
    const held = tasksAt(prior, place);
    return held.some((t) => t.task === step) ? withTasks(place, held.filter((t) => t.task !== step)) : null;
  });
}

/**
 * The conversation `sessionId` leaves its position for the start menu, the
 * place left kept where it names a phase, else none (conversation.cjs).
 * @param {string|null|undefined} sessionId
 */
function leavePosition(sessionId) {
  if (!sessionId) return;
  underPositionLock(sessionId, (file) => {
    const prior = readPosition(sessionId);
    if (prior?.phase === undefined) fs.rmSync(leftPath(sessionId), { force: true });
    else writeJsonAtomic(leftPath(sessionId), { name: prior.name, phase: prior.phase });
    fs.rmSync(file, { force: true });
    return true;
  });
}

/** @param {string|null|undefined} sessionId */
function dropPosition(sessionId) {
  if (!sessionId) return;
  underPositionLock(sessionId, (file) => {
    fs.rmSync(file, { force: true });
    return true;
  });
}

// ---------------------------------------------------------------------------
// What a conversation re-reads to carry on from its position: the skill that
// runs the work there, then the topic's documents. A work unit's menu carries
// nothing on, so it names neither; nor does a place this project no longer
// has open — the work unit gone or closed, the item closed, a topic on the
// map cancelled or postponed, a spec concluded — nor one whose skill this
// project lacks. A phase whose skill carries no recovery section of its own
// has the note carry it whole (24.2.6), naming the engine calls it re-reads
// beside its documents and the log its conversation keeps, where it keeps
// one, which is caught up from the conversation's transcript (8.14.9):
// discussion's names the topic's record and its log (24.2.1–24.2.3), and a
// bugfix investigation's the same, beside the document its skill writes
// today, `investigation/{topic}.md` (19.4.3);
// discovery's, at an epic, the unit's map and the open log, and at the
// product's conversation its open log (24.2.8, 8.14.6) — the latest on disk
// where none is open; specification's, at the unit whatever topic its place
// names, what its entry reads to carry it on — each live topic's record and
// log, the unit's own record, the canonical assets, then the spec once written and the cut once cut,
// and while the person's review page is open, its address and where its
// marks are read back to (spec-entry.cjs), the spec keeping no log;
// implementation's, once the unit's build has begun, what its entry reads
// to carry it on — the entries affected and the unit's record by their
// calls, the build's log, and where the build stands, its tasks in flight
// and its questions waiting (build-entry.cjs, 12.1.6, 24.2.2); and the
// review phase's, of a unit whose build runs by its cut, what its entry
// reads, its fix tasks in flight among it (review-entry.cjs). Every other
// phase's note sends Claude to its skill's own steps, with its documents.
// ---------------------------------------------------------------------------

/**
 * The skill that runs the work at a place — a phase's own, discovery's,
 * which the product's conversation is too, or a project place's; null at a
 * work unit's menu, and at a phase no conversation works in: planning,
 * whose items are scoping's.
 * @param {string} name @param {string} [phase] @returns {string|null}
 */
function skillAt(name, phase) {
  if (phase === undefined) {
    if (!PROJECT_IDENTITIES.includes(name)) return null;
    return name === PRODUCT ? 'leeway-discovery' : `leeway-${name}`;
  }
  if (phase === 'discovery') return 'leeway-discovery';
  const skill = phaseSkill(phase);
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
 * Each live experiment record's files, in register order; none from a
 * series whose records do not resolve to their directories.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
function experimentFiles(cwd, workUnit, topic, manifest) {
  const experiments = itemOf(manifest, 'experiment', topic)?.experiments;
  try {
    return openRecords(manifest, topic).flatMap((id) => {
      const dir = statePath(cwd, recordDir(workUnit, topic, id, experiments));
      return ['problem.md', 'design.md', 'report.md'].map((f) => path.join(dir, f));
    });
  } catch {
    return [];
  }
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
 * The log of the product's open session; none where no session is open.
 * @param {string} cwd @returns {string[]}
 */
function productSessionLog(cwd) {
  const active = productActive(cwd);
  return active === null ? [] : sessionLog(statePath(cwd, PRODUCT_SESSIONS), active);
}

/**
 * What carries the work on at a position: the skill that runs it, and the
 * topic's documents, whether or not they exist — neither at a work unit's
 * menu; and, for a phase whose note carries its recovery whole, the engine
 * calls it re-reads and the log its conversation keeps, where it keeps one.
 * @typedef {{skill: string|null, documents: string[], whole?: {calls: string[], log: string|null, lines?: string[]}}} Work
 */

/**
 * A discovery home's note, carried whole: its calls, and its log — the open
 * one, else the latest on disk — read and caught up.
 * @param {string} skill @param {string[]} calls @param {string[]} log
 * @returns {Work}
 */
function discoveryWork(skill, calls, log) {
  return { skill, documents: log, whole: { calls, log: log[0] ?? null } };
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
 * What the conversation `sessionId`, at `position`, re-reads.
 * @param {string} cwd @param {Position} position @param {Manifest} manifest @param {string} sessionId
 * @returns {Work}
 */
function workAt(cwd, position, manifest, sessionId) {
  const { name, phase } = position;
  const skill = skillAt(name, phase);
  if (skill === null) return { skill: null, documents: [] };
  if (phase === undefined) {
    if (name === PRODUCT) return discoveryWork(skill, [], sessionLog(statePath(cwd, PRODUCT_SESSIONS), productActive(cwd)));
    return { skill, documents: name === ROADMAP ? productSessionLog(cwd) : [] };
  }
  if (manifest === null) return { skill: null, documents: [] };
  const wu = statePath(cwd, name);
  const topic = /** @type {string} */ (position.topic);
  const plan = path.join(wu, 'planning', topic);
  switch (phase) {
    case 'discovery':
      return discoveryWork(skill, [mapCall(name)], sessionLog(path.join(wu, 'discovery'), phaseData(manifest, 'discovery').active_session));
    case 'discussion': {
      const log = statePath(cwd, topicLog(name, topic));
      return { skill, documents: [log], whole: { calls: [recordCall(name, topic)], log } };
    }
    case 'investigation': {
      const log = statePath(cwd, topicLog(name, topic));
      return { skill, documents: [log, statePath(cwd, INDEXED_ARTIFACTS.investigation(name, topic))], whole: { calls: [recordCall(name, topic)], log } };
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
      return { skill, documents: experimentFiles(cwd, name, topic, manifest) };
    case 'scoping':
      return { skill, documents: [path.join(wu, 'specification', topic, 'specification.md'), path.join(plan, 'planning.md')] };
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
 * (P12), the place's item closed, or — in a phase a topic on the map holds —
 * the topic cancelled or postponed.
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
    const refused = buildRefusal(manifest);
    if (refused !== null) return refused;
  }
  if (phase === undefined || typeof topic !== 'string') return null;
  const status = itemOf(manifest, phase, topic)?.status;
  if (typeof status === 'string' && TERMINAL_STATUSES.includes(status)) return `the ${phase} is ${status}`;
  if (!MAP_PHASES.includes(phase)) return null;
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  return lifecycle === 'cancelled' || lifecycle === 'postponed' ? `the topic is ${lifecycle}` : null;
}

/**
 * The note naming where the conversation is working and what to re-read
 * there, in full, before anything else — the skill's own recovery steps.
 * @param {string} where @param {string} skillName @param {string} skill @param {string[]} files
 */
function carryOnText(where, skillName, skill, files) {
  const follow = `${COMPACTED} This conversation is working in ${where}. Follow the ${skillName} skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${skill} and its framework in full`;
  return files.length > 0 ? [`${follow}, then re-read these in full:`, ...files.map((f) => `- ${f}`)].join('\n') : `${follow}.`;
}

/**
 * The lines a whole note gives the log its conversation keeps: caught up
 * from the conversation's transcript, or the transcript's loss said in one
 * line; and the line the conversation's next write to it opens with, where
 * it has not written there yet or another conversation has since.
 * @param {string} log absolute @param {string} sessionId
 */
function logLines(log, sessionId) {
  const transcript = runningTranscript(sessionId);
  const header = owedHeader(log, sessionId, transcript);
  const written = namedConversations(log).some((conversation) => conversation.session === sessionId);
  return [
    transcript === null
      ? 'This conversation\'s transcript cannot be found: say so in one line, and carry on from the log.'
      : `Catch the log, ${log}, up from this conversation's transcript, ${transcript}, from the log's last write onward.`,
    ...(header === null ? [] : [written
      ? `Another conversation has written to the log since this one did: its next write opens with this line again: \`${header}\``
      : `This conversation has not written to the log yet: its first write opens with this line: \`${header}\``]),
  ];
}

/**
 * The note for a phase that carries its recovery whole: the skill and its
 * framework re-read, then its engine calls and its documents; what else the
 * phase holds open, a line each; its log, where it keeps one, caught up
 * (`logLines`); and the conversation carried on.
 * @param {string} where @param {string} skill absolute @param {string[]} calls @param {string[]} files absolute
 * @param {string|null} log absolute @param {string} sessionId @param {string[]} [lines]
 */
function wholeNote(where, skill, calls, files, log, sessionId, lines = []) {
  return [
    `${COMPACTED} This conversation is working in ${where}. Before anything else, re-read these in full, running each engine call:`,
    `- ${skill} and its framework`,
    ...calls.map((c) => `- \`${c}\``),
    ...files.map((f) => `- ${f}`),
    ...lines,
    ...(log === null ? [] : logLines(log, sessionId)),
    'Then carry on from where the conversation was, as if the break never happened — no recap and no announcement.',
  ].join('\n');
}

/**
 * @typedef {object} PositionReads
 * @property {string} session_id
 * @property {Position|null} position
 * @property {string|null} place  the position as one line; null where there is none
 * @property {string|null} skill  the skill that runs the work there, by absolute path; null where nothing carries on
 * @property {string[]} files     the topic's documents this project has, by absolute path, read after the skill
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
  if (position === null) return nothing('This conversation holds no workflow position, so there is nothing to carry on from.');
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
  const files = [...new Set(work.documents)].map(absolute).filter((f) => fs.existsSync(f));
  const text = work.whole === undefined
    ? carryOnText(where, work.skill, skill, files)
    : wholeNote(where, skill, work.whole.calls, files, work.whole.log, sessionId, work.whole.lines);
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
  readPosition, assertPlace, isPlace, recordPosition, recordTask, recordTasksAt, recordBuilder, recordWorktree, recordStop, clearStop, clearTask, leavePosition, dropPosition,
  placeLine, skillAt, positionReads, positionSections,
};
