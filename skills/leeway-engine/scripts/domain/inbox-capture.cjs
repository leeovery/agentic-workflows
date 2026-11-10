'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the capture line (18.6.1–18.6.3, 18.6.8) — `inbox capture
// <idea|bug|quick-fix> [--project <folder>]`, the one engine call a capture
// skill makes, from a session in any project.
//
// The item's text comes on stdin, markdown opening on its title, its first
// `# Title`. It is written at `.inbox/{folder}/{YYYY-MM-DD}--{slug}.md`, the
// slug its title's, a name the inbox holds already today, its archive
// included, taking the next free `-{n}` (inbox.cjs, `freeItemPath`); and
// committed and pushed, a push that fails a warning, a commit that fails the
// retry noted, from the named project's folder where it is another's. Its
// state is found as every verb finds it, from any checkout or worktree of
// the project (kernel/state-root) — `--project`'s, read from the caller's
// folder, where the item concerns another project — and it holds that
// state's writer lock itself across its name, its write and its commit, the
// dispatch's lock being the caller's project's. It refuses a folder that
// holds no state, a kind it does not know and a text with no title, writing
// nothing.
//
// It answers its JSON line, then one line drawn for the person:
// `Logged {kind}: "{title}"`, naming the project where it is not the one
// the caller's folder is in.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { KIND_FOLDER, freeItemPath } = require('./inbox.cjs');
const { titleOf } = require('./start.cjs');
const { slugOf } = require('./landing-names.cjs');
const { projectName } = require('./state-checks.cjs');
const { captureReceipt } = require('./projections/transactions.cjs');

const CAPTURE_USAGE = 'inbox capture <idea|bug|quick-fix> [--project <folder>]';

/**
 * @typedef {object} Captured
 * @property {{captured: string, committed: string|null, warnings?: string[], note?: string}} response
 * @property {string} receipt  its line, drawn
 */

/**
 * The capture line (the header's).
 * @param {string} cwd @param {string} kind @param {string} text
 * @param {string} [project] the folder of the project it concerns, where it is another's
 * @returns {Captured}
 */
function captureItem(cwd, kind, text, project) {
  const at = project === undefined ? cwd : path.resolve(cwd, project);
  const root = findStateRoot(at);
  if (root === null) throw new Error(`inbox capture: ${at} holds no Leeway state — name the folder of a project that has it: --project <folder>`);
  if (!Object.hasOwn(KIND_FOLDER, kind)) throw new Error(`inbox capture: its kind is one of ${Object.keys(KIND_FOLDER).join(', ')}, not "${kind}"`);
  const title = titleOf(text);
  if (title === null) throw new Error('inbox capture: its text, on stdin, holds its title, `# Title`');
  return withStateLock(root, () => {
    const rel = freeItemPath(at, KIND_FOLDER[kind], slugOf(title));
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), `${text.replace(/\n*$/, '')}\n`);
    /** @type {string[]} */
    const warnings = [];
    const outcome = commitStateTail(at, [rel], `workflow(inbox): capture ${path.posix.basename(rel, '.md').replace(/^\d{4}-\d{2}-\d{2}--/, '')}`, warnings);
    /** @type {Captured['response']} */
    const response = { captured: path.join(root, rel), committed: outcome.committed };
    if (warnings.length > 0) response.warnings = warnings;
    noteCommitOutcome(response, outcome, '--inbox');
    const another = findStateRoot(cwd) !== root;
    if (another && outcome.failed) response.note = `${response.note}, run from ${at}`;
    return { response, receipt: captureReceipt(kind, title, another ? projectName(at) : null) };
  });
}

module.exports = { CAPTURE_USAGE, captureItem };
