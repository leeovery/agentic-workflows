'use strict';

// The query pipeline's parts, as the built bundle ships them: the settings a
// store's metadata and the config resolve to, the search that ranks, and the
// render that prints. The CLI composes the three; the eval harness calls them
// in process.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const BUNDLE = path.join(__dirname, '..', '..', 'skills', 'workflow-knowledge', 'scripts', 'knowledge.cjs');

const {
  store,
  StubProvider,
  boostProblem,
  querySettings,
  queryStore,
  renderQuery,
} = require(BUNDLE);

const DIMS = 128;
const KEYWORD_ONLY = { provider: null, model: null, dimensions: null };
const STUB_BUILT = { provider: 'stub', model: 'stub', dimensions: DIMS };

// A chunk and a query term sharing no word, embedded alike — only the vector
// search can join them.
const PARAPHRASE = { content: 'Receipts reconcile after close.', term: 'when is the ledger balanced' };

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

/**
 * @param {any} db
 * @param {{terms: string[], options?: object, workUnits?: object[], settings?: object}} request
 */
function query(db, { terms, options = {}, workUnits = [], settings = keywordSettings() }) {
  return queryStore(db, settings, { terms, options, workUnits });
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
  const stub = new StubProvider({ dimensions: DIMS });
  let db;

  before(async () => {
    db = await store.createStore(DIMS);
    for (const d of [
      doc('old', 1, 'Token refresh follows the rate window.'),
      doc('new', 1, 'Token refresh follows the rate window.'),
      doc('billing', 1, 'Invoices are issued monthly.'),
      doc('billing', 2, 'Refunds reverse the invoice.'),
    ]) {
      await store.insertDocument(db, { ...d, embedding: stub.embed(d.content) });
    }
    await store.insertDocument(db, { ...doc('accounts', 1, PARAPHRASE.content), embedding: stub.embed(PARAPHRASE.term) });
  });

  it('merges every term, each chunk once, and cuts to the limit', async () => {
    const terms = ['token', 'refresh', 'refunds'];
    const merged = await query(db, { terms });
    assert.deepStrictEqual(merged.map((r) => r.id).sort(), [
      'billing-discussion-billing-002',
      'new-discussion-new-001',
      'old-discussion-old-001',
    ]);
    assert.strictEqual((await query(db, { terms, options: { limit: 2 } })).length, 2);
  });

  it('filters by a comma list of values', async () => {
    const results = await query(db, { terms: ['token', 'invoice'], options: { workUnit: 'old,billing' } });
    assert.deepStrictEqual([...new Set(results.map((r) => r.work_unit))].sort(), ['billing', 'old']);
  });

  it('decays a unit the progress clock has moved past, and adds boosts undimmed', async () => {
    const workUnits = [
      { name: 'old', status: 'completed', completed_at: '2026-01-01', work_type: 'feature' },
      { name: 'new', status: 'completed', completed_at: '2026-06-01', work_type: 'feature' },
    ];
    const decayed = await query(db, { terms: ['token'], workUnits });
    assert.deepStrictEqual(decayed.map((r) => [r.work_unit, r.progressElapsed]), [['new', 0], ['old', 1]]);

    const boosted = await query(db, { terms: ['token'], workUnits, options: { boosts: [{ field: 'work-unit', value: 'old' }] } });
    assert.strictEqual(boosted[0].work_unit, 'old');
  });

  it('refuses an invalid boost with a UserError', async () => {
    await assert.rejects(
      query(db, { terms: ['token'], options: { boosts: [{ field: 'bogus', value: 'x' }] } }),
      { name: 'UserError', message: /^Unknown --boost field: "bogus"/ },
    );
  });

  it('embeds each term and searches hybrid in full mode', async () => {
    const embedded = [];
    const provider = {
      model: () => stub.model(),
      dimensions: () => stub.dimensions(),
      embed: (text) => {
        embedded.push(text);
        return stub.embed(text);
      },
    };
    const settings = querySettings(STUB_BUILT, { provider: 'stub' }, provider);
    await query(db, { terms: ['token refresh', 'refunds'], settings });
    assert.deepStrictEqual(embedded, ['token refresh', 'refunds']);
  });

  it('finds by meaning in full mode a chunk sharing no word with the query', async () => {
    const accounts = 'accounts-discussion-accounts-001';
    const full = querySettings(STUB_BUILT, { provider: 'stub' }, stub);
    assert.ok((await query(db, { terms: [PARAPHRASE.term], settings: full })).some((r) => r.id === accounts));
    assert.ok(!(await query(db, { terms: [PARAPHRASE.term] })).some((r) => r.id === accounts));
  });
});

describe('knowledge query — the CLI', () => {
  let root;

  /** @param {string} name @param {string} completedAt */
  function completedFeature(name, completedAt) {
    const unit = path.join(root, '.workflows', name);
    fs.mkdirSync(path.join(unit, 'discussion'), { recursive: true });
    fs.writeFileSync(path.join(unit, 'manifest.json'), JSON.stringify({
      name, work_type: 'feature', status: 'completed', created: '2026-01-01', completed_at: completedAt,
      phases: { discussion: { items: { [name]: { status: 'completed' } } } },
    }));
    fs.writeFileSync(path.join(unit, 'discussion', `${name}.md`), '# Discussion\n\nToken refresh follows the rate window.\n');
  }

  /** @param {...string} args */
  function knowledge(...args) {
    return execFileSync(process.execPath, [BUNDLE, ...args], { cwd: root, encoding: 'utf8' });
  }

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-query-'));
    fs.mkdirSync(path.join(root, '.workflows', '.knowledge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.workflows', '.knowledge', 'config.json'), '{ "knowledge": { "provider": null } }');
    fs.writeFileSync(path.join(root, '.workflows', 'manifest.json'),
      JSON.stringify({ work_units: { alpha: { work_type: 'feature' }, beta: { work_type: 'feature' } } }));
    completedFeature('alpha', '2026-01-01');
    completedFeature('beta', '2026-06-01');
    knowledge('index', '.workflows/alpha/discussion/alpha.md');
    knowledge('index', '.workflows/beta/discussion/beta.md');
  });

  after(() => fs.rmSync(root, { recursive: true, force: true }));

  it('ranks a chunk the progress clock has moved past below its equal', () => {
    const units = [...knowledge('query', 'token refresh').matchAll(/^\[discussion \| (\w+)\//gm)].map((m) => m[1]);
    assert.deepStrictEqual(units, ['beta', 'alpha']);
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
