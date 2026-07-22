'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

// Hermetic git: no user/system config leaks into fixtures or the engine's
// spawned git subprocesses.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** A temp-dir fixture that is a real git repo with a `.workflows/` tree. */
function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-tx-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function cleanupFixture(dir) {
  // Retries absorb the macOS teardown race (ENOTEMPTY while a just-exited
  // child's writes settle).
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function lastMessage(dir) {
  return git(dir, ['log', '-1', '--pretty=%s']).trim();
}

function shortHead(dir) {
  return git(dir, ['rev-parse', '--short', 'HEAD']).trim();
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  const nl = out.indexOf('\n');
  const res = JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim());
  engine.lastSections = nl === -1 ? '' : out.slice(nl + 1);
  return res;
}
engine.lastSections = '';

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(dir, args) {
  const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

/** An epic manifest with plural phase items and a discovery-map entry carrying `order`. */
function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'auth-flow': { routing: 'discussion', order: 2, source: 'discovery' } } },
      research: { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'completed' } } },
      discussion: { items: { 'session-model': { status: 'completed' }, 'refund-policy': { status: 'in-progress' } } },
    },
  };
}

function setupEpicFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine topic cancel', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('stashes status, cancels, drops the discovery order, commits — KB failure is a warning', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'research');
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, shortHead(dir));
    // No KB configured in the fixture — warn-don't-block: the cancel still
    // landed and the failure is reported, not thrown.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], {
      status: 'cancelled',
      previous_status: 'in-progress',
    });
    // `order` deleted; the rest of the map item preserved.
    assert.deepStrictEqual(m.phases.discovery.items['auth-flow'], {
      routing: 'discussion',
      source: 'discovery',
    });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel auth-flow (research)');
    assert.match(engine.lastSections, /Cancelled "Auth Flow" in research\./);
  });

  it('rejects cancelling an already-cancelled topic', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    const err = engineFails(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /already cancelled/);
  });

  it('rejects unknown work unit, phase, and topic — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'cancel', 'ghost', 'research', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'planning', 'auth-flow']).error, /no planning items/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments']).error, /Usage: engine topic cancel/);
  });
});

describe('engine topic reactivate', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('round-trips a cancel: status restored, previous_status removed, commit recorded', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.committed, shortHead(dir));
    // Restored to a non-completed status — no KB index attempted, no warnings.
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'in-progress' });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate auth-flow (research)');
  });

  it('re-indexes a completed topic in an indexed phase — KB failure is a warning', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discussion', 'session-model']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discussion', 'session-model']);

    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate session-model (discussion)');
    assert.match(engine.lastSections, /⚑ Knowledge indexing warning[\s\S]*Reactivated "Session Model" in discussion\. Status restored to completed\./);
  });

  it('rejects reactivating a non-cancelled topic', () => {
    const err = engineFails(dir, ['topic', 'reactivate', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /not cancelled \(status: in-progress\)/);
  });

  it('rejects a cancelled topic with no previous_status', () => {
    const m = epicManifest();
    m.phases.research.items['auth-flow'] = { status: 'cancelled' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const err = engineFails(dir, ['topic', 'reactivate', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /no previous_status/);
  });
});

describe('engine topic start', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('creates an absent phase item with status in-progress — init-phase semantics, no commit', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'investigation', status: 'in-progress', created: true });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items, { 'auth-flow': { status: 'in-progress' } });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('creates alongside existing items in a populated phase — siblings untouched', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'settlement']);

    assert.strictEqual(res.created, true);
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
      settlement: { status: 'in-progress' },
    });
  });

  it('resumes an existing in-progress item: created false, fields preserved', () => {
    const m0 = epicManifest();
    m0.phases.research.items['auth-flow'].note = 'keep me';
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'research', status: 'in-progress', created: false });
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'in-progress', note: 'keep me' });
  });

  it('rejects starting a completed item — reopen owns that path', () => {
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'fee-model']);
    assert.match(err.error, /already completed — reopen it instead/);
  });

  it('rejects starting a cancelled item — reactivate owns that path', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects starting a superseded item — supersession is terminal, superseded_by preserved', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is superseded \(by "fee-model"\) — supersession is terminal/);
    // start must NOT resurrect the item — that would leave superseded_by dangling
    // on an in-progress item, a state the render layer promises never to show.
    const item = readManifest(dir, 'payments').phases.research.items['auth-flow'];
    assert.strictEqual(item.status, 'superseded');
    assert.strictEqual(item.superseded_by, 'fee-model');
  });

  it('rejects unknown work unit, phase, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'start', 'ghost', 'research', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'research']).error, /Usage: engine topic start/);
    assert.match(engineFails(dir, ['topic', 'begin', 'payments', 'research', 'auth-flow']).error, /Usage: engine topic <start\|complete\|reopen\|supersede\|cancel\|reactivate>/);
  });
});

describe('engine topic complete', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('completes an indexed-phase item and KB-indexes it — failure is a warning, no commit', () => {
    const res = engine(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'research');
    assert.strictEqual(res.status, 'completed');
    // No KB configured in the fixture — warn-don't-block.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'completed' },
      'fee-model': { status: 'completed' },
    });
    // No commit inside.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('completes a non-indexed phase with no KB attempt — empty warnings', () => {
    const m0 = epicManifest();
    m0.phases.scoping = { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'in-progress' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'complete', 'payments', 'scoping', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'scoping', status: 'completed', warnings: [] });
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.scoping.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
    });
  });

  it('is idempotent on an already-completed item — mirrors the manifest set it replaces', () => {
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    const res = engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(res.status, 'completed');
  });

  it('rejects completing a non-existent item, unknown phase, and a cancelled item', () => {
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']).error, /no investigation items/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']).error, /is cancelled — reactivate it instead/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments']).error, /Usage: engine topic complete/);
  });

  it('rejects completing a superseded item — supersession is terminal, superseded_by preserved', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is superseded \(by "fee-model"\) — supersession is terminal/);
    // complete must NOT overwrite the terminal status and leave superseded_by
    // dangling on a completed item.
    const item = readManifest(dir, 'payments').phases.research.items['auth-flow'];
    assert.strictEqual(item.status, 'superseded');
    assert.strictEqual(item.superseded_by, 'fee-model');
  });

  it('round-trips with start: start → complete → resuming via start is still rejected', () => {
    engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);
    const res = engine(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.warnings.length, 1);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);
    assert.match(err.error, /already completed/);
  });
});

describe('engine topic reopen', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets a completed item back to in-progress — no KB attempt, no commit', () => {
    const res = engine(dir, ['topic', 'reopen', 'payments', 'research', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'research', status: 'in-progress' });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'in-progress' },
    });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('round-trips with complete: reopen → complete → reopen again', () => {
    engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'session-model']);
    const res = engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    assert.strictEqual(res.status, 'in-progress');
  });

  it('refuses an in-progress item — nothing touched', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is not completed \(status: in-progress\) — only a completed item can be reopened/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses a superseded item — supersession stays its own flow', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is not completed \(status: superseded\)/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses a cancelled item — reactivate owns that path', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discussion', 'session-model']);
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects unknown work unit, phase, missing item, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'reopen', 'ghost', 'research', 'fee-model']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'nonsense', 'fee-model']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'planning', 'fee-model']).error, /no planning items/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'research']).error, /Usage: engine topic reopen/);
  });
});

describe('engine topic supersede', () => {
  let dir;

  /** The epic manifest extended with specification items in every source status. */
  function specManifest() {
    const m = epicManifest();
    m.phases.specification = {
      items: {
        unified: { status: 'completed' },
        'auth-flow': { status: 'completed' },
        'fee-model': { status: 'in-progress' },
        'refund-policy': { status: 'proposed' },
        'session-model': { status: 'cancelled', previous_status: 'completed' },
      },
    };
    return m;
  }

  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(specManifest(), null, 2) + '\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('marks a spec source superseded with superseded_by the TOPIC, removes KB chunks, no commit', () => {
    const res = engine(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'unified']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'specification');
    assert.strictEqual(res.status, 'superseded');
    assert.strictEqual(res.superseded_by, 'unified');
    // No KB configured in the fixture — warn-don't-block.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.specification.items['auth-flow'], {
      status: 'superseded',
      superseded_by: 'unified',
    });
    // Batch-oriented: no commit inside — the calling flow commits the set.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('supersedes an in-progress source too — prose only excludes proposed', () => {
    const res = engine(dir, ['topic', 'supersede', 'payments', 'specification', 'fee-model', '--by', 'unified']);
    assert.strictEqual(res.status, 'superseded');
    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.specification.items['fee-model'].superseded_by, 'unified');
  });

  it('phase gating is schema-driven: research allows supersede, discussion refuses', () => {
    // research carries 'superseded' in the shared schema.
    const res = engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    assert.strictEqual(res.status, 'superseded');

    // discussion does not — refused with the schema's own vocabulary.
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'supersede', 'payments', 'discussion', 'session-model', '--by', 'refund-policy']);
    assert.match(err.error, /Invalid status "superseded" for phase "discussion"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses a missing item, a missing --by target, and self-supersession — nothing touched', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'ghost', '--by', 'unified']).error,
      /no specification item "ghost"/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'ghost']).error,
      /no specification item "ghost" to supersede toward — the absorbing item must exist first/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'auth-flow']).error,
      /cannot supersede itself/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses an already-superseded, proposed, or cancelled item', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'unified']);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'unified']).error,
      /already superseded \(by "unified"\)/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'refund-policy', '--by', 'unified']).error,
      /is proposed — a proposed item has no artifact to supersede/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'session-model', '--by', 'unified']).error,
      /is cancelled — reactivate it instead/);
  });

  it('rejects missing args and an unknown phase — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow']).error, /Usage: engine topic supersede/);
    assert.match(engineFails(dir, ['topic', 'supersede', 'payments', 'specification']).error, /Usage: engine topic supersede/);
    assert.match(engineFails(dir, ['topic', 'supersede', 'payments', 'nonsense', 'auth-flow', '--by', 'unified']).error, /unknown or non-lifecycle phase "nonsense"/);
  });
});

/** A single-topic feature manifest with completed indexed artifacts, an import, and imports on disk. */
function featureManifest() {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    imports: [
      { path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z' },
      { path: 'evil/../notes.md', imported_at: '2026-06-01T09:00:00Z' },
    ],
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-01T09:00:00Z' }],
    phases: {
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
      research: { items: { exploration: { status: 'completed' }, 'dead-end': { status: 'cancelled' } } },
      specification: { items: { 'auth-flow': { status: 'in-progress' } } },
    },
  };
}

function setupFeatureFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/auth-flow/manifest.json', JSON.stringify(featureManifest(), null, 2) + '\n');
  // The completed phase artifacts (bulk re-index discovers only files that
  // exist on disk).
  writeFile(dir, '.workflows/auth-flow/research/exploration.md', '# Exploration\n');
  writeFile(dir, '.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n');
  writeFile(dir, '.workflows/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(dir, '.workflows/auth-flow/seeds/seed.md', '# Seed\n');
  writeFile(dir, '.workflows/auth-flow/.state/research-analysis.md', '# Analysis\n');
  // Present but never indexed for a feature — discovery's session leg is
  // epic-only.
  writeFile(dir, '.workflows/auth-flow/discovery/sessions/session-001.md', '# Session 001\n');
  // A plain file where the knowledge store's directory belongs: the re-index
  // spawn fails deterministically (stub mode would otherwise index the existing
  // files successfully), so warn-don't-block is provable as a warning.
  writeFile(dir, '.workflows/.knowledge', 'not a directory\n');
  commitAll(dir, 'init');
  return dir;
}

/** A cross-cutting unit whose pipeline is finished (derived next phase `done`). */
function setupFinishedCrossCuttingFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/caching/manifest.json', JSON.stringify({
    name: 'caching',
    work_type: 'cross-cutting',
    status: 'in-progress',
    phases: {
      discussion: { items: { caching: { status: 'completed' } } },
      specification: { items: { caching: { status: 'completed' } } },
    },
  }, null, 2) + '\n');
  // The completed phase artifacts on disk, so the re-index bulk walk discovers
  // them (it skips artifacts whose files are absent).
  writeFile(dir, '.workflows/caching/discussion/caching.md', '# Discussion\n');
  writeFile(dir, '.workflows/caching/specification/caching/specification.md', '# Spec\n');
  // Deterministic KB failure: a plain file where the store directory belongs.
  writeFile(dir, '.workflows/.knowledge', 'not a directory\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine workunit complete', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets status completed, stamps completed_at today, commits with the given message', () => {
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');
    const res = engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);

    const today = new Date().toISOString().slice(0, 10);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.work_unit, 'auth-flow');
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.completed_at, today);
    assert.strictEqual(res.committed, shortHead(dir));
    // No KB action on complete — completed units retain their chunks.
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'completed');
    assert.strictEqual(m.completed_at, today);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): complete feature pipeline');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
    // Confirmation section rides after the JSON line; work_type now in the response.
    assert.strictEqual(res.work_type, 'feature');
    assert.match(engine.lastSections, /=== DISPLAY: confirmation \(emit verbatim as a code block after the response\) ===\n"Auth Flow" marked as completed\./);
  });

  it('--pipeline renders the "{Type} Completed" banner instead of the one-liner; --skipped-review varies the body', () => {
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline', '--pipeline']);
    assert.match(engine.lastSections, /Feature Completed\n\n"Auth Flow" has completed all pipeline phases\./);
    assert.ok(!engine.lastSections.includes('marked as completed'));

    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): re-complete (review skipped)', '--pipeline', '--skipped-review']);
    assert.match(engine.lastSections, /Feature Completed\n\n"Auth Flow" completed — review skipped\./);
  });

  it('reactivate carries its confirmation section', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    assert.match(engine.lastSections, /"Auth Flow" reactivated\./);
  });

  it('rejects an already-completed unit and routes a cancelled unit through reactivate', () => {
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): mark as completed']);
    assert.match(
      engineFails(dir, ['workunit', 'complete', 'auth-flow', '-m', 'again']).error,
      /already completed/);

    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    assert.match(
      engineFails(dir, ['workunit', 'complete', 'auth-flow', '-m', 'msg']).error,
      /is cancelled — reactivate it first/);
  });

  it('rejects a missing message, missing work unit, and unknown work unit', () => {
    assert.match(engineFails(dir, ['workunit', 'complete', 'auth-flow']).error, /Usage: engine workunit complete/);
    assert.match(engineFails(dir, ['workunit', 'complete', '-m', 'msg']).error, /Usage: engine workunit complete/);
    assert.match(engineFails(dir, ['workunit', 'complete', 'ghost', '-m', 'msg']).error, /manifest not found/);
    assert.match(engineFails(dir, ['workunit', 'finish', 'auth-flow']).error, /Usage: engine workunit <create\|complete\|cancel\|reactivate\|pivot\|absorb\|promote>/);
  });

  it('completes a cancelled unit with a finished pipeline directly, restoring its chunks', () => {
    // A cancelled finished pipeline completes directly (reactivate stays open
    // as the revisit path) — and cancellation removed the unit's chunks, so
    // the transition re-indexes them (warn-don't-block).
    const ccDir = setupFinishedCrossCuttingFixture();
    engine(ccDir, ['workunit', 'cancel', 'caching']);
    const res = engine(ccDir, ['workunit', 'complete', 'caching', '-m', 'workflow(caching): complete cross-cutting pipeline']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.committed, shortHead(ccDir));
    // Cancellation removed the unit's chunks; completion re-indexes them in ONE
    // scoped bulk spawn. No KB in the fixture, so that spawn fails → a single
    // warn-don't-block warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);

    const m = readManifest(ccDir, 'caching');
    assert.strictEqual(m.status, 'completed');
    assert.strictEqual(m.completed_at, new Date().toISOString().slice(0, 10));
    assert.strictEqual(lastMessage(ccDir), 'workflow(caching): complete cross-cutting pipeline');
    cleanupFixture(ccDir);
  });
});

describe('engine workunit cancel', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets status cancelled, removes KB chunks (failure is a warning), commits the fixed message', () => {
    const res = engine(dir, ['workunit', 'cancel', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, shortHead(dir));
    // No KB configured in the fixture — warn-don't-block: the cancellation
    // still landed and the failure is reported, not thrown.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'cancelled');
    assert.strictEqual(m.completed_at, undefined);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): mark as cancelled');
    // Sections: warning above confirmation, both after the JSON line.
    // Conventions-form callout: 2-space flag, 4-space continuations.
    assert.match(engine.lastSections, /  ⚑ Knowledge removal warning\n(    .+\n)+    The work unit is cancelled\./);
    assert.match(engine.lastSections, /"Auth Flow" marked as cancelled\./);
  });

  it('rejects an already-cancelled unit and routes a completed unit through reactivate', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    assert.match(engineFails(dir, ['workunit', 'cancel', 'auth-flow']).error, /already cancelled/);

    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): mark as completed']);
    assert.match(
      engineFails(dir, ['workunit', 'cancel', 'auth-flow']).error,
      /is completed — reactivate it first/);
  });

  it('rejects missing and unknown work units', () => {
    assert.match(engineFails(dir, ['workunit', 'cancel']).error, /Usage: engine workunit cancel/);
    assert.match(engineFails(dir, ['workunit', 'cancel', 'ghost']).error, /manifest not found/);
    assert.match(engineFails(dir, ['workunit', 'cancel', 'auth-flow', 'extra']).error, /Usage: engine workunit cancel/);
  });
});

describe('engine workunit reactivate', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('round-trips a complete: status restored, completed_at cleared, no KB attempt', () => {
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): mark as completed']);
    const res = engine(dir, ['workunit', 'reactivate', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'completed');
    assert.strictEqual(res.committed, shortHead(dir));
    // Completed units retained their chunks — no re-indexing, no warnings.
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'in-progress');
    assert.ok(!('completed_at' in m), 'stale completed_at must be cleared');
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): reactivate work unit');
  });

  it('re-indexes after a cancel in one scoped bulk spawn — failure is a warning', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    const res = engine(dir, ['workunit', 'reactivate', 'auth-flow']);

    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'cancelled');
    // Cancellation removed the unit's chunks; reactivation re-indexes them in a
    // SINGLE `knowledge index --work-unit` spawn (formerly one spawn per
    // artifact). The bulk walk covers the same set — completed phase artifacts,
    // shape-valid imports/seeds, analysis caches. No KB in the fixture, so the
    // spawn fails → one warn-don't-block warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): reactivate work unit');
  });

  it('epic reactivate re-indexes in one scoped bulk spawn (session logs in scope) — failure is a warning', () => {
    const epicDir = setupGitFixture();
    writeFile(epicDir, '.workflows/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: {
        discovery: { items: { 'auth-flow': { routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
      },
    }, null, 2) + '\n');
    writeFile(epicDir, '.workflows/payments/discussion/auth-flow.md', '# Discussion\n');
    writeFile(epicDir, '.workflows/payments/discovery/sessions/session-001.md', '# Session 001\n');
    writeFile(epicDir, '.workflows/payments/discovery/sessions/session-002.md', '# Session 002\n');
    writeFile(epicDir, '.workflows/payments/discovery/sessions/notes.txt', 'not a session log\n');
    // Deterministic KB failure: a plain file where the store directory belongs.
    writeFile(epicDir, '.workflows/.knowledge', 'not a directory\n');
    commitAll(epicDir, 'init');

    engine(epicDir, ['workunit', 'cancel', 'payments']);
    const res = engine(epicDir, ['workunit', 'reactivate', 'payments']);

    assert.strictEqual(res.status, 'in-progress');
    // The epic's re-index (completed discussion + the two session logs; the
    // non-matching file is excluded by discovery) collapses to one scoped bulk
    // spawn. Session-scoping itself is pinned by the discovery snapshot test;
    // here the barrier makes the single spawn fail → one warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);
    cleanupFixture(epicDir);
  });

  it('reactivates a completed unit whose pipeline is finished — the revisit path stays open', () => {
    // The unit surfaces as finalising (or in-progress once a topic is
    // reopened) — reactivate must not deadlock the reopen path.
    const ccDir = setupFinishedCrossCuttingFixture();
    engine(ccDir, ['workunit', 'complete', 'caching', '-m', 'workflow(caching): complete cross-cutting pipeline']);
    const res = engine(ccDir, ['workunit', 'reactivate', 'caching']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'completed');
    // Completed units retained their chunks — no re-indexing, no warnings.
    assert.deepStrictEqual(res.warnings, []);
    const m = readManifest(ccDir, 'caching');
    assert.strictEqual(m.status, 'in-progress');
    assert.ok(!('completed_at' in m), 'stale completed_at must be cleared');
    assert.strictEqual(lastMessage(ccDir), 'workflow(caching): reactivate work unit');
    cleanupFixture(ccDir);
  });

  it('reactivates a cancelled unit whose pipeline is finished — complete stays open as the other path', () => {
    const ccDir = setupFinishedCrossCuttingFixture();
    engine(ccDir, ['workunit', 'cancel', 'caching']);
    const res = engine(ccDir, ['workunit', 'reactivate', 'caching']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'cancelled');
    // Cancellation removed the unit's chunks — the cancelled reactivation
    // re-index runs as one scoped bulk spawn (no KB in the fixture: it fails,
    // one warn-don't-block warning).
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(readManifest(ccDir, 'caching').status, 'in-progress');
    cleanupFixture(ccDir);
  });

  it('rejects an in-progress unit and a status outside the shared vocabulary', () => {
    assert.match(engineFails(dir, ['workunit', 'reactivate', 'auth-flow']).error, /already in-progress/);

    const m = featureManifest();
    m.status = 'archived';
    writeFile(dir, '.workflows/auth-flow/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(
      engineFails(dir, ['workunit', 'reactivate', 'auth-flow']).error,
      /not completed or cancelled \(status: archived\)/);
  });
});

describe('engine inbox archive / restore / delete', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    writeFile(dir, '.workflows/.inbox/bugs/2026-06-02--login-loop.md', '# Login Loop\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('archives a single item — file moved to its source folder under .archived, slug commit message', () => {
    const res = engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.archived, ['.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive smart-retry');
  });

  it('archives a multi-item set in one commit with the N-items message form', () => {
    const res = engine(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/bugs/2026-06-02--login-loop.md',
    ]);

    assert.deepStrictEqual(res.archived, [
      '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/.archived/bugs/2026-06-02--login-loop.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/bugs/2026-06-02--login-loop.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive 2 items');
    // One commit for the whole set.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
  });

  it('restores an archived item back to its live folder', () => {
    engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'restore', '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.restored, ['.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): restore smart-retry');
  });

  it('deletes an archived item via git rm', () => {
    engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'delete', '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.deleted, ['.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): delete smart-retry');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '');
  });

  it('rejects invalid paths strictly, before anything moves', () => {
    // Outside the inbox entirely.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/payments/manifest.json']).error,
      /not a live inbox path/);
    // Unknown folder.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/notes/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Traversal.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/../../../etc/passwd.md']).error,
      /not a live inbox path|without ".."/);
    // Archived path passed to archive.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/.archived/ideas/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Live path passed to delete.
    assert.match(
      engineFails(dir, ['inbox', 'delete', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Live path passed to restore.
    assert.match(
      engineFails(dir, ['inbox', 'restore', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Missing file.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--ghost.md']).error,
      /not found/);
    // One bad path poisons the whole set — the good file did not move.
    engineFails(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/ideas/2026-06-01--ghost.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.match(engineFails(dir, ['inbox', 'archive']).error, /Usage: engine inbox/);
  });

  it('refuses a duplicate path in the set before any move — no half-applied state', () => {
    const err = engineFails(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
    ]);
    assert.match(err.error, /duplicate inbox path/);
    // The one real file never moved — the transaction refused up front.
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '');
  });
});

describe('engine commit', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-01--x.md', '# X\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('stages the work-unit scope and commits with the given message', () => {
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): document decision']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'discussion(payments/auth): document decision');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = engine(dir, ['commit', 'payments', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('--inbox commits the inbox scope', () => {
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-02--y.md', '# Y\n');
    const res = engine(dir, ['commit', '--inbox', '-m', 'workflow(inbox): capture y']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): capture y');
  });

  it('rejects a missing message, missing scope, and bad work unit names', () => {
    assert.match(engineFails(dir, ['commit', 'payments']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', 'payments', '--inbox', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '../escape', '-m', 'msg']).error, /invalid work unit name/);
    assert.match(engineFails(dir, ['commit', 'ghost', '-m', 'msg']).error, /no work unit directory/);
  });
});

describe('knowledge store rides along on every engine commit', () => {
  let dir;
  beforeEach(() => {
    dir = setupEpicFixture();
    writeFile(dir, '.workflows/.knowledge/store.msp', 'v1\n');
    commitAll(dir, 'store v1');
    // Transaction side effects (index/remove) dirty the store mid-flow —
    // simulated here since the fixture has no real knowledge CLI.
    writeFile(dir, '.workflows/.knowledge/store.msp', 'v2\n');
  });
  afterEach(() => { cleanupFixture(dir); });

  function committedFiles() {
    return git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
  }

  it('engine commit <wu> stages .workflows/.knowledge alongside the work unit', () => {
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): note']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), [
      '.workflows/.knowledge/store.msp',
      '.workflows/payments/discussion/auth.md',
    ]);
  });

  it('a transaction commit sweeps the store dirt its KB sync produced', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), [
      '.workflows/.knowledge/store.msp',
      '.workflows/payments/manifest.json',
    ]);
  });

  it('exists-guarded: no .knowledge directory, no pathspec, no git error', () => {
    fs.rmSync(path.join(dir, '.workflows/.knowledge'), { recursive: true, force: true });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'drop store']);
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): note']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), ['.workflows/payments/discussion/auth.md']);
  });
});

describe('schema enforcement: transitions refuse what the field surface refuses', () => {
  const { VALID_PHASE_STATUSES } = require('../../skills/workflow-engine/scripts/kernel/manifest-schema.cjs');

  it('discovery is not a lifecycle phase — start/complete/reopen/cancel all refuse', () => {
    const dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: { discovery: { items: { 'auth-flow': { routing: 'research' } } } },
    }, null, 2));
    for (const verb of ['start', 'complete', 'reopen', 'cancel']) {
      assert.match(
        engineFails(dir, ['topic', verb, 'payments', 'discovery', 'auth-flow']).error,
        /non-lifecycle phase "discovery"[\s\S]*discovery tooling/
      );
    }
    // the invalid state the live drive produced must now be impossible
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    assert.strictEqual(m.phases.discovery.items['auth-flow'].status, undefined);
    cleanupFixture(dir);
  });

  it('the enforcement table IS the kernel schema (shared module, no mirror)', () => {
    assert.deepStrictEqual(VALID_PHASE_STATUSES.discovery, []);  // map items carry no status — empty vocabulary refuses every write
    const src = fs.readFileSync(
      path.join(__dirname, '../../skills/workflow-engine/scripts/domain/transitions.cjs'), 'utf8');
    assert.ok(src.includes("require('../kernel/manifest-schema.cjs')"),
      'transitions must require the shared schema, not mirror it');
    assert.ok(!/VALID_PHASE_STATUSES\s*=\s*{/.test(src), 'no local copy of the status table');
  });
});

describe('engine usage banner', () => {
  it('lists every topic transition, reopen included', () => {
    const res = spawnSync('node', [ENGINE, 'bogus-command'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    for (const line of [
      'topic start <work-unit> <phase> <topic>',
      'topic complete <work-unit> <phase> <topic>',
      'topic reopen <work-unit> <phase> <topic>',
      'topic supersede <work-unit> <phase> <topic> --by <topic>',
      'topic cancel <work-unit> <phase> <topic>',
      'topic reactivate <work-unit> <phase> <topic>',
    ]) {
      assert.ok(res.stderr.includes(`  ${line}\n`), `usage banner missing "${line}"`);
    }
  });
});
