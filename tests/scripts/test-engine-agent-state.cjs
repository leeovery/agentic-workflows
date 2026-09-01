'use strict';

// ---------------------------------------------------------------------------
// `engine agent` — the background-agent lifecycle store.
//
// Pins the state machine that replaced hand-edited cache frontmatter
// (design/analysis-state.md): dispatch allocates ids and records in-flight
// rows without creating files; the content file's existence is the
// completion signal scan promotes on; ack/announce/surface/incorporate walk
// a validated lifecycle with loud refusals off the legal path. Store is
// `.workflows/.cache/{wu}/state.json` — cache-resident, purged at close.
// ---------------------------------------------------------------------------

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

function run(dir, args) {
  return spawnSync('node', [ENGINE, 'agent', ...args], { cwd: dir, encoding: 'utf8' });
}

function runJson(dir, args) {
  const out = execFileSync('node', [ENGINE, 'agent', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.ok, true);
  return parsed;
}

function runFails(dir, args) {
  const res = run(dir, args);
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

/** Engine runner for non-`agent` verbs (topic absorb); first response line only. */
function engineJson(dir, args) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  const nl = out.indexOf('\n');
  const parsed = JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim());
  assert.strictEqual(parsed.ok, true);
  return parsed;
}

function engineFails(dir, args) {
  const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

function readStore(dir, wu, phase, topic) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', '.cache', wu, phase, topic, 'state.json'), 'utf8'));
}

function writeContent(dir, relFile, body = '# Findings\n\n## F1\n') {
  const full = path.join(dir, relFile);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

describe('engine agent — lifecycle store', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-state-'));
    const wuDir = path.join(dir, '.workflows', 'pay');
    fs.mkdirSync(wuDir, { recursive: true });
    fs.writeFileSync(path.join(wuDir, 'manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress', phases: {},
    }, null, 2));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('dispatch allocates sequential ids per kind, records in-flight, creates no file', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001');
    assert.strictEqual(a.file, '.workflows/.cache/pay/research/alpha/review-001.md');
    assert.ok(!fs.existsSync(path.join(dir, a.file)), 'no skeleton file');
    const b = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-002');
    const c = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(c.id, 'deep-dive-001-auth', 'kinds number independently, label suffixes');
    const store = readStore(dir, 'pay', 'research', 'alpha');
    assert.strictEqual(store.agents['review-001'].status, 'in-flight');
  });

  it('dispatch numbers past legacy files already in the cache dir', () => {
    writeContent(dir, '.workflows/.cache/pay/research/alpha/review-003.md', '---\nstatus: pending\n---\nlegacy');
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-004', 'never collides with pre-programme files');
  });

  it('numbering survives past 999 — ids and sets stay distinct at four digits', () => {
    writeContent(dir, '.workflows/.cache/pay/research/alpha/review-999.md', 'legacy');
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-1000');
    writeContent(dir, `.workflows/.cache/pay/research/alpha/${a.id}.md`);
    const scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.ok(scan.pending.some((r) => r.id === 'review-1000'), 'the four-digit row promotes like any other');
    const b = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-1001', 'allocation reads the four-digit id, not a truncation');
  });

  it('dispatch refuses unknown kind, phase, work unit, and bad labels', () => {
    assert.match(runFails(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'oracle']).error, /Invalid agent kind/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'cooking', 'alpha', '--kind', 'review']).error, /Invalid phase/);
    assert.match(runFails(dir, ['dispatch', 'ghost', 'research', 'alpha', '--kind', 'review']).error, /not found/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review', '--label', 'a/b']).error, /Invalid label/);
  });

  it('review dispatch refuses while the triage queue holds entries, clears when it drains', () => {
    writeContent(dir, '.workflows/pay/discussion/.triage/alpha/001-parked.md', '### Parked\n');
    const err = runFails(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']).error;
    assert.match(err, /review dispatch blocked: 1 rerouted concern/);
    assert.match(err, /topic absorb/, 'the refusal names the recovery path');
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.cache/pay/discussion/alpha/state.json')), 'nothing recorded');
    fs.unlinkSync(path.join(dir, '.workflows/pay/discussion/.triage/alpha/001-parked.md'));
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001', 'a drained queue dispatches normally');
  });

  it('the triage guard holds review dispatches only — other kinds pass a full queue', () => {
    writeContent(dir, '.workflows/pay/research/.triage/alpha/001-parked.md', '### Parked\n');
    const dive = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(dive.id, 'deep-dive-001-auth');
    assert.match(runFails(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']).error, /review dispatch blocked/);
    // Non-.md dirt (editor swap files, .DS_Store) and non-file entries never
    // count as queued concerns — only what queueStatus itself would count.
    fs.unlinkSync(path.join(dir, '.workflows/pay/research/.triage/alpha/001-parked.md'));
    writeContent(dir, '.workflows/pay/research/.triage/alpha/.DS_Store', 'dirt');
    fs.mkdirSync(path.join(dir, '.workflows/pay/research/.triage/alpha/nested.md'), { recursive: true });
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001');
  });

  it('scan promotes in-flight to pending only once the content file exists with content', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    let scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['review-001']);
    assert.ok(scan.in_flight[0].created, 'in-flight rows carry created for the earlier-session judgment');

    fs.mkdirSync(path.dirname(path.join(dir, d.file)), { recursive: true });
    fs.writeFileSync(path.join(dir, d.file), '');
    scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['review-001'], 'an empty file is not completion');

    writeContent(dir, d.file);
    scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.strictEqual(scan.pending[0].id, 'review-001');
  });

  it('ack records findings and moves to acknowledged; --clean incorporates immediately', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    const acked = runJson(dir, ['ack', 'pay', 'research', 'alpha', 'review-001', '--findings', 'F1,F2']);
    assert.strictEqual(acked.status, 'acknowledged');
    assert.deepStrictEqual(acked.remaining, ['F1', 'F2']);

    const e = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, e.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    const clean = runJson(dir, ['ack', 'pay', 'research', 'alpha', 'review-002', '--clean']);
    assert.strictEqual(clean.status, 'incorporated', 'a clean report needs no surfacing');
  });

  it('ack refuses off the legal path: in-flight rows, duplicates, missing rows, both/neither flag', () => {
    runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.match(runFails(dir, ['ack', 'pay', 'research', 'alpha', 'review-001', '--clean']).error,
      /is in-flight — only a pending row/);
    assert.match(runFails(dir, ['ack', 'pay', 'research', 'alpha', 'ghost-001', '--clean']).error,
      /No agent "ghost-001".*Known agents there: review-001/);
    assert.match(runFails(dir, ['ack', 'pay', 'research', 'alpha', 'review-001']).error, /Usage/);
    assert.match(runFails(dir, ['ack', 'pay', 'research', 'alpha', 'review-001', '--findings', 'F1,F1']).error,
      /duplicate/);
  });

  it('surface walks the findings; the last one incorporates the row; refusals are loud', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'a', '--label', 'b']);
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
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    runJson(dir, ['ack', 'pay', 'research', 'alpha', d.id, '--findings', 'F1,F2,F3,F4']);

    const b = runJson(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F1,F3']);
    assert.deepStrictEqual(b.surfaced, ['F1', 'F3']);
    assert.deepStrictEqual(b.remaining, ['F2', 'F4']);
    assert.strictEqual(b.status, 'acknowledged');

    // A bad entry fails the batch whole — the good ids in it stay unsurfaced.
    assert.match(runFails(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F2,F9']).error, /no finding "F9"/);
    assert.match(runFails(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F2,F1']).error, /already surfaced/);
    assert.match(runFails(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F2,F2']).error, /duplicate ids/);
    assert.match(runFails(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F2,']).error, /no empty entries/);
    assert.deepStrictEqual(runJson(dir, ['scan', 'pay', 'research', 'alpha']).acknowledged[0].remaining, ['F2', 'F4'],
      'a refused batch records nothing');

    const last = runJson(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F2, F4']);
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

  it('synthesis joins its landed set — required, complete, one live per set, name unoccupied', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'a', '--label', 'b']);
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
    writeContent(dir, '.workflows/.cache/pay/discussion/beta/synthesis-001.md', 'stale legacy report');
    const p2 = runJson(dir, ['dispatch', 'pay', 'discussion', 'beta', '--kind', 'perspective', '--label', 'x', '--label', 'y']);
    for (const a of p2.agents) writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'beta']);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'beta', '--kind', 'synthesis', '--set', p2.set]).error,
      /legacy file/, 'a dead session file never becomes this council synthesis');
  });

  it('perspectives are never acknowledged, and sit alongside a mid-drain review', () => {
    const pair = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'a', '--label', 'b']);
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
    runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    runJson(dir, ['dispatch', 'pay', 'research', 'beta', '--kind', 'review']);
    fs.rmSync(path.join(dir, '.workflows', '.cache', 'pay', 'research', 'alpha'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    assert.deepStrictEqual(runJson(dir, ['scan', 'pay', 'research', 'alpha']).in_flight, [],
      'the restart rm -rf removes rows with the content');
    assert.deepStrictEqual(runJson(dir, ['scan', 'pay', 'research', 'beta']).in_flight.map((r) => r.id), ['review-001'],
      'the sibling topic is untouched');
    const fresh = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(fresh.id, 'review-001', 'a cleansed topic restarts its numbering');
  });

  it('a pending perspective and a pending review are both listed, kinds intact', () => {
    const p = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'lens']);
    writeContent(dir, p.file);
    const r = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    writeContent(dir, r.file);
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(scan.pending.length, 2, 'both rows listed for set checks');
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ x) => x.kind), ['perspective', 'review'],
      'the reading flow filters by kind — the store lists both');
  });

  it('rows expose set and created; incorporated rows come back whole', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    runJson(dir, ['ack', 'pay', 'research', 'alpha', d.id, '--clean']);
    const scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    const row = scan.incorporated[0];
    assert.strictEqual(row.id, 'review-001');
    assert.strictEqual(row.set, '001');
    assert.ok(typeof row.created === 'string' && row.created.length > 0,
      'created rides every row for freshness checks');
  });

  it('incorporate closes from any live state: pending set-members and abandoned in-flight rows', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'tail-risk']);
    writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'discussion', 'alpha']);
    const consumed = runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', a.id]);
    assert.strictEqual(consumed.status, 'incorporated', 'pending row consumed without surfacing');

    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'review']);
    const abandoned = runJson(dir, ['incorporate', 'pay', 'discussion', 'alpha', b.id]);
    assert.strictEqual(abandoned.status, 'incorporated', 'stale in-flight row abandoned');
    assert.match(runFails(dir, ['incorporate', 'pay', 'discussion', 'alpha', b.id]).error, /already incorporated/);
  });

  it('incorporate is the skip-all exit and keeps the unsurfaced record honest', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'deep-dive', '--label', 'perf']);
    writeContent(dir, d.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    runJson(dir, ['ack', 'pay', 'research', 'alpha', d.id, '--findings', 'F1,F2,F3']);
    runJson(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F1']);
    const done = runJson(dir, ['incorporate', 'pay', 'research', 'alpha', d.id]);
    assert.strictEqual(done.status, 'incorporated');
    assert.deepStrictEqual(done.remaining, ['F2', 'F3'], 'declined findings stay recorded as never raised');
  });

  it('a mid-drain row and a fresh report coexist: remaining and pending both stand', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    runJson(dir, ['ack', 'pay', 'research', 'alpha', 'review-001', '--findings', 'F1,F2']);
    runJson(dir, ['surface', 'pay', 'research', 'alpha', 'review-001', 'F1']);

    const b = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, b.file);
    const scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.deepStrictEqual(scan.acknowledged[0].remaining, ['F2'], 'the mid-drain row keeps F2 owed');
    assert.strictEqual(scan.pending[0].id, 'review-002');
  });

  it('phase/topic isolation: rows never leak across addresses', () => {
    runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    runJson(dir, ['dispatch', 'pay', 'research', 'beta', '--kind', 'review']);
    const scan = runJson(dir, ['scan', 'pay', 'research', 'beta']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['review-001'], 'beta sees only its own agent');
    assert.match(runFails(dir, ['ack', 'pay', 'research', 'beta', 'review-002', '--clean']).error, /No agent/);
  });

  it('corrupt store refuses loudly instead of resetting', () => {
    runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    fs.writeFileSync(path.join(dir, '.workflows', '.cache', 'pay', 'research', 'alpha', 'state.json'), '{nope');
    assert.match(runFails(dir, ['scan', 'pay', 'research', 'alpha']).error, /Corrupt agent state/);
  });

  it('a row whose findings or surfaced is not an array refuses loudly, never a TypeError', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    const storeFile = path.join(dir, '.workflows', '.cache', 'pay', 'research', 'alpha', 'state.json');
    const state = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    state.agents[d.id].status = 'acknowledged';
    state.agents[d.id].findings = 'F1';
    fs.writeFileSync(storeFile, JSON.stringify(state));
    assert.match(runFails(dir, ['scan', 'pay', 'research', 'alpha']).error, /not a valid agent row/);
    state.agents[d.id].findings = ['F1'];
    state.agents[d.id].surfaced = 'F1';
    fs.writeFileSync(storeFile, JSON.stringify(state));
    assert.match(runFails(dir, ['surface', 'pay', 'research', 'alpha', d.id, 'F1']).error, /not a valid agent row/);
  });

  it('every verb refuses a traversal topic — dispatch and ack included', () => {
    for (const topic of ['../../../escape', 'a/b', '..', '.', '']) {
      // '' is refused one layer up, at the CLI's usage check — still a refusal.
      assert.match(runFails(dir, ['dispatch', 'pay', 'research', topic, '--kind', 'review']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['ack', 'pay', 'research', topic, 'review-001', '--clean']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['scan', 'pay', 'research', topic]).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['announce', 'pay', 'research', topic, 'review-001']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['surface', 'pay', 'research', topic, 'review-001', 'F1']).error, /Invalid topic|Usage:/);
      assert.match(runFails(dir, ['incorporate', 'pay', 'research', topic, 'review-001']).error, /Invalid topic|Usage:/);
    }
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', 'escape')), false);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', '.cache', 'pay', 'research', 'a')), false);
  });

  it('synthesis recovery re-dispatch discards the dead row\'s stale report', () => {
    runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'perspective', '--label', 'a', '--label', 'b']);
    writeContent(dir, '.workflows/.cache/pay/discussion/alpha/perspective-001-a.md');
    writeContent(dir, '.workflows/.cache/pay/discussion/alpha/perspective-001-b.md');
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

describe('engine agent — discussion review arming', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-arming-'));
    const wuDir = path.join(dir, '.workflows', 'pay');
    fs.mkdirSync(wuDir, { recursive: true });
    writeMap({ tokens: 'exploring' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  /** @param {Record<string, string>} statuses */
  function writeMap(statuses) {
    const subtopics = Object.fromEntries(Object.entries(statuses)
      .map(([name, status]) => [name, { status, parent: null }]));
    fs.writeFileSync(path.join(dir, '.workflows', 'pay', 'manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress',
      phases: { discussion: { items: { auth: { status: 'in-progress', subtopics } } } },
    }, null, 2));
  }

  /** Land the report and drain the row — a completed cycle. @param {{id: string, file: string}} d */
  function completeCycle(d) {
    writeContent(dir, d.file, '# Findings\n');
    runJson(dir, ['scan', 'pay', 'discussion', 'auth']);
    runJson(dir, ['ack', 'pay', 'discussion', 'auth', d.id, '--clean']);
  }

  it('the first review is free and stamps the map snapshot', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-001');
    const store = readStore(dir, 'pay', 'discussion', 'auth');
    assert.deepStrictEqual(store.agents['review-001'].map_snapshot, { tokens: 'exploring' });
  });

  it('a second review refuses at zero movement, then arms on one forward move', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    const err = runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error;
    assert.match(err, /review dispatch blocked/);
    assert.match(err, /0 of 1 map moves since review-001/);
    assert.match(err, /--final/, 'the refusal names the closing pass\'s bypass');
    writeMap({ tokens: 'decided' });
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-002');
    assert.deepStrictEqual(readStore(dir, 'pay', 'discussion', 'auth').agents['review-002'].map_snapshot,
      { tokens: 'decided' }, 'the new row snapshots the moved map');
  });

  it('subtopic additions count as movement', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    writeMap({ tokens: 'exploring', refresh: 'pending' });
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-002');
  });

  it('a backward move never arms', () => {
    writeMap({ tokens: 'decided' });
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    writeMap({ tokens: 'exploring' });
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error,
      /0 of 1 map moves/, 'unwinding a decision is not new ground');
  });

  it('the requirement escalates per completed cycle and caps at 3', () => {
    for (let i = 0; i < 4; i += 1) {
      completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review', '--final']));
    }
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error,
      /0 of 3 map moves since review-004/, 'four cycles in, the bar holds at the cap');
    writeMap({ tokens: 'decided', refresh: 'pending', expiry: 'pending' });
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-005', 'three fresh moves re-arm however many cycles have run');
  });

  it('--final bypasses the movement gate and still stamps the snapshot', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review', '--final']);
    assert.strictEqual(b.id, 'review-002');
    assert.deepStrictEqual(readStore(dir, 'pay', 'discussion', 'auth').agents['review-002'].map_snapshot,
      { tokens: 'exploring' });
  });

  it('rows predating the snapshot arm permissively once', () => {
    fs.mkdirSync(path.join(dir, '.workflows', '.cache', 'pay', 'discussion', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.cache', 'pay', 'discussion', 'auth', 'state.json'), JSON.stringify({
      agents: { 'review-001': { id: 'review-001', kind: 'review', phase: 'discussion', topic: 'auth', set: '001', status: 'incorporated', announced: false, findings: ['F1'], surfaced: ['F1'], created: '2026-08-01T00:00:00.000Z' } },
    }));
    const b = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-002', 'a pre-upgrade history never wedges the topic');
    assert.ok(readStore(dir, 'pay', 'discussion', 'auth').agents['review-002'].map_snapshot,
      'the dispatch stamps the snapshot that engages the damping');
  });

  it('scan answers the arming verdict on discussion topics only', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    const scan = runJson(dir, ['scan', 'pay', 'discussion', 'auth']);
    assert.deepStrictEqual(scan.review_arming, {
      armed: false, cycles: 1, map_moves_seen: 0, map_moves_needed: 1,
      reason: 'quiet — 0 of 1 map moves since review-001',
    });
    assert.strictEqual(runJson(dir, ['scan', 'pay', 'research', 'auth']).review_arming, undefined,
      'research has no map to measure');
  });

  it('research reviews never take the movement gate', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'auth', '--kind', 'review']);
    writeContent(dir, a.file, '# Findings\n');
    runJson(dir, ['scan', 'pay', 'research', 'auth']);
    runJson(dir, ['ack', 'pay', 'research', 'auth', a.id, '--clean']);
    const b = runJson(dir, ['dispatch', 'pay', 'research', 'auth', '--kind', 'review']);
    assert.strictEqual(b.id, 'review-002', 'no refusal, cycles notwithstanding');
    assert.strictEqual(readStore(dir, 'pay', 'research', 'auth').agents['review-002'].map_snapshot, undefined,
      'no snapshot outside discussion');
  });

  it('--final is refused outside a discussion review, like --set off its kind', () => {
    assert.match(runFails(dir, ['dispatch', 'pay', 'research', 'auth', '--kind', 'review', '--final']).error,
      /--final bypasses a discussion review's movement gate/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'deep-dive', '--label', 'scope', '--final']).error,
      /legal only with --kind review in the discussion phase/);
  });

  it('the middle rung holds: two cycles demand two moves', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    writeMap({ tokens: 'decided' });
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    writeMap({ tokens: 'decided', refresh: 'pending' });
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error,
      /1 of 2 map moves since review-002/);
    writeMap({ tokens: 'decided', refresh: 'pending', expiry: 'pending' });
    assert.strictEqual(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).id, 'review-003');
  });

  it('the conclusion\'s deferral sweep is bookkeeping, never movement', () => {
    writeMap({ tokens: 'exploring', refresh: 'pending' });
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    writeMap({ tokens: 'deferred', refresh: 'deferred' });
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error,
      /0 of 1 map moves/, 'parking every thread arms nothing');
    writeMap({ tokens: 'deferred', refresh: 'exploring' });
    assert.strictEqual(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).id, 'review-002',
      'reactivating a deferred thread is new ground and counts');
  });

  it('a killed dispatch never anchors — banked movement survives a dead row', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    writeMap({ tokens: 'decided' });
    const dead = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    runJson(dir, ['incorporate', 'pay', 'discussion', 'auth', dead.id]);
    const c = runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']);
    assert.strictEqual(c.id, 'review-003',
      'movement measures from review-001, the last real review — not the reportless kill');
  });

  it('a corrupt store fails a dispatch loudly — mutations never run over garbage', () => {
    fs.mkdirSync(path.join(dir, '.workflows', '.cache', 'pay', 'discussion', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.cache', 'pay', 'discussion', 'auth', 'state.json'), '{not json');
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error,
      /Corrupt agent state/);
  });

  it('SUBTOPIC_RANK covers the map\'s whole state vocabulary', () => {
    const { SUBTOPIC_RANK } = require('../../skills/workflow-engine/scripts/domain/agent-state.cjs');
    const { SUBTOPIC_STATES } = require('../../skills/workflow-engine/scripts/domain/discussion-map.cjs');
    assert.deepStrictEqual(Object.keys(SUBTOPIC_RANK).sort(), [...SUBTOPIC_STATES].sort(),
      'a state outside the rank map would silently score 0');
  });

  /** Queue one rerouted concern for discussion/auth. @param {string} name */
  function queueConcern(name) {
    writeContent(dir, `.workflows/pay/discussion/.triage/auth/${name}`,
      '### Ground\n*From: peer · discussion · 2026-09-01*\nbody\n');
  }

  it('a triage fold settles into the anchor — a drain-only sitting arms nothing', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    queueConcern('001-new-ground.md');
    writeMap({ tokens: 'exploring', 'new-ground': 'decided' });
    const res = engineJson(dir, ['topic', 'absorb', 'pay', 'discussion', 'auth',
      '--file', '001-new-ground.md', '--subtopic', 'new-ground',
      '-m', 'discussion(pay/auth): absorb 001-new-ground (from peer)']);
    assert.strictEqual(res.arming_settled, true);
    assert.strictEqual(res.remaining, 0);
    assert.deepStrictEqual(readStore(dir, 'pay', 'discussion', 'auth').agents['review-001'].map_snapshot,
      { tokens: 'exploring', 'new-ground': 'decided' }, 'the folded ground joins the anchor at its landed state');
    assert.match(runFails(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).error,
      /0 of 1 map moves/, 'the fold never counts as movement');
  });

  it('organic movement beside a fold still arms', () => {
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    queueConcern('001-new-ground.md');
    writeMap({ tokens: 'exploring', 'new-ground': 'decided', tangent: 'pending' });
    engineJson(dir, ['topic', 'absorb', 'pay', 'discussion', 'auth',
      '--file', '001-new-ground.md', '--subtopic', 'new-ground',
      '-m', 'discussion(pay/auth): absorb 001-new-ground (from peer)']);
    assert.strictEqual(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']).id,
      'review-002', 'the parked tangent is the session\'s own ground and measures');
  });

  it('a discussion absorb requires --subtopic; other phases refuse it', () => {
    queueConcern('001-new-ground.md');
    assert.match(engineFails(dir, ['topic', 'absorb', 'pay', 'discussion', 'auth',
      '--file', '001-new-ground.md', '-m', 'x']).error,
      /a discussion fold names its ground/);
    writeContent(dir, '.workflows/pay/research/.triage/auth/001-x.md', '### X\nbody\n');
    assert.match(engineFails(dir, ['topic', 'absorb', 'pay', 'research', 'auth',
      '--file', '001-x.md', '--subtopic', 'x', '-m', 'x']).error,
      /not legal in research/);
  });

  it('the settle is tolerant — no anchor and unknown ground absorb anyway', () => {
    queueConcern('001-new-ground.md');
    writeMap({ tokens: 'exploring', 'new-ground': 'decided' });
    const unanchored = engineJson(dir, ['topic', 'absorb', 'pay', 'discussion', 'auth',
      '--file', '001-new-ground.md', '--subtopic', 'new-ground', '-m', 'x']);
    assert.strictEqual(unanchored.arming_settled, false, 'no completed review, nothing to settle against');
    assert.match(unanchored.arming_note, /no anchored review/);
    completeCycle(runJson(dir, ['dispatch', 'pay', 'discussion', 'auth', '--kind', 'review']));
    queueConcern('002-typo.md');
    const unknown = engineJson(dir, ['topic', 'absorb', 'pay', 'discussion', 'auth',
      '--file', '002-typo.md', '--subtopic', 'not-a-subtopic', '-m', 'x']);
    assert.strictEqual(unknown.arming_settled, false);
    assert.match(unknown.arming_note, /not on the Discussion Map/);
  });
});
