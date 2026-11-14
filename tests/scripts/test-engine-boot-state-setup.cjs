'use strict';

// ---------------------------------------------------------------------------
// A project being set up (leeway-engine/scripts/domain/boot.cjs with
// domain/state-checks.cjs and domain/code-trace.cjs): the orphan state
// branch checked out at .leeway/ and locked, pushed where there is a remote,
// then the ignore line committed through the code door; a boot cut short
// leaving no trace; the line kept in a nested project's .gitignore and the
// exclude file; a boot from a code worktree; and a project owing the
// reshape, whose migration boot runs in the main checkout's project folder
// under its lock — its guard's refusal a stop with nothing written, boot
// reading that refusal alone and only its facts, a warning naming what a
// boot from another checkout leaves unmoved, and a second boot meanwhile
// waiting for the run to end.
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
const { execFileSync, spawn, spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { TEMPLATE_DATE, createFile, readFile } = require('./discovery-test-utils.cjs');
const { git, commitCode, initRepo, tip, remoteTip, lockAttempts, STATE_DIR_NAME, statePath, layout } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, STATE_GITIGNORE } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const { useWorld, remoteProject, OWN_SETTINGS, STUB_ENGINE, projectInWorld, cloneInWorld, boot, bootRefused, setUp, placed, IN_PLACE, bootsWithNothingToDo, untouched } = require('./boot-state-world.cjs');

const world = useWorld();

/** A project on the layout before Leeway's, its `.workflows/` and the workflows' hooks committed: its main checkout. */
function owingProject() {
  const main = projectInWorld();
  createFile(main, '.workflows/payments/manifest.json', '{}\n');
  createFile(main, '.claude/settings.json', OWN_SETTINGS);
  commitCode(main, 'the old layout');
  return main;
}

/** Each line the stand-in runner recorded of its runs. @param {string} file @returns {Record<string, unknown>[]} */
function runsOf(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

/** Resolved once `holds` answers true, polled; rejected after twenty seconds. @param {() => boolean} holds */
async function until(holds) {
  for (const giveUp = Date.now() + 20000; !holds();) {
    if (Date.now() > giveUp) throw new Error('waited twenty seconds for what never came');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// --- setting the state up ---------------------------------------------------

describe('a project being set up (4.S12, 4.5.2)', () => {
  it('gets the orphan leeway-state checked out at .leeway/ and locked, then the ignore line in .gitignore committed through the code door — and the next boot has nothing to do', () => {
    const main = projectInWorld();

    const res = boot(main);

    const root = statePath(main);
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
    const { main, bare } = remoteProject();

    boot(main);

    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    bootsWithNothingToDo(main, bare);
  });

  it('appends the ignore line to a .gitignore that holds others, and keeps one that names the state as it is', () => {
    const main = projectInWorld();
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
    const main = projectInWorld();
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"worktree lock"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    const killed = spawnSync('node', [STUB_ENGINE, 'boot'], { cwd: main, encoding: 'utf8', env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    const made = tip(main, STATE_BRANCH);
    assert.deepStrictEqual(placed(statePath(main)), IN_PLACE);
    assert.ok(!fs.existsSync(path.join(main, '.gitignore')), 'the trace came before the state was whole');
    assert.ok(!fs.existsSync(path.join(main, '.claude/settings.json')), 'the hooks came before the state was whole');

    assert.strictEqual(boot(main).state, 'ready');
    assert.strictEqual(tip(main, STATE_BRANCH), made, 'the state was made once');
    assert.strictEqual(readFile(main, '.gitignore'), '.leeway/\n');
  });

  it('a boot whose branch cannot be checked out writes no trace', () => {
    const main = projectInWorld();
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\ncase "$*" in *"worktree add"*) echo "fatal: refused" >&2; exit 128 ;; esac\nexec "${real}" "$@"\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    assert.match(bootRefused(main, { PATH: `${wrapper}:${process.env.PATH}` }), /git worktree failed: fatal: refused/);

    assert.ok(!fs.existsSync(path.join(main, '.gitignore')));
    assert.ok(!fs.existsSync(path.join(main, '.claude/settings.json')));
    assert.strictEqual(boot(main).state, 'ready', 'the branch made is checked out at the next boot');
    assert.deepStrictEqual(placed(statePath(main)), IN_PLACE);
    assert.strictEqual(readFile(main, '.gitignore'), '.leeway/\n');
  });

  it('reads only the person\'s own commits as the history before the workflows — never the setup\'s ignore line and hooks', () => {
    const main = projectInWorld();

    const { baseline_signal: signal } = boot(main);

    assert.deepStrictEqual([signal.commits_total, signal.commits_before, signal.history_before], [3, 1, [`${TEMPLATE_DATE.slice(0, 10)}  code`]]);
    assert.deepStrictEqual([signal.files_at_arrival, signal.tree_at_arrival], [1, ['README.md']]);
  });

  it('keeps the line in the .gitignore of a project nested in a larger one, beside its settings, the state at the repository\'s top ignored by the exclude file', () => {
    const top = initRepo(path.join(world(), 'mono'));
    createFile(top, 'app/README.md', '# app\n');
    commitCode(top, 'code');
    const app = path.join(top, 'app');

    assert.strictEqual(boot(app).state, 'ready');

    assert.deepStrictEqual(placed(statePath(top)), IN_PLACE);
    assert.strictEqual(readFile(app, '.gitignore'), '.leeway/\n');
    assert.ok(fs.existsSync(path.join(app, '.claude/settings.json')), 'the hooks it sits beside');
    assert.ok(!fs.existsSync(path.join(top, '.gitignore')), 'nothing written outside the project');
    assert.deepStrictEqual(git(top, ['show', '--name-only', '--format=', 'HEAD~1', 'HEAD']).trim().split('\n').filter(Boolean).sort(), ['app/.claude/settings.json', 'app/.gitignore']);
    assert.strictEqual(git(top, ['status', '--porcelain']), '');
    assert.strictEqual(boot(app).state, 'ready');
    assert.strictEqual(readFile(app, '.gitignore'), '.leeway/\n');
  });

  it('keeps the state folder in the repository\'s exclude file, once, on every boot — so no branch takes it in', () => {
    const main = projectInWorld();
    const exclude = path.join(main, '.git/info/exclude');

    boot(main);
    fs.writeFileSync(exclude, readFile(main, '.git/info/exclude').replace('/.leeway/\n', ''));
    boot(main);
    boot(main);

    assert.strictEqual(readFile(main, '.git/info/exclude').split('\n').filter((line) => line === '/.leeway/').length, 1);
  });

  it('a code branch cut before setup, checked out in the main checkout, takes nothing of the state in — `git add -A` stages none of it (4.1.2, 4.1.3)', () => {
    const main = projectInWorld();
    git(main, ['branch', 'before-setup']);
    boot(main);
    git(main, ['checkout', '-q', 'before-setup']);
    assert.ok(!fs.existsSync(path.join(main, '.gitignore')), 'the branch holds no ignore line');

    git(main, ['add', '-A']);

    assert.strictEqual(git(main, ['status', '--porcelain']), '');
    assert.strictEqual(git(main, ['ls-files', '--stage', '--', '.leeway']), '', 'no gitlink, no file of the state');
  });

  it('a fresh clone ignores the state at once, before any commit — even a boot killed as the worktree is locked', () => {
    const { main, bare } = setUp({ remote: true });
    git(bare, ['update-ref', 'refs/heads/main', git(main, ['rev-parse', 'main~2']).trim()]);
    const fresh = cloneInWorld(bare, 'fresh');
    assert.ok(!fs.existsSync(path.join(fresh, '.gitignore')), 'the clone\'s branch holds no ignore line');
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"worktree lock"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);

    const killed = spawnSync('node', [STUB_ENGINE, 'boot'], { cwd: fresh, encoding: 'utf8', env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    assert.ok(fs.existsSync(statePath(fresh, layout.gitignore)), 'the state is checked out');
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
    git(fresh, ['add', '-A']);
    assert.strictEqual(git(fresh, ['ls-files', '--stage', '--', '.leeway']), '');
  });

  it('a boot from a code worktree commits the line and the hooks on that worktree\'s branch, never on the main checkout\'s', () => {
    const { main, bare } = remoteProject();
    const fresh = cloneInWorld(bare, 'fresh', ['--branch', 'main']);
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
    assert.ok(!fs.existsSync(path.join(code, STATE_DIR_NAME)));
  });

  it('a project owing the reshape runs the migration in the main checkout\'s project folder, wherever boot was called from — under boot\'s lock, before the state is there to take the writer lock in, then under both while it runs (21.1.2, 21.1.3)', () => {
    const main = owingProject();
    const code = path.join(world(), 'portal-feature');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
    const runs = path.join(world(), 'runs.jsonl');
    const env = { STUB_MIGRATE_MODE: 'reshape', STUB_MIGRATE_RUNS: runs };
    const before = git(main, ['for-each-ref']);

    assert.deepStrictEqual([boot(code, env).state, boot(code, env).state], ['ready', 'ready']);

    assert.deepStrictEqual(runsOf(runs), [
      { at: 'start', cwd: main, boot: true, writer: false }, { at: 'end', cwd: main, boot: true, writer: false },
      { at: 'start', cwd: main, boot: true, writer: true }, { at: 'end', cwd: main, boot: true, writer: true },
    ]);
    assert.deepStrictEqual(placed(statePath(main)), IN_PLACE);
    assert.strictEqual(git(main, ['for-each-ref']), before, 'nothing made or committed on any branch');
  });

  it('a placement the migration cut short — the state worktree added, not yet on its branch — is the migration\'s to finish: boot runs it, and the state is in place', () => {
    const main = owingProject();
    git(main, ['worktree', 'add', '-q', '--detach', '--no-checkout', STATE_DIR_NAME, 'HEAD']);

    assert.strictEqual(boot(main, { STUB_MIGRATE_MODE: 'reshape' }).state, 'ready');

    assert.deepStrictEqual(placed(statePath(main)), IN_PLACE);
  });

  it('a refusal of the reshape\'s guard stops boot with its facts, nothing written but the exclude line, the conversation unstamped — and the next boot runs the guard again', () => {
    const main = owingProject();
    const refused = { cause: 'live', unit: 'payments', phase: 'discussion', topic: 'checkout', active: 42 };
    const config = path.join(world(), 'config');
    const env = { STUB_MIGRATE_MODE: 'refuse', STUB_MIGRATE_REFUSAL: JSON.stringify(refused), CLAUDE_CODE_SESSION_ID: 'guarded', LEEWAY_CONFIG_DIR: config };
    const before = untouched(main, null);

    assert.deepStrictEqual(boot(main, env), { ok: true, state: 'guard', ...refused, warnings: [] });

    assert.deepStrictEqual(untouched(main, null), before);
    assert.ok(!fs.existsSync(statePath(main)), 'no state folder, so no record, lock or journal');
    assert.ok(!fs.existsSync(path.join(config, 'conversations', 'guarded', 'booted.json')), 'nothing may touch the work at the stop (22.1.7)');
    assert.strictEqual(readFile(main, '.git/info/exclude').split('\n').filter((line) => line === '/.leeway/').length, 1);
    assert.strictEqual(boot(main, env).state, 'guard');
  });

  it('reads the guard\'s refusal alone, and of it only the facts its stop states: no fact overwrites the stop, and another migration\'s refusal marker is none of boot\'s', () => {
    const owing = owingProject();
    const refused = { cause: 'live', unit: 'payments', phase: 'discussion', topic: 'checkout', active: 42 };
    const facts = JSON.stringify({ ...refused, ok: false, state: 'ready', warnings: ['a fact'], more: true });
    const settled = projectInWorld({ name: 'shop' });
    boot(settled);

    assert.deepStrictEqual(boot(owing, { STUB_MIGRATE_MODE: 'refuse', STUB_MIGRATE_REFUSAL: facts }), { ok: true, state: 'guard', ...refused, warnings: [] });
    const other = boot(settled, { STUB_MIGRATE_MODE: 'refuse', STUB_MIGRATE_REFUSED: '075', STUB_MIGRATE_REFUSAL: facts });
    assert.deepStrictEqual([other.state, other.migrations.output], ['ready', `---REFUSED: 075---\n${facts}`]);
  });

  it('called from another checkout, warns of each file of its .workflows/ that differs from the main checkout\'s, which the migration leaves where it is — the files the old state ignores aside; called from the main checkout, of none', () => {
    const main = owingProject();
    createFile(main, '.workflows/.gitignore', '.cache/\n');
    createFile(main, '.workflows/payments/discussion/payments.md', '# Payments\n');
    commitCode(main, 'a discussion');
    const code = path.join(world(), 'portal-feature');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
    createFile(code, '.workflows/payments/discussion/payments.md', '# Payments, as the branch has it\n');
    commitCode(code, 'the branch\'s discussion');
    createFile(code, '.workflows/payments/research/payments.md', '# Research\n');
    fs.rmSync(path.join(code, '.workflows/payments/manifest.json'));
    createFile(code, '.workflows/.cache/payments/discussion/payments/presence', '{}\n');
    const env = { STUB_MIGRATE_MODE: 'reshape' };
    const unmoved = (/** @type {{warnings: string[]}} */ booted) => booted.warnings.filter((warning) => warning.startsWith('the migration moves'));

    assert.deepStrictEqual(unmoved(boot(code, env)), [
      `the migration moves the project's state as the main checkout holds it, in ${main}; where boot ran, in ${code}, these differ from it and stay where they are: `
        + '.workflows/payments/discussion/payments.md, .workflows/payments/manifest.json, .workflows/payments/research/payments.md',
    ]);
    assert.deepStrictEqual(unmoved(boot(main, env)), []);
  });

  it('a second boot meanwhile waits on boot\'s lock until the first boot\'s run ends, then runs the migration under way itself', async (t) => {
    const main = owingProject();
    const runs = path.join(world(), 'runs.jsonl');
    const go = path.join(world(), 'go');
    const env = { STUB_MIGRATE_MODE: 'reshape', STUB_MIGRATE_RUNS: runs, STUB_MIGRATE_HOLD: go };
    const first = spawn(process.execPath, [STUB_ENGINE, 'boot'], { cwd: main, env: { ...process.env, ...env }, stdio: 'ignore', timeout: 30000, killSignal: 'SIGKILL' });
    const firstEnded = new Promise((resolve) => first.on('close', resolve));
    await until(() => runsOf(runs).length === 1);
    const attempts = lockAttempts(t, path.join(main, '.git/leeway-boot.lock'), (taken) => { if (taken === 1) fs.writeFileSync(go, ''); });

    assert.strictEqual(boot(main, env).state, 'ready');

    assert.strictEqual(await firstEnded, 0);
    assert.strictEqual(attempts[0], 'taken', 'the second boot found the lock held');
    assert.deepStrictEqual(runsOf(runs).map((run) => [run.at, run.writer]), [['start', false], ['end', false], ['start', true], ['end', true]]);
  });

  it('the old layout beside a remote holding leeway-state is a clone to bring the state into, not refused', () => {
    const { main, bare } = setUp({ remote: true });
    const other = cloneInWorld(bare, 'other');
    createFile(other, '.workflows/payments/manifest.json', '{}\n');
    commitCode(other, 'the old layout');

    assert.strictEqual(boot(other).state, 'ready');
    assert.strictEqual(tip(other, STATE_BRANCH), tip(main, STATE_BRANCH));
  });
});
