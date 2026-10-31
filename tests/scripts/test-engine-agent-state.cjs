'use strict';

// ---------------------------------------------------------------------------
// `engine agent` — the background-agent lifecycle store.
//
// Pins the state machine that replaced hand-edited cache frontmatter
// (design/analysis-state.md): dispatch allocates ids and records in-flight
// rows without creating files; the content file's existence is the
// completion signal scan promotes on; ack/announce/surface/incorporate walk
// a validated lifecycle with loud refusals off the legal path. Store is
// `.leeway/.cache/{wu}/state.json` — cache-resident, purged at close. The
// background review's back-off arms on the topic's moves on the ledger since
// the last review's mark (9.8.14), over the ledger suites' world.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { setupFixture, cleanupFixture } = require('./discovery-test-utils.cjs');
const { ok: engineJson, refuses: engineFails } = require('./engine-harness.cjs');
const { UNIT, MADE, NOTE, SPACE, PHASES, writtenWorld, ledgerHelpers } = require('./ledger-world.cjs');
const { processStartTime } = require('../../skills/leeway-engine/scripts/kernel/process.cjs');

/** Agent-store runner: the verb prefix is the suite's subject. */
const runJson = (dir, args) => engineJson(dir, ['agent', ...args]);

const runFails = (dir, args) => engineFails(dir, ['agent', ...args]);

function readStore(dir, wu, phase, topic) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', '.cache', wu, phase, topic, 'state.json'), 'utf8'));
}

function writeContent(dir, file, body = '# Findings\n\n## F1\n') {
  const full = path.resolve(dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

describe('engine agent — lifecycle store', () => {
  let dir;
  beforeEach(() => {
    dir = setupFixture('agent-state-');
    const wuDir = path.join(dir, '.leeway', 'pay');
    fs.mkdirSync(wuDir, { recursive: true });
    fs.writeFileSync(path.join(wuDir, 'manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress', phases: {},
    }, null, 2));
  });
  afterEach(() => cleanupFixture(dir));

  it('dispatch allocates sequential ids per kind, records in-flight, creates no file', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001');
    assert.strictEqual(a.file, path.join(dir, '.leeway/.cache/pay/discussion/alpha/review-001.md'));
    assert.ok(!fs.existsSync(a.file), 'no skeleton file');
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-002');
    const c = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(c.id, 'deep-dive-001-auth', 'kinds number independently, label suffixes');
    const store = readStore(dir, 'pay', 'discussion', 'alpha');
    assert.strictEqual(store.agents['review-001'].status, 'in-flight');
  });

  it('each row names the process and conversation that dispatched it — null where Claude Code handed none', () => {
    const named = engineJson(dir, ['agent', 'dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review'], { env: { CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid) } });
    const unnamed = engineJson(dir, ['agent', 'dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review'], { env: { CLAUDE_CODE_SESSION_ID: undefined, CLAUDE_PID: undefined } });
    const { agents } = readStore(dir, 'pay', 'discussion', 'alpha');
    const dispatcher = (/** @type {string} */ id) => [agents[id].session_id, agents[id].pid, agents[id].pid_start];
    assert.deepStrictEqual([dispatcher(named.id), dispatcher(unnamed.id)], [['sess-1', process.pid, processStartTime(process.pid)], [null, null, null]]);
  });

  it('dispatch numbers past legacy files already in the cache dir', () => {
    writeContent(dir, '.leeway/.cache/pay/discussion/alpha/review-003.md', '---\nstatus: pending\n---\nlegacy');
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review', '--final']);
    assert.strictEqual(a.id, 'review-004', 'never collides with pre-programme files');
  });

  it('numbering survives past 999 — ids and sets stay distinct at four digits', () => {
    writeContent(dir, '.leeway/.cache/pay/discussion/alpha/deep-dive-999-auth.md', 'legacy');
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(a.id, 'deep-dive-1000-auth');
    writeContent(dir, `.leeway/.cache/pay/discussion/alpha/${a.id}.md`);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.ok(scan.pending.some((r) => r.id === 'deep-dive-1000-auth'), 'the four-digit row promotes like any other');
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(b.id, 'deep-dive-1001-auth', 'allocation reads the four-digit id, not a truncation');
  });

  it('dispatch refuses unknown kind, phase, work unit, and bad labels', () => {
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'oracle']).error, /Invalid agent kind/);
    for (const phase of ['cooking', 'research']) {
      assert.match(runFails(dir, ['dispatch', 'pay', phase, 'alpha', '--kind', 'review']).error, /Invalid phase/, phase);
    }
    assert.match(runFails(dir, ['dispatch', 'ghost', 'discussion', 'alpha', '--kind', 'review']).error, /not found/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'a/b']).error, /Invalid label/);
  });

  it('review dispatch refuses while the mailbox holds entries, clears when it drains', () => {
    writeContent(dir, '.leeway/pay/topics/alpha/mail/001-parked.md', '### Parked\n');
    const err = runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']).error;
    assert.match(err, /review dispatch blocked: 1 message/);
    assert.match(err, /topic answered/, 'the refusal names the recovery path');
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.cache/pay/discussion/alpha/state.json')), 'nothing recorded');
    fs.unlinkSync(path.join(dir, '.leeway/pay/topics/alpha/mail/001-parked.md'));
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001', 'a drained mailbox dispatches normally');
  });

  it('the mailbox guard holds review dispatches only — other kinds pass a full mailbox', () => {
    writeContent(dir, '.leeway/pay/topics/alpha/mail/001-parked.md', '### Parked\n');
    const dive = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(dive.id, 'deep-dive-001-auth');
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']).error, /review dispatch blocked/);
    // Non-.md dirt (editor swap files, .DS_Store) and non-file entries never
    // count as waiting messages — only what `topic mailbox` itself would count.
    fs.unlinkSync(path.join(dir, '.leeway/pay/topics/alpha/mail/001-parked.md'));
    writeContent(dir, '.leeway/pay/topics/alpha/mail/.DS_Store', 'dirt');
    fs.mkdirSync(path.join(dir, '.leeway/pay/topics/alpha/mail/nested.md'), { recursive: true });
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001');
  });

  it('scan promotes in-flight to pending only once the content file exists with content', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    let scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['deep-dive-001-auth']);
    assert.ok(scan.in_flight[0].created, 'in-flight rows carry created for the earlier-session judgment');

    fs.mkdirSync(path.dirname(d.file), { recursive: true });
    fs.writeFileSync(d.file, '');
    scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['deep-dive-001-auth'], 'an empty file is not completion');

    writeContent(dir, d.file);
    scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(scan.pending[0].id, 'deep-dive-001-auth');
  });

  it('ack records findings and moves to acknowledged; --clean incorporates immediately', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const acked = runJson(dir, ['ack', 'pay', 'discussion', 'alpha', d.id, '--findings', 'F1,F2']);
    assert.strictEqual(acked.status, 'acknowledged');
    assert.deepStrictEqual(acked.remaining, ['F1', 'F2']);

    const e = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'perf']);
    writeContent(dir, e.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const clean = runJson(dir, ['ack', 'pay', 'discussion', 'alpha', e.id, '--clean']);
    assert.strictEqual(clean.status, 'incorporated', 'a clean report needs no surfacing');
  });

  it('ack refuses off the legal path: in-flight rows, duplicates, missing rows, both/neither flag', () => {
    runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.match(runFails(dir, ['ack', 'pay', 'discussion', 'alpha', 'deep-dive-001-auth', '--clean']).error,
      /is in-flight — only a pending row/);
    assert.match(runFails(dir, ['ack', 'pay', 'discussion', 'alpha', 'ghost-001', '--clean']).error,
      /No agent "ghost-001".*Known agents there: deep-dive-001-auth/);
    assert.match(runFails(dir, ['ack', 'pay', 'discussion', 'alpha', 'deep-dive-001-auth']).error, /Usage/);
    assert.match(runFails(dir, ['ack', 'pay', 'discussion', 'alpha', 'deep-dive-001-auth', '--findings', 'F1,F1']).error,
      /duplicate/);
  });

  it('surface walks the findings; the last one incorporates the row; refusals are loud', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'ship-now', '--label', 'strategic-timing']);
    for (const a of pair.agents) writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set]);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['ack', 'pay', 'discussion', 'alpha', 'synthesis-001', '--findings', 'T1,T2']);
    runJson(dir, ['announce', 'pay', 'discussion', 'alpha', 'synthesis-001']);

    const s1 = runJson(dir, ['surface', 'pay', 'discussion', 'alpha', 'synthesis-001', 'T1']);
    assert.strictEqual(s1.status, 'acknowledged');
    assert.deepStrictEqual(s1.remaining, ['T2']);
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', 'synthesis-001', 'T1']).error, /already surfaced/);
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', 'synthesis-001', 'T9']).error, /no finding "T9"/);

    const s2 = runJson(dir, ['surface', 'pay', 'discussion', 'alpha', 'synthesis-001', 'T2']);
    assert.strictEqual(s2.status, 'incorporated', 'last finding auto-incorporates');
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', 'synthesis-001', 'T2']).error,
      /is incorporated — only an acknowledged row/);
  });

  it('surface takes a comma batch — a lane lands in one call, all-or-nothing', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['ack', 'pay', 'discussion', 'alpha', d.id, '--findings', 'F1,F2,F3,F4']);

    const b = runJson(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F1,F3']);
    assert.deepStrictEqual(b.surfaced, ['F1', 'F3']);
    assert.deepStrictEqual(b.remaining, ['F2', 'F4']);
    assert.strictEqual(b.status, 'acknowledged');

    // A bad entry fails the batch whole — the good ids in it stay unsurfaced.
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F2,F9']).error, /no finding "F9"/);
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F2,F1']).error, /already surfaced/);
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F2,F2']).error, /duplicate ids/);
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F2,']).error, /no empty entries/);
    assert.deepStrictEqual(runJson(dir, ['scan', 'pay', 'discussion', 'alpha']).acknowledged[0].remaining, ['F2', 'F4'],
      'a refused batch records nothing');

    const last = runJson(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F2, F4']);
    assert.strictEqual(last.status, 'incorporated', 'a batch draining the row incorporates it');
    assert.deepStrictEqual(last.surfaced, ['F1', 'F3', 'F2', 'F4']);
  });

  it('a multi-label dispatch is one set: shared number, per-label rows and files', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'formal-systems', '--label', 'incentive-realist']);
    assert.strictEqual(d.set, '001');
    assert.deepStrictEqual(d.agents.map((a) => a.id),
      ['perspective-001-formal-systems', 'perspective-001-incentive-realist']);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const again = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'ship-now', '--label', 'strategic-timing']);
    assert.strictEqual(again.set, '002', 'the next council is the next set');
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'dup', '--label', 'dup']).error, /duplicates/);
  });

  it('a perspective dispatch is one polarity pair: a label that is no lens, one lens alone, or two of different pairs refused, nothing recorded', () => {
    const refused = (/** @type {string[]} */ labels) => runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', ...labels.flatMap((l) => ['--label', l])]).error;

    assert.match(refused(['ship-now', 'argue-for-friday']), /^"argue-for-friday" is no lens — a perspective argues one of the polarity pairs: formal-systems\/incentive-realist, /);
    assert.match(refused(['ship-now']), /one polarity pair, a lens and its counter-lens, as two --label — ship-now is one lens: /);
    assert.match(refused(['ship-now', 'tail-risk']), /ship-now and tail-risk are no pair: /);
    assert.match(refused([]), /none was given: /);
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.cache/pay/discussion/alpha/state.json')), 'nothing recorded');
    assert.strictEqual(runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'tail-risk', '--label', 'common-path']).set, '001',
      'either lens of a pair may come first');
  });

  it('synthesis joins its landed set — required, complete, one live per set, name unoccupied', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'ship-now', '--label', 'strategic-timing']);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set]).error,
      /not complete/, 'a half-landed council never synthesises');
    for (const a of pair.agents) writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const syn = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set]);
    assert.strictEqual(syn.id, 'synthesis-001');
    assert.strictEqual(syn.set, '001');
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', '001']).error,
      /already has a live synthesis/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', '009']).error,
      /No perspective set/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review', '--set', '001']).error,
      /legal only with --kind synthesis/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis']).error,
      /always joins a perspective set/);
    // A dead synthesis closes and re-dispatches; a legacy file blocks the name.
    runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', 'synthesis-001']);
    const again = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', '001']);
    assert.strictEqual(again.id, 'synthesis-001', 'recovery re-dispatch after closing the dead row');
    writeContent(dir, '.leeway/.cache/pay/discussion/beta/synthesis-001.md', 'stale legacy report');
    const p2 = runJson(dir, ['dispatch', 'pay', 'discussion', 'beta', '--kind', 'perspective', '--label', 'common-path', '--label', 'tail-risk']);
    for (const a of p2.agents) writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'beta']);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'beta', '--kind', 'synthesis', '--set', p2.set]).error,
      /legacy file/, 'a dead session file never becomes this council synthesis');
  });

  it('perspectives are never acknowledged, and sit alongside a mid-drain review', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'ship-now', '--label', 'strategic-timing']);
    for (const a of pair.agents) writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.match(runFails(dir, ['ack', 'pay', 'discussion', 'alpha', pair.agents[0].id, '--clean']).error,
      /synthesis input, never acknowledged/);
    const r = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    writeContent(dir, r.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['ack', 'pay', 'discussion', 'alpha', r.id, '--findings', 'F1,F2']);
    runJson(dir, ['surface', 'pay', 'discussion', 'alpha', r.id, 'F1']);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.acknowledged[0].remaining, ['F2'],
      'the mid-drain review keeps its remaining findings alongside pending perspectives');
    assert.strictEqual(scan.pending.length, 2, 'both perspectives stay listed for set checks');
  });

  it('deleting the topic cache dir is a complete cleanse — state is colocated', () => {
    runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    runJson(dir, ['dispatch', 'pay', 'discussion', 'beta', '--kind', 'deep-dive', '--label', 'auth']);
    fs.rmSync(path.join(dir, '.leeway', '.cache', 'pay', 'discussion', 'alpha'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    assert.deepStrictEqual(runJson(dir, ['scan', 'pay', 'discussion', 'alpha']).in_flight, [],
      'the restart rm -rf removes rows with the content');
    assert.deepStrictEqual(runJson(dir, ['scan', 'pay', 'discussion', 'beta']).in_flight.map((r) => r.id), ['deep-dive-001-auth'],
      'the sibling topic is untouched');
    const fresh = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(fresh.id, 'deep-dive-001-auth', 'a cleansed topic restarts its numbering');
  });

  it('a pending perspective and a pending review are both listed, kinds intact', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'common-path', '--label', 'tail-risk']);
    for (const a of pair.agents) writeContent(dir, a.file);
    const r = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    writeContent(dir, r.file);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(scan.pending.length, 3, 'every row listed for set checks');
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ x) => x.kind), ['perspective', 'perspective', 'review'],
      'the reading flow filters by kind — the store lists both');
  });

  it('rows expose set and created; incorporated rows come back whole', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['ack', 'pay', 'discussion', 'alpha', d.id, '--clean']);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const row = scan.incorporated[0];
    assert.strictEqual(row.id, 'deep-dive-001-auth');
    assert.strictEqual(row.set, '001');
    assert.ok(typeof row.created === 'string' && row.created.length > 0,
      'created rides every row for freshness checks');
  });

  it('incorporate closes from any live state: pending set-members and abandoned in-flight rows', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'common-path', '--label', 'tail-risk']);
    for (const a of pair.agents) writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const consumed = runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', pair.agents[1].id]);
    assert.strictEqual(consumed.status, 'incorporated', 'pending row consumed without surfacing');

    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    const abandoned = runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', b.id]);
    assert.strictEqual(abandoned.status, 'incorporated', 'stale in-flight row abandoned');
    assert.match(runFails(dir, ['incorporate', 'pay', 'discussion', 'alpha', b.id]).error, /already incorporated/);
  });

  it('incorporate is the skip-all exit and keeps the unsurfaced record honest', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'perf']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['ack', 'pay', 'discussion', 'alpha', d.id, '--findings', 'F1,F2,F3']);
    runJson(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F1']);
    const done = runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', d.id]);
    assert.strictEqual(done.status, 'incorporated');
    assert.deepStrictEqual(done.remaining, ['F2', 'F3'], 'declined findings stay recorded as never raised');
  });

  it('a mid-drain row and a fresh report coexist: remaining and pending both stand', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['ack', 'pay', 'discussion', 'alpha', a.id, '--findings', 'F1,F2']);
    runJson(dir, ['surface', 'pay', 'discussion', 'alpha', a.id, 'F1']);

    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'perf']);
    writeContent(dir, b.file);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.acknowledged[0].remaining, ['F2'], 'the mid-drain row keeps F2 owed');
    assert.strictEqual(scan.pending[0].id, 'deep-dive-002-perf');
  });

  it('phase/topic isolation: rows never leak across addresses', () => {
    runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    runJson(dir, ['dispatch', 'pay', 'discussion', 'beta', '--kind', 'deep-dive', '--label', 'auth']);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'beta']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['deep-dive-001-auth'], 'beta sees only its own agent');
    assert.match(runFails(dir, ['ack', 'pay', 'discussion', 'beta', 'deep-dive-002-auth', '--clean']).error, /No agent/);
  });

  it('corrupt store refuses loudly instead of resetting', () => {
    runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    fs.writeFileSync(path.join(dir, '.leeway', '.cache', 'pay', 'discussion', 'alpha', 'state.json'), '{nope');
    assert.match(runFails(dir, ['scan', 'pay', 'discussion', 'alpha']).error, /Corrupt agent state/);
  });

  it('a row whose findings or surfaced is not an array refuses loudly, never a TypeError', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    const storeFile = path.join(dir, '.leeway', '.cache', 'pay', 'discussion', 'alpha', 'state.json');
    const state = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    state.agents[d.id].status = 'acknowledged';
    state.agents[d.id].findings = 'F1';
    fs.writeFileSync(storeFile, JSON.stringify(state));
    assert.match(runFails(dir, ['scan', 'pay', 'discussion', 'alpha']).error, /not a valid agent row/);
    state.agents[d.id].findings = ['F1'];
    state.agents[d.id].surfaced = 'F1';
    fs.writeFileSync(storeFile, JSON.stringify(state));
    assert.match(runFails(dir, ['surface', 'pay', 'discussion', 'alpha', d.id, 'F1']).error, /not a valid agent row/);
  });

  it('every verb refuses a traversal topic — dispatch and ack included', () => {
    for (const topic of ['../../../escape', 'a/b', '..', '.', '']) {
      // '' is refused one layer up, at the CLI's usage check — still a refusal.
      assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', topic, '--kind', 'deep-dive', '--label', 'auth']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['ack', 'pay', 'discussion', topic, 'deep-dive-001-auth', '--clean']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['scan', 'pay', 'discussion', topic]).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['announce', 'pay', 'discussion', topic, 'deep-dive-001-auth']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['surface', 'pay', 'discussion', topic, 'deep-dive-001-auth', 'F1']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['incorporate', 'pay', 'discussion', topic, 'deep-dive-001-auth']).error, /Invalid topic|Usage:/);
    }
    assert.strictEqual(fs.existsSync(path.join(dir, '.leeway', 'escape')), false);
    assert.strictEqual(fs.existsSync(path.join(dir, '.leeway', '.cache', 'pay', 'discussion', 'a')), false);
  });

  it('synthesis recovery re-dispatch discards the dead row\'s stale report', () => {
    runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'ship-now', '--label', 'strategic-timing']);
    writeContent(dir, '.leeway/.cache/pay/discussion/alpha/perspective-001-ship-now.md');
    writeContent(dir, '.leeway/.cache/pay/discussion/alpha/perspective-001-strategic-timing.md');
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const s1 = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', '001']);
    writeContent(dir, s1.file, '# Stale synthesis report\n');
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', s1.id]);
    const s2 = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis', '--set', '001']);
    assert.strictEqual(s2.id, s1.id);
    assert.strictEqual(fs.existsSync(path.join(dir, s1.file)), false,
      'the prior report must be discarded so the fresh agent\'s write is the completion signal');
  });
});

/**
 * The arming suite's world, written once: on the note window, the person's
 * three questions; then, past mark A, the first answered by the person, the
 * second moved to space homing, a finding, the third reworded, and the
 * person's question on space homing; then, past mark B, Claude's own call,
 * its question with it; then, past mark C, the person's question handed
 * over by "your call"; then, past mark D, a review's finding, and the
 * person's answer to it. Each mark is the id of the last line before it.
 */
const ARMING = writtenWorld('agent-arming-', PHASES, (write) => {
  const ask = (/** @type {string} */ by, address = NOTE) => write('ask', address, [], { by, who_moved_whom: 'none', text: `A question of ${by}'s?` }).id;
  const decide = (/** @type {string} */ question, /** @type {string} */ by, given = 'own') => write('decide', NOTE, ['--answers', question], {
    by, given, who_moved_whom: 'none', text: 'The answer.', why: 'The reason.',
  }).id;
  const [closed, moved, reworded] = [ask('person'), ask('person'), ask('person')];
  const a = reworded;
  decide(closed, 'person');
  write('move', NOTE, ['--question', moved, '--to', 'space-homing'], MADE);
  write('find', NOTE, [], { ...MADE, text: 'Panels float above every Space.', how: 'a spike', known: 'spike' });
  write('replace', NOTE, ['--replaces', reworded, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'A question reworded?' });
  const b = ask('person', SPACE);
  const c = decide(ask('claude'), 'claude');
  const d = decide(ask('person'), 'claude', 'your-call');
  decide(ask('review'), 'person');
  return { a, b, c, d };
});

describe('engine agent — discussion review arming (9.8.14)', () => {
  const TOPIC = 'note-window';
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = ARMING.world();
  });
  afterEach(() => cleanupFixture(dir));
  const { write, entries, full } = ledgerHelpers(() => dir);

  /** The id of the ledger's last line. */
  const last = () => entries().at(-1).id;

  /** A dispatch of `kind` on the note window: its response. @param {string} kind @param {string[]} [flags] */
  const dispatch = (kind, flags = []) => runJson(dir, ['dispatch', UNIT, 'discussion', TOPIC, '--kind', kind, ...flags]);

  /** A review dispatch refused: its error. */
  const refusedReview = () => runFails(dir, ['dispatch', UNIT, 'discussion', TOPIC, '--kind', 'review']).error;

  /**
   * A topic's store holding a completed review per mark, in order, each its
   * report read and drained; a mark null leaves its row with no report, a
   * killed dispatch closed.
   * @param {(string|null)[]} marks @param {string} [topic]
   */
  function reviewed(marks, topic = TOPIC) {
    const agents = Object.fromEntries(marks.map((mark, i) => {
      const id = `review-00${i + 1}`;
      const findings = mark === null ? [] : ['F1'];
      return [id, {
        id, kind: 'review', phase: 'discussion', topic, set: `00${i + 1}`, status: 'incorporated', announced: false, findings, surfaced: findings, created: `2026-08-0${i + 1}T00:00:00.000Z`, ledger_mark: mark ?? last(),
      }];
    }));
    writeContent(dir, `.leeway/.cache/${UNIT}/discussion/${topic}/state.json`, JSON.stringify({ agents }));
  }

  /** The arming verdict scan answers for a topic. @param {string} [topic] */
  const arming = (topic = TOPIC) => runJson(dir, ['scan', UNIT, 'discussion', topic]).review_arming;

  /** The ledger's mark a row was stamped with. @param {string} id */
  const markOf = (id) => readStore(dir, UNIT, 'discussion', TOPIC).agents[id].ledger_mark;

  it('the first review is free, and its row is stamped with the ledger\'s mark — the id of its last line', () => {
    const first = dispatch('review');

    assert.deepStrictEqual([first.id, markOf(first.id)], ['review-001', last()]);
  });

  it('a second review refuses with no move since the last, naming the bypass, and arms on the person\'s question opened', () => {
    reviewed([last()]);
    assert.match(refusedReview(), /^review dispatch blocked: quiet — 0 of 1 moves since review-001 — .*--final/);

    write('ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'What opens first?' });

    assert.strictEqual(dispatch('review').id, 'review-002');
  });

  it('the moves since a mark: the person\'s question closed or moved, counted on the topic it left and the one it went to; Claude\'s own call once, its question with it; a question handed over as the person\'s opened and Claude\'s call; a review\'s finding nothing, its answer one — a finding, a rewording and another topic\'s question nothing', () => {
    const { a, b, c, d } = ARMING.made;
    /** @param {string} mark @param {string} topic */
    const seen = (mark, topic) => {
      reviewed([full(mark)], topic);
      return arming(topic).moves_seen;
    };

    assert.deepStrictEqual([seen(a, TOPIC), seen(b, TOPIC), seen(c, TOPIC), seen(d, TOPIC)], [6, 4, 3, 1], 'the note window: 2 past A before B, 1 past B before C, 2 past C before D, 1 past D');
    assert.deepStrictEqual([seen(a, 'space-homing'), seen(b, 'space-homing')], [2, 0], 'space homing: the move in and its own question, past A');
  });

  it('the requirement escalates per completed cycle — two cycles want two moves — and caps at 3', () => {
    reviewed([last(), last()]);
    assert.match(refusedReview(), /0 of 2 moves since review-002/);
    reviewed([last(), last(), last(), last()]);
    assert.match(refusedReview(), /0 of 3 moves since review-004/);

    reviewed([last(), last(), last(), full(ARMING.made.b)]);

    assert.strictEqual(dispatch('review').id, 'review-005', 'three moves re-arm however many cycles have run');
  });

  it('--final bypasses the movement gate and still stamps the mark', () => {
    reviewed([last()]);

    const final = dispatch('review', ['--final']);

    assert.deepStrictEqual([final.id, markOf(final.id)], ['review-002', last()]);
  });

  it('scan answers the arming verdict on discussion topics only', () => {
    reviewed([last()]);
    assert.deepStrictEqual(arming(), {
      armed: false, cycles: 1, moves_seen: 0, moves_needed: 1, reason: 'quiet — 0 of 1 moves since review-001',
    });
    assert.strictEqual(runJson(dir, ['scan', UNIT, 'investigation', TOPIC]).review_arming, undefined, 'investigation carries no review');
  });

  it('--final is refused outside a discussion review, like --set off its kind', () => {
    assert.match(runFails(dir, ['dispatch', UNIT, 'investigation', TOPIC, '--kind', 'root-cause-validation', '--final']).error,
      /--final bypasses a discussion review's movement gate/);
    assert.match(runFails(dir, ['dispatch', UNIT, 'discussion', TOPIC, '--kind', 'perspective', '--label', 'ship-now', '--label', 'strategic-timing', '--final']).error,
      /legal only with --kind review in the discussion phase/);
  });

  it('a killed dispatch never anchors — the moves since the last real review stand past a dead row', () => {
    reviewed([full(ARMING.made.c), null]);

    assert.strictEqual(dispatch('review').id, 'review-003', 'the moves count from review-001, the last real review — not the reportless kill');
  });

  it('a corrupt store fails a dispatch loudly — mutations never run over garbage', () => {
    writeContent(dir, `.leeway/.cache/${UNIT}/discussion/${TOPIC}/state.json`, '{not json');
    assert.match(refusedReview(), /Corrupt agent state/);
  });

  it('a closing pass waits on no arming, and is stamped with the mark', () => {
    reviewed([last()]);

    const pass = dispatch('closing-pass');

    assert.deepStrictEqual([pass.id, markOf(pass.id)], ['closing-pass-001', last()]);
  });

  it('a closing pass that reported anchors the back-off — the moves it read arm no review once the topic reopens', () => {
    reviewed([full(ARMING.made.a)]);
    const pass = dispatch('closing-pass');
    writeContent(dir, pass.file, '# Closing Pass\n');

    assert.match(refusedReview(), /quiet — 0 of 1 moves since closing-pass-001/);
  });
});
