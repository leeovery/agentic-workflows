'use strict';

// ---------------------------------------------------------------------------
// The session-label suites' world and helpers (test-engine-session-label.cjs,
// test-engine-session-label-config.cjs, test-engine-session-cleanup.cjs,
// test-engine-session-repair.cjs): a git project, its state set up, with one
// work unit, `pay`, made fresh for each test; the shared tmux stub
// (`tmux-stub.cjs`), modelling one session, on the engine's PATH; a system
// config folder of the test's own; and the reads of what a label left — the
// stash, the conversation's position, the settings and commits of the opt-in.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert');
const { processStartTime } = require('../../skills/leeway-engine/scripts/kernel/process.cjs');
const { installTmuxStub, tmuxStubEnv, tmuxStubName, setTmuxStubName, setTmuxStubId } = require('./tmux-stub.cjs');
const harness = require('./engine-harness.cjs');

const { engineHook, WORKFLOW_HOOKS, LAYOUT_GROUP, GUARD_GROUPS } = harness;
const SESSION_HOOK = engineHook('session cleanup');
const RESUME_HOOK = engineHook('session resume');
const [PRESENCE_HOOK, END_HOOK] = WORKFLOW_HOOKS;
// The settings a project reaches with labels on — one group per matcher,
// ours alone — and with them off.
const LABELS_ON = {
  hooks: {
    SessionEnd: [{ hooks: [SESSION_HOOK, PRESENCE_HOOK, END_HOOK] }],
    SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }],
    PreToolUse: GUARD_GROUPS,
  },
};
const LABELS_OFF = { hooks: { SessionEnd: [{ hooks: [PRESENCE_HOOK, END_HOOK] }], PreToolUse: GUARD_GROUPS } };
// The SessionStart hook's stdin, as Claude Code writes it on `claude --resume`.
const RESUME_STDIN = (/** @type {string} */ id) => JSON.stringify({ session_id: id, hook_event_name: 'SessionStart', source: 'resume' });

/**
 * The world a test runs in, set by `setup` and gone at `teardown`: its
 * project root, with its state, since recording the opt-in commits; the
 * folder holding the tmux stub and its state and log files; and its own
 * system config folder, where the conversations' folders sit.
 */
const world = { dir: '', stubDir: '', configDir: '' };
let pinnedConfigDir; // the suite's own, put back after

/** Git in the code tree. @param {string[]} args */
function git(args) {
  return harness.git(world.dir, args);
}

/** Git in the state worktree. @param {string[]} args */
function stateGit(args) {
  return harness.stateGit(world.dir, args);
}

/** A workflows project with the named work units — this checkout, or another. @param {string} prefix @param {string[]} units */
function projectWith(prefix, units) {
  const root = harness.setupGitFixture(prefix);
  for (const unit of units) fs.mkdirSync(path.join(root, '.leeway', unit), { recursive: true });
  return root;
}

function setup() {
  world.dir = projectWith('engine-label-', ['pay']);
  world.stubDir = installTmuxStub();
  world.configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-label-config-'));
  pinnedConfigDir = process.env.LEEWAY_CONFIG_DIR;
  process.env.LEEWAY_CONFIG_DIR = world.configDir;
}

function teardown() {
  process.env.LEEWAY_CONFIG_DIR = pinnedConfigDir;
  for (const d of [world.dir, world.stubDir, world.configDir]) harness.cleanupFixture(d);
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
    ...tmuxStubEnv(world.stubDir, extraEnv.PATH || process.env.PATH),
  };
  if (expectFail) return harness.refuses(cwd || world.dir, args, { env, stdin: input });
  const r = harness.call(cwd || world.dir, args, { env, stdin: input });
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
  return tmuxStubName(world.stubDir);
}

/** The number of renames the stub has been asked for. */
function renameCount() {
  return fs.readFileSync(path.join(world.stubDir, 'log'), 'utf8').split('\n').filter((l) => l.includes('rename-session')).length;
}

/** A rename made outside the engine — the user's own. */
function setTmuxName(name) {
  setTmuxStubName(world.stubDir, name);
}

/** Simulate a tmux server restart: the session keeps its name, renumbered. */
function setTmuxId(id) {
  setTmuxStubId(world.stubDir, id);
}

function stashStore() {
  return path.join(world.dir, '.leeway', '.cache', '.session-labels');
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

/** Where every conversation keeps its folder, beside the system config. */
function conversationsRoot() {
  return path.join(world.configDir, 'conversations');
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
  return JSON.parse(fs.readFileSync(path.join(world.dir, '.leeway', 'manifest.json'), 'utf8'));
}

function settingsPath() {
  return path.join(world.dir, '.claude', 'settings.json');
}

function settings() {
  return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
}

function writeSettings(content) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

/** The last commit on a side, by `run` — the code tree's `git` or the state's `stateGit`. @param {(args: string[]) => string} run */
function head(run) {
  return {
    subject: run(['log', '-1', '--pretty=%s']).trim(),
    files: run(['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
  };
}

/** The choice's two commits: the project manifest on the state branch, the settings in the code tree. */
const CHOICE = {
  state: { subject: 'chore: record session-label choice', files: ['manifest.json'] },
  code: { subject: 'chore: record session-label choice', files: ['.claude/settings.json'] },
};

module.exports = { world, LAYOUT_GROUP, GUARD_GROUPS, SESSION_HOOK, RESUME_HOOK, PRESENCE_HOOK, END_HOOK, LABELS_ON, LABELS_OFF, RESUME_STDIN, git, stateGit, projectWith, setup, teardown, engine, resume, tmuxName, renameCount, setTmuxName, setTmuxId, stashFile, stashRecords, writeStash, conversationsRoot, conversation, position, writePosition, ownStartTime, peerIdentity, optIn, projectManifest, settingsPath, settings, writeSettings, head, CHOICE };
