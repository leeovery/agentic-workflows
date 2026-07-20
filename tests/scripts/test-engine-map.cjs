'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const os = require('os');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { addSubtopic, setSubtopicState, mapState, SUBTOPIC_STATES } = require('../../skills/workflow-engine/scripts/domain/map.cjs');
const { discussionMap } = require('../../skills/workflow-engine/scripts/domain/projections/discussion.cjs');
const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../../skills/workflow-engine/scripts/kernel/manifest.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
const ADAPTER = path.join(__dirname, '../../skills/workflow-discussion-process/scripts/discovery.cjs');

/** A manifest with one in-progress discussion item, optionally pre-seeded subtopics. */
function manifestWith(subtopics) {
  const item = { status: 'in-progress' };
  if (subtopics) item.subtopics = subtopics;
  return { name: 'auth', work_type: 'epic', phases: { discussion: { items: { 'auth-flow': item } } } };
}

describe('map domain: addSubtopic', () => {
  it('adds a pending top-level subtopic', () => {
    const m = manifestWith();
    const sub = addSubtopic(m, 'auth-flow', 'token-refresh');
    assert.deepStrictEqual(sub, { status: 'pending', parent: null });
    assert.deepStrictEqual(m.phases.discussion.items['auth-flow'].subtopics, {
      'token-refresh': { status: 'pending', parent: null },
    });
  });

  it('nests a child under a top-level parent', () => {
    const m = manifestWith();
    addSubtopic(m, 'auth-flow', 'token-refresh');
    const sub = addSubtopic(m, 'auth-flow', 'refresh-rotation', { parent: 'token-refresh' });
    assert.deepStrictEqual(sub, { status: 'pending', parent: 'token-refresh' });
  });

  it('throws when the discussion item does not exist', () => {
    const m = manifestWith();
    assert.throws(() => addSubtopic(m, 'nope', 'x'), /no discussion item "nope"/);
  });

  it('throws on a duplicate name', () => {
    const m = manifestWith({ 'token-refresh': { status: 'pending', parent: null } });
    assert.throws(() => addSubtopic(m, 'auth-flow', 'token-refresh'), /already exists/);
  });

  it('throws when the parent does not exist', () => {
    const m = manifestWith();
    assert.throws(() => addSubtopic(m, 'auth-flow', 'child', { parent: 'ghost' }), /parent subtopic "ghost" not found/);
  });

  it('throws when the parent is itself a child (two levels max)', () => {
    const m = manifestWith();
    addSubtopic(m, 'auth-flow', 'a');
    addSubtopic(m, 'auth-flow', 'b', { parent: 'a' });
    assert.throws(() => addSubtopic(m, 'auth-flow', 'c', { parent: 'b' }), /two levels max/);
  });

  it('throws on a non-kebab-case name', () => {
    const m = manifestWith();
    assert.throws(() => addSubtopic(m, 'auth-flow', 'Bad Name'), /kebab-case slug/);
    assert.throws(() => addSubtopic(m, 'auth-flow', ''), /kebab-case slug/);
  });
});

describe('map domain: setSubtopicState', () => {
  it('records any state from the enum, in any order', () => {
    const m = manifestWith({ a: { status: 'pending', parent: null } });
    for (const state of ['decided', 'exploring', 'deferred', 'converging', 'pending']) {
      assert.strictEqual(setSubtopicState(m, 'auth-flow', 'a', state).status, state);
    }
  });

  it('throws on a state outside the enum', () => {
    const m = manifestWith({ a: { status: 'pending', parent: null } });
    assert.throws(() => setSubtopicState(m, 'auth-flow', 'a', 'done'), /unknown subtopic state "done"/);
  });

  it('throws when the subtopic does not exist', () => {
    const m = manifestWith();
    assert.throws(() => setSubtopicState(m, 'auth-flow', 'ghost', 'decided'), /subtopic "ghost" not found/);
  });

  it('exports the full enum', () => {
    assert.deepStrictEqual(SUBTOPIC_STATES, ['pending', 'exploring', 'converging', 'decided', 'deferred']);
  });
});

describe('map domain: mapState', () => {
  it('derives counts, total, and unresolved in insertion order', () => {
    const m = manifestWith({
      a: { status: 'decided', parent: null },
      b: { status: 'exploring', parent: null },
      c: { status: 'pending', parent: 'b' },
      d: { status: 'deferred', parent: null },
      e: { status: 'converging', parent: null },
    });
    assert.deepStrictEqual(mapState(m, 'auth-flow'), {
      counts: { pending: 1, exploring: 1, converging: 1, decided: 1, deferred: 1 },
      total: 5,
      all_decided: false,
      unresolved: ['b', 'c', 'e'],
    });
  });

  it('all_decided is false with zero subtopics', () => {
    const state = mapState(manifestWith(), 'auth-flow');
    assert.strictEqual(state.total, 0);
    assert.strictEqual(state.all_decided, false);
    assert.deepStrictEqual(state.unresolved, []);
  });

  it('all_decided is true when every subtopic is decided or deferred', () => {
    const m = manifestWith({
      a: { status: 'decided', parent: null },
      b: { status: 'deferred', parent: null },
    });
    const state = mapState(m, 'auth-flow');
    assert.strictEqual(state.all_decided, true);
    assert.deepStrictEqual(state.unresolved, []);
  });

  it('throws on a corrupt subtopic state', () => {
    const m = manifestWith({ a: { status: 'finished', parent: null } });
    assert.throws(() => mapState(m, 'auth-flow'), /unknown state "finished"/);
  });
});

describe('discussion-map projection: golden renders', () => {
  it('mixed states with nesting and the deferred glyph', () => {
    const m = manifestWith({
      'subsystem-prefix-taxonomy': { status: 'decided', parent: null },
      'info-line-shape': { status: 'converging', parent: null },
      'field-order': { status: 'decided', parent: 'info-line-shape' },
      'truncation-rules': { status: 'exploring', parent: 'info-line-shape' },
      'context-preservation': { status: 'deferred', parent: null },
      'rollout-sequencing': { status: 'pending', parent: null },
    });
    assert.strictEqual(discussionMap('auth-flow', m), [
      '  Discussion Map — Auth Flow (6 subtopics — 2 decided · 1 converging · 1 exploring · 1 pending · 1 deferred)',
      '  ├─ ✓ Subsystem Prefix Taxonomy [decided]',
      '  ├─ → Info Line Shape [converging]',
      '  │  ├─ ✓ Field Order [decided]',
      '  │  └─ ◐ Truncation Rules [exploring]',
      '  ├─ ⊙ Context Preservation [deferred]',
      '  └─ ○ Rollout Sequencing [pending]',
      '',
    ].join('\n'));
  });

  it('omits the breakdown when only one category is non-zero', () => {
    const m = manifestWith({
      'one': { status: 'pending', parent: null },
      'two': { status: 'pending', parent: null },
    });
    assert.strictEqual(discussionMap('auth-flow', m), [
      '  Discussion Map — Auth Flow (2 subtopics)',
      '  ├─ ○ One [pending]',
      '  └─ ○ Two [pending]',
      '',
    ].join('\n'));
  });

  it('single subtopic — singular header, └─ row, no ┌─', () => {
    const m = manifestWith({ 'prefix-taxonomy': { status: 'pending', parent: null } });
    assert.strictEqual(discussionMap('auth-flow', m), [
      '  Discussion Map — Auth Flow (1 subtopic)',
      '  └─ ○ Prefix Taxonomy [pending]',
      '',
    ].join('\n'));
  });

  it('two categories — breakdown present, zero categories omitted', () => {
    const m = manifestWith({
      a: { status: 'decided', parent: null },
      b: { status: 'decided', parent: null },
      c: { status: 'exploring', parent: null },
    });
    assert.strictEqual(
      discussionMap('auth-flow', m).split('\n')[0],
      '  Discussion Map — Auth Flow (3 subtopics — 2 decided · 1 exploring)'
    );
  });

  it('zero subtopics — header only', () => {
    assert.strictEqual(discussionMap('auth-flow', manifestWith()), '  Discussion Map — Auth Flow (0 subtopics)\n');
  });
});

describe('kernel manifest IO', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('round-trips a manifest with a trailing newline', () => {
    createManifest(dir, 'auth', manifestWith());
    const m = loadWorkUnitManifest(dir, 'auth');
    m.phases.discussion.items['auth-flow'].subtopics = { a: { status: 'pending', parent: null } };
    saveWorkUnitManifest(dir, 'auth', m);
    const raw = fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8');
    assert.ok(raw.endsWith('}\n'));
    assert.deepStrictEqual(JSON.parse(raw), m);
  });

  it('throws a clear error when the manifest is missing', () => {
    assert.throws(() => loadWorkUnitManifest(dir, 'ghost'), /manifest not found/);
  });

  it('throws a clear error on invalid JSON', () => {
    fs.mkdirSync(path.join(dir, '.workflows', 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), '{nope');
    assert.throws(() => loadWorkUnitManifest(dir, 'broken'), /invalid JSON/);
  });
});

describe('engine CLI: map round-trip', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function engineMap(args) {
    return JSON.parse(execFileSync('node', [ENGINE, 'map', ...args], { cwd: dir, encoding: 'utf8' }).trim());
  }

  it('add → set, decision-ready JSON each step, manifest persisted', () => {
    createManifest(dir, 'auth', manifestWith());

    assert.deepStrictEqual(engineMap(['add', 'auth', 'auth-flow', 'token-refresh']), {
      ok: true, subtopic: 'token-refresh', status: 'pending', all_decided: false, unresolved_count: 1,
    });
    assert.deepStrictEqual(engineMap(['add', 'auth', 'auth-flow', 'refresh-rotation', '--parent', 'token-refresh']), {
      ok: true, subtopic: 'refresh-rotation', status: 'pending', all_decided: false, unresolved_count: 2,
    });
    assert.deepStrictEqual(engineMap(['set', 'auth', 'auth-flow', 'refresh-rotation', 'decided']), {
      ok: true, subtopic: 'refresh-rotation', status: 'decided', all_decided: false, unresolved_count: 1,
    });
    assert.deepStrictEqual(engineMap(['set', 'auth', 'auth-flow', 'token-refresh', 'deferred']), {
      ok: true, subtopic: 'token-refresh', status: 'deferred', all_decided: true, unresolved_count: 0,
    });

    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8'));
    assert.deepStrictEqual(saved.phases.discussion.items['auth-flow'].subtopics, {
      'token-refresh': { status: 'deferred', parent: null },
      'refresh-rotation': { status: 'decided', parent: 'token-refresh' },
    });
  });

  it('errors print {ok:false} JSON to stderr and exit 1, manifest untouched', () => {
    createManifest(dir, 'auth', manifestWith());
    const before = fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8');

    const res = spawnSync('node', [ENGINE, 'map', 'set', 'auth', 'auth-flow', 'ghost', 'decided'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.deepStrictEqual(JSON.parse(res.stderr.trim()), { ok: false, error: 'subtopic "ghost" not found under "auth-flow"' });

    const missing = spawnSync('node', [ENGINE, 'map', 'add', 'ghost-unit', 'auth-flow', 'x'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(missing.status, 1);
    assert.match(JSON.parse(missing.stderr.trim()).error, /manifest not found/);

    const usage = spawnSync('node', [ENGINE, 'map', 'add', 'auth'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(usage.status, 1);
    assert.match(JSON.parse(usage.stderr.trim()).error, /Usage: engine map add/);

    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8'), before);
  });
});

describe('engine CLI: map sequence', () => {
  // Hermetic git: no user/system config leaks into the engine's spawned git.
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';

  /** @param {string} dir @param {string[]} args */
  function git(dir, args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  }

  /** A temp-dir git repo holding one epic with a two-topic discovery map. */
  function setupGitFixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-seq-'));
    git(dir, ['init', '-q', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'auth-flow': { routing: 'discussion', source: 'discovery' },
            'session-model': { routing: 'research', source: 'discovery', order: 1 },
          },
        },
      },
    });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
    return dir;
  }

  function readManifest(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'));
  }

  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets every order, commits scoped with the sequence message, reports the assignment', () => {
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = JSON.parse(execFileSync('node', [ENGINE, 'map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' }).trim());

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.ordered, { 'auth-flow': 1, 'session-model': 2 });
    assert.strictEqual(res.committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'discovery(payments): sequence topic map');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    const items = readManifest(dir).phases.discovery.items;
    assert.strictEqual(items['auth-flow'].order, 1);
    assert.strictEqual(items['session-model'].order, 2);
  });

  it('re-applying the same orders is a no-op commit: committed null, note, exit 0', () => {
    execFileSync('node', [ENGINE, 'map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' });
    const res = JSON.parse(execFileSync('node', [ENGINE, 'map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' }).trim());
    assert.deepStrictEqual(res, { ok: true, ordered: { 'auth-flow': 1, 'session-model': 2 }, committed: null, note: 'nothing to commit' });
  });

  it('rejects unknown topics before writing anything', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8');
    const res = spawnSync('node', [ENGINE, 'map', 'sequence', 'payments', 'auth-flow=1', 'ghost=2'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.match(JSON.parse(res.stderr.trim()).error, /no discovery item "ghost"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'), before);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('rejects bad orders and malformed assignments — loud and specific', () => {
    for (const pair of ['auth-flow=0', 'auth-flow=-1', 'auth-flow=abc', 'auth-flow=1.5', 'auth-flow']) {
      const res = spawnSync('node', [ENGINE, 'map', 'sequence', 'payments', pair], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 1, pair);
      assert.match(JSON.parse(res.stderr.trim()).error, /bad assignment/, pair);
    }
    const dup = spawnSync('node', [ENGINE, 'map', 'sequence', 'payments', 'auth-flow=1', 'auth-flow=2'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(dup.stderr.trim()).error, /assigned twice/);
    const usage = spawnSync('node', [ENGINE, 'map', 'sequence', 'payments'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(usage.stderr.trim()).error, /Usage: engine map sequence/);
    const noMap = spawnSync('node', [ENGINE, 'map', 'sequence', 'ghost-unit', 'auth-flow=1'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(noMap.stderr.trim()).error, /manifest not found/);
  });
});

describe('discussion adapter: map verb', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('emits DATA (counts, all_decided, unresolved, review_cycles) and the DISPLAY block', () => {
    createManifest(dir, 'auth', manifestWith({
      'token-refresh': { status: 'exploring', parent: null },
      'session-storage': { status: 'decided', parent: null },
    }));
    const cacheDir = path.join(dir, '.workflows', '.cache', 'auth', 'discussion', 'auth-flow');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'review-001.md'), '');
    fs.writeFileSync(path.join(cacheDir, 'synthesis-001.md'), ''); // not a review cycle

    const out = execFileSync('node', [ADAPTER, 'map', 'auth', 'auth-flow'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out, [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'topic: auth-flow',
      'counts: {"pending":0,"exploring":1,"converging":0,"decided":1,"deferred":0}',
      'all_decided: false',
      'unresolved: ["token-refresh"]',
      'review_cycles: 1',
      '',
      '=== DISPLAY (emit verbatim as a code block) ===',
      '  Discussion Map — Auth Flow (2 subtopics — 1 decided · 1 exploring)',
      '  ├─ ◐ Token Refresh [exploring]',
      '  └─ ✓ Session Storage [decided]',
      '',
    ].join('\n'));
  });

  it('review_cycles is 0 when the cache directory does not exist', () => {
    createManifest(dir, 'auth', manifestWith());
    const out = execFileSync('node', [ADAPTER, 'map', 'auth', 'auth-flow'], { cwd: dir, encoding: 'utf8' });
    assert.match(out, /review_cycles: 0/);
  });
});
