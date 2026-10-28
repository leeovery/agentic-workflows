'use strict';

// The world the boot-state suites share (test-engine-boot-state-*.cjs): a
// temp folder per test (`useWorld`); a code project, with a bare remote
// where one is given, and clones of it; boot run from a copy of the engine
// beside a stand-in migration runner (`engine`, `STUB_ENGINE`), which
// records the state branch's tip where STUB_MIGRATE_MARK names a file; the
// workflows' own hooks as boot installs them; and the reads the assertions
// make: the state worktree in place, what a stopped boot leaves, a
// boot with nothing to do.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { templateFolder, useTempFolder, createFile, readFile } = require('./discovery-test-utils.cjs');
const { git, initRepo, testIdentity } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const {
  STATE_BRANCH, STATE_LOCK_REASON, inspectState, withStateLock, commitState,
} = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

/** The running test's folder, once the calling file has taken `useWorld`. @type {() => string} */
let world;

/** A temp folder for each test of the calling file: its getter. */
function useWorld() {
  world = useTempFolder('boot-state-');
  return world;
}

// The workflows' own hooks, as boot installs them.
const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const LAYOUT_GROUP = { matcher: 'Write|Edit|NotebookEdit', hooks: [{ type: 'command', command: `${HOOK_ENGINE} layout guard` }] };
const WORKFLOW_HOOKS = JSON.stringify({
  hooks: {
    SessionEnd: [{ hooks: ['presence cleanup', 'conversation end'].map((verb) => ({ type: 'command', command: `${HOOK_ENGINE} ${verb}` })) }],
    PreToolUse: [LAYOUT_GROUP],
  },
}, null, 2) + '\n';

// A migration runner that runs nothing. Where STUB_MIGRATE_MARK names a
// file, it records there the state branch's tip as it found it: that it ran,
// and what state it ran over.
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
if (process.env.STUB_MIGRATE_MARK) {
  const tip = require('child_process').execFileSync('git', ['rev-parse', '${STATE_BRANCH}'], { encoding: 'utf8' });
  require('fs').appendFileSync(process.env.STUB_MIGRATE_MARK, tip);
}
process.stdout.write('[SKIP] No changes needed\\n---MIGRATIONS_RUN---\\n{"ran":0}\\n');
`;

/** The engine copied beside the stand-in runner, which boot finds beside itself. */
function stubbedEngine() {
  const skills = templateFolder('boot-state-skills-');
  fs.cpSync(path.dirname(SCRIPTS), path.join(skills, 'workflow-engine'), { recursive: true });
  fs.mkdirSync(path.join(skills, 'workflow-migrate/scripts'), { recursive: true });
  fs.writeFileSync(path.join(skills, 'workflow-migrate/scripts/migrate.cjs'), STUB_MIGRATE);
  return path.join(skills, 'workflow-engine/scripts/engine.cjs');
}

const STUB_ENGINE = stubbedEngine();
const engine = harness.harness(STUB_ENGINE);

// --- the worlds -------------------------------------------------------------

/**
 * A project with one code commit on `main` — Portal by default — and `origin`
 * where `remote` names one, `main` pushed there.
 * @param {{name?: string, remote?: string|null}} [opts]
 */
function codeProject({ name = 'portal', remote = null } = {}) {
  const main = initRepo(path.join(world(), name));
  createFile(main, 'README.md', `# ${name}\n`);
  git(main, ['add', 'README.md']);
  git(main, ['commit', '-q', '-m', 'code']);
  if (remote !== null) {
    git(main, ['remote', 'add', 'origin', remote]);
    git(main, ['push', '-q', 'origin', 'main']);
  }
  return main;
}

/** A clone of the remote, under the test identity. @param {string} remote @param {string} name @param {string[]} [args] */
function cloneOf(remote, name, args = []) {
  const dir = path.join(world(), name);
  git(world(), ['clone', '-q', ...args, remote, dir]);
  testIdentity(dir);
  return dir;
}

/** @param {string} dir @param {Record<string, string|undefined>} [env] */
function boot(dir, env = {}) {
  return engine.ok(dir, ['boot'], { env });
}

/** @param {string} dir @param {Record<string, string|undefined>} [env] */
function bootRefused(dir, env = {}) {
  return engine.refuses(dir, ['boot'], { env }).error;
}

/**
 * A project boot set up, its code — the state's ignore line and the hooks
 * boot committed — pushed where it has a remote.
 * @param {{name?: string, remote?: string|null}} [opts]
 */
function setUp(opts = {}) {
  const main = codeProject(opts);
  assert.strictEqual(boot(main).state, 'ready');
  if (opts.remote) git(main, ['push', '-q', 'origin', 'main']);
  return { main, root: path.join(main, '.leeway') };
}

/** Commit `files` in the state worktree at `root`. @param {string} root @param {Record<string, string>} files */
function commitOnState(root, files) {
  for (const [rel, content] of Object.entries(files)) createFile(root, rel, content);
  return withStateLock(root, () => commitState(root, Object.keys(files), 'state: a change'));
}

/** The state worktree's place: its registration and its folder. @param {string} root */
function placed(root) {
  const { worktree, folder } = inspectState(root);
  return { worktree, folder };
}

const IN_PLACE = { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' };

/**
 * Run `fn` with git tracing each command it runs into a file, answering its
 * result and the commands traced.
 * @template T @param {(env: Record<string, string>) => T} fn @returns {{result: T, commands: string[]}}
 */
function traced(fn) {
  const file = path.join(world(), `trace-${Date.now()}-${Math.random()}.log`);
  const result = fn({ GIT_TRACE: file });
  const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return { result, commands: [...log.matchAll(/trace: built-in: git (.*)$/gm)].map((m) => m[1]) };
}

/** What a boot with nothing to do leaves as it found. @param {string} main @param {string|null} bare */
function snapshot(main, bare) {
  return {
    refs: git(main, ['for-each-ref', '--format=%(refname) %(objectname)']),
    worktrees: git(main, ['worktree', 'list', '--porcelain']),
    link: readFile(main, '.leeway/.git'),
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
  const { result, commands } = traced((trace) => boot(main, { ...env, ...trace }));
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
  useWorld, LAYOUT_GROUP, WORKFLOW_HOOKS, STUB_ENGINE, engine, codeProject, cloneOf, boot, bootRefused, setUp, commitOnState, placed, IN_PLACE, traced, bootsWithNothingToDo, outOfReach, untouched,
};
