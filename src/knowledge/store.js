// The knowledge store: every chunk with its text, its metadata and — when it
// has one — its vector, searched by keyword (keyword.js) and by vector
// (cosine similarity), and kept in one file of its own format.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const keyword = require('./keyword');

/** The store's file in the knowledge directory. */
const STORE_FILE = 'store.bin';

/** The metadata's file in the knowledge directory. */
const METADATA_FILE = 'metadata.json';

const REQUIRED_FIELDS = [
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
 * @typedef {object} Chunk
 * @property {string} id
 * @property {string} content
 * @property {string} work_unit
 * @property {string} work_type
 * @property {string} phase
 * @property {string} topic
 * @property {string} confidence
 * @property {string} source_file
 * @property {string} [source_hash]  the sha256 of the source file the chunk was cut from
 * @property {string} content_hash  the sha256 of `content` — the text its vector embeds
 * @property {number} timestamp
 */

/**
 * @typedef {object} Entry
 * @property {Chunk} chunk
 * @property {Float32Array|null} vector
 * @property {number} norm  the vector's length — 0 without one
 * @property {import('./keyword').FieldTerms[]} terms  field by field
 */

/**
 * @typedef {object} Store
 * @property {Entry[]} entries  in insertion order, a removal closing the gap
 * @property {Set<string>} ids
 * @property {number|null} dimensions  the vectors' width — null while the store holds none
 * @property {import('./keyword').Vocabulary} vocabulary
 * @property {import('./keyword').Postings[]|null} index  built by the first keyword search after a write
 */

/**
 * @typedef {Record<string, {eq: string} | {in: string[]}>} Where  a value, or one of several, per chunk field
 */

/** @returns {Store} */
function createStore() {
  return { entries: [], ids: new Set(), dimensions: null, vocabulary: new keyword.Vocabulary(), index: null };
}

/** @param {string} text */
function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * A chunk's fields in one order, whichever path builds it.
 * @param {Record<string, any>} fields @param {string} content @param {string} hash
 * @returns {Chunk}
 */
function chunkOf(fields, content, hash) {
  return {
    id: fields.id,
    content,
    work_unit: fields.work_unit,
    work_type: fields.work_type,
    phase: fields.phase,
    topic: fields.topic,
    confidence: fields.confidence,
    source_file: fields.source_file,
    source_hash: fields.source_hash,
    content_hash: hash,
    timestamp: fields.timestamp,
  };
}

/** @param {Record<string, any>} doc */
function assertAllRequiredFields(doc) {
  for (const f of REQUIRED_FIELDS) {
    if (doc[f] === undefined || doc[f] === null) {
      throw new Error(`insertDocument: missing required field "${f}"`);
    }
  }
  if (typeof doc.timestamp !== 'number' || !Number.isFinite(doc.timestamp)) {
    throw new Error('insertDocument: timestamp must be a finite number (epoch ms)');
  }
}

/**
 * The vector an inserted document carries — null without one.
 * @param {Store} db @param {unknown} embedding
 * @returns {Float32Array|null}
 */
function vectorOf(db, embedding) {
  if (embedding === undefined) return null;
  if (embedding === null) {
    throw new Error('insertDocument: embedding cannot be null — omit it for a chunk without a vector');
  }
  if (!Array.isArray(embedding) && !(embedding instanceof Float32Array)) {
    throw new Error('insertDocument: embedding must be an array of numbers when present');
  }
  if (db.dimensions !== null && embedding.length !== db.dimensions) {
    throw new Error(`insertDocument: embedding is ${embedding.length} wide, and the store's vectors are ${db.dimensions}`);
  }
  return Float32Array.from(embedding);
}

/** @param {ArrayLike<number>} vector */
function magnitude(vector) {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i] * vector[i];
  return Math.sqrt(sum);
}

/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Insert a chunk — `embedding`, its vector, omitted for a chunk without one.
 * A chunk id already in the store is refused: a re-index removes an
 * identity's chunks before it inserts their replacements.
 * @param {Store} db @param {Record<string, any>} doc
 */
function insertDocument(db, doc) {
  if (doc == null || typeof doc !== 'object') {
    throw new Error('insertDocument: doc must be an object');
  }
  assertAllRequiredFields(doc);
  if (db.ids.has(doc.id)) {
    throw new Error(`insertDocument: a chunk with id "${doc.id}" already exists`);
  }
  const vector = vectorOf(db, doc.embedding);
  const chunk = chunkOf(doc, doc.content, contentHash(doc.content));
  db.entries.push({ chunk, vector, norm: vector ? magnitude(vector) : 0, terms: keyword.termsOf(chunk, db.vocabulary) });
  db.ids.add(chunk.id);
  if (vector) db.dimensions = vector.length;
  db.index = null;
}

/**
 * Whether a chunk passes every field's filter.
 * @param {Where} [where]
 * @returns {(chunk: Chunk) => boolean}
 */
function admitter(where) {
  const clauses = Object.entries(where || {}).map(([field, clause]) => ({
    field,
    values: 'in' in clause ? clause.in : [clause.eq],
  }));
  return (chunk) => clauses.every(({ field, values }) => values.includes(chunk[field]));
}

/** @param {string} caller @param {Where} where */
function requireWhere(caller, where) {
  if (!where || Object.keys(where).length === 0) {
    throw new Error(`${caller}: where clause is required`);
  }
}

/**
 * Remove every chunk matching a where-clause filter.
 * @param {Store} db @param {Where} where
 * @returns {number} how many were removed
 */
function removeByFilter(db, where) {
  requireWhere('removeByFilter', where);
  const admits = admitter(where);
  const kept = db.entries.filter((entry) => !admits(entry.chunk));
  const removed = db.entries.length - kept.length;
  if (removed > 0) {
    db.entries = kept;
    db.ids = new Set(kept.map((entry) => entry.chunk.id));
    if (!kept.some((entry) => entry.vector)) db.dimensions = null;
    db.index = null;
  }
  return removed;
}

/**
 * Remove every chunk of an identity (work_unit + phase + topic) — the
 * re-index primitive.
 * @param {Store} db @param {{work_unit: string, phase: string, topic: string}} identity
 * @returns {number} how many were removed
 */
function removeByIdentity(db, identity) {
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
 * How many chunks match a where-clause filter — what removeByFilter would remove.
 * @param {Store} db @param {Where} where
 */
function countByFilter(db, where) {
  requireWhere('countByFilter', where);
  const admits = admitter(where);
  return db.entries.filter((entry) => admits(entry.chunk)).length;
}

/**
 * Every chunk, in store order.
 * @param {Store} db
 * @returns {Chunk[]}
 */
function allChunks(db) {
  return db.entries.map((entry) => ({ ...entry.chunk }));
}

/**
 * Every vector the store holds, by the hash of the text it embeds.
 * @param {Store} db
 * @returns {Map<string, Float32Array>}
 */
function vectorsByContentHash(db) {
  const vectors = new Map();
  for (const { chunk, vector } of db.entries) {
    if (vector) vectors.set(chunk.content_hash, vector);
  }
  return vectors;
}

/**
 * The scored chunks as hits, best first — a tie in store order — cut to the limit.
 * @param {Store} db @param {Map<number, number>} scores  store position → score @param {number} limit
 */
function ranked(db, scores, limit) {
  return [...scores]
    .sort(([a, scoreA], [b, scoreB]) => scoreB - scoreA || a - b)
    .slice(0, limit)
    .map(([position, score]) => ({ ...db.entries[position].chunk, score }));
}

/** @param {Store} db */
function keywordIndex(db) {
  if (!db.index) db.index = keyword.indexOf(db.entries.map((entry) => entry.terms), db.vocabulary.words.length);
  return db.index;
}

/**
 * Every admitted chunk matching a word of the term, by BM25 score.
 * @param {Store} db @param {{term: string, where?: Where, limit?: number}} search
 */
function searchKeyword(db, { term, where, limit = Infinity }) {
  if (typeof term !== 'string') throw new Error('searchKeyword: term (string) is required');
  const admits = admitter(where);
  const scores = keyword.score(keywordIndex(db), db.vocabulary, term, (position) => admits(db.entries[position].chunk));
  return ranked(db, scores, limit);
}

/**
 * Every admitted chunk with a vector, by its cosine similarity to `vector` —
 * those under `similarity` left out.
 * @param {Store} db
 * @param {{vector: ArrayLike<number>, similarity: number, where?: Where, limit?: number}} search
 */
function searchVector(db, { vector, similarity, where, limit = Infinity }) {
  if (!Array.isArray(vector) && !(vector instanceof Float32Array)) {
    throw new Error('searchVector: vector (number[]) is required');
  }
  if (typeof similarity !== 'number') throw new Error('searchVector: similarity (number) is required');
  if (db.dimensions !== null && vector.length !== db.dimensions) {
    throw new Error(`searchVector: vector is ${vector.length} wide, and the store's vectors are ${db.dimensions}`);
  }
  const query = Float32Array.from(vector);
  const queryNorm = magnitude(query);
  const admits = admitter(where);
  /** @type {Map<number, number>} */
  const scores = new Map();
  db.entries.forEach((entry, position) => {
    if (!entry.vector || !admits(entry.chunk)) return;
    const cosine = dot(query, entry.vector) / (queryNorm * entry.norm);
    if (cosine >= similarity) scores.set(position, cosine);
  });
  return ranked(db, scores, limit);
}

// ---------------------------------------------------------------------------
// The file: a preamble (magic, format version, header length), a JSON header
// (the vectors' width, each chunk's metadata, the section table), then the
// sections, each 8-byte aligned so a typed array can view it in place.
// ---------------------------------------------------------------------------

const MAGIC = Buffer.from('KBSTORE\0', 'latin1');
const FORMAT_VERSION = 1;
const PREAMBLE_BYTES = MAGIC.length + 8;
const ALIGNMENT = 8;

/** @param {number} offset */
function aligned(offset) {
  return Math.ceil(offset / ALIGNMENT) * ALIGNMENT;
}

/** @param {number[]} lengths @returns {Uint32Array} where each ends, counted from the first's start */
function runningEnds(lengths) {
  const ends = new Uint32Array(lengths.length);
  let total = 0;
  lengths.forEach((length, i) => {
    total += length;
    ends[i] = total;
  });
  return ends;
}

/** @param {Uint32Array[]} arrays */
function joined(arrays) {
  const out = new Uint32Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let at = 0;
  for (const array of arrays) {
    out.set(array, at);
    at += array.length;
  }
  return out;
}

/** @param {Buffer|ArrayBufferView} data */
function bytesOf(data) {
  return Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * One field's terms as sections: where each chunk's words end, then every
 * chunk's word ids and counts, chunk after chunk.
 * @param {string} field @param {import('./keyword').FieldTerms[]} terms
 * @returns {Array<[string, Uint32Array]>}
 */
function termSections(field, terms) {
  return [
    [`${field}.ends`, runningEnds(terms.map((t) => t.words.length))],
    [`${field}.words`, joined(terms.map((t) => t.words))],
    [`${field}.counts`, joined(terms.map((t) => t.counts))],
  ];
}

/** @param {Entry[]} vectored  the entries with a vector @param {number} width */
function packedVectors(vectored, width) {
  const out = new Float32Array(vectored.length * width);
  vectored.forEach((entry, slot) => out.set(/** @type {Float32Array} */ (entry.vector), slot * width));
  return out;
}

/** @param {Store} db @returns {Buffer} */
function encodeStore(db) {
  const { words, chunks: terms } = keyword.compact(db.entries.map((entry) => entry.terms), db.vocabulary);
  const vectored = db.entries.filter((entry) => entry.vector);
  const texts = db.entries.map((entry) => Buffer.from(entry.chunk.content, 'utf8'));
  /** @type {Array<[string, Buffer|ArrayBufferView]>} */
  const sections = [
    ['text', Buffer.concat(texts)],
    ['text_ends', runningEnds(texts.map((text) => text.length))],
    ['words', Buffer.from(words.join('\n'), 'utf8')],
    ...keyword.FIELDS.flatMap((field, f) => termSections(field, terms.map((fields) => fields[f]))),
    ['norms', Float64Array.from(vectored, (entry) => entry.norm)],
    ['vectors', packedVectors(vectored, db.dimensions || 0)],
  ];
  const header = Buffer.from(JSON.stringify({
    dimensions: db.dimensions,
    chunks: db.entries.map(({ chunk, vector }) => {
      const { content, ...metadata } = chunk;
      return { ...metadata, vector: vector !== null };
    }),
    sections: sections.map(([name, data]) => [name, data.byteLength]),
  }), 'utf8');
  const preamble = Buffer.alloc(PREAMBLE_BYTES);
  MAGIC.copy(preamble);
  preamble.writeUInt32LE(FORMAT_VERSION, MAGIC.length);
  preamble.writeUInt32LE(header.length, MAGIC.length + 4);
  const parts = [preamble, header, ...sections.map(([, data]) => bytesOf(data))];
  return Buffer.concat(parts.flatMap((part) => [part, Buffer.alloc(aligned(part.length) - part.length)]));
}

/** @param {boolean} holds @param {string} problem */
function ensure(holds, problem) {
  if (!holds) throw new Error(problem);
}

/**
 * The file's sections by name, each bounds-checked.
 * @param {Buffer} buf @param {Array<[string, number]>} table @param {number} start
 * @returns {(name: string) => {offset: number, bytes: number}}
 */
function sectionReader(buf, table, start) {
  const sections = new Map();
  let offset = start;
  for (const [name, bytes] of table) {
    ensure(Number.isInteger(bytes) && bytes >= 0 && offset + bytes <= buf.length, `section ${name} runs past the end`);
    sections.set(name, { offset, bytes });
    offset = aligned(offset + bytes);
  }
  return (name) => {
    ensure(sections.has(name), `section ${name} is missing`);
    return sections.get(name);
  };
}

/**
 * A section as a typed array — a view in place, a copy where the buffer
 * leaves it unaligned.
 * @template {Uint32ArrayConstructor|Float32ArrayConstructor|Float64ArrayConstructor} T
 * @param {Buffer} buf @param {{offset: number, bytes: number}} section @param {T} Type
 * @returns {InstanceType<T>}
 */
function typed(buf, section, Type) {
  ensure(section.bytes % Type.BYTES_PER_ELEMENT === 0, 'a section splits an element');
  const at = buf.byteOffset + section.offset;
  const view = at % Type.BYTES_PER_ELEMENT === 0
    ? new Type(buf.buffer, at, section.bytes / Type.BYTES_PER_ELEMENT)
    : new Type(buf.buffer.slice(at, at + section.bytes));
  return /** @type {InstanceType<T>} */ (view);
}

/**
 * A chunk's terms for one field, read in place.
 * @param {Buffer} buf @param {(name: string) => {offset: number, bytes: number}} section
 * @param {string} field @param {number} count  how many chunks the store holds
 * @returns {(position: number) => import('./keyword').FieldTerms}
 */
function termsReader(buf, section, field, count) {
  const ends = typed(buf, section(`${field}.ends`), Uint32Array);
  const words = typed(buf, section(`${field}.words`), Uint32Array);
  const counts = typed(buf, section(`${field}.counts`), Uint32Array);
  ensure(ends.length === count && counts.length === words.length && (count === 0 ? words.length : ends[count - 1]) === words.length,
    `${field} terms out of step with the chunks`);
  return (position) => {
    const start = position === 0 ? 0 : ends[position - 1];
    return { words: words.subarray(start, ends[position]), counts: counts.subarray(start, ends[position]) };
  };
}

/** @param {Buffer} buf @returns {Store} */
function decodeStore(buf) {
  ensure(buf.length >= PREAMBLE_BYTES && buf.subarray(0, MAGIC.length).equals(MAGIC), 'not a knowledge store');
  const version = buf.readUInt32LE(MAGIC.length);
  ensure(version === FORMAT_VERSION, `format version ${version}, and this version reads ${FORMAT_VERSION}`);
  const headerEnd = PREAMBLE_BYTES + buf.readUInt32LE(MAGIC.length + 4);
  ensure(headerEnd <= buf.length, 'the header runs past the end');
  const header = JSON.parse(buf.toString('utf8', PREAMBLE_BYTES, headerEnd));
  const section = sectionReader(buf, header.sections, aligned(headerEnd));
  const count = header.chunks.length;

  const text = section('text');
  const textEnds = typed(buf, section('text_ends'), Uint32Array);
  ensure(textEnds.length === count && (count === 0 || textEnds[count - 1] <= text.bytes), 'chunk text out of step with the chunks');
  const words = section('words');
  const vocabulary = words.bytes === 0 ? [] : buf.toString('utf8', words.offset, words.offset + words.bytes).split('\n');
  const terms = keyword.FIELDS.map((field) => termsReader(buf, section, field, count));

  const dimensions = header.dimensions || 0;
  const norms = typed(buf, section('norms'), Float64Array);
  const vectors = typed(buf, section('vectors'), Float32Array);
  ensure(vectors.length === norms.length * dimensions, 'vectors out of step with their norms');

  let slot = 0;
  const entries = header.chunks.map((record, position) => {
    const start = text.offset + (position === 0 ? 0 : textEnds[position - 1]);
    const chunk = chunkOf(record, buf.toString('utf8', start, text.offset + textEnds[position]), record.content_hash);
    const vector = record.vector ? vectors.subarray(slot * dimensions, (slot + 1) * dimensions) : null;
    const norm = record.vector ? norms[slot++] : 0;
    return { chunk, vector, norm, terms: terms.map((field) => field(position)) };
  });
  ensure(slot === norms.length, 'vectors out of step with the chunks');

  return {
    entries,
    ids: new Set(entries.map((entry) => entry.chunk.id)),
    dimensions: header.dimensions,
    vocabulary: new keyword.Vocabulary(vocabulary),
    index: null,
  };
}

/**
 * Write the store to disk: to `<path>.tmp`, then renamed into place, so a
 * crash mid-write never leaves a truncated store where the real one was.
 * @param {Store} db @param {string} storePath
 */
function saveStore(db, storePath) {
  if (!storePath) throw new Error('saveStore: storePath is required');
  const tmp = storePath + '.tmp';
  fs.writeFileSync(tmp, encodeStore(db));
  fs.renameSync(tmp, storePath);
}

/**
 * A stamp of the store file as it stands. Every save writes a new file, so
 * the stamp changes with each one — a matching stamp means the file is the
 * one a load read. Null when there is no store.
 * @param {string} storePath
 * @returns {string|null}
 */
function storeStamp(storePath) {
  const stat = fs.statSync(storePath, { throwIfNoEntry: false });
  return stat ? `${stat.ino}:${stat.size}:${stat.mtimeMs}` : null;
}

/**
 * Load a store from disk. A file missing, empty, or not a store this version
 * reads — another format, another format version, or damaged — throws.
 * @param {string} storePath
 * @returns {Store}
 */
function loadStore(storePath) {
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
  try {
    return decodeStore(buf);
  } catch (e) {
    throw new Error(`loadStore: corrupted store file at ${storePath}: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// File locking — same discipline as the engine kernel's manifest-io.
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
// Metadata — sidecar JSON file tracking provider/model/dimensions and the
// last index time. Created on first index; this module only provides the
// read/write primitives.
// ---------------------------------------------------------------------------

const METADATA_FIELDS = ['provider', 'model', 'dimensions', 'last_indexed'];

function writeMetadata(metadataPath, data) {
  if (!metadataPath) throw new Error('writeMetadata: metadataPath is required');
  if (data == null || typeof data !== 'object') {
    throw new Error('writeMetadata: data must be an object');
  }
  // Every call writes exactly METADATA_FIELDS — no partial updates, and any
  // other key on `data` is dropped. Missing fields are normalised to explicit
  // null so keyword-only mode round-trips as
  // { provider: null, model: null, dimensions: null }.
  const full = {};
  for (const f of METADATA_FIELDS) full[f] = data[f] === undefined ? null : data[f];
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
  STORE_FILE,
  METADATA_FILE,
  METADATA_FIELDS,
  contentHash,
  createStore,
  insertDocument,
  removeByIdentity,
  removeByFilter,
  countByFilter,
  allChunks,
  vectorsByContentHash,
  searchKeyword,
  searchVector,
  saveStore,
  loadStore,
  storeStamp,
  acquireLock,
  releaseLock,
  withLock,
  writeMetadata,
  readMetadata,
};
