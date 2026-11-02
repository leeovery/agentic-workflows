'use strict';

// ---------------------------------------------------------------------------
// The task worktree suites' world and helpers (test-engine-task-worktree.cjs,
// test-engine-task-worktree-end.cjs): the nested world (landing-world.cjs)
// set to the local landing driver, phase 3's three tasks in the tracker,
// built once per suite and copied for each test; a conversation of its own
// for each that builds, its folder removed once the suite ends; the
// worktree Claude Code's isolation makes for a builder, beside the project;
// and the reads of what a layout made.
// ---------------------------------------------------------------------------

const { after } = require('node:test');
const fs = require('fs');
const path = require('path');

const { ok, call, git, tip, commitAll } = require('./engine-harness.cjs');
const { NESTED, TRACKER, track, setLandingDriver, useNestedWorld } = require('./landing-world.cjs');

/** Tracker's side of the suites (tests/drivers/{name}/task.cjs). */
const SIDE = require(path.join(__dirname, '..', 'drivers', TRACKER.name, 'task.cjs'));

const UNIT = 'pay';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);

/** Phase 3's tasks' branches, as the landing names them. */
const FEES = 'feat/pay-3.1-add-fees';
const SHOW = 'feat/pay-3.2-show-fees';
const CAP = 'feat/pay-3.3-cap-fees';

/** The suite's project: a fresh copy of the world at each call. @param {string} prefix */
function taskWorktreeWorld(prefix) {
  return useNestedWorld(prefix, (dir) => {
    setLandingDriver(dir, 'local');
    track(dir, '3.1', 'feat', 'Add fees');
    track(dir, '3.2', 'feat', 'Show fees');
    track(dir, '3.3', 'feat', 'Cap fees');
    commitAll(dir, 'phase 3\'s tasks');
  });
}

/** @type {string[]} */
const sessions = [];
after(() => sessions.forEach((session) => fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true })));

/** A call's options in the conversation `session`. @param {string} session */
const as = (session) => ({ env: { CLAUDE_CODE_SESSION_ID: session } });

/** A conversation of its own, building each of `tasks`, each started through `task start`. @param {string} dir @param {string[]} tasks */
function building(dir, tasks) {
  const session = `task-worktree-${process.pid}-${sessions.length + 1}`;
  sessions.push(session);
  for (const task of tasks) ok(dir, ['task', 'start', UNIT, task], as(session));
  return session;
}

/** The worktree Claude Code's isolation makes for a builder, on a branch of its own, beside the project. @param {string} dir @param {string} name */
function isolation(dir, name) {
  const tree = path.join(fs.realpathSync(path.dirname(dir)), 'worktrees', name);
  git(dir, ['worktree', 'add', '-q', '-b', `worktree-agent-${name}`, tree]);
  return tree;
}

/** The argv laying a task's worktree out. @param {string} task */
const layOut = (task) => ['task', 'worktree', UNIT, task];

/** Task 3.1 laid out at `tree` in the conversation `session`: its refusal, if it is refused. @param {string} tree @param {string} session @returns {{error?: string}} */
function layOutOrRefusal(tree, session) {
  const res = call(tree, layOut('3.1'), as(session));
  return res.code === 0 ? {} : { error: JSON.parse(res.stderr).error };
}

/** What a layout makes, in each repository of the nested world: its branches at their tips, and its worktrees on theirs. @param {import('./landing-world.cjs').Nested} at */
const madeIn = (at) => [at.dir, at.ext, at.lib].map((repo) => [
  git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']).split('\n').filter((line) => !line.startsWith('refs/heads/leeway-state ')),
  git(repo, ['worktree', 'list', '--porcelain']),
]);

/**
 * Each repository of a laid-out project, by its folder there — the nested
 * world's, unless given — the branch it has out and its commit.
 * @param {string} tree @param {string[]} [folders]
 */
const checkoutsOf = (tree, folders = ['.', NESTED.ext.folder, NESTED.lib.folder]) => folders.map((folder) => {
  const at = path.join(tree, folder);
  return [git(at, ['symbolic-ref', '--short', 'HEAD']).trim(), tip(at, 'HEAD')];
});

module.exports = {
  SIDE, UNIT, FEES, SHOW, CAP, taskWorktreeWorld, as, building, isolation, layOut, layOutOrRefusal, madeIn, checkoutsOf,
};
