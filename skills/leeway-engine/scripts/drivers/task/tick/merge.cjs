'use strict';

// ---------------------------------------------------------------------------
// Tick's store merged between two clones (7.5.5–7.5.7, 29.14.9), for the
// task driver: the common ancestor's copy, this machine's and the remote's,
// each its text, merged by Tick's own ids, never by a line's place, since
// Tick writes the whole file afresh each time.
//
// - A task only one side changed takes that side; one deleted on a side and
//   changed on the other keeps the changed copy. One both changed merges
//   field by field against the ancestor: its notes, dependencies and
//   transitions unioned, its updated stamp the later, its closed stamp that
//   of a side whose status it kept, and a field both set differently the
//   person's choice, shown in the engine's words.
// - A status is the person's where its side's last transition was made by
//   hand, and Tick's where Tick made it, cascading (`auto`). Where both sides
//   changed a task's status, a status set by hand stands over one Tick set,
//   and only two set by hand differently are a choice.
// - The merged store then reads as if Tick's own cascades had run over the
//   merged tasks (Tick's internal/task/cascades.go): each parent whose
//   status is Tick's, deepest first, is settled from its children — every
//   child ended ends it, done where any is done, else cancelled; a child
//   still open reopens one that had ended; a child in progress starts one
//   that is open — each change an automatic transition stamped with the
//   latest change the store holds. A parent the person ended stays ended.
// - An engine name both sides made under Tick ids of their own is the
//   remote's: this machine's record of it is set aside, a phase or unit
//   with all it holds, every link to it dropped, and the rest merged as
//   above. The merge answers it as one more conflict, naming the names
//   made twice and the tasks set aside, for the engine to stop on and to
//   keep this machine's whole copy beside the merged one.
// - A task only this machine made takes a creation sequence after the
//   remote's highest, in this machine's order.
// ---------------------------------------------------------------------------

const { MergeError, same, mergeFields } = require('../../../domain/state-merge-rules.cjs');
const { isObject } = require('../../../kernel/manifest-io.cjs');
const { FOREIGN_TASK } = require('../../../domain/task-id.cjs');

/** @typedef {import('./driver.cjs').Name} Name */
/** @typedef {import('../../../domain/drivers.cjs').StoreMerge} StoreMerge */
/** @typedef {import('../../../domain/drivers.cjs').StoreConflict} StoreConflict */
/** @typedef {import('../../../domain/drivers.cjs').FieldStoreConflict} FieldStoreConflict */
/** @typedef {import('../../../domain/state-merge-rules.cjs').Choice} Choice */
/** @typedef {import('../../../domain/state-merge-rules.cjs').Side} Side */
/** @typedef {import('../../../domain/state-merge-rules.cjs').PickOf} PickOf */
/** @typedef {Record<string, any> & {id: string}} Task */
/** @typedef {Map<string, Task>} Tasks */
/** @typedef {{from: string, to: string, at: string, auto: boolean}} Transition */

/**
 * The driver's names for what the store holds: the store's file, Tick's
 * statuses in the engine's words, the engine's name a ref carries, and a
 * name as a sentence gives it.
 * @typedef {{file: string, statuses: Readonly<Record<string, string>>, nameIn: (ref: string) => Name|null, said: (name: Name) => string}} Names
 */

const SIDES = ["the common ancestor's", "this machine's", "the remote's"];
const UNIONED = ['notes', 'blocked_by', 'transitions'];
const ENDED = ['done', 'cancelled'];
/** A field as the person reads it, where that is not its own name. @type {Readonly<Record<string, string>>} */
const FIELD_WORDS = Object.freeze({ tags: 'type', description: 'text' });

/** @param {string} status */
const ended = (status) => ENDED.includes(status);

/**
 * One side's copy of the store, its tasks by Tick's id. Refuses a line that
 * is not a task, naming the side and the line.
 * @param {Names} names @param {string} text @param {string} whose @returns {Tasks}
 */
function tasksOf(names, text, whose) {
  /** @type {Tasks} */
  const tasks = new Map();
  for (const [i, line] of text.split('\n').entries()) {
    if (line.trim() === '') continue;
    let task;
    try {
      task = JSON.parse(line);
    } catch {
      task = null;
    }
    if (!isObject(task) || typeof task.id !== 'string') throw new MergeError(`cannot merge ${names.file}: line ${i + 1} of ${whose} copy is not a task`);
    tasks.set(task.id, /** @type {Task} */ (task));
  }
  return tasks;
}

/** The engine's name a task carries, or null where it carries none. @param {Names} names @param {Task} task @returns {Name|null} */
function nameOf(names, task) {
  return (Array.isArray(task.refs) ? task.refs : []).map(names.nameIn).find((name) => name !== null) ?? null;
}

/** A side's tasks the ancestor lacks. @param {Tasks} base @param {Tasks} side */
function madeOn(base, side) {
  return [...side.values()].filter((task) => !base.has(task.id));
}

/**
 * The engine's names both sides made, each under a Tick id of its own, with
 * this machine's ids for them, in this machine's order.
 * @param {Names} names @param {Tasks} base @param {Tasks} local @param {Tasks} remote @returns {Map<string, string>}
 */
function madeTwice(names, base, local, remote) {
  /** @param {Tasks} side @returns {Map<string, string>} */
  const named = (side) => new Map(madeOn(base, side).flatMap((task) => {
    const name = nameOf(names, task);
    return name === null ? [] : [/** @type {[string, string]} */ ([names.said(name), task.id])];
  }));
  const theirs = named(remote);
  return new Map([...named(local)].filter(([name, id]) => theirs.has(name) && theirs.get(name) !== id));
}

/**
 * This machine's records set aside: those made twice, and every record
 * under them, in this machine's order.
 * @param {Tasks} local @param {Iterable<string>} twice @returns {Task[]}
 */
function setAside(local, twice) {
  const aside = new Set(twice);
  for (let grew = true; grew;) {
    grew = false;
    for (const task of local.values()) {
      if (!aside.has(task.id) && aside.has(task.parent)) {
        aside.add(task.id);
        grew = true;
      }
    }
  }
  return [...local.values()].filter((task) => aside.has(task.id));
}

/**
 * A list both sides may have added to or taken from, merged: the remote's,
 * then what this machine added, less what either took away. Undefined where
 * nothing is left.
 * @param {unknown[]} [base] @param {unknown[]} [local] @param {unknown[]} [remote] @returns {unknown[]|undefined}
 */
function unionOf(base = [], local = [], remote = []) {
  const key = (/** @type {unknown} */ item) => JSON.stringify(item);
  const [b, l, r] = [base, local, remote].map((list) => new Set(list.map(key)));
  const takenAway = (/** @type {unknown} */ item) => b.has(key(item)) && !(l.has(key(item)) && r.has(key(item)));
  const merged = [...remote, ...local.filter((item) => !r.has(key(item)))].filter((item) => !takenAway(item));
  return merged.length === 0 ? undefined : merged;
}

/** The later of two stamps, either absent. @param {string|undefined} a @param {string|undefined} b */
function later(a, b) {
  return a === undefined || (b !== undefined && b > a) ? b : a;
}

/** Whether a task's status was set by hand: its last transition's. @param {Task|undefined} task */
function byHand(task) {
  return task?.transitions?.at(-1)?.auto === false;
}

/**
 * The status of a task both sides changed differently, where it is not the
 * person's choice: the side's set by hand over Tick's, and, both Tick's,
 * the remote's for now, settled with the parents. Undefined where both
 * were set by hand.
 * @param {Task|undefined} base @param {Task} local @param {Task} remote @returns {string|undefined}
 */
function settledStatus(base, local, remote) {
  if ([local.status, remote.status].includes(base?.status) || local.status === remote.status) return undefined;
  if (byHand(local) && byHand(remote)) return undefined;
  return byHand(local) ? local.status : remote.status;
}

/**
 * The fields of a task both sides changed that are never the person's
 * choice, settled: the lists unioned, the transitions in time order, the
 * updated stamp the later, the status where `settledStatus` settles it. The
 * closed stamp waits on the status.
 * @param {Task|undefined} base @param {Task} local @param {Task} remote @returns {Record<string, unknown>}
 */
function settled(base, local, remote) {
  /** @type {Record<string, any>} */
  const fields = Object.fromEntries(UNIONED.map((key) => [key, unionOf(base?.[key], local[key], remote[key])]));
  fields.transitions = fields.transitions?.sort((/** @type {Transition} */ a, /** @type {Transition} */ b) => (a.at < b.at ? -1 : Number(a.at > b.at)));
  const status = settledStatus(base, local, remote);
  return { ...fields, ...(status === undefined ? {} : { status }), updated: later(local.updated, remote.updated), closed: undefined };
}

/**
 * The transition that set the task's status on the side it was kept from
 * moved last, where another stands after it, so the store still says who
 * set it.
 * @param {Task} task @param {Task[]} sides
 * @returns {Transition[]|undefined}
 */
function deciderLast(task, sides) {
  const transitions = /** @type {Transition[]|undefined} */ (task.transitions);
  const decider = sides.map((side) => side.transitions?.at(-1)).find((last) => last?.to === task.status);
  if (transitions === undefined || decider === undefined || transitions.at(-1)?.to === task.status) return transitions;
  return [...transitions.filter((held) => !same(held, decider)), decider];
}

/**
 * A choice on a task as the person reads it: the field under the task's
 * Tick id, each side's value in the engine's words.
 * @param {Names} names @param {string} id @param {Choice} choice @param {Map<string, string>} named  the engine's name of each task, by Tick's id
 * @returns {Choice}
 */
function shownChoice(names, id, { field, local, remote }, named) {
  const [key] = field;
  /** @param {any} value */
  const word = (value) => {
    if (key === 'status') return names.statuses[value] ?? value;
    if (key === 'tags' && Array.isArray(value)) return value.join(', ');
    return key === 'parent' ? named.get(value) ?? FOREIGN_TASK : value;
  };
  /** @param {Side} side @returns {Side} */
  const shown = (side) => (side.set ? { set: true, value: word(side.value) } : side);
  return { field: [id, ...field], local: shown(local), remote: shown(remote) };
}

/**
 * A task both sides changed, merged, with the fields left to the person.
 * @param {Names} names @param {Task|undefined} base @param {Task} local @param {Task} remote
 * @param {PickOf} pickOf @param {Map<string, string>} named
 * @returns {{task: Task, conflicts: FieldStoreConflict[]}}
 */
function mergeTask(names, base, local, remote, pickOf, named) {
  const fixed = settled(base, local, remote);
  const merged = mergeFields(base, { ...local, ...fixed }, { ...remote, ...fixed }, (choice) => pickOf(shownChoice(names, remote.id, choice, named)));
  const task = /** @type {Task} */ (merged.value);
  const kept = [local, remote].filter((side) => side.status === task.status);
  const stamp = ended(task.status) ? kept.map((side) => side.closed).reduce(later, undefined) : undefined;
  if (stamp !== undefined) task.closed = stamp;
  const transitions = deciderLast(task, kept);
  if (transitions !== undefined) task.transitions = transitions;
  const name = nameOf(names, remote);
  const label = name === null ? { subject: `${FOREIGN_TASK}, "${remote.title}"`, name: String(remote.title) } : { subject: names.said(name), name: names.said(name) };
  return {
    task,
    conflicts: merged.conflicts.map((conflict) => ({
      ...shownChoice(names, remote.id, conflict, named),
      pick: conflict.pick,
      label: { ...label, field: FIELD_WORDS[conflict.field[0]] ?? conflict.field[0] },
    })),
  };
}

// --- the parents settled as Tick's cascades would leave them -----------------

/**
 * The status Tick's cascades give a parent from its children's: every
 * child ended ends it, done where any is done (Rule 3); else one that had
 * ended reopens (Rules 5 and 6), and one open starts where a child is in
 * progress (Rule 2).
 * @param {string} status @param {string[]} children @returns {string}
 */
function cascaded(status, children) {
  if (children.every(ended)) return children.includes('done') ? 'done' : 'cancelled';
  const from = ended(status) ? 'open' : status;
  return from === 'open' && children.includes('in_progress') ? 'in_progress' : from;
}

/**
 * The transitions Tick makes between two statuses: an ended task reopened
 * first, then started or ended.
 * @param {string} from @param {string} to @returns {[string, string][]}
 */
function stepsBetween(from, to) {
  /** @type {[string, string][]} */
  const steps = [];
  let at = from;
  if (ended(at)) {
    steps.push([at, 'open']);
    at = 'open';
  }
  if (at === 'open' && to === 'in_progress') steps.push([at, to]);
  else if (ended(to)) steps.push([at, to]);
  return steps;
}

/**
 * A task moved to `to` as Tick moves it, each step an automatic transition
 * at `stamp`, its closed stamp set or cleared with it.
 * @param {Task} task @param {string} to @param {string} stamp @returns {Task}
 */
function moved(task, to, stamp) {
  const steps = stepsBetween(task.status, to).map(([from, next]) => ({ from, to: next, at: stamp, auto: true }));
  const { closed, ...rest } = task;
  return { ...rest, status: to, updated: stamp, transitions: [...(task.transitions ?? []), ...steps], ...(ended(to) ? { closed: stamp } : {}) };
}

/**
 * The merged tasks with each parent whose status is Tick's settled from
 * its children, deepest first. A status is the person's where a side
 * holding it last set it by hand.
 * @param {Task[]} tasks @param {Tasks[]} sides @returns {Task[]}
 */
function settleParents(tasks, sides) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  /** @type {Map<string, string[]>} */
  const children = new Map();
  for (const task of tasks) {
    if (byId.has(task.parent)) children.set(task.parent, [...(children.get(task.parent) ?? []), task.id]);
  }
  /** @param {string} id @returns {number} */
  const depth = (id) => (byId.has(byId.get(id)?.parent) ? 1 + depth(byId.get(id)?.parent) : 0);
  const stamp = tasks.map((task) => task.updated).reduce(later, undefined);
  const theirs = (/** @type {Task} */ task) => !sides.some((side) => side.get(task.id)?.status === task.status && byHand(side.get(task.id)));
  for (const id of [...children.keys()].sort((a, b) => depth(b) - depth(a))) {
    const task = /** @type {Task} */ (byId.get(id));
    const to = cascaded(task.status, /** @type {string[]} */ (children.get(id)).map((child) => byId.get(child)?.status));
    if (to !== task.status && theirs(task)) byId.set(id, moved(task, to, stamp));
  }
  return tasks.map((task) => /** @type {Task} */ (byId.get(task.id)));
}

// --- the store ---------------------------------------------------------------

/**
 * A task taken whole from one side: the side that changed it, where only
 * one did, or the changed copy, where the other deleted it. Undefined where
 * it goes; null where both changed it.
 * @param {Task|undefined} base @param {Task|undefined} local @param {Task|undefined} remote @returns {Task|undefined|null}
 */
function keptWhole(base, local, remote) {
  if (same(local, remote) || same(local, base)) return remote;
  if (same(remote, base)) return local;
  return local === undefined || remote === undefined ? local ?? remote : null;
}

/**
 * Every task merged by Tick's id, the remote's order first, with the
 * fields left to the person.
 * @param {Names} names @param {Tasks} base @param {Tasks} local @param {Tasks} remote @param {PickOf} pickOf
 * @returns {{tasks: Task[], conflicts: FieldStoreConflict[]}}
 */
function mergeTasks(names, base, local, remote, pickOf) {
  const named = new Map([...base.values(), ...local.values(), ...remote.values()].flatMap((task) => {
    const name = nameOf(names, task);
    return name === null ? [] : [/** @type {[string, string]} */ ([task.id, names.said(name)])];
  }));
  /** @type {FieldStoreConflict[]} */
  const conflicts = [];
  /** @type {Task[]} */
  const tasks = [];
  for (const id of [...remote.keys(), ...[...local.keys()].filter((held) => !remote.has(held))]) {
    const [b, l, r] = [base.get(id), local.get(id), remote.get(id)];
    const kept = keptWhole(b, l, r);
    if (kept !== null) {
      if (kept !== undefined) tasks.push(kept);
      continue;
    }
    const merged = mergeTask(names, b, /** @type {Task} */ (l), /** @type {Task} */ (r), pickOf, named);
    tasks.push(merged.task);
    conflicts.push(...merged.conflicts);
  }
  return { tasks, conflicts };
}

/**
 * Each task only this machine made given a creation sequence after the
 * remote's highest, in this machine's order.
 * @param {Task[]} tasks @param {Tasks} base @param {Tasks} remote @returns {Task[]}
 */
function sequenced(tasks, base, remote) {
  let seq = Math.max(0, ...[...remote.values()].map((task) => (typeof task.seq === 'number' ? task.seq : 0)));
  return tasks.map((task) => (base.has(task.id) || remote.has(task.id) || typeof task.seq !== 'number' ? task : { ...task, seq: ++seq }));
}

/** A task with its links to any of `gone` dropped. @param {Task} task @param {Set<string>} gone @returns {Task} */
function unlinked(task, gone) {
  if (!Array.isArray(task.blocked_by) || !task.blocked_by.some((/** @type {string} */ id) => gone.has(id))) return task;
  const { blocked_by: links, ...rest } = task;
  const kept = links.filter((/** @type {string} */ id) => !gone.has(id));
  return kept.length === 0 ? rest : { ...rest, blocked_by: kept };
}

/**
 * The tasks set aside as the person makes them again: each that is no
 * phase or unit, its title and the phase it was in.
 * @param {Names} names @param {Task[]} aside @param {Tasks} local
 * @returns {{phase: number|null, title: string}[]}
 */
function toMakeAgain(names, aside, local) {
  return aside.flatMap((task) => {
    const name = nameOf(names, task);
    if (name !== null && name.kind !== 'task') return [];
    const parent = local.get(task.parent);
    const held = parent === undefined ? null : nameOf(names, parent);
    const phase = name?.kind === 'task' ? name.task.phase : held?.kind === 'phase' ? held.phase : null;
    return [{ phase, title: String(task.title) }];
  });
}

/**
 * The store merged from the common ancestor's copy, this machine's and the
 * remote's, each its text, the ancestor's empty where it held none.
 * @param {Names} names @param {string} baseText @param {string} localText @param {string} remoteText @param {PickOf} [pickOf]
 * @returns {StoreMerge}
 */
function mergeStore(names, baseText, localText, remoteText, pickOf = () => null) {
  const [base, mine, remote] = [baseText, localText, remoteText].map((text, i) => tasksOf(names, text, SIDES[i]));
  const twice = madeTwice(names, base, mine, remote);
  const aside = setAside(mine, twice.values());
  const gone = new Set(aside.map((task) => task.id));
  const local = new Map([...mine].filter(([id]) => !gone.has(id)));
  const merged = mergeTasks(names, base, local, remote, pickOf);
  const tasks = settleParents(sequenced(merged.tasks, base, remote).map((task) => unlinked(task, gone)), [base, local, remote]);
  /** @type {StoreConflict[]} */
  const conflicts = [...merged.conflicts];
  if (twice.size > 0) conflicts.push({ madeTwice: [...twice.keys()], again: toMakeAgain(names, aside, mine) });
  return { text: tasks.map((task) => `${JSON.stringify(task)}\n`).join(''), conflicts };
}

module.exports = { mergeStore };
