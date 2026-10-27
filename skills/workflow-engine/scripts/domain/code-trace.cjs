'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state as the code tree sees it — kept out of every code
// branch, and the workflows' trace, which tells a project whose state was
// lost from one being set up (4.5.2).
//
// - Kept out: the state folder sits in the main checkout, ignored by every
//   branch and every worktree through the repository's own exclude file,
//   which is never committed — so a branch whose `.gitignore` never named it,
//   one cut before setup among them, never takes it in (4.1.2, 4.1.3). Boot
//   keeps the line there on every boot, before the state is put in place.
// - The trace: the workflows' hooks in the project's Claude Code settings, or
//   a line naming the state in its `.gitignore` (6.3.15). Boot writes that
//   line as it keeps the hooks: in the session's own code tree, committed on
//   the branch checked out there, and only once the state exists, so the
//   trace never stands without the state. A project nested in a larger
//   repository keeps it in its own `.gitignore`, beside its own settings,
//   where the trace is read: the exclude file does the ignoring, so the line
//   reaches nothing outside the project. Never while git is in the middle of
//   a merge, cherry-pick, revert or rebase there; a line written but not
//   committed is committed by the next boot (domain/commit,
//   `commitOwnChange`).
// - Reading the trace: each boot leaves it on the branch its session had
//   checked out, so no one checkout answers for the project. Where the state
//   is missing everywhere, and only there, the trace is read across the
//   repository: every tree checked out, and the tip of every branch, local
//   and remote-tracking.
//
// The layout before the state branch — `.workflows/` on the code branch — is
// read here too: its state moves onto `leeway-state` by the migration alone.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { operationInProgress } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { STATE_DIR_NAME, stateRoot } = require('../kernel/state-root.cjs');
const { commitOwnChange } = require('./commit.cjs');
const { SETTINGS_SPEC, parseSettings } = require('./settings.cjs');
const { carriesOurHooks } = require('./session-label.cjs');
const { readBlobs } = require('./state-merge-blobs.cjs');

const GITIGNORE = '.gitignore';
const STATE_IGNORE_LINE = `${STATE_DIR_NAME}/`;
const STATE_EXCLUDE_LINE = `/${STATE_DIR_NAME}/`;
const LEGACY_STATE_DIR = '.workflows';
/** The folder in the git dir the branch tips' blobs are read through, cleared after. */
const TRACE_SCRATCH = 'leeway-trace-read';

/** A file's text, null where it cannot be read. @param {string} file @returns {string|null} */
function textOf(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** An ignore-syntax line's pattern, from the project's top. @param {string} line */
function patternOf(line) {
  return line.trim().replace(/^!/, '').replace(/^\//, '');
}

/** Whether an ignore-syntax line names the state folder or a path in it. @param {string} line */
function namesState(line) {
  const pattern = patternOf(line);
  return pattern === STATE_DIR_NAME || pattern.startsWith(`${STATE_DIR_NAME}/`);
}

/** Whether an ignore-syntax line ignores the state folder whole. @param {string} line */
function ignoresState(line) {
  return !line.trim().startsWith('!') && [STATE_DIR_NAME, STATE_IGNORE_LINE].includes(patternOf(line));
}

/**
 * Ignore-syntax `content` with `line` appended, or null where a line there
 * already ignores the state folder whole.
 * @param {string} content @param {string} line
 * @returns {string|null}
 */
function withLine(content, line) {
  if (content.split('\n').some(ignoresState)) return null;
  const separator = content === '' || content.endsWith('\n') ? '' : '\n';
  return `${content}${separator}${line}\n`;
}

/**
 * Keep `line` in the ignore-syntax `file` (`withLine`), making the file and
 * its folder where they are not there.
 * @param {string} file @param {string} line
 */
function keepLine(file, line) {
  const next = withLine(textOf(file) ?? '', line);
  if (next === null) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
}

/** Whether a file's text carries the trace, by the file it is, named from the project. */
const TRACED = Object.freeze({
  [GITIGNORE]: (/** @type {string} */ text) => text.split('\n').some(namesState),
  [SETTINGS_SPEC]: (/** @type {string} */ text) => carriesOurHooks(parseSettings(text).settings),
});

/**
 * Every distinct text `rel` holds at the tip of a branch, local or
 * remote-tracking: where each tip holds it, in one read, then the distinct
 * blobs through the merge's batch reader, whole.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} rel from the tree's top
 * @returns {string[]}
 */
function textsAcrossBranches(git, rel) {
  const tips = git.run(['for-each-ref', '--format=%(objectname)', 'refs/heads', 'refs/remotes']).split('\n').filter(Boolean);
  if (tips.length === 0) return [];
  const listed = git.run(['cat-file', '--batch-check=%(objectname) %(objecttype)'], { input: tips.map((tip) => `${tip}:${rel}\n`).join('') });
  const oids = [...new Set(listed.split('\n').map((entry) => entry.split(' ')).filter(([, type]) => type === 'blob').map(([oid]) => oid))];
  if (oids.length === 0) return [];
  /** @type {import('./state-merge-blobs.cjs').BlobContext} */
  const ctx = { git, scratch: path.join(git.run(['rev-parse', '--absolute-git-dir']).trim(), TRACE_SCRATCH), blobs: new Map() };
  readBlobs(ctx, oids.map((oid) => [oid, Infinity]));
  return oids.map((oid) => /** @type {Buffer} */ (/** @type {import('./state-merge-blobs.cjs').Blob} */ (ctx.blobs.get(oid)).bytes).toString('utf8'));
}

/**
 * Every text `rel` holds in a tree checked out: the main checkout's and
 * every linked worktree's.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} rel from the tree's top
 * @returns {string[]}
 */
function textsCheckedOut(git, rel) {
  return git.run(['worktree', 'list', '--porcelain']).split('\n')
    .filter((entry) => entry.startsWith('worktree '))
    .map((entry) => textOf(path.join(entry.slice('worktree '.length), rel)))
    .filter((text) => text !== null);
}

/**
 * Whether the repository holds the workflows' trace for the project: one of
 * their hooks in its settings, or a line naming the state in its
 * `.gitignore` — in a tree checked out, or at the tip of any branch, local
 * or remote-tracking. It reads every branch, so it is asked only where the
 * state is missing everywhere.
 * @param {string} cwd
 * @returns {boolean}
 */
function holdsTrace(cwd) {
  const git = isolatedGit(codeRoot(cwd));
  const prefix = git.run(['rev-parse', '--show-prefix']).trim();
  return Object.entries(TRACED).some(([spec, carries]) => {
    const rel = `${prefix}${spec}`;
    return textsCheckedOut(git, rel).some(carries) || textsAcrossBranches(git, rel).some(carries);
  });
}

/**
 * Whether the project is on the layout before the state branch: its
 * `.workflows/` on the code branch checked out.
 * @param {string} cwd
 * @returns {boolean}
 */
function onLegacyLayout(cwd) {
  const listed = isolatedGit(codeRoot(cwd)).tryRun(['ls-tree', '--name-only', 'HEAD', '--', LEGACY_STATE_DIR]);
  return listed !== null && listed.trim() !== '';
}

/**
 * Keep the state folder in the repository's own exclude file, in the main
 * checkout's git directory, which every worktree shares. A file that cannot
 * be written is a warning: the state stands without it.
 * @param {string} cwd
 * @returns {string[]} warnings
 */
function keepStateExcluded(cwd) {
  const file = path.join(path.dirname(stateRoot(cwd)), '.git', 'info', 'exclude');
  try {
    keepLine(file, STATE_EXCLUDE_LINE);
    return [];
  } catch (err) {
    return [`the state folder was not added to ${file}: ${err instanceof Error ? err.message : String(err)}`];
  }
}

/**
 * Keep the state's ignore line, the trace, in the session's own code tree:
 * append it to its `.gitignore` where no line ignores the state folder
 * whole, and commit the workflows' own change to the file through the code
 * door (`commitOwnChange`) — not while git is in the middle of an operation
 * there, which the next boot waits out. The state stands without the line,
 * so a file that cannot be written, or a commit git refuses, is a warning.
 * @param {string} cwd @param {string[]} warnings
 */
function keepStateIgnored(cwd, warnings) {
  const root = codeRoot(cwd);
  if (operationInProgress(root) !== null) return;
  const file = path.join(root, GITIGNORE);
  try {
    keepLine(file, STATE_IGNORE_LINE);
  } catch (err) {
    warnings.push(`the state's ignore line was not written to ${file}: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  commitOwnChange(
    root, GITIGNORE, (committed) => withLine(committed ?? '', STATE_IGNORE_LINE),
    `chore: ignore ${STATE_IGNORE_LINE}, the workflows state`, `the state's ignore line is in ${file} but was not committed`, warnings,
  );
}

module.exports = { holdsTrace, onLegacyLayout, keepStateExcluded, keepStateIgnored };
