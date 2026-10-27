'use strict';

// ---------------------------------------------------------------------------
// Boot's checks of the state (workflow-engine/scripts/domain/state-checks.cjs)
// and what boot does with them (domain/boot.cjs): the state branch and its
// worktree put in place on every boot — a fresh clone's, a lost local
// branch, a branch the remote lost, a worktree gone or unlocked, a project
// folder moved or copied; a project being set up, its ignore line after the
// branch (domain/code-trace.cjs); lost state, its stop and its screen, and
// the fresh start on yes; the layout before the state branch; a
// `leeway-state` holding code history refused; the GitHub rule's offer and
// its answer (domain/github-rule.cjs); and the catch-up run before anything
// writes state, its merge stop ending boot. A remote out of reach in each.
//
// Real repositories in temp folders: a bare repository as the remote, and
// clones of it. A remote on GitHub is a bare repository reached through a
// stand-in ssh, its URL rewritten to a port ssh refuses so nothing it misses
// reaches github.com; `gh` is a stand-in on PATH. Boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { datedAt } = require('./discovery-test-utils.cjs');

const { git, initRepo, githubOffline } = harness;
const SCRIPTS = path.dirname(harness.ENGINE);
const {
  STATE_BRANCH, STATE_LOCK_REASON, STATE_GITIGNORE, inspectState, createState, withStateLock, commitState,
} = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { RULESET, githubRepository } = require(path.join(SCRIPTS, 'domain/github-rule.cjs'));

// The workflows' own hooks, as boot installs them.
const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const WORKFLOW_HOOKS = JSON.stringify({
  hooks: { SessionEnd: [{ hooks: ['presence cleanup', 'conversation end'].map((verb) => ({ type: 'command', command: `${HOOK_ENGINE} ${verb}` })) }] },
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
  const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-state-skills-'));
  process.on('exit', () => fs.rmSync(skills, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  fs.cpSync(path.dirname(SCRIPTS), path.join(skills, 'workflow-engine'), { recursive: true });
  fs.mkdirSync(path.join(skills, 'workflow-migrate/scripts'), { recursive: true });
  fs.writeFileSync(path.join(skills, 'workflow-migrate/scripts/migrate.cjs'), STUB_MIGRATE);
  return path.join(skills, 'workflow-engine/scripts/engine.cjs');
}

const STUB_ENGINE = stubbedEngine();
const engine = harness.harness(STUB_ENGINE);

/** @type {string} */
let world;

beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'boot-state-')));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// --- the worlds -------------------------------------------------------------

/** @param {string} dir @param {string} rel @param {string} content */
function write(dir, rel, content) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
}

/** @param {string} dir @param {string} rel */
function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

/** @param {string} dir @param {string} ref @returns {string} */
function tip(dir, ref) {
  return git(dir, ['rev-parse', ref]).trim();
}

/** The remote's `leeway-state`, or '' where it holds none. @param {string} bare */
function remoteTip(bare) {
  return git(bare, ['for-each-ref', '--format=%(objectname)', `refs/heads/${STATE_BRANCH}`]).trim();
}

/** A bare repository at `dir`, as a remote. @param {string} dir */
function bareRemote(dir) {
  git(world, ['init', '-q', '--bare', dir]);
  return dir;
}

/**
 * A project with one code commit on `main` — Portal by default — and `origin`
 * where `remote` names one, `main` pushed there.
 * @param {{name?: string, remote?: string|null}} [opts]
 */
function codeProject({ name = 'portal', remote = null } = {}) {
  const main = initRepo(path.join(world, name));
  write(main, 'README.md', `# ${name}\n`);
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
  const dir = path.join(world, name);
  git(world, ['clone', '-q', ...args, remote, dir]);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
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
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
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
  const file = path.join(world, `trace-${Date.now()}-${Math.random()}.log`);
  const result = fn({ GIT_TRACE: file });
  const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return { result, commands: [...log.matchAll(/trace: built-in: git (.*)$/gm)].map((m) => m[1]) };
}

/** What a boot with nothing to do leaves as it found. @param {string} main @param {string|null} bare */
function snapshot(main, bare) {
  return {
    refs: git(main, ['for-each-ref', '--format=%(refname) %(objectname)']),
    worktrees: git(main, ['worktree', 'list', '--porcelain']),
    link: read(main, '.leeway/.git'),
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
  git(dir, ['remote', 'set-url', 'origin', path.join(world, 'nowhere.git')]);
}

// --- setting the state up ---------------------------------------------------

describe('a project being set up (4.S12, 4.5.2)', () => {
  it('gets the orphan leeway-state checked out at .leeway/ and locked, then the ignore line in .gitignore committed through the code door — and the next boot has nothing to do', () => {
    const main = codeProject();

    const res = boot(main);

    const root = path.join(main, '.leeway');
    assert.deepStrictEqual([res.state, res.github_rule_offer, res.warnings], ['ready', false, []]);
    assert.deepStrictEqual(git(main, ['rev-list', STATE_BRANCH]).trim().split('\n'), [tip(main, STATE_BRANCH)], 'one commit, with no parent');
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:.gitignore`]), STATE_GITIGNORE);
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(main, '.gitignore'), '.leeway/\n');
    const ignored = git(main, ['log', '--format=%H %s', '--', '.gitignore']).trim();
    assert.match(ignored, / chore: ignore \.leeway\/, the workflows state$/);
    assert.deepStrictEqual(git(main, ['show', '--name-only', '--format=', ignored.split(' ')[0]]).trim().split('\n'), ['.gitignore']);
    assert.strictEqual(git(main, ['status', '--porcelain', '--', '.gitignore', '.leeway']), '');

    bootsWithNothingToDo(main, null);
  });

  it('pushes the new branch where the project has a remote', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = codeProject({ remote: bare });

    boot(main);

    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    bootsWithNothingToDo(main, bare);
  });

  it('appends the ignore line to a .gitignore that holds others, and keeps one that names the state as it is', () => {
    const main = codeProject();
    write(main, '.gitignore', 'node_modules');
    git(main, ['add', '.gitignore']);
    git(main, ['commit', '-q', '-m', 'ignore']);

    boot(main);
    assert.strictEqual(read(main, '.gitignore'), 'node_modules\n.leeway/\n');

    write(main, '.gitignore', 'node_modules\n/.leeway\n');
    git(main, ['commit', '-q', '-am', 'anchored']);
    const before = tip(main, 'main');
    boot(main);
    assert.strictEqual(read(main, '.gitignore'), 'node_modules\n/.leeway\n');
    assert.strictEqual(tip(main, 'main'), before);
  });

  it('a boot cut short after the branch is made leaves the state with no trace, and the next boot writes the line', () => {
    const main = codeProject();
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world, 'git-'));
    write(wrapper, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"worktree lock"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    const killed = spawnSync('node', [STUB_ENGINE, 'boot'], { cwd: main, encoding: 'utf8', env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    const made = tip(main, STATE_BRANCH);
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.ok(!fs.existsSync(path.join(main, '.gitignore')), 'the trace came before the state was whole');
    assert.ok(!fs.existsSync(path.join(main, '.claude/settings.json')), 'the hooks came before the state was whole');

    assert.strictEqual(boot(main).state, 'ready');
    assert.strictEqual(tip(main, STATE_BRANCH), made, 'the state was made once');
    assert.strictEqual(read(main, '.gitignore'), '.leeway/\n');
  });

  it('a boot whose branch cannot be checked out writes no trace', () => {
    const main = codeProject();
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world, 'git-'));
    write(wrapper, 'git', `#!/bin/sh\ncase "$*" in *"worktree add"*) echo "fatal: refused" >&2; exit 128 ;; esac\nexec "${real}" "$@"\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    assert.match(bootRefused(main, { PATH: `${wrapper}:${process.env.PATH}` }), /git worktree failed: fatal: refused/);

    assert.ok(!fs.existsSync(path.join(main, '.gitignore')));
    assert.ok(!fs.existsSync(path.join(main, '.claude/settings.json')));
    assert.strictEqual(boot(main).state, 'ready', 'the branch made is checked out at the next boot');
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.strictEqual(read(main, '.gitignore'), '.leeway/\n');
  });

  it('reads only the person\'s own commits as the history before the workflows — never the setup\'s ignore line and hooks', () => {
    const main = datedAt('2025-03-01T12:00:00Z', () => codeProject());

    const { baseline_signal: signal } = boot(main);

    assert.deepStrictEqual([signal.commits_total, signal.commits_before, signal.history_before], [3, 1, ['2025-03-01  code']]);
    assert.deepStrictEqual([signal.files_at_arrival, signal.tree_at_arrival], [1, ['README.md']]);
  });

  it('keeps the line in the .gitignore of a project nested in a larger one, beside its settings, the state at the repository\'s top ignored by the exclude file', () => {
    const top = initRepo(path.join(world, 'mono'));
    write(top, 'app/README.md', '# app\n');
    git(top, ['add', '-A']);
    git(top, ['commit', '-q', '-m', 'code']);
    const app = path.join(top, 'app');

    assert.strictEqual(boot(app).state, 'ready');

    assert.deepStrictEqual(placed(path.join(top, '.leeway')), IN_PLACE);
    assert.strictEqual(read(app, '.gitignore'), '.leeway/\n');
    assert.ok(fs.existsSync(path.join(app, '.claude/settings.json')), 'the hooks it sits beside');
    assert.ok(!fs.existsSync(path.join(top, '.gitignore')), 'nothing written outside the project');
    assert.deepStrictEqual(git(top, ['show', '--name-only', '--format=', 'HEAD~1', 'HEAD']).trim().split('\n').filter(Boolean).sort(), ['app/.claude/settings.json', 'app/.gitignore']);
    assert.strictEqual(git(top, ['status', '--porcelain']), '');
    assert.strictEqual(boot(app).state, 'ready');
    assert.strictEqual(read(app, '.gitignore'), '.leeway/\n');
  });

  it('keeps the state folder in the repository\'s exclude file, once, on every boot — so no branch takes it in', () => {
    const main = codeProject();
    const exclude = path.join(main, '.git/info/exclude');

    boot(main);
    fs.writeFileSync(exclude, read(main, '.git/info/exclude').replace('/.leeway/\n', ''));
    boot(main);
    boot(main);

    assert.strictEqual(read(main, '.git/info/exclude').split('\n').filter((line) => line === '/.leeway/').length, 1);
  });

  it('a code branch cut before setup, checked out in the main checkout, takes nothing of the state in — `git add -A` stages none of it (4.1.2, 4.1.3)', () => {
    const main = codeProject();
    git(main, ['branch', 'before-setup']);
    boot(main);
    git(main, ['checkout', '-q', 'before-setup']);
    assert.ok(!fs.existsSync(path.join(main, '.gitignore')), 'the branch holds no ignore line');

    git(main, ['add', '-A']);

    assert.strictEqual(git(main, ['status', '--porcelain']), '');
    assert.strictEqual(git(main, ['ls-files', '--stage', '--', '.leeway']), '', 'no gitlink, no file of the state');
  });

  it('a fresh clone ignores the state at once, before any commit — even a boot killed as the worktree is locked', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });
    git(bare, ['update-ref', 'refs/heads/main', git(main, ['rev-parse', 'main~2']).trim()]);
    const fresh = cloneOf(bare, 'fresh');
    assert.ok(!fs.existsSync(path.join(fresh, '.gitignore')), 'the clone\'s branch holds no ignore line');
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world, 'git-'));
    write(wrapper, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"worktree lock"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    const killed = spawnSync('node', [STUB_ENGINE, 'boot'], { cwd: fresh, encoding: 'utf8', env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    assert.ok(fs.existsSync(path.join(fresh, '.leeway/.gitignore')), 'the state is checked out');
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
    git(fresh, ['add', '-A']);
    assert.strictEqual(git(fresh, ['ls-files', '--stage', '--', '.leeway']), '');
  });

  it('a boot from a code worktree commits the line and the hooks on that worktree\'s branch, never on the main checkout\'s', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = codeProject({ remote: bare });
    const fresh = cloneOf(bare, 'fresh', ['--branch', 'main']);
    boot(main);
    const code = path.join(world, 'fresh-feature');
    git(fresh, ['worktree', 'add', '-q', '-b', 'feature', code]);
    const before = { main: tip(fresh, 'main'), feature: tip(fresh, 'feature') };

    assert.strictEqual(boot(code).state, 'ready');

    assert.strictEqual(tip(fresh, 'main'), before.main, 'the main checkout\'s branch gained nothing');
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
    assert.deepStrictEqual(git(fresh, ['log', '--format=%s', `${before.feature}..feature`]).trim().split('\n'),
      ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state']);
    assert.strictEqual(read(code, '.gitignore'), '.leeway/\n');
    assert.ok(!fs.existsSync(path.join(code, '.leeway')));
  });

  describe('while git is in the middle of a rebase', () => {
    /** A project set up, its ignore line dropped on a later commit, then a rebase stopped part-way in the main checkout. */
    function midRebase() {
      const main = codeProject();
      boot(main);
      fs.writeFileSync(path.join(main, '.gitignore'), '');
      git(main, ['commit', '-q', '-am', 'drop the line']);
      write(main, 'x.txt', 'x\n');
      git(main, ['add', 'x.txt']);
      git(main, ['commit', '-q', '-m', 'x']);
      assert.throws(() => git(main, ['rebase', '--exec', 'false', 'HEAD~1']));
      assert.ok(fs.existsSync(path.join(main, '.git/rebase-merge')), 'the rebase stopped part-way');
      return main;
    }

    it('a boot in the main checkout leaves the line unwritten and commits nothing there — the next boot after it writes the line', () => {
      const main = midRebase();
      const head = tip(main, 'HEAD');

      assert.strictEqual(boot(main).state, 'ready');

      assert.strictEqual(tip(main, 'HEAD'), head, 'nothing committed into the rebase');
      assert.strictEqual(read(main, '.gitignore'), '');
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
      git(main, ['rebase', '--abort']);
      boot(main);
      assert.strictEqual(read(main, '.gitignore'), '.leeway/\n');
      assert.strictEqual(git(main, ['log', '-1', '--format=%s']).trim(), 'chore: ignore .leeway/, the workflows state');
    });

    it('a boot from a code worktree commits nothing in the main checkout', () => {
      const main = midRebase();
      const code = path.join(world, 'portal-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', code, 'main']);
      const head = tip(main, 'HEAD');

      assert.strictEqual(boot(code).state, 'ready');

      assert.strictEqual(tip(main, 'HEAD'), head);
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
      assert.ok(fs.existsSync(path.join(main, '.git/rebase-merge')), 'the rebase is the person\'s still');
    });
  });

  it('a project on the layout before the state branch stops for the migration: boot writes nothing — and the next boot stops again', () => {
    const main = codeProject();
    write(main, '.workflows/payments/manifest.json', '{}\n');
    write(main, '.claude/settings.json', WORKFLOW_HOOKS);
    git(main, ['add', '-A']);
    git(main, ['commit', '-q', '-m', 'the old layout']);
    const before = git(main, ['for-each-ref']);

    assert.deepStrictEqual(boot(main), { ok: true, state: 'migrate', warnings: [] });

    assert.strictEqual(git(main, ['for-each-ref']), before);
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));
    assert.strictEqual(git(main, ['status', '--porcelain']), '');
    assert.deepStrictEqual(boot(main), { ok: true, state: 'migrate', warnings: [] });
  });

  it('the old layout beside a remote holding leeway-state is a clone to bring the state into, not refused', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });
    const other = cloneOf(bare, 'other');
    write(other, '.workflows/payments/manifest.json', '{}\n');
    git(other, ['add', '-A']);
    git(other, ['commit', '-q', '-m', 'the old layout']);

    assert.strictEqual(boot(other).state, 'ready');
    assert.strictEqual(tip(other, STATE_BRANCH), tip(main, STATE_BRANCH));
  });
});

// --- a fresh clone ------------------------------------------------------------

describe('a fresh clone (4.S11, 22.S2)', () => {
  it('makes the remote\'s leeway-state its own, checked out at .leeway/ and locked — and the next boot has nothing to do', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { root } = setUp({ remote: bare });
    commitOnState(root, { 'manifest.json': '{"kept":true}\n' });
    const fresh = cloneOf(bare, 'fresh');

    const res = boot(fresh);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(path.join(fresh, '.leeway')), IN_PLACE);
    assert.strictEqual(read(fresh, '.leeway/manifest.json'), '{"kept":true}\n');
    bootsWithNothingToDo(fresh, bare);
  });

  it('with the remote out of reach, checks out its branch as the clone fetched it, and says the remote could not be reached', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    setUp({ remote: bare });
    const fresh = cloneOf(bare, 'fresh');
    outOfReach(fresh);

    const { result: res, commands } = traced((trace) => boot(fresh, trace));

    assert.strictEqual(res.state, 'ready');
    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(path.join(fresh, '.leeway')), IN_PLACE);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^leeway-state could not be fetched from origin, so this session works on the state it has: git ls-remote failed: /);
    assert.deepStrictEqual(commands.filter((c) => /^(push|fetch|ls-remote) /.test(c)).map((c) => c.split(' ')[0]), ['ls-remote'], 'the remote was asked once, and never pushed to');
  });

  it('with the remote out of reach and nothing fetched, stops saying so — never as lost state — and writes nothing', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    setUp({ remote: bare });
    const fresh = cloneOf(bare, 'fresh', ['--single-branch', '--branch', 'main']);
    outOfReach(fresh);
    const before = git(fresh, ['for-each-ref']);

    assert.match(bootRefused(fresh), /^origin could not be reached, and this clone holds no leeway-state of its own, so boot wrote nothing — start again once it can be reached: git ls-remote failed: /);

    assert.strictEqual(git(fresh, ['for-each-ref']), before);
    assert.ok(!fs.existsSync(path.join(fresh, '.leeway')));
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
  });
});

// --- two boots at once ----------------------------------------------------------

/**
 * Two boots at once, each a process of its own, as two sessions opened on
 * one project start: their answers.
 * @param {string} dir
 * @returns {Promise<any[]>}
 */
function twoBootsAtOnce(dir) {
  const one = () => new Promise((resolve) => {
    const child = spawn(process.execPath, [STUB_ENGINE, 'boot'], { cwd: dir, env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', () => resolve(JSON.parse(out.trim() === '' ? err : out.split('\n')[0])));
  });
  return Promise.all([one(), one()]);
}

/** Everything a boot makes, by count: the state's first commits, its registrations, the ignore line and the commits the code tree gained. @param {string} main */
function madeOnce(main) {
  return {
    roots: git(main, ['rev-list', '--max-parents=0', STATE_BRANCH]).trim().split('\n').length,
    registrations: fs.readdirSync(path.join(main, '.git/worktrees')),
    ignore: read(main, '.gitignore'),
    code: git(main, ['log', '--format=%s']).trim().split('\n'),
  };
}

describe('two boots at once (4.S3)', () => {
  it('on a project being set up, both answer ready, and everything is made once', async () => {
    const main = codeProject();

    const answers = await twoBootsAtOnce(main);

    assert.deepStrictEqual(answers.map((a) => [a.ok, a.state, a.error]), [[true, 'ready', undefined], [true, 'ready', undefined]]);
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.deepStrictEqual(madeOnce(main), {
      roots: 1, registrations: ['-leeway'], ignore: '.leeway/\n',
      code: ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state', 'code'],
    });
    bootsWithNothingToDo(main, null);
  });

  it('on a fresh clone, both answer ready, and the remote\'s branch is checked out once', async () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    setUp({ remote: bare });
    const fresh = cloneOf(bare, 'fresh');

    const answers = await twoBootsAtOnce(fresh);

    assert.deepStrictEqual(answers.map((a) => [a.ok, a.state, a.error]), [[true, 'ready', undefined], [true, 'ready', undefined]]);
    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(path.join(fresh, '.leeway')), IN_PLACE);
    assert.deepStrictEqual(fs.readdirSync(path.join(fresh, '.git/worktrees')), ['-leeway']);
    bootsWithNothingToDo(fresh, bare);
  });
});

// --- a lost local branch --------------------------------------------------------

describe('a lost local branch (4.S8)', () => {
  it('deleted with its worktree, is restored from the remote and checked out again, locked', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    commitOnState(root, { 'manifest.json': '{"kept":true}\n' });
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, 'manifest.json'), '{"kept":true}\n');
    bootsWithNothingToDo(main, bare);
  });

  it('deleted under its worktree, is restored and the folder linked to it again, what the folder holds kept', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    write(root, 'notes.md', 'not yet committed\n');

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, 'notes.md'), 'not yet committed\n');
    bootsWithNothingToDo(main, bare);
  });

  it('deleted under its worktree while the remote moved on, its folder is brought to the remote\'s tip: the next write undoes nothing the remote changed, and edits not yet committed survive', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    commitOnState(root, { 'notes.md': 'one\ntwo\nthree\n' });
    const other = cloneOf(bare, 'other');
    boot(other);
    commitOnState(path.join(other, '.leeway'), { 'notes.md': 'one\ntwo\nthree, theirs\n', 'theirs.md': 'from the other clone\n' });
    write(root, 'notes.md', 'one, mine\ntwo\nthree\n');
    write(root, 'draft.md', 'not yet committed\n');
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    const res = boot(main);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, 'theirs.md'), 'from the other clone\n');
    assert.strictEqual(read(root, 'notes.md'), 'one, mine\ntwo\nthree, theirs\n');
    assert.strictEqual(read(root, 'draft.md'), 'not yet committed\n');
    assert.deepStrictEqual(git(root, ['status', '--porcelain']).split('\n').filter(Boolean), [' M notes.md', '?? draft.md'],
      'the index reads the remote\'s tip: only the edits show');

    const next = withStateLock(root, () => commitState(root, ['.'], 'state: everything'));

    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:theirs.md`]), 'from the other clone\n');
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:notes.md`]), 'one, mine\ntwo\nthree, theirs\n');
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:draft.md`]), 'not yet committed\n');
    assert.strictEqual(remoteTip(bare), next.commit);
  });

  it('deleted under its worktree holding a commit a failed push left behind, is restored with that commit, which the catch-up pushes', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    const hook = path.join(bare, 'hooks', 'pre-receive');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const left = commitOnState(root, { 'mine.md': 'committed, never pushed\n' }).commit;
    fs.rmSync(hook);
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), left);
    assert.strictEqual(remoteTip(bare), left);
    assert.strictEqual(read(root, 'mine.md'), 'committed, never pushed\n');
    assert.strictEqual(git(root, ['status', '--porcelain']), '');
  });

  it('deleted under its worktree whose HEAD log is gone, is refused: boot cannot tell where the folder stands, and writes nothing', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    const registration = read(root, '.git').replace(/^gitdir: /, '').trim();
    fs.rmSync(path.join(registration, 'logs'), { recursive: true, force: true });
    const before = git(main, ['for-each-ref']);

    assert.match(bootRefused(main), new RegExp(
      `^the state folder ${root} is still there, but leeway-state is gone from this clone, and its log no longer says which commit ` +
      'the folder\'s files stand at, so boot wrote nothing — move .* aside, keeping what it holds, and boot again: leeway-state is restored from origin$',
    ));

    assert.strictEqual(git(main, ['for-each-ref']), before);
  });
});

// --- a branch missing from the remote ---------------------------------------------

describe('a branch missing from the remote (4.4.12, 4.S31)', () => {
  it('is pushed back — and the next boot has nothing to do', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });
    git(bare, ['branch', '-D', STATE_BRANCH]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    bootsWithNothingToDo(main, bare);
  });

  it('is never pushed back to a remote out of reach, which says nothing of what it holds', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });
    git(bare, ['branch', '-D', STATE_BRANCH]);
    outOfReach(main);

    const { result: res, commands } = traced((trace) => boot(main, trace));

    assert.strictEqual(res.state, 'ready');
    assert.ok(!commands.some((c) => c.startsWith('push ')), 'a push was tried');
    assert.match(res.warnings.join('\n'), /could not be fetched from origin/);
    assert.strictEqual(remoteTip(bare), '');
  });

  it('gone here and on the remote but held by another clone: this clone stops, the other pushes it back, and this one restores it with nothing lost', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main: other, root: otherRoot } = setUp({ remote: bare });
    const here = cloneOf(bare, 'here');
    boot(here);
    const kept = commitOnState(otherRoot, { 'manifest.json': '{"kept":true}\n' }).commit;
    git(bare, ['branch', '-D', STATE_BRANCH]);
    git(here, ['worktree', 'remove', '--force', '--force', path.join(here, '.leeway')]);
    git(here, ['branch', '-D', STATE_BRANCH]);

    assert.deepStrictEqual(boot(here), { ok: true, state: 'lost', warnings: [] });
    assert.strictEqual(boot(other).state, 'ready');
    assert.strictEqual(remoteTip(bare), kept);
    assert.strictEqual(boot(here).state, 'ready');

    assert.strictEqual(tip(here, STATE_BRANCH), kept);
    assert.strictEqual(read(here, '.leeway/manifest.json'), '{"kept":true}\n');
    assert.deepStrictEqual(placed(path.join(here, '.leeway')), IN_PLACE);
  });
});

// --- the worktree ---------------------------------------------------------------

describe('the state worktree (4.S29, 22.S3)', () => {
  it('removed, is added again, locked — and the next boot has nothing to do', () => {
    const { main, root } = setUp();
    git(main, ['worktree', 'remove', '--force', '--force', root]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.deepStrictEqual(placed(root), IN_PLACE);
    bootsWithNothingToDo(main, null);
  });

  it('its folder deleted under its registration, is added again, locked', () => {
    const { main, root } = setUp();
    fs.rmSync(root, { recursive: true, force: true });

    assert.strictEqual(boot(main).state, 'ready');

    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, '.gitignore'), STATE_GITIGNORE);
    bootsWithNothingToDo(main, null);
  });

  it('unlocked, is locked — and checked again on the next boot, which locks it again', () => {
    const { main, root } = setUp();
    git(main, ['worktree', 'unlock', root]);

    boot(main);
    assert.deepStrictEqual(placed(root), IN_PLACE);

    git(main, ['worktree', 'unlock', root]);
    boot(main);
    assert.deepStrictEqual(placed(root), IN_PLACE);
    bootsWithNothingToDo(main, null);
  });

  it('with a detached HEAD or another branch checked out, is refused, nothing written', () => {
    const { main, root } = setUp();
    git(root, ['checkout', '-q', '--detach']);
    const before = tip(main, STATE_BRANCH);

    assert.match(bootRefused(main), /has a detached HEAD checked out, not leeway-state, so boot wrote nothing — check leeway-state out there again$/);

    git(root, ['checkout', '-q', '-b', 'elsewhere']);
    assert.match(bootRefused(main), /has elsewhere checked out, not leeway-state/);
    assert.strictEqual(tip(main, STATE_BRANCH), before);
  });
});

// --- a moved or copied project folder ------------------------------------------------

/** Every file git keeps for a project's worktrees, and each worktree's link, by path. @param {string} main @param {string[]} worktrees */
function links(main, worktrees) {
  /** @type {Record<string, string>} */
  const files = {};
  const admin = path.join(main, '.git/worktrees');
  for (const id of fs.readdirSync(admin)) {
    for (const name of fs.readdirSync(path.join(admin, id))) {
      const file = path.join(admin, id, name);
      if (fs.statSync(file).isFile()) files[file] = fs.readFileSync(file, 'utf8');
    }
  }
  for (const dir of worktrees) files[path.join(dir, '.git')] = read(dir, '.git');
  return files;
}

describe('a project folder moved or copied', () => {
  it('moved: the state worktree is linked where it now is, what it holds and its lock kept, and commits again', () => {
    const { main, root } = setUp();
    write(root, 'manifest.json', '{"kept":true}\n');
    const moved = path.join(world, 'moved');
    fs.renameSync(main, moved);

    const res = boot(moved);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    const movedRoot = path.join(moved, '.leeway');
    assert.deepStrictEqual(placed(movedRoot), IN_PLACE);
    assert.strictEqual(read(movedRoot, 'manifest.json'), '{"kept":true}\n');
    const out = commitOnState(movedRoot, { 'manifest.json': '{"kept":true}\n' });
    assert.strictEqual(tip(moved, STATE_BRANCH), out.commit);
    bootsWithNothingToDo(moved, null);
  });

  it('copied: the copy\'s state worktree becomes its own, and the original — its state worktree and its code worktrees — is untouched and works', () => {
    const { main: original, root } = setUp();
    const side = path.join(original, '.claude/worktrees/side');
    git(original, ['worktree', 'add', '-q', '-b', 'side', side]);
    const before = links(original, [root, side]);
    const copy = path.join(world, 'copy');
    fs.cpSync(original, copy, { recursive: true, verbatimSymlinks: true });

    const res = boot(copy);

    assert.strictEqual(res.state, 'ready');
    assert.deepStrictEqual(res.warnings, [`this project is a copy of ${original}: its state worktree was linked to that project's, and is now this one's own — ${original} is untouched`]);
    const copyRoot = path.join(copy, '.leeway');
    assert.deepStrictEqual(placed(copyRoot), IN_PLACE);
    assert.deepStrictEqual(links(original, [root, side]), before, 'the original\'s links were rewritten');
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(git(side, ['rev-parse', '--git-common-dir']).trim(), path.join(original, '.git'));

    const theirs = commitOnState(root, { 'manifest.json': '{"original":true}\n' }).commit;
    const ours = commitOnState(copyRoot, { 'manifest.json': '{"copy":true}\n' }).commit;
    assert.strictEqual(tip(original, STATE_BRANCH), theirs);
    assert.strictEqual(tip(copy, STATE_BRANCH), ours);
    bootsWithNothingToDo(copy, null);
  });

  it('a boot from inside a copy\'s state worktree, which git reads as the original\'s, is refused and touches nothing', () => {
    const { main: original, root } = setUp();
    const before = { links: links(original, [root]), refs: git(original, ['for-each-ref']), log: git(root, ['log', '--format=%H']) };
    const copy = path.join(world, 'copy');
    fs.cpSync(original, copy, { recursive: true, verbatimSymlinks: true });

    assert.match(bootRefused(path.join(copy, '.leeway')), new RegExp(`is in a copy of the worktree at ${root}: git reads it as that worktree, in that repository, so the workflows read and write nothing through it`));

    assert.deepStrictEqual({ links: links(original, [root]), refs: git(original, ['for-each-ref']), log: git(root, ['log', '--format=%H']) }, before);
  });
});

// --- lost state -------------------------------------------------------------------

/**
 * A project whose code tree holds the workflows' trace — the state's ignore
 * line and the hooks, committed as boot leaves them — with no state branch
 * here or on its remote, the code dated in the past.
 * @param {{remote?: string|null, trace?: Record<string, string>}} [opts]
 */
function lostProject({ remote = null, trace = { '.gitignore': '.leeway/\n', '.claude/settings.json': WORKFLOW_HOOKS } } = {}) {
  const main = initRepo(path.join(world, 'portal'));
  datedAt('2025-03-01T12:00:00Z', () => {
    write(main, 'src/app.js', 'export default 1;\n');
    git(main, ['add', '-A']);
    git(main, ['commit', '-q', '-m', 'the app']);
    for (const [rel, content] of Object.entries(trace)) write(main, rel, content);
    git(main, ['add', '-A']);
    git(main, ['commit', '-q', '-m', 'set up']);
  });
  if (remote !== null) {
    git(main, ['remote', 'add', 'origin', remote]);
    git(main, ['push', '-q', 'origin', 'main']);
  }
  return main;
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

/** A menu row's wrapped line opens on non-breaking spaces. */
const WRAP = '\u00a0'.repeat(8);

describe('lost state (4.4.5, 4.S9, 4.S32)', () => {
  it('gone here and on the remote, in a project whose committed settings hold the workflows\' hooks, stops boot with nothing written — and the next boot stops again', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = lostProject({ remote: bare, trace: { '.claude/settings.json': WORKFLOW_HOOKS } });
    const before = untouched(main, bare);

    assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });
    assert.deepStrictEqual(untouched(main, bare), before);
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));

    assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });
    assert.deepStrictEqual(untouched(main, bare), before);
  });

  it('a line naming the state in the .gitignore is the trace too', () => {
    const main = lostProject({ trace: { '.gitignore': 'node_modules\n.leeway/\n' } });

    assert.strictEqual(boot(main).state, 'lost');
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));
  });

  it('a .worktreeinclude naming the state is no trace — no version of the workflows wrote such a line — so the project is being set up', () => {
    const main = lostProject({ trace: { '.worktreeinclude': 'node_modules\n.leeway/.knowledge/store.bin\n' } });

    assert.strictEqual(boot(main).state, 'ready');
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
  });

  it('gone with no remote at all, stops too', () => {
    const { main, root } = setUp();
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);
    const before = untouched(main, null);

    assert.strictEqual(boot(main).state, 'lost');
    assert.deepStrictEqual(untouched(main, null), before);
  });

  it('draws the stop: what was lost, the other clone that can put it back, and the fresh start on yes', () => {
    const main = lostProject();

    const out = engine.output(main, ['render', 'state-lost-gate']);

    assert.strictEqual(out, [
      '=== DISPLAY: state lost stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ Boot stopped: Leeway\'s state branch is gone',
      '',
      '=== DISPLAY: state lost account (emit verbatim as markdown (not a code block)) ===',
      '> Portal keeps its Leeway state on a branch of its own, `leeway-state`. Boot found it neither in this clone nor on the remote.',
      '>',
      '> If another clone of Portal still has it, on this machine or another, run Leeway there: boot pushes it back to the remote, and this clone restores it when it next starts.',
      '>',
      '> Otherwise the state is lost: the decisions, the logs and the ledger. Portal\'s code and its history are untouched.',
      '',
      '=== MENU: state lost gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Start again with a fresh state?`**',
      '',
      '**`y/yes`** → Start again — *a fresh state branch, then the product*',
      `${WRAP}*researcher reads Portal's code to rebuild what it can*`,
      '**`n/no`**  → Not now — *look for another clone first; nothing is*',
      `${WRAP}*written*`,
      '',
    ].join('\n'));
    auditMarkers(out, 'state lost gate');
    const gate = announced(() => auditGate(engine.output(main, ['render', 'state-lost-gate']), 'state lost gate'));
    assert.strictEqual(gate.question, 'Start again with a fresh state?');
    assert.deepStrictEqual(gate.options.map((o) => o.key), ['y', 'n']);
  });

  it('on yes, `boot --start-again` makes a fresh orphan branch and says the state was started again — the baseline signal reads all the code as before the workflows', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = lostProject({ remote: bare });
    const code = tip(main, 'main');

    const res = engine.ok(main, ['boot', '--start-again']);

    assert.strictEqual(res.state, 'restarted');
    assert.deepStrictEqual(git(main, ['rev-list', STATE_BRANCH]).trim().split('\n'), [tip(main, STATE_BRANCH)]);
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    assert.strictEqual(tip(main, 'main'), code, 'the code side gained nothing: its trace was already there');
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal.commits_before, res.baseline_signal.commits_total);
    assert.deepStrictEqual(res.baseline_signal.history_before, ['2025-03-01  the app', '2025-03-01  set up']);
    assert.notStrictEqual(res.baseline_signal.workflows_date, null);
    assert.strictEqual(boot(main).state, 'ready', 'started again once: the next boot finds the state in place');
  });

  it('`boot --start-again` where the state is in place starts nothing again', () => {
    const { main } = setUp();
    const before = tip(main, STATE_BRANCH);

    assert.strictEqual(engine.ok(main, ['boot', '--start-again']).state, 'ready');
    assert.strictEqual(tip(main, STATE_BRANCH), before);
    assert.match(engine.refuses(main, ['boot', '--fresh']).error, /^Usage: engine boot \[--start-again\]$/);
  });

  it('a state folder with no branch here or on the remote is refused, saying what happened and the ways on, nothing written', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    git(bare, ['branch', '-D', STATE_BRANCH]);

    assert.strictEqual(bootRefused(main), [
      `the state folder ${root} is still there, but leeway-state is gone — from this clone, and from origin — so boot wrote nothing: `,
      'it makes no state branch under a folder holding state it cannot account for. Where another clone still holds leeway-state, ',
      'run Leeway there to push it back, and this clone restores it at its next boot; ',
      `otherwise move ${root} aside, keeping what it holds, and boot again`,
    ].join(''));
    assert.strictEqual(git(main, ['for-each-ref', `refs/heads/${STATE_BRANCH}`]), '');
    assert.strictEqual(remoteTip(bare), '');

    fs.renameSync(root, path.join(world, 'aside'));
    assert.strictEqual(boot(main).state, 'lost', 'the folder moved aside, boot stops at the lost state, whose yes starts it afresh');
  });
});

// --- code history ---------------------------------------------------------------

describe('a leeway-state holding code history (4.9.2, 4.S19)', () => {
  it('here, is refused: no worktree is added onto it, and it is never pushed', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = codeProject({ remote: bare });
    git(main, ['branch', STATE_BRANCH]);

    assert.match(bootRefused(main), /^leeway-state holds code history — it shares commits with main, where the state branch is a line of its own — so boot neither checks it out nor pushes it, and wrote nothing\. Rename that branch, and boot sets the state up afresh$/);

    assert.ok(!fs.existsSync(path.join(main, '.leeway')));
    assert.strictEqual(remoteTip(bare), '');
  });

  it('on the remote, is refused: no local branch is made from it', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = codeProject({ remote: bare });
    git(main, ['push', '-q', 'origin', `main:${STATE_BRANCH}`]);
    const fresh = cloneOf(bare, 'fresh');

    assert.match(bootRefused(fresh), /^origin's leeway-state holds code history — it shares commits with (origin\/)?(main|HEAD)/);

    assert.strictEqual(git(fresh, ['for-each-ref', `refs/heads/${STATE_BRANCH}`]), '');
    assert.ok(!fs.existsSync(path.join(fresh, '.leeway')));
  });

  it('checked out at .leeway/ by hand, is never pushed to a remote that lacks it', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const main = codeProject({ remote: bare });
    git(main, ['worktree', 'add', '-q', '-b', STATE_BRANCH, path.join(main, '.leeway')]);
    git(main, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, path.join(main, '.leeway')]);

    assert.match(bootRefused(main), /^leeway-state holds code history/);
    assert.strictEqual(remoteTip(bare), '');
  });

  /** What a refused catch-up must leave: the branch, the worktree's files and the remote. @param {string} main @param {string} bare */
  function stateAsIs(main, bare) {
    return { branch: tip(main, STATE_BRANCH), files: fs.readdirSync(path.join(main, '.leeway')).sort(), remote: remoteTip(bare), log: git(main, ['log', '--format=%H', STATE_BRANCH]) };
  }

  for (const fetched of [false, true]) {
    it(`pushed over the remote's, is refused by the catch-up before anything is merged or pushed${fetched ? ' — the person having fetched it already' : ''}`, () => {
      const bare = bareRemote(path.join(world, 'portal.git'));
      const { main } = setUp({ remote: bare });
      commitOnState(path.join(main, '.leeway'), { 'manifest.json': '{"kept":true}\n' });
      git(main, ['push', '-q', '-f', 'origin', `main:${STATE_BRANCH}`]);
      if (fetched) git(main, ['fetch', '-q', 'origin']);
      const before = stateAsIs(main, bare);

      assert.strictEqual(bootRefused(main), [
        "origin's leeway-state holds code history — it shares commits with main, where the state branch is a line of its own — ",
        "so the catch-up neither merges nor pushes it, and wrote nothing. To carry on, put the state's own line back on origin — ",
        "this clone's leeway-state holds it",
      ].join(''));

      assert.deepStrictEqual(stateAsIs(main, bare), before);
      assert.ok(!fs.existsSync(path.join(main, '.leeway/README.md')), 'the code came into the state worktree');
    });
  }

  it('pointed at code under its worktree, is refused by the catch-up and never pushed', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });
    git(main, ['update-ref', `refs/heads/${STATE_BRANCH}`, 'main']);
    const before = stateAsIs(main, bare);

    assert.strictEqual(bootRefused(main), [
      "this clone's leeway-state holds code history — it shares commits with main, where the state branch is a line of its own — ",
      'so the catch-up neither merges nor pushes it, and wrote nothing. To carry on, point leeway-state back at the state\'s own line — ',
      "origin's leeway-state holds it",
    ].join(''));

    assert.deepStrictEqual(stateAsIs(main, bare), before);
  });

  it('is told from a state started again elsewhere, a line of its own too, which the catch-up merges as ever', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });
    commitOnState(path.join(main, '.leeway'), { 'notes.md': 'kept here\n' });
    const other = initRepo(path.join(world, 'other'));
    const again = datedAt('2025-01-01T00:00:00Z', () => createState(path.join(other, '.leeway'))).commit;
    git(other, ['push', '-q', '-f', bare, `${STATE_BRANCH}:${STATE_BRANCH}`]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(git(main, ['log', '-1', '--format=%P', STATE_BRANCH]).trim(), again, 'merged onto the remote\'s line');
    assert.strictEqual(read(main, '.leeway/notes.md'), 'kept here\n');
    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
  });
});

// --- the GitHub rule ---------------------------------------------------------------

/**
 * A remote on GitHub, `git@github.com:acme/portal.git`, served by a bare
 * repository through a stand-in ssh. Nothing leaves the machine, and it fails
 * closed: the URL is rewritten to GitHub on a port ssh refuses
 * (`githubOffline`), so a git call the stand-in misses never reaches
 * github.com.
 * @returns {{url: string, bare: string, env: Record<string, string>}}
 */
function fakeGithub() {
  const served = path.join(world, 'github');
  const bare = path.join(served, 'acme', 'portal.git');
  fs.mkdirSync(path.dirname(bare), { recursive: true });
  bareRemote(bare);
  const ssh = path.join(world, 'fake-ssh');
  write(world, 'fake-ssh', [
    '#!/bin/sh',
    'for last; do :; done',
    'service=${last%% *}',
    "repo=${last#* }; repo=${repo#\\'}; repo=${repo%\\'}",
    `exec git "\${service#git-}" "${served}/\${repo#/}"`,
    '',
  ].join('\n'));
  fs.chmodSync(ssh, 0o755);
  return { url: 'git@github.com:acme/portal.git', bare, env: { ...githubOffline(world), GIT_SSH_COMMAND: ssh, GIT_SSH_VARIANT: 'ssh' } };
}

/**
 * A stand-in `gh` first on PATH: every call logged, its input kept. It is
 * signed in, and sets what it is asked to, unless told otherwise.
 * @param {{signedOut?: boolean, refuses?: boolean}} [opts]
 */
function ghStub({ signedOut = false, refuses = false } = {}) {
  const bin = fs.mkdtempSync(path.join(world, 'gh-'));
  const log = path.join(bin, 'calls');
  const input = path.join(bin, 'input');
  write(bin, 'gh', [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> "${log}"`,
    'case "$1" in',
    `  auth) ${signedOut ? 'echo "You are not logged into any GitHub hosts." >&2; exit 1' : 'exit 0'} ;;`,
    `  api) cat > "${input}"; ${refuses ? 'echo "HTTP 403: Resource not accessible by integration" >&2; exit 1' : 'echo "{}"; exit 0'} ;;`,
    'esac',
    'exit 2',
    '',
  ].join('\n'));
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  return {
    PATH: `${bin}:${process.env.PATH}`,
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []),
    input: () => JSON.parse(fs.readFileSync(input, 'utf8')),
  };
}

/** The project manifest as the state branch holds it. @param {string} main */
function committedManifest(main) {
  return JSON.parse(git(main, ['show', `${STATE_BRANCH}:manifest.json`]));
}

describe('the GitHub rule (4.4.6, 4.S10, 4.S30)', () => {
  /** @type {ReturnType<typeof fakeGithub>} */
  let github;
  /** @type {Record<string, string|undefined>} */
  let was;
  beforeEach(() => {
    github = fakeGithub();
    was = Object.fromEntries(Object.keys(github.env).map((name) => [name, process.env[name]]));
    Object.assign(process.env, github.env);
  });
  afterEach(() => {
    for (const [name, value] of Object.entries(was)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('setup on a GitHub remote offers the rule, and sets nothing until the yes — which sets it through gh, recorded so the offer is never made again', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });

    const res = boot(main, { PATH: gh.PATH });

    assert.deepStrictEqual([res.state, res.github_rule_offer], ['ready', true]);
    assert.strictEqual(remoteTip(github.bare), tip(main, STATE_BRANCH), 'the state went to GitHub');
    assert.deepStrictEqual(gh.calls(), [], 'boot set nothing');

    const out = engine.ok(main, ['github-rule', 'yes'], { env: { PATH: gh.PATH } });

    assert.deepStrictEqual(gh.calls(), ['auth status --hostname github.com', 'api --method POST repos/acme/portal/rulesets --input -']);
    assert.deepStrictEqual(gh.input(), {
      name: 'leeway-state', target: 'branch', enforcement: 'active',
      conditions: { ref_name: { include: ['refs/heads/leeway-state'], exclude: [] } },
      rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
    });
    assert.deepStrictEqual(gh.input(), RULESET);
    assert.deepStrictEqual([out.github_rule, out.reason, out.warnings], ['set', undefined, undefined]);
    assert.strictEqual(out.committed, git(main, ['rev-parse', '--short', STATE_BRANCH]).trim());
    assert.strictEqual(git(main, ['log', '-1', '--format=%s', STATE_BRANCH]).trim(), 'chore: the GitHub rule on leeway-state set');
    assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'set' });
    assert.strictEqual(boot(main, { PATH: gh.PATH }).github_rule_offer, false);
  });

  it('fails closed: the remote reads as GitHub on a port ssh refuses, so a git call the stand-in misses never reaches github.com', () => {
    const main = codeProject();
    git(main, ['remote', 'add', 'origin', github.url]);

    assert.strictEqual(git(main, ['remote', 'get-url', 'origin']).trim(), 'ssh://git@github.com:0/acme/portal.git');
    assert.deepStrictEqual(githubRepository(git(main, ['remote', 'get-url', 'origin'])), { owner: 'acme', repo: 'portal' });
  });

  it('draws the offer: the rule and what it refuses, set on yes, left unset on no', () => {
    const main = codeProject({ remote: github.url });
    boot(main);

    const out = engine.output(main, ['render', 'github-rule-gate']);

    assert.strictEqual(out, [
      '=== MENU: github rule gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      'Portal\'s remote is on GitHub. A rule there can refuse deleting or force-pushing `leeway-state` for anything run outside Claude Code; inside it, Leeway already refuses both.',
      '',
      '**`◆ Set that rule on GitHub?`**',
      '',
      '**`y/yes`** → Set it on Portal\'s repository',
      '**`n/no`**  → Leave it unset — *setup carries on without it*',
      '',
    ].join('\n'));
    const gate = announced(() => auditGate(engine.output(main, ['render', 'github-rule-gate']), 'github rule gate'));
    assert.strictEqual(gate.question, 'Set that rule on GitHub?');
    assert.deepStrictEqual(gate.options.map((o) => o.key), ['y', 'n']);
  });

  it('a no sets nothing, is recorded, and setup carries on', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });
    boot(main, { PATH: gh.PATH });

    const out = engine.ok(main, ['github-rule', 'no'], { env: { PATH: gh.PATH } });

    assert.deepStrictEqual([out.github_rule, out.reason], ['declined', undefined]);
    assert.deepStrictEqual(gh.calls(), []);
    assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'declined' });
    const next = boot(main, { PATH: gh.PATH });
    assert.deepStrictEqual([next.state, next.github_rule_offer], ['ready', false]);
  });

  for (const [why, setUpGh, reason] of /** @type {const} */ ([
    ['gh is missing', 'missing', 'gh is not installed'],
    ['gh is not signed in', { signedOut: true }, 'gh is not signed in to github.com'],
    ['gh is refused', { refuses: true }, 'gh refused it: HTTP 403: Resource not accessible by integration'],
  ])) {
    it(`a yes where ${why} says so and carries on, recorded as failed with why, never offered again`, () => {
      const main = codeProject({ remote: github.url });
      boot(main);
      let PATH;
      if (setUpGh === 'missing') {
        const bin = fs.mkdtempSync(path.join(world, 'bin-'));
        fs.symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim(), path.join(bin, 'git'));
        PATH = bin;
      } else {
        PATH = ghStub(setUpGh).PATH;
      }

      const out = engine.ok(main, ['github-rule', 'yes'], { env: { PATH } });

      assert.deepStrictEqual([out.github_rule, out.reason], ['failed', reason]);
      assert.deepStrictEqual(out.warnings, [`the rule against deleting or force-pushing leeway-state was not set on acme/portal: ${reason} — set it by hand under the repository's Settings → Rules`]);
      assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'failed', reason });
      assert.strictEqual(boot(main).github_rule_offer, false);
    });
  }

  it('an answer is recorded once', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });
    boot(main);
    engine.ok(main, ['github-rule', 'no'], { env: { PATH: gh.PATH } });

    assert.match(engine.refuses(main, ['github-rule', 'yes'], { env: { PATH: gh.PATH } }).error, /the offer is answered — "declined" is recorded, and an answer is recorded once/);
    assert.match(engine.refuses(main, ['github-rule', 'maybe']).error, /the answer is yes or no — got "maybe"/);
    assert.deepStrictEqual(gh.calls(), []);
  });

  it('a fresh clone of a project whose offer was answered is never offered it', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });
    boot(main);
    engine.ok(main, ['github-rule', 'no'], { env: { PATH: gh.PATH } });
    git(main, ['push', '-q', 'origin', 'main']);
    const fresh = cloneOf(github.url, 'fresh');

    const res = boot(fresh);

    assert.deepStrictEqual([res.state, res.github_rule_offer], ['ready', false]);
  });
});

describe('the GitHub rule beyond GitHub', () => {
  it('a remote that is not on GitHub is offered nothing, and a yes there is refused', () => {
    const bare = bareRemote(path.join(world, 'portal.git'));
    const { main } = setUp({ remote: bare });

    assert.strictEqual(boot(main).github_rule_offer, false);
    assert.match(engine.refuses(main, ['github-rule', 'yes']).error, /the state's remote is not on GitHub — there is no repository to set the rule on/);
  });

  it('reads a GitHub repository off every form a remote URL takes, and nothing else', () => {
    for (const url of [
      'git@github.com:acme/portal.git', 'git@github.com:acme/portal', 'https://github.com/acme/portal.git',
      'https://github.com/acme/portal/', 'https://token@github.com/acme/portal', 'ssh://git@github.com/acme/portal.git',
      'ssh://git@github.com:22/acme/portal.git', 'git://github.com/acme/portal.git', 'https://GitHub.com/acme/portal',
    ]) {
      assert.deepStrictEqual(githubRepository(url), { owner: 'acme', repo: 'portal' }, url);
    }
    for (const url of ['https://gitlab.com/acme/portal.git', 'git@github.com.evil.io:acme/portal.git', 'https://github.com/acme', '/srv/git/portal.git']) {
      assert.strictEqual(githubRepository(url), null, url);
    }
  });
});

// --- the catch-up at boot ------------------------------------------------------------

/** Two clones of one project's state: `there` set up and pushed, `here` a clone of it. */
function twoClones() {
  const bare = bareRemote(path.join(world, 'portal.git'));
  const there = setUp({ name: 'there', remote: bare });
  commitOnState(there.root, { 'manifest.json': JSON.stringify({ defaults: { plan_format: 'local' } }, null, 2) + '\n' });
  const main = cloneOf(bare, 'here');
  boot(main);
  return { bare, there, here: { main, root: path.join(main, '.leeway') } };
}

describe('the catch-up at boot (4.7.8)', () => {
  it('fast-forwards a branch only the remote moved before the migrations run (4.S36)', () => {
    const { there, here } = twoClones();
    const moved = commitOnState(there.root, { 'notes.md': 'from there\n' }).commit;
    const mark = path.join(world, 'migrated');

    const res = boot(here.main, { STUB_MIGRATE_MARK: mark });

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(here.main, STATE_BRANCH), moved);
    assert.strictEqual(read(here.root, 'notes.md'), 'from there\n');
    assert.strictEqual(fs.readFileSync(mark, 'utf8').trim(), moved, 'the migrations ran over the state already caught up');
  });

  it('a merge stopped by a field both clones changed ends boot there, with no migrations run; the screen and the pick answer it, and the next boot carries on', () => {
    const { bare, there, here } = twoClones();
    git(here.main, ['config', 'remote.origin.pushurl', path.join(world, 'nowhere.git')]);
    commitOnState(here.root, { 'manifest.json': JSON.stringify({ defaults: { plan_format: 'tick' } }, null, 2) + '\n' });
    git(here.main, ['config', '--unset', 'remote.origin.pushurl']);
    commitOnState(there.root, { 'manifest.json': JSON.stringify({ defaults: { plan_format: 'linear' } }, null, 2) + '\n' });
    const mark = path.join(world, 'migrated');

    assert.deepStrictEqual(boot(here.main, { STUB_MIGRATE_MARK: mark }), { ok: true, state: 'merge', warnings: [] });
    assert.ok(!fs.existsSync(mark), 'the migrations ran past the stop');

    const screen = engine.output(here.main, ['render', 'state-merge-gate']);
    assert.match(screen, /⚑ The state merge stopped: one field changed on both machines/);
    const choice = /^choice: (\S+)$/m.exec(screen);
    assert.ok(choice !== null);
    const picked = engine.ok(here.main, ['state-merge', 'pick', '1', choice[1]]);
    assert.strictEqual(picked.action, 'merged');

    const res = boot(here.main, { STUB_MIGRATE_MARK: mark });
    assert.strictEqual(res.state, 'ready');
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).defaults.plan_format, 'tick');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(fs.readFileSync(mark, 'utf8').trim(), tip(here.main, STATE_BRANCH));
  });

  it('pushes what a failed push left behind, the remote not moved since', () => {
    const { bare, here } = twoClones();
    git(here.main, ['config', 'remote.origin.pushurl', path.join(world, 'nowhere.git')]);
    const unpushed = commitOnState(here.root, { 'notes.md': 'unpushed\n' }).commit;
    git(here.main, ['config', '--unset', 'remote.origin.pushurl']);
    assert.notStrictEqual(remoteTip(bare), unpushed);

    assert.strictEqual(boot(here.main).state, 'ready');

    assert.strictEqual(remoteTip(bare), unpushed);
  });
});
