'use strict';

// `engine knowledge index` with no file, and `engine knowledge fill`,
// through the door: the bulk index bringing the store in line with the files
// the manifests name — each file indexed or removed named with why, the
// summary, the reasons a chunk is retired, a scope, a failure, a manifest it
// cannot read, the artifacts compact prunes, a missing store built, a run
// from a subdirectory — and the fill giving a keyword-only store the
// provider configured over it. Verb layer: the door in process
// (knowledge-harness), over the project world copied for each test,
// keyword-only unless the test's subject is the provider. What the bulk
// index sends the provider is test-knowledge-bulk-index.cjs's.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../skills/leeway-engine/scripts/kernel/knowledge/store.cjs');
const { setupFixture, cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const { call } = require('./engine-harness.cjs');
const {
  KEYWORD_ONLY, STUB, OPENAI, engineKnowledge, knowledgeDoor, refuseLaunches, knowledgeUnit, manifestSet, setItems, completeUnit, setRegistry,
  configureKnowledge, knowledgeAt, knowledgeMetadata, storedChunks,
} = require('./knowledge-harness.cjs');

refuseLaunches();

describe('engine knowledge index — the bulk index', () => {
  let root;

  const { knowledge, at } = knowledgeDoor(() => root);
  /** @param {string} rel @param {string} [text] */
  const write = (rel, text = `# ${path.basename(rel)}\n\nWhat ${rel} settled.\n`) => createFile(statePath(root), rel, text);
  /** A feature whose one investigation is completed and on disk. @param {string} name */
  function feature(name) {
    knowledgeUnit(root, name, 'feature');
    setItems(root, name, { investigation: [name] });
    write(`${name}/investigation/${name}.md`);
  }
  const sha = (/** @type {string} */ rel) => store.contentHash(fs.readFileSync(at(rel), 'utf8'));
  const removed = (/** @type {string} */ rel, /** @type {string} */ why) => `Removed ${at(rel)} — 1 chunks (${why})\n`;
  const indexed = (/** @type {string} */ rel, /** @type {string} */ state) => `Indexed ${at(rel)} — 1 chunks (${state})\n`;

  beforeEach(() => {
    root = setupFixture('kb-bulk-door-');
    configureKnowledge(root, KEYWORD_ONLY);
  });

  afterEach(() => cleanupFixture(root));

  it('names each file it indexes, new or changed, then the summary, and skips what is unchanged', async () => {
    knowledgeUnit(root, 'auth', 'bugfix');
    setItems(root, 'auth', { investigation: ['auth'], specification: ['auth'] });
    write('auth/investigation/auth.md');
    write('auth/specification/auth/specification.md');
    assert.deepStrictEqual(await knowledge('index'), {
      code: 0,
      stdout: indexed('auth/investigation/auth.md', 'new') + indexed('auth/specification/auth/specification.md', 'new') + '2 new, 0 changed, 0 removed, 0 unchanged.\n',
      stderr: '',
    });

    fs.appendFileSync(at('auth/investigation/auth.md'), 'A line added after indexing.\n');
    assert.deepStrictEqual(await knowledge('index'), {
      code: 0, stdout: indexed('auth/investigation/auth.md', 'changed') + '0 new, 1 changed, 0 removed, 1 unchanged.\n', stderr: '',
    });
    assert.deepStrictEqual([...new Set(storedChunks(root, { phase: 'investigation' }).map((c) => c.source_hash))], [sha('auth/investigation/auth.md')]);
  });

  it('re-indexes chunks that record no hash of their file once, then leaves them', async () => {
    feature('legacy');
    await knowledge('index');
    const hashless = store.createStore();
    for (const chunk of storedChunks(root)) store.insertDocument(hashless, { ...chunk, source_hash: undefined });
    store.saveStore(hashless, knowledgeAt(root).store);

    assert.strictEqual((await knowledge('index')).stdout, indexed('legacy/investigation/legacy.md', 'changed') + '0 new, 1 changed, 0 removed, 0 unchanged.\n');
    assert.deepStrictEqual(storedChunks(root).map((c) => c.source_hash), [sha('legacy/investigation/legacy.md')]);
    assert.strictEqual((await knowledge('index')).stdout, '0 new, 0 changed, 0 removed, 1 unchanged.\n');
  });

  it('removes the chunks of a cancelled unit and of one no longer registered, naming each file and why, and keeps a live one', async () => {
    for (const name of ['dropped', 'orphaned', 'kept']) feature(name);
    await knowledge('index');
    manifestSet(root, 'dropped', 'status', 'cancelled');
    setRegistry(root, { dropped: { work_type: 'bugfix' }, kept: { work_type: 'bugfix' } });

    assert.deepStrictEqual(await knowledge('index'), {
      code: 0,
      stdout: removed('dropped/investigation/dropped.md', 'work unit cancelled') + removed('orphaned/investigation/orphaned.md', 'work unit not registered')
        + '0 new, 0 changed, 2 removed, 1 unchanged.\n',
      stderr: '',
    });
    assert.deepStrictEqual([...new Set(storedChunks(root).map((c) => c.work_unit))], ['kept']);
  });

  it('removes the chunks of an item retired or gone from the manifest, naming why, and keeps a topic in progress again', async () => {
    const topics = ['cancelled-t', 'missing-t', 'reopened-t'];
    knowledgeUnit(root, 'payments', 'bugfix');
    setItems(root, 'payments', { investigation: topics, specification: ['promoted-t', 'superseded-t'] });
    for (const topic of topics) write(`payments/investigation/${topic}.md`);
    for (const topic of ['promoted-t', 'superseded-t']) write(`payments/specification/${topic}/specification.md`);
    await knowledge('index');
    manifestSet(root, 'payments.investigation.cancelled-t', 'status', 'cancelled');
    assert.strictEqual(call(root, ['manifest', 'delete', 'payments', 'phases.investigation.items.missing-t']).code, 0);
    manifestSet(root, 'payments.investigation.reopened-t', 'status', 'in-progress');
    manifestSet(root, 'payments.specification.promoted-t', 'status', 'promoted');
    manifestSet(root, 'payments.specification.superseded-t', 'status', 'superseded');

    const { stdout } = await knowledge('index');
    assert.deepStrictEqual(stdout.split('\n').filter((line) => line.startsWith('Removed ')).sort(), [
      removed('payments/investigation/cancelled-t.md', 'investigation cancelled'),
      removed('payments/investigation/missing-t.md', 'no investigation item'),
      removed('payments/specification/promoted-t/specification.md', 'specification promoted'),
      removed('payments/specification/superseded-t/specification.md', 'specification superseded'),
    ].map((line) => line.trimEnd()));
    assert.match(stdout, /^0 new, 0 changed, 4 removed, 0 unchanged\.$/m);
    assert.deepStrictEqual(storedChunks(root).map((c) => c.topic), ['reopened-t']);
  });

  it('keeps a baseline doc\'s chunks, which no registry names, until the doc is deleted', async () => {
    feature('auth');
    write('.baseline/overview.md');
    await knowledge('index');
    assert.strictEqual((await knowledge('index')).stdout, '0 new, 0 changed, 0 removed, 2 unchanged.\n');
    fs.rmSync(at('.baseline/overview.md'));
    assert.strictEqual((await knowledge('index')).stdout, removed('.baseline/overview.md', 'source deleted') + '0 new, 0 changed, 1 removed, 1 unchanged.\n');
  });

  it('--work-unit confines the index and its removals to that unit, its sibling left as it was', async () => {
    for (const name of ['alpha', 'beta']) feature(name);
    assert.strictEqual((await knowledge('index', '--work-unit', 'alpha')).stdout, indexed('alpha/investigation/alpha.md', 'new') + '1 new, 0 changed, 0 removed, 0 unchanged.\n');
    assert.match((await knowledge('status')).stdout, new RegExp(`^Unindexed completed artifacts: 1\\n  ${at('beta/investigation/beta.md')}$`, 'm'));

    await knowledge('index');
    for (const name of ['alpha', 'beta']) manifestSet(root, name, 'status', 'cancelled');
    assert.strictEqual((await knowledge('index', '--work-unit', 'alpha')).stdout, removed('alpha/investigation/alpha.md', 'work unit cancelled') + '0 new, 0 changed, 1 removed, 0 unchanged.\n');
    assert.deepStrictEqual([...new Set(storedChunks(root).map((c) => c.work_unit))], ['beta']);
  });

  it('writes nothing when the store is already in line — the store and its metadata byte for byte', async () => {
    feature('auth');
    await knowledge('index');
    const files = knowledgeAt(root);
    const bytes = () => [fs.readFileSync(files.store), fs.readFileSync(files.metadata)];
    const before = bytes();
    await knowledge('index');
    assert.deepStrictEqual(bytes(), before);
  });

  it('attempts every file: one that fails is named on stderr and counted, the rest indexed, and the run exits 1', async () => {
    knowledgeUnit(root, 'payments', 'bugfix');
    setItems(root, 'payments', { investigation: ['empty', 'good'] });
    write('payments/investigation/empty.md', '\n');
    write('payments/investigation/good.md');
    const answer = await knowledge('index');
    assert.strictEqual(answer.code, 1);
    assert.strictEqual(answer.stdout, indexed('payments/investigation/good.md', 'new') + '1 new, 0 changed, 0 removed, 0 unchanged, 1 failed.\n');
    assert.match(answer.stderr, new RegExp(`^Failed to index ${at('payments/investigation/empty.md').replace(/[.]/g, '\\.')}: No chunks produced from `));
  });

  it('aborts on a project manifest it cannot read, before anything is removed', async () => {
    feature('auth');
    await knowledge('index');
    fs.writeFileSync(at('manifest.json'), '{ not json');
    const answer = await knowledge('index');
    assert.strictEqual(answer.code, 1);
    assert.match(answer.stderr, /^Error: manifest read failed: /);
    assert.strictEqual(storedChunks(root).length, 1);
  });

  it('retires nothing for want of registration when the registry names no unit — the units are those on disk', async () => {
    feature('legacy');
    await knowledge('index');
    setRegistry(root, {});
    assert.strictEqual((await knowledge('index')).stdout, '0 new, 0 changed, 0 removed, 1 unchanged.\n');
  });

  it('keeps the chunks of a registered unit whose manifest it cannot read', async () => {
    feature('garbled');
    await knowledge('index');
    fs.writeFileSync(at('garbled/manifest.json'), '{ not json');
    assert.strictEqual((await knowledge('index')).stdout, '0 new, 0 changed, 0 removed, 0 unchanged.\n');
    assert.strictEqual(storedChunks(root, { workUnit: 'garbled' }).length, 1);
  });

  it('skips the artifacts compact prunes, which status names, and leaves their chunks to compact', async () => {
    // S0 3 and a 0.95 floor: a unit two completions behind is at R ≈ 0.931,
    // below it — its investigation pruned, its specification never.
    configureKnowledge(root, { provider: null, decay_prune_below: 0.95, decay_base_stability: 3 });
    knowledgeUnit(root, 'buried', 'feature');
    setItems(root, 'buried', { investigation: ['buried'], specification: ['buried'] });
    write('buried/investigation/buried.md');
    write('buried/specification/buried/specification.md');
    completeUnit(root, 'buried', '2024-01-01');
    for (const [name, date] of [['newer1', '2024-06-01'], ['newer2', '2024-12-01']]) {
      knowledgeUnit(root, name, 'feature');
      completeUnit(root, name, date);
    }

    assert.strictEqual((await knowledge('index')).stdout, indexed('buried/specification/buried/specification.md', 'new') + '1 new, 0 changed, 0 removed, 0 unchanged.\n');
    const status = (await knowledge('status')).stdout;
    assert.match(status, new RegExp(`^Pruned below the decay floor: 1\\n  ${at('buried/investigation/buried.md')}$`, 'm'));
    assert.doesNotMatch(status, /Unindexed/);

    await knowledge('index', '.leeway/buried/investigation/buried.md');
    fs.appendFileSync(at('buried/investigation/buried.md'), 'A late edit.\n');
    assert.strictEqual((await knowledge('index')).stdout, '0 new, 0 changed, 0 removed, 1 unchanged.\n', 'the pruned chunks are compact\'s, never refreshed or dropped');
    assert.match((await knowledge('compact')).stdout, /^Compacted: removed 1 chunks from 1 work units/);
    assert.strictEqual((await knowledge('index')).stdout, '0 new, 0 changed, 0 removed, 1 unchanged.\n', 'and left pruned after');
  });

  it('skips at the default floor past a decay_prune_below it ignores, and status names the setting', async () => {
    // S0 0.05: 'buried', two completions behind, sits at R ≈ 0.015, below the
    // default floor 0.05; 'recent', one behind, at R ≈ 0.12, above it.
    configureKnowledge(root, { provider: null, decay_prune_below: 'high', decay_base_stability: 0.05 });
    feature('buried');
    feature('recent');
    knowledgeUnit(root, 'frontier', 'feature');
    for (const [name, date] of [['buried', '2024-01-01'], ['recent', '2024-06-01'], ['frontier', '2024-12-01']]) completeUnit(root, name, date);

    assert.deepStrictEqual(await knowledge('index'), { code: 0, stdout: indexed('recent/investigation/recent.md', 'new') + '1 new, 0 changed, 0 removed, 0 unchanged.\n', stderr: '' });
    const status = (await knowledge('status')).stdout;
    assert.match(status, new RegExp(`^WARNING: decay_prune_below in ${knowledgeAt(root).config} is ignored: "high" is not false or a number from 0 to 1$`, 'm'));
    assert.match(status, new RegExp(`^Pruned below the decay floor: 1\\n  ${at('buried/investigation/buried.md')}$`, 'm'));
  });

  it('builds a missing store under the configured provider, empty where nothing is indexable', async () => {
    configureKnowledge(root, STUB);
    assert.deepStrictEqual(await knowledge('index'), { code: 0, stdout: '0 new, 0 changed, 0 removed, 0 unchanged.\n', stderr: '' });
    assert.strictEqual(knowledgeMetadata(root).provider, 'stub');
    assert.strictEqual(storedChunks(root).length, 0);
    assert.strictEqual((await knowledge('check')).stdout, 'ready\n');
  });

  it('builds past metadata left without its store, recording the new store\'s mode', async () => {
    store.writeMetadata(knowledgeAt(root).metadata, { ...OPENAI, last_indexed: null });
    assert.strictEqual((await knowledge('index')).code, 0);
    assert.strictEqual(knowledgeMetadata(root).provider, null);
    assert.strictEqual((await knowledge('check')).stdout, 'ready\n');
  });

  it('from a subdirectory finds the project\'s artifacts, and neither it nor status reads a source as deleted', async () => {
    feature('auth');
    knowledgeUnit(root, 'seeded', 'epic', { imports: [{ path: 'imports/seed.md', imported_at: '2026-05-10T10:00:00Z' }] });
    write('seeded/imports/seed.md');
    const subdirectory = at('auth/investigation');
    const fromSubdirectory = (/** @type {string[]} */ args) => engineKnowledge(subdirectory, args);

    assert.strictEqual((await fromSubdirectory(['index'])).stdout,
      indexed('auth/investigation/auth.md', 'new') + indexed('seeded/imports/seed.md', 'new') + '2 new, 0 changed, 0 removed, 0 unchanged.\n');
    assert.strictEqual((await fromSubdirectory(['index'])).stdout, '0 new, 0 changed, 0 removed, 2 unchanged.\n');
    const status = (await fromSubdirectory(['status'])).stdout;
    assert.match(status, /^Total chunks: 2$/m);
    assert.doesNotMatch(status, /Retired since indexing/);
  });
});

describe('engine knowledge fill', () => {
  let root;

  beforeEach(() => {
    root = setupFixture('kb-fill-door-');
    configureKnowledge(root, KEYWORD_ONLY);
  });

  afterEach(() => cleanupFixture(root));

  it('gives a keyword-only store the provider configured over it, every chunk its vector, and says nothing', async () => {
    knowledgeUnit(root, 'auth', 'bugfix');
    createFile(statePath(root), 'auth/investigation/auth.md', '# Investigation\n\nToken refresh settled.\n');
    await engineKnowledge(root, ['index', '.leeway/auth/investigation/auth.md']);
    assert.strictEqual(knowledgeMetadata(root).provider, null);

    configureKnowledge(root, STUB);
    assert.deepStrictEqual(await engineKnowledge(root, ['fill']), { code: 0, stdout: '', stderr: '' });
    const { provider, fill_failure: shortfall } = knowledgeMetadata(root);
    assert.deepStrictEqual({ provider, shortfall }, { provider: 'stub', shortfall: null });
    assert.match((await engineKnowledge(root, ['status'])).stdout, /^Chunks awaiting vectors: 0$/m);
  });
});
