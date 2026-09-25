'use strict';

// The query pipeline's parts, as the built bundle ships them: the settings a
// store's metadata and the config resolve to, the search that ranks, and the
// render that prints. The CLI composes the three; the eval harness calls them
// in process.

require('./hermetic-env.cjs');

const { describe, it, before } = require('node:test');
const assert = require('node:assert');

const {
  store,
  StubProvider,
  boostProblem,
  querySettings,
  queryStore,
  renderQuery,
} = require('../../skills/workflow-knowledge/scripts/knowledge.cjs');

const DIMS = 128;
const KEYWORD_ONLY = { provider: null, model: null, dimensions: null };
const STUB_BUILT = { provider: 'stub', model: 'stub', dimensions: DIMS };

/** A chunk of `unit`'s discussion, `n` its ordinal. */
function doc(unit, n, content) {
  return {
    id: `${unit}-discussion-${unit}-${String(n).padStart(3, '0')}`,
    content,
    work_unit: unit,
    work_type: 'feature',
    phase: 'discussion',
    topic: unit,
    confidence: 'medium',
    source_file: `.workflows/${unit}/discussion/${unit}.md`,
    timestamp: new Date(2026, 0, 2).getTime(),
  };
}

/** The ranking settings a keyword-only query runs with by default. */
function keywordSettings() {
  return querySettings(KEYWORD_ONLY, {}, null);
}

/** @param {any} db @param {Record<string, any>} request */
function query(db, request) {
  return queryStore(db, { ...keywordSettings(), filters: {}, boosts: [], workUnits: [], ...request });
}

describe('querySettings', () => {
  it('runs a keyword-only store keyword-only, with the ranking the config defaults to', () => {
    const settings = keywordSettings();
    assert.strictEqual(settings.mode, 'keyword-only');
    assert.strictEqual(settings.provider, null);
    assert.strictEqual(settings.similarity, 0.3);
    assert.strictEqual(settings.stability, 5);
    assert.strictEqual(settings.weights.feature, 1);
  });

  it('offers the upgrade over a keyword-only store once a provider is configured', () => {
    const settings = querySettings(KEYWORD_ONLY, { provider: 'stub' }, new StubProvider({ dimensions: DIMS }));
    assert.strictEqual(settings.mode, 'upgrade-available');
    assert.strictEqual(settings.provider, null);
  });

  it('runs a store built with the configured provider in full', () => {
    const provider = new StubProvider({ dimensions: DIMS });
    const settings = querySettings(STUB_BUILT, { provider: 'stub' }, provider);
    assert.strictEqual(settings.mode, 'full');
    assert.strictEqual(settings.provider, provider);
  });
});

describe('queryStore', () => {
  let db;

  before(async () => {
    db = await store.createStore(DIMS);
    const provider = new StubProvider({ dimensions: DIMS });
    for (const d of [
      doc('old', 1, 'Token refresh follows the rate window.'),
      doc('new', 1, 'Token refresh follows the rate window.'),
      doc('billing', 1, 'Invoices are issued monthly.'),
      doc('billing', 2, 'Refunds reverse the invoice.'),
    ]) {
      await store.insertDocument(db, { ...d, embedding: provider.embed(d.content) });
    }
  });

  it('merges every term, each chunk once, and cuts to the limit', async () => {
    const terms = ['token', 'refresh', 'refunds'];
    const merged = await query(db, { terms });
    assert.deepStrictEqual(merged.map((r) => r.id).sort(), [
      'billing-discussion-billing-002',
      'new-discussion-new-001',
      'old-discussion-old-001',
    ]);
    assert.strictEqual((await query(db, { terms, limit: 2 })).length, 2);
  });

  it('filters by a comma list of values', async () => {
    const results = await query(db, { terms: ['token', 'invoice'], filters: { workUnit: 'old,billing' } });
    assert.deepStrictEqual([...new Set(results.map((r) => r.work_unit))].sort(), ['billing', 'old']);
  });

  it('decays a unit the progress clock has moved past, and adds boosts undimmed', async () => {
    const workUnits = [
      { name: 'old', status: 'completed', completed_at: '2026-01-01', work_type: 'feature' },
      { name: 'new', status: 'completed', completed_at: '2026-06-01', work_type: 'feature' },
    ];
    const decayed = await query(db, { terms: ['token'], workUnits });
    assert.deepStrictEqual(decayed.map((r) => [r.work_unit, r.progressElapsed]), [['new', 0], ['old', 1]]);

    const boosted = await query(db, { terms: ['token'], workUnits, boosts: [{ field: 'work_unit', value: 'old' }] });
    assert.strictEqual(boosted[0].work_unit, 'old');
  });

  it('embeds each term and searches hybrid in full mode', async () => {
    const stub = new StubProvider({ dimensions: DIMS });
    const embedded = [];
    const provider = {
      model: () => stub.model(),
      dimensions: () => stub.dimensions(),
      embed: (text) => {
        embedded.push(text);
        return stub.embed(text);
      },
    };
    const results = await queryStore(db, {
      ...querySettings(STUB_BUILT, { provider: 'stub' }, provider),
      terms: ['token refresh', 'refunds'],
      filters: {},
      boosts: [],
      workUnits: [],
    });
    assert.deepStrictEqual(embedded, ['token refresh', 'refunds']);
    assert.ok(results.length > 0);
  });
});

describe('renderQuery', () => {
  const result = doc('auth', 1, 'Tokens refresh hourly.');

  it("opens a keyword-only query with its note, then each result's header, content and source", () => {
    assert.strictEqual(renderQuery([result], 'keyword-only'), [
      '[keyword-only mode — configure embedding provider for semantic search]',
      '[1 results]',
      '',
      '[discussion | auth/auth | medium | 2026-01-02]',
      'Tokens refresh hourly.',
      'Source: .workflows/auth/discussion/auth.md',
    ].join('\n') + '\n');
  });

  it('prints no note in full mode, and a bare count where there is no store', () => {
    assert.match(renderQuery([result], 'full'), /^\[1 results\]\n/);
    assert.strictEqual(renderQuery([], null), '[0 results]\n');
  });

  it('strips control characters, keeping newlines and tabs', () => {
    const text = renderQuery([{ ...result, content: 'a\x1b[31mred\x00\tb\nc' }], 'full');
    assert.ok(text.includes('a[31mred\tb\nc'));
  });
});

describe('boostProblem', () => {
  it('names an unknown field and a missing value, and passes a valid directive', () => {
    assert.match(boostProblem({ field: 'bogus', value: 'x' }), /^Unknown --boost field: "bogus"\. Valid fields: /);
    assert.strictEqual(boostProblem({ field: 'phase', value: null }), '--boost:phase requires a value');
    assert.strictEqual(boostProblem({ field: 'phase', value: 'spec' }), null);
  });
});
