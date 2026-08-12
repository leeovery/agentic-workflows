'use strict';

//
// Tests for tmux session labels: `session label` / `session label-config`,
// the config gate, the per-tmux-session stash, phase-hop recomposition,
// user-rename adoption, and the restore leg riding `presence cleanup`.
// tmux itself is a PATH stub backed by a state file holding the session
// name; the engine only ever sees the stub.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

const TMUX_STUB = `#!/bin/bash
echo "$@" >> "$TMUX_STUB_LOG"
[ -n "$TMUX_STUB_FAIL" ] && exit 1
if [ "$1" = "-S" ]; then shift 2; fi
cmd="$1"; shift
name=$(cat "$TMUX_STUB_STATE")
if [ "$cmd" = "display-message" ]; then
  for a in "$@"; do fmt="$a"; done
  if [ "$fmt" = '#{session_id}|#{session_name}' ]; then
    echo "\\$7|$name"
  elif [ "$fmt" = '#{session_name}' ]; then
    echo "$name"
  fi
elif [ "$cmd" = "rename-session" ]; then
  shift 2
  echo "$1" > "$TMUX_STUB_STATE"
fi
exit 0
`;

let dir; // temp project root
let stubDir; // holds the tmux stub + state/log files
let configDir; // WORKFLOWS_CONFIG_DIR

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-label-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'pay'), { recursive: true });
  stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmux-stub-'));
  fs.writeFileSync(path.join(stubDir, 'tmux'), TMUX_STUB, { mode: 0o755 });
  fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc\n');
  fs.writeFileSync(path.join(stubDir, 'log'), '');
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-config-'));
}

function teardown() {
  for (const d of [dir, stubDir, configDir]) {
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/**
 * Run the engine with a controlled environment: tmux stub on PATH, config
 * dir pinned, tmux identity present unless `noTmux`.
 */
function engine(args, { noTmux = false, sessionId = 'sess-1', fail = false, expectFail = false } = {}) {
  const env = { ...process.env };
  delete env.TMUX;
  delete env.TMUX_PANE;
  delete env.TMUX_STUB_FAIL;
  delete env.CLAUDE_CODE_SESSION_ID;
  env.PATH = `${stubDir}:${env.PATH}`;
  env.TMUX_STUB_STATE = path.join(stubDir, 'state');
  env.TMUX_STUB_LOG = path.join(stubDir, 'log');
  env.WORKFLOWS_CONFIG_DIR = configDir;
  if (!noTmux) {
    env.TMUX = '/fake/sock,123,7';
    env.TMUX_PANE = '%3';
  }
  if (sessionId) env.CLAUDE_CODE_SESSION_ID = sessionId;
  if (fail) env.TMUX_STUB_FAIL = '1';
  const r = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8', env });
  if (expectFail) {
    assert.strictEqual(r.status, 1, r.stdout + r.stderr);
    return JSON.parse(r.stderr.trim());
  }
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n')[0]);
}

function tmuxName() {
  return fs.readFileSync(path.join(stubDir, 'state'), 'utf8').trim();
}

function stashFile() {
  return path.join(dir, '.workflows', '.cache', '.session-label', '7.json');
}

function optIn() {
  engine(['session', 'label-config', 'true']);
}

describe('engine session label', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('no-ops as disabled when the opt-in was never recorded', () => {
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('no-ops as disabled when the opt-in is false', () => {
    engine(['session', 'label-config', 'false']);
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });

  it('no-ops outside tmux even when opted in', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { noTmux: true });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'no-tmux' });
  });

  it('reports tmux-error without failing when tmux itself errors', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { fail: true });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'tmux-error' });
  });

  it('renames the tmux session and stashes the original', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
    assert.strictEqual(res.name, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    const stash = JSON.parse(fs.readFileSync(stashFile(), 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
    assert.strictEqual(stash.applied, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(stash.session_id, 'sess-1');
    assert.strictEqual(stash.tmux_id, '$7');
  });

  it('collapses the topic when it equals the work unit', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'scoping', 'pay']);
    assert.strictEqual(res.name, 'proj-abc · pay · scoping');
  });

  it('recomposes from the stashed original on a phase hop', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'label', 'pay', 'specification', 'alpha']);
    assert.strictEqual(res.name, 'proj-abc · pay · specification · alpha');
    const stash = JSON.parse(fs.readFileSync(stashFile(), 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
  });

  it('adopts a user rename as the new original', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    fs.writeFileSync(path.join(stubDir, 'state'), 'my-new-name\n');
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.name, 'my-new-name · pay · discussion · alpha');
  });

  it('rejects an unknown phase', () => {
    optIn();
    const err = engine(['session', 'label', 'pay', 'deploying', 'alpha'], { expectFail: true });
    assert.match(err.error, /unknown phase/);
  });

  it('rejects a missing work unit', () => {
    optIn();
    const err = engine(['session', 'label', 'ghost', 'discussion', 'alpha'], { expectFail: true });
    assert.match(err.error, /no work unit directory/);
  });

  it('label-config writes the session key and preserves siblings', () => {
    const p = path.join(configDir, 'config.json');
    fs.writeFileSync(p, JSON.stringify({ knowledge: { provider: 'stub' } }) + '\n');
    const res = engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: true });
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepStrictEqual(parsed, { knowledge: { provider: 'stub' }, session: { tmux_labels: true } });
    engine(['session', 'label-config', 'false']);
    assert.strictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).session.tmux_labels, false);
  });
});

describe('engine presence cleanup — label restore', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('restores the original name and drops the stash for the owning session', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['presence', 'cleanup', 'sess-1']);
    assert.strictEqual(res.label_restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(!fs.existsSync(stashFile()));
  });

  it('leaves another session\'s stash alone', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['presence', 'cleanup', 'sess-other']);
    assert.strictEqual(res.label_restored, false);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(fs.existsSync(stashFile()));
  });

  it('never clobbers a manual rename — stash dropped, name kept', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    fs.writeFileSync(path.join(stubDir, 'state'), 'renamed-by-hand\n');
    const res = engine(['presence', 'cleanup', 'sess-1']);
    assert.strictEqual(res.label_restored, false);
    assert.strictEqual(tmuxName(), 'renamed-by-hand');
    assert.ok(!fs.existsSync(stashFile()));
  });

  it('survives the tmux session being gone', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['presence', 'cleanup', 'sess-1'], { fail: true });
    assert.strictEqual(res.label_restored, false);
    assert.ok(!fs.existsSync(stashFile()));
  });
});
