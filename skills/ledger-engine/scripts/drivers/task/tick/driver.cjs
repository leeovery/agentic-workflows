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
// The store is set up once its JSONL is there: a read before then answers a
// tracker holding nothing. A store folder without its JSONL is refused as the
// store is made, where Tick would call it made, and so is a line of it that
// is not JSON, named by its number.
// Tick's own lock is taken inside the engine's writer lock, which every task
// verb holds.
//
// A unit is a Tick task with a phase for each phase written as its child, and
// each phase holds its tasks: Tick's parents. Each carries the engine's name
// for it in its refs — `unit:{unit}`, `phase:{unit}-{N}`, `task:{id}` — and
// the driver finds Tick's id through them, read from the store, the one
// place Tick lists refs. A ref is the engine's only where it reads as one of
// those three shapes; any other a person gives a task is theirs, and passed
// by. A name two tasks hold, or a task holding two, is refused. Every read
// answers from the store's lines, parsed once a version of the store, never
// running Tick: a list is what Tick's `list --parent` gives, the tasks under
// the parent however deep; the tasks ready are those Tick's `ready` gives,
// by its own rule — open, no blocker the store holds that is not done or
// cancelled, no child open or in progress, and no ancestor with such a
// blocker — under the phase, or under every phase of the unit, wherever its
// parent sits; a task's type is its one tag a type of the template's, the
// person's own tags beside it kept as it takes another, and none where it
// holds none; a task whole is its line, which holds every field Tick's show
// gives; and when a task started is its first transition into progress,
// which the store alone holds. Tick's own ids in a refusal it makes are put
// in the engine's words. A task's text is its
// description, its type its one tag, an addition a note naming whose it is,
// and a link a dependency, the migration's unlink Tick's removal of one; a
// closed task is cancelled, its reason a note; a
// phase removed is Tick's remove of it, which takes its tasks with it and
// drops every link to them.
// Tick counts a cancelled task, as a done one, as holding nothing up, and
// ready answers only tasks not yet started. Tick ends a parent itself once every child has ended — marking
// the change its own — and makes no child under a cancelled one, so a phase
// or task is made after the parents Tick ended are reopened. A parent the
// person ended, cancelled or done, is theirs: the make is refused, reopening
// nothing, and names every parent they must reopen, outermost first, the
// ones Tick ended above theirs among them.
//
// A plan from before Ledger is adopted phase by phase (21.8.8): the task the
// migration names as a phase's parent takes the phase's name, each of its
// own children the name of the phase's next task — one named so already
// keeping its number, the rest in the numbers left, in the order the
// migration gives, by Tick's ids, then in the order Tick made them (`seq`)
// — and the parent's own parent, the plan's root, the unit's, where no task
// holds it and the root carries no name of the engine's. Each name is added
// beside the refs the task has, through Tick's
// update, which keeps its status and its history, and a name a task has
// already is left: a run again adds only what the last left out. A task
// holding another of the engine's names, a name another task holds, and a
// task holding as many refs as Tick keeps on one, ten, are refused before
// anything is added. The plan's phases are read as their adoption would
// leave them, every name checked and nothing written (`adoption`), so the
// migration's cut refuses before its first write. A plan whose unit built
// nothing is closed under its root (21.8.4): each task under the root
// holding no task of its own, neither done nor cancelled, is cancelled with
// the reason, Tick ending the parents itself, and the plan keeps no name of
// the engine's — history, the build making its own unit's parent as it
// writes its first phase; a plan holding a task done is refused, closing
// nothing: the tracker wins, its unit built some of it, and the migration
// stops there (21.8.12).
//
// The store's merge between two clones is merge.cjs's, given the driver's
// names for what the store holds. It is loaded only as the store merges:
// the layout guard loads every task driver on each write into the state.
//
// `pre-ledger-store.json` beside the driver is where a project from before
// Ledger keeps Tick's store, the project root's `.tick/`: the paths the
// reshape's migrations were released against, which they read with fs
// alone to carry the store into the state and drop it from the code branch.
// It never changes; the paths are written out apart from the store's own,
// which may.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('../../../kernel/spawn.cjs');
const { workUnitNameRefusal } = require('../../../kernel/manifest-schema.cjs');
const {
  taskId, stepOfId, shownTask, taskName, phaseName, unitName, FOREIGN_TASK, endedInTracker, TASK_TYPES,
} = require('../../../domain/task-id.cjs');

/** @typedef {import('../../../domain/drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('../../../domain/drivers.cjs').TaskStatus} TaskStatus */
/** @typedef {import('../../../domain/drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('../../../domain/task-id.cjs').TaskRef} TaskRef */
/** @typedef {{kind: 'unit', unit: string} | {kind: 'phase', unit: string, phase: number} | {kind: 'task', task: TaskRef}} Name */
/**
 * A task as Tick records it in a line of its store: its place in the order
 * Tick made them, `seq`, among it.
 * @typedef {{
 *   id: string, title: string, status: string, refs?: string[], tags?: string[], description?: string,
 *   notes?: {text: string}[], blocked_by?: string[], parent?: string, transitions?: {to: string, at: string, auto?: boolean}[], seq?: number,
 * }} Held
 */
/**
 * @typedef {{
 *   byRef: Map<string, string>, byId: Map<string, Name>, ended: Map<string, 'tick'|'person'>, started: Map<string, string>,
 *   held: Map<string, Held>, children: Map<string, Held[]>,
 * }} Ids
 */

const TOOL = 'tick';
const UPDATE = 'https://github.com/leeovery/tick';
const STORE = '.tick';
const TASKS = 'tasks.jsonl';
const TIMEOUT_MS = 30000;
const CLOSED = 'Closed: ';
const MOST_REFS = 10;
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
 * Tick's ids by the engine's names, the engine's names by Tick's ids, which
 * of them have ended, by Tick itself or by the person — whoever made the
 * last change — when each that moved into progress first did, and every
 * task's record, by id and under its parent, as the store holds them: read
 * once a version of the store, which Tick writes afresh and renames in
 * whole each time; none where the store is not set up. Refuses a line that
 * is not JSON, a name two tasks hold, and a task holding two.
 * @param {string} root
 * @returns {Ids}
 */
function idsIn(root) {
  if (!setUp(root)) return noIds();
  const store = path.join(root, STORE, TASKS);
  const { ino, size, mtimeMs, ctimeMs } = fs.statSync(store);
  const version = `${store}\0${ino}\0${size}\0${mtimeMs}\0${ctimeMs}`;
  if (lastRead?.version !== version) lastRead = { version, ids: parsed(store) };
  return lastRead.ids;
}

/** The store last parsed, by the version of it read. @type {{version: string, ids: Ids}|null} */
let lastRead = null;

/** Whether the store is set up at `root` (the header's). @param {string} root */
const setUp = (root) => fs.existsSync(path.join(root, STORE, TASKS));

/** A tracker holding nothing. @returns {Ids} */
const noIds = () => ({ byRef: new Map(), byId: new Map(), ended: new Map(), started: new Map(), held: new Map(), children: new Map() });

/** The store at `store` parsed (`idsIn`'s). @param {string} store @returns {Ids} */
function parsed(store) {
  const ids = noIds();
  for (const [i, line] of fs.readFileSync(store, 'utf8').split('\n').entries()) {
    if (line === '') continue;
    /** @type {Held} */
    const record = lineOf(store, i + 1, line);
    const { id, status, refs = [], transitions = [] } = record;
    ids.held.set(id, record);
    if (record.parent !== undefined) {
      const siblings = ids.children.get(record.parent) ?? [];
      siblings.push(record);
      ids.children.set(record.parent, siblings);
    }
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
    const into = transitions.find(({ to }) => to === 'in_progress');
    if (into !== undefined) ids.started.set(id, into.at);
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
  if (message.search(TICK_ID) === -1 || !setUp(root)) return message;
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

/** The engine's tasks among `held`, each with its record, in order. @param {Ids} ids @param {Held[]} held @returns {{ref: TaskRef, task: Held}[]} */
function namedTasks({ byId }, held) {
  return held
    .flatMap((task) => {
      const name = byId.get(task.id);
      return name?.kind === 'task' ? [{ ref: name.task, task }] : [];
    })
    .sort((a, b) => a.ref.phase - b.ref.phase || a.ref.n - b.ref.n);
}

/** The engine's tasks among `held` as its rows, in order. @param {Ids} ids @param {Held[]} held @returns {TaskRow[]} */
const rowsOf = (ids, held) => namedTasks(ids, held).map(({ ref, task }) => ({ ref, title: task.title, status: STATUSES[task.status] }));

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
  if (setUp(root)) return false;
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

/** A phase's title as Tick holds it. @param {number} phase @param {string} title */
const phaseHeld = (phase, title) => `Phase ${phase}: ${title}`;

/** A phase's title as the engine gave it, from Tick's. @param {string} held */
const phaseTitle = (held) => held.replace(/^Phase [1-9][0-9]*: /, '');

/** @param {string} root @param {string} unit @param {number} phase @param {string} title */
function createPhase(root, unit, phase, title) {
  const ids = idsIn(root);
  reopenParents(root, ids, unit, [unitRef(unit)]);
  tick(root, ['create', '--parent', idOf(ids, unitRef(unit)), '--refs', phaseRef(unit, phase), '--', phaseHeld(phase, title)]);
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
  const ids = idsIn(root);
  const id = idOf(ids, taskRef(ref));
  const others = (/** @type {Held} */ (ids.held.get(id)).tags ?? []).filter((tag) => !TASK_TYPES.includes(tag));
  tick(root, ['update', id, '--tags', [type, ...others].join(',')]);
}

/** A task's type: its tag that is a type of the template's, null where it holds none. @param {Held} task */
const typeOf = ({ tags = [] }) => tags.find((tag) => TASK_TYPES.includes(tag)) ?? null;

/** @param {string} root @param {TaskRef} task @param {TaskRef} after */
function link(root, task, after) {
  const ids = idsIn(root);
  tick(root, ['dep', 'add', idOf(ids, taskRef(task)), idOf(ids, taskRef(after))]);
}

/**
 * The dependency holding `task` after `after` removed, each named as the
 * adoption of `phases` would name it.
 * @param {string} root @param {string} unit @param {{phase: number, parent: string, order?: string[]}[]} phases @param {TaskRef} task @param {TaskRef} after
 */
function unlink(root, unit, phases, task, after) {
  const ids = adoptedIds(root, unit, phases);
  tick(root, ['dep', 'remove', idOf(ids, taskRef(task)), idOf(ids, taskRef(after))]);
}

/** Every task under `parent`, however deep, as Tick's `--parent` reads it. @param {Ids} ids @param {string} parent @returns {Held[]} */
function descendants(ids, parent) {
  return (ids.children.get(parent) ?? []).flatMap((child) => [child, ...descendants(ids, child.id)]);
}

/**
 * Whether an open task is ready by Tick's own rule (its ready query): no
 * blocker the store holds not done or cancelled, no child open or in
 * progress, and no ancestor with such a blocker.
 * @param {Ids} ids @param {Held} task
 */
function readyIn(ids, task) {
  const holds = (/** @type {Held} */ held) => (held.blocked_by ?? []).some((id) => {
    const blocker = ids.held.get(id);
    return blocker !== undefined && blocker.status !== 'done' && blocker.status !== 'cancelled';
  });
  const ancestors = (/** @type {Held} */ held) => {
    const parent = held.parent === undefined ? undefined : ids.held.get(held.parent);
    return parent === undefined ? [] : [parent, ...ancestors(parent)];
  };
  return task.status === 'open' && !holds(task)
    && !(ids.children.get(task.id) ?? []).some(({ status }) => status === 'open' || status === 'in_progress')
    && !ancestors(task).some(holds);
}

/** The parents of the unit's phases written, wherever each sits. @param {Ids} ids @param {string} unit @returns {string[]} */
const phaseParents = (ids, unit) => [...ids.byId].flatMap(([id, name]) => (name.kind === 'phase' && name.unit === unit ? [id] : []));

/** @param {string} root @param {string} unit @param {number|null} phase @returns {TaskRow[]|null} */
function ready(root, unit, phase) {
  const ids = idsIn(root);
  const parents = phase === null ? phaseParents(ids, unit) : [ids.byRef.get(phaseRef(unit, phase))];
  if (parents[0] === undefined) return phase === null ? [] : null;
  return rowsOf(ids, parents.flatMap((parent) => descendants(ids, /** @type {string} */ (parent))).filter((task) => readyIn(ids, task)));
}

/**
 * A phase's own tasks in the order its adoption names them (the header's):
 * one holding a task's name of the phase already in its number's place, and
 * the rest in the places left, as `order` lists them, then in the order
 * Tick made them.
 * @param {Ids} ids @param {string} unit @param {number} phase @param {string} parent @param {string[]} order Tick's ids
 * @returns {Held[]}
 */
function madeUnder(ids, unit, phase, parent, order) {
  const children = ids.children.get(parent) ?? [];
  const heldAt = (/** @type {Held} */ { id }) => {
    const name = ids.byId.get(id);
    return name?.kind === 'task' && name.task.unit === unit && name.task.phase === phase ? name.task.n - 1 : null;
  };
  const listed = (/** @type {Held} */ { id }) => (order.includes(id) ? order.indexOf(id) : order.length);
  const rest = children.filter((child) => heldAt(child) === null).sort((a, b) => listed(a) - listed(b) || (a.seq ?? 0) - (b.seq ?? 0));
  /** @type {(Held|undefined)[]} */
  const places = [];
  for (const child of children) {
    const at = heldAt(child);
    if (at !== null) places[at] = child;
  }
  return Array.from({ length: Math.max(children.length, places.length) }, (_, at) => places[at] ?? rest.shift())
    .filter(/** @returns {child is Held} */ (child) => child !== undefined);
}

/**
 * The names a phase's adoption gives, each to Tick's id (the header's): the
 * plan's root the unit's, where it may take it; the parent the phase's; and
 * its children its tasks', in the order `madeUnder` gives.
 * @param {Ids} ids @param {string} unit @param {number} phase @param {Held} parent @param {string[]} order Tick's ids
 * @returns {[string, string][]}
 */
function adoptedNames(ids, unit, phase, parent, order) {
  const root = parent.parent;
  const rootTakes = root !== undefined && !ids.byRef.has(unitRef(unit)) && !ids.byId.has(root);
  return [
    ...(rootTakes ? /** @type {[string, string][]} */ ([[root, unitRef(unit)]]) : []),
    [parent.id, phaseRef(unit, phase)],
    ...madeUnder(ids, unit, phase, parent.id, order).map((child, at) => /** @type {[string, string]} */ ([child.id, taskRef({ unit, phase, n: at + 1 })])),
  ];
}

/**
 * Refuses names one of which a task may not take: where a task holds
 * another of the engine's names, a name is another's, or the task holds as
 * many refs as Tick keeps.
 * @param {Ids} ids @param {[string, string][]} names
 */
function refuseNames(ids, names) {
  for (const [id, ref] of names) {
    const holder = ids.byRef.get(ref);
    const own = ids.byId.get(id);
    const name = /** @type {Name} */ (nameIn(ref));
    if (holder !== undefined && holder !== id) throw new Error(`another task in the tracker is named ${said(name)} already — a name is carried once`);
    if (own !== undefined && holder !== id) throw new Error(`the task to be named ${said(name)} is named ${said(own)} already — a task carries one name`);
    const refs = /** @type {Held} */ (ids.held.get(id)).refs ?? [];
    if (holder === undefined && refs.length >= MOST_REFS) throw new Error(`the task to be named ${said(name)} holds ${refs.length} refs, the most the tracker keeps on one — take one off it there to go on`);
  }
}

/**
 * Each name given to its task, beside the refs it has, refused as
 * `refuseNames` refuses; a name it holds already left.
 * @param {string} root @param {Ids} ids @param {[string, string][]} names
 */
function giveNames(root, ids, names) {
  refuseNames(ids, names);
  for (const [id, ref] of names) {
    if (ids.byRef.get(ref) !== id) tick(root, ['update', id, '--refs', [...(/** @type {Held} */ (ids.held.get(id)).refs ?? []), ref].join(',')]);
  }
}

/** The task the migration names as a phase's parent, refused where Tick lacks it. @param {Ids} ids @param {string} unit @param {number} phase @param {string} parent */
function adoptedParent(ids, unit, phase, parent) {
  const held = ids.held.get(parent);
  if (held === undefined) throw new Error(`the tracker holds no task ${parent} to adopt as ${phaseName(unit, phase)}`);
  return held;
}

/** The store as read, with `names` given beside the names it holds, nothing written. @param {Ids} ids @param {[string, string][]} names @returns {Ids} */
function withNames(ids, names) {
  const byRef = new Map(ids.byRef);
  const byId = new Map(ids.byId);
  for (const [id, ref] of names) {
    byRef.set(ref, id);
    byId.set(id, /** @type {Name} */ (nameIn(ref)));
  }
  return { ...ids, byRef, byId };
}

/** The name a phase's old plan carries on its root, its topic's: the root's first ref no name of the engine's, null where it has none. @param {Ids} ids @param {Held} parent */
function planNameOf(ids, parent) {
  const root = parent.parent === undefined ? undefined : ids.held.get(parent.parent);
  return root?.refs?.find((ref) => nameIn(ref) === null) ?? null;
}

/**
 * The store as read, with the names adopting `phases` in turn would give
 * beside the names it holds, nothing written; refused as `adopt` refuses.
 * @param {string} root @param {string} unit @param {{phase: number, parent: string, order?: string[]}[]} phases
 * @returns {Ids}
 */
function adoptedIds(root, unit, phases) {
  let ids = idsIn(root);
  for (const { phase, parent, order = [] } of phases) {
    const names = adoptedNames(ids, unit, phase, adoptedParent(ids, unit, phase, parent), order);
    refuseNames(ids, names);
    ids = withNames(ids, names);
  }
  return ids;
}

/**
 * @param {string} root @param {string} unit @param {{phase: number, parent: string, order?: string[]}[]} phases
 * @returns {{phase: number, plan: string|null, title: string, tasks: TaskDetail[]}[]}
 */
function adoption(root, unit, phases) {
  const named = adoptedIds(root, unit, phases);
  return phases.map(({ phase, parent }) => {
    const held = adoptedParent(named, unit, phase, parent);
    return { phase, plan: planNameOf(named, held), title: phaseTitle(held.title), tasks: namedTasks(named, descendants(named, parent)).map(({ ref, task }) => detailOf(named, ref, task)) };
  });
}

/**
 * @param {string} root @param {string} unit @param {{phase: number, parent: string, order?: string[]}[]} phases
 * @returns {TaskDetail[]}
 */
function waitingOn(root, unit, phases) {
  const named = adoptedIds(root, unit, phases);
  return namedTasks(named, [...named.held.values()]).filter(({ ref }) => ref.unit !== unit)
    .map(({ ref, task }) => detailOf(named, ref, task))
    .filter(({ after }) => after.some((on) => on.unit === unit));
}

/** @param {string} root @param {string} unit @param {number} phase @param {string} parent @param {string[]} [order] @returns {TaskRef[]} */
function adopt(root, unit, phase, parent, order = []) {
  const ids = idsIn(root);
  const names = adoptedNames(ids, unit, phase, adoptedParent(ids, unit, phase, parent), order);
  giveNames(root, ids, names);
  return names.flatMap(([, ref]) => {
    const name = nameIn(ref);
    return name?.kind === 'task' ? [name.task] : [];
  });
}

/** @param {string} root @param {string} unit @param {string} parent @param {string} reason @param {boolean} [keepDone] @returns {number} */
function closePlan(root, unit, parent, reason, keepDone = false) {
  const ids = idsIn(root);
  if (!ids.held.has(parent)) throw new Error(`the tracker holds no task ${parent} to close as the root of a plan from before Ledger of ${unitName(unit)}`);
  const leaves = descendants(ids, parent).filter(({ id }) => (ids.children.get(id) ?? []).length === 0);
  const done = leaves.filter(({ status }) => status === 'done');
  if (done.length > 0 && !keepDone) {
    throw new Error(`the plan from before Ledger under ${parent} holds ${done.map(({ title }) => `"${title}"`).join(', ')} done, so ${unitName(unit)} built some of it — the tracker wins: none of it is closed, and the migration stops there, telling the person so`);
  }
  const open = leaves.filter(({ status }) => status !== 'cancelled' && status !== 'done');
  for (const { id } of open) {
    tick(root, ['note', 'add', id, '--', `${CLOSED}${reason}`]);
    tick(root, ['cancel', id]);
  }
  return open.length;
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

/** @param {string} root @param {string} unit @param {number} phase */
function removePhase(root, unit, phase) {
  tick(root, ['remove', '--force', idOf(idsIn(root), phaseRef(unit, phase))]);
}

/** @param {string} root @param {string} unit @param {number} phase @returns {TaskRow[]|null} */
function list(root, unit, phase) {
  const ids = idsIn(root);
  const parent = ids.byRef.get(phaseRef(unit, phase));
  return parent === undefined ? null : rowsOf(ids, descendants(ids, parent));
}

/** A task whole, from its record. @param {Ids} ids @param {TaskRef} ref @param {Held} task @returns {TaskDetail} */
function detailOf(ids, ref, task) {
  const status = STATUSES[task.status];
  const notes = task.notes ?? [];
  const note = [...notes].reverse().find((held) => held.text.startsWith(CLOSED));
  return {
    ref,
    title: task.title,
    status,
    type: typeOf(task),
    text: task.description ?? '',
    additions: notes.flatMap((held) => {
      const added = ADDED.exec(held.text);
      return added === null ? [] : [{ by: /** @type {'orchestrator'|'person'} */ (added[1]), text: added[2] }];
    }),
    after: (task.blocked_by ?? []).flatMap((blocker) => {
      const name = ids.byId.get(blocker);
      return name?.kind === 'task' ? [name.task] : [];
    }),
    reason: status === 'closed' && note !== undefined ? note.text.slice(CLOSED.length) : null,
  };
}

/** @param {string} root @param {TaskRef} ref */
function show(root, ref) {
  const ids = idsIn(root);
  const id = ids.byRef.get(taskRef(ref));
  return id === undefined ? null : detailOf(ids, ref, /** @type {Held} */ (ids.held.get(id)));
}

/** @param {string} root @param {string} unit @param {number} phase @returns {TaskDetail[]|null} */
function tasks(root, unit, phase) {
  const ids = idsIn(root);
  const parent = ids.byRef.get(phaseRef(unit, phase));
  if (parent === undefined) return null;
  return namedTasks(ids, descendants(ids, parent)).map(({ ref, task }) => detailOf(ids, ref, task));
}

/**
 * When the task first moved into progress: its first transition there in
 * the store, which Tick's show leaves out and the store's merge unions.
 * @param {string} root @param {TaskRef} ref @returns {string|null}
 */
function started(root, ref) {
  const ids = idsIn(root);
  const at = ids.started.get(ids.byRef.get(taskRef(ref)) ?? '');
  return at === undefined ? null : new Date(at).toISOString();
}

/** What the store's merge reads Tick's records by. @type {import('./merge.cjs').Names} */
const NAMES = Object.freeze({ statuses: STATUSES, nameIn, said, phaseTitle });

module.exports = {
  kind: 'task',
  name: 'tick',
  isDefault: true,
  title: 'Tick\'s driver',
  needs: [{ tool: TOOL, label: 'Tick', floor: '0.3.0', update: UPDATE, found }],
  ensureStore,
  storeFiles: () => [`${STORE}/${TASKS}`],
  localFiles: () => [`/${STORE}/cache.db*`, `/${STORE}/lock`, `/${STORE}/.tasks-*.jsonl.tmp`],
  mergeStore: (/** @type {string} */ base, /** @type {string} */ local, /** @type {string} */ remote, /** @type {any} */ pickOf) => require('./merge.cjs').mergeStore(NAMES, base, local, remote, pickOf),
  createUnit,
  createPhase,
  createTask,
  adoption,
  waitingOn,
  adopt,
  closePlan,
  add,
  setType,
  link,
  unlink,
  ready,
  start,
  done,
  close,
  removePhase,
  list,
  show,
  tasks,
  started,
};
