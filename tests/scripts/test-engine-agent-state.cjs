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

function readStore(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', '.cache', wu, 'state.json'), 'utf8'));
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
    const store = readStore(dir, 'pay');
    assert.strictEqual(store.agents['research/alpha/review-001'].status, 'in-flight');
  });

  it('dispatch numbers past legacy files already in the cache dir', () => {
    writeContent(dir, '.workflows/.cache/pay/research/alpha/review-003.md', '---\nstatus: pending\n---\nlegacy');
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    assert.strictEqual(a.id, 'review-004', 'never collides with pre-programme files');
  });

  it('dispatch refuses unknown kind, phase, work unit, and bad labels', () => {
    assert.match(runFails(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'oracle']).error, /Invalid agent kind/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'cooking', 'alpha', '--kind', 'review']).error, /Invalid phase/);
    assert.match(runFails(dir, ['dispatch', 'ghost', 'research', 'alpha', '--kind', 'review']).error, /not found/);
    assert.match(runFails(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review', '--label', 'a/b']).error, /Invalid label/);
  });

  it('scan promotes in-flight to pending only once the content file exists with content', () => {
    const d = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    let scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.deepStrictEqual(scan.in_flight, ['review-001']);
    assert.strictEqual(scan.next, null, 'nothing actionable while the agent runs');

    fs.mkdirSync(path.dirname(path.join(dir, d.file)), { recursive: true });
    fs.writeFileSync(path.join(dir, d.file), '');
    scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.deepStrictEqual(scan.in_flight, ['review-001'], 'an empty file is not completion');

    writeContent(dir, d.file);
    scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.strictEqual(scan.pending[0].id, 'review-001');
    assert.deepStrictEqual(scan.next, { action: 'acknowledge', id: 'review-001' });
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
    const d = runJson(dir, ['dispatch', 'pay', 'discussion', 'alpha', '--kind', 'synthesis']);
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

  it('scan drives the surfacing protocol: surface-in-progress wins over new pending rows', () => {
    const a = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, a.file);
    runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    runJson(dir, ['ack', 'pay', 'research', 'alpha', 'review-001', '--findings', 'F1,F2']);
    runJson(dir, ['surface', 'pay', 'research', 'alpha', 'review-001', 'F1']);

    const b = runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    writeContent(dir, b.file);
    const scan = runJson(dir, ['scan', 'pay', 'research', 'alpha']);
    assert.deepStrictEqual(scan.next, { action: 'surface', id: 'review-001', finding: 'F2' },
      'finish raising what is mid-flight before acknowledging new reports');
    assert.strictEqual(scan.pending[0].id, 'review-002');
  });

  it('phase/topic isolation: rows never leak across addresses', () => {
    runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    runJson(dir, ['dispatch', 'pay', 'research', 'beta', '--kind', 'review']);
    const scan = runJson(dir, ['scan', 'pay', 'research', 'beta']);
    assert.deepStrictEqual(scan.in_flight, ['review-001'], 'beta sees only its own agent');
    assert.match(runFails(dir, ['ack', 'pay', 'research', 'beta', 'review-002', '--clean']).error, /No agent/);
  });

  it('corrupt store refuses loudly instead of resetting', () => {
    runJson(dir, ['dispatch', 'pay', 'research', 'alpha', '--kind', 'review']);
    fs.writeFileSync(path.join(dir, '.workflows', '.cache', 'pay', 'state.json'), '{nope');
    assert.match(runFails(dir, ['scan', 'pay', 'research', 'alpha']).error, /Corrupt agent state/);
  });
});
