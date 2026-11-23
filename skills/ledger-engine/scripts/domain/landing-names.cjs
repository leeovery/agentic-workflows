'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the names a task's landing takes (7.2.18), one form for every
// landing driver. A task's branch is `{type}/{unit}-{phase}.{n}-{slug}`, its
// slug made from the task's title, or `task` where the title has no letter
// or digit to make one of — the id before it already makes the branch the
// task's alone; a phase's branch is `feat/{unit}-phase-{phase}`; a
// unit's own branch, where it has one, which its phases merge into and
// which lands on the default branch at finish, is `feat/{unit}` (7.2.34,
// unit-branch.cjs); and a quick-fix's one branch, which every task of its
// build commits on, is `fix/{unit}` (fix-branch.cjs). A task's pull request title, and the
// subject of the commit it squashes to, is `{type}({unit}): {title}`, and
// the message's last line is the task's internal id as a `Task:` trailer,
// which is how a landing names its task, and the only name of one a
// landing is read by — the door's stamp never one (R28): every such line
// names a task the commit lands, so landings squashed together, their
// messages joined, land each — and a task merged by hand, named nowhere,
// has landed by its change (task-landed.cjs). A quick-fix lands as one pull
// request in each repository it touches, its title and its one commit's
// subject `{type}({unit}): {title}`
// — its type `feat` where any of its tasks is one, else `fix` where any is,
// else the first task's, `fix` where it holds none, the person's own
// commits alone — the rest of its message each of its tasks' landings in
// turn, `{type}({unit}): {its title}` in the task's own type then its
// `Task:` line (`quickFixMessage`). The type is the task's own,
// from its template (12.4.1): a lowercase word, as feat or fix. The merge
// bringing the default branch into a unit's own branch is `Merge {default}
// into feat/{unit}` (`bringUpSubject`), no conventional commit's either.
// A quick-fix's branch that conflicts with the branch it lands on, or with
// the host's copy of it, is settled by a merge in the quick-fix's worktree,
// in the repository that conflicts — `git -C {its folder}` in a nested one
// — committed through the door under a task in flight, each settled file
// named from the worktree's top (`mergedThrough`): with none in flight, a
// one-line task of its own, `merge {theirs}` (`quickFixMerged`), each
// landing driver's way on from the conflict.
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

/** A unit's own branch, where it has one (7.2.34). @param {string} unit @returns {string} */
function unitBranch(unit) {
  assertUnit(unit);
  return `feat/${unit}`;
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

const QUICK_FIX = 'fix/';

/** A quick-fix's one branch. @param {string} unit @returns {string} */
function quickFixBranch(unit) {
  assertUnit(unit);
  return `${QUICK_FIX}${unit}`;
}

/** Whether a branch is one a task of the unit's commits on: a task's own, or a quick-fix's one branch. @param {string} unit @param {string} branch @returns {boolean} */
function isWorkBranch(unit, branch) {
  return taskOfBranch(unit, branch) !== null || branch === quickFixBranch(unit);
}

/** Whether a branch is one of the unit's: a task's, a quick-fix's, a phase's or its own. @param {string} unit @param {string} branch @returns {boolean} */
function isUnitBranch(unit, branch) {
  return isWorkBranch(unit, branch) || phaseOfBranch(unit, branch) !== null || branch === unitBranch(unit);
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

/**
 * What a unit's own branch lands on the default branch under (7.2.18,
 * 7.2.38): its pull request's title, `{unit}: {title}`, and description, a
 * line for each phase merged into it; and the merge commit's subject,
 * `Merge feat/{unit}`, no conventional commit's, so a release reading
 * subjects counts each task once.
 * @param {string} unit @param {string} title @param {string[]} phases each as its line names it, in order
 * @returns {{title: string, body: string, subject: string}}
 */
function unitLanding(unit, title, phases) {
  return { title: `${unit}: ${titleOf(title)}`, body: phases.join('\n'), subject: `Merge ${unitBranch(unit)}` };
}

/**
 * The subject of the merge commit bringing the default branch, `into`, into
 * a unit's own branch (7.2.18, 7.2.36): `Merge {into} into feat/{unit}`, no
 * conventional commit's, so a release reading subjects counts each task
 * once.
 * @param {string} into @param {string} branch the unit's
 */
const bringUpSubject = (into, branch) => `Merge ${into} into ${branch}`;

/**
 * The merge of `theirs` into a quick-fix's branch in the repository at
 * `folder` of its worktree — as the shell takes it, `.` for the project's
 * own — settled and committed through the door under the task `task` shows
 * (the header's).
 * @param {string} unit @param {string} task @param {string} theirs @param {string} folder
 */
function mergedThrough(unit, task, theirs, folder) {
  const [git, under] = folder === '.' ? ['git', ''] : [`git -C ${folder}`, `${folder}/`];
  return `\`${git} merge --no-ff --no-commit ${theirs}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: \`engine commit --paths ${under}<file>… --task ${unit} ${task} -m "<message>"\``;
}

/** The way on from a quick-fix's branch conflicting with `theirs` in the repository at `folder` of its worktree, no task of the unit's in flight (the header's). @param {string} unit @param {string} theirs @param {string} folder as `mergedThrough` takes it */
const quickFixMerged = (unit, theirs, folder) => `start a one-line task, "merge ${theirs}", and in ${unit}'s worktree run ${mergedThrough(unit, '<task>', theirs, folder)}`;

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

module.exports = { slugOf, taskBranch, phaseBranch, unitBranch, quickFixBranch, phaseOfBranch, taskOfBranch, isWorkBranch, isUnitBranch, landedMessage, quickFixMessage, unitLanding, bringUpSubject, mergedThrough, quickFixMerged, landingOf, tasksOfMessage };
