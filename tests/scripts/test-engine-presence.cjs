'use strict';

//
// Tests for the presence heartbeat: beat / clear / scan / cleanup, the
// held-process identity check (the one verdict — idle time is shown, never
// judged), and the engine-rendered deferral section.
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
// Two session identities. OWN is this process — alive with a real start
// time, so its records read held — and is what every scan runs as. PEER is
// pid 1: alive for as long as the machine is and never this process, so its
// rows read held and belong to somebody else.
const OWN = { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'sess-one' };
const PEER = { CLAUDE_PID: '1', CLAUDE_CODE_SESSION_ID: 'sess-peer' };
function engine(dir, args, identity = OWN) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...identity } });
  const nl = out.indexOf('\n');
  return { res: JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim()), sections: nl === -1 ? '' : out.slice(nl + 1) };
}
/** The deferral callout as one line — the renderer wraps it at the display width. */
function unwrapped(sections) {
  return sections.replace(/\n +/g, ' ');
}
function engineFails(dir, args, env = {}) {
  const r = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.strictEqual(r.status, 1);
  return JSON.parse(r.stderr.trim());
}
function engineWith(dir, args, { env = {}, input } = {}) {
  const r = spawnSync('node', [ENGINE, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...OWN, ...env }, input: input ?? '',
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

  it('beat creates the heartbeat; scan reports it held with the deferral section', () => {
    const beat = engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'], PEER).res;
    assert.deepStrictEqual(beat, { ok: true, work_unit: 'pay', phase: 'discussion', topic: 'alpha', beat: true });
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.cache/pay/discussion/alpha/presence')));

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.deepStrictEqual(Object.keys(res), ['ok', 'work_unit', 'held', 'held_sources', 'sessions'],
      'one verdict — no live total, no staleness window');
    assert.strictEqual(res.held, 1);
    assert.strictEqual(res.held_sources, 1, 'a discussion session is source material an analysis reads');
    assert.deepStrictEqual(Object.keys(res.sessions[0]), ['phase', 'topic', 'age_seconds', 'held', 'session_id', 'pid']);
    assert.strictEqual(res.sessions[0].phase, 'discussion');
    assert.strictEqual(res.sessions[0].topic, 'alpha');
    assert.strictEqual(res.sessions[0].held, true);
    assert.ok(sections.includes(
      '=== DISPLAY: presence deferral (only at an analysis deferral: emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
    ), `deferral marker carries its qualifier and the continuation instruction: ${sections}`);
    assert.ok(sections.includes('\n  ⚑ Analyses deferred — 1 session(s): discussion/alpha (last'), `callout flag line at the 2-space indent: ${sections}`);
    assert.match(unwrapped(sections),
      /⚑ Analyses deferred — 1 session\(s\): discussion\/alpha \(last active \d+s ago\)\. They read the settled record, so they wait for those sessions to conclude; a session that is wedged but alive releases its hold with `node \.claude\/skills\/workflow-engine\/scripts\/engine\.cjs presence clear pay discussion alpha`\./,
      `the callout names the row with its last-active age and the release: ${sections}`);
    // The body is a callout: wrapped at the display width, continuations at
    // the 4-space hang — never a hand-wrapped fixed column.
    const { displayWidth } = require('../../skills/workflow-engine/scripts/kernel/terminal.cjs');
    for (const line of sections.split('\n')) {
      if (line.startsWith('===')) continue;
      assert.ok(line.length <= displayWidth(), `deferral line overflows: ${line}`);
    }
  });

  it('the caller\'s own hold never defers — a session does not wait on itself', () => {
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']);
    const own = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(own.res.held, 1, 'the row is held');
    assert.strictEqual(own.res.held_sources, 0, 'but it is this session\'s — an analysis run here is not waiting on it');
    assert.strictEqual(own.sections, '');

    engine(dir, ['presence', 'beat', 'pay', 'research', 'beta'], PEER);
    const mixed = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(mixed.res.held_sources, 1);
    assert.ok(unwrapped(mixed.sections).includes('1 session(s): research/beta (last active'), mixed.sections);
    assert.ok(!mixed.sections.includes('discussion/alpha'), `the own row is never named: ${mixed.sections}`);
  });

  it('a held session outside the source phases defers no analysis', () => {
    // The analyses read research and discussion; a laboratory, planning, or
    // code session holds nothing they look at.
    for (const phase of ['planning', 'specification', 'implementation', 'review', 'scoping', 'investigation', 'experiment']) {
      engine(dir, ['presence', 'beat', 'pay', phase, 'alpha'], PEER);
    }
    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.held, 7, 'every session is held');
    assert.strictEqual(res.held_sources, 0, 'none of them is source material');
    assert.strictEqual(sections, '', 'nothing to defer, nothing rendered');

    engine(dir, ['presence', 'beat', 'pay', 'research', 'beta'], PEER);
    const second = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(second.res.held_sources, 1);
    assert.ok(second.sections.includes('research/beta'), second.sections);
    assert.ok(!second.sections.includes('planning/'), `the callout names source rows alone: ${second.sections}`);
  });

  it('held_sources counts held source rows alone — a dead source session is not one', () => {
    const dead = spawnSync('node', ['-e', '']);
    craftRecord(dir, 'research', 'beta', { pid: dead.pid, pid_start: null, session_id: 'gone' });
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'], PEER);
    engine(dir, ['presence', 'beat', 'pay', 'planning', 'gamma'], PEER);

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.sessions.length, 3, 'every row is listed, held or not');
    assert.strictEqual(res.held, 2);
    assert.strictEqual(res.held_sources, 1, 'the discussion alone: research is dead, planning is not a source');
    assert.ok(unwrapped(sections).includes('1 session(s): discussion/alpha (last active'), sections);
    assert.ok(!sections.includes('research/beta'), `a dead source row is never named: ${sections}`);
  });

  it('an idle heartbeat stays held and still defers — the callout carries its age', () => {
    // A session left idle for hours is still a session. The age is shown so
    // the user can weigh it; no surface turns it into a verdict.
    engine(dir, ['presence', 'beat', 'pay', 'research', 'beta'], PEER);
    const p = path.join(dir, '.workflows/.cache/pay/research/beta/presence');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.sessions[0].held, true, 'the owning process still runs');
    assert.ok(res.sessions[0].age_seconds >= 1100);
    assert.strictEqual(res.held, 1);
    assert.strictEqual(res.held_sources, 1, 'idle is not gone — the analysis still waits');
    assert.ok(unwrapped(sections).includes('⚑ Analyses deferred — 1 session(s): research/beta (last active 20m ago).'),
      `the callout names the row with its idle time: ${sections}`);
  });

  it('the deferral names every held source row with its own age, freshest first', () => {
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'platform-support'], PEER);
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'storage-and-sync'], PEER);
    for (const [topic, minutes] of [['platform-support', 19], ['storage-and-sync', 20]]) {
      const p = presenceFile(dir, 'discussion', topic);
      const past = new Date(Date.now() - minutes * 60 * 1000);
      fs.utimesSync(p, past, past);
    }

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.held_sources, 2);
    assert.ok(unwrapped(sections).includes(
      '⚑ Analyses deferred — 2 session(s): discussion/platform-support (last active 19m ago), discussion/storage-and-sync (last active 20m ago). They read the settled record, so they wait for those sessions to conclude; a session that is wedged but alive releases its hold with `node .claude/skills/workflow-engine/scripts/engine.cjs presence clear pay discussion platform-support`.',
    ), sections);
  });

  it('render phase-note beats the addressed topic — announcing the entry is the same act as claiming the slot', () => {
    fs.writeFileSync(path.join(dir, '.workflows/pay/manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress',
      phases: { experiment: { items: { alpha: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'conceived' } } } } } },
    }) + '\n');
    const out = execFileSync('node', [ENGINE, 'render', 'phase-note', 'pay.experiment.alpha', '--verb', 'Starting', '--noun', 'E1'],
      { cwd: dir, encoding: 'utf8', env: { ...process.env, ...OWN } });
    assert.ok(out.includes('Starting E1: Alpha'), out);
    assert.ok(fs.existsSync(presenceFile(dir, 'experiment', 'alpha')), 'the note claimed the slot');
    const scan = engine(dir, ['presence', 'scan', 'pay']).res;
    assert.strictEqual(scan.sessions.filter((s) => s.phase === 'experiment' && s.topic === 'alpha' && s.held).length, 1);
  });

  it('clear drops the heartbeat and is a no-op when never set', () => {
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'], PEER);
    const cleared = engine(dir, ['presence', 'clear', 'pay', 'discussion', 'alpha']).res;
    assert.strictEqual(cleared.cleared, true);
    assert.strictEqual(engine(dir, ['presence', 'scan', 'pay']).res.sessions.length, 0);
    assert.strictEqual(engine(dir, ['presence', 'clear', 'pay', 'discussion', 'alpha']).res.cleared, true);
  });

  it('covers every phase a session sits in — discovery excepted', () => {
    for (const phase of ['research', 'experiment', 'discussion', 'investigation', 'scoping', 'specification', 'planning', 'implementation', 'review']) {
      assert.strictEqual(engine(dir, ['presence', 'beat', 'pay', phase, 'alpha']).res.beat, true, `${phase} beats`);
    }
    const scan = engine(dir, ['presence', 'scan', 'pay']).res;
    assert.strictEqual(scan.sessions.length, 9, 'every phase reports a row');
    assert.strictEqual(scan.held, 9);
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
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'], PEER);
    engine(dir, ['presence', 'beat', 'ship', 'implementation', 'beta'], PEER);

    const { res, sections } = engine(dir, ['presence', 'scan']);
    assert.deepStrictEqual(Object.keys(res), ['ok', 'scope', 'held', 'sessions'], 'the held total alone — no source count, no window');
    assert.strictEqual(res.scope, 'project');
    assert.strictEqual(res.held, 2);
    assert.deepStrictEqual(
      res.sessions.map((r) => `${r.work_unit}/${r.phase}/${r.topic}`).sort(),
      ['pay/discussion/alpha', 'ship/implementation/beta'],
    );
    assert.ok(res.sessions.every((r) => 'held' in r && !('live' in r) && 'age_seconds' in r && 'session_id' in r), 'the row shape is the scan\'s');
    assert.strictEqual(sections, '', 'the deferral section belongs to the work-unit scan');
    assert.strictEqual(engine(dir, ['presence', 'scan', 'pay']).res.work_unit, 'pay', 'the per-work-unit form is unchanged');
  });

  it('the project scan answers empty on a project that has never cached anything', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-presence-bare-'));
    fs.mkdirSync(path.join(bare, '.workflows'), { recursive: true });
    const res = engine(bare, ['presence', 'scan']).res;
    assert.deepStrictEqual(res.sessions, []);
    assert.strictEqual(res.held, 0);
    cleanup(bare);
  });

  it('beat records the owning session identity; scan reports it held', () => {
    engineWith(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']);
    const record = JSON.parse(fs.readFileSync(presenceFile(dir, 'discussion', 'alpha'), 'utf8'));
    assert.strictEqual(record.pid, process.pid);
    assert.ok(record.pid_start, 'the beating process\'s start time is captured');
    assert.strictEqual(record.session_id, 'sess-one');

    const row = engineWith(dir, ['presence', 'scan', 'pay']).sessions[0];
    assert.strictEqual(row.held, true);
    assert.strictEqual(row.session_id, 'sess-one');
  });

  it('a hold survives a timezone or locale change between the beat and the scan', () => {
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'], { ...PEER, TZ: 'UTC', LC_ALL: 'C' });
    const row = engine(dir, ['presence', 'scan', 'pay'], { ...OWN, TZ: 'America/New_York', LC_ALL: 'en_GB.UTF-8' }).res.sessions[0];
    assert.strictEqual(row.held, true, 'the recorded start time is compared verbatim, so it must not depend on the reader\'s clock settings');
  });

  it('a recycled pid reads unheld instantly — fresh mtime notwithstanding', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: process.pid, pid_start: EPOCH_START, session_id: 'x' });
    const res = engineWith(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.sessions[0].held, false, 'start-time mismatch means a different process owns the pid');
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

  it('a beat with no CLAUDE_PID refuses — a record nothing can hold is never written', () => {
    const err = engineFails(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha'], { CLAUDE_PID: '', CLAUDE_CODE_SESSION_ID: '' });
    assert.match(err.error, /CLAUDE_PID is not set/);
    assert.ok(!fs.existsSync(presenceFile(dir, 'discussion', 'alpha')), 'nothing written');
  });

  it('an identity-less heartbeat is never held — a record that cannot be verified', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: null, pid_start: null, session_id: null });
    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.sessions[0].held, false, 'fresh mtime notwithstanding');
    assert.strictEqual(res.held_sources, 0);
    assert.strictEqual(sections, '', 'an unverifiable row defers nothing');
  });

  it('a legacy bare-pid heartbeat is never held', () => {
    const p = presenceFile(dir, 'research', 'beta');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '12345\n');
    assert.strictEqual(engineWith(dir, ['presence', 'scan', 'pay']).sessions[0].held, false);
  });

  it('the code-slot read takes held implementation and review rows, never the caller\'s own', () => {
    const { heldCodeSessions } = require('../../skills/workflow-engine/scripts/domain/presence.cjs');
    fs.mkdirSync(path.join(dir, '.workflows', 'ship'), { recursive: true });
    // Every row is held by this (alive) process; ownership is decided by
    // session id alone, with the pid arm switched off below.
    craftRecord(dir, 'implementation', 'alpha', { pid: process.pid, pid_start: null, session_id: 'peer' });
    craftRecord(dir, 'discussion', 'beta', { pid: process.pid, pid_start: null, session_id: 'peer' });
    const shipRow = path.join(dir, '.workflows/.cache/ship/review/gamma/presence');
    fs.mkdirSync(path.dirname(shipRow), { recursive: true });
    fs.writeFileSync(shipRow, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'mine' }) + '\n');

    const beforeSession = process.env.CLAUDE_CODE_SESSION_ID;
    const beforePid = process.env.CLAUDE_PID;
    process.env.CLAUDE_CODE_SESSION_ID = 'mine';
    process.env.CLAUDE_PID = '';
    try {
      const rows = heldCodeSessions(dir);
      assert.deepStrictEqual(rows.map((r) => `${r.work_unit}/${r.phase}/${r.topic}`), ['pay/implementation/alpha'],
        'a doc row never takes the slot, and the caller\'s own hold is not a gate against itself');
      process.env.CLAUDE_CODE_SESSION_ID = 'other';
      assert.strictEqual(heldCodeSessions(dir).length, 2, 'from another session both code rows are holders');
    } finally {
      if (beforeSession === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = beforeSession;
      if (beforePid === undefined) delete process.env.CLAUDE_PID;
      else process.env.CLAUDE_PID = beforePid;
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

  it('a queue read stamps nothing where no heartbeat exists — reads never manufacture a hold', () => {
    const res = engineWith(dir, ['topic', 'queue', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.count, 0);
    assert.ok(!fs.existsSync(presenceFile(dir, 'discussion', 'alpha')),
      'a foreign topic\'s queue check leaves no presence behind');
  });

  it('a queue read refreshes a heartbeat this session owns', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: null, pid_start: null, session_id: 'sess-one' });
    const p = presenceFile(dir, 'discussion', 'alpha');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    engineWith(dir, ['topic', 'queue', 'pay', 'discussion', 'alpha']);
    const record = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(record.session_id, 'sess-one');
    assert.strictEqual(record.pid, process.pid, 'the refresh re-stamps the full identity');
    const row = engineWith(dir, ['presence', 'scan', 'pay']).sessions[0];
    assert.strictEqual(row.held, true);
    assert.ok(row.age_seconds < 60, 'the quiet-turn poll keeps the own hold\'s last-active age fresh');
  });

  it('a queue read never overwrites a peer\'s heartbeat', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: null, pid_start: null, session_id: 'peer-sess' });
    const p = presenceFile(dir, 'discussion', 'alpha');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    engineWith(dir, ['topic', 'queue', 'pay', 'discussion', 'alpha']);
    const record = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(record.session_id, 'peer-sess', 'the peer\'s identity stands');
    assert.strictEqual(record.pid, null);
    assert.ok(fs.statSync(p).mtimeMs < Date.now() - 15 * 60 * 1000, 'and its last-active age is untouched');
  });

  it('an identity-less heartbeat is not refreshed by a read — an unowned record is never claimed', () => {
    craftRecord(dir, 'discussion', 'alpha', { pid: null, pid_start: null, session_id: null });
    const p = presenceFile(dir, 'discussion', 'alpha');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    engineWith(dir, ['topic', 'queue', 'pay', 'discussion', 'alpha']);
    assert.ok(fs.statSync(p).mtimeMs < Date.now() - 15 * 60 * 1000, 'an unowned record is never claimed');
  });

  it('an agent-store scan stamps nothing where no heartbeat exists', () => {
    fs.writeFileSync(path.join(dir, '.workflows', 'pay', 'manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress', phases: {},
    }, null, 2));
    engineWith(dir, ['agent', 'scan', 'pay', 'discussion', 'alpha']);
    assert.ok(!fs.existsSync(presenceFile(dir, 'discussion', 'alpha')),
      'reading a foreign topic\'s agents leaves no presence behind');
  });
});

describe('fmtAge', () => {
  const { fmtAge } = require('../../skills/workflow-engine/scripts/domain/presence.cjs');

  it('rounds to the unit a reader weighs a hold in — seconds, minutes, hours, days', () => {
    assert.deepStrictEqual(
      [0, 89, 90, 5369, 5370, 10800, 126000, 129600, 777600].map(fmtAge),
      ['0s', '89s', '2m', '89m', '2h', '3h', '35h', '2d', '9d'],
    );
  });
});
