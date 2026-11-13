'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the migration's commit — `commit --migrations`, made on the
// person's yes at the migration gate (21.9.4).
//
// - After the migrations changed files: one commit on each side that
//   changed, under the one message — the whole state, and the files the
//   workflows own in the code tree (`OWNED_PATHS`) as the index records
//   them (commit.cjs).
// - While the reshape finishes: its finish step journals the code side's
//   drops it staged, `finish.json` in the runner's journals folder —
//   `staged`, the paths the code commit takes as the index records them,
//   and `drops`, the paths removed from disk once it lands, each named from
//   the project's folder — so the engine names neither (E9). The commit is
//   two (21.9.2, 21.9.5): the state branch's first, the whole state
//   worktree held to the layout and pushed (state-worktree.cjs,
//   `commitFirst`), then the code branch's, the owned files and the staged
//   drops, in the project's folder in the main checkout, where the
//   migration ran and staged them, wherever the commit is called from. Once
//   both have landed, the drops go from disk — the files they hold that git
//   ignores with them, and any folder they leave empty — and the journals
//   folder is cleared, the journal last. A kill between the two leaves the
//   state born and the journal there: boot answers `finish` again, and the
//   yes makes the code commit alone; a kill after the code commit, the
//   same, the yes committing nothing and finishing the rest.
// - While the migration runs and is not finished — `leeway-state` with no
//   commit yet and no journal — the commit is refused: nothing is committed
//   before the migration's commit (21.9.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, literally, shortSha } = require('../kernel/git.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { placeOf, folderUnder } = require('../kernel/repos.cjs');
const { withStateLock, migrationRuns, commitFirst } = require('./state-worktree.cjs');
const { commitStateScoped, commitStagedScoped, OWNED_PATHS } = require('./commit.cjs');

// Where the runner journals what its runs owe the run that completes,
// state-relative: in the cache, which no state commit takes.
const MIGRATION_JOURNALS = '.cache/migrate';

// The reshape's finish journal, in the journals folder.
const FINISH_JOURNAL = 'finish.json';

/** What the reshape's finish staged and what goes once its commit lands, each named from the project's folder. @typedef {{staged: string[], drops: string[]}} FinishJournal */

/** Which commits the reshape's yes still makes: the state branch's first, then the code branch's. @typedef {('state'|'code')[]} CommitsOwed */

/**
 * Whether a journal's path stays inside the project's folder.
 * @param {unknown} rel @returns {rel is string}
 */
function insideProject(rel) {
  if (typeof rel !== 'string' || rel === '' || path.isAbsolute(rel)) return false;
  const normal = path.normalize(rel);
  return normal !== '.' && normal !== '..' && !normal.startsWith(`..${path.sep}`);
}

/**
 * The reshape's finish journal, or null where there is none. Refuses one
 * that does not read as lists of paths inside the project's folder.
 * @param {string} cwd
 * @returns {FinishJournal|null}
 */
function finishJournal(cwd) {
  const file = statePath(cwd, MIGRATION_JOURNALS, FINISH_JOURNAL);
  if (!fs.existsSync(file)) return null;
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the migration's finish journal ${file} does not read: ${err instanceof Error ? err.message : String(err)}`);
  }
  const lists = isObject(journal) ? [journal.staged, journal.drops] : [];
  if (lists.length !== 2 || !lists.every((list) => Array.isArray(list) && list.every(insideProject))) {
    throw new Error(`the migration's finish journal ${file} holds no { staged, drops }, each a list of paths inside the project's folder`);
  }
  return { staged: journal.staged, drops: journal.drops };
}

/**
 * The reshape finishing: its journal, and the commits its yes still makes;
 * null where there is no journal.
 * @param {string} cwd
 * @returns {{journal: FinishJournal, commits: CommitsOwed}|null}
 */
function finishing(cwd) {
  const journal = finishJournal(cwd);
  if (journal === null) return null;
  return { journal, commits: migrationRuns(stateRoot(cwd)) ? ['state', 'code'] : ['code'] };
}

/**
 * The project's folder in the main checkout, where the migration runs and
 * stages its drops, wherever `cwd` is.
 * @param {string} cwd
 * @returns {string}
 */
function projectInMain(cwd) {
  return folderUnder(placeOf(codeRoot(cwd)), path.dirname(stateRoot(cwd)));
}

/**
 * The code files the reshape's commit takes, named from the project's
 * folder: each owned file that differs from the branch, then each staged
 * drop the branch still holds.
 * @param {string} project @param {FinishJournal} journal
 * @returns {string[]}
 */
function codeStaged(project, { staged }) {
  const differs = (/** @type {string} */ spec) => git(project, ['status', '--porcelain', '--', ...literally([spec])]).trim() !== '';
  const held = new Set(staged.length === 0 ? [] : git(project, ['ls-tree', '--name-only', 'HEAD', '--', ...literally(staged)]).split('\n'));
  return [...OWNED_PATHS.filter(differs), ...staged.filter((rel) => held.has(rel))];
}

/** Each folder above `rel` that holds nothing, up to the project's folder, removed. @param {string} project @param {string} rel */
function removeEmptyFolders(project, rel) {
  for (let folder = path.dirname(rel); folder !== '.'; folder = path.dirname(folder)) {
    const at = path.join(project, folder);
    if (!fs.existsSync(at) || fs.readdirSync(at).length > 0) return;
    fs.rmdirSync(at);
  }
}

/**
 * The drops gone from disk, and the journals folder cleared, the journal last.
 * @param {string} cwd @param {string} project @param {FinishJournal} journal
 */
function finishOff(cwd, project, { drops }) {
  for (const rel of drops) fs.rmSync(path.join(project, rel), { recursive: true, force: true });
  for (const rel of drops) removeEmptyFolders(project, rel);
  const journals = statePath(cwd, MIGRATION_JOURNALS);
  for (const name of fs.readdirSync(journals).filter((entry) => entry !== FINISH_JOURNAL)) fs.rmSync(path.join(journals, name), { recursive: true, force: true });
  fs.rmSync(journals, { recursive: true, force: true });
}

/**
 * The state branch's first commit, under the writer lock.
 * @param {string} cwd @param {string} message
 * @returns {{committed: string, warnings: string[]}}
 */
function firstCommit(cwd, message) {
  const root = stateRoot(cwd);
  const { commit, warnings } = withStateLock(root, () => commitFirst(root, message));
  return { committed: shortSha(commit), warnings };
}

/**
 * `commit --migrations`: the migration's commit — the reshape's two while
 * it finishes, else one on each side that changed. Refuses while the
 * migration runs and is not finished, committing nothing.
 * @param {string} cwd @param {string} message
 * @returns {{state: {committed: string|null, warnings: string[]}, code: string|null}}
 */
function commitMigrations(cwd, message) {
  const finish = finishing(cwd);
  if (finish === null) {
    if (migrationRuns(stateRoot(cwd))) {
      throw new Error('the migration is not finished, so nothing is committed before its commit — boot carries it on, and its commit is made at its end');
    }
    return { state: commitStateScoped(cwd, '.', message), code: commitStagedScoped(cwd, OWNED_PATHS, message) };
  }
  const state = finish.commits.includes('state') ? firstCommit(cwd, message) : { committed: null, warnings: [] };
  const project = projectInMain(cwd);
  const code = commitStagedScoped(project, OWNED_PATHS, message, finish.journal.staged);
  finishOff(cwd, project, finish.journal);
  return { state, code };
}

module.exports = { MIGRATION_JOURNALS, FINISH_JOURNAL, finishing, projectInMain, codeStaged, commitMigrations };
