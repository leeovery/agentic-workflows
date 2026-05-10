'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { discover, format } = require(
  path.resolve(__dirname, '..', '..', 'skills', 'workflow-inception-process', 'scripts', 'discovery.cjs')
);

let dir;

function setupFixture() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refinement-discovery-test-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
}

function cleanupFixture() {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
}

function seedEpic(workUnit, manifestExtras = {}) {
  const manifestDir = path.join(dir, '.workflows', workUnit);
  fs.mkdirSync(path.join(manifestDir, 'inception'), { recursive: true });
  const manifest = {
    name: workUnit,
    work_type: 'epic',
    status: 'in-progress',
    description: `Test: ${workUnit}`,
    phases: {},
    ...manifestExtras,
  };
  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  // Register in project manifest
  const projPath = path.join(dir, '.workflows', 'manifest.json');
  let proj = {};
  if (fs.existsSync(projPath)) {
    proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  }
  if (!proj.work_units) proj.work_units = {};
  proj.work_units[workUnit] = { work_type: 'epic' };
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2));
}

function writeSessionLog(workUnit, number, conclusionBody) {
  const padded = String(number).padStart(3, '0');
  const filename = `session-${padded}.md`;
  const fullPath = path.join(dir, '.workflows', workUnit, 'inception', filename);
  const title = number === 1 ? 'Initial Framing' : 'Refinement';
  const content = `# Inception Session ${padded} — ${title}

Date: 2026-05-10
Work unit: ${workUnit}

## Map State at Start

3 topics — 3 fresh

## Self-Healing Arrivals

(none)

## Changes

(none)

## Conclusion

${conclusionBody}
`;
  fs.writeFileSync(fullPath, content);
}

describe('refinement discovery: discovery_map', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('returns empty map for an epic with no inception items', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.discovery_map, []);
    assert.strictEqual(r.map_summary.total, 0);
  });

  it('builds map entries with lifecycle, tier, source, summary, routing', () => {
    seedEpic('payments', {
      phases: {
        inception: {
          items: {
            'auth-flow': { status: 'in-progress', summary: 'oauth + sessions', routing: 'research', source: 'inception' },
            'billing': { status: 'in-progress', summary: 'invoices', routing: 'discussion', source: 'inception' },
          },
        },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map.length, 2);
    const auth = r.discovery_map.find(t => t.name === 'auth-flow');
    assert.strictEqual(auth.lifecycle, 'fresh');
    assert.strictEqual(auth.tier, '○');
    assert.strictEqual(auth.routing, 'research');
    assert.strictEqual(auth.source, 'inception');
    assert.strictEqual(auth.summary, 'oauth + sessions');
  });

  it('reflects research in-progress lifecycle', () => {
    seedEpic('payments', {
      phases: {
        inception: { items: { 'auth-flow': { status: 'in-progress', routing: 'research', source: 'inception' } } },
        research:  { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'payments');
    const auth = r.discovery_map.find(t => t.name === 'auth-flow');
    assert.strictEqual(auth.lifecycle, 'researching');
    assert.strictEqual(auth.tier, '◐');
    assert.strictEqual(auth.current_phase, 'research');
  });

  it('sorts by tier rank then alphabetical within tier', () => {
    seedEpic('payments', {
      phases: {
        inception: {
          items: {
            'fresh-z': { status: 'in-progress', routing: 'research', source: 'inception' },
            'fresh-a': { status: 'in-progress', routing: 'research', source: 'inception' },
            'in-flight': { status: 'in-progress', routing: 'research', source: 'inception' },
          },
        },
        research: { items: { 'in-flight': { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.discovery_map.map(t => t.name), ['in-flight', 'fresh-a', 'fresh-z']);
  });

  it('computes map_summary counts from tier distribution', () => {
    seedEpic('payments', {
      phases: {
        inception: {
          items: {
            'a': { status: 'in-progress', routing: 'research', source: 'inception' },
            'b': { status: 'in-progress', routing: 'discussion', source: 'inception' },
            'c': { status: 'in-progress', routing: 'discussion', source: 'inception' },
          },
        },
        discussion: { items: { 'c': { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.map_summary.total, 3);
    assert.strictEqual(r.map_summary.fresh, 2);
    assert.strictEqual(r.map_summary.decided, 1);
  });
});

describe('refinement discovery: dismissed list', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('returns empty array when phases.inception.dismissed is missing', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.dismissed, []);
  });

  it('returns the dismissed list verbatim when present', () => {
    seedEpic('payments', {
      phases: {
        inception: {
          items: {},
          dismissed: ['old-thing', 'another'],
        },
      },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.dismissed, ['old-thing', 'another']);
  });
});

describe('refinement discovery: latest_session detection', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('returns null when no session logs exist', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.latest_session, null);
    assert.strictEqual(r.next_session_number, 1);
  });

  it('detects the initial session log without flagging it as in-progress refinement', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    writeSessionLog('payments', 1, '3 topics seeded.');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.latest_session.number, 1);
    assert.strictEqual(r.latest_session.is_refinement, false);
    assert.strictEqual(r.latest_session.is_in_progress, false);
    assert.strictEqual(r.next_session_number, 2);
  });

  it('flags an in-progress refinement when Conclusion is `(none)`', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    writeSessionLog('payments', 1, '3 topics seeded.');
    writeSessionLog('payments', 2, '(none)');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.latest_session.number, 2);
    assert.strictEqual(r.latest_session.is_refinement, true);
    assert.strictEqual(r.latest_session.is_in_progress, true);
  });

  it('does not flag a concluded refinement as in-progress', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    writeSessionLog('payments', 1, '3 topics seeded.');
    writeSessionLog('payments', 2, '2 changes applied. Map now has 5 topics.');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.latest_session.is_in_progress, false);
    assert.strictEqual(r.latest_session.conclusion_text, '2 changes applied. Map now has 5 topics.');
  });

  it('next_session_number always increments past the highest existing number', () => {
    seedEpic('payments', { phases: { inception: { items: {} } } });
    writeSessionLog('payments', 1, '3 topics seeded.');
    writeSessionLog('payments', 2, 'concluded');
    writeSessionLog('payments', 3, 'concluded');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.next_session_number, 4);
  });
});

describe('refinement discovery: error handling', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('returns an error when the work unit does not exist', () => {
    const r = discover(dir, 'nonexistent');
    assert.ok(r.error);
    assert.match(r.error, /not found/i);
  });
});

describe('refinement discovery: format()', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('produces parseable text output for a populated work unit', () => {
    seedEpic('payments', {
      phases: {
        inception: {
          items: {
            'auth-flow': { status: 'in-progress', summary: 'oauth', routing: 'research', source: 'inception' },
          },
          dismissed: ['old-topic'],
        },
      },
    });
    writeSessionLog('payments', 1, '1 topic seeded.');
    const r = discover(dir, 'payments');
    const out = format(r);
    assert.match(out, /=== INCEPTION DISCOVERY: payments ===/);
    assert.match(out, /map_summary: 1 topics/);
    assert.match(out, /auth-flow \[fresh\]/);
    assert.match(out, /dismissed \(1\):/);
    assert.match(out, /- old-topic/);
    assert.match(out, /next_session_number: 002/);
  });

  it('renders errors prefixed with `error:`', () => {
    const out = format({ error: 'Work unit "x" not found' });
    assert.match(out, /^error: Work unit "x" not found/);
  });
});
