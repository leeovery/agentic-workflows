'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-discovery/scripts/discovery.cjs');

function writeSessionLog(dir, workUnit, number, conclusionBody, opts = {}) {
  const padded = String(number).padStart(3, '0');
  const filename = `session-${padded}.md`;
  const title = number === 1 ? 'Initial Framing' : 'Refinement';
  const trailing = opts.trailingSection ? `\n\n## ${opts.trailingSection}\n\nfoo\n` : '\n';
  const content = `# Discovery Session ${padded} — ${title}

Date: 2026-05-10
Work unit: ${workUnit}

## Map State at Start

3 topics — 3 fresh

## Topic Discovery Arrivals

(none)

## Changes

(none)

## Conclusion

${conclusionBody}${trailing}`;
  createFile(dir, `.workflows/${workUnit}/discovery/sessions/${filename}`, content);
}

describe('workflow-discovery discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // --- Error handling ---

  it('returns error for missing manifest', () => {
    const r = discover(dir, 'nonexistent');
    assert.ok(r.error);
    assert.match(r.error, /not found/i);
  });

  // --- Bare manifest shape ---

  it('returns work_unit verbatim', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.work_unit, 'payments');
  });

  it('returns empty discovery_map when no discovery phase exists', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: {} });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.discovery_map, []);
    assert.strictEqual(r.map_summary.total, 0);
  });

  it('returns empty discovery_map when discovery phase has no items', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: { discovery: {} } });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.discovery_map, []);
  });

  it('returns empty discovery_map when discovery items dict is empty', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: { discovery: { items: {} } } });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.discovery_map, []);
  });

  // --- discovery_map content ---

  it('builds map entry with all named fields', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'auth-flow': { status: 'in-progress', summary: 'oauth + sessions', description: 'two paragraphs of richer context', routing: 'research', source: 'discovery' },
          },
        },
      },
    });
    const r = discover(dir, 'payments');
    const t = r.discovery_map[0];
    assert.strictEqual(t.name, 'auth-flow');
    assert.strictEqual(t.summary, 'oauth + sessions');
    assert.strictEqual(t.description, 'two paragraphs of richer context');
    assert.strictEqual(t.routing, 'research');
    assert.strictEqual(t.source, 'discovery');
    assert.strictEqual(t.lifecycle, 'fresh');
    assert.strictEqual(t.tier, '○');
    assert.strictEqual(t.current_phase, null);
    assert.strictEqual(t.source_provenance, null);
  });

  it('defaults description to null when missing — legacy/migration-seeded item back-compat', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'migration-seeded' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].description, null);
  });

  it('defaults summary to null when missing', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].summary, null);
  });

  it('defaults routing to null when missing', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', source: 'discovery' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].routing, null);
  });

  it('defaults source to "discovery" when missing', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].source, 'discovery');
  });

  // --- Lifecycle reflection (one assertion per branch in computeTopicLifecycle) ---

  it('reflects fresh lifecycle when no research/discussion items exist', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'fresh');
    assert.strictEqual(r.discovery_map[0].tier, '○');
  });

  it('reflects researching lifecycle when research is in-progress', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } },
        research:  { items: { 'a': { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'researching');
    assert.strictEqual(r.discovery_map[0].tier, '◐');
    assert.strictEqual(r.discovery_map[0].current_phase, 'research');
  });

  it('reflects ready_for_discussion lifecycle when research is completed', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } },
        research:  { items: { 'a': { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'ready_for_discussion');
    assert.strictEqual(r.discovery_map[0].tier, '→');
    assert.strictEqual(r.discovery_map[0].current_phase, 'research');
  });

  it('reflects discussing lifecycle when discussion is in-progress', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery:  { items: { 'a': { status: 'in-progress', routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'a': { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'discussing');
    assert.strictEqual(r.discovery_map[0].tier, '◐');
    assert.strictEqual(r.discovery_map[0].current_phase, 'discussion');
  });

  it('reflects decided lifecycle when discussion is completed', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery:  { items: { 'a': { status: 'in-progress', routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'a': { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'decided');
    assert.strictEqual(r.discovery_map[0].tier, '✓');
    assert.strictEqual(r.discovery_map[0].current_phase, 'discussion');
  });

  it('reflects cancelled lifecycle when both research and discussion are cancelled', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery:  { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } },
        research:   { items: { 'a': { status: 'cancelled' } } },
        discussion: { items: { 'a': { status: 'cancelled' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'cancelled');
    assert.strictEqual(r.discovery_map[0].tier, '⊘');
  });

  it('falls through to fresh when only research is cancelled (alternate path open)', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } },
        research:  { items: { 'a': { status: 'cancelled' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'fresh');
  });

  it('reflects handled lifecycle when the discovery item carries the handled marker', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: { items: { umbrella: { status: 'in-progress', routing: 'research', source: 'discovery', handled: true } } },
        research:  { items: { umbrella: { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].lifecycle, 'handled');
    assert.strictEqual(r.discovery_map[0].tier, '⊙');
    assert.strictEqual(r.discovery_map[0].current_phase, null);
  });

  it('handled item counts in the handled bucket and is excluded from sequencing', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: { items: { umbrella: { status: 'in-progress', routing: 'research', source: 'discovery', handled: true, order: null } } },
        research:  { items: { umbrella: { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.map_summary.handled, 1);
    assert.strictEqual(r.needs_sequencing, false);
  });

  // --- source_provenance ---

  it('source_provenance is null for source=discovery', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].source_provenance, null);
  });

  it('source_provenance reads "from {source}" for non-discovery sources', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'research-analysis' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].source_provenance, 'from research-analysis');
  });

  it('source_provenance unwraps colon-prefixed sources to "from {parent}"', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'research-split:kitchen-hardware' } } } },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.discovery_map[0].source_provenance, 'from kitchen-hardware');
  });

  // --- Sorting ---

  it('sorts by tier rank → first, then ◐, ✓, ○, ⊘', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'fresh-item':    { status: 'in-progress', routing: 'research', source: 'discovery' },
            'inflight-item': { status: 'in-progress', routing: 'research', source: 'discovery' },
            'ready-item':    { status: 'in-progress', routing: 'research', source: 'discovery' },
            'decided-item':  { status: 'in-progress', routing: 'discussion', source: 'discovery' },
          },
        },
        research:   { items: { 'inflight-item': { status: 'in-progress' }, 'ready-item': { status: 'completed' } } },
        discussion: { items: { 'decided-item': { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(
      r.discovery_map.map(t => t.name),
      ['ready-item', 'inflight-item', 'decided-item', 'fresh-item'],
    );
  });

  it('sorts alphabetically within the same tier', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'zeta':  { status: 'in-progress', routing: 'research', source: 'discovery' },
            'alpha': { status: 'in-progress', routing: 'research', source: 'discovery' },
            'mu':    { status: 'in-progress', routing: 'research', source: 'discovery' },
          },
        },
      },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.discovery_map.map(t => t.name), ['alpha', 'mu', 'zeta']);
  });

  // --- map_summary ---

  it('map_summary aggregates counts across all tiers', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'fresh-1':    { status: 'in-progress', routing: 'research', source: 'discovery' },
            'fresh-2':    { status: 'in-progress', routing: 'discussion', source: 'discovery' },
            'inflight-1': { status: 'in-progress', routing: 'research', source: 'discovery' },
            'ready-1':    { status: 'in-progress', routing: 'research', source: 'discovery' },
            'decided-1':  { status: 'in-progress', routing: 'discussion', source: 'discovery' },
            'cancelled-1': { status: 'in-progress', routing: 'research', source: 'discovery' },
          },
        },
        research: {
          items: {
            'inflight-1': { status: 'in-progress' },
            'ready-1':    { status: 'completed' },
            'cancelled-1': { status: 'cancelled' },
          },
        },
        discussion: {
          items: {
            'decided-1':   { status: 'completed' },
            'cancelled-1': { status: 'cancelled' },
          },
        },
      },
    });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.map_summary.total, 6);
    assert.strictEqual(r.map_summary.fresh, 2);
    assert.strictEqual(r.map_summary.in_flight, 1);
    assert.strictEqual(r.map_summary.ready, 1);
    assert.strictEqual(r.map_summary.decided, 1);
    assert.strictEqual(r.map_summary.cancelled, 1);
  });

  it('map_summary returns all-zero shape when no discovery items exist', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: {} });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.map_summary, {
      total: 0, decided: 0, in_flight: 0, ready: 0, fresh: 0, handled: 0, cancelled: 0,
    });
  });

  // --- dismissed list ---

  it('returns empty array when phases.discovery.dismissed is missing', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: {} } },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.dismissed, []);
  });

  it('returns the dismissed list verbatim and in order', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: {}, dismissed: ['first', 'second', 'third'] } },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.dismissed, ['first', 'second', 'third']);
  });

  it('returns an empty array when dismissed is non-array (defensive)', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: {}, dismissed: 'invalid-shape' } },
    });
    const r = discover(dir, 'payments');
    assert.deepStrictEqual(r.dismissed, []);
  });

  it('does not mutate the manifest when reading dismissed', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: {}, dismissed: ['original'] } },
    });
    const r = discover(dir, 'payments');
    r.dismissed.push('mutation');
    const r2 = discover(dir, 'payments');
    assert.deepStrictEqual(r2.dismissed, ['original']);
  });

  // --- session-log scan (drives next_session_number) ---

  it('next_session_number ignores non-matching filenames in the sessions directory', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    writeSessionLog(dir, 'payments', 1, 'concluded');
    createFile(dir, '.workflows/payments/discovery/sessions/session-abc.md', 'should be ignored');
    createFile(dir, '.workflows/payments/discovery/sessions/notes.md', 'should be ignored');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.next_session_number, 2);
  });

  // --- analysis_caches ---

  describe('analysis_caches', () => {
    it('returns absent statuses when no research and no discussion files exist', () => {
      createManifest(dir, 'payments', { work_type: 'epic' });
      const r = discover(dir, 'payments');
      assert.strictEqual(r.analysis_caches.research_analysis.status, 'absent');
      assert.strictEqual(r.analysis_caches.gap_analysis.status, 'absent');
    });

    it('returns stale for research-analysis when completed items exist but no cache', () => {
      createManifest(dir, 'payments', {
        work_type: 'epic',
        phases: { research: { items: { 'topic-a': { status: 'completed' } } } },
      });
      createFile(dir, '.workflows/payments/research/topic-a.md', 'content');
      const r = discover(dir, 'payments');
      assert.strictEqual(r.analysis_caches.research_analysis.status, 'stale');
    });

    it('returns valid for research-analysis when checksum matches', () => {
      createFile(dir, '.workflows/payments/research/topic-a.md', 'content-x');
      const crypto = require('crypto');
      const buf = fs.readFileSync(path.join(dir, '.workflows/payments/research/topic-a.md'));
      const checksum = crypto.createHash('md5').update(buf).digest('hex');
      createManifest(dir, 'payments', {
        work_type: 'epic',
        phases: {
          research: {
            items: { 'topic-a': { status: 'completed' } },
            analysis_cache: { checksum, generated: '2026-05-01', files: ['topic-a.md'] },
          },
        },
      });
      const r = discover(dir, 'payments');
      assert.strictEqual(r.analysis_caches.research_analysis.status, 'valid');
      assert.strictEqual(r.analysis_caches.research_analysis.generated, '2026-05-01');
    });

    it('returns stale for gap-analysis when completed discussions exist but no cache', () => {
      createManifest(dir, 'payments', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'completed' } } } },
      });
      createFile(dir, '.workflows/payments/discussion/auth.md', 'content');
      const r = discover(dir, 'payments');
      assert.strictEqual(r.analysis_caches.gap_analysis.status, 'stale');
    });

    it('format() renders analysis_caches statuses', () => {
      createManifest(dir, 'payments', { work_type: 'epic' });
      const out = format(discover(dir, 'payments'));
      assert.match(out, /analysis_caches:/);
      assert.match(out, /research_analysis: absent/);
      assert.match(out, /gap_analysis: absent/);
    });
  });

  // --- next_session_number ---

  it('next_session_number is 1 when no logs exist', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const r = discover(dir, 'payments');
    assert.strictEqual(r.next_session_number, 1);
  });

  it('next_session_number increments past the highest existing number', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    writeSessionLog(dir, 'payments', 1, 'concluded');
    writeSessionLog(dir, 'payments', 2, 'concluded');
    writeSessionLog(dir, 'payments', 3, 'concluded');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.next_session_number, 4);
  });

  it('next_session_number still increments when latest is in-progress', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    writeSessionLog(dir, 'payments', 1, 'concluded');
    writeSessionLog(dir, 'payments', 2, '(none)');
    const r = discover(dir, 'payments');
    assert.strictEqual(r.next_session_number, 3);
  });
});

describe('workflow-discovery format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // --- Errors ---

  it('renders error result with "error:" prefix', () => {
    const out = format({ error: 'Work unit "x" not found' });
    assert.match(out, /^error: Work unit "x" not found/);
  });

  // --- Header ---

  it('header line includes the work_unit name', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /=== DISCOVERY DISCOVERY: payments ===/);
  });

  // --- map_summary line ---

  it('map_summary line includes total and all six counts', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'a': { status: 'in-progress', routing: 'research', source: 'discovery' },
            'b': { status: 'in-progress', routing: 'discussion', source: 'discovery' },
          },
        },
      },
    });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /map_summary: 2 topics — 0 decided, 0 in-flight, 0 ready, 2 fresh, 0 handled, 0 cancelled/);
  });

  it('map_summary line for empty map reads "0 topics — ..."', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /map_summary: 0 topics — 0 decided/);
  });

  // --- discovery_map block ---

  it('renders "(empty)" placeholder when discovery_map has no entries', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /discovery_map \(0\):\n {2}\(empty\)/);
  });

  it('renders map row with tier, name, lifecycle, routing, summary', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'auth-flow': { status: 'in-progress', summary: 'oauth', routing: 'research', source: 'discovery' },
          },
        },
      },
    });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /- ○ auth-flow \[fresh\] routing=research — oauth/);
  });

  it('omits source from map row when source=discovery', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } } },
    });
    const out = format(discover(dir, 'payments'));
    assert.ok(!out.includes('source=discovery'));
  });

  it('includes source=X in map row for non-discovery sources', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'research-analysis' } } } },
    });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /source=research-analysis/);
  });

  it('includes phase=X in map row when current_phase is set', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'a': { status: 'in-progress', routing: 'research', source: 'discovery' } } },
        research:  { items: { 'a': { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /phase=research/);
  });

  it('omits routing= and summary suffix when those fields are null', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: { 'a': { status: 'in-progress' } } } },
    });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /- ○ a \[fresh\]/);
    assert.ok(!out.includes('routing='));
    // Summary suffix is `— summary`; with no summary, no em dash should follow lifecycle.
    assert.ok(!/\[fresh\] —/.test(out));
  });

  // --- dismissed block ---

  it('renders "(none)" when dismissed list is empty', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /dismissed \(0\):\n {2}\(none\)/);
  });

  it('renders dismissed names one per line', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { discovery: { items: {}, dismissed: ['old-thing', 'another'] } },
    });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /dismissed \(2\):\n {2}- old-thing\n {2}- another/);
  });

  // --- active_session ---

  describe('active_session', () => {
    it('is null when phases.discovery.active_session is unset', () => {
      createManifest(dir, 'payments', { work_type: 'epic' });
      const r = discover(dir, 'payments');
      assert.strictEqual(r.active_session, null);
    });

    it('is null when the field is an empty string', () => {
      createManifest(dir, 'payments', {
        work_type: 'epic',
        phases: { discovery: { active_session: '' } },
      });
      const r = discover(dir, 'payments');
      assert.strictEqual(r.active_session, null);
    });

    it('returns the stored value when set to a session number string', () => {
      createManifest(dir, 'payments', {
        work_type: 'epic',
        phases: { discovery: { active_session: '002' } },
      });
      const r = discover(dir, 'payments');
      assert.strictEqual(r.active_session, '002');
    });

    it('format() renders active_session value when set', () => {
      createManifest(dir, 'payments', {
        work_type: 'epic',
        phases: { discovery: { active_session: '003' } },
      });
      const out = format(discover(dir, 'payments'));
      assert.match(out, /active_session: 003/);
    });

    it('format() renders "(none)" when active_session is unset', () => {
      createManifest(dir, 'payments', { work_type: 'epic' });
      const out = format(discover(dir, 'payments'));
      assert.match(out, /active_session: \(none\)/);
    });
  });

  // --- next_session_number line ---

  it('next_session_number line is zero-padded to 3 digits', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    assert.match(out, /next_session_number: 001/);
  });

  it('next_session_number increments past the highest existing number', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    writeSessionLog(dir, 'payments', 1, 'concluded');
    writeSessionLog(dir, 'payments', 9, 'concluded');
    const out = format(discover(dir, 'payments'));
    assert.match(out, /next_session_number: 010/);
  });

  // --- Output structure ---

  it('output ends with a trailing newline', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    assert.ok(out.endsWith('\n'));
  });

  it('renders all named sections in order', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    const out = format(discover(dir, 'payments'));
    const order = [
      out.indexOf('=== DISCOVERY DISCOVERY:'),
      out.indexOf('map_summary:'),
      out.indexOf('discovery_map ('),
      out.indexOf('dismissed ('),
      out.indexOf('active_session:'),
      out.indexOf('analysis_caches:'),
      out.indexOf('next_session_number:'),
    ];
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i] > order[i - 1], `section ${i} must follow section ${i - 1}; got ${order}`);
    }
  });
});
