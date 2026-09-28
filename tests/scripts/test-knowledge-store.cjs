'use strict';

require('./hermetic-env.cjs');

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../src/knowledge/store.js');
const { tokenize } = require('../../src/knowledge/keyword.js');
const { StubProvider } = require('../../src/knowledge/embeddings.js');

const STUB_DIMS = 16;
const stub = new StubProvider({ dimensions: STUB_DIMS });

/** A chunk whose id and source path share no word with the tests' queries. */
function makeDoc(overrides = {}) {
  const id = overrides.id || 'doc-1';
  return {
    id,
    content: 'rate limiting prevents token refresh storms at the edge',
    work_unit: 'auth-flow',
    work_type: 'feature',
    phase: 'specification',
    topic: 'auth-flow',
    confidence: 'high',
    source_file: `x/${id}.md`,
    source_hash: 'a3f1c9e07b2d4a6e8f10c2b3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f607',
    timestamp: 1700000000000,
    ...overrides,
  };
}

/** A store holding a chunk per [id, content], each with the stub's vector for its text. */
function storeOf(...chunks) {
  const db = store.createStore();
  for (const [id, content, overrides] of chunks) {
    store.insertDocument(db, makeDoc({ id, content, embedding: stub.embed(content), ...overrides }));
  }
  return db;
}

/** @param {Array<{id: string, score: number}>} hits */
function scores(hits) {
  return Object.fromEntries(hits.map((h) => [h.id, h.score]));
}

const K1 = 1.2;
const B = 0.75;

/** BM25 as the store owes it: Lucene's IDF, raw term counts, length in tokens. */
function bm25({ count, matching, size, length, average }) {
  const idf = Math.log(1 + (size - matching + 0.5) / (matching + 0.5));
  return (idf * count * (K1 + 1)) / (count + K1 * (1 - B + (B * length) / average));
}

describe('knowledge store — chunks', () => {
  it('inserts a chunk, recording the sha256 of its text', () => {
    const db = storeOf(['doc-1', 'rate limiting at the edge']);
    const [chunk] = store.allChunks(db);
    assert.strictEqual(chunk.content_hash, crypto.createHash('sha256').update('rate limiting at the edge').digest('hex'));
    assert.strictEqual(chunk.content_hash, store.contentHash(chunk.content));
  });

  it('refuses a missing field, a null or non-array embedding, and an id already stored', () => {
    const db = storeOf(['dup', 'first version']);
    const withoutTopic = makeDoc();
    delete withoutTopic.topic;
    assert.throws(() => store.insertDocument(db, withoutTopic), /missing required field "topic"/);
    assert.throws(() => store.insertDocument(db, makeDoc({ timestamp: 'today' })), /timestamp must be a finite number/);
    assert.throws(() => store.insertDocument(db, makeDoc({ embedding: null })), /cannot be null/);
    assert.throws(() => store.insertDocument(db, makeDoc({ embedding: 'bad' })), /must be an array/);
    assert.throws(() => store.insertDocument(db, makeDoc({ id: 'dup', content: 'second version' })), /"dup" already exists/);
  });

  it('refuses a vector of another width than the store\'s', () => {
    const db = storeOf(['a', 'alpha']);
    assert.throws(() => store.insertDocument(db, makeDoc({ id: 'b', embedding: [1, 0, 0] })), /3 wide, and the store's vectors are 16/);
  });

  it('enumerates every chunk in store order, each a copy', () => {
    const db = storeOf(['a', 'alpha'], ['b', 'beta'], ['c', 'gamma']);
    const chunks = store.allChunks(db);
    assert.deepStrictEqual(chunks.map((c) => c.id), ['a', 'b', 'c']);
    chunks[0].content = 'changed';
    assert.strictEqual(store.allChunks(db)[0].content, 'alpha');
  });

  it('removes an identity\'s chunks, and nothing else', () => {
    const db = storeOf(
      ['spec-1', 'rate limiting section one'],
      ['spec-2', 'rate limiting section two'],
      ['other', 'rate limiting data model', { work_unit: 'data-model', topic: 'data-model' }],
    );
    assert.strictEqual(store.removeByIdentity(db, { work_unit: 'auth-flow', phase: 'specification', topic: 'auth-flow' }), 2);
    assert.deepStrictEqual(store.allChunks(db).map((c) => c.id), ['other']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'rate' }).map((h) => h.id), ['other']);
    assert.strictEqual(store.removeByIdentity(db, { work_unit: 'nothing', phase: 'discussion', topic: 'nothing' }), 0);
    assert.throws(() => store.removeByIdentity(db, { work_unit: 'x', phase: 'y' }), /all required/);
  });

  it('counts and removes by a filter of values or lists of values', () => {
    const db = storeOf(
      ['s', 'shared', { phase: 'specification' }],
      ['d', 'shared', { phase: 'discussion' }],
      ['r', 'shared', { phase: 'research' }],
    );
    assert.strictEqual(store.countByFilter(db, { phase: { in: ['specification', 'discussion'] } }), 2);
    assert.strictEqual(store.removeByFilter(db, { phase: { eq: 'research' } }), 1);
    assert.deepStrictEqual(store.allChunks(db).map((c) => c.id), ['s', 'd']);
    assert.throws(() => store.countByFilter(db, {}), /where clause is required/);
  });

  it('holds chunks without a vector beside chunks with one', () => {
    const db = storeOf(['with-vec', 'authentication token refresh']);
    store.insertDocument(db, makeDoc({ id: 'without-vec', content: 'authentication session cookie' }));
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'authentication' }).map((h) => h.id).sort(), ['with-vec', 'without-vec']);
    assert.deepStrictEqual(
      store.searchVector(db, { vector: stub.embed('authentication session cookie'), similarity: -1 }).map((h) => h.id),
      ['with-vec'],
    );
  });

  it('keys each vector by the hash of the text it embeds', () => {
    const db = storeOf(['a', 'the same words'], ['b', 'the same words', { topic: 'elsewhere' }], ['c', 'other words']);
    store.insertDocument(db, makeDoc({ id: 'bare', content: 'no vector here' }));
    const vectors = store.vectorsByContentHash(db);
    assert.deepStrictEqual([...vectors.keys()].sort(), [store.contentHash('the same words'), store.contentHash('other words')].sort());
    assert.deepStrictEqual([...vectors.get(store.contentHash('the same words'))], [...Float32Array.from(stub.embed('the same words'))]);
  });
});

describe('knowledge store — keyword search', () => {
  it('returns every matching chunk the filters admit, best first, cut to the limit', () => {
    const db = storeOf(['a', 'alpha alpha beta'], ['b', 'alpha gamma delta epsilon'], ['c', 'zeta']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'alpha' }).map((h) => h.id), ['a', 'b']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'alpha', limit: 1 }).map((h) => h.id), ['a']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'nothing here' }), []);
  });

  it('matches a word only by an identical word — never by a prefix', () => {
    const db = storeOf(['a', 'limiting throttles'], ['b', 'limit throttle']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'limit' }).map((h) => h.id), ['b']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'throttles' }).map((h) => h.id), ['a']);
  });

  it('returns hits in the chunk\'s shape, with a score', () => {
    const db = storeOf(['a', 'alpha']);
    const [hit] = store.searchKeyword(db, { term: 'alpha' });
    assert.deepStrictEqual(Object.keys(hit), [
      'id', 'content', 'work_unit', 'work_type', 'phase', 'topic', 'confidence',
      'source_file', 'source_hash', 'content_hash', 'timestamp', 'score',
    ]);
    assert.strictEqual(typeof hit.score, 'number');
  });

  it('counts document frequency by chunk, not by occurrence', () => {
    const db = storeOf(['a', 'alpha alpha alpha'], ['b', 'beta gamma delta']);
    const [hit] = store.searchKeyword(db, { term: 'alpha' });
    assert.ok(hit.score > 0, 'three occurrences in one chunk are one document of two');
    assert.strictEqual(hit.score, bm25({ count: 3, matching: 1, size: 2, length: 3, average: 3 }));
  });

  it('scores raw term counts — a word said twice outscores one said once', () => {
    const db = storeOf(['twice', 'alpha alpha beta gamma'], ['once', 'alpha beta gamma delta']);
    const scored = scores(store.searchKeyword(db, { term: 'alpha' }));
    assert.strictEqual(scored.twice, bm25({ count: 2, matching: 2, size: 2, length: 4, average: 4 }));
    assert.strictEqual(scored.once, bm25({ count: 1, matching: 2, size: 2, length: 4, average: 4 }));
    assert.ok(scored.twice > scored.once);
  });

  it('measures a field in tokens, repeats included', () => {
    const db = storeOf(['repeats', 'alpha alpha alpha alpha'], ['distinct', 'alpha beta']);
    const scored = scores(store.searchKeyword(db, { term: 'alpha' }));
    assert.strictEqual(scored.repeats, bm25({ count: 4, matching: 2, size: 2, length: 4, average: 3 }));
    assert.strictEqual(scored.distinct, bm25({ count: 1, matching: 2, size: 2, length: 2, average: 3 }));
  });

  it('keeps a word in every chunk positive — Lucene\'s IDF never goes negative', () => {
    const db = storeOf(['a', 'alpha beta'], ['b', 'alpha gamma'], ['c', 'alpha delta']);
    const hits = store.searchKeyword(db, { term: 'alpha' });
    assert.strictEqual(hits.length, 3);
    for (const hit of hits) assert.strictEqual(hit.score, bm25({ count: 1, matching: 3, size: 3, length: 2, average: 2 }));
    assert.ok(hits[0].score > 0);
  });

  it('treats constructor and __proto__ as words like any other', () => {
    const db = storeOf(['ctor', 'the constructor runs once'], ['proto', 'a __proto__ key pollutes']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'constructor' }).map((h) => h.id), ['ctor']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: '__proto__' }).map((h) => h.id), ['proto']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'toString hasOwnProperty valueOf' }), []);
  });

  it('tokenizes a query exactly as it tokenized the chunks', () => {
    const db = storeOf(['a', 'Rate-Limiting: the CAFÉ\'s déjà-vu, v2_final']);
    for (const term of ['rate-limiting', 'RATE-LIMITING', "café's", "cafe's", 'deja-vu', 'V2_FINAL']) {
      assert.deepStrictEqual(store.searchKeyword(db, { term }).map((h) => h.id), ['a'], term);
    }
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'rate' }), [], 'a hyphenated word is one token');
  });

  it('scores an empty field as zero tokens long, and never returns it', () => {
    const db = storeOf(['words', 'alpha beta'], ['empty', ''], ['punctuation', '!!! ... ???']);
    const hits = store.searchKeyword(db, { term: 'alpha' });
    assert.deepStrictEqual(hits.map((h) => h.id), ['words']);
    assert.strictEqual(hits[0].score, bm25({ count: 1, matching: 1, size: 3, length: 2, average: 2 / 3 }));
  });

  it('scores each field on its own, with its own average length, and sums the fields', () => {
    const db = storeOf(['both', 'alpha beta', { source_file: 'alpha/notes.md' }], ['content', 'alpha gamma delta']);
    const scored = scores(store.searchKeyword(db, { term: 'alpha' }));
    const content = (length) => bm25({ count: 1, matching: 2, size: 2, length, average: 2.5 });
    const sourceFile = bm25({ count: 1, matching: 1, size: 2, length: 3, average: 3 });
    assert.strictEqual(scored.both, content(2) + sourceFile);
    assert.strictEqual(scored.content, content(3));
  });

  it('a query word said twice counts once', () => {
    const db = storeOf(['a', 'alpha beta'], ['b', 'gamma']);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'alpha alpha ALPHA' }), store.searchKeyword(db, { term: 'alpha' }));
  });

  it('a filter selects chunks and never changes how one scores', () => {
    const db = storeOf(
      ['disc', 'alpha beta', { phase: 'discussion' }],
      ['res', 'alpha gamma delta', { phase: 'research' }],
      ['other', 'zeta', { phase: 'research' }],
    );
    const unfiltered = scores(store.searchKeyword(db, { term: 'alpha' }));
    const filtered = store.searchKeyword(db, { term: 'alpha', where: { phase: { eq: 'discussion' } } });
    assert.deepStrictEqual(filtered.map((h) => h.id), ['disc']);
    assert.strictEqual(filtered[0].score, unfiltered.disc);
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'alpha', where: { phase: { in: ['research'] }, topic: { eq: 'auth-flow' } } }).map((h) => h.id), ['res']);
  });

  it('scores the store as it stands after a removal', () => {
    const db = storeOf(['a', 'alpha beta'], ['b', 'alpha gamma'], ['c', 'delta']);
    store.removeByIdentity(db, { work_unit: 'auth-flow', phase: 'specification', topic: 'auth-flow' });
    store.insertDocument(db, makeDoc({ id: 'd', content: 'alpha epsilon' }));
    assert.deepStrictEqual(scores(store.searchKeyword(db, { term: 'alpha' })), { d: bm25({ count: 1, matching: 1, size: 1, length: 2, average: 2 }) });
  });
});

describe('knowledge store — tokenizer', () => {
  it('lowercases, folds à è é ì ò ó ù, splits on all but a-z, digits, _, \' and -, and keeps repeats', () => {
    assert.deepStrictEqual(tokenize("Hello, World! It's rate-limiting_v2 — hello ÀÉÌ"), ['hello', 'world', "it's", 'rate-limiting_v2', 'hello', 'aei']);
    assert.deepStrictEqual(tokenize('naïve über'), ['na', 've', 'ber'], 'an accent the split drops splits the word');
    assert.deepStrictEqual(tokenize('  ...  '), []);
  });
});

describe('knowledge store — vector search', () => {
  it('ranks by cosine similarity, most similar first', () => {
    const db = store.createStore();
    store.insertDocument(db, makeDoc({ id: 'far', embedding: [0, 1] }));
    store.insertDocument(db, makeDoc({ id: 'near', embedding: [0.8, 0.6] }));
    store.insertDocument(db, makeDoc({ id: 'same', embedding: [2, 0] }));
    const hits = store.searchVector(db, { vector: [1, 0], similarity: -1 });
    assert.deepStrictEqual(hits.map((h) => h.id), ['same', 'near', 'far']);
    assert.deepStrictEqual(hits.map((h) => Math.round(h.score * 1e6) / 1e6), [1, 0.8, 0]);
  });

  it('leaves out a chunk under the similarity threshold, and keeps one at it', () => {
    const db = store.createStore();
    store.insertDocument(db, makeDoc({ id: 'same', embedding: [1, 0] }));
    store.insertDocument(db, makeDoc({ id: 'near', embedding: [0.6, 0.8] }));
    store.insertDocument(db, makeDoc({ id: 'far', embedding: [0.2, 0.98] }));
    assert.deepStrictEqual(store.searchVector(db, { vector: [2, 0], similarity: 0.3 }).map((h) => h.id), ['same', 'near']);
    assert.deepStrictEqual(store.searchVector(db, { vector: [2, 0], similarity: 1 }).map((h) => h.id), ['same']);
  });

  it('searches only the chunks the filters admit, cut to the limit', () => {
    const db = storeOf(['a', 'alpha', { topic: 'alpha' }], ['b', 'beta', { topic: 'beta' }], ['c', 'gamma', { topic: 'beta' }]);
    const query = stub.embed('any query');
    assert.deepStrictEqual(store.searchVector(db, { vector: query, similarity: -1, where: { topic: { eq: 'beta' } } }).map((h) => h.id).sort(), ['b', 'c']);
    assert.strictEqual(store.searchVector(db, { vector: query, similarity: -1, limit: 1 }).length, 1);
  });

  it('refuses a search without a vector, a threshold, or at another width', () => {
    const db = storeOf(['a', 'alpha']);
    assert.throws(() => store.searchVector(db, { similarity: 0 }), /vector \(number\[\]\) is required/);
    assert.throws(() => store.searchVector(db, { vector: stub.embed('a') }), /similarity \(number\) is required/);
    assert.throws(() => store.searchVector(db, { vector: [1, 0], similarity: 0 }), /2 wide, and the store's vectors are 16/);
  });
});

describe('knowledge store — the file', () => {
  let tmpDir;
  let file;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-'));
    file = path.join(tmpDir, store.STORE_FILE);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** A store holding a vectored chunk, a vectorless one and a hashless one. */
  function mixedStore() {
    const db = storeOf(['vectored', 'rate limiting persistence test'], ['empty', '']);
    store.insertDocument(db, makeDoc({ id: 'bare', content: 'keyword only — no vector', source_hash: undefined }));
    return db;
  }

  it('round-trips every chunk, vector and score', () => {
    const db = mixedStore();
    store.saveStore(db, file);
    const loaded = store.loadStore(file);

    assert.deepStrictEqual(store.allChunks(loaded), store.allChunks(db));
    assert.strictEqual(store.allChunks(loaded)[2].source_hash, undefined);
    for (const term of ['rate persistence', 'keyword vector', 'absent']) {
      assert.deepStrictEqual(store.searchKeyword(loaded, { term }), store.searchKeyword(db, { term }));
    }
    const query = stub.embed('rate limiting persistence test');
    assert.deepStrictEqual(store.searchVector(loaded, { vector: query, similarity: -1 }), store.searchVector(db, { vector: query, similarity: -1 }));
    assert.deepStrictEqual(store.vectorsByContentHash(loaded), store.vectorsByContentHash(db));
  });

  it('round-trips an empty store, and a store whose writes emptied it', () => {
    store.saveStore(store.createStore(), file);
    assert.deepStrictEqual(store.allChunks(store.loadStore(file)), []);

    const db = mixedStore();
    store.removeByFilter(db, { work_unit: { eq: 'auth-flow' } });
    store.saveStore(db, file);
    const loaded = store.loadStore(file);
    assert.deepStrictEqual(store.allChunks(loaded), []);
    store.insertDocument(loaded, makeDoc({ id: 'next', content: 'alpha', embedding: [1, 0, 0] }));
    assert.deepStrictEqual(store.searchVector(loaded, { vector: [1, 0, 0], similarity: 0 }).map((h) => h.id), ['next']);
  });

  it('keeps a loaded store writable — removals, inserts, and a save that drops the words no chunk uses', () => {
    const db = storeOf(['a', 'alpha unique-to-a'], ['b', 'alpha beta']);
    store.saveStore(db, file);
    const loaded = store.loadStore(file);
    store.removeByIdentity(loaded, { work_unit: 'auth-flow', phase: 'specification', topic: 'auth-flow' });
    store.insertDocument(loaded, makeDoc({ id: 'c', content: 'alpha gamma', embedding: stub.embed('alpha gamma') }));
    store.saveStore(loaded, file);
    const again = store.loadStore(file);
    assert.deepStrictEqual(again.vocabulary.words.sort(), ['alpha', 'c', 'gamma', 'md', 'x']);
    assert.deepStrictEqual(store.searchKeyword(again, { term: 'alpha' }).map((h) => h.id), ['c']);
    assert.deepStrictEqual(store.searchKeyword(again, { term: 'unique-to-a' }), []);
  });

  it('writes through a temporary file renamed into place, and refuses a directory that does not exist', () => {
    store.saveStore(mixedStore(), file);
    assert.deepStrictEqual(fs.readdirSync(tmpDir), [store.STORE_FILE]);
    assert.throws(() => store.saveStore(mixedStore(), path.join(tmpDir, 'nested', 'store.bin')), /ENOENT/);
  });

  it('refuses a file that is missing or empty', () => {
    assert.throws(() => store.loadStore(file), /loadStore: store file not found/);
    fs.writeFileSync(file, '');
    assert.throws(() => store.loadStore(file), /loadStore: store file is empty/);
  });

  it('reads a file of another format, another format version, or damage as a corrupted store', () => {
    store.saveStore(mixedStore(), file);
    const good = fs.readFileSync(file);
    const cases = {
      'not a knowledge store': Buffer.from('this is garbage data, not a store'),
      'format version 2, and this version reads 1': (() => {
        const bytes = Buffer.from(good);
        bytes.writeUInt32LE(2, 8);
        return bytes;
      })(),
      'runs past the end': good.subarray(0, good.length - 64),
    };
    for (const [problem, bytes] of Object.entries(cases)) {
      fs.writeFileSync(file, bytes);
      assert.throws(() => store.loadStore(file), (err) => err.message.startsWith(`loadStore: corrupted store file at ${file}: `) && err.message.includes(problem), problem);
    }
  });

  const PREAMBLE_BYTES = 16;
  const HEADER_LENGTH_AT = 12;
  /** @param {number} offset */
  const aligned = (offset) => Math.ceil(offset / 8) * 8;

  /** The file's header, and the offset each section starts at. */
  function layoutOf(bytes) {
    const headerEnd = PREAMBLE_BYTES + bytes.readUInt32LE(HEADER_LENGTH_AT);
    const header = JSON.parse(bytes.toString('utf8', PREAMBLE_BYTES, headerEnd));
    const starts = {};
    let offset = aligned(headerEnd);
    for (const [name, length] of header.sections) {
      starts[name] = offset;
      offset = aligned(offset + length);
    }
    return { header, headerEnd, starts };
  }

  /** A header's section-table entry — `[name, bytes]`. */
  function sectionEntry(header, name) {
    return header.sections.find(([section]) => section === name);
  }

  /** The file with its header rewritten by `edit`, its sections kept byte for byte. */
  function withHeader(bytes, edit) {
    const { header, headerEnd } = layoutOf(bytes);
    edit(header);
    const json = Buffer.from(JSON.stringify(header), 'utf8');
    const preamble = Buffer.from(bytes.subarray(0, PREAMBLE_BYTES));
    preamble.writeUInt32LE(json.length, HEADER_LENGTH_AT);
    return Buffer.concat([preamble, json, Buffer.alloc(aligned(json.length) - json.length), bytes.subarray(aligned(headerEnd))]);
  }

  /** The file with the last end a section records one past where it truly falls. */
  function withLastEndPastItsData(bytes, name) {
    const { header, starts } = layoutOf(bytes);
    const at = starts[name] + sectionEntry(header, name)[1] - 4;
    const damaged = Buffer.from(bytes);
    damaged.writeUInt32LE(damaged.readUInt32LE(at) + 1, at);
    return damaged;
  }

  const damage = {
    'the header runs past the end': (good) => {
      const damaged = Buffer.from(good);
      damaged.writeUInt32LE(good.length, HEADER_LENGTH_AT);
      return damaged;
    },
    'section text runs past the end': (good) => withHeader(good, (header) => { sectionEntry(header, 'text')[1] = good.length; }),
    'section words is missing': (good) => withHeader(good, (header) => { sectionEntry(header, 'words')[0] = 'renamed'; }),
    'a section splits an element': (good) => withHeader(good, (header) => { sectionEntry(header, 'text_ends')[1] -= 1; }),
    'chunk text out of step with the chunks': (good) => withLastEndPastItsData(good, 'text_ends'),
    'content terms out of step with the chunks': (good) => withLastEndPastItsData(good, 'content.ends'),
    'vectors out of step with their norms': (good) => withHeader(good, (header) => { header.dimensions /= 2; }),
    'vectors out of step with the chunks': (good) => withHeader(good, (header) => { header.chunks[0].vector = false; }),
  };

  for (const [problem, damaged] of Object.entries(damage)) {
    it(`reads a damaged file as a corrupted store, naming the damage: ${problem}`, () => {
      store.saveStore(mixedStore(), file);
      fs.writeFileSync(file, damaged(fs.readFileSync(file)));
      assert.throws(() => store.loadStore(file), { message: `loadStore: corrupted store file at ${file}: ${problem}` });
    });
  }

  it('stamps the file as it stands, and nothing where there is none', () => {
    assert.strictEqual(store.storeStamp(file), null);
    store.saveStore(mixedStore(), file);
    const first = store.storeStamp(file);
    assert.match(first, /^\d+:\d+:[\d.]+$/);
    store.saveStore(storeOf(['a', 'alpha']), file);
    assert.notStrictEqual(store.storeStamp(file), first);
  });
});

describe('knowledge store — locking', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-lock-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('acquires and releases a file lock', async () => {
    const lockPath = path.join(tmpDir, '.lock');
    await store.acquireLock(lockPath);
    assert.ok(fs.existsSync(lockPath));
    store.releaseLock(lockPath);
    assert.ok(!fs.existsSync(lockPath));
  });

  it('withLock wraps execution and releases on success', async () => {
    const lockPath = path.join(tmpDir, '.lock');
    const observed = await store.withLock(lockPath, async () => {
      assert.ok(fs.existsSync(lockPath));
      return 'ok';
    });
    assert.strictEqual(observed, 'ok');
    assert.ok(!fs.existsSync(lockPath));
  });

  it('withLock releases the lock even when the wrapped function throws', async () => {
    const lockPath = path.join(tmpDir, '.lock');
    await assert.rejects(() =>
      store.withLock(lockPath, async () => {
        throw new Error('boom');
      })
    );
    assert.ok(!fs.existsSync(lockPath));
  });

  it('detects and cleans stale locks older than 30s', async () => {
    const lockPath = path.join(tmpDir, '.lock');
    fs.writeFileSync(lockPath, '99999');
    const past = Date.now() / 1000 - 60;
    fs.utimesSync(lockPath, past, past);
    await store.acquireLock(lockPath);
    assert.ok(fs.existsSync(lockPath));
    store.releaseLock(lockPath);
  });
});

describe('knowledge store — metadata', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-meta-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('writes metadata.json with exactly its 4 fields', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    store.writeMetadata(metaPath, {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      last_indexed: '2026-04-10T12:34:56.789Z',
    });
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.deepStrictEqual(parsed, {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      last_indexed: '2026-04-10T12:34:56.789Z',
    });
  });

  it('drops the retired retry-queue arrays on the next write', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify({
      provider: null, model: null, dimensions: null, last_indexed: null,
      pending: [{ file: 'x.md', failed_at: '2026-04-10T12:00:00.000Z', error: 'oops' }],
      pending_removals: [{ workUnit: 'gone', attempts: 3 }],
    }));
    const meta = store.readMetadata(metaPath);
    meta.last_indexed = '2026-04-11T00:00:00.000Z';
    store.writeMetadata(metaPath, meta);
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.strictEqual('pending' in parsed, false);
    assert.strictEqual('pending_removals' in parsed, false);
    assert.strictEqual(parsed.last_indexed, '2026-04-11T00:00:00.000Z');
  });

  it('normalises missing fields to explicit null — keyword-only mode round-trips', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    store.writeMetadata(metaPath, { last_indexed: '2026-04-10T00:00:00.000Z' });
    assert.deepStrictEqual(store.readMetadata(metaPath), {
      provider: null,
      model: null,
      dimensions: null,
      last_indexed: '2026-04-10T00:00:00.000Z',
    });
  });

  it('throws a clear error when metadata.json is missing or not JSON', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    assert.throws(() => store.readMetadata(metaPath), /not found/);
    fs.writeFileSync(metaPath, 'not json {');
    assert.throws(() => store.readMetadata(metaPath), /invalid JSON/);
  });
});
