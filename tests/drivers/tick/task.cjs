'use strict';

// Tick's side of the task suites, what they need that names Tick: a project's
// own store in its code tree, as a project tracking its own work with Tick
// keeps one at its root — the store a walk up from the state would find; what
// a person might do to the state's store in Tick itself — make a task, or one
// under another, give one refs, leave one with no type, start a child under
// its parent left open, link one after another, or a phase after a task,
// reopen or remove one, cancel, mark done or reopen a unit or a phase,
// delete the store's file,
// take away its folder's write, write a line into it that is not JSON or
// link a task after one it does not hold; a plan the workflows wrote into
// Tick before Leeway, a task of it started, done or cancelled there, as
// the old plan's process left it, or given as many refs as Tick keeps on
// one, and the store's records as they stand
// apart from the engine's names for a unit; what Tick itself answers as a
// phase's list and the tasks ready in it, for the driver's reads to be held
// to; a title Tick refuses, for a verb refused after it wrote; and a folder
// named in part like Tick's ids. Tick reads no config of its own; the
// hermetic environment pins the rest.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { taskId, stepOfId } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');

/** @typedef {import('../../../skills/leeway-engine/scripts/domain/task-id.cjs').TaskRef} TaskRef */

/**
 * Refs a person might give a task in Tick: a link, and some in the shape of
 * the driver's names but none of them — the last four with the shape's
 * numbers, their units no work unit's.
 */
const OWN_REFS = [
  'https://example.invalid/issues/42', 'task:review', 'task:JIRA-7', 'phase:pay', 'unit:Board',
  'task:JIRA-7-1', 'task:JIRA-12-3', 'phase:Sprint-3', 'phase:Q4-2',
];

/** Tick's JSON answer, run at `dir`. @param {string} dir @param {string[]} args */
const tick = (dir, args) => JSON.parse(execFileSync('tick', ['--json', ...args], { cwd: dir, encoding: 'utf8', timeout: 30000 }) || 'null');

/** Tick's id for the task titled `title` in the store at `root`. @param {string} root @param {string} title */
function idOf(root, title) {
  const [task] = tick(root, ['list']).filter((/** @type {{title: string}} */ held) => held.title === title);
  return task.id;
}

/**
 * The project's own store, made at `dir`: the files it holds, by path, and
 * their contents.
 * @param {string} dir
 * @returns {() => Record<string, string>} what the store holds now
 */
function projectStore(dir) {
  execFileSync('tick', ['init'], { cwd: dir, stdio: 'ignore', timeout: 30000 });
  const store = path.join(dir, '.tick');
  return () => Object.fromEntries(fs.readdirSync(store).sort().map((name) => [name, fs.readFileSync(path.join(store, name), 'latin1')]));
}

/**
 * The task titled `title` given more refs, as a person might in Tick: their
 * own, or, given a task, the engine's name for that one.
 * @param {string} root @param {string} title @param {TaskRef} [task]
 */
function addRef(root, title, task) {
  const id = idOf(root, title);
  const { refs } = tick(root, ['show', id]);
  tick(root, ['update', id, '--refs', [...refs, ...(task === undefined ? OWN_REFS : [`task:${taskId(task)}`])].join(',')]);
}

/**
 * A task made in Tick by hand: carrying the engine's name for `task`, or,
 * without one, a person's own.
 * @param {string} root @param {string} title @param {TaskRef} [task]
 */
function makeTask(root, title, task) {
  tick(root, ['create', ...(task === undefined ? [] : ['--refs', `task:${taskId(task)}`]), '--', title]);
}

/** The task titled `title` left with no type, as a person might in Tick: the driver keeps its type as its one tag. @param {string} root @param {string} title */
function typeCleared(root, title) {
  tick(root, ['update', idOf(root, title), '--clear-tags']);
}

/** The task titled `title` linked after the one titled `after`, as a person might in Tick. @param {string} root @param {string} title @param {string} after */
function linkBy(root, title, after) {
  tick(root, ['dep', 'add', idOf(root, title), idOf(root, after)]);
}

/** The task titled `title` reopened once ended, as a person might in Tick. @param {string} root @param {string} title */
function reopenTask(root, title) {
  tick(root, ['reopen', idOf(root, title)]);
}

/** The task titled `title` removed, as a person might in Tick. @param {string} root @param {string} title */
function removeTask(root, title) {
  tick(root, ['remove', idOf(root, title), '--force']);
}

/** The store's committed file deleted, its folder and the local files left. @param {string} root */
function breakStore(root) {
  fs.rmSync(path.join(root, '.tick', 'tasks.jsonl'));
}

/** A line that is not JSON written at the end of the store's file, answering its number. @param {string} root */
function garbleStore(root) {
  const file = path.join(root, '.tick', 'tasks.jsonl');
  fs.appendFileSync(file, '{"id": "tick-\n');
  return fs.readFileSync(file, 'utf8').trim().split('\n').length;
}

/**
 * The store's folder made read-only, or writable again, as a person's
 * permissions might leave it.
 * @param {string} root @param {boolean} writable
 */
function setStoreWritable(root, writable) {
  fs.chmodSync(path.join(root, '.tick'), writable ? 0o755 : 0o555);
}

/**
 * The unit's entry, or one of its phases', cancelled, marked done or
 * reopened by hand in Tick.
 * @param {string} root @param {'cancel'|'done'|'reopen'} act @param {string} unit @param {number} [phase]
 */
function byHand(root, act, unit, phase) {
  tick(root, [act, recordOf(root, phase === undefined ? `unit:${unit}` : `phase:${unit}-${phase}`).id]);
}

/** The store's records, as its file holds them. @param {string} root @returns {{id: string, refs?: string[]}[]} */
const records = (root) => fs.readFileSync(path.join(root, '.tick', 'tasks.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));

/** The store's record carrying `ref`. @param {string} root @param {string} ref */
const recordOf = (root, ref) => records(root).find((held) => (held.refs ?? []).includes(ref)) ?? { id: '' };

/** A task of a person's own made in Tick under the task titled `parent`. @param {string} root @param {string} title @param {string} parent */
function childOf(root, title, parent) {
  tick(root, ['create', '--parent', idOf(root, parent), '--', title]);
}

/**
 * The task titled `title` started, as a person might in Tick, then its
 * parent put back to open in the store by hand — Tick starts a parent with
 * its child, so only a store edited or merged by hand holds a parent open
 * beside a child in progress.
 * @param {string} root @param {string} title
 */
function startUnderOpen(root, title) {
  tick(root, ['start', idOf(root, title)]);
  const { parent } = /** @type {{parent?: string}} */ (records(root).find((task) => /** @type {{title?: string}} */ (task).title === title));
  const held = records(root).map((task) => (task.id === parent ? { ...task, status: 'open' } : task));
  fs.writeFileSync(path.join(root, '.tick', 'tasks.jsonl'), `${held.map((task) => JSON.stringify(task)).join('\n')}\n`);
}

/** A phase of the unit linked after the task titled `after`, as a person might in Tick. @param {string} root @param {string} unit @param {number} phase @param {string} after */
function phaseAfter(root, unit, phase, after) {
  tick(root, ['dep', 'add', recordOf(root, `phase:${unit}-${phase}`).id, idOf(root, after)]);
}

/**
 * The task titled `title` linked after a task the store does not hold, as a
 * store edited or merged by hand might leave it — Tick's remove takes the
 * links to a task with it.
 * @param {string} root @param {string} title
 */
function linkAfterGone(root, title) {
  const held = records(root).map((task) => (/** @type {{title?: string}} */ (task).title === title ? { ...task, blocked_by: ['tick-ffffff'] } : task));
  fs.writeFileSync(path.join(root, '.tick', 'tasks.jsonl'), `${held.map((task) => JSON.stringify(task)).join('\n')}\n`);
}

/**
 * A plan as the workflows wrote it into Tick before Leeway: its root, each
 * phase a child of it titled with its number, each task a child of its
 * phase, every one carrying the old plan's id in its refs — `{topic}`,
 * `{topic}-{N}`, `{topic}-{N}-{n}` — and each task the old type and its
 * tags, the old plan's own where none are given, and the text the old plan
 * wrote it, where given. Answers Tick's ids of the root and of each phase.
 * @param {string} root @param {string} topic @param {{title: string, tasks: (string|{title: string, text?: string, tags?: string[]})[]}[]} phases
 * @returns {{root: string, phases: string[]}}
 */
function oldPlan(root, topic, phases) {
  const planRoot = tick(root, ['create', '--refs', topic, '--', topic]).id;
  return {
    root: planRoot,
    phases: phases.map(({ title, tasks }, at) => {
      const phase = tick(root, ['create', '--parent', planRoot, '--refs', `${topic}-${at + 1}`, '--', `Phase ${at + 1}: ${title}`]).id;
      for (const [n, given] of tasks.entries()) {
        const { title: named, text, tags = ['api', 'planned'] } = typeof given === 'string' ? { title: given } : given;
        const flags = [...(tags.length === 0 ? [] : ['--tags', tags.join(',')]), ...(text === undefined ? [] : ['--description', text])];
        tick(root, ['create', '--parent', phase, '--type', 'task', ...flags, '--refs', `${topic}-${at + 1}-${n + 1}`, '--', named]);
      }
      return phase;
    }),
  };
}

/** The task titled `title` started, marked done or cancelled in Tick, as the old plan's process left it. @param {string} root @param {'start'|'done'|'cancel'} act @param {string} title */
function taskByHand(root, act, title) {
  tick(root, [act, idOf(root, title)]);
}

/** The tags the task titled `title` holds, as the store keeps them: the driver keeps a task's type among them. @param {string} root @param {string} title @returns {string[]} */
function tagsOf(root, title) {
  return /** @type {{title: string, tags?: string[]}[]} */ (records(root)).find((held) => held.title === title)?.tags ?? [];
}

/** The task titled `title` given refs of a person's own up to the ten Tick keeps on one. @param {string} root @param {string} title */
function fillRefs(root, title) {
  const id = idOf(root, title);
  const { refs } = tick(root, ['show', id]);
  tick(root, ['update', id, '--refs', [...refs, ...Array.from({ length: 10 - refs.length }, (_, k) => `mine-${k + 1}`)].join(',')]);
}

/**
 * The store's records, by id, each as it stands but for the engine's names
 * for `unit` among its refs and when it last changed — what adopting the
 * unit's plan leaves as it was — and, where `types` is false, for the type
 * the driver keeps as its tags, which the migration's cut gives a task not
 * ended.
 * @param {string} root @param {string} unit @param {boolean} [types]
 */
function apartFromNames(root, unit, types = true) {
  const names = new RegExp(`^(unit:${unit}|phase:${unit}-[0-9]+|task:${unit}-[0-9]+-[0-9]+)$`);
  return records(root)
    .map(({ updated, ...held }) => {
      const { tags, ...kept } = /** @type {{tags?: string[]}} */ (held);
      return { ...(types ? held : kept), refs: (held.refs ?? []).filter((ref) => !names.test(ref)) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Tick's statuses as the engine words them. @type {Record<string, string>} */
const WORDED = { open: 'open', in_progress: 'in-progress', done: 'done', cancelled: 'closed' };

/**
 * What Tick itself answers of a phase, or of the unit where `phase` is
 * null — its list, and the tasks ready to start — as the engine's rows, in
 * the engine's order, a task of a person's own passed by.
 * @param {string} root @param {string} unit @param {number|null} phase
 */
function toolAnswers(root, unit, phase) {
  /** @type {Map<string, TaskRef>} */
  const named = new Map();
  for (const { id, refs = [] } of records(root)) {
    const step = refs.filter((ref) => ref.startsWith(`task:${unit}-`)).map((ref) => stepOfId(ref.slice('task:'.length)))[0];
    if (step) named.set(id, { unit, phase: step.phase, n: step.n });
  }
  /** @param {{id: string, title: string, status: string}[]} listed */
  const rows = (listed) => listed.filter(({ id }) => named.has(id))
    .map(({ id, title, status }) => ({ ref: named.get(id), title, status: WORDED[status] }))
    .sort((a, b) => a.ref.phase - b.ref.phase || a.ref.n - b.ref.n);
  const parent = recordOf(root, phase === null ? `unit:${unit}` : `phase:${unit}-${phase}`).id;
  return { list: rows(tick(root, ['list', '--parent', parent])), ready: rows(tick(root, ['ready', '--parent', parent, '--status', 'open'])) };
}

/**
 * Each task of the old plan for `topic`, by its title, where it stands in
 * the engine's words, with the reason it was closed with, or null.
 * @param {string} root @param {string} topic @returns {Record<string, [string, string|null]>}
 */
function planStanding(root, topic) {
  const task = new RegExp(`^${topic}-[0-9]+-[0-9]+$`);
  return Object.fromEntries(records(root).filter(({ refs = [] }) => refs.some((ref) => task.test(ref))).map(({ title, status, notes = [] }) => {
    const closed = [...notes].reverse().find(({ text }) => text.startsWith('Closed: '));
    return [title, [WORDED[status], closed === undefined ? null : closed.text.slice('Closed: '.length)]];
  }));
}

/**
 * A folder path whose names read in part like Tick's ids, each kept from
 * reading as one by one side alone: an id's shape after a `/`, then one
 * after a `+` running on into more of a name.
 */
const LOOKALIKE_FOLDER = path.join('tick-cafe', 'x+tick-cafe-old');

/** A one-line title Tick refuses: over its 500 characters. */
const REFUSED_TITLE = 'x'.repeat(501);

module.exports = {
  projectStore, addRef, makeTask, typeCleared, linkBy, reopenTask, removeTask, breakStore, garbleStore, setStoreWritable, byHand, childOf, startUnderOpen, phaseAfter, linkAfterGone,
  oldPlan, taskByHand, fillRefs, tagsOf, apartFromNames, planStanding, toolAnswers, REFUSED_TITLE, LOOKALIKE_FOLDER,
};
