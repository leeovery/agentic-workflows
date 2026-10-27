'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the workflows' trace in the code tree — what tells a project
// whose state was lost from one being set up (4.5.2). The workflows commit
// three files outside the state (6.3.15): the project's Claude Code
// settings, which carry their hooks; the worktree include; and the
// `.gitignore`, which names the state. Any of them naming the workflows is
// the trace.
//
// The state's ignore line is the main checkout's: the state sits at the
// repository's top, which a nested project's own `.gitignore` cannot reach.
// Boot writes it only once the state exists, so the trace never stands
// without the state, and keeps it there every boot, as it keeps the hooks.
//
// The layout before the state branch — `.workflows/` on the code branch — is
// read here too: its state moves onto `leeway-state` by the migration alone.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { STATE_DIR_NAME, stateRoot } = require('../kernel/state-root.cjs');
const { commitPathspecScoped, WORKTREE_INCLUDE } = require('./commit.cjs');
const { readProjectSettings } = require('./settings.cjs');
const { carriesOurHooks } = require('./session-label.cjs');

const GITIGNORE = '.gitignore';
const STATE_IGNORE_LINE = `${STATE_DIR_NAME}/`;
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

/** The main checkout's `.gitignore`, where the state's ignore line goes. @param {string} cwd */
function mainIgnoreFile(cwd) {
  return path.join(path.dirname(stateRoot(cwd)), GITIGNORE);
}

/**
 * Whether the code tree holds the workflows' trace: one of their hooks in
 * the project's settings, or a line naming the state in its worktree
 * include or `.gitignore` — the code root's, or the main checkout's, where
 * the state's ignore line goes.
 * @param {string} cwd
 * @returns {boolean}
 */
function holdsTrace(cwd) {
  if (carriesOurHooks(readProjectSettings(cwd).settings)) return true;
  const root = codeRoot(cwd);
  const files = new Set([path.join(root, WORKTREE_INCLUDE), path.join(root, GITIGNORE), mainIgnoreFile(cwd)]);
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
 * Keep the state's ignore line in the main checkout's `.gitignore`: append
 * it where no line ignores the state folder whole, and commit the file
 * through the code door, confined to it. The state stands without the line,
 * so a file that cannot be written, or a commit git refuses, is a warning.
 * @param {string} cwd @param {string[]} warnings
 * @returns {boolean} this boot wrote the line
 */
function keepStateIgnored(cwd, warnings) {
  const file = mainIgnoreFile(cwd);
  try {
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (content.split('\n').some(ignoresState)) return false;
    const separator = content === '' || content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(file, `${content}${separator}${STATE_IGNORE_LINE}\n`);
  } catch (err) {
    warnings.push(`the state's ignore line was not written to ${file}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  try {
    commitPathspecScoped(path.dirname(file), GITIGNORE, `chore: ignore ${STATE_IGNORE_LINE}, the workflows state`);
  } catch (err) {
    warnings.push(`the state's ignore line is in ${file} but was not committed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return true;
}

module.exports = { STATE_IGNORE_LINE, holdsTrace, onLegacyLayout, keepStateIgnored };
