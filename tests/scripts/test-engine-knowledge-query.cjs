'use strict';

// `engine knowledge query` through the door: its argv — the terms, each
// filter flag, a boost, the limit — what it refuses, a checkout with no
// store, and the note over a keyword-only store a provider was configured
// over since. Verb layer: the door in process (knowledge-harness), over one
// keyword-only world built once and copied for each test. How a query ranks
// and renders, and what it says when it runs keyword-only, is
// test-knowledge-query.cjs's. And what a query run in a conversation keeps
// as its last, for the plain-search helper's brief (22.6.10).

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { fixtureFrom, call } = require('./engine-harness.cjs');
const { cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const { ENGINE_COMMAND, KEYWORD_ONLY, STUB, engineKnowledge, knowledgeDoor, refuseLaunches, knowledgeUnit, setItems, configureKnowledge, knowledgeAt } = require('./knowledge-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { conversationDir, conversationsRoot } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { lastQuery } = require(path.join(SCRIPTS, 'domain/knowledge/last-query.cjs'));

const CHOSEN_NOTE = '[keyword-only mode — configure embedding provider for semantic search]';

/** Two features and an epic's two topics' records, every file indexed keyword-only, each naming the token. */
const indexedWorld = fixtureFrom('kb-query-door-', (root) => {
  configureKnowledge(root, KEYWORD_ONLY);
  const files = {
    'auth/seeds/auth.md': 'Token refresh design for auth.',
    '.knowledge/records/auth/auth.md': 'Token refresh decided for auth.',
    'data/seeds/data.md': 'Token storage design for data.',
    '.knowledge/records/payments/billing.md': 'Token billing decided.',
    '.knowledge/records/payments/invoicing.md': 'Token invoicing decided.',
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
  const { knowledge } = knowledgeDoor(() => root);
  /** @param {...string} args */
  const query = (...args) => knowledge('query', ...args);
  refuseLaunches();

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
      assert.deepStrictEqual(await query(term), {
        code: 1,
        stdout: '',
        stderr: 'Error: Empty search term. `engine knowledge query` requires at least one non-empty positional term. '
          + `If you intended to list everything indexed, use \`${ENGINE_COMMAND} knowledge status\` instead.\n`,
      }, JSON.stringify(term));
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
    assert.strictEqual(boosted[0], 'seeds data/data');
    assert.strictEqual(boosted.length, 5);
  });

  it('keeps only what each filter flag names: --phase, --work-type as a comma list, --work-unit and --topic', async () => {
    const filtered = async (/** @type {string[]} */ flags) => hits((await query('token', ...flags)).stdout).sort();
    assert.deepStrictEqual(await filtered(['--phase', 'seeds']), ['seeds auth/auth', 'seeds data/data']);
    assert.deepStrictEqual(await filtered(['--work-type', 'epic']), ['record payments/billing', 'record payments/invoicing']);
    assert.strictEqual((await filtered(['--work-type', 'feature,epic'])).length, 5);
    assert.deepStrictEqual(await filtered(['--work-unit', 'auth']), ['record auth/auth', 'seeds auth/auth']);
    assert.deepStrictEqual(await filtered(['--topic', 'billing']), ['record payments/billing']);
  });

  it('11.S16: returns a completed topic\'s record and never its concluded spec', async () => {
    setItems(root, 'auth', { specification: ['auth'] });
    createFile(statePath(root), 'auth/specification/auth/specification.md', '# Specification\n\nToken refresh specified for auth.\n');
    assert.strictEqual((await knowledge('index')).code, 0);
    const found = hits((await query('token', '--work-unit', 'auth', '--phase', 'record,specification')).stdout);
    assert.deepStrictEqual(found, ['record auth/auth']);
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
    configureKnowledge(root, STUB);
    assert.strictEqual((await query('token')).stdout.split('\n')[0], '[keyword-only mode — the store has no vectors yet; the next start embeds them]');
    const status = (await knowledge('status')).stdout;
    assert.match(status, /^Mode: Keyword-only — the store has no vectors yet; the next start embeds them$/m);
    assert.doesNotMatch(status, /rebuild/);
  });
});

describe('engine knowledge query — the conversation\'s last query (22.6.10)', () => {
  const SESSION_ID = 'kb-last-query';
  let root;
  refuseLaunches();

  beforeEach(() => {
    root = indexedWorld();
  });

  afterEach(() => {
    cleanupFixture(root);
    fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
  });

  /** A query run in the conversation. @param {...string} args */
  const asked = (...args) => engineKnowledge(root, ['query', ...args], { CLAUDE_CODE_SESSION_ID: SESSION_ID });

  it('kept with its terms, each filter as its flag gave it, and what it printed — the last query alone', async () => {
    await asked('storage');
    const answer = await asked('token', 'refresh', '--work-unit', 'auth', '--limit', '2', '--boost:phase', 'seeds');

    assert.deepStrictEqual(lastQuery(SESSION_ID), {
      terms: ['token', 'refresh'], filters: ['--work-unit auth', '--limit 2', '--boost:phase seeds'], outcome: { returned: answer.stdout },
    });
  });

  it('a query that fails kept with what it said as it failed — a refusal and a usage alike', async () => {
    await asked('  ');
    const blank = lastQuery(SESSION_ID)?.outcome;
    await asked('--phase', 'seeds');
    const bare = lastQuery(SESSION_ID);

    assert.deepStrictEqual(blank, { failed: `Empty search term. \`engine knowledge query\` requires at least one non-empty positional term. If you intended to list everything indexed, use \`${ENGINE_COMMAND} knowledge status\` instead.` });
    assert.deepStrictEqual([bare?.terms, bare?.filters, bare?.outcome && 'failed' in bare.outcome && bare.outcome.failed.split(' ').slice(0, 4).join(' ')], [[], ['--phase seeds'], 'Usage: engine knowledge query']);
  });

  it('a query with no conversation keeps nothing', async () => {
    assert.strictEqual((await engineKnowledge(root, ['query', 'token'])).code, 0);

    const kept = fs.existsSync(conversationsRoot()) ? fs.readdirSync(conversationsRoot()).filter((id) => fs.existsSync(path.join(conversationsRoot(), id, 'knowledge-query.json'))) : [];
    assert.deepStrictEqual(kept, []);
  });
});
