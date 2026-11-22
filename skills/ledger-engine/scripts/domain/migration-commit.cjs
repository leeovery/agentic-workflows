'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the migration's commit — `commit --migrations`, made on the
// person's yes at the migration gate (21.9.4).
//
// - After the migrations changed files: one commit on each side that
//   changed, under the one message — the whole state, and the files
//   Ledger owns in the code tree (`OWNED_PATHS`) as the index records
//   them (commit.cjs).
// - While the reshape finishes: its finish step journals what goes from
//   the code side, `finish.json` in the runner's journals folder — `drops`,
//   each named from the project's folder — so the engine names none (E9).
//   The commit is two (21.9.2, 21.9.5): the state branch's first, the whole
//   state worktree held to the layout and pushed (state-worktree.cjs,
//   `commitFirst`), then the code branch's, in the project's folder in the
//   main checkout, where the migration ran, wherever the commit is called
//   from: the owned files, and the drops taken out of it through the
//   commit's own index, their files left on disk. Nothing of the
//   migration's is staged before the yes, so a commit of the person's own
//   meanwhile takes none of it. Whether the state branch is born is read
//   from the repository's refs, so a project folder moved meanwhile, its
//   state worktree unopened until boot relinks it, still owes the first
//   commit, which refuses there. Once the state branch is born and the code
//   branch holds none of the drops, nothing is left for the yes to commit:
//   the drops go from the person's index, then from disk — the files they
//   hold that git ignores with them, and any folder they leave empty — and
//   the journals folder is cleared, the journal last. The yes does that
//   once its commits land, and boot does it where a kill after the code
//   commit left it undone (`finishOwed`). A kill between the two leaves the
//   state born and the code branch holding the drops: boot answers `finish`
//   again, and the yes makes the code commit alone.
// - While the migration runs and is not finished — `ledger-state` with no
//   commit yet and no journal — the commit is refused: nothing is committed
//   before the migration's commit (21.9.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, literally, shortSha, untrack } = require('../kernel/git.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { placeOf, folderUnder } = require('../kernel/repos.cjs');
const { withStateLock, migrationRuns, stateBorn, commitFirst } = require('./state-worktree.cjs');
const { commitStateScoped, commitStagedScoped, OWNED_PATHS } = require('./commit.cjs');

// The record of the migrations applied, state-relative, which the runner
// writes and a directive's close appends to.
const MIGRATIONS_RECORD = '.state/migrations';

// Where the runner journals what its runs owe the run that completes,
// state-relative: in the cache, which no state commit takes.
const MIGRATION_JOURNALS = '.cache/migrate';

// The reshape's finish journal, in the journals folder.
const FINISH_JOURNAL = 'finish.json';

/** What goes from the code side once the reshape's commit lands, each named from the project's folder. @typedef {{drops: string[]}} FinishJournal */

/** Which commits the reshape's yes still makes: the state branch's first, then the code branch's. @typedef {('state'|'code')[]} CommitsOwed */

/**
 * The reshape finishing: its journal, the project's folder in the main
 * checkout, the drops the code branch still holds, and the commits its yes
 * still makes.
 * @typedef {{journal: FinishJournal, project: string, held: string[], commits: CommitsOwed}} Finishing
 */

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
 * that does not read as a list of paths inside the project's folder.
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
  if (!isObject(journal) || !Array.isArray(journal.drops) || !journal.drops.every(insideProject)) {
    throw new Error(`the migration's finish journal ${file} holds no { drops }, a list of paths inside the project's folder`);
  }
  return { drops: journal.drops };
}

/** Whether the reshape waits on its commit: its finish journal is there, read or not. @param {string} cwd */
function finishWaits(cwd) {
  return fs.existsSync(statePath(cwd, MIGRATION_JOURNALS, FINISH_JOURNAL));
}

/**
 * Whether a migration waits on its review's yes: the migrations record on
 * disk is not the one the state branch holds, as boot leaves it while the
 * review's commit is to take it (boot.cjs `commitRecord`). One read and one
 * git call; no record on disk waits on nothing.
 * @param {string} cwd
 */
function reviewWaits(cwd) {
  let record;
  try {
    record = fs.readFileSync(statePath(cwd, MIGRATIONS_RECORD), 'utf8');
  } catch {
    return false;
  }
  return isolatedGit(stateRoot(cwd)).tryRun(['show', `HEAD:${MIGRATIONS_RECORD}`]) !== record;
}

/**
 * The project's folder in the main checkout, where the migration runs,
 * wherever `cwd` is.
 * @param {string} cwd
 * @returns {string}
 */
function projectInMain(cwd) {
  return folderUnder(placeOf(codeRoot(cwd)), path.dirname(stateRoot(cwd)));
}

/** The drops the code branch holds, in the project's folder. @param {string} project @param {string[]} drops @returns {string[]} */
function heldDrops(project, drops) {
  if (drops.length === 0) return [];
  const held = new Set(git(project, ['ls-tree', '--name-only', 'HEAD', '--', ...literally(drops)]).split('\n'));
  return drops.filter((rel) => held.has(rel));
}

/**
 * The reshape finishing, or null where there is no journal: the state
 * branch's first commit owed while it has none, and the code branch's while
 * it has none or the code branch holds a drop.
 * @param {string} cwd
 * @returns {Finishing|null}
 */
function finishing(cwd) {
  const journal = finishJournal(cwd);
  if (journal === null) return null;
  const project = projectInMain(cwd);
  const held = heldDrops(project, journal.drops);
  /** @type {CommitsOwed} */
  const commits = !stateBorn(stateRoot(cwd)) ? ['state', 'code'] : held.length > 0 ? ['code'] : [];
  return { journal, project, held, commits };
}

/**
 * The code files the reshape's commit takes, named from the project's
 * folder: each owned file that differs from the branch, then each drop the
 * branch holds.
 * @param {Finishing} finish
 * @returns {string[]}
 */
function codeFiles({ project, held }) {
  const differs = (/** @type {string} */ spec) => git(project, ['status', '--porcelain', '--', ...literally([spec])]).trim() !== '';
  return [...OWNED_PATHS.filter(differs), ...held];
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
 * The drops gone from the person's index, then from disk, and the journals
 * folder cleared, the journal last.
 * @param {string} cwd @param {Finishing} finish
 */
function finishOff(cwd, { project, journal: { drops } }) {
  untrack(project, drops);
  for (const rel of drops) fs.rmSync(path.join(project, rel), { recursive: true, force: true });
  for (const rel of drops) removeEmptyFolders(project, rel);
  const journals = statePath(cwd, MIGRATION_JOURNALS);
  for (const name of fs.readdirSync(journals).filter((entry) => entry !== FINISH_JOURNAL)) fs.rmSync(path.join(journals, name), { recursive: true, force: true });
  fs.rmSync(journals, { recursive: true, force: true });
}

/**
 * The reshape finishing while its yes still has a commit to make, or null:
 * where there is no journal, and where nothing is left to commit — the
 * drops then gone from disk and the journals cleared, under the writer lock.
 * @param {string} cwd
 * @returns {Finishing|null}
 */
function finishOwed(cwd) {
  const finish = finishing(cwd);
  if (finish === null || finish.commits.length > 0) return finish;
  withStateLock(stateRoot(cwd), () => finishOff(cwd, finish));
  return null;
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
  const code = finish.commits.includes('code') ? commitStagedScoped(finish.project, OWNED_PATHS, message, finish.journal.drops) : null;
  finishOwed(cwd);
  return { state, code };
}

module.exports = { MIGRATIONS_RECORD, MIGRATION_JOURNALS, finishWaits, reviewWaits, finishing, finishOwed, projectInMain, codeFiles, commitMigrations };
