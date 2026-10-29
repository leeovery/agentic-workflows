'use strict';

// `engine knowledge check` and `engine knowledge status` through the door:
// the readiness each state of a checkout reads as — its knowledge folder,
// its config, the system config, its store and metadata — and the report
// status prints: the store's counts and mode, and what the next bulk index
// would do. Verb layer: the door in process (knowledge-harness), over the
// project world copied for each test, the system config a directory of the
// test's own. What status says of the query's mode is
// test-knowledge-query.cjs's; what it says of an artifact compact prunes,
// test-engine-knowledge-bulk.cjs's.

require('./hermetic-env.cjs');

const fs = require('fs');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const {
  ENGINE_COMMAND, KEYWORD_ONLY, STUB, OPENAI, engineKnowledge, knowledgeDoor, refuseLaunches,
  knowledgeUnit, manifestSet, setItems, configureKnowledge, knowledgeAt, systemConfigDir,
} = require('./knowledge-harness.cjs');

refuseLaunches();

describe('engine knowledge check', () => {
  let root;

  beforeEach(() => {
    root = setupFixture('kb-check-');
  });

  afterEach(() => cleanupFixture(root));

  /** A keyword-only store with one discussion indexed. */
  async function readyStore() {
    configureKnowledge(root, KEYWORD_ONLY);
    knowledgeUnit(root, 'auth', 'feature');
    createFile(statePath(root), 'auth/discussion/auth.md', '# Discussion\n\nSettled.\n');
    assert.strictEqual((await engineKnowledge(root, ['index', '.leeway/auth/discussion/auth.md'])).code, 0);
  }

  /** @type {Array<[string, Record<string, string>, () => void|Promise<void>, string, RegExp|null]>} the state, the system config's files, the build, the readiness, what stderr says */
  const STATES = [
    ['no knowledge folder', {}, () => {}, 'not-ready', null],
    ['a knowledge folder with no config', {}, () => fs.mkdirSync(knowledgeAt(root).dir, { recursive: true }), 'not-ready', null],
    ['no store, a provider configured', {}, () => configureKnowledge(root, STUB), 'buildable', null],
    ['no store, and no configuration that names a provider or chooses keyword-only', {}, () => configureKnowledge(root, {}), 'not-ready', null],
    ['no store, a system config that names no provider', { 'config.json': '{ "knowledge": {} }' }, () => configureKnowledge(root, {}), 'buildable', null],
    ['no store, the project pinning keyword-only', {}, () => configureKnowledge(root, KEYWORD_ONLY), 'buildable', null],
    ['no store, a provider whose key does not resolve', { 'config.json': JSON.stringify({ knowledge: OPENAI }) }, () => configureKnowledge(root, {}), 'not-ready', null],
    ['a store that cannot be loaded', {}, () => {
      configureKnowledge(root, KEYWORD_ONLY);
      fs.writeFileSync(knowledgeAt(root).store, 'this is garbage data, not a store');
    }, 'not-ready', null],
    ['a config that is not JSON', {}, () => {
      fs.mkdirSync(knowledgeAt(root).dir, { recursive: true });
      fs.writeFileSync(knowledgeAt(root).config, 'not valid json{{');
    }, 'not-ready', /^config error: Invalid JSON in config file at /],
    ['a config with no knowledge key', {}, () => {
      fs.mkdirSync(knowledgeAt(root).dir, { recursive: true });
      fs.writeFileSync(knowledgeAt(root).config, '{"other":"stuff"}');
    }, 'not-ready', /^config error: .*"knowledge"/],
    ['a store with its metadata', {}, readyStore, 'ready', null],
    ['a store with its metadata, its config since broken', {}, async () => {
      await readyStore();
      fs.writeFileSync(knowledgeAt(root).config, 'not valid json{{');
    }, 'not-ready', /^config error: Invalid JSON in config file at /],
    ['a store without its metadata', {}, async () => {
      await readyStore();
      fs.rmSync(knowledgeAt(root).metadata);
    }, 'not-ready', null],
  ];

  for (const [state, system, build, readiness, said] of STATES) {
    it(`reads ${readiness} for ${state}, exiting 0`, async (t) => {
      await build();
      const answer = await engineKnowledge(root, ['check'], { WORKFLOWS_CONFIG_DIR: systemConfigDir(t, system) });
      assert.strictEqual(answer.code, 0);
      assert.strictEqual(answer.stdout, `${readiness}\n`);
      if (said) assert.match(answer.stderr, said);
      else assert.strictEqual(answer.stderr, '');
    });
  }
});

describe('engine knowledge status', () => {
  let root;

  const { knowledge, at } = knowledgeDoor(() => root);

  beforeEach(async () => {
    root = setupFixture('kb-status-');
    configureKnowledge(root, KEYWORD_ONLY);
    knowledgeUnit(root, 'auth', 'feature');
    setItems(root, 'auth', { discussion: ['auth'] });
    createFile(statePath(root), 'auth/discussion/auth.md', '# Discussion\n\nSettled.\n');
  });

  afterEach(() => cleanupFixture(root));

  it('says the store is not initialized where there is none, and how to build it', async () => {
    assert.deepStrictEqual(await knowledge('status'), {
      code: 0,
      stdout: `=== Knowledge Base Status ===\n\nStore: not initialized\nRun \`${ENGINE_COMMAND} knowledge index\` to build the index.\n`,
      stderr: '',
    });
  });

  it('counts the chunks in all and by unit, phase and type, with the store\'s size and its mode', async () => {
    await knowledge('index');
    const { stdout } = await knowledge('status');
    assert.match(stdout, /^Total chunks: 1\n\nBy work unit:\n  auth: 1\n\nBy phase:\n  discussion: 1\n\nBy work type:\n  feature: 1\n\nStore size: \d+\.\d KB$/m);
    assert.match(stdout, /^Provider: none\nMode: Keyword-only — /m);
  });

  it('names a file changed since it was indexed, and none before it changes', async () => {
    await knowledge('index');
    assert.doesNotMatch((await knowledge('status')).stdout, /Changed since indexing/);
    fs.appendFileSync(at('auth/discussion/auth.md'), 'An edit after completion.\n');
    assert.match((await knowledge('status')).stdout, new RegExp(`^Changed since indexing: 1\\n  ${at('auth/discussion/auth.md')}$`, 'm'));
  });

  it('names each file whose chunks the next index retires, and why', async () => {
    knowledgeUnit(root, 'dropped', 'feature');
    manifestSet(root, 'dropped', 'status', 'cancelled');
    createFile(statePath(root), 'dropped/discussion/dropped.md', '# Discussion\n\nDropped.\n');
    for (const rel of ['auth/discussion/auth.md', 'dropped/discussion/dropped.md']) await knowledge('index', `.leeway/${rel}`);
    fs.rmSync(at('auth/discussion/auth.md'));
    assert.match((await knowledge('status')).stdout, new RegExp([
      '^Retired since indexing: 2',
      `  ${at('auth/discussion/auth.md')} \\(source deleted\\)`,
      `  ${at('dropped/discussion/dropped.md')} \\(work unit cancelled\\)$`,
    ].join('\\n'), 'm'));
  });
});
