'use strict';

//
// Tests for the presence heartbeat: beat / clear / scan / cleanup, the
// held-process identity check, liveness aging, and the engine-rendered
// deferral section.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-presence-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'pay'), { recursive: true });
  return dir;
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function engine(dir, args) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  const nl = out.indexOf('\n');
  return { res: JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim()), sections: nl === -1 ? '' : out.slice(nl + 1) };
}
function engineFails(dir, args) {
  const r = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  return JSON.parse(r.stderr.trim());
}
function engineWith(dir, args, { env = {}, input } = {}) {
  const r = spawnSync('node', [ENGINE, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, input: input ?? '',
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const nl = r.stdout.indexOf('\n');
  return JSON.parse((nl === -1 ? r.stdout : r.stdout.slice(0, nl)).trim());
}
const EPOCH_START = 'Thu Jan  1 00:00:00 1970';
function presenceFile(dir, phase, topic) {
  return path.join(dir, '.workflows/.cache/pay', phase, topic, 'presence');
}
function craftRecord(dir, phase, topic, record) {
  const p = presenceFile(dir, phase, topic);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(record) + '\n');
}

describe('engine presence', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  it('beat creates the heartbeat; scan reports it live with the deferral section', () => {
    const beat = engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']).res;
    assert.deepStrictEqual(beat, { ok: true, work_unit: 'pay', phase: 'discussion', topic: 'alpha', beat: true });
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.cache/pay/discussion/alpha/presence')));

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.live, 1);
    assert.strictEqual(res.live_sources, 1, 'a discussion session is source material an analysis reads');
    assert.strictEqual(res.stale_after_seconds, 900);
    assert.strictEqual(res.sessions[0].phase, 'discussion');
    assert.strictEqual(res.sessions[0].topic, 'alpha');
    assert.strictEqual(res.sessions[0].live, true);
    assert.ok(sections.includes(
      '=== DISPLAY: presence deferral (only at an analysis deferral: emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
    ), `deferral marker carries its qualifier and the continuation instruction: ${sections}`);
    assert.ok(sections.includes('  ⚑ Analyses deferred — 1 live session(s): discussion/alpha.'), 'callout flag line');
    // The body is a callout: wrapped at the display width, continuations at
    // the 4-space hang — never a hand-wrapped fixed column.
    const { displayWidth } = require('../../skills/workflow-engine/scripts/kernel/terminal.cjs');
    for (const line of sections.split('\n')) {
      if (line.startsWith('===')) continue;
      assert.ok(line.length <= displayWidth(), `deferral line overflows: ${line}`);
    }
  });

  it('a live session outside the source phases defers no analysis', () => {
    // The analyses read research and discussion; a planning or code session
    // holds nothing they look at.
    for (const phase of ['planning', 'specification', 'implementation', 'review', 'scoping', 'investigation']) {
      engine(dir, ['presence', 'beat', 'pay', phase, 'alpha']);
    }
    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.live, 6, 'every session is live');
    assert.strictEqual(res.live_sources, 0, 'none of them is source material');
    assert.strictEqual(sections, '', 'nothing to defer, nothing rendered');

    engine(dir, ['presence', 'beat', 'pay', 'research', 'beta']);
    const second = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(second.res.live_sources, 1);
    assert.ok(second.sections.includes('research/beta'), second.sections);
    assert.ok(!second.sections.includes('planning/'), `the callout names source rows alone: ${second.sections}`);
  });

  it('an aged heartbeat reads stale — no deferral section', () => {
    engine(dir, ['presence', 'beat', 'pay', 'research', 'beta']);
    const p = path.join(dir, '.workflows/.cache/pay/research/beta/presence');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.live, 0);
    assert.strictEqual(res.sessions[0].live, false);
    assert.ok(res.sessions[0].age_seconds >= 1100);
    assert.strictEqual(sections, '', 'nothing live, nothing rendered');
  });

  it('clear drops the heartbeat and is a no-op when never set', () => {
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']);
    const cleared = engine(dir, ['presence', 'clear', 'pay', 'discussion', 'alpha']).res;
    assert.strictEqual(cleared.cleared, true);
    assert.strictEqual(engine(dir, ['presence', 'scan', 'pay']).res.sessions.length, 0);
    assert.strictEqual(engine(dir, ['presence', 'clear', 'pay', 'discussion', 'alpha']).res.cleared, true);
  });

  it('covers every phase a session sits in — discovery excepted', () => {
    for (const phase of ['research', 'discussion', 'investigation', 'scoping', 'specification', 'planning', 'implementation', 'review']) {
      assert.strictEqual(engine(dir, ['presence', 'beat', 'pay', phase, 'alpha']).res.beat, true, `${phase} beats`);
    }
    const scan = engine(dir, ['presence', 'scan', 'pay']).res;
    assert.strictEqual(scan.sessions.length, 8, 'every phase reports a row');
    assert.strictEqual(scan.live, 8);
    // Discovery is engine-serialised by `discovery-session open` — no heartbeat.
    assert.match(engineFails(dir, ['presence', 'beat', 'pay', 'discovery', 'x']).error, /presence is research\|experiment\|discussion\|/);
  });

  it('refuses illegal phases, unknown work units, and malformed calls', () => {
    assert.match(engineFails(dir, ['presence', 'beat', 'pay', 'grooming', 'x']).error, /got "grooming"/);
    assert.match(engineFails(dir, ['presence', 'beat', 'pay', 'discussion', '../../escapee']).error, /invalid topic name/);
    assert.match(engineFails(dir, ['presence', 'scan', 'ghost']).error, /no work unit directory/);
    assert.match(engineFails(dir, ['presence', 'beat', 'pay', 'discussion']).error, /Usage/);
    assert.match(engineFails(dir, ['presence', 'scan', 'pay', 'extra']).error, /Usage/);
    assert.match(engineFails(dir, ['presence', 'bogus']).error, /Usage/);
  });

  it('an empty work unit refuses; only an absent one means the project', () => {
    // `scan "$wu"` with the variable unset. Silently widening to the whole
    // project would answer a question nobody asked.
    assert.match(engineFails(dir, ['presence', 'scan', '']).error, /empty work unit is refused/);
    assert.strictEqual(engine(dir, ['presence', 'scan']).res.scope, 'project');
  });

  it('the work-unit-less scan walks the whole cache root, naming each row\'s work unit', () => {
    fs.mkdirSync(path.join(dir, '.workflows', 'ship'), { recursive: true });
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']);
    engine(dir, ['presence', 'beat', 'ship', 'implementation', 'beta']);

    const { res, sections } = engine(dir, ['presence', 'scan']);
    assert.strictEqual(res.scope, 'project');
    assert.strictEqual(res.stale_after_seconds, 900);
    assert.strictEqual(res.live, 2);
    assert.strictEqual(res.held, 2);
    assert.deepStrictEqual(
      res.sessions.map((r) => `${r.work_unit}/${r.phase}/${r.topic}`).sort(),
      ['pay/discussion/alpha', 'ship/implementation/beta'],
    );
    assert.ok(res.sessions.every((r) => 'held' in r && 'live' in r && 'age_seconds' in r && 'session_id' in r), 'the row shape is the scan\'s');
    assert.strictEqual(sections, '', 'the deferral section belongs to the work-unit scan');
    assert.strictEqual(engine(dir, ['presence', 'scan', 'pay']).res.work_unit, 'pay', 'the per-work-unit form is unchanged');
  });

  it('the project scan answers empty on a project that has never cached anything', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-presence-bare-'));
    fs.mkdirSync(path.join(bare, '.workflows'), { recursive: true });
    const res = engine(bare, ['presence', 'scan']).res;
    assert.deepStrictEqual(res.sessions, []);
    assert.strictEqual(res.live, 0);
    assert.strictEqual(res.held, 0);
    cleanup(bare);
  });

  it('beat records the owning session identity; scan reports it held', () => {
    engineWith(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'],
      { env: { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'sess-one' } });
    const record = JSON.parse(fs.readFileSync(presenceFile(dir, 'discussion', 'alpha'), 'utf8'));
    assert.strictEqual(record.pid, process.pid);
    assert.ok(record.pid_start, 'the beating process\'s start time is captured');
    assert.strictEqual(record.session_id, 'sess-one');

    const row = engineWith(dir, ['presence', 'scan', 'pay']).sessions[0];
    assert.strictEqual(row.held, true);
    assert.strictEqual(row.live, true);
    assert.strictEqual(row.session_id, 'sess-one');
  });

  it('a held session stays held past the staleness window — idle, not gone', () => {
    engineWith(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'],
      { env: { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'sess-one' } });
    const p = presenceFile(dir, 'discussion', 'alpha');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    const res = engineWith(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.sessions[0].held, true, 'the owning process still runs');
    assert.strictEqual(res.sessions[0].live, false, 'but it is not actively beating');
    assert.strictEqual(res.held, 1);
    assert.strictEqual(res.live, 0);
  });

  it('a recycled pid reads unheld instantly — fresh mtime notwithstanding', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: process.pid, pid_start: EPOCH_START, session_id: 'x' });
    const res = engineWith(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.sessions[0].held, false, 'start-time mismatch means a different process owns the pid');
    assert.strictEqual(res.sessions[0].live, false);
    assert.strictEqual(res.sessions[0].age_seconds < 60, true, 'the heartbeat itself is fresh');
  });

  it('a start-time-less record falls back to process aliveness', () => {
    const dead = spawnSync('node', ['-e', '']);
    craftRecord(dir, 'discussion', 'alpha', { pid: process.pid, pid_start: null, session_id: 'a' });
    craftRecord(dir, 'research', 'beta', { pid: dead.pid, pid_start: null, session_id: 'b' });
    const rows = engineWith(dir, ['presence', 'scan', 'pay']).sessions;
    assert.strictEqual(rows.find((r) => r.topic === 'alpha').held, true);
    assert.strictEqual(rows.find((r) => r.topic === 'beta').held, false);
  });

  it('an identity-less heartbeat degrades to mtime aging', () => {
    engineWith(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'],
      { env: { CLAUDE_PID: '', CLAUDE_CODE_SESSION_ID: '' } });
    const record = JSON.parse(fs.readFileSync(presenceFile(dir, 'discussion', 'alpha'), 'utf8'));
    assert.strictEqual(record.pid, null);
    assert.strictEqual(record.session_id, null);
    assert.strictEqual(engineWith(dir, ['presence', 'scan', 'pay']).sessions[0].held, true);

    const p = presenceFile(dir, 'discussion', 'alpha');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);
    const aged = engineWith(dir, ['presence', 'scan', 'pay']).sessions[0];
    assert.strictEqual(aged.held, false);
    assert.strictEqual(aged.live, false);
  });

  it('a legacy bare-pid heartbeat degrades to mtime aging', () => {
    const p = presenceFile(dir, 'research', 'beta');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '12345\n');
    assert.strictEqual(engineWith(dir, ['presence', 'scan', 'pay']).sessions[0].held, true);
  });

  it('the code-slot read takes held implementation and review rows, never the caller\'s own', () => {
    const { heldCodeSessions } = require('../../skills/workflow-engine/scripts/domain/presence.cjs');
    fs.mkdirSync(path.join(dir, '.workflows', 'ship'), { recursive: true });
    craftRecord(dir, 'implementation', 'alpha', { pid: null, pid_start: null, session_id: 'peer' });
    craftRecord(dir, 'discussion', 'beta', { pid: null, pid_start: null, session_id: 'peer' });
    const shipRow = path.join(dir, '.workflows/.cache/ship/review/gamma/presence');
    fs.mkdirSync(path.dirname(shipRow), { recursive: true });
    fs.writeFileSync(shipRow, JSON.stringify({ pid: null, pid_start: null, session_id: 'mine' }) + '\n');

    const before = process.env.CLAUDE_CODE_SESSION_ID;
    process.env.CLAUDE_CODE_SESSION_ID = 'mine';
    try {
      const rows = heldCodeSessions(dir);
      assert.deepStrictEqual(rows.map((r) => `${r.work_unit}/${r.phase}/${r.topic}`), ['pay/implementation/alpha'],
        'a doc row never takes the slot, and the caller\'s own hold is not a gate against itself');
      process.env.CLAUDE_CODE_SESSION_ID = 'other';
      assert.strictEqual(heldCodeSessions(dir).length, 2, 'from another session both code rows are holders');
    } finally {
      if (before === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = before;
    }
  });

  it('the code-slot read excludes a row carrying the caller\'s pid under another session id', () => {
    // A resumed conversation keeps the process and takes a new session id, so
    // pid ownership is the second arm of the same question — without it the
    // session gates against a hold it is standing in.
    const { heldCodeSessions } = require('../../skills/workflow-engine/scripts/domain/presence.cjs');
    craftRecord(dir, 'implementation', 'alpha', { pid: process.pid, pid_start: null, session_id: 'an-earlier-conversation' });

    const beforeSession = process.env.CLAUDE_CODE_SESSION_ID;
    const beforePid = process.env.CLAUDE_PID;
    process.env.CLAUDE_CODE_SESSION_ID = 'this-conversation';
    process.env.CLAUDE_PID = String(process.pid);
    try {
      assert.deepStrictEqual(heldCodeSessions(dir), [], 'the caller\'s own process holds it, whatever the session id says');
      process.env.CLAUDE_PID = String(process.pid + 1);
      assert.strictEqual(heldCodeSessions(dir).length, 1, 'another process\'s hold is a holder');
    } finally {
      if (beforeSession === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = beforeSession;
      if (beforePid === undefined) delete process.env.CLAUDE_PID;
      else process.env.CLAUDE_PID = beforePid;
    }
  });

  it('cleanup sweeps only the named session, argv or stdin, across work units', () => {
    fs.mkdirSync(path.join(dir, '.workflows', 'ship'), { recursive: true });
    craftRecord(dir, 'discussion', 'alpha', { pid: null, pid_start: null, session_id: 'sess-a' });
    craftRecord(dir, 'research', 'beta', { pid: null, pid_start: null, session_id: 'sess-a' });
    craftRecord(dir, 'discussion', 'gamma', { pid: null, pid_start: null, session_id: 'sess-b' });

    const swept = engineWith(dir, ['presence', 'cleanup', 'sess-a']);
    assert.strictEqual(swept.cleared.length, 2);
    assert.deepStrictEqual(engineWith(dir, ['presence', 'scan', 'pay']).sessions.map((r) => r.topic), ['gamma']);

    const viaStdin = engineWith(dir, ['presence', 'cleanup'], { input: JSON.stringify({ session_id: 'sess-b', reason: 'clear' }) });
    assert.deepStrictEqual(viaStdin.cleared, [{ work_unit: 'pay', phase: 'discussion', topic: 'gamma' }]);
    assert.strictEqual(engineWith(dir, ['presence', 'scan', 'pay']).sessions.length, 0);
  });

  it('cleanup is hook-safe: no session id, empty stdin, malformed stdin all exit clean', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: null, pid_start: null, session_id: 'sess-a' });
    assert.deepStrictEqual(engineWith(dir, ['presence', 'cleanup']).cleared, []);
    assert.deepStrictEqual(engineWith(dir, ['presence', 'cleanup'], { input: 'not json' }).cleared, []);
    assert.deepStrictEqual(engineWith(dir, ['presence', 'cleanup'], { input: '{}' }).cleared, []);
    assert.ok(fs.existsSync(presenceFile(dir, 'discussion', 'alpha')), 'nothing swept without an owner match');
  });
});
