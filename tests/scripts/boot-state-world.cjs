'use strict';

// The world the boot-state suites share (test-engine-boot-state-*.cjs): a
// temp folder per test (`useWorld`); a code project, on a bare remote or a
// remote the test names, from the library's project worlds; a project boot
// has set up, made once per process and copied (`setUp`); boot run from the
// library's stub engine (`engine`, `STUB_ENGINE`), its migration runner a
// stand-in; the workflows' own hooks as boot installs them; and the reads
// the assertions make: the state worktree in place, what a stopped boot
// leaves, a boot with nothing to do.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { git, readState, statePath, traced, folderFrom, WORKFLOW_HOOKS, hooked } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, STATE_LOCK_REASON, inspectState } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

/** The running test's folder, once the calling file has taken `useWorld`. @type {() => string} */
let world;

/** A temp folder for each test of the calling file: its getter. */
function useWorld() {
  world = useTempFolder('boot-state-');
  return world;
}

/** The project settings boot installs: the workflows' own hooks. */
const OWN_SETTINGS = hooked(WORKFLOW_HOOKS);

const engine = harness.stubEngine();
const STUB_ENGINE = engine.path;

// --- the worlds -------------------------------------------------------------

/**
 * A project in the running test's folder with one code commit on `main` —
 * Portal by default — and `origin` where `remote` names a remote, `main`
 * pushed there: its main checkout.
 * @param {{name?: string, remote?: string|null}} [opts]
 */
function projectInWorld({ name = 'portal', remote = null } = {}) {
  const { main } = harness.codeProject(world(), { name });
  if (remote !== null) {
    git(main, ['remote', 'add', 'origin', remote]);
    git(main, ['push', '-q', 'origin', 'main']);
  }
  return main;
}

/**
 * A project in the running test's folder, Portal by default, on a bare
 * remote beside it, `main` pushed there.
 * @param {{name?: string}} [opts]
 * @returns {{main: string, bare: string}}
 */
function remoteProject({ name = 'portal' } = {}) {
  const { main, bare } = harness.codeProject(world(), { name, remote: true });
  return { main, bare: /** @type {string} */ (bare) };
}

/** A clone of the remote in the running test's folder. @param {string} remote @param {string} name @param {string[]} [args] */
function cloneInWorld(remote, name, args = []) {
  return harness.cloneOf(remote, path.join(world(), name), args);
}

/** @param {string} dir @param {Record<string, string|undefined>} [env] */
function boot(dir, env = {}) {
  return engine.ok(dir, ['boot'], { env });
}

/** @param {string} dir @param {Record<string, string|undefined>} [env] */
function bootRefused(dir, env = {}) {
  return engine.refuses(dir, ['boot'], { env }).error;
}

/** @type {Map<string, (dir: string) => string>} */
const setUps = new Map();

/**
 * A project boot set up, its code — the state's ignore line and the hooks
 * boot committed — pushed where it has a remote; each shape made once per
 * process and copied into the running test's folder.
 * @param {{name?: string, remote?: boolean}} [opts]
 * @returns {{main: string, root: string, bare: string|null}}
 */
function setUp({ name = 'portal', remote = false } = {}) {
  const key = JSON.stringify({ name, remote });
  if (!setUps.has(key)) {
    setUps.set(key, folderFrom(`boot-state-${name}-`, (folder) => {
      const { main } = harness.codeProject(folder, { name, remote });
      assert.strictEqual(boot(main).state, 'ready');
      if (remote) git(main, ['push', '-q', 'origin', 'main']);
    }));
  }
  const at = /** @type {(dir: string) => string} */ (setUps.get(key))(world());
  const main = path.join(at, name);
  return { main, root: statePath(main), bare: remote ? path.join(at, `${name}.git`) : null };
}

/** The state worktree's place: its registration and its folder. @param {string} root */
function placed(root) {
  const { worktree, folder } = inspectState(root);
  return { worktree, folder };
}

const IN_PLACE = { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' };

/** What a boot with nothing to do leaves as it found. @param {string} main @param {string|null} bare */
function snapshot(main, bare) {
  return {
    refs: git(main, ['for-each-ref', '--format=%(refname) %(objectname)']),
    worktrees: git(main, ['worktree', 'list', '--porcelain']),
    link: readState(main, '.git'),
    code: git(main, ['log', '--format=%H', '-n', '3']),
    remote: bare === null ? '' : git(bare, ['for-each-ref', '--format=%(refname) %(objectname)']),
  };
}

/**
 * Boot again and find nothing to do: nothing moved, no worktree touched, no
 * fetch or push, and the remote asked once where there is one.
 * @param {string} main @param {string|null} bare @param {Record<string, string|undefined>} [env]
 */
function bootsWithNothingToDo(main, bare, env = {}) {
  const before = snapshot(main, bare);
  const { result, commands } = traced(() => boot(main, env));
  assert.deepStrictEqual(snapshot(main, bare), before, 'the second boot moved something');
  assert.deepStrictEqual(commands.filter((c) => /^(worktree (?!list)|push|fetch|commit-tree|branch)/.test(c)), [], 'the second boot repaired something');
  assert.strictEqual(commands.filter((c) => c.startsWith('ls-remote ')).length, bare === null ? 0 : 1, 'the remote was asked other than once');
  assert.deepStrictEqual([result.state, result.warnings], ['ready', []]);
  return result;
}

/** A remote out of reach: `origin` pointed at a folder that is not there. @param {string} dir */
function outOfReach(dir) {
  git(dir, ['remote', 'set-url', 'origin', path.join(world(), 'nowhere.git')]);
}

/** What a stopped boot must leave as it was. @param {string} main @param {string|null} bare */
function untouched(main, bare) {
  return {
    refs: git(main, ['for-each-ref']),
    status: git(main, ['status', '--porcelain', '--ignored']),
    worktrees: git(main, ['worktree', 'list', '--porcelain']),
    remote: bare === null ? '' : git(bare, ['for-each-ref']),
  };
}

module.exports = {
  useWorld, OWN_SETTINGS, STUB_ENGINE, engine, projectInWorld, remoteProject, cloneInWorld, boot, bootRefused, setUp, placed, IN_PLACE, bootsWithNothingToDo, outOfReach, untouched,
};
