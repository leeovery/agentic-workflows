'use strict';

//
// Tests for tmux session labels: `session label` / `session label-config` /
// `session repair` / `session cleanup` / `session resume`, the
// project-manifest opt-in and the hooks it syncs in the project's settings
// (SessionEnd: `session cleanup` while labels are on, `presence cleanup` and
// `conversation end` regardless; SessionStart: `session resume` while labels
// are on), the
// per-checkout stash, the arrival forms (a work unit alone, the roadmap and
// baseline identities), phase-hop recomposition, peer-checkout isolation,
// user-rename adoption, id drift across a server restart (chain resolution,
// drifted restore, boot repair, orphan pruning), owner identity, the
// repair's own-label restore, restore ownership, the position record a
// resume re-applies, and the hooks' stdin contract. tmux itself is the
// shared PATH stub (`tmux-stub.cjs`) modelling one session; the engine only
// ever sees the stub.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');
const { syncSessionHooks } = require('../../skills/workflow-engine/scripts/domain/session-label.cjs');
const { installTmuxStub, tmuxStubEnv, tmuxStubName, setTmuxStubName, setTmuxStubId } = require('./tmux-stub.cjs');
const harness = require('./engine-harness.cjs');

const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const SESSION_HOOK = { type: 'command', command: `${HOOK_ENGINE} session cleanup` };
const RESUME_HOOK = { type: 'command', command: `${HOOK_ENGINE} session resume` };
const PRESENCE_HOOK = { type: 'command', command: `${HOOK_ENGINE} presence cleanup` };
const END_HOOK = { type: 'command', command: `${HOOK_ENGINE} conversation end` };
// The settings a project reaches with labels on — one group per event, ours
// alone — and with them off.
const LABELS_ON = {
  hooks: {
    SessionEnd: [{ hooks: [SESSION_HOOK, PRESENCE_HOOK, END_HOOK] }],
    SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }],
  },
};
const LABELS_OFF = { hooks: { SessionEnd: [{ hooks: [PRESENCE_HOOK, END_HOOK] }] } };
// The SessionStart hook's stdin, as Claude Code writes it on `claude --resume`.
const RESUME_STDIN = (/** @type {string} */ id) => JSON.stringify({ session_id: id, hook_event_name: 'SessionStart', source: 'resume' });

let dir; // temp project root — a git repo, since recording the opt-in commits
let stubDir; // holds the tmux stub + state/log files

/** @param {string[]} args */
function git(args) {
  return harness.git(dir, args);
}

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-label-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'pay'), { recursive: true });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['commit', '-q', '--allow-empty', '-m', 'init']);
  stubDir = installTmuxStub();
}

function teardown() {
  for (const d of [dir, stubDir]) {
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/**
 * Run the engine with a controlled environment: tmux stub on PATH, tmux
 * identity present unless `noTmux`. The suite's own pid plays the owning
 * Claude process (`claudePid: null` withholds identity — the record shape
 * a call with no CLAUDE_PID writes). `response: 'stderr'` reads the answer
 * from stderr and holds stdout empty — the SessionStart hook's channel.
 */
function engine(args, { noTmux = false, sessionId = 'sess-1', claudePid = process.pid, fail = false, failRename = false, failLs = false, expectFail = false, cwd = null, projectDir = null, input = undefined, extraEnv = {}, response = 'stdout' } = {}) {
  // An overlay, where `undefined` takes a key away: what the engine sees is
  // the identity this call declares and nothing the host environment carries.
  const env = {
    ...extraEnv,
    TMUX: noTmux ? undefined : '/fake/sock,123,7',
    TMUX_PANE: noTmux ? undefined : '%3',
    TMUX_STUB_FAIL: fail ? '1' : undefined,
    TMUX_STUB_FAIL_RENAME: failRename ? '1' : undefined,
    TMUX_STUB_FAIL_LS: failLs ? '1' : undefined,
    CLAUDE_CODE_SESSION_ID: sessionId || undefined,
    CLAUDE_PID: claudePid ? String(claudePid) : undefined,
    CLAUDE_PROJECT_DIR: projectDir || undefined,
    ...tmuxStubEnv(stubDir, extraEnv.PATH || process.env.PATH),
  };
  if (expectFail) return harness.refuses(cwd || dir, args, { env, stdin: input });
  const r = harness.call(cwd || dir, args, { env, stdin: input });
  assert.strictEqual(r.code, 0, r.stderr);
  if (response === 'stderr') {
    assert.strictEqual(r.stdout, '', 'a SessionStart hook target prints nothing on stdout — it would become conversation context');
    return JSON.parse(r.stderr.trim());
  }
  return JSON.parse(r.stdout.trim().split('\n')[0]);
}

/** `session resume …` — the SessionStart hook's target, answering on stderr. */
function resume(args, opts = {}) {
  return engine(['session', 'resume', ...args], { ...opts, response: 'stderr' });
}

function tmuxName() {
  return tmuxStubName(stubDir);
}

/** The number of renames the stub has been asked for. */
function renameCount() {
  return fs.readFileSync(path.join(stubDir, 'log'), 'utf8').split('\n').filter((l) => l.includes('rename-session')).length;
}

/** A rename made outside the engine — the user's own. */
function setTmuxName(name) {
  setTmuxStubName(stubDir, name);
}

/** Simulate a tmux server restart: the session keeps its name, renumbered. */
function setTmuxId(id) {
  setTmuxStubId(stubDir, id);
}

function stashStore() {
  return path.join(dir, '.workflows', '.cache', '.session-labels');
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

/** Hand-write a stash record — the shapes the sweeps must handle. */
function writeStash(basename, record) {
  fs.mkdirSync(stashStore(), { recursive: true });
  fs.writeFileSync(path.join(stashStore(), `${basename}.json`), JSON.stringify({ socket: '/fake/sock', ...record }) + '\n');
}

/** Where every conversation keeps its folder. */
function conversationsRoot() {
  return path.join(dir, '.workflows', '.cache', '.conversations');
}

/** A conversation's folder, where its position is kept. */
function conversation(sessionId) {
  return path.join(conversationsRoot(), sessionId);
}

/** The position recorded for a session, or null when none is. */
function position(sessionId) {
  try { return JSON.parse(fs.readFileSync(path.join(conversation(sessionId), 'position.json'), 'utf8')); } catch { return null; }
}

/** Hand-write a position — the shapes the resume must handle. */
function writePosition(sessionId, record) {
  fs.mkdirSync(conversation(sessionId), { recursive: true });
  fs.writeFileSync(path.join(conversation(sessionId), 'position.json'), JSON.stringify(record) + '\n');
}

/** The suite process's kernel start time — a live owner identity for hand-written records. */
function ownStartTime() {
  return processStartTime(process.pid);
}

/** A live peer's identity — the suite's parent process, alive for the whole run and never the caller's own. */
function peerIdentity() {
  return { pid: process.ppid, pid_start: processStartTime(process.ppid) };
}

function optIn() {
  engine(['session', 'label-config', 'true']);
}

function projectManifest() {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'));
}

function settingsPath() {
  return path.join(dir, '.claude', 'settings.json');
}

function settings() {
  return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
}

function writeSettings(content) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

/** HEAD's subject and the sorted paths it touched. */
function head() {
  return {
    subject: git(['log', '-1', '--pretty=%s']).trim(),
    files: git(['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
  };
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

  it('renames the tmux session and stashes the original in the checkout\'s cache', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
    assert.strictEqual(res.name, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    const file = stashFile();
    assert.ok(file, 'stash written under .workflows/.cache/.session-labels');
    assert.strictEqual(git(['status', '--porcelain', '--', '.workflows/manifest.json', '.claude']).trim(), '',
      'the label writes the cache alone — the opt-in and its hook were committed at the choice');
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

  it('labels the place alone on arrival — a work unit with no phase', () => {
    optIn();
    const res = engine(['session', 'label', 'pay']);
    assert.strictEqual(res.name, 'proj-abc · pay');
    assert.strictEqual(tmuxName(), 'proj-abc · pay');
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
    assert.strictEqual(stash.applied, 'proj-abc · pay');
  });

  it('labels the roadmap and the baseline by identity — project-level places with no directory', () => {
    optIn();
    for (const place of ['roadmap', 'baseline']) {
      assert.ok(!fs.existsSync(path.join(dir, '.workflows', place)), `${place} has no work-unit directory`);
      const res = engine(['session', 'label', place]);
      assert.strictEqual(res.name, `proj-abc · ${place}`);
      assert.strictEqual(tmuxName(), `proj-abc · ${place}`);
    }
  });

  it('a phase label after an arrival, and an arrival after a phase, both recompose from the true original', () => {
    optIn();
    engine(['session', 'label', 'pay']);
    const phase = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(phase.name, 'proj-abc · pay · discussion · alpha');
    const back = engine(['session', 'label', 'pay']);
    assert.strictEqual(back.name, 'proj-abc · pay');
    assert.strictEqual(tmuxName(), 'proj-abc · pay');
    const records = stashRecords();
    assert.strictEqual(records.length, 1, 'one record per terminal, whatever the hops');
    assert.strictEqual(records[0].original, 'proj-abc');
  });

  it('a peer checkout\'s cleanup and repair never touch this checkout\'s records', () => {
    optIn();
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-label-b-'));
    fs.mkdirSync(path.join(dirB, '.workflows', 'shop'), { recursive: true });
    try {
      engine(['session', 'label', 'pay', 'discussion', 'alpha']);
      const file = /** @type {string} */ (stashFile());
      const record = fs.readFileSync(file, 'utf8');
      const foreign = engine(['session', 'cleanup', 'sess-other'], { cwd: dirB });
      assert.strictEqual(foreign.restored, false);
      assert.strictEqual(fs.readFileSync(file, 'utf8'), record);
      // The sweep that takes a dead-owner record at home finds nothing here.
      const stash = JSON.parse(record);
      stash.pid_start = 'a start time no live process carries';
      const dead = JSON.stringify(stash) + '\n';
      fs.writeFileSync(file, dead);
      const swept = engine(['session', 'cleanup', 'sess-other'], { cwd: dirB });
      assert.strictEqual(swept.restored, false);
      const repair = engine(['session', 'repair'], { cwd: dirB });
      assert.deepStrictEqual(repair, { ok: true, repaired: false });
      assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
      assert.strictEqual(fs.readFileSync(file, 'utf8'), dead, 'this checkout\'s record is intact');
      assert.ok(!fs.existsSync(path.join(dirB, '.workflows', '.cache', '.session-labels')), 'the peer gains no records');
      const home = engine(['session', 'cleanup', 'sess-other']);
      assert.strictEqual(home.restored, true, 'the record still does its job at home');
      assert.strictEqual(tmuxName(), 'proj-abc');
    } finally {
      fs.rmSync(dirB, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('adopts a user rename as the new original', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxName('my-new-name');
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
    // A polluted chain: a stranded label was adopted as the original by a
    // label that found no record for it, so the current record's `original`
    // is itself a label — whose own record still holds the true name.
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-older' });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · research · beta');
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
    fs.rmSync(path.join(dir, '.workflows', '.cache'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.cache'), ''); // a file where the cache dir must go
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

  it('rejects a phase without its topic — one argument or three, never two', () => {
    optIn();
    const err = engine(['session', 'label', 'pay', 'discussion'], { expectFail: true });
    assert.match(err.error, /Usage: engine session label <name> \[<phase> <topic>\]/);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('rejects an unknown name-only when enabled, and a project identity carrying a phase', () => {
    optIn();
    assert.match(engine(['session', 'label', 'ghost'], { expectFail: true }).error, /no work unit directory/);
    assert.match(engine(['session', 'label', 'roadmap', 'discovery', 'roadmap'], { expectFail: true }).error, /no work unit directory/);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });
});

describe('engine session label — the position record', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the calling session\'s position behind a landed label, in its conversation\'s folder', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
  });

  it('a name-only label records the name alone', () => {
    optIn();
    engine(['session', 'label', 'roadmap']);
    assert.deepStrictEqual(position('sess-1'), { name: 'roadmap' });
  });

  it('a re-label rewrites the one file — the latest position, never a history', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    engine(['session', 'label', 'pay', 'specification', 'alpha']);
    assert.strictEqual(position('sess-1').phase, 'specification');
    assert.deepStrictEqual(fs.readdirSync(conversation('sess-1')).sort(), ['position.json', 'workflow']);
  });

  it('a no-op label records nothing — disabled, outside tmux, a tmux error, a failed rename', () => {
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { noTmux: true });
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { fail: true });
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { failRename: true });
    assert.strictEqual(position('sess-1'), null, 'no position without a landed label');
  });

  it('a failed stash records nothing either', () => {
    optIn();
    fs.rmSync(path.join(dir, '.workflows', '.cache'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.cache'), '');
    assert.deepStrictEqual(engine(['session', 'label', 'pay', 'discussion', 'alpha']), { ok: true, labelled: false, reason: 'stash-error' });
    assert.strictEqual(position('sess-1'), null);
  });

  it('a position that cannot be written never fails the landed label — a courtesy, never a failure', () => {
    optIn();
    fs.mkdirSync(path.join(conversation('sess-1'), 'position.json'), { recursive: true }); // a directory where the position must go
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'the stash landed');
  });

  it('a hook-supplied session id never escapes the store — the folder is named by its safe characters alone', () => {
    optIn();
    engine(['session', 'label', 'pay'], { sessionId: 'a/../../evil' });
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()).sort(), ['aevil', 'sess-1'], 'beside the opt-in\'s own');
    assert.deepStrictEqual(position('aevil'), { name: 'pay' });
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', '.cache', 'evil')));
  });

  it('a landed label with no session id records nothing — there is no id to resume under', () => {
    optIn();
    assert.strictEqual(engine(['session', 'label', 'pay'], { sessionId: null }).labelled, true);
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['sess-1'], 'the opt-in\'s own, and nothing more');
    assert.strictEqual(position('sess-1'), null);
  });
});

describe('engine session label — the manifest stamp', () => {
  beforeEach(setup);
  afterEach(teardown);

  function writeProjectManifest(defaults) {
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify({ defaults }, null, 2) + '\n');
  }

  it('a manifest stamped false — the prose-test world — is disabled, whatever was recorded before', () => {
    optIn();
    writeProjectManifest({ tmux_labels: false });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('a manifest stamped true enables without label-config having run', () => {
    writeProjectManifest({ tmux_labels: true });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
  });

  it('only a boolean counts — anything else reads as never asked', () => {
    writeProjectManifest({ tmux_labels: 'true' });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });

  it('a manifest that does not parse, or whose root or defaults is no object, reads as never asked — never a throw', () => {
    for (const content of ['{not json', '[]', 'null', JSON.stringify({ defaults: [true] })]) {
      fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), content);
      const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
      assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' }, content);
    }
  });

  it('the opt-in is the manifest alone — a system config carrying one is never read', () => {
    const configDir = path.join(dir, '.wf-config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ session: { tmux_labels: true } }) + '\n');
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { extraEnv: { WORKFLOWS_CONFIG_DIR: configDir } });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });
});

describe('engine session label-config', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the opt-in on the project manifest, installs the session hooks, and commits both files confined', () => {
    fs.writeFileSync(path.join(dir, 'peer-dirt.txt'), 'a peer session\'s file\n');
    const res = engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: true });
    assert.deepStrictEqual(projectManifest(), { defaults: { tmux_labels: true } }, 'a missing manifest is created around the choice');
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.deepStrictEqual(head(), {
      subject: 'chore: record session-label choice',
      files: ['.claude/settings.json', '.workflows/manifest.json'],
    });
    assert.match(git(['status', '--porcelain']), /\?\? peer-dirt\.txt/, 'the commit takes its own two paths and nothing else');
  });

  it('preserves every other manifest key and every other default', () => {
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'),
      JSON.stringify({ work_units: { pay: { work_type: 'feature' } }, defaults: { plan_format: 'tick' } }, null, 2) + '\n');
    engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(projectManifest(), {
      work_units: { pay: { work_type: 'feature' } },
      defaults: { plan_format: 'tick', tmux_labels: true },
    });
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8').slice(-2), '}\n', 'the manifest\'s own formatting');
  });

  it('opting out records false, takes `session cleanup` out, leaves the workflows\' own hooks standing, and commits both', () => {
    engine(['session', 'label-config', 'true']);
    const res = engine(['session', 'label-config', 'false']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: false });
    assert.strictEqual(projectManifest().defaults.tmux_labels, false);
    assert.deepStrictEqual(settings(), LABELS_OFF, 'the workflows\' own hooks are no label preference');
    assert.deepStrictEqual(head(), {
      subject: 'chore: record session-label choice',
      files: ['.claude/settings.json', '.workflows/manifest.json'],
    });
  });

  it('declining on a project the hooks never reached still installs the workflows\' own hooks', () => {
    const res = engine(['session', 'label-config', 'false']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: false });
    assert.deepStrictEqual(settings(), LABELS_OFF);
    assert.deepStrictEqual(head().files, ['.claude/settings.json', '.workflows/manifest.json']);
  });

  it('re-recording the same choice is idempotent — no twin hook, nothing to commit', () => {
    engine(['session', 'label-config', 'true']);
    const before = git(['rev-parse', 'HEAD']);
    engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.strictEqual(git(['rev-parse', 'HEAD']), before);
  });

  it('refuses to replace a project manifest that no longer parses', () => {
    const p = path.join(dir, '.workflows', 'manifest.json');
    fs.writeFileSync(p, '{not json', 'utf8');
    const err = engine(['session', 'label-config', 'true'], { expectFail: true });
    assert.match(err.error, /not valid JSON/);
    assert.strictEqual(fs.readFileSync(p, 'utf8'), '{not json');
    assert.ok(!fs.existsSync(settingsPath()), 'no hook lands for a choice that was not recorded');
  });

  it('a settings file that does not parse is left alone — the choice is recorded and the hooks reported', () => {
    writeSettings('{not json');
    const res = engine(['session', 'label-config', 'true']);
    assert.strictEqual(res.tmux_labels, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /session hooks not synced: \.claude\/settings\.json is not valid JSON/);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '{not json');
    assert.deepStrictEqual(head(), { subject: 'chore: record session-label choice', files: ['.workflows/manifest.json'] });
  });

  it('a commit git refuses is a warning, never a failure — the choice and the hooks are on disk', () => {
    const hooksDir = path.join(dir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const res = engine(['session', 'label-config', 'true']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.tmux_labels, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^commit failed: /);
    assert.deepStrictEqual(projectManifest(), { defaults: { tmux_labels: true } });
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.strictEqual(git(['log', '-1', '--pretty=%s']).trim(), 'init', 'nothing landed');
    assert.match(git(['status', '--porcelain']), /\.workflows\/manifest\.json/, 'the state waits, uncommitted');
  });

  it('WORKFLOWS_HOLD_PROJECT_SETTINGS=1 — the test harness\'s switch — records the choice and leaves the settings file alone', () => {
    const res = engine(['session', 'label-config', 'true'], { extraEnv: { WORKFLOWS_HOLD_PROJECT_SETTINGS: '1' } });
    assert.deepStrictEqual(res, { ok: true, tmux_labels: true });
    assert.deepStrictEqual(projectManifest(), { defaults: { tmux_labels: true } });
    assert.ok(!fs.existsSync(settingsPath()), 'no settings write under the switch');
    assert.deepStrictEqual(head(), { subject: 'chore: record session-label choice', files: ['.workflows/manifest.json'] });
  });
});

describe('syncSessionHooks', () => {
  beforeEach(setup);
  afterEach(teardown);

  const BOTH = { session: true, workflows: true };
  const WORKFLOWS = { session: false, workflows: true };
  const NONE = { session: false, workflows: false };

  it('installs the labels-on set into an absent settings file — one group per event, the SessionStart group matched to resume', () => {
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.ok(fs.readFileSync(settingsPath(), 'utf8').endsWith('}\n'));
  });

  it('installs the workflows\' own alone while labels are off — no SessionStart event at all', () => {
    assert.deepStrictEqual(syncSessionHooks(dir, WORKFLOWS), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_OFF);
  });

  it('installs beside everything already there — permissions, other events, foreign groups and their matchers on both events', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ matcher: 'clear', hooks: [theirs] }],
        SessionStart: [{ matcher: 'startup', hooks: [theirs] }],
      },
      showClearContextOnPlanAccept: true,
    });
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ matcher: 'clear', hooks: [theirs] }, { hooks: [SESSION_HOOK, PRESENCE_HOOK, END_HOOK] }],
        SessionStart: [{ matcher: 'startup', hooks: [theirs] }, { matcher: 'resume', hooks: [RESUME_HOOK] }],
      },
      showClearContextOnPlanAccept: true,
    });
  });

  it('a second sync changes nothing — the hooks are recognised by their command, whatever surrounds them', () => {
    syncSessionHooks(dir, BOTH);
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: false });
    assert.strictEqual(settings().hooks.SessionEnd.length, 1);
    assert.strictEqual(settings().hooks.SessionStart.length, 1);
    // Hand-adjusted copies — a different path prefix, a timeout, ours split
    // across groups, a foreign group added after ours, a widened matcher —
    // still make up the wanted set, so nothing is rewritten and nothing
    // moves.
    writeSettings({
      hooks: {
        SessionEnd: [
          { hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" session cleanup', timeout: 5 }] },
          { hooks: [END_HOOK, PRESENCE_HOOK] },
          { matcher: 'clear', hooks: [{ type: 'command', command: 'say goodbye' }] },
        ],
        SessionStart: [
          { matcher: 'startup|resume', hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" session resume' }] },
        ],
      },
    });
    const text = fs.readFileSync(settingsPath(), 'utf8');
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: false });
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), text, 'no reorder, no rewrite');
  });

  it('the mark is the exact `engine.cjs" <verb>` form — a re-quoted command is not recognised', () => {
    writeSettings({ hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: "node '$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs' presence cleanup" }] }] } });
    assert.deepStrictEqual(syncSessionHooks(dir, WORKFLOWS), { changed: true });
    assert.strictEqual(settings().hooks.SessionEnd.length, 2, 'the re-quoted copy reads as foreign and ours lands beside it');
  });

  it('turning labels off takes `session cleanup` and `session resume` out — the emptied SessionStart event with them — and leaves the workflows\' own; nothing wanted empties the file', () => {
    syncSessionHooks(dir, BOTH);
    assert.deepStrictEqual(syncSessionHooks(dir, WORKFLOWS), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_OFF);
    assert.deepStrictEqual(syncSessionHooks(dir, NONE), { changed: true });
    assert.deepStrictEqual(settings(), {}, 'the hook, its group, the event, and the emptied hooks object all go');
    assert.deepStrictEqual(syncSessionHooks(dir, NONE), { changed: false });
  });

  it('strips ours alone from a shared group and leaves sibling groups, events, matchers, and keys standing — on both events', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ hooks: [theirs, SESSION_HOOK, PRESENCE_HOOK, END_HOOK] }, { matcher: 'clear', hooks: [theirs] }],
        SessionStart: [{ matcher: 'startup|resume', hooks: [theirs, RESUME_HOOK] }],
      },
    });
    assert.deepStrictEqual(syncSessionHooks(dir, NONE), { changed: true });
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ hooks: [theirs] }, { matcher: 'clear', hooks: [theirs] }],
        SessionStart: [{ matcher: 'startup|resume', hooks: [theirs] }],
      },
    });
  });

  it('a shared group keeps its matcher when ours come out of it', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({ hooks: { SessionEnd: [{ matcher: 'clear', hooks: [theirs, SESSION_HOOK] }] } });
    assert.deepStrictEqual(syncSessionHooks(dir, NONE), { changed: true });
    assert.deepStrictEqual(settings(), { hooks: { SessionEnd: [{ matcher: 'clear', hooks: [theirs] }] } });
  });

  it('collapses twins into the one wanted group per event', () => {
    writeSettings({
      hooks: {
        SessionEnd: [{ hooks: [SESSION_HOOK] }, { hooks: [SESSION_HOOK] }],
        SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }, { matcher: 'resume', hooks: [RESUME_HOOK] }],
      },
    });
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
  });

  it('reconciles the two events independently — a missing SessionStart group lands while a recognised SessionEnd group is left as it was', () => {
    const hand = { hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" session cleanup', timeout: 5 }, PRESENCE_HOOK, END_HOOK] };
    writeSettings({ hooks: { SessionEnd: [hand] } });
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), { hooks: { SessionEnd: [hand], SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }] } });
  });

  it('a hook of ours is ours under any event — a resume hook misplaced under SessionEnd moves to SessionStart', () => {
    writeSettings({ hooks: { SessionEnd: [{ hooks: [SESSION_HOOK, PRESENCE_HOOK, RESUME_HOOK] }] } });
    assert.deepStrictEqual(syncSessionHooks(dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
  });

  it('nothing to remove is nothing changed — an absent file stays absent', () => {
    assert.deepStrictEqual(syncSessionHooks(dir, NONE), { changed: false });
    assert.ok(!fs.existsSync(settingsPath()));
  });

  it('a settings file that does not parse is left untouched and reported, never thrown', () => {
    writeSettings('{not json');
    for (const want of [BOTH, NONE]) {
      const res = syncSessionHooks(dir, want);
      assert.strictEqual(res.changed, false);
      assert.match(res.error, /\.claude\/settings\.json is not valid JSON/);
    }
    writeSettings('[]');
    assert.match(syncSessionHooks(dir, BOTH).error, /root is not an object/);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '[]');
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

  it('restores the original from a name-only label', () => {
    optIn();
    engine(['session', 'label', 'pay']);
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores the name and leaves the position — what the resume reads', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const before = position('sess-1');
    assert.strictEqual(engine(['session', 'cleanup', 'sess-1']).restored, true);
    assert.strictEqual(stashFile(), null);
    assert.deepStrictEqual(position('sess-1'), before);
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

  it('a hook fired outside the project root finds the store through CLAUDE_PROJECT_DIR', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { cwd: stubDir, projectDir: dir });
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('a hook fired outside the project root with no CLAUDE_PROJECT_DIR touches nothing', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { cwd: stubDir });
    assert.deepStrictEqual(res, { ok: true, restored: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'the record waits for a sweep that can find it');
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
    setTmuxName('proj-abc · pay · discussion · alpha · pay · research · beta');
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
    setTmuxName('proj-abc · pay · discussion · alpha · pay · research · beta');
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
    setTmuxName('renamed-by-hand');
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
});

describe('engine session repair', () => {
  beforeEach(setup);
  afterEach(teardown);

  /** A stranded label on the current terminal: dead owner, name still worn. */
  function strand() {
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    setTmuxName('proj-abc · pay · discussion · alpha');
  }

  it('no-ops as disabled — a stranded label included', () => {
    strand();
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'the stash is not pruned');
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
    setTmuxName('proj-abc · pay · discussion · alpha · pay · research · beta');
    setTmuxId('$9');
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null, 'both links consumed');
  });

  it('restores the calling session\'s own label — the start menu is the original name', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('drops the calling session\'s own position with its own label — the start menu is no position', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.ok(position('sess-1'));
    assert.deepStrictEqual(engine(['session', 'repair']), { ok: true, repaired: true });
    assert.strictEqual(position('sess-1'), null);
  });

  it('a dead-owner restore keeps the dead session\'s position — that session may yet be resumed', () => {
    optIn();
    strand();
    writePosition('sess-old', { name: 'pay', phase: 'discussion', topic: 'alpha' });
    assert.deepStrictEqual(engine(['session', 'repair']), { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(position('sess-old'), 'kept for the resume');
  });

  it('a failed rename keeps the position too — the label is still on', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(engine(['session', 'repair'], { failRename: true }), { ok: true, repaired: false });
    assert.ok(position('sess-1'));
  });

  it('ages no position out — a position lives as long as its conversation\'s folder, opted in or not', () => {
    writePosition('sess-old', { name: 'pay' });
    engine(['session', 'repair']);
    optIn();
    engine(['session', 'repair']);
    assert.deepStrictEqual(position('sess-old'), { name: 'pay' });
  });

  it('owns its label through the pid arm — a later conversation in the same process, whose predecessor keeps its position', () => {
    optIn();
    engine(['session', 'label', 'pay']);
    const res = engine(['session', 'repair'], { sessionId: 'sess-2' });
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
    assert.ok(position('sess-1'), 'the position describes the conversation, and that conversation may yet be resumed');
    assert.strictEqual(position('sess-2'), null);
  });

  it('leaves a live peer\'s label — another process, still running', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { sessionId: 'sess-peer', claudePid: process.ppid });
    const res = engine(['session', 'repair'], { sessionId: 'sess-2' });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('prunes a dead-owner orphan no live name needs, and keeps a needed link', () => {
    optIn();
    // The orphan: a label for a session this server no longer has, worn by
    // nothing. The link: dead-owner too, but the live compounded name still
    // chains through it (its head record's owner — a peer process — runs;
    // repair defers).
    writeStash('orphan', { tmux_id: '$4', original: 'gone-proj', applied: 'gone-proj · shop · planning', session_id: 'sess-gone' });
    writeStash('link-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('head-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · research · beta', session_id: 'sess-2', ...peerIdentity() });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · research · beta');
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

describe('engine session resume', () => {
  beforeEach(setup);
  afterEach(teardown);

  /** A session that labelled, then ended: name restored, stash gone, position kept. */
  function ended(args = ['pay', 'discussion', 'alpha']) {
    optIn();
    engine(['session', 'label', ...args]);
    engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
    assert.ok(position('sess-1'));
  }

  it('brings the label back from the hook\'s stdin JSON, the stash owned by the resuming process — the SessionStart contract', () => {
    ended();
    const res = resume([], { input: RESUME_STDIN('sess-1'), claudePid: process.ppid });
    assert.deepStrictEqual(res, { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.session_id, 'sess-1');
    assert.strictEqual(stash.pid, process.ppid, 'the new process owns the label it wears');
    assert.strictEqual(stash.pid_start, processStartTime(process.ppid));
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
  });

  it('takes the session id as an argument too — usable by hand', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('a name-only position comes back as the arrival label', () => {
    ended(['pay']);
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay');
  });

  it('over a live peer\'s label it is the last label — last label wins, as any label does', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { sessionId: 'sess-peer', claudePid: process.ppid });
    writePosition('sess-1', { name: 'pay', phase: 'planning', topic: 'pay' });
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · planning');
    assert.strictEqual(stashRecords().length, 1);
    assert.strictEqual(stashRecords()[0].session_id, 'sess-1');
  });

  it('is idempotent when the name is already worn — no rename, one record', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const renames = renameCount();
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(renameCount(), renames);
    assert.strictEqual(stashRecords().length, 1);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('answers nothing without a position — a fresh id, or no id at all', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-fresh']), { ok: true, resumed: false });
    for (const input of ['', '{}', 'not json']) {
      assert.deepStrictEqual(resume([], { input }), { ok: true, resumed: false });
    }
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(position('sess-1'), 'untouched');
  });

  it('is gated like label — outside tmux and disabled both answer nothing and keep the position', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { noTmux: true }), { ok: true, resumed: false });
    engine(['session', 'label-config', 'false']);
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: false });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(position('sess-1'));
  });

  it('a tmux error answers nothing and keeps the position for the next resume', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { fail: true }), { ok: true, resumed: false });
    assert.ok(position('sess-1'));
  });

  it('never throws on a work unit that no longer exists — the dead position is dropped, the rest of its folder kept', () => {
    ended();
    fs.rmSync(path.join(dir, '.workflows', 'pay'), { recursive: true });
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: false });
    assert.strictEqual(position('sess-1'), null);
    assert.deepStrictEqual(fs.readdirSync(conversation('sess-1')), ['workflow']);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('a phase the engine no longer knows is a dead position too', () => {
    optIn();
    writePosition('sess-1', { name: 'pay', phase: 'deploying', topic: 'alpha' });
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: false });
    assert.strictEqual(position('sess-1'), null);
  });

  it('a hook fired outside the project root finds the store through CLAUDE_PROJECT_DIR', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { cwd: stubDir, projectDir: dir }), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('refuses a second argument loudly — an authoring bug, never a silent no-op', () => {
    const err = engine(['session', 'resume', 'a', 'b'], { expectFail: true });
    assert.match(err.error, /Usage: engine session resume \[session-id\]/);
  });
});
