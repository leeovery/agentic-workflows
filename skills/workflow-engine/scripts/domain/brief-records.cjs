'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the records a brief is filled from (6.5.4, 13.11.2), each
// drawn in one fixed form, so what an agent is told is what the records
// say and nothing else (6.5.6):
//
//   task           the task's text whole, as the tracker holds it, each of
//                  its headings a level down, under the template's own; then
//                  each addition, in order, under a heading of its own saying
//                  whether the orchestrator or the person added it (13.11.3)
//   spec-sections  each section the task's spec reference cites, verbatim
//                  from the unit's spec (spec-sections.cjs)
//   decided-calls  the unit's current decisions at its own level, the
//                  person's and Claude's alike, in the ledger's order, each
//                  one list item: its id, whose it is, its answer and why,
//                  every line after its first indented
//   linters        the project's linters, each its name and its command,
//                  from the environment on the project manifest (22.5.12)
//   diff-range     in each repository holding the task's branch, by the
//                  landing's rule (landing-git.cjs), under a heading naming
//                  the repository, the range from its base to the branch,
//                  `{base}...{branch}`, and its `git diff --stat` — never
//                  the diff's text, which can run to thousands of lines and
//                  is read in the range. The base is the branch `--base`
//                  names where the repository has it, else the repository's
//                  default branch: a nested repository's may be named
//                  otherwise, and a stack's base branch be in some only
//   report-a,      the report its flag's path points to, verbatim, a file
//   report-b       in the unit's `build/` folder (4.11.5)
//
// A record taking a flag names it, and its role takes every flag its records
// name and no other; a flag carries a name or a path, never text that
// reaches the brief (6.5.6). A record the project holds none of yet is drawn
// as none recorded. One that cannot be read refuses the brief: a task with
// no spec reference, a section the spec lacks, linters of another shape, a
// task's branch no repository holds work on, a base no repository holding it
// has as a local branch, a report missing, empty or outside the unit's
// `build/`. Nothing else of the project reaches a brief — its CLAUDE.md and
// its skills reach the agent without it (6.5.5).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { git } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { readProjectManifest } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { readShown } = require('./ledger-read.cjs');
const { recordOf, standingOf } = require('./ledger-fold.cjs');
const { readCitedSections, headingLevels } = require('./spec-sections.cjs');
const { specReferenceOf } = require('./task-file.cjs');
const { taskName } = require('./task-id.cjs');
const { taskBranch } = require('./landing-names.cjs');
const { branches, holdingBranch, defaultBranch, plain } = require('./landing-git.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * What a brief is filled for: the project, the task where its role takes
 * one, as the tracker holds it, and each flag given, by its name.
 * @typedef {{cwd: string, ref: TaskRef|null, task: TaskDetail|null, given: Readonly<Record<string, string>>}} Filling
 */

/** A flag a record takes: its name, and its value as a usage line shows it. @typedef {{name: string, value: string}} BriefFlag */

/**
 * A record: whether it is a task's, the flag it takes, if any, and its
 * drawn form; what a read said on the way pushed to `warnings`.
 * @typedef {{ofTask: boolean, flag?: BriefFlag, draw: (filling: Filling, warnings: string[]) => string}} BriefRecord
 */

const NONE = 'None recorded.';

/** Whose an entry is, as a brief says it. @type {Readonly<Record<string, string>>} */
const WHOSE = Object.freeze({ person: 'the person\'s', claude: 'Claude\'s' });

/** A drawn list, a line an item, or none recorded. @param {string[]} items */
function listed(items) {
  return items.length === 0 ? NONE : items.join('\n');
}

/** The task, and the ref it was read by, for a record that is a task's. @param {Filling} filling */
function taskOf({ ref, task }) {
  if (ref === null || task === null) throw new Error('brief-records: a task\'s record is drawn for a task');
  return { ref, task };
}

/** Markdown with each heading a level down, a fenced block's lines aside. @param {string} text */
function headingsDown(text) {
  const lines = text.split('\n');
  const levels = headingLevels(lines);
  return lines.map((line, at) => (levels[at] > 0 ? `#${line}` : line)).join('\n');
}

/** Text whose every line after its first is indented, to stay in a list item. @param {string} text */
const indented = (text) => text.split('\n').join('\n  ');

/** @param {Filling} filling */
function drawTask(filling) {
  const { task } = taskOf(filling);
  return [headingsDown(task.text), ...task.additions.map(({ by, text }) => `## Added by the ${by}\n\n${text}`)].join('\n\n');
}

/** @param {Filling} filling */
function drawSpecSections(filling) {
  const { ref, task } = taskOf(filling);
  const reference = specReferenceOf(task.text);
  if (reference === null) throw new Error(`${taskName(ref)} holds no spec reference`);
  return readCitedSections(filling.cwd, ref.unit, reference).map((section) => section.text).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawDecidedCalls(filling, warnings) {
  const { ref } = taskOf(filling);
  return readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => listed(
    recordOf(folded, ref.unit, null).decisions
      .filter((id) => standingOf(folded, id).topic === null)
      .map((id) => {
        const { id: short, by, text, why } = show(id);
        return `- ${short}, ${WHOSE[/** @type {string} */ (by)]}: ${indented(String(text))}\n  Why: ${indented(String(why))}`;
      }),
  ));
}

/** Whether a value is text with something in it. @param {unknown} value */
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/** @param {Filling} filling */
function drawLinters({ cwd }) {
  const { environment } = readProjectManifest(cwd);
  if (environment === undefined) return NONE;
  const linters = isObject(environment) ? environment.linters : null;
  if (linters === undefined) return NONE;
  if (!Array.isArray(linters) || !linters.every((linter) => isObject(linter) && filled(linter.name) && filled(linter.command))) {
    throw new Error('the project manifest\'s environment.linters is not a list of {name, command}');
  }
  return listed(linters.map(({ name, command }) => `- ${name}: ${command}`));
}

/**
 * The range in one repository, under a heading naming it, and its stat.
 * @param {Repo} repo @param {string} base @param {string} branch
 */
function rangeIn(repo, base, branch) {
  const where = repo.dir === '' ? 'the project\'s repository' : `\`${plain(repo.dir)}\``;
  const stat = git(repo.path, ['diff', '--no-color', '--stat', `refs/heads/${base}...refs/heads/${branch}`, '--']);
  return `## In ${where}: \`${base}...${branch}\`\n\n${stat === '' ? 'Nothing changed in the range.' : `\`\`\`\n${stat}\`\`\``}`;
}

/**
 * Each repository's base for the range: the one given where it is a local
 * branch there, else the repository's default branch, as the landing picks
 * it; refused where no repository has the one given, so a misnamed base
 * never passes as the default.
 * @param {string} cwd @param {Repo[]} holding @param {string} given @param {string} what the branch, as a refusal names it
 */
function basesOf(cwd, holding, given, what) {
  const has = holding.map((repo) => branches(repo.path).has(given));
  if (!has.includes(true)) throw new Error(`the base ${given} is no local branch in any repository holding ${what}`);
  return holding.map((repo, at) => {
    if (has[at]) return given;
    return defaultBranch(repo.path, repo.dir === '' ? remoteName(cwd) : nestedRemoteName(repo.path), repo.dir !== '');
  });
}

/** @param {Filling} filling */
function drawDiffRange(filling) {
  const { ref, task } = taskOf(filling);
  if (task.type === null) throw new Error(`${taskName(ref)} has no type in the tracker, and its branch is named from it`);
  const branch = taskBranch(ref, task.type, task.title);
  const what = `${taskName(ref)}'s branch, ${branch}`;
  const { holding } = holdingBranch(ref.unit, projectRepos(codeRoot(filling.cwd)), branch);
  if (holding.length === 0) throw new Error(`no repository of the project holds work on ${what}`);
  const bases = basesOf(filling.cwd, holding, filling.given.base, what);
  return holding.map((repo, at) => rangeIn(repo, bases[at], branch)).join('\n\n');
}

/** The folder of a unit's build records. */
const BUILD = 'build';

/** A report's text, refused where there is no file. @param {string} file @param {string} flag */
function readReport(file, flag) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    const { code } = /** @type {NodeJS.ErrnoException} */ (err);
    if (code === 'ENOENT' || code === 'EISDIR') throw new Error(`the --${flag} report, ${file}, is no file`);
    throw err;
  }
}

/** @param {Filling} filling @param {string} flag */
function drawReport(filling, flag) {
  const { ref } = taskOf(filling);
  const build = statePath(filling.cwd, ref.unit, BUILD);
  const file = path.resolve(filling.cwd, filling.given[flag]);
  const within = path.relative(build, file);
  if (within === '' || within.split(path.sep)[0] === '..' || path.isAbsolute(within)) {
    throw new Error(`the --${flag} report, ${file}, is not in ${ref.unit}'s ${BUILD} folder, ${build}`);
  }
  const text = readReport(file, flag);
  if (text.trim() === '') throw new Error(`the --${flag} report, ${file}, is empty`);
  return text;
}

/** A record drawing the report its flag points to. @param {string} flag @returns {BriefRecord} */
function reportRecord(flag) {
  return { ofTask: true, flag: { name: flag, value: 'path' }, draw: (filling) => drawReport(filling, flag) };
}

/** Every record, by the slot that draws it. @type {Readonly<Record<string, BriefRecord>>} */
const RECORDS = Object.freeze({
  task: { ofTask: true, draw: drawTask },
  'spec-sections': { ofTask: true, draw: drawSpecSections },
  'decided-calls': { ofTask: true, draw: drawDecidedCalls },
  linters: { ofTask: false, draw: drawLinters },
  'diff-range': { ofTask: true, flag: { name: 'base', value: 'branch' }, draw: drawDiffRange },
  'report-a': reportRecord('report-a'),
  'report-b': reportRecord('report-b'),
});

module.exports = { RECORDS };
