'use strict';

//
// Tests for tmux session labels: `session label` / `session label-config` /
// `session repair` / `session cleanup`, the config gate and project
// override, the machine-global stash, phase-hop and cross-project
// recomposition, user-rename adoption, id drift across a server restart
// (chain resolution, drifted restore, boot repair, orphan pruning), owner
// identity, restore ownership, and the SessionEnd stdin contract. tmux
// itself is a PATH stub modelling one session, backed by state files
// holding the session's name and id (a test renumbers the id to simulate a
// server restart that carried the name across); the engine only ever sees
// the stub.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

const TMUX_STUB = `#!/bin/bash
echo "$@" >> "$TMUX_STUB_LOG"
[ -n "$TMUX_STUB_FAIL" ] && exit 1
if [ "$1" = "-S" ]; then shift 2; fi
cmd="$1"; shift
name=$(cat "$TMUX_STUB_STATE")
id=$(cat "$TMUX_STUB_ID")
target=""; positional=""
while [ $# -gt 0 ]; do
  case "$1" in
    -t) target="$2"; shift 2 ;;
    -p|-F) shift ;;
    *) positional="$1"; shift ;;
  esac
done
case "$target" in
  '$'*) [ "$target" != "$id" ] && exit 1 ;;
esac
if [ "$cmd" = "display-message" ]; then
  if [ "$positional" = '#{session_id}|#{session_name}' ]; then
    echo "$id|$name"
  elif [ "$positional" = '#{session_name}' ]; then
    echo "$name"
  fi
elif [ "$cmd" = "list-sessions" ]; then
  [ -n "$TMUX_STUB_FAIL_LS" ] && exit 1
  echo "$id|$name"
elif [ "$cmd" = "rename-session" ]; then
  [ -n "$TMUX_STUB_FAIL_RENAME" ] && exit 1
  echo "$positional" > "$TMUX_STUB_STATE"
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
  fs.writeFileSync(path.join(stubDir, 'id'), '$7\n');
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
 * dir pinned, tmux identity present unless `noTmux`. The suite's own pid
 * plays the owning Claude process (`claudePid: null` withholds identity —
 * the pre-identity record shape).
 */
function engine(args, { noTmux = false, sessionId = 'sess-1', claudePid = process.pid, fail = false, failRename = false, failLs = false, expectFail = false, cwd = null, input = undefined } = {}) {
  const env = { ...process.env };
  delete env.TMUX;
  delete env.TMUX_PANE;
  delete env.TMUX_STUB_FAIL;
  delete env.TMUX_STUB_FAIL_RENAME;
  delete env.TMUX_STUB_FAIL_LS;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.CLAUDE_PID;
  env.PATH = `${stubDir}:${env.PATH}`;
  env.TMUX_STUB_STATE = path.join(stubDir, 'state');
  env.TMUX_STUB_ID = path.join(stubDir, 'id');
  env.TMUX_STUB_LOG = path.join(stubDir, 'log');
  env.WORKFLOWS_CONFIG_DIR = configDir;
  if (!noTmux) {
    env.TMUX = '/fake/sock,123,7';
    env.TMUX_PANE = '%3';
  }
  if (sessionId) env.CLAUDE_CODE_SESSION_ID = sessionId;
  if (claudePid) env.CLAUDE_PID = String(claudePid);
  if (fail) env.TMUX_STUB_FAIL = '1';
  if (failRename) env.TMUX_STUB_FAIL_RENAME = '1';
  if (failLs) env.TMUX_STUB_FAIL_LS = '1';
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

/** Simulate a tmux server restart: the session keeps its name, renumbered. */
function setTmuxId(id) {
  fs.writeFileSync(path.join(stubDir, 'id'), `${id}\n`);
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

/** Every stash record, sorted by filename. */
function stashRecords() {
  try {
    return fs.readdirSync(stashStore()).filter((f) => f.endsWith('.json')).sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(stashStore(), f), 'utf8')));
  } catch { return []; }
}

/** Hand-write a stash record — the shapes a past engine left behind. */
function writeStash(basename, record) {
  fs.mkdirSync(stashStore(), { recursive: true });
  fs.writeFileSync(path.join(stashStore(), `${basename}.json`), JSON.stringify({ socket: '/fake/sock', ...record }) + '\n');
}

/** The suite process's kernel start time — a live owner identity for hand-written records. */
function ownStartTime() {
  return execFileSync('ps', ['-p', String(process.pid), '-o', 'lstart='], { encoding: 'utf8' }).trim();
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
    assert.strictEqual(stash.pid, process.pid, 'owner identity recorded from CLAUDE_PID');
    assert.strictEqual(stash.pid_start, ownStartTime());
  });

  it('records a pid-less stash when no CLAUDE_PID reaches the call', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { claudePid: null });
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.pid, null);
    assert.strictEqual(stash.pid_start, null);
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

  it('recomposes across a server restart — renumbered id, label carried in the name', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxId('$9'); // restart: the stash key no longer matches, the labelled name survived
    const res = engine(['session', 'label', 'pay', 'specification', 'alpha'], { sessionId: 'sess-2' });
    assert.strictEqual(res.name, 'proj-abc · pay · specification · alpha');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · specification · alpha');
    const records = stashRecords();
    assert.strictEqual(records.length, 1, 'the drifted record is consumed, not left to compound');
    assert.strictEqual(records[0].tmux_id, '$9');
    assert.strictEqual(records[0].original, 'proj-abc');
  });

  it('chains through a polluted record to the true original', () => {
    // The legacy stranding: a pre-chain engine adopted a stranded label as
    // the original, so the current record's `original` is itself a label —
    // whose own record still holds the true name.
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-older' });
    fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc · pay · discussion · alpha · pay · research · beta\n');
    setTmuxId('$9');
    const res = engine(['session', 'label', 'pay', 'planning', 'alpha']);
    assert.strictEqual(res.name, 'proj-abc · pay · planning · alpha');
    const records = stashRecords();
    assert.strictEqual(records.length, 1, 'both chain links consumed');
    assert.strictEqual(records[0].original, 'proj-abc');
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

  it('leaves another session\'s stash alone while its owner still runs', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-other']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('sweeps another session\'s stash once its owner is dead', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const file = /** @type {string} */ (stashFile());
    const stash = JSON.parse(fs.readFileSync(file, 'utf8'));
    stash.pid_start = 'a start time no live process carries';
    fs.writeFileSync(file, JSON.stringify(stash) + '\n');
    const res = engine(['session', 'cleanup', 'sess-other']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores across a server restart — the label found by name under a renumbered id', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxId('$9');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores a polluted stash to the chain-resolved true original', () => {
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-1' });
    fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc · pay · discussion · alpha · pay · research · beta\n');
    setTmuxId('$9');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc', 'never the polluted intermediate');
    assert.strictEqual(stashFile(), null, 'both links consumed');
  });

  it('keeps a link a live session\'s name still chains through', () => {
    optIn();
    // sess-2 wears the compounded name and still runs; sess-1's link record
    // holds the only path to the true original — its sweep must not drop it.
    writeStash('link-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-1' });
    writeStash('head-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-2', pid: process.pid, pid_start: ownStartTime() });
    fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc · pay · discussion · alpha · pay · research · beta\n');
    setTmuxId('$9');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(stashRecords().length, 2, 'the link survives for sess-2\'s recomposition');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha · pay · research · beta');
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

describe('engine session repair', () => {
  beforeEach(setup);
  afterEach(teardown);

  /** A stranded label on the current terminal: dead owner, name still worn. */
  function strand() {
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc · pay · discussion · alpha\n');
  }

  it('no-ops as disabled — a stranded label included', () => {
    strand();
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'nothing pruned either');
  });

  it('no-ops outside tmux', () => {
    optIn();
    strand();
    const res = engine(['session', 'repair'], { noTmux: true });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
  });

  it('restores a stranded label\'s true original and consumes the record', () => {
    optIn();
    strand();
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('repairs a multi-hop compounded name through the chain', () => {
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-older' });
    fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc · pay · discussion · alpha · pay · research · beta\n');
    setTmuxId('$9');
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null, 'both links consumed');
  });

  it('leaves a label whose owning process still runs', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'repair'], { sessionId: 'sess-2' });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('prunes a dead-owner orphan no live name needs, and keeps a needed link', () => {
    optIn();
    // The orphan: a label for a session this server no longer has, worn by
    // nothing. The link: dead-owner too, but the live compounded name still
    // chains through it (its head record's owner runs — repair defers).
    writeStash('orphan', { tmux_id: '$4', original: 'gone-proj', applied: 'gone-proj · shop · planning', session_id: 'sess-gone' });
    writeStash('link-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('head-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-2', pid: process.pid, pid_start: ownStartTime() });
    fs.writeFileSync(path.join(stubDir, 'state'), 'proj-abc · pay · discussion · alpha · pay · research · beta\n');
    setTmuxId('$9');
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    const records = stashRecords();
    assert.strictEqual(records.length, 2, 'orphan pruned, live head and its link kept');
    assert.ok(records.every((r) => r.original !== 'gone-proj'));
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha · pay · research · beta');
  });

  it('keeps a dead-owner record when the server cannot be listed', () => {
    optIn();
    writeStash('orphan', { tmux_id: '$4', original: 'gone-proj', applied: 'gone-proj · shop · planning', session_id: 'sess-gone' });
    const res = engine(['session', 'repair'], { failLs: true });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.ok(stashFile(), 'an unverifiable name proves nothing — nothing pruned');
  });

  it('no-ops on any tmux error', () => {
    optIn();
    strand();
    const res = engine(['session', 'repair'], { fail: true });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.ok(stashFile(), 'the record keeps the repair available');
  });
});
