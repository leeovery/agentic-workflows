'use strict';

// ---------------------------------------------------------------------------
// A project being set up (workflow-engine/scripts/domain/boot.cjs with
// domain/state-checks.cjs and domain/code-trace.cjs): the orphan state
// branch checked out at .leeway/ and locked, pushed where there is a remote,
// then the ignore line committed through the code door; a boot cut short
// leaving no trace; the line kept in a nested project's .gitignore and the
// exclude file; a boot from a code worktree; and the layout before the state
// branch stopping for its migration.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { datedAt, createFile, readFile } = require('./discovery-test-utils.cjs');
const { git, initRepo, tip, remoteTip } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, STATE_GITIGNORE } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const { useWorld, WORKFLOW_HOOKS, STUB_ENGINE, codeProject, cloneOf, boot, bootRefused, setUp, placed, IN_PLACE, bootsWithNothingToDo } = require('./boot-state-world.cjs');

const world = useWorld();

// --- setting the state up ---------------------------------------------------

describe('a project being set up (4.S12, 4.5.2)', () => {
  it('gets the orphan leeway-state checked out at .leeway/ and locked, then the ignore line in .gitignore committed through the code door — and the next boot has nothing to do', () => {
    const main = codeProject();

    const res = boot(main);

    const root = path.join(main, '.leeway');
    assert.deepStrictEqual([res.state, res.github_rule_offer, res.github_squash_offer, res.warnings], ['ready', false, false, []]);
    assert.deepStrictEqual(git(main, ['rev-list', STATE_BRANCH]).trim().split('\n'), [tip(main, STATE_BRANCH)], 'one commit, with no parent');
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:.gitignore`]), STATE_GITIGNORE);
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(readFile(main, '.gitignore'), '.leeway/\n');
    const ignored = git(main, ['log', '--format=%H %s', '--', '.gitignore']).trim();
    assert.match(ignored, / chore: ignore \.leeway\/, the workflows state$/);
    assert.deepStrictEqual(git(main, ['show', '--name-only', '--format=', ignored.split(' ')[0]]).trim().split('\n'), ['.gitignore']);
    assert.strictEqual(git(main, ['status', '--porcelain', '--', '.gitignore', '.leeway']), '');

    bootsWithNothingToDo(main, null);
  });

  it('pushes the new branch where the project has a remote', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const main = codeProject({ remote: bare });

    boot(main);

    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    bootsWithNothingToDo(main, bare);
  });

  it('appends the ignore line to a .gitignore that holds others, and keeps one that names the state as it is', () => {
    const main = codeProject();
    createFile(main, '.gitignore', 'node_modules');
    git(main, ['add', '.gitignore']);
    git(main, ['commit', '-q', '-m', 'ignore']);

    boot(main);
    assert.strictEqual(readFile(main, '.gitignore'), 'node_modules\n.leeway/\n');

    createFile(main, '.gitignore', 'node_modules\n/.leeway\n');
    git(main, ['commit', '-q', '-am', 'anchored']);
    const before = tip(main, 'main');
    boot(main);
    assert.strictEqual(readFile(main, '.gitignore'), 'node_modules\n/.leeway\n');
    assert.strictEqual(tip(main, 'main'), before);
  });

  it('a boot cut short after the branch is made leaves the state with no trace, and the next boot writes the line', () => {
    const main = codeProject();
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"worktree lock"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    const killed = spawnSync('node', [STUB_ENGINE, 'boot'], { cwd: main, encoding: 'utf8', env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    const made = tip(main, STATE_BRANCH);
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.ok(!fs.existsSync(path.join(main, '.gitignore')), 'the trace came before the state was whole');
    assert.ok(!fs.existsSync(path.join(main, '.claude/settings.json')), 'the hooks came before the state was whole');

    assert.strictEqual(boot(main).state, 'ready');
    assert.strictEqual(tip(main, STATE_BRANCH), made, 'the state was made once');
    assert.strictEqual(readFile(main, '.gitignore'), '.leeway/\n');
  });

  it('a boot whose branch cannot be checked out writes no trace', () => {
    const main = codeProject();
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\ncase "$*" in *"worktree add"*) echo "fatal: refused" >&2; exit 128 ;; esac\nexec "${real}" "$@"\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    assert.match(bootRefused(main, { PATH: `${wrapper}:${process.env.PATH}` }), /git worktree failed: fatal: refused/);

    assert.ok(!fs.existsSync(path.join(main, '.gitignore')));
    assert.ok(!fs.existsSync(path.join(main, '.claude/settings.json')));
    assert.strictEqual(boot(main).state, 'ready', 'the branch made is checked out at the next boot');
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.strictEqual(readFile(main, '.gitignore'), '.leeway/\n');
  });

  it('reads only the person\'s own commits as the history before the workflows — never the setup\'s ignore line and hooks', () => {
    const main = datedAt('2025-03-01T12:00:00Z', () => codeProject());

    const { baseline_signal: signal } = boot(main);

    assert.deepStrictEqual([signal.commits_total, signal.commits_before, signal.history_before], [3, 1, ['2025-03-01  code']]);
    assert.deepStrictEqual([signal.files_at_arrival, signal.tree_at_arrival], [1, ['README.md']]);
  });

  it('keeps the line in the .gitignore of a project nested in a larger one, beside its settings, the state at the repository\'s top ignored by the exclude file', () => {
    const top = initRepo(path.join(world(), 'mono'));
    createFile(top, 'app/README.md', '# app\n');
    git(top, ['add', '-A']);
    git(top, ['commit', '-q', '-m', 'code']);
    const app = path.join(top, 'app');

    assert.strictEqual(boot(app).state, 'ready');

    assert.deepStrictEqual(placed(path.join(top, '.leeway')), IN_PLACE);
    assert.strictEqual(readFile(app, '.gitignore'), '.leeway/\n');
    assert.ok(fs.existsSync(path.join(app, '.claude/settings.json')), 'the hooks it sits beside');
    assert.ok(!fs.existsSync(path.join(top, '.gitignore')), 'nothing written outside the project');
    assert.deepStrictEqual(git(top, ['show', '--name-only', '--format=', 'HEAD~1', 'HEAD']).trim().split('\n').filter(Boolean).sort(), ['app/.claude/settings.json', 'app/.gitignore']);
    assert.strictEqual(git(top, ['status', '--porcelain']), '');
    assert.strictEqual(boot(app).state, 'ready');
    assert.strictEqual(readFile(app, '.gitignore'), '.leeway/\n');
  });

  it('keeps the state folder in the repository\'s exclude file, once, on every boot — so no branch takes it in', () => {
    const main = codeProject();
    const exclude = path.join(main, '.git/info/exclude');

    boot(main);
    fs.writeFileSync(exclude, readFile(main, '.git/info/exclude').replace('/.leeway/\n', ''));
    boot(main);
    boot(main);

    assert.strictEqual(readFile(main, '.git/info/exclude').split('\n').filter((line) => line === '/.leeway/').length, 1);
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
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main } = setUp({ remote: bare });
    git(bare, ['update-ref', 'refs/heads/main', git(main, ['rev-parse', 'main~2']).trim()]);
    const fresh = cloneOf(bare, 'fresh');
    assert.ok(!fs.existsSync(path.join(fresh, '.gitignore')), 'the clone\'s branch holds no ignore line');
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"worktree lock"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    const killed = spawnSync('node', [STUB_ENGINE, 'boot'], { cwd: fresh, encoding: 'utf8', env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    assert.ok(fs.existsSync(path.join(fresh, '.leeway/.gitignore')), 'the state is checked out');
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
    git(fresh, ['add', '-A']);
    assert.strictEqual(git(fresh, ['ls-files', '--stage', '--', '.leeway']), '');
  });

  it('a boot from a code worktree commits the line and the hooks on that worktree\'s branch, never on the main checkout\'s', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const main = codeProject({ remote: bare });
    const fresh = cloneOf(bare, 'fresh', ['--branch', 'main']);
    boot(main);
    const code = path.join(world(), 'fresh-feature');
    git(fresh, ['worktree', 'add', '-q', '-b', 'feature', code]);
    const before = { main: tip(fresh, 'main'), feature: tip(fresh, 'feature') };

    assert.strictEqual(boot(code).state, 'ready');

    assert.strictEqual(tip(fresh, 'main'), before.main, 'the main checkout\'s branch gained nothing');
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
    assert.deepStrictEqual(git(fresh, ['log', '--format=%s', `${before.feature}..feature`]).trim().split('\n'),
      ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state']);
    assert.strictEqual(readFile(code, '.gitignore'), '.leeway/\n');
    assert.ok(!fs.existsSync(path.join(code, '.leeway')));
  });

  it('a project on the layout before the state branch stops for the migration: boot writes nothing — and the next boot stops again', () => {
    const main = codeProject();
    createFile(main, '.workflows/payments/manifest.json', '{}\n');
    createFile(main, '.claude/settings.json', WORKFLOW_HOOKS);
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
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main } = setUp({ remote: bare });
    const other = cloneOf(bare, 'other');
    createFile(other, '.workflows/payments/manifest.json', '{}\n');
    git(other, ['add', '-A']);
    git(other, ['commit', '-q', '-m', 'the old layout']);

    assert.strictEqual(boot(other).state, 'ready');
    assert.strictEqual(tip(other, STATE_BRANCH), tip(main, STATE_BRANCH));
  });
});
