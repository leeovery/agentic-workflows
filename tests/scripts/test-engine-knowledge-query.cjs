'use strict';

// `engine knowledge query` through the door: its argv — the terms, each
// filter flag, a boost, the limit — what it refuses, a checkout with no
// store, and the note over a keyword-only store a provider was configured
// over since. Verb layer: the door in process (knowledge-harness), over one
// keyword-only world built once and copied for each test. How a query ranks
// and renders, and what it says when it runs keyword-only, is
// test-knowledge-query.cjs's.

require('./hermetic-env.cjs');

const fs = require('fs');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { fixtureFrom, call } = require('./engine-harness.cjs');
const { cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const { engineKnowledge, knowledgeUnit, configureKnowledge, knowledgeAt } = require('./knowledge-harness.cjs');

const CHOSEN_NOTE = '[keyword-only mode — configure embedding provider for semantic search]';

/** Two features and an epic's two specifications, every file indexed keyword-only, each naming the token. */
const indexedWorld = fixtureFrom('kb-query-door-', (root) => {
  configureKnowledge(root, { provider: null });
  const files = {
    'auth/discussion/auth.md': 'Token refresh design for auth.',
    'auth/specification/auth/specification.md': 'Token refresh requirements for auth.',
    'data/discussion/data.md': 'Token storage design for data.',
    'payments/specification/billing/specification.md': 'Token billing requirements.',
    'payments/specification/invoicing/specification.md': 'Token invoicing requirements.',
  };
  knowledgeUnit(root, 'auth', 'feature');
  knowledgeUnit(root, 'data', 'feature');
  knowledgeUnit(root, 'payments', 'epic');
  for (const [rel, text] of Object.entries(files)) createFile(statePath(root), rel, `# Notes\n\n${text}\n`);
  for (const rel of Object.keys(files)) assert.strictEqual(call(root, ['knowledge', 'index', `.leeway/${rel}`]).code, 0, rel);
});

/** Each result's phase and identity, in the order printed. @param {string} stdout */
const hits = (stdout) => [...stdout.matchAll(/^\[(\w+) \| (\S+) \|/gm)].map(([, phase, identity]) => `${phase} ${identity}`);

describe('engine knowledge query', () => {
  let root;

  /** @param {...string} args */
  const query = (...args) => engineKnowledge(root, ['query', ...args]);

  beforeEach(() => {
    root = indexedWorld();
  });

  afterEach(() => cleanupFixture(root));

  it('prints its usage and exits 1 without a term', async () => {
    const answer = await query();
    assert.strictEqual(answer.code, 1);
    assert.strictEqual(answer.stdout, '');
    assert.match(answer.stderr, /^Usage: engine knowledge query <search_term> \[<term2>\.\.\.\] /);
  });

  it('refuses a blank term, naming status for listing everything, and answers any other', async () => {
    for (const term of ['', '   ']) {
      const answer = await query(term);
      assert.strictEqual(answer.code, 1, JSON.stringify(term));
      assert.match(answer.stderr, /^Error: Empty search term\. .* use `node \.claude\/skills\/workflow-engine\/scripts\/engine\.cjs knowledge status` instead\.\n$/);
    }
    assert.strictEqual((await query('token')).code, 0);
  });

  it('refuses an unknown boost field, or a boost with no value, naming what is wrong', async () => {
    assert.deepStrictEqual(await query('token', '--boost:bogus', 'foo'), {
      code: 1, stdout: '', stderr: 'Unknown --boost field: "bogus". Valid fields: work-unit, work-type, phase, topic, confidence\n',
    });
    assert.deepStrictEqual(await query('token', '--boost:work-unit'), { code: 1, stdout: '', stderr: '--boost:work-unit requires a value\n' });
  });

  it('--boost:work-unit lifts that unit\'s results above the rest, and keeps the rest', async () => {
    const boosted = hits((await query('token', '--boost:work-unit', 'data')).stdout);
    assert.strictEqual(boosted[0], 'discussion data/data');
    assert.strictEqual(boosted.length, 5);
  });

  it('keeps only what each filter flag names: --phase, --work-type as a comma list, --work-unit and --topic', async () => {
    const filtered = async (/** @type {string[]} */ flags) => hits((await query('token', ...flags)).stdout).sort();
    assert.deepStrictEqual(await filtered(['--phase', 'discussion']), ['discussion auth/auth', 'discussion data/data']);
    assert.deepStrictEqual(await filtered(['--work-type', 'epic']), ['specification payments/billing', 'specification payments/invoicing']);
    assert.strictEqual((await filtered(['--work-type', 'feature,epic'])).length, 5);
    assert.deepStrictEqual(await filtered(['--work-unit', 'auth']), ['discussion auth/auth', 'specification auth/auth']);
    assert.deepStrictEqual(await filtered(['--topic', 'billing']), ['specification payments/billing']);
  });

  it('--limit cuts the results to its number', async () => {
    const { stdout } = await query('token', '--limit', '1');
    assert.match(stdout, /^\[1 results\]$/m);
    assert.strictEqual(hits(stdout).length, 1);
  });

  it('answers no results, keyword-only, where the checkout has no store', async () => {
    fs.rmSync(knowledgeAt(root).store);
    fs.rmSync(knowledgeAt(root).metadata);
    assert.deepStrictEqual(await query('anything'), { code: 0, stdout: '[0 results]\n', stderr: '' });
  });

  it('over a keyword-only store a provider was configured over since, says the next start embeds it — and status says so, asking no rebuild', async () => {
    assert.strictEqual((await query('token')).stdout.split('\n')[0], CHOSEN_NOTE);
    configureKnowledge(root, { provider: 'stub', dimensions: 16 });
    assert.strictEqual((await query('token')).stdout.split('\n')[0], '[keyword-only mode — the store has no vectors yet; the next start embeds them]');
    const status = (await engineKnowledge(root, ['status'])).stdout;
    assert.match(status, /^Mode: Keyword-only — the store has no vectors yet; the next start embeds them$/m);
    assert.doesNotMatch(status, /rebuild/);
  });
});
