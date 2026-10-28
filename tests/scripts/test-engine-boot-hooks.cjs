'use strict';

// ---------------------------------------------------------------------------
// The project's session hooks at boot (workflow-engine/scripts/domain/boot.cjs
// with domain/session-label.cjs): the tmux label choice reported, the
// calling conversation's position dropped, the workflows' own hooks and the
// label hooks installed or taken out, the sync under the writer lock, and
// the person's settings kept.
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
const os = require('os');
const path = require('path');
const { installTmuxStub, tmuxStubEnv, tmuxStubName } = require('./tmux-stub.cjs');
const harness = require('./engine-harness.cjs');
const { git, stateGit, commitAll } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const { processStartTime } = require(path.join(REAL_SCRIPTS, 'kernel/process.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { hookHelpers, WORKFLOW_HOOKS, OWN_HOOKS, hooked, LABELS_ON, stubbed, bootProject, runEngine, runEngineFails } = require('./boot-world.cjs');

describe('engine boot: the project\'s session hooks, and the gate mod', () => {
  let fix;
  beforeEach(() => { fix = bootProject(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  const { dropSettings, commitSettings, bootWith, settings } = hookHelpers(() => fix);

  /** Stamp the label choice on the project manifest and commit it, so boot's only new dirt is its own. */
  function recordChoice(value) {
    createFile(fix.project, '.leeway/manifest.json', JSON.stringify({ defaults: { tmux_labels: value } }, null, 2) + '\n');
    commitAll(fix.project, 'record the defaults');
  }

  it('reports no-tmux outside tmux regardless of the recorded choice', () => {
    recordChoice(true);
    assert.strictEqual(bootWith({ tmux: false }).tmux_labels, 'no-tmux');
  });

  it('reports prompt in tmux when never recorded', () => {
    assert.strictEqual(bootWith({ tmux: true }).tmux_labels, 'prompt');
  });

  it('reports on/off in tmux from the project manifest', () => {
    recordChoice(true);
    assert.strictEqual(bootWith({ tmux: true }).tmux_labels, 'on');
    recordChoice(false);
    assert.strictEqual(bootWith({ tmux: true }).tmux_labels, 'off');
  });

  it('label_repaired is true when this session\'s own label is on the terminal — the start menu is the original name', () => {
    recordChoice(true);
    const stub = installTmuxStub();
    try {
      const identity = { ...tmuxStubEnv(stub), TMUX_PANE: '%3', CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid) };
      runEngine(stubbed, fix.project, ['session', 'label', 'payments', 'discussion', 'payments'], { ...identity, TMUX: '/fake/sock,123,7' });
      assert.strictEqual(tmuxStubName(stub), 'proj-abc · payments · discussion');
      assert.strictEqual(bootWith({ tmux: true, env: identity }).label_repaired, true);
      assert.strictEqual(tmuxStubName(stub), 'proj-abc');
      assert.strictEqual(bootWith({ tmux: true, env: identity }).label_repaired, false, 'nothing left to repair');
    } finally {
      fs.rmSync(stub, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('drops the calling conversation\'s own position, labels off, and leaves another\'s — the start menu is no position', () => {
    recordChoice(false);
    const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-config-'));
    try {
      const as = (id) => ({ WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: id });
      const positionOf = (id) => path.join(config, 'conversations', id, 'position.json');
      for (const id of ['sess-1', 'sess-2']) runEngine(stubbed, fix.project, ['session', 'label', 'payments', 'discussion', 'payments'], as(id));
      assert.ok(fs.existsSync(positionOf('sess-1')) && fs.existsSync(positionOf('sess-2')));
      assert.strictEqual(bootWith({ env: as('sess-1') }).label_repaired, false);
      assert.ok(!fs.existsSync(positionOf('sess-1')), 'boot took the calling conversation\'s own off');
      assert.ok(fs.existsSync(positionOf('sess-2')), 'and left another\'s');
    } finally {
      fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('drops the calling conversation\'s own position before its migrations run — a boot that fails leaves none', () => {
    const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-config-'));
    try {
      const as = { WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1' };
      const position = path.join(config, 'conversations', 'sess-1', 'position.json');
      runEngine(stubbed, fix.project, ['session', 'label', 'payments', 'discussion', 'payments'], as);
      assert.ok(fs.existsSync(position));
      assert.match(runEngineFails(stubbed, fix.project, ['boot'], { ...as, STUB_MIGRATE_MODE: 'fail' }).error, /migrate\.cjs failed/);
      assert.ok(!fs.existsSync(position), 'the failed boot left no position');
    } finally {
      fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('a boot from inside the state worktree installs into the main checkout — its settings, committed on its branch — and the state branch gains nothing', () => {
    dropSettings();
    const state = path.join(fix.project, '.leeway');
    const stateHead = stateGit(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(stubbed, state, ['boot']);

    assert.strictEqual(res.session_hooks_installed, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s', 'main']).trim(), 'chore: install workflow session hooks');
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'main']).trim().split('\n'), ['.claude/settings.json']);
    assert.strictEqual(stateGit(fix.project, ['rev-parse', 'HEAD']).trim(), stateHead, 'no commit on leeway-state');
    assert.strictEqual(fs.existsSync(path.join(state, '.claude')), false);
    assert.strictEqual(fs.existsSync(path.join(state, '.worktreeinclude')), false);
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']), '', 'nothing written into the state worktree');
  });

  it('a project with no settings gets the workflows\' own hooks installed — `presence cleanup` and `conversation end`, and the layout hook before Write, Edit and NotebookEdit — committed confined, and a second boot changes nothing', () => {
    dropSettings();
    const first = bootWith();
    assert.strictEqual(first.session_hooks_installed, true);
    assert.deepStrictEqual(first.warnings, []);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: install workflow session hooks');
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.claude/settings.json']);
    const head = git(fix.project, ['rev-parse', 'HEAD']);

    const second = bootWith();
    assert.strictEqual(second.session_hooks_installed, false);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']), head, 'nothing new to commit');
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.claude', '.leeway']).trim(), '', 'and no new dirt');
  });

  it('labels on adds `session cleanup` beside the workflows\' own, in one group, and a SessionStart `session resume` matched to resume — one commit', () => {
    recordChoice(true);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8')), JSON.parse(LABELS_ON));
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.claude/settings.json']);
    assert.strictEqual(bootWith().session_hooks_installed, false);
  });

  it('labels off wants the workflows\' own alone — a `session cleanup` and a `session resume` left behind come back out', () => {
    recordChoice(false);
    commitSettings(LABELS_ON);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
  });

  it('labels never asked wants the workflows\' own alone too — stale label hooks come back out', () => {
    assert.strictEqual(bootWith().session_hooks_installed, false, 'the fixture already carries it');
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/manifest.json')), 'no choice recorded');
    commitSettings(LABELS_ON);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
  });

  it('the hook sync waits on a live writer lock — the opt-in read and the write are one hold', (t) => {
    dropSettings();
    const lock = path.join(fix.project, '.leeway', '.lock');
    const settingsFile = path.join(fix.project, '.claude/settings.json');
    const unlink = fs.unlinkSync;
    // A live peer takes the lock the moment boot's migrations let it go…
    let peerTook = false;
    t.mock.method(fs, 'unlinkSync', (/** @type {string} */ file) => {
      unlink(file);
      if (file !== lock || peerTook) return;
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
      peerTook = true;
    });
    /** @type {boolean[]} */
    const written = [];
    // …and, once the hook sync has found it held and tried again, turns
    // labels on and lets go.
    const attempts = harness.lockAttempts(t, lock, (taken) => {
      written.push(fs.existsSync(settingsFile));
      if (taken < 2) return;
      createFile(fix.project, '.leeway/manifest.json', JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
      stateGit(fix.project, ['add', '--', 'manifest.json']);
      stateGit(fix.project, ['commit', '-q', '-m', 'labels on']);
      unlink(lock);
    });

    const res = bootWith();

    assert.deepStrictEqual(attempts, ['made', 'taken', 'taken', 'made']);
    assert.deepStrictEqual(written, [false, false], 'no settings write while the peer holds the lock');
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(settingsFile, 'utf8'), LABELS_ON, 'the opt-in read under the hold that writes the settings');
  });

  it('installs into existing settings without disturbing them', () => {
    commitSettings(JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }, null, 2) + '\n');
    assert.strictEqual(bootWith().session_hooks_installed, true);
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: OWN_HOOKS,
    });
  });

  it('WORKFLOWS_HOLD_PROJECT_SETTINGS=1 — the test harness\'s switch — never touches settings, labels on or off', () => {
    dropSettings();
    assert.strictEqual(bootWith({ holdSettings: true }).session_hooks_installed, false);
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')));
    recordChoice(true);
    assert.strictEqual(bootWith({ holdSettings: true }).session_hooks_installed, false);
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'no settings', 'no commit of boot\'s');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'record the defaults', 'no commit of boot\'s');
  });

  it('a settings file that does not parse is a warning, never a block — left as found', () => {
    recordChoice(true);
    createFile(fix.project, '.claude/settings.json', '{not json');
    const res = bootWith();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.session_hooks_installed, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /session hooks not installed: \.claude\/settings\.json is not valid JSON/);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), '{not json');
  });
});
