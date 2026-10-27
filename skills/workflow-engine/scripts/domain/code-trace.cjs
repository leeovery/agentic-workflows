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
//   a merge, cherry-pick, revert or rebase there: the next boot writes it.
//   The main checkout's `.gitignore` is read for the trace too, as a boot
//   there writes it, so a session in a code worktree on a branch cut before
//   setup still finds it.
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
const { commitPathspecScoped } = require('./commit.cjs');
const { readProjectSettings } = require('./settings.cjs');
const { carriesOurHooks } = require('./session-label.cjs');

const GITIGNORE = '.gitignore';
const STATE_IGNORE_LINE = `${STATE_DIR_NAME}/`;
const STATE_EXCLUDE_LINE = `/${STATE_DIR_NAME}/`;
const LEGACY_STATE_DIR = '.workflows';

/** A file's lines, none where it cannot be read. @param {string} file @returns {string[]} */
function linesOf(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n');
  } catch {
    return [];
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
 * Append `line` to the ignore-syntax `file` where no line there ignores the
 * state folder whole, making the file and its folder where they are not
 * there. Answers whether it wrote.
 * @param {string} file @param {string} line
 * @returns {boolean}
 */
function keepLine(file, line) {
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (content.split('\n').some(ignoresState)) return false;
  const separator = content === '' || content.endsWith('\n') ? '' : '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${content}${separator}${line}\n`);
  return true;
}

/**
 * Whether the code tree holds the workflows' trace: one of their hooks in
 * the project's settings, or a line naming the state in its `.gitignore` or
 * the main checkout's.
 * @param {string} cwd
 * @returns {boolean}
 */
function holdsTrace(cwd) {
  if (carriesOurHooks(readProjectSettings(cwd).settings)) return true;
  const files = new Set([path.join(codeRoot(cwd), GITIGNORE), path.join(path.dirname(stateRoot(cwd)), GITIGNORE)]);
  return [...files].some((file) => linesOf(file).some(namesState));
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
 * whole, and commit the file through the code door, confined to it — not
 * while git is in the middle of an operation there, which the next boot
 * waits out. The state stands without the line, so a file that cannot be
 * written, or a commit git refuses, is a warning.
 * @param {string} cwd @param {string[]} warnings
 * @returns {boolean} this boot wrote the line
 */
function keepStateIgnored(cwd, warnings) {
  const root = codeRoot(cwd);
  const file = path.join(root, GITIGNORE);
  try {
    if (operationInProgress(root) !== null || !keepLine(file, STATE_IGNORE_LINE)) return false;
  } catch (err) {
    warnings.push(`the state's ignore line was not written to ${file}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  try {
    commitPathspecScoped(root, GITIGNORE, `chore: ignore ${STATE_IGNORE_LINE}, the workflows state`);
  } catch (err) {
    warnings.push(`the state's ignore line is in ${file} but was not committed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return true;
}

module.exports = { holdsTrace, onLegacyLayout, keepStateExcluded, keepStateIgnored };
