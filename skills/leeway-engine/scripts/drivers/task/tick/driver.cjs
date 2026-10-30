'use strict';

// ---------------------------------------------------------------------------
// The task driver for Tick, the default tracker (7.1.4, 7.1.6, 22.4.2).
//
// Tick finds its store by walking up from where it runs, so it runs in the
// state root, where its store is `.tick/` (7.5.2, 7.5.3), made there with
// `tick init`, which makes it where it runs, before anything else runs:
// from the state root, a walk up would find a project's own store in its
// code tree. The store's JSONL is what the state branch carries; Tick's
// cache, its lock and the temp file it renames in are local to the machine.
// A store folder without its JSONL is refused, where Tick would call it made,
// and so is a line of it that is not JSON, named by its number.
// Tick's own lock is taken inside the engine's writer lock, which every task
// verb holds.
//
// A unit is a Tick task with a phase for each phase written as its child, and
// each phase holds its tasks: Tick's parents. Each carries the engine's name
// for it in its refs — `unit:{unit}`, `phase:{unit}-{N}`, `task:{id}` — and
// the driver finds Tick's id through them, read from the store, the one
// place Tick lists refs. A ref is the engine's only where it reads as one of
// those three shapes; any other a person gives a task is theirs, and passed
// by. A name two tasks hold, or a task holding two, is refused. Every other
// read is Tick's JSON output, and Tick's own ids in a refusal it makes are
// put in the engine's words. A task's text is its description, its type its
// one tag, an addition a note naming whose it is, and a link a dependency; a
// closed task is cancelled, its reason a note. Tick counts a cancelled task,
// as a done one, as holding nothing up, and ready answers only tasks not yet
// started. Tick ends a parent itself once every child has ended — marking
// the change its own — and makes no child under a cancelled one, so a phase
// or task is made after the parents Tick ended are reopened. A parent the
// person ended, cancelled or done, is theirs: the make is refused, reopening
// nothing, and names every parent they must reopen, outermost first, the
// ones Tick ended above theirs among them.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { workUnitNameRefusal } = require('../../../kernel/manifest-schema.cjs');
const {
  taskId, stepOfId, shownTask, taskName, phaseName, unitName, FOREIGN_TASK, endedInTracker,
} = require('../../../domain/task-id.cjs');

/** @typedef {import('../../../domain/drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('../../../domain/drivers.cjs').TaskStatus} TaskStatus */
/** @typedef {import('../../../domain/task-id.cjs').TaskRef} TaskRef */
/** @typedef {{kind: 'unit', unit: string} | {kind: 'phase', unit: string, phase: number} | {kind: 'task', task: TaskRef}} Name */
/** @typedef {{byRef: Map<string, string>, byId: Map<string, Name>, ended: Map<string, 'tick'|'person'>}} Ids */

const TOOL = 'tick';
const UPDATE = 'https://github.com/leeovery/tick';
const STORE = '.tick';
const TASKS = 'tasks.jsonl';
const TIMEOUT_MS = 30000;
const CLOSED = 'Closed: ';
const ADDED = /^Added by the (orchestrator|person):\n([\s\S]*)$/;
const REF = /^(unit|phase|task):(.+)$/;
const PHASE_OF = /^(.+)-([1-9][0-9]*)$/;
const TICK_ID = /(?<![\w./-])tick-[0-9a-f]+(?![\w-])/g;

/** @type {Readonly<Record<string, TaskStatus>>} */
const STATUSES = Object.freeze({ open: 'open', in_progress: 'in-progress', done: 'done', cancelled: 'closed' });

/** @param {string} unit */
const unitRef = (unit) => `unit:${unit}`;
/** @param {string} unit @param {number} phase */
const phaseRef = (unit, phase) => `phase:${unit}-${phase}`;
/** @param {TaskRef} ref */
const taskRef = (ref) => `task:${taskId(ref)}`;

/** @param {string} unit */
const isUnit = (unit) => workUnitNameRefusal(unit) === null;

/** The engine's name a ref carries, or null where the ref is a person's. @param {string} ref @returns {Name|null} */
function nameIn(ref) {
  const [, kind, value] = REF.exec(ref) ?? [];
  if (kind === 'unit') return isUnit(value) ? { kind, unit: value } : null;
  if (kind === 'phase') {
    const [, unit, phase] = PHASE_OF.exec(value) ?? [];
    return unit !== undefined && isUnit(unit) ? { kind, unit, phase: Number(phase) } : null;
  }
  const step = kind === 'task' ? stepOfId(value) : null;
  return step !== null && isUnit(step.prefix) ? { kind: 'task', task: { unit: step.prefix, phase: step.phase, n: step.n } } : null;
}

/** A name as a sentence gives it. @param {Name} name */
function said(name) {
  if (name.kind === 'task') return taskName(name.task);
  return name.kind === 'phase' ? phaseName(name.unit, name.phase) : unitName(name.unit);
}

/**
 * Tick's ids by the engine's names, the engine's names by Tick's ids, and
 * which of them have ended, by Tick itself or by the person — whoever made
 * the last change — as the store holds them. Refuses a line that is not
 * JSON, a name two tasks hold, and a task holding two.
 * @param {string} root
 * @returns {Ids}
 */
function idsIn(root) {
  /** @type {Ids} */
  const ids = { byRef: new Map(), byId: new Map(), ended: new Map() };
  const store = path.join(root, STORE, TASKS);
  for (const [i, line] of fs.readFileSync(store, 'utf8').split('\n').entries()) {
    if (line === '') continue;
    /** @type {{id: string, status: string, refs?: string[], transitions?: {auto?: boolean}[]}} */
    const { id, status, refs = [], transitions = [] } = lineOf(store, i + 1, line);
    const named = refs.flatMap((ref) => {
      const name = nameIn(ref);
      return name === null ? [] : [{ ref, name }];
    });
    if (named.length > 1) throw new Error(`one task in the tracker is named ${named.map(({ name }) => said(name)).join(' and ')} — a task carries one name`);
    if (named.length === 0) continue;
    const [{ ref, name }] = named;
    if (ids.byRef.has(ref)) throw new Error(`two tasks in the tracker are named ${said(name)} — a name is carried once`);
    ids.byRef.set(ref, id);
    ids.byId.set(id, name);
    if (status === 'cancelled' || status === 'done') ids.ended.set(id, transitions.at(-1)?.auto === true ? 'tick' : 'person');
  }
  return ids;
}

/**
 * A line of the store read, refused where it is not JSON, naming the store
 * and the line.
 * @param {string} store @param {number} at @param {string} line
 */
function lineOf(store, at, line) {
  try {
    return JSON.parse(line);
  } catch (err) {
    throw new Error(`line ${at} of the tracker's store at ${store} is not JSON — mend it or take it out to go on: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Tick's id for what the engine names, which the engine has found there first. @param {Ids} ids @param {string} ref */
const idOf = (ids, ref) => /** @type {string} */ (ids.byRef.get(ref));

/** Tick's ids in a message put as the engine names them. @param {string} root @param {string} message */
function inEngineWords(root, message) {
  if (message.search(TICK_ID) === -1 || !fs.existsSync(path.join(root, STORE, TASKS))) return message;
  const { byId } = idsIn(root);
  return message.replace(TICK_ID, (id) => {
    const name = byId.get(id);
    if (name === undefined) return FOREIGN_TASK;
    return name.kind === 'task' ? shownTask(name.task) : said(name);
  });
}

/**
 * Tick's JSON answer to `args`, run in the state root. A refusal is Tick's,
 * in its words but for its ids.
 * @param {string} root @param {string[]} args
 * @returns {any}
 */
function tick(root, args) {
  const ran = spawnSync(TOOL, ['--json', ...args], { cwd: root, encoding: 'utf8', timeout: TIMEOUT_MS });
  if (ran.error) throw ran.error;
  if (ran.status !== 0) throw new Error(`${TOOL} ${args[0]}: ${inEngineWords(root, ran.stderr.trim().replace(/^Error: /, '')) || `exited ${ran.status}`}`);
  return ran.stdout.trim() === '' ? null : JSON.parse(ran.stdout);
}

/** The installed version, or null where Tick is not installed; Tick's own error where it runs and fails. @returns {string|null} */
function found() {
  const ran = spawnSync(TOOL, ['version'], { encoding: 'utf8', timeout: TIMEOUT_MS });
  if (ran.error && /** @type {NodeJS.ErrnoException} */ (ran.error).code === 'ENOENT') return null;
  if (ran.error) throw ran.error;
  const version = ran.status === 0 ? /^tick version (\S+)/.exec(ran.stdout)?.[1] : undefined;
  if (version === undefined) throw new Error(`${TOOL} version: ${ran.stderr.trim() || ran.stdout.trim() || `exited ${ran.status}`}`);
  return version;
}

/** Tick's listing as the engine's rows, the tasks alone, in order. @param {Ids} ids @param {{id: string, title: string, status: string}[]} listed @returns {TaskRow[]} */
function rowsOf({ byId }, listed) {
  return listed
    .flatMap((task) => {
      const name = byId.get(task.id);
      return name?.kind === 'task' ? [{ ref: name.task, title: task.title, status: STATUSES[task.status] }] : [];
    })
    .sort((a, b) => a.ref.phase - b.ref.phase || a.ref.n - b.ref.n);
}

/**
 * The parents of a unit named, outermost first, reopened where Tick ended
 * them. Refused, reopening none, where the person ended any, naming each
 * ended down to the innermost of theirs: the person reopens those, and the
 * verb then reopens Tick's below.
 * @param {string} root @param {Ids} ids @param {string} unit @param {string[]} refs
 */
function reopenParents(root, ids, unit, refs) {
  const parents = refs.map((ref) => idOf(ids, ref));
  const theirs = parents.reduce((at, id, i) => (ids.ended.get(id) === 'person' ? i : at), -1);
  if (theirs !== -1) {
    const toReopen = parents.slice(0, theirs + 1).filter((id) => ids.ended.has(id));
    throw new Error(endedInTracker(toReopen.map((id) => said(/** @type {Name} */ (ids.byId.get(id)))), unit));
  }
  for (const id of parents) {
    if (ids.ended.has(id)) tick(root, ['reopen', id]);
  }
}

/** @param {string} root @returns {boolean} */
function ensureStore(root) {
  const store = path.join(root, STORE);
  if (fs.existsSync(path.join(store, TASKS))) return false;
  if (fs.existsSync(store)) throw new Error(`the tracker's store at ${store} holds no ${TASKS}`);
  tick(root, ['init']);
  return true;
}

/** @param {string} root @param {string} unit @returns {boolean} */
function createUnit(root, unit) {
  if (idsIn(root).byRef.has(unitRef(unit))) return false;
  tick(root, ['create', '--refs', unitRef(unit), '--', unit]);
  return true;
}

/** @param {string} root @param {string} unit @param {number} phase @param {string} title */
function createPhase(root, unit, phase, title) {
  const ids = idsIn(root);
  reopenParents(root, ids, unit, [unitRef(unit)]);
  tick(root, ['create', '--parent', idOf(ids, unitRef(unit)), '--refs', phaseRef(unit, phase), '--', `Phase ${phase}: ${title}`]);
}

/** @param {string} root @param {TaskRef} ref @param {{title: string, type: string, text: string}} task */
function createTask(root, ref, { title, type, text }) {
  const ids = idsIn(root);
  reopenParents(root, ids, ref.unit, [unitRef(ref.unit), phaseRef(ref.unit, ref.phase)]);
  const parent = idOf(ids, phaseRef(ref.unit, ref.phase));
  tick(root, ['create', '--parent', parent, '--refs', taskRef(ref), '--tags', type, '--description', text, '--', title]);
}

/** @param {string} root @param {TaskRef} ref @param {{by: string, text: string}} addition */
function add(root, ref, { by, text }) {
  tick(root, ['note', 'add', idOf(idsIn(root), taskRef(ref)), '--', `Added by the ${by}:\n${text}`]);
}

/** @param {string} root @param {TaskRef} ref @param {string} type */
function setType(root, ref, type) {
  tick(root, ['update', idOf(idsIn(root), taskRef(ref)), '--tags', type]);
}

/** @param {string} root @param {TaskRef} task @param {TaskRef} after */
function link(root, task, after) {
  const ids = idsIn(root);
  tick(root, ['dep', 'add', idOf(ids, taskRef(task)), idOf(ids, taskRef(after))]);
}

/** @param {string} root @param {string} unit @param {number|null} phase @returns {TaskRow[]|null} */
function ready(root, unit, phase) {
  const ids = idsIn(root);
  const parent = ids.byRef.get(phase === null ? unitRef(unit) : phaseRef(unit, phase));
  if (parent === undefined) return phase === null ? [] : null;
  return rowsOf(ids, tick(root, ['ready', '--parent', parent, '--status', 'open']));
}

/** @param {string} root @param {TaskRef} ref */
function start(root, ref) {
  tick(root, ['start', idOf(idsIn(root), taskRef(ref))]);
}

/** @param {string} root @param {TaskRef} ref */
function done(root, ref) {
  tick(root, ['done', idOf(idsIn(root), taskRef(ref))]);
}

/** @param {string} root @param {TaskRef} ref @param {string} reason */
function close(root, ref, reason) {
  const id = idOf(idsIn(root), taskRef(ref));
  tick(root, ['note', 'add', id, '--', `${CLOSED}${reason}`]);
  tick(root, ['cancel', id]);
}

/** @param {string} root @param {string} unit @param {number} phase @returns {TaskRow[]|null} */
function list(root, unit, phase) {
  const ids = idsIn(root);
  const parent = ids.byRef.get(phaseRef(unit, phase));
  return parent === undefined ? null : rowsOf(ids, tick(root, ['list', '--parent', parent]));
}

/** @param {string} root @param {TaskRef} ref */
function show(root, ref) {
  const ids = idsIn(root);
  const id = ids.byRef.get(taskRef(ref));
  if (id === undefined) return null;
  const shown = tick(root, ['show', id]);
  const status = STATUSES[shown.status];
  /** @type {{text: string}[]} */
  const notes = shown.notes;
  const note = [...notes].reverse().find((held) => held.text.startsWith(CLOSED));
  return {
    ref,
    title: shown.title,
    status,
    type: shown.tags[0] ?? null,
    text: shown.description,
    additions: notes.flatMap((held) => {
      const added = ADDED.exec(held.text);
      return added === null ? [] : [{ by: /** @type {'orchestrator'|'person'} */ (added[1]), text: added[2] }];
    }),
    after: shown.blocked_by.flatMap((/** @type {{id: string}} */ blocker) => {
      const name = ids.byId.get(blocker.id);
      return name?.kind === 'task' ? [name.task] : [];
    }),
    reason: status === 'closed' && note !== undefined ? note.text.slice(CLOSED.length) : null,
  };
}

module.exports = {
  kind: 'task',
  name: 'tick',
  isDefault: true,
  needs: [{ tool: TOOL, floor: '0.3.0', update: UPDATE, found }],
  ensureStore,
  storeFiles: () => [`${STORE}/${TASKS}`],
  localFiles: () => [`/${STORE}/cache.db*`, `/${STORE}/lock`, `/${STORE}/.tasks-*.jsonl.tmp`],
  mergeStore: () => {
    throw new Error(`the tracker's store is not yet merged by the ${TOOL} driver`);
  },
  createUnit,
  createPhase,
  createTask,
  add,
  setType,
  link,
  ready,
  start,
  done,
  close,
  list,
  show,
};
