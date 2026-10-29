'use strict';

// `engine knowledge index <file>` — the single-file index through the door:
// each kind of artifact written at the identity its path derives, a re-index
// replacing what the file held, the metadata a first index writes, a chunk
// dated by its file, every path the door refuses, and every store it may not
// write. Verb layer: the door in process (knowledge-harness), over the
// project world copied for each test, the knowledge keyword-only unless the
// test's subject is the store's provider. The bulk index is
// test-engine-knowledge-bulk.cjs's.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { setupFixture, cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const {
  KEYWORD_ONLY, STUB, OPENAI, engineKnowledge, knowledgeDoor, refuseLaunches, knowledgeUnit, setItems, configureKnowledge, knowledgeAt,
  knowledgeMetadata, storedChunks, systemConfigDir,
} = require('./knowledge-harness.cjs');

refuseLaunches();

/** A section of prose long enough to be a chunk of its own. @param {string} heading @param {string} body */
const section = (heading, body) => `## ${heading}\n\n${body}\n\n${Array.from({ length: 30 }, (_, i) => `Line ${i} of the reasoning.`).join('\n')}\n`;

describe('engine knowledge index <file>', () => {
  let root;

  const { knowledge, at } = knowledgeDoor(() => root);
  /** @param {string} rel @param {string} text */
  const write = (rel, text) => createFile(statePath(root), rel, text);

  beforeEach(() => {
    root = setupFixture('kb-index-');
    configureKnowledge(root, KEYWORD_ONLY);
  });

  afterEach(() => cleanupFixture(root));

  it('writes each kind of artifact at the identity its path derives, its phase\'s confidence and its unit\'s type, each beside the others', async () => {
    knowledgeUnit(root, 'auth', 'feature');
    knowledgeUnit(root, 'payments', 'epic');
    knowledgeUnit(root, 'login', 'bugfix');
    const artifacts = [
      ['auth/discussion/auth.md', 'auth', 'feature', 'discussion', 'auth', 'low-medium'],
      ['auth/specification/auth/specification.md', 'auth', 'feature', 'specification', 'auth', 'high'],
      ['payments/research/exploration.md', 'payments', 'epic', 'research', 'exploration', 'low'],
      ['login/investigation/login.md', 'login', 'bugfix', 'investigation', 'login', 'medium'],
      ['payments/imports/seed-conversation.md', 'payments', 'epic', 'imports', 'seed-conversation', 'low'],
      ['login/seeds/2026-05-30-login.md', 'login', 'bugfix', 'seeds', '2026-05-30-login', 'low'],
      ['payments/.state/discovery-gap-analysis.md', 'payments', 'epic', 'analysis', 'gap-analysis', 'low'],
      ['payments/discovery/sessions/session-001.md', 'payments', 'epic', 'discovery', 'session-001', 'low'],
      ['payments/discovery/sessions/session-002.md', 'payments', 'epic', 'discovery', 'session-002', 'low'],
      ['.baseline/overview.md', 'baseline', 'baseline', 'baseline', 'overview', 'low'],
      ['.roadmap/sessions/session-001.md', 'roadmap', 'roadmap', 'roadmap', 'session-001', 'low'],
    ];
    for (const [rel] of artifacts) {
      write(rel, `# ${rel}\n\nWhat ${rel} settled.\n`);
      assert.deepStrictEqual(await knowledge('index', `.leeway/${rel}`), { code: 0, stdout: `Indexed 1 chunks from ${at(rel)}\n`, stderr: '' });
    }
    const identities = storedChunks(root).map((c) => [c.source_file, c.work_unit, c.work_type, c.phase, c.topic, c.confidence]);
    assert.deepStrictEqual(identities, artifacts);
    const { stdout } = await knowledge('query', 'settled', '--limit', '20');
    for (const [rel, unit, , phase, topic, confidence] of artifacts) {
      assert.match(stdout, new RegExp(`^\\[${phase} \\| ${unit}/${topic} \\| ${confidence} \\| \\d{4}-\\d{2}-\\d{2}\\]$`, 'm'), rel);
      assert.ok(stdout.includes(`\nSource: ${at(rel)}:L`), rel);
    }
  });

  it('replaces the chunks a re-index finds the file no longer holds', async () => {
    knowledgeUnit(root, 'auth', 'feature');
    write('auth/discussion/auth.md', `# Discussion\n\n${section('One', 'First.')}\n${section('Two', 'Second.')}`);
    await knowledge('index', '.leeway/auth/discussion/auth.md');
    assert.strictEqual(storedChunks(root).length, 2);

    write('auth/discussion/auth.md', '# Discussion\n\nOne settled line.\n');
    assert.strictEqual((await knowledge('index', '.leeway/auth/discussion/auth.md')).code, 0);
    assert.deepStrictEqual(storedChunks(root).map((c) => c.content), ['# Discussion\n\nOne settled line.']);
  });

  it('re-indexes an unchanged file to the same chunks, whatever its kind', async () => {
    knowledgeUnit(root, 'payments', 'epic');
    for (const rel of ['payments/discussion/ledger.md', 'payments/imports/seed.md', 'payments/.state/discovery-gap-analysis.md']) {
      write(rel, `# Notes\n\n${section('One', 'First.')}\n${section('Two', 'Second.')}`);
      await knowledge('index', `.leeway/${rel}`);
      const first = storedChunks(root).map((c) => c.id);
      await knowledge('index', `.leeway/${rel}`);
      assert.deepStrictEqual(storedChunks(root).map((c) => c.id), first, rel);
    }
  });

  it('writes the five metadata fields at a first keyword-only index, every chunk carrying its file\'s sha256', async () => {
    knowledgeUnit(root, 'auth', 'feature');
    const file = write('auth/discussion/auth.md', `# Discussion\n\n${section('One', 'First.')}\n${section('Two', 'Second.')}`);
    await knowledge('index', '.leeway/auth/discussion/auth.md');
    const { last_indexed: lastIndexed, ...identity } = knowledgeMetadata(root);
    assert.deepStrictEqual(Object.keys(knowledgeMetadata(root)), ['provider', 'model', 'dimensions', 'last_indexed', 'fill_failure']);
    assert.deepStrictEqual(identity, { provider: null, model: null, dimensions: null, fill_failure: null });
    assert.ok(!Number.isNaN(Date.parse(lastIndexed)));
    assert.deepStrictEqual([...new Set(storedChunks(root).map((c) => c.source_hash))], [store.contentHash(fs.readFileSync(file, 'utf8'))]);
  });

  it('moves last_indexed at each index', async () => {
    knowledgeUnit(root, 'auth', 'feature');
    write('auth/discussion/auth.md', '# Discussion\n\nSettled.\n');
    await knowledge('index', '.leeway/auth/discussion/auth.md');
    store.writeMetadata(knowledgeAt(root).metadata, { ...knowledgeMetadata(root), last_indexed: '2020-01-01T00:00:00.000Z' });
    await knowledge('index', '.leeway/auth/discussion/auth.md');
    assert.ok(knowledgeMetadata(root).last_indexed > '2020-01-02');
  });

  it('dates each chunk by its file\'s mtime, never the index run, and a query shows that date', async () => {
    knowledgeUnit(root, 'auth', 'feature');
    const file = write('auth/discussion/auth.md', '# Discussion\n\nToken refresh settled.\n');
    const mtime = new Date('2020-06-15T12:00:00Z');
    fs.utimesSync(file, mtime, mtime);
    await knowledge('index', '.leeway/auth/discussion/auth.md');
    assert.deepStrictEqual(storedChunks(root).map((c) => c.timestamp), [mtime.getTime()]);
    assert.match((await knowledge('query', 'token')).stdout, /^\[discussion \| auth\/auth \| low-medium \| 2020-06-15\]$/m);
  });

  describe('a path it refuses, building nothing', () => {
    /** The refusal the door gives for `given`, run from the project root. @param {string} given @param {RegExp|string} said */
    async function refused(given, said) {
      const answer = await knowledge('index', given);
      assert.strictEqual(answer.code, 1, given);
      assert.strictEqual(answer.stdout, '', given);
      if (typeof said === 'string') assert.strictEqual(answer.stderr, said, given);
      else assert.match(answer.stderr, said, given);
      assert.ok(!fs.existsSync(knowledgeAt(root).store), `${given}: no store built`);
    }

    it('a file outside the state, the state of another checkout among them, named by its absolute path', async () => {
      write('../outside.md', 'hello\n');
      await refused('outside.md', `Not in the workflows state: ${path.join(root, 'outside.md')}\n`);
      const other = setupFixture('kb-index-other-');
      try {
        const elsewhere = createFile(statePath(other), 'auth/discussion/elsewhere.md', '# Discussion\n\nElsewhere.\n');
        await refused(elsewhere, `Not in the workflows state: ${elsewhere}\n`);
      } finally {
        cleanupFixture(other);
      }
      await refused('.leeway/../etc/discussion/foo.md', `Not in the workflows state: ${path.join(root, 'etc/discussion/foo.md')}\n`);
    });

    it('a file the state does not hold', async () => {
      knowledgeUnit(root, 'auth', 'feature');
      await refused('.leeway/auth/discussion/auth.md', `File not found: ${at('auth/discussion/auth.md')}\n`);
    });

    it('a path no identity derives from, said as the error alone', async () => {
      knowledgeUnit(root, 'auth', 'feature');
      const DOTS = 'dots are not allowed. Work-unit and topic names double as manifest dot-path and knowledge-identity segments, '
        + 'so a dot leaves the artifact indexable but unreachable by status, remove, and discovery.';
      const CACHES = 'only analysis caches (discovery-gap-analysis) are indexable.';
      for (const [rel, said] of [
        ['auth/planning/auth/planning.md', 'Cannot derive identity from path: auth/planning/auth/planning.md\nExpected path matching: {work_unit}/{phase}/...'],
        ['auth/discussion/sub/topic.md', 'Unexpected discussion path structure: sub/topic.md\nExpected: {work_unit}/discussion/{topic}.md'],
        ['.hidden/discussion/foo.md', 'Invalid work unit name: ".hidden"'],
        ['.hidden/.state/discovery-gap-analysis.md', 'Invalid work unit name: ".hidden"'],
        ['auth/.state/research-analysis.md', `Refusing to index .state file "research-analysis.md" — ${CACHES}`],
        ['auth/.state/migrations.md', `Refusing to index .state file "migrations.md" — ${CACHES}`],
        ['.baseline/.state/agenda.md', 'Unexpected baseline path structure: .state/agenda.md\nExpected: .baseline/{topic}.md'],
        ['dot.unit/discussion/dot.unit.md', `Invalid work unit name "dot.unit": ${DOTS}`],
        ['auth/discussion/a.b.md', `Invalid topic name "a.b": ${DOTS}`],
        ['.baseline/dotted.name.md', `Invalid topic name "dotted.name": ${DOTS}`],
        ['auth/imports/diagram.png', 'Refusing to index auth/imports/diagram.png — imports are tracked on the manifest; only markdown imports are indexed.'],
      ]) {
        write(rel, '# Heading\n\nSome content.\n');
        await refused(`.leeway/${rel}`, `Error: ${said}\n`);
      }
    });

    it('an empty file, whose index would wipe its identity\'s chunks', async () => {
      knowledgeUnit(root, 'auth', 'feature');
      write('auth/discussion/auth.md', '\n');
      await refused('.leeway/auth/discussion/auth.md',
        new RegExp(`^Failed to index ${at('auth/discussion/auth.md').replace(/[.]/g, '\\.')}: No chunks produced from .*\\nThe next start will retry it\\.\\n$`));
    });
  });

  describe('over the store it finds', () => {
    beforeEach(() => {
      knowledgeUnit(root, 'auth', 'feature');
      setItems(root, 'auth', { discussion: ['auth'] });
      write('auth/discussion/auth.md', '# Discussion\n\nToken refresh settled.\n');
    });

    /** The single-file index's refusal, the store's bytes as they were. @param {RegExp} said */
    async function refusedOverStore(said) {
      const before = fs.readFileSync(knowledgeAt(root).store);
      const answer = await knowledge('index', '.leeway/auth/discussion/auth.md');
      assert.strictEqual(answer.code, 1);
      assert.strictEqual(answer.stdout, '');
      assert.match(answer.stderr, said);
      assert.ok(fs.readFileSync(knowledgeAt(root).store).equals(before), 'the store untouched');
    }

    it('a store another provider built, naming the rebuild', async () => {
      await knowledge('index', '.leeway/auth/discussion/auth.md');
      configureKnowledge(root, STUB);
      store.writeMetadata(knowledgeAt(root).metadata, { ...knowledgeMetadata(root), ...OPENAI });
      await refusedOverStore(/^Failed to index .*: Provider\/model changed since last index\. Run `.* knowledge rebuild` to reindex\.\n  Store: provider=openai, model=text-embedding-3-small, dimensions=1536\n  Config: provider=stub, model=stub, dimensions=16\nThe next start will retry it\.\n$/);
    });

    it('a store with vectors once the config names no provider, naming the rebuild', async () => {
      configureKnowledge(root, STUB);
      assert.strictEqual((await knowledge('index')).code, 0);
      configureKnowledge(root, KEYWORD_ONLY);
      await refusedOverStore(/^Failed to index .*: Provider\/model changed since last index\. Run `.* knowledge rebuild` to reindex\.\n  Store was indexed with: provider=stub, model=stub\n  Current config has no provider configured\.\nThe next start will retry it\.\n$/);
    });

    it('no store, where no configuration chose keyword-only and none names a provider', async (t) => {
      configureKnowledge(root, {});
      const env = { WORKFLOWS_CONFIG_DIR: systemConfigDir(t) };
      for (const args of [['index', '.leeway/auth/discussion/auth.md'], ['index']]) {
        const answer = await engineKnowledge(root, args, env);
        assert.strictEqual(answer.code, 1, args.join(' '));
        assert.match(answer.stderr, /no embedding provider is configured and keyword-only was never chosen/, args.join(' '));
      }
      assert.ok(!fs.existsSync(knowledgeAt(root).store));
      assert.ok(!fs.existsSync(knowledgeAt(root).metadata));
    });

    it('no store, where the provider\'s key does not resolve — never a keyword-only store in its place', async (t) => {
      configureKnowledge(root, {});
      const env = { WORKFLOWS_CONFIG_DIR: systemConfigDir(t, { 'config.json': JSON.stringify({ knowledge: OPENAI }) }) };
      const single = await engineKnowledge(root, ['index', '.leeway/auth/discussion/auth.md'], env);
      assert.strictEqual(single.code, 1);
      assert.match(single.stderr, /no store is created without it/);
      assert.strictEqual((await engineKnowledge(root, ['index'], env)).code, 1);
      assert.ok(!fs.existsSync(knowledgeAt(root).store));
    });

    it('writes an edit by keyword into a store whose provider\'s key does not resolve, saying only what it wrote', async () => {
      await knowledge('index', '.leeway/auth/discussion/auth.md');
      store.writeMetadata(knowledgeAt(root).metadata, { ...knowledgeMetadata(root), ...OPENAI });
      configureKnowledge(root, OPENAI);
      fs.appendFileSync(at('auth/discussion/auth.md'), 'A late addition to the discussion.\n');
      assert.deepStrictEqual(await knowledge('index', '.leeway/auth/discussion/auth.md'),
        { code: 0, stdout: `Indexed 1 chunks from ${at('auth/discussion/auth.md')}\n`, stderr: '' });
      assert.match((await knowledge('query', 'late addition')).stdout, /^A late addition to the discussion\.$/m);
    });

    it('a store that cannot be loaded, naming the file and that the next start retries it', async () => {
      fs.writeFileSync(knowledgeAt(root).store, 'garbage-not-a-store');
      await refusedOverStore(new RegExp(`^Failed to index ${at('auth/discussion/auth.md').replace(/[.]/g, '\\.')}: .*\\nThe next start will retry it\\.\\n$`));
    });
  });

  it('builds past metadata left without its store, recording the new store\'s mode', async () => {
    knowledgeUnit(root, 'auth', 'feature');
    write('auth/discussion/auth.md', '# Discussion\n\nSettled.\n');
    store.writeMetadata(knowledgeAt(root).metadata, { ...OPENAI, last_indexed: null });
    assert.strictEqual((await knowledge('index', '.leeway/auth/discussion/auth.md')).code, 0);
    assert.strictEqual(knowledgeMetadata(root).provider, null);
    assert.deepStrictEqual(await knowledge('check'), { code: 0, stdout: 'ready\n', stderr: '' });
  });
});
