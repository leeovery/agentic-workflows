'use strict';

// Migration 051 — frontmatter state translated into the engine stores.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const migration = require('../../skills/workflow-migrate/scripts/migrations/051-frontmatter-state-to-stores.cjs');

let dir, updates, skips;
const hooks = () => ({ projectDir: dir, reportUpdate: () => updates++, reportSkip: () => skips++ });

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-051-'));
  updates = 0;
  skips = 0;
}
function teardown() {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function write(rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function writeManifest(wu, manifest) {
  write(`.workflows/${wu}/manifest.json`, JSON.stringify({
    name: wu, work_type: 'epic', status: 'in-progress', phases: {}, ...manifest,
  }, null, 2) + '\n');
}
function readManifest(wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}
function readStore(wu, phase, topic) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', '.cache', wu, phase, topic, 'state.json'), 'utf8'));
}

describe('migration 051 — frontmatter state to stores', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('translates agent cache files into colocated state.json rows', () => {
    writeManifest('pay', {});
    write('.workflows/.cache/pay/research/alpha/review-001.md', [
      '---', 'type: review', 'status: acknowledged', 'created: 2026-07-01T10:00:00.000Z', 'set: 001',
      'findings:', '  - id: F1', '  - id: F2', 'surfaced: [F1]', 'announced: true', '---', '', '# Report', '',
    ].join('\n'));
    write('.workflows/.cache/pay/investigation/pay/root-cause-validation-001.md',
      '---\ntype: root-cause-validation\nstatus: read\ncreated: 2026-07-02\n---\nverdict\n');
    write('.workflows/.cache/pay/investigation/pay/fix-options.md', 'no frontmatter draft\n');
    migration.run(hooks());
    assert.strictEqual(updates, 1);
    const research = readStore('pay', 'research', 'alpha').agents['review-001'];
    assert.strictEqual(research.status, 'acknowledged');
    assert.deepStrictEqual(research.findings, ['F1', 'F2']);
    assert.deepStrictEqual(research.surfaced, ['F1']);
    assert.strictEqual(research.announced, true);
    assert.strictEqual(research.created, '2026-07-01T10:00:00.000Z');
    const validation = readStore('pay', 'investigation', 'pay').agents['root-cause-validation-001'];
    assert.strictEqual(validation.status, 'incorporated', 'read maps to incorporated');
    assert.ok(!readStore('pay', 'investigation', 'pay').agents['fix-options'], 'drafts carry no state');
    assert.match(fs.readFileSync(path.join(dir, '.workflows', '.cache', 'pay', 'research', 'alpha', 'review-001.md'), 'utf8'),
      /type: review/, 'legacy frontmatter is left in place');
  });

  it('translates a deferred candidates file and leaves spent gates alone', () => {
    writeManifest('pay', {});
    write('.workflows/pay/.state/research-analysis-candidates.md', [
      '---', 'gate_mode: auto', '---', '',
      '## auth-flow', 'status: pending', 'summary: s', 'fanout_offer: pending', '',
      '## data-model', 'status: approved', 'summary: s', '',
    ].join('\n'));
    write('.workflows/pay/.state/discovery-gap-analysis-candidates.md', [
      '---', 'gate_mode: gated', '---', '', '## done-topic', 'status: approved', '',
    ].join('\n'));
    migration.run(hooks());
    const staged = readManifest('pay').phases.discovery.analysis_staging;
    assert.strictEqual(staged['research-analysis'].gate_mode, 'auto');
    assert.deepStrictEqual(staged['research-analysis'].candidates['auth-flow'], { status: 'pending', fanout_offer: 'pending' });
    assert.strictEqual(staged['research-analysis'].candidates['data-model'].status, 'approved');
    assert.ok(!staged['discovery-gap-analysis'], 'a gate with no pending candidates is spent — no state');
  });

  it('translates staging cycles for both loops and tracking flips for both phases', () => {
    writeManifest('pay', { phases: {
      review: { items: { alpha: { status: 'in-progress' } } },
      implementation: { items: { alpha: { status: 'in-progress' } } },
      planning: { items: { alpha: { status: 'completed' } } },
      specification: { items: { alpha: { status: 'completed' } } },
    } });
    write('.workflows/pay/implementation/alpha/review-tasks-c2.md', [
      '---', 'cycle: 2', 'gate_mode: auto', '---', '# Review Tasks',
      '## Task 1: fix', 'status: approved', '', '## Task 2: tidy', 'status: skipped', '',
    ].join('\n'));
    write('.workflows/pay/implementation/alpha/analysis-tasks-c1.md',
      '# Analysis Tasks\n## Task 1: dedupe\nstatus: pending\n');
    write('.workflows/pay/planning/alpha/review-traceability-tracking-c1.md',
      '---\nstatus: complete\n---\nfindings\n');
    write('.workflows/pay/specification/alpha/review-input-tracking-c1.md',
      '---\nstatus: in-progress\n---\nfindings\n');
    migration.run(hooks());
    const m = readManifest('pay');
    assert.deepStrictEqual(m.phases.review.items.alpha.staging.c2,
      { gate_mode: 'auto', tasks: { 1: 'approved', 2: 'skipped' } });
    assert.deepStrictEqual(m.phases.implementation.items.alpha.staging.c1, { tasks: { 1: 'pending' } });
    assert.strictEqual(m.phases.planning.items.alpha.tracking['review-traceability-tracking-c1'], 'complete');
    assert.strictEqual(m.phases.specification.items.alpha.tracking['review-input-tracking-c1'], 'in-progress');
  });

  it('relocates fix-tracking files to the committed implementation dir', () => {
    writeManifest('pay', {});
    write('.workflows/.cache/pay/implementation/alpha/fix-tracking-alpha-1-1.md', '## Attempt 1\nhistory\n');
    migration.run(hooks());
    const dest = path.join(dir, '.workflows', 'pay', 'implementation', 'alpha', 'fix-tracking-alpha-1-1.md');
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), '## Attempt 1\nhistory\n', 'content preserved');
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', '.cache', 'pay', 'implementation', 'alpha', 'fix-tracking-alpha-1-1.md')));
  });

  it('pins the real historical shapes: nested findings lists, lens labels, tensions, set fallbacks', () => {
    writeManifest('pay', {});
    write('.workflows/.cache/pay/research/alpha/review-001.md', [
      '---', 'type: review', 'status: pending', 'created: 2026-07-01', 'set: 001',
      'findings:', '  - id: F1', '    kind: unexplored', '    label: competitor pricing untouched',
      '  - id: F2', '    kind: assumption', '    label: latency budget unverified',
      'surfaced: []', 'announced: false', '---', 'body',
    ].join('\n'));
    write('.workflows/.cache/pay/discussion/beta/perspective-001-tail-risk.md',
      '---\ntype: perspective\nstatus: pending\ncreated: 2026-07-02\nset: 001\nlens: Tail-Risk\ndecision: store locality\n---\nargument');
    write('.workflows/.cache/pay/discussion/beta/synthesis-001.md', [
      '---', 'type: synthesis', 'status: acknowledged', 'created: 2026-07-03', 'set: 001',
      'decision: store locality', 'tensions: [T1, T2]', 'surfaced: [T1]', 'announced: true', '---', 'landscape',
    ].join('\n'));
    write('.workflows/.cache/pay/research/alpha/deep-dive-003-http-429-handling.md',
      '---\ntype: deep-dive\nstatus: pending\ncreated: 2026-07-04\nthread: OAuth token refresh - edge cases\nfindings: [F1]\nsurfaced: []\nannounced: false\n---\nreport');
    migration.run(hooks());
    const research = readStore('pay', 'research', 'alpha');
    assert.deepStrictEqual(research.agents['review-001'].findings, ['F1', 'F2'],
      'continuation lines never pollute the id list');
    assert.strictEqual(research.agents['deep-dive-003-http-429-handling'].set, '003',
      'set from the leftmost filename triple, not 429');
    const disc = readStore('pay', 'discussion', 'beta');
    assert.strictEqual(disc.agents['perspective-001-tail-risk'].label, 'Tail-Risk');
    assert.ok(!('decision' in disc.agents['perspective-001-tail-risk']), 'decision was write-only metadata');
    assert.deepStrictEqual(disc.agents['synthesis-001'].findings, ['T1', 'T2'], 'tensions become findings');
    assert.deepStrictEqual(disc.agents['synthesis-001'].surfaced, ['T1']);
  });

  it('edges: CRLF files parse; in-flight skeletons and dotted candidate names translate to nothing', () => {
    writeManifest('pay', { phases: { specification: { items: { alpha: { status: 'completed' } } } } });
    write('.workflows/pay/specification/alpha/review-input-tracking-c1.md',
      '---\r\nstatus: in-progress\r\n---\r\nfindings\r\n');
    write('.workflows/.cache/pay/research/alpha/review-001.md',
      '---\ntype: review\nstatus: in-flight\ncreated: 2026-07-01\nfindings: []\nsurfaced: []\nannounced: false\n---\n');
    write('.workflows/pay/.state/research-analysis-candidates.md', [
      '---', 'gate_mode: gated', '---', '', '## oauth2.0-scopes', 'status: pending', 'summary: s', '',
    ].join('\n'));
    migration.run(hooks());
    const m = readManifest('pay');
    assert.strictEqual(m.phases.specification.items.alpha.tracking['review-input-tracking-c1'], 'in-progress',
      'CRLF tracking file still translates');
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', '.cache', 'pay', 'research', 'alpha', 'state.json')),
      'a dead in-flight skeleton gets no row');
    assert.ok(!(m.phases.discovery && m.phases.discovery.analysis_staging),
      'dotted candidate names skip the file — fresh staging self-heals');
  });

  it('is idempotent — a second run changes nothing and skips', () => {
    writeManifest('pay', { phases: { review: { items: { alpha: { status: 'in-progress' } } } } });
    write('.workflows/.cache/pay/research/alpha/review-001.md',
      '---\ntype: review\nstatus: pending\ncreated: 2026-07-01\nfindings: []\nsurfaced: []\nannounced: false\n---\nbody\n');
    write('.workflows/pay/implementation/alpha/review-tasks-c1.md',
      '---\ngate_mode: gated\n---\n## Task 1: t\nstatus: pending\n');
    migration.run(hooks());
    assert.strictEqual(updates, 1);
    const before = JSON.stringify([readManifest('pay'), readStore('pay', 'research', 'alpha')]);
    migration.run(hooks());
    assert.strictEqual(skips, 1, 'second run reports skip');
    assert.strictEqual(JSON.stringify([readManifest('pay'), readStore('pay', 'research', 'alpha')]), before);
  });

  it('no-op projects skip; corrupt manifests and alien files are left alone', () => {
    migration.run(hooks());
    assert.strictEqual(skips, 1, 'no .workflows at all');
    setupAgain();
    writeManifest('clean', {});
    write('.workflows/broken/manifest.json', '{nope');
    write('.workflows/.cache/clean/research/alpha/notes.md', 'plain markdown, no frontmatter\n');
    write('.workflows/.cache/clean/research/alpha/review-001.md', '---\ntype: mystery\nstatus: pending\n---\n');
    migration.run(hooks());
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', '.cache', 'clean', 'research', 'alpha', 'state.json')),
      'unknown kinds and plain files translate to nothing');
  });
});

function setupAgain() {
  teardown();
  setup();
}
