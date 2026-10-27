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
// stand-in ssh; `gh` is a stand-in on PATH. Boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { datedAt } = require('./discovery-test-utils.cjs');

const { git, initRepo } = harness;
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

  it('keeps the line in the .gitignore at the repository\'s top for a project nested in a larger one', () => {
    const top = initRepo(path.join(world, 'mono'));
    write(top, 'app/README.md', '# app\n');
    git(top, ['add', '-A']);
    git(top, ['commit', '-q', '-m', 'code']);
    const app = path.join(top, 'app');

    assert.strictEqual(boot(app).state, 'ready');

    assert.deepStrictEqual(placed(path.join(top, '.leeway')), IN_PLACE);
    assert.strictEqual(read(top, '.gitignore'), '.leeway/\n');
    assert.ok(!fs.existsSync(path.join(app, '.gitignore')));
    assert.strictEqual(git(top, ['status', '--porcelain', '--', '.leeway', '.gitignore']), '');
    assert.strictEqual(boot(app).state, 'ready');
    assert.strictEqual(read(top, '.gitignore'), '.leeway/\n');
  });

  it('a project on the layout before the state branch owes the migration: boot writes nothing', () => {
    const main = codeProject();
    write(main, '.workflows/payments/manifest.json', '{}\n');
    write(main, '.claude/settings.json', WORKFLOW_HOOKS);
    git(main, ['add', '-A']);
    git(main, ['commit', '-q', '-m', 'the old layout']);
    const before = git(main, ['for-each-ref']);

    assert.match(bootRefused(main), /keeps the workflows' state in \.workflows\/ on its code branch, the layout before leeway-state: moving it there is the migration's, so boot wrote nothing/);

    assert.strictEqual(git(main, ['for-each-ref']), before);
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));
    assert.strictEqual(git(main, ['status', '--porcelain']), '');
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

  for (const [file, line] of [['.gitignore', '.leeway/'], ['.worktreeinclude', '.leeway/.knowledge/store.bin']]) {
    it(`a line naming the state in the ${file} is the trace too`, () => {
      const main = lostProject({ trace: { [file]: `node_modules\n${line}\n` } });

      assert.strictEqual(boot(main).state, 'lost');
      assert.ok(!fs.existsSync(path.join(main, '.leeway')));
    });
  }

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

  it('a state folder with no branch here or on the remote is refused, nothing written', () => {
    const { main } = setUp();
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    assert.match(bootRefused(main), /\.leeway is there, but leeway-state is in neither this clone nor a remote: boot makes no state branch over a folder it cannot account for, and wrote nothing$/);
    assert.strictEqual(git(main, ['for-each-ref', `refs/heads/${STATE_BRANCH}`]), '');
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
});

// --- the GitHub rule ---------------------------------------------------------------

/**
 * A remote on GitHub, `git@github.com:acme/portal.git`, served by a bare
 * repository through a stand-in ssh: nothing leaves the machine.
 * @returns {{url: string, bare: string, env: Record<string, string>}}
 */
function fakeGithub() {
  const served = path.join(world, 'github');
  const bare = path.join(served, 'acme', 'portal.git');
  fs.mkdirSync(path.dirname(bare), { recursive: true });
  bareRemote(bare);
  const ssh = path.join(world, 'fake-ssh');
  write(world, 'fake-ssh', `#!/bin/sh\nfor last; do :; done\ncd "${served}" && exec /bin/sh -c "git \${last#git-}"\n`);
  fs.chmodSync(ssh, 0o755);
  return { url: 'git@github.com:acme/portal.git', bare, env: { GIT_SSH_COMMAND: ssh, GIT_SSH_VARIANT: 'simple' } };
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
    assert.deepStrictEqual([out.github_rule, out.rule_set, out.warnings], ['accepted', true, undefined]);
    assert.strictEqual(out.committed, git(main, ['rev-parse', '--short', STATE_BRANCH]).trim());
    assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'accepted' });
    assert.strictEqual(boot(main, { PATH: gh.PATH }).github_rule_offer, false);
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

    assert.deepStrictEqual([out.github_rule, out.rule_set], ['declined', false]);
    assert.deepStrictEqual(gh.calls(), []);
    assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'declined' });
    const next = boot(main, { PATH: gh.PATH });
    assert.deepStrictEqual([next.state, next.github_rule_offer], ['ready', false]);
  });

  for (const [why, setUpGh, said] of /** @type {const} */ ([
    ['gh is missing', 'missing', /: gh is not installed — set it by hand under the repository's Settings → Rules$/],
    ['gh is not signed in', { signedOut: true }, /: gh is not signed in to github\.com — set it by hand/],
    ['gh is refused', { refuses: true }, /: gh refused it: HTTP 403: Resource not accessible by integration — set it by hand/],
  ])) {
    it(`a yes where ${why} says so and carries on, the answer recorded`, () => {
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

      assert.deepStrictEqual([out.github_rule, out.rule_set], ['accepted', false]);
      assert.strictEqual(out.warnings.length, 1);
      assert.match(out.warnings[0], /^the rule against deleting or force-pushing leeway-state was not set on acme\/portal/);
      assert.match(out.warnings[0], said);
      assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'accepted' });
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
