'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a task's account (12.14) — `task account <unit> <task>`, the
// route by which a task's account and its review rounds' reports reach the
// state branch (6.3.13). The builder writes the account as the task lands,
// at `build/tasks/{task}.md`, beside the task as the tracker holds it
// (12.14.4, 12.14.8, 12.14.9); its reviewers' reports are beside it already
// (round-report.cjs). The verb checks both, computes the task's figures,
// and commits them, pushed.
//
// The account is markdown under five level-two headings, in this order, and
// no other heading at level one or two (12.14.5, 12.14.6):
//
//   ## What was done          what the work does, in product terms
//   ## Where in the code
//   ## What the tests prove
//   ## Differs from the task  a list, an item for each way the work differs
//                             from the task as written (list-items.cjs), an
//                             item beginning `None` never one; or `None` as
//                             all it holds
//   ## Reviews                `### Round N`, in any case, over a short
//                             summary of each review round, from 1, one for
//                             every round the task's reports hold, and after
//                             each round the orchestrator settled, wherever
//                             it sits, `### Settled` over what was done about
//                             it; nothing else
//
// Nothing comes before its first heading and no section is empty. It holds
// Claude's words and diagrams, never a status or a figure: the engine
// counts (15.3.4).
//
// The figures, `figures.json` beside the reports, the engine's alone: the
// files changed and the lines added and removed across every repository
// holding the task's branch (landing-git.cjs), from the parent of the
// branch's first commit naming the task (`Leeway-Task`, commit-task.cjs) to
// its tip, so the tasks a stack holds below it are not counted — a
// repository where the branch holds none of the task's commits counts
// nothing, and work merged into the branch above its first commit counts
// as the task's; the acceptance criteria the task holds (task-file.cjs);
// when it started, its `task start`'s state commit, null where none was
// made; and when it finished, as the account is taken.
//
// An account is taken once the task's last round passed, or once the
// orchestrator settled it. `task settle <unit> <task> --file <why>` is that
// settlement, of a task that looks stuck (13.4.6): the file's text, why and
// what was done, at `round-{N}-settled.md` beside the round's reports, the
// engine's alone, committed, pushed. It refuses where the task's last round
// passed or is settled already.
//
// Each verb refuses, writing and committing nothing, every refusal opening
// `task {verb}: `: a unit or a task the project lacks; a task done or closed
// — the account is taken, and a round settled, as the task lands, before it
// is done; a task with no review round's reports, a round missing a
// reviewer's report or holding one that does not read. The account refuses
// besides: a task a question waiting parks, naming its raise (13.4.6,
// task-parks.cjs); a last round neither passed nor settled; no account
// written, or one that does not read, every fault named; a task with no type,
// from which its branch is named; and no repository of the project holding
// work on its branch. Settling refuses no such file, or one holding nothing.
// Each runs under the writer lock (engine.cjs); a commit git refuses is a
// warning, the files written.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { git, tryGit } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { writeJsonAtomic, writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { TRAILER } = require('./commit-task.cjs');
const { headingLevels } = require('./spec-sections.cjs');
const { BULLET, listItems, saysNone, saysNoneIn } = require('./list-items.cjs');
const { criteriaOf } = require('./task-file.cjs');
const { parseShownTask, shownTask, taskId, taskName } = require('./task-id.cjs');
const { taskBranch } = require('./landing-names.cjs');
const { holdingBranch } = require('./landing-git.cjs');
const { trackedTask, givenText, ENDED } = require('./task-verbs.cjs');
const { refuseParked } = require('./task-parks.cjs');
const { taskFolder, settlementPath, taskRounds } = require('./round-report.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./round-report.cjs').Round} Round */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {{files: number, added: number, removed: number}} Change */
/** @typedef {Change & {criteria: number, started: string|null, finished: string}} Figures */
/** @typedef {(reason: string) => never} Refuse */

/** The account's sections, as their headings read, in order. */
const SECTIONS = Object.freeze(['What was done', 'Where in the code', 'What the tests prove', 'Differs from the task', 'Reviews']);

/** The heading under `## Reviews` that follows each round the orchestrator settled. */
const SETTLED = 'Settled';

/** An item of `## Differs from the task`, its text. */
const DIFFERENCE = new RegExp(`^${BULLET}(\\S.*)$`);

/** The refusal of `task {verb}`. @param {string} verb @returns {Refuse} */
function refuserFor(verb) {
  return (reason) => {
    throw new Error(`task ${verb}: ${reason}`);
  };
}

/** `fn`'s answer, its refusal the verb's. @template T @param {Refuse} refuse @param {() => T} fn @returns {T} */
function refusing(refuse, fn) {
  try {
    return fn();
  } catch (err) {
    return refuse(messageOf(err));
  }
}

/** A task's account, state-relative. @param {TaskRef} ref */
function accountPath(ref) {
  return `${ref.unit}/build/tasks/${shownTask(ref)}.md`;
}

/** A task's figures, state-relative. @param {TaskRef} ref */
function figuresPath(ref) {
  return `${taskFolder(ref)}/figures.json`;
}

/** @typedef {{title: string, lines: string[], levels: number[]}} Section */

/**
 * The lines before the first heading at `level`, then each heading at it
 * with the lines and their levels below it, to the next.
 * @param {string[]} lines @param {number[]} levels @param {number} level
 */
function sectionsAt(lines, levels, level) {
  /** @type {string[]} */
  const lead = [];
  /** @type {Section[]} */
  const sections = [];
  lines.forEach((line, at) => {
    if (levels[at] === level) sections.push({ title: line.replace(/^#+[ \t]*/, '').trim(), lines: [], levels: [] });
    else if (sections.length === 0) lead.push(line);
    else {
      sections[sections.length - 1].lines.push(line);
      sections[sections.length - 1].levels.push(levels[at]);
    }
  });
  return { lead, sections };
}

/** Whether lines hold nothing but blanks. @param {string[]} lines */
const blank = (lines) => lines.every((line) => line.trim() === '');

/** How many ways the work differs, `## Differs from the task` as written; null where it is no list and says no `None`. @param {string[]} lines */
function differences(lines) {
  if (saysNone(lines)) return 0;
  const { items } = listItems(lines, DIFFERENCE);
  return items.length === 0 ? null : items.filter(({ opened }) => !saysNoneIn(opened[1])).length;
}

/**
 * Each summary under `## Reviews`, in order — each round's, and after each
 * round the orchestrator settled, the settlement's — what is amiss given
 * the task's rounds pushed to `faults`.
 * @param {Section} reviews @param {number} rounds @param {readonly number[]} settled the rounds settled @param {string[]} faults
 * @returns {string[]}
 */
function summariesOf(reviews, rounds, settled, faults) {
  const { lead, sections } = sectionsAt(reviews.lines, reviews.levels, 3);
  const wanted = Array.from({ length: rounds }, (_, at) => [`Round ${at + 1}`, ...(settled.includes(at + 1) ? [SETTLED] : [])]).flat();
  if (!blank(lead)) faults.push('## Reviews holds nothing but its rounds\' summaries, each under `### Round N`');
  if (sections.map(({ title }) => title.toLowerCase()).join('\n') !== wanted.join('\n').toLowerCase()) {
    const each = `each of the task's ${rounds} review round${rounds === 1 ? '' : 's'}`;
    const headings = wanted.map((title) => `\`### ${title}\``).join(', ');
    faults.push(settled.length > 0
      ? `## Reviews summarises ${each}, under ${headings} — after each round the orchestrator settled, what was done about it, under \`### ${SETTLED}\``
      : `## Reviews summarises ${each}, under ${headings}`);
  }
  faults.push(...sections.filter((section) => blank(section.lines)).map(({ title }) => `### ${title} is empty`));
  return sections.map((section) => section.lines.join('\n').trim());
}

/**
 * The account read by its grammar (the header's), given how many review
 * rounds the task's reports hold and those the orchestrator settled: each
 * section's text by its heading, how many ways the work differs from the
 * task, and each summary under `## Reviews`. Refused where it does not
 * read, every fault named.
 * @param {string} text @param {number} rounds @param {readonly number[]} [settled] the rounds settled
 * @returns {{sections: Record<string, string>, differs: number, reviews: string[]}}
 */
function readAccount(text, rounds, settled = []) {
  const lines = text.trimEnd().split(/\r\n?|\n/);
  const levels = headingLevels(lines);
  const { lead, sections } = sectionsAt(lines, levels, 2);
  /** @type {string[]} */
  const faults = [];
  if (levels.includes(1)) faults.push('it holds a level-one heading — an account has no title, only its sections');
  if (!blank(lead)) faults.push(`it opens with \`## ${SECTIONS[0]}\``);
  if (sections.map(({ title }) => title).join('\n') !== SECTIONS.join('\n')) {
    faults.push(`its sections are ${SECTIONS.map((title) => `\`## ${title}\``).join(', ')}, in that order, and no other at level two`);
    throw new Error(faults.join('; '));
  }
  const [, , , differs, reviews] = sections;
  faults.push(...sections.filter((section) => blank(section.lines)).map(({ title }) => `## ${title} is empty`));
  const count = differences(differs.lines);
  if (count === null && !blank(differs.lines)) faults.push(`## ${differs.title} is a list, an item for each way the work differs from the task, or \`None.\``);
  const reviewed = blank(reviews.lines) ? [] : summariesOf(reviews, rounds, settled, faults);
  if (faults.length > 0) throw new Error(faults.join('; '));
  return {
    sections: Object.fromEntries(sections.map((section) => [section.title, section.lines.join('\n').trim()])),
    differs: /** @type {number} */ (count),
    reviews: reviewed,
  };
}

/** The tree with nothing in it, in a repository's own hash. @param {Repo} repo */
function emptyTree(repo) {
  return git(repo.path, ['hash-object', '-t', 'tree', '--stdin'], undefined, '').trim();
}

/**
 * The task's change in one repository holding its branch: from the parent
 * of the branch's first commit naming the task to its tip; none where the
 * branch holds no commit naming it.
 * @param {Repo} repo @param {string} branch @param {string} id @returns {Change}
 */
function changeIn(repo, branch, id) {
  const [first] = git(repo.path, ['log', '--reverse', '--format=%H', `--grep=^${TRAILER}: ${id}$`, `refs/heads/${branch}`, '--']).split('\n');
  if (first === '') return { files: 0, added: 0, removed: 0 };
  const from = tryGit(repo.path, ['rev-parse', '--verify', '--quiet', `${first}^`])?.trim() ?? emptyTree(repo);
  const rows = git(repo.path, ['diff', '--numstat', '--find-renames', from, `refs/heads/${branch}`, '--']).split('\n').filter((row) => row !== '');
  return rows.reduce((sum, row) => {
    const [added, removed] = row.split('\t').map(Number);
    return { files: sum.files + 1, added: sum.added + (added || 0), removed: sum.removed + (removed || 0) };
  }, { files: 0, added: 0, removed: 0 });
}

/** When the task started: its `task start`'s state commit, null where none was made. @param {string} cwd @param {TaskRef} ref */
function startedAt(cwd, ref) {
  const made = isolatedGit(stateRoot(cwd)).tryRun(['log', '--reverse', '--format=%aI', '-E', `--grep=^task\\(${ref.unit}\\): start ${ref.phase}\\.${ref.n}$`]);
  const [first = ''] = (made ?? '').split('\n');
  return first === '' ? null : new Date(first).toISOString();
}

/**
 * The task's figures (the header's), finished now; refused where no
 * repository of the project holds work on its branch.
 * @param {string} cwd @param {TaskRef} ref @param {TaskDetail} task @param {Refuse} refuse
 * @returns {Figures}
 */
function figuresOf(cwd, ref, task, refuse) {
  const branch = taskBranch(ref, /** @type {string} */ (task.type), task.title);
  const { holding } = holdingBranch(ref.unit, projectRepos(codeRoot(cwd)), branch);
  if (holding.length === 0) refuse(`no repository of the project holds work on ${taskName(ref)}'s branch, ${branch}`);
  const change = holding.map((repo) => changeIn(repo, branch, taskId(ref))).reduce(
    (sum, part) => ({ files: sum.files + part.files, added: sum.added + part.added, removed: sum.removed + part.removed }),
    { files: 0, added: 0, removed: 0 },
  );
  return { ...change, criteria: criteriaOf(task.text), started: startedAt(cwd, ref), finished: new Date().toISOString() };
}

/**
 * The task a verb is given, not yet ended, with its review rounds, refused
 * where it has none.
 * @param {string} cwd @param {string} unit @param {string} given @param {Refuse} refuse @param {string} ended what an ended task's refusal says
 * @returns {{ref: TaskRef, task: ReturnType<typeof trackedTask>, rounds: Round[], last: Round}}
 */
function reviewedTask(cwd, unit, given, refuse, ended) {
  const ref = refusing(refuse, () => parseShownTask(unit, given));
  const task = refusing(refuse, () => trackedTask(cwd, ref));
  if (ENDED.includes(task.status)) refuse(`${taskName(ref)} is ${task.status} — ${ended}`);
  const rounds = refusing(refuse, () => taskRounds(cwd, ref));
  const last = rounds.at(-1);
  if (last === undefined) return refuse(`${taskName(ref)} has no review round's reports — its reviewers write them in ${taskFolder(ref)}/`);
  return { ref, task, rounds, last };
}

/** The account as written, refused where none is. @param {string} cwd @param {TaskRef} ref @param {Refuse} refuse */
function writtenAccount(cwd, ref, refuse) {
  const file = statePath(cwd, accountPath(ref));
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) refuse(`${taskName(ref)} has no account — its builder writes it at ${accountPath(ref)}`);
  return fs.readFileSync(file, 'utf8');
}

/**
 * The answer of a verb that committed `files`, the commit's outcome noted.
 * @param {string} cwd @param {string[]} files @param {string} message @param {string[]} warnings @param {Record<string, unknown>} answer
 */
function committed(cwd, files, message, warnings, answer) {
  const outcome = commitStateTail(cwd, files, message, warnings);
  /** @type {Record<string, unknown>} */
  const result = { ...answer, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * `task account`: the task's account and its rounds' reports checked, its
 * figures computed, and all of them committed.
 * @param {string} cwd @param {string} unit @param {string} given
 */
function takeAccount(cwd, unit, given) {
  const refuse = refuserFor('account');
  const { ref, task, rounds, last } = reviewedTask(cwd, unit, given, refuse, 'its account is taken as it lands, before task done');
  refuseParked(cwd, ref, 'task account');
  if (!last.passes && !last.settled) {
    refuse(`round ${last.round} of ${taskName(ref)} did not pass — an account is taken once every reviewer of a round passes the task, or the orchestrator settles it: engine task settle ${unit} ${shownTask(ref)} --file <why>`);
  }
  const text = writtenAccount(cwd, ref, refuse);
  const settled = rounds.filter((round) => round.settled).map(({ round }) => round);
  refusing(refuse, () => {
    try {
      return readAccount(text, rounds.length, settled);
    } catch (err) {
      throw new Error(`${accountPath(ref)} does not read as an account — ${messageOf(err)}`);
    }
  });
  if (task.type === null) refuse(`${taskName(ref)} has no type in the tracker, and its branch is named from it`);
  const figures = figuresOf(cwd, ref, task, refuse);
  writeJsonAtomic(statePath(cwd, figuresPath(ref)), figures);
  const files = [
    accountPath(ref),
    ...rounds.flatMap(({ round, reports, settled }) => [...reports.map(({ file }) => file), ...(settled ? [settlementPath(ref, round)] : [])]),
    figuresPath(ref),
  ];
  return committed(cwd, files, `task(${unit}): account ${shownTask(ref)}`, [...(task.warnings ?? [])], {
    task: shownTask(ref), id: taskId(ref), rounds: rounds.length, ...(settled.length > 0 ? { settled } : {}), figures,
  });
}

/**
 * `task settle`: the orchestrator's settlement of the task's failed last
 * round written from its file, and committed.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} file
 */
function settleTask(cwd, unit, given, file) {
  const refuse = refuserFor('settle');
  const { ref, task, last } = reviewedTask(cwd, unit, given, refuse, 'a round is settled as the task lands, before task done');
  if (last.passes) refuse(`round ${last.round} of ${taskName(ref)} passed — only a failed round is settled; its account is taken as it stands`);
  if (last.settled) refuse(`round ${last.round} of ${taskName(ref)} is settled already — ${settlementPath(ref, last.round)}`);
  const why = refusing(refuse, () => givenText(cwd, file, 'settle by'));
  const at = statePath(cwd, settlementPath(ref, last.round));
  fs.mkdirSync(path.dirname(at), { recursive: true });
  writeTextAtomic(at, `${why}\n`);
  return committed(cwd, [settlementPath(ref, last.round)], `task(${unit}): settle ${shownTask(ref)}, round ${last.round}`, [...(task.warnings ?? [])], {
    task: shownTask(ref), id: taskId(ref), round: last.round,
  });
}

module.exports = { SECTIONS, accountPath, figuresPath, readAccount, takeAccount, settleTask };
