'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the names a task's landing takes (7.2.18), one form for every
// landing driver. A task's branch is `{type}/{unit}-{phase}.{n}-{slug}`, its
// slug made from the task's title, or `task` where the title has no letter
// or digit to make one of — the id before it already makes the branch the
// task's alone; a phase's branch is `feat/{unit}-phase-{phase}`; and a
// quick-fix's one branch, which every task of its build commits on, is
// `fix/{unit}` (fix-branch.cjs). A task's pull request title, and the
// subject of the commit it squashes to, is `{type}({unit}): {title}`, and
// the message's last line is the task's internal id as a `Task:` trailer,
// which is how a task is read back off git: every such line names a task
// the commit lands, so landings squashed together, their messages joined,
// land each. A quick-fix lands as one pull request in each repository it
// touches, its title and its one commit's subject `{type}({unit}): {title}`
// — its type `feat` where any of its tasks is one, else `fix` where any is,
// else the first task's, `fix` where it holds none, the person's own
// commits alone — the rest of its message each of its tasks' landings in
// turn, `{type}({unit}): {its title}` in the task's own type then its
// `Task:` line (`quickFixMessage`). The type is the task's own,
// from its template (12.4.1): a lowercase word, as feat or fix. A commit
// pointing submodules at their landings is `chore({unit}): point {folders}
// at its landing`, `their` for more than one (`pointedMessage`), naming no
// task; on a branch of its own, `chore/{unit}-point-submodules`.
// ---------------------------------------------------------------------------

const { KEBAB_SLUG } = require('../kernel/manifest-schema.cjs');
const { assertUnit, taskId, parseTaskId, shownTask } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

const TYPE = /^[a-z]+$/;
const NUMBER = '[1-9][0-9]*';
const SLUG_MAX = 48;
const NO_SLUG = 'task';
// A task's id, as a line naming it ends in.
const ID = /^\S+$/;
// Every character that ends a line: CR and LF, NEL, and the line and paragraph separators.
const LINE_BREAK = /[\r\n\u0085\u2028\u2029]/;

/** Refuses a type that is not a lowercase word. @param {string} type */
function assertType(type) {
  if (!TYPE.test(type)) throw new Error(`land: the task's type is a lowercase word, as feat or fix — got "${type}"`);
}

/** The title, trimmed; refuses one that is empty or runs past a line. @param {string} title @returns {string} */
function titleOf(title) {
  const trimmed = title.trim();
  if (trimmed === '' || LINE_BREAK.test(trimmed)) throw new Error(`land: the task's title is one line of text — got ${JSON.stringify(title)}`);
  return trimmed;
}

/** The Latin letters no accent decomposes, by the letters they are written as. */
const LATIN = Object.freeze({ \u00df: 'ss', \u00e6: 'ae', \u0153: 'oe', \u00f8: 'o', \u0142: 'l', \u0111: 'd', \u00f0: 'd', \u00fe: 'th', \u0131: 'i' });

/**
 * The slug a title names a branch by: its words, lowercase letters and
 * digits joined by hyphens, as many whole words as fit in 48 characters.
 * @param {string} title
 * @returns {string}
 */
function slugOf(title) {
  const latin = title.toLowerCase().replace(/[\u00df\u00e6\u0153\u00f8\u0142\u0111\u00f0\u00fe\u0131]/g, (letter) => LATIN[/** @type {keyof typeof LATIN} */ (letter)]);
  const [first, ...rest] = latin.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) ?? [NO_SLUG];
  let slug = first.slice(0, SLUG_MAX);
  for (const word of rest) {
    if (slug.length + 1 + word.length > SLUG_MAX) break;
    slug = `${slug}-${word}`;
  }
  return slug;
}

/** A task's branch. @param {TaskRef} ref @param {string} type @param {string} title @returns {string} */
function taskBranch(ref, type, title) {
  assertType(type);
  return `${type}/${ref.unit}-${shownTask(ref)}-${slugOf(titleOf(title))}`;
}

/** A phase's branch. @param {string} unit @param {number} phase @returns {string} */
function phaseBranch(unit, phase) {
  assertUnit(unit);
  return `feat/${unit}-phase-${phase}`;
}

/** The unit's phase a branch is the branch of, or null. @param {string} unit @param {string} branch @returns {number|null} */
function phaseOfBranch(unit, branch) {
  const named = new RegExp(`^feat/${unit}-phase-(${NUMBER})$`).exec(branch);
  return named === null ? null : Number(named[1]);
}

/** The unit's task a branch is the branch of, or null. @param {string} unit @param {string} branch @returns {TaskRef|null} */
function taskOfBranch(unit, branch) {
  const named = new RegExp(`^[a-z]+/${unit}-(${NUMBER})\\.(${NUMBER})-${KEBAB_SLUG}$`).exec(branch);
  return named === null ? null : { unit, phase: Number(named[1]), n: Number(named[2]) };
}

/** A quick-fix's one branch. @param {string} unit @returns {string} */
function quickFixBranch(unit) {
  assertUnit(unit);
  return `fix/${unit}`;
}

/** The branch a commit pointing the unit's submodules at their landings lands from, where it needs one of its own. @param {string} unit @returns {string} */
function pointerBranch(unit) {
  assertUnit(unit);
  return `chore/${unit}-point-submodules`;
}

/** The message of a commit pointing submodules at their landings, each folder as a refusal names it. @param {string} unit @param {string[]} folders @returns {string} */
function pointedMessage(unit, folders) {
  return `chore(${unit}): point ${folders.join(', ')} at ${folders.length === 1 ? 'its' : 'their'} landing\n`;
}

/** Whether a branch is one a task of the unit's commits on: a task's own, or a quick-fix's one branch. @param {string} unit @param {string} branch @returns {boolean} */
function isWorkBranch(unit, branch) {
  return taskOfBranch(unit, branch) !== null || branch === quickFixBranch(unit);
}

/** Whether a branch is one of the unit's: a task's, a quick-fix's or a phase's. @param {string} unit @param {string} branch @returns {boolean} */
function isUnitBranch(unit, branch) {
  return isWorkBranch(unit, branch) || phaseOfBranch(unit, branch) !== null;
}

/**
 * The message a task lands under: its subject, then its id as a trailer.
 * @param {TaskRef} ref @param {string} type @param {string} title
 * @returns {string}
 */
function landedMessage(ref, type, title) {
  assertType(type);
  return `${type}(${ref.unit}): ${titleOf(title)}\n\nTask: ${taskId(ref)}\n`;
}

/** The type a quick-fix's subject takes from its tasks' (the header's). @param {string[]} types in order */
const quickFixType = (types) => ['feat', 'fix'].find((type) => types.includes(type)) ?? types[0] ?? 'fix';

/**
 * The message a quick-fix lands under: its subject, then each of its tasks'
 * landings in turn, so its one commit names each.
 * @param {string} unit @param {string} title @param {{ref: TaskRef, type: string, title: string}[]} tasks in order
 * @returns {string}
 */
function quickFixMessage(unit, title, tasks) {
  const landings = tasks.map((task) => landedMessage(task.ref, task.type, task.title).trimEnd());
  return `${[`${quickFixType(tasks.map((task) => task.type))}(${unit}): ${titleOf(title)}`, ...landings].join('\n\n')}\n`;
}

/** The task a line naming one by `key` names, or null. @param {string} line @param {string} key @returns {TaskRef|null} */
function taskOfLine(line, key) {
  const value = line.startsWith(`${key}: `) ? line.slice(key.length + 2) : '';
  if (!ID.test(value)) return null;
  try {
    return parseTaskId(value);
  } catch {
    return null;
  }
}

/**
 * The unit's tasks a landed commit's message names, each once, in its order
 * — by its `Task:` lines, or, where `key` is given, its lines naming a task
 * by that key, as the door's stamp does (commit-task.cjs).
 * @param {string} unit @param {string} message @param {string} [key]
 * @returns {TaskRef[]}
 */
function tasksOfMessage(unit, message, key = 'Task') {
  const ids = new Set(message.split('\n').map((line) => taskOfLine(line, key)).filter((ref) => ref !== null && ref.unit === unit).map((ref) => taskId(/** @type {TaskRef} */ (ref))));
  return [...ids].map(parseTaskId);
}

/**
 * The unit's tasks a commit's message names by either mark a quick-fix's
 * landing reads (7.2.22): its `Task:` lines, then its lines naming a task
 * by `key`, the door's stamp — a task named by both once.
 * @param {string} unit @param {string} message @param {string} key
 * @returns {TaskRef[]}
 */
function tasksNamedIn(unit, message, key) {
  const ids = new Set([...tasksOfMessage(unit, message), ...tasksOfMessage(unit, message, key)].map(taskId));
  return [...ids].map(parseTaskId);
}

/**
 * The unit's landings among commits, newest first, by the task each lands:
 * the newest of each task's.
 * @param {string} unit @param {{sha: string, message: string}[]} commits
 * @returns {Map<string, string>} the commit, by the task, shown
 */
function landingsByTask(unit, commits) {
  /** @type {Map<string, string>} */
  const landings = new Map();
  for (const { sha, message } of commits) {
    for (const ref of tasksOfMessage(unit, message)) if (!landings.has(shownTask(ref))) landings.set(shownTask(ref), sha);
  }
  return landings;
}

/**
 * The type and title a task's landing carries in a commit's message — the
 * last subject of the unit's above its `Task:` line — or null where there is
 * none.
 * @param {TaskRef} ref @param {string} message
 * @returns {{type: string, title: string}|null}
 */
function landingOf(ref, message) {
  const lines = message.split('\n');
  const id = lines.indexOf(`Task: ${taskId(ref)}`);
  const subject = new RegExp(`^([a-z]+)\\(${ref.unit}\\): (.+)$`);
  for (const line of lines.slice(0, id === -1 ? lines.length : id).reverse()) {
    const named = subject.exec(line);
    if (named !== null) return { type: named[1], title: named[2] };
  }
  return null;
}

module.exports = { slugOf, taskBranch, phaseBranch, quickFixBranch, pointerBranch, pointedMessage, phaseOfBranch, taskOfBranch, isWorkBranch, isUnitBranch, landedMessage, quickFixMessage, landingOf, tasksOfMessage, tasksNamedIn, landingsByTask };
