'use strict';

// ---------------------------------------------------------------------------
// What boot reads of the project for the start menu
// (workflow-engine/scripts/domain/boot.cjs): the baseline's status, the
// walkthrough's recorded answer, and the baseline signal — the code history
// from before the workflows arrived; and no worktree include written.
//
// Layer: verb. World: the project fixture (boot-world.cjs), a git repository
// with its state worktree and the workflows' hooks, made once per process and
// copied; boot runs from a copy of the engine beside a stand-in migration
// runner whose behaviour the test picks through the environment.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { git, statePath, layout } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const { createState } = require(path.join(REAL_SCRIPTS, 'domain/state-worktree.cjs'));
const { datedAt, createFile } = require('./discovery-test-utils.cjs');

const { WORKFLOW_HOOKS, hooked, stubbed, bootProject, runEngine } = require('./boot-world.cjs');

describe('engine boot', () => {
  let fix;
  beforeEach(() => { fix = bootProject(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('baseline: reports the project-manifest status; unrecognised or malformed values read none', () => {
    const projManifest = statePath(fix.project, layout.projectManifest);

    for (const status of ['native', 'in-progress', 'completed', 'skipped']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status } }));
      const res = runEngine(stubbed, fix.project, ['boot']);
      assert.strictEqual(res.baseline, status);
      // A recorded verdict is never re-judged, so the signal travels only with `none`.
      assert.ok(!('baseline_signal' in res), `${status}: no signal once a status is recorded`);
    }

    // Unrecognised value → none (the judgment-eligible default), signal attached.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status: 'weird' } }));
    const weird = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(weird.baseline, 'none');
    assert.strictEqual(weird.baseline_signal.commits_total, 2);

    // An object with nothing recorded → none.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: {} }));
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).baseline, 'none');

    // Malformed field shape → none.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: 'in-progress' }));
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).baseline, 'none');

    // No project manifest at all → none.
    fs.rmSync(projManifest);
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).baseline, 'none');
  });

  it('walkthrough: reports the recorded answer; unrecognised or malformed values read none', () => {
    const projManifest = statePath(fix.project, layout.projectManifest);

    for (const status of ['walked', 'skipped']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, walkthrough: { status } }));
      assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).walkthrough, status);
    }

    for (const walkthrough of [{ status: 'weird' }, {}, 'walked']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, walkthrough }));
      assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).walkthrough, 'none', JSON.stringify(walkthrough));
    }

    // The two one-time records are independent: a recorded baseline says
    // nothing about the offer, and vice versa.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status: 'native' }, walkthrough: { status: 'skipped' } }));
    const both = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(both.baseline, 'native');
    assert.strictEqual(both.walkthrough, 'skipped');

    fs.rmSync(projManifest);
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).walkthrough, 'none');
  });

  /**
   * A scratch repo beside the fixture, hermetic like it, with dated
   * commits and the state arriving on a date of the test's choosing. From
   * the first commit on, its settings carry the workflows' own hooks, like
   * the fixture's; its `.gitignore` names the state, as boot keeps it, held
   * out of the history by its own exclude: the history under test is the
   * project's own.
   */
  function scratchRepo(name) {
    const project = harness.initRepo(path.join(fix.root, name));
    fs.appendFileSync(path.join(project, '.git/info/exclude'), '.gitignore\n');
    createFile(project, '.gitignore', '.leeway/\n');
    createFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
    const at = (date) => (date.includes('T') ? date : `${date}T12:00:00Z`);
    const commit = (msg, date) => {
      execFileSync('git', ['add', '-A'], { cwd: project });
      execFileSync('git', ['commit', '-q', '--allow-empty', '-m', msg], { cwd: project, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: at(date), GIT_COMMITTER_DATE: at(date) } });
    };
    const arrive = (date) => datedAt(at(date), () => createState(statePath(project)));
    return { project, commit, arrive };
  }

  it('baseline_signal: a codebase committed before `.leeway/` arrived reads as history that predates the workflows — as commits and a tree, not a count', () => {
    // A brownfield repo: two commits of code (the skills install beside it,
    // which never counts as project code), then the workflows land.
    const { project, commit, arrive } = scratchRepo('brownfield');
    createFile(project, 'src/app.js', 'export default 1;\n');
    createFile(project, 'README.md', '# App\n');
    commit('initial', '2025-03-01');
    createFile(project, 'src/lib.js', 'export const x = 2;\n');
    commit('more code', '2025-06-15');

    // No state yet — the workflows arriving now: the whole history predates
    // them, and the tree is HEAD's.
    const { baselineSignal } = require(path.join(REAL_SCRIPTS, 'domain/baseline.cjs'));
    assert.deepStrictEqual(baselineSignal(project), {
      root_date: '2025-03-01', workflows_date: null, commits_total: 2, commits_before: 2,
      history_before: ['2025-03-01  initial', '2025-06-15  more code'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (2)', 'README.md'],
    });

    // The state lands, and the code goes on: the two commits before its first
    // commit are the history, and the tree is the one it arrived into.
    arrive('2025-09-01');
    createFile(project, 'src/later.js', 'export const y = 3;\n');
    commit('after the workflows', '2025-10-01');
    const res = runEngine(stubbed, project, ['boot']);
    assert.strictEqual(res.baseline, 'none');
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-03-01', workflows_date: '2025-09-01', commits_total: 3, commits_before: 2,
      history_before: ['2025-03-01  initial', '2025-06-15  more code'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (2)', 'README.md'],
    });
  });

  it('baseline_signal: the workflows arriving with the codebase\'s first commit report the tree they arrived into — a legacy codebase put under git at install is not a fresh start', () => {
    const { project, commit, arrive } = scratchRepo('legacy');
    for (const f of ['app/models/user.rb', 'app/models/order.rb', 'app/controllers/orders.rb', 'config/routes.rb', 'Gemfile']) createFile(project, f, '# code\n');
    commit('import', '2025-01-01');
    arrive('2025-01-01T12:00:01Z');
    const res = runEngine(stubbed, project, ['boot']);
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-01-01', workflows_date: '2025-01-01', commits_total: 1, commits_before: 1, history_before: ['2025-01-01  import'],
      files_at_arrival: 5, tree_at_arrival: ['app/ (3)', 'config/ (1)', 'Gemfile'],
    });
  });

  it('baseline_signal: the code before the arrival is the default branch\'s as it stood, never a side branch merged after', () => {
    // main: root(Jan) → c2(Feb), the state arriving in Apr, then a merge(May)
    // of a side branch cut from root in Mar. Its commit is older than the
    // arrival, but main never held it until the merge.
    const { project, commit, arrive } = scratchRepo('branched');
    createFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    createFile(project, 'src/b.js', 'b\n');
    createFile(project, 'src/c.js', 'c\n');
    commit('main work', '2025-02-01');
    git(project, ['checkout', '-q', '-b', 'side', 'HEAD~1']);
    createFile(project, 'docs/side.md', 'side\n');
    commit('side work', '2025-03-01');
    git(project, ['checkout', '-q', 'main']);
    arrive('2025-04-01');
    execFileSync('git', ['merge', '-q', '--no-edit', 'side'], { cwd: project, env: { ...process.env, GIT_AUTHOR_DATE: '2025-05-01T12:00:00Z', GIT_COMMITTER_DATE: '2025-05-01T12:00:00Z' } });
    const res = runEngine(stubbed, project, ['boot']);
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-01-01', workflows_date: '2025-04-01', commits_total: 4, commits_before: 2,
      history_before: ['2025-01-01  root', '2025-02-01  main work'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (3)'],
    });
  });

  it('baseline_signal: a long run keeps its head and tail around one elision line, and the tree its largest dozen entries', () => {
    const { project, commit, arrive } = scratchRepo('long');
    for (let i = 1; i <= 15; i += 1) {
      createFile(project, `dir${String(i).padStart(2, '0')}/f.js`, `${i}\n`);
      commit(`commit ${i}`, `2025-01-${String(i).padStart(2, '0')}`);
    }
    arrive('2025-02-01');
    const sig = runEngine(stubbed, project, ['boot']).baseline_signal;
    assert.strictEqual(sig.commits_before, 15);
    assert.strictEqual(sig.history_before.length, 8 + 1 + 4);
    assert.strictEqual(sig.history_before[8], '… 3 more …');
    assert.strictEqual(sig.history_before[0], '2025-01-01  commit 1');
    assert.strictEqual(sig.history_before[12], '2025-01-15  commit 15');
    assert.strictEqual(sig.files_at_arrival, 15);
    assert.strictEqual(sig.tree_at_arrival.length, 12 + 1);
    assert.strictEqual(sig.tree_at_arrival[12], '… 3 more …');
  });

  it('baseline_signal: reads the same through a signing user\'s `log.showSignature`', () => {
    const { project, commit, arrive } = scratchRepo('signed');
    createFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    arrive('2025-02-01');
    const plain = runEngine(stubbed, project, ['boot']).baseline_signal;
    git(project, ['config', 'log.showSignature', 'true']);
    const signed = runEngine(stubbed, project, ['boot']).baseline_signal;
    assert.deepStrictEqual(signed, plain);
    assert.strictEqual(plain.commits_before, 1);
  });

  it('baseline_signal: a `.worktreeinclude` in the tree is the project\'s own file, counted as any other — boot writes none', () => {
    const { project, commit, arrive } = scratchRepo('included');
    createFile(project, 'src/a.js', 'a\n');
    createFile(project, '.worktreeinclude', '.env\n');
    commit('root', '2025-01-01');
    arrive('2025-02-01');

    const sig = runEngine(stubbed, project, ['boot']).baseline_signal;

    assert.deepStrictEqual([sig.files_at_arrival, sig.tree_at_arrival], [2, ['.worktreeinclude', 'src/ (1)']]);
  });

  it('baseline_signal: a boot from inside the state worktree reads the code history, never the state branch\'s', () => {
    const { project, commit, arrive } = scratchRepo('inside');
    createFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    arrive('2025-02-01');
    const fromRoot = runEngine(stubbed, project, ['boot']).baseline_signal;
    const fromState = runEngine(stubbed, statePath(project), ['boot']).baseline_signal;

    assert.deepStrictEqual(fromState, fromRoot);
    assert.deepStrictEqual(fromState.history_before, ['2025-01-01  root']);
  });

  it('baseline_signal: no honest history to read — no commits, no repository, a shallow clone — is null, never a failure and never a fresh-start signal', () => {
    const empty = harness.initRepo(path.join(fix.root, 'empty'));
    createState(statePath(empty));
    // A hook refusing every code commit: boot's plumbing would otherwise
    // make the root commit — the history this test needs absent.
    createFile(empty, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(empty, '.git/hooks/pre-commit'), 0o755);
    const res = runEngine(stubbed, empty, ['boot']);
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal, null);

    const { baselineSignal } = require(path.join(REAL_SCRIPTS, 'domain/baseline.cjs'));
    const plain = path.join(fix.root, 'plain');
    fs.mkdirSync(plain, { recursive: true });
    assert.strictEqual(baselineSignal(plain), null);

    // A shallow clone of a brownfield history looks like a root-commit
    // arrival; it is truncated, not fresh, so the signal says so.
    const { project, commit, arrive } = scratchRepo('deep');
    createFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    createFile(project, 'src/b.js', 'b\n');
    commit('more', '2025-02-01');
    arrive('2025-03-01');
    const shallow = path.join(fix.root, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${project}`, shallow]);
    assert.strictEqual(baselineSignal(shallow), null);
  });

  it('baseline_signal: rides a not-ready boot too — the brownfield first boot returns from the knowledge gate to the judgment on that same response', () => {
    fs.writeFileSync(statePath(fix.project, layout.projectManifest), JSON.stringify({ work_units: {}, baseline: {} }));
    const res = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal.commits_total, 2, 'the fixture\'s code commits');
  });

  it('baseline: reported on a not-ready boot too — the brownfield first boot is exactly the knowledge-gate path', () => {
    fs.writeFileSync(statePath(fix.project, layout.projectManifest),
      JSON.stringify({ work_units: {}, baseline: { status: 'in-progress' } }));
    const res = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.baseline, 'in-progress');
  });
});

describe('engine boot: no worktree include', () => {
  let fix;
  beforeEach(() => { fix = bootProject(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('writes none — a project without one stays without one, and the user\'s own is left as it was', () => {
    const include = path.join(fix.project, '.worktreeinclude');
    const head = git(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual('worktree_include_installed' in res, false);
    assert.strictEqual(fs.existsSync(include), false);
    createFile(fix.project, '.worktreeinclude', '# local env\n.env\n');
    runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(fs.readFileSync(include, 'utf8'), '# local env\n.env\n');
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), head, 'and commits nothing on the code branch');
  });
});
