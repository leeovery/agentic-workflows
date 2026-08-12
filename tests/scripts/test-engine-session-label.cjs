'use strict';

//
// Tests for tmux session labels: `session label` / `session label-config` /
// `session cleanup`, the config gate and project override, the
// machine-global stash, phase-hop and cross-project recomposition,
// user-rename adoption, restore ownership, and the SessionEnd stdin
// contract. tmux itself is a PATH stub backed by a state file holding the
// session name; the engine only ever sees the stub.
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
  [ -n "$TMUX_STUB_FAIL_RENAME" ] && exit 1
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
function engine(args, { noTmux = false, sessionId = 'sess-1', fail = false, failRename = false, expectFail = false, cwd = null, input = undefined } = {}) {
  const env = { ...process.env };
  delete env.TMUX;
  delete env.TMUX_PANE;
  delete env.TMUX_STUB_FAIL;
  delete env.TMUX_STUB_FAIL_RENAME;
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
  if (failRename) env.TMUX_STUB_FAIL_RENAME = '1';
  const r = spawnSync('node', [ENGINE, ...args], { cwd: cwd || dir, encoding: 'utf8', env, input });
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

function stashStore() {
  return path.join(configDir, 'state', 'session-labels');
}

/** The single stash file, or null when the store is empty/absent. */
function stashFile() {
  try {
    const files = fs.readdirSync(stashStore()).filter((f) => f.endsWith('.json'));
    return files.length ? path.join(stashStore(), files[0]) : null;
  } catch { return null; }
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

  it('renames the tmux session and stashes the original machine-globally', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
    assert.strictEqual(res.name, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    const file = stashFile();
    assert.ok(file, 'stash written under the config dir state store');
    const stash = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
    assert.strictEqual(stash.applied, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(stash.session_id, 'sess-1');
    assert.strictEqual(stash.tmux_id, '$7');
    assert.strictEqual(stash.socket, '/fake/sock');
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
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
  });

  it('recomposes from the stashed original across projects — one tmux session, two repos', () => {
    optIn();
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-label-b-'));
    fs.mkdirSync(path.join(dirB, '.workflows', 'shop'), { recursive: true });
    try {
      engine(['session', 'label', 'pay', 'discussion', 'alpha']);
      const res = engine(['session', 'label', 'shop', 'planning', 'shop'], { cwd: dirB, sessionId: 'sess-2' });
      assert.strictEqual(res.name, 'proj-abc · shop · planning');
      assert.strictEqual(tmuxName(), 'proj-abc · shop · planning');
      const cleanup = engine(['session', 'cleanup', 'sess-2']);
      assert.strictEqual(cleanup.restored, true);
      assert.strictEqual(tmuxName(), 'proj-abc');
    } finally {
      fs.rmSync(dirB, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('adopts a user rename as the new original', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    fs.writeFileSync(path.join(stubDir, 'state'), 'my-new-name\n');
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.name, 'my-new-name · pay · discussion · alpha');
  });

  it('a rename failure leaves an inert stash — the next label does not compound', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { failRename: true });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'tmux-error' });
    assert.strictEqual(tmuxName(), 'proj-abc');
    const retry = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(retry.name, 'proj-abc · pay · discussion · alpha');
  });

  it('reports stash-error and leaves the name alone when the stash cannot be written', () => {
    optIn();
    fs.writeFileSync(path.join(configDir, 'state'), ''); // a file where the state dir must go
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'stash-error' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('the enable check precedes argument validation — a bad call site stays silent for a non-opted user', () => {
    const res = engine(['session', 'label', 'ghost', 'deploying', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });

  it('rejects an unknown phase when enabled', () => {
    optIn();
    const err = engine(['session', 'label', 'pay', 'deploying', 'alpha'], { expectFail: true });
    assert.match(err.error, /unknown phase/);
  });

  it('rejects a missing work unit when enabled', () => {
    optIn();
    const err = engine(['session', 'label', 'ghost', 'discussion', 'alpha'], { expectFail: true });
    assert.match(err.error, /no work unit directory/);
  });
});

describe('engine session label — project override', () => {
  beforeEach(setup);
  afterEach(teardown);

  function writeProjectManifest(defaults) {
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify({ defaults }, null, 2) + '\n');
  }

  it('project false beats the system opt-in', () => {
    optIn();
    writeProjectManifest({ tmux_labels: false });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('project true enables without a system opt-in', () => {
    writeProjectManifest({ tmux_labels: true });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
  });
});

describe('engine session label-config', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('writes the session key and preserves siblings', () => {
    const p = path.join(configDir, 'config.json');
    fs.writeFileSync(p, JSON.stringify({ knowledge: { provider: 'stub' } }) + '\n');
    const res = engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: true });
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepStrictEqual(parsed, { knowledge: { provider: 'stub' }, session: { tmux_labels: true } });
    engine(['session', 'label-config', 'false']);
    assert.strictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).session.tmux_labels, false);
  });

  it('refuses to replace a config file that no longer parses', () => {
    const p = path.join(configDir, 'config.json');
    fs.writeFileSync(p, '{not json', 'utf8');
    const err = engine(['session', 'label-config', 'true'], { expectFail: true });
    assert.match(err.error, /not valid JSON/);
    assert.strictEqual(fs.readFileSync(p, 'utf8'), '{not json');
  });
});

describe('engine session cleanup', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('restores the original name and drops the stash for the owning session', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('touches nothing without a session id — argument, stdin JSON, or otherwise', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    for (const input of ['', '{}', 'not json']) {
      const res = engine(['session', 'cleanup'], { input });
      assert.deepStrictEqual(res, { ok: true, restored: false });
    }
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('reads the owning session id from the hook stdin JSON', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup'], { input: '{"session_id":"sess-1"}' });
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('leaves another session\'s stash alone', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-other']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('restores an ownerless stash for whichever session sweeps', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { sessionId: null });
    const res = engine(['session', 'cleanup', 'sess-any']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('never clobbers a manual rename — stash dropped, name kept', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    fs.writeFileSync(path.join(stubDir, 'state'), 'renamed-by-hand\n');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(tmuxName(), 'renamed-by-hand');
    assert.strictEqual(stashFile(), null);
  });

  it('keeps the stash when the restore rename fails, and restores on the next sweep', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { failRename: true });
    assert.strictEqual(res.restored, false);
    assert.ok(stashFile(), 'stash kept for the next sweep');
    const retry = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(retry.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('survives the tmux session being gone', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { fail: true });
    assert.strictEqual(res.restored, false);
    assert.strictEqual(stashFile(), null);
  });

  it('presence cleanup carries only presence fields and leaves the stash alone', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['presence', 'cleanup', 'sess-1']);
    assert.deepStrictEqual(res, { ok: true, session_id: 'sess-1', cleared: [] });
    assert.ok(stashFile());
  });
});
