// Knowledge base store — thin wrapper around Orama.
//
// This module grows across Phase 1 tasks:
//   1-3 (this file)     create, insert, remove-by-identity, fulltext search
//   1-4 (next)          vector search, hybrid search
//   1-5                 save/load via MsgPack
//
// All search functions return results in a normalised shape (see
// `normaliseHit` below) so callers (CLI, tests) never touch Orama's
// native result format directly.

'use strict';

const fs = require('fs');
const orama = require('@orama/orama');
const { encode, decode } = require('@msgpack/msgpack');

const SCHEMA_FIELDS = [
  'id',
  'content',
  'work_unit',
  'work_type',
  'phase',
  'topic',
  'confidence',
  'source_file',
  'timestamp',
];

/**
 * Build the Orama schema. The vector dimensionality comes from the
 * embedding provider's dimensions() at store creation time — 128 for
 * the StubProvider default, 1536 for OpenAI text-embedding-3-small,
 * etc. In keyword-only production mode (no provider) callers should
 * still supply a sensible default (e.g., 1536) so the schema exists;
 * documents simply omit the embedding field instead of passing null.
 */
function buildSchema(dimensions) {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(`createStore: dimensions must be a positive integer, got ${dimensions}`);
  }
  return {
    id: 'string',
    content: 'string',
    work_unit: 'enum',
    work_type: 'enum',
    phase: 'enum',
    topic: 'enum',
    confidence: 'enum',
    source_file: 'string',
    timestamp: 'number',
    embedding: `vector[${dimensions}]`,
  };
}

/**
 * Create a new Orama database instance for the knowledge store.
 *
 * @param {number} dimensions vector dimensionality from the provider
 * @returns {Promise<object>} Orama database instance
 */
async function createStore(dimensions) {
  const schema = buildSchema(dimensions);
  return orama.create({ schema });
}

function assertAllRequiredFields(doc) {
  for (const f of SCHEMA_FIELDS) {
    if (doc[f] === undefined || doc[f] === null) {
      throw new Error(`insertDocument: missing required field "${f}"`);
    }
  }
  if (typeof doc.timestamp !== 'number' || !Number.isFinite(doc.timestamp)) {
    throw new Error('insertDocument: timestamp must be a finite number (epoch ms)');
  }
}

/**
 * Insert a single document. The `embedding` field is OPTIONAL — include
 * an array for providers that produce vectors, omit it entirely for
 * keyword-only mode. NEVER pass null for `embedding`: Orama crashes on
 * null vectors. This function actively guards against that.
 *
 * @param {object} db   Orama database instance
 * @param {object} doc  document with non-vector fields; embedding is optional
 * @returns {Promise<string>} the inserted document's internal id
 */
async function insertDocument(db, doc) {
  if (doc == null || typeof doc !== 'object') {
    throw new Error('insertDocument: doc must be an object');
  }
  assertAllRequiredFields(doc);

  const payload = {};
  for (const f of SCHEMA_FIELDS) payload[f] = doc[f];

  if ('embedding' in doc) {
    if (doc.embedding === null) {
      throw new Error(
        'insertDocument: embedding cannot be null (Orama crashes on null vectors). ' +
          'Omit the field for keyword-only mode, or pass a real vector.'
      );
    }
    if (doc.embedding !== undefined) {
      if (!Array.isArray(doc.embedding)) {
        throw new Error('insertDocument: embedding must be an array of numbers when present');
      }
      payload.embedding = doc.embedding;
    }
  }

  return orama.insert(db, payload);
}

// Page size for whole-store enumeration. Paged iteration replaces a
// previous fixed `limit: 100000` so very large stores are not silently
// truncated. 1000 keeps round-trip overhead negligible for in-process
// Orama while bounding peak memory per page.
const ENUMERATION_PAGE_SIZE = 1000;

// Limit for filtered single-shot reads. Orama's `where` clause is an
// indexed lookup — the matched subset is small in practice (one identity,
// one phase, one work unit), so a single search with a high limit is the
// right shape. Pagination is reserved for unfiltered whole-store
// enumeration because Orama 3.1.x's offset+where combination drops pages.
//
// 1M is well above any realistic per-identity / per-topic / per-phase
// chunk count (a giant topic might have low thousands; a per-work-unit
// remove on a long-lived project, low tens of thousands). Orama
// pre-allocates an array of size `limit` for results, so this cannot be
// `Number.MAX_SAFE_INTEGER` — it would throw RangeError.
const FILTERED_QUERY_LIMIT = 1_000_000;

/**
 * Enumerate every document in the store, paged via offset+limit until
 * exhausted. Used by status, compact, and any caller that needs a
 * complete unfiltered view. Filtered enumerations should call Orama's
 * `where` directly with an unbounded limit (see findInternalIdsByIdentity).
 */
async function searchAllFulltext(db) {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await orama.search(db, {
      term: '',
      limit: ENUMERATION_PAGE_SIZE,
      offset,
    });
    if (res.hits.length === 0) break;
    all.push(...res.hits.map(normaliseHit));
    if (res.hits.length < ENUMERATION_PAGE_SIZE) break;
    offset += ENUMERATION_PAGE_SIZE;
  }
  return all;
}

/**
 * Find all internal document IDs whose (work_unit, phase, topic) matches
 * the given identity key. Internal IDs are what `removeMultiple` accepts.
 */
async function findInternalIdsByIdentity(db, { work_unit, phase, topic }) {
  const res = await orama.search(db, {
    term: '',
    where: {
      work_unit: { eq: work_unit },
      phase: { eq: phase },
      topic: { eq: topic },
    },
    limit: FILTERED_QUERY_LIMIT,
  });
  return res.hits.map((h) => h.id);
}

/**
 * Remove every document matching the identity key (work_unit + phase +
 * topic). This is the re-index primitive: remove existing chunks for an
 * identity, then insert fresh ones. No-op if nothing matches.
 *
 * @returns {Promise<number>} number of documents removed
 */
async function removeByIdentity(db, identity) {
  if (!identity || !identity.work_unit || !identity.phase || !identity.topic) {
    throw new Error('removeByIdentity: work_unit, phase, and topic are all required');
  }
  return removeByFilter(db, {
    work_unit: { eq: identity.work_unit },
    phase: { eq: identity.phase },
    topic: { eq: identity.topic },
  });
}

/**
 * Remove every document matching a where-clause filter. Generalises
 * removal by any combination of enum fields. Used by the remove command
 * for work-unit-level, phase-level, or topic-level granularity.
 *
 * @param {object} db       Orama database instance
 * @param {object} where    Orama where clause (e.g., { work_unit: { eq: 'x' } })
 * @returns {Promise<number>} number of documents removed
 */
async function removeByFilter(db, where) {
  if (!where || Object.keys(where).length === 0) {
    throw new Error('removeByFilter: where clause is required');
  }
  const res = await orama.search(db, {
    term: '',
    where,
    limit: FILTERED_QUERY_LIMIT,
  });
  const ids = res.hits.map((h) => h.id);
  if (ids.length === 0) return 0;
  // Orama's sync removeMultiple chains batches via setTimeout but
  // returns the result count after only the first batch — pass
  // batchSize == ids.length to force a single batch and get an
  // accurate total when removing > 1000 chunks.
  const removed = await orama.removeMultiple(db, ids, ids.length);
  return removed;
}

/**
 * Count chunks matching `where` without deleting. Used by `remove --dry-run`.
 * Same query shape as removeByFilter so the count is guaranteed to match
 * what a non-dry-run invocation would actually remove.
 */
async function countByFilter(db, where) {
  if (!where || Object.keys(where).length === 0) {
    throw new Error('countByFilter: where clause is required');
  }
  const res = await orama.search(db, {
    term: '',
    where,
    limit: FILTERED_QUERY_LIMIT,
  });
  return res.hits.length;
}

function normaliseHit(hit) {
  const d = hit.document || {};
  return {
    id: d.id,
    content: d.content,
    work_unit: d.work_unit,
    work_type: d.work_type,
    phase: d.phase,
    topic: d.topic,
    confidence: d.confidence,
    source_file: d.source_file,
    timestamp: d.timestamp,
    score: hit.score,
  };
}

/**
 * Full-text (BM25) search with optional metadata filtering. Returns
 * results in the normalised shape that every search variant will use.
 *
 * @param {object} db
 * @param {{ term?: string, where?: object, limit?: number }} params
 * @returns {Promise<Array<object>>}
 */
async function searchFulltext(db, { term = '', where, limit = 10 } = {}) {
  const query = { term, limit };
  if (where && Object.keys(where).length > 0) {
    query.where = where;
  }
  const res = await orama.search(db, query);
  return res.hits.map(normaliseHit);
}

/**
 * Vector similarity search (cosine, Orama default).
 *
 * @param {object} db
 * @param {{ vector: number[], where?: object, limit?: number, similarity?: number }} params
 * @returns {Promise<Array<object>>}
 */
async function searchVector(db, { vector, where, limit = 10, similarity } = {}) {
  if (!Array.isArray(vector)) {
    throw new Error('searchVector: vector (number[]) is required');
  }
  const query = {
    mode: 'vector',
    vector: { value: vector, property: 'embedding' },
    limit,
  };
  if (typeof similarity === 'number') query.similarity = similarity;
  if (where && Object.keys(where).length > 0) query.where = where;
  const res = await orama.search(db, query);
  return res.hits.map(normaliseHit);
}

/**
 * Hybrid search — combines BM25 text scoring with vector similarity.
 * Defaults: textWeight 0.4, vectorWeight 0.6 (from design doc).
 *
 * @param {object} db
 * @param {{
 *   term: string,
 *   vector: number[],
 *   where?: object,
 *   limit?: number,
 *   textWeight?: number,
 *   vectorWeight?: number,
 *   similarity?: number
 * }} params
 * @returns {Promise<Array<object>>}
 */
async function searchHybrid(
  db,
  {
    term,
    vector,
    where,
    limit = 10,
    textWeight = 0.4,
    vectorWeight = 0.6,
    similarity,
  } = {}
) {
  if (typeof term !== 'string') {
    throw new Error('searchHybrid: term (string) is required');
  }
  if (!Array.isArray(vector)) {
    throw new Error('searchHybrid: vector (number[]) is required');
  }
  const query = {
    mode: 'hybrid',
    term,
    vector: { value: vector, property: 'embedding' },
    hybridWeights: { text: textWeight, vector: vectorWeight },
    limit,
  };
  if (typeof similarity === 'number') query.similarity = similarity;
  if (where && Object.keys(where).length > 0) query.where = where;
  const res = await orama.search(db, query);
  return res.hits.map(normaliseHit);
}

// ---------------------------------------------------------------------------
// Persistence — MsgPack on disk via Orama save()/load()
// ---------------------------------------------------------------------------

/**
 * Persist a store to disk as a MsgPack binary. The schema is stashed
 * alongside the raw Orama data so loadStore can reconstruct a fresh
 * store with matching dimensionality before calling Orama's load().
 *
 * Atomic write: write to `<path>.tmp`, then rename — same pattern as
 * manifest.cjs writeManifestAtomic so a crash mid-save never leaves a
 * truncated .msp file where the real one used to be.
 */
async function saveStore(db, storePath) {
  if (!storePath) throw new Error('saveStore: storePath is required');
  const raw = orama.save(db);
  const envelope = {
    v: 1,
    schema: db.schema,
    raw,
  };
  const buf = encode(envelope);
  const tmp = storePath + '.tmp';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, storePath);
}

/**
 * Load a store from disk. Reads the MsgPack envelope, creates a fresh
 * Orama instance with the stashed schema, then calls Orama load() to
 * populate it.
 *
 * Throws a clear error if the file is missing, empty, or corrupted.
 */
async function loadStore(storePath) {
  if (!storePath) throw new Error('loadStore: storePath is required');
  if (!fs.existsSync(storePath)) {
    throw new Error(`loadStore: store file not found at ${storePath}`);
  }
  let buf;
  try {
    buf = fs.readFileSync(storePath);
  } catch (e) {
    throw new Error(`loadStore: failed to read ${storePath}: ${e.message}`);
  }
  if (buf.length === 0) {
    throw new Error(`loadStore: store file is empty at ${storePath}`);
  }

  let envelope;
  try {
    envelope = decode(buf);
  } catch (e) {
    throw new Error(`loadStore: corrupted store file at ${storePath}: ${e.message}`);
  }
  if (!envelope || typeof envelope !== 'object' || !envelope.schema || !envelope.raw) {
    throw new Error(`loadStore: malformed envelope at ${storePath}`);
  }

  const db = await orama.create({ schema: envelope.schema });
  orama.load(db, envelope.raw);
  return db;
}

// ---------------------------------------------------------------------------
// File locking — adapted from manifest.cjs (lines 80-127).
//
// WRITE operations (saveStore) must be wrapped in withLock. READ
// operations (loadStore, all searches) do NOT lock — stale reads are
// acceptable per the design doc.
// ---------------------------------------------------------------------------

const LOCK_STALE_MS = 30000;
const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 30000;

function tryAcquire(lockPath) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    return false;
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(lockPath) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    if (tryAcquire(lockPath)) return;

    // Stale lock detection
    try {
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        try { fs.unlinkSync(lockPath); } catch (_) { /* already gone */ }
        continue;
      }
    } catch (_) {
      // Lock disappeared between attempts — retry
      continue;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `knowledge store: timed out waiting for lock at ${lockPath}. ` +
        'If no other process is running, delete the file manually.'
      );
    }

    // Async sleep — yields to the event loop so other work (including
    // the lock holder's own release) can progress.
    await sleepMs(LOCK_RETRY_MS);
  }
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch (_) { /* already gone */ }
}

async function withLock(lockPath, fn) {
  await acquireLock(lockPath);
  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}

// ---------------------------------------------------------------------------
// Metadata — sidecar JSON file tracking provider/model/dimensions and
// indexing state. Created on first index by Task 3-3; this module only
// provides the read/write primitives.
// ---------------------------------------------------------------------------

const METADATA_FIELDS = [
  'provider', 'model', 'dimensions', 'last_indexed', 'pending', 'pending_removals',
];

function writeMetadata(metadataPath, data) {
  if (!metadataPath) throw new Error('writeMetadata: metadataPath is required');
  if (data == null || typeof data !== 'object') {
    throw new Error('writeMetadata: data must be an object');
  }
  // Every call writes the full schema — no partial updates. Missing
  // fields are normalised to explicit null so keyword-only mode round-
  // trips as { provider: null, model: null, dimensions: null }.
  //
  // IMPORTANT: every persisted field must be listed here. A missing field
  // silently strips across writes and every downstream feature using that
  // field stops working (see deferred-issue #18 pending_removals, which
  // shipped broken because this whitelist was not updated).
  const full = {
    provider: data.provider === undefined ? null : data.provider,
    model: data.model === undefined ? null : data.model,
    dimensions: data.dimensions === undefined ? null : data.dimensions,
    last_indexed: data.last_indexed === undefined ? null : data.last_indexed,
    pending: Array.isArray(data.pending) ? data.pending : [],
    pending_removals: Array.isArray(data.pending_removals) ? data.pending_removals : [],
  };
  const tmp = metadataPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(full, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, metadataPath);
}

function readMetadata(metadataPath) {
  if (!metadataPath) throw new Error('readMetadata: metadataPath is required');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`readMetadata: metadata file not found at ${metadataPath}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(metadataPath, 'utf8');
  } catch (e) {
    throw new Error(`readMetadata: failed to read ${metadataPath}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`readMetadata: invalid JSON at ${metadataPath}: ${e.message}`);
  }
  return parsed;
}

module.exports = {
  SCHEMA_FIELDS,
  METADATA_FIELDS,
  buildSchema,
  createStore,
  insertDocument,
  removeByIdentity,
  removeByFilter,
  countByFilter,
  searchFulltext,
  searchAllFulltext,
  searchVector,
  searchHybrid,
  saveStore,
  loadStore,
  acquireLock,
  releaseLock,
  withLock,
  writeMetadata,
  readMetadata,
};
