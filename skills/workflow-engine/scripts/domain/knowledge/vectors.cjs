'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the store's vectors — the one part of the knowledge base that
// waits, since it talks to the embedding provider. The chunks without a
// vector are embedded outside the lock, batch by batch, and each batch's
// vectors saved under it into the chunks whose text they embed, so a failure
// part-way keeps what landed.
//
// The keyword side's writers do not wait for this: a transaction, a
// single-file index and boot write their chunks and launch the vector fill —
// a detached `engine knowledge fill` — when a provider that can embed is
// configured and chunks await vectors. One fill works at a time; a fill that
// falls short records why in the store's metadata, where the next search's
// note and the next boot's warning read it, and one that lands everything
// clears it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const store = require('../../kernel/knowledge/store.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { withRetry, RETRY } = require('../../kernel/knowledge/retry.cjs');
const { InvalidRequestError } = require('../../kernel/knowledge/providers/openai-engine.cjs');
const { tryClaimFile } = require('../../kernel/manifest-io.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { currentStore, recordWrite, readStore } = require('./indexing.cjs');
const { loadSettings, indexProvider, canEmbed, storeMetadata, assertStoreEmbedder } = require('./embedder.cjs');
const { readManifests } = require('./artifacts.cjs');
const { indexPruning } = require('./decay.cjs');

/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */
/** @typedef {import('../../kernel/knowledge/store.cjs').Chunk} Chunk */
/** @typedef {import('./embedder.cjs').Config} Config */
/** @typedef {import('./embedder.cjs').EmbeddingProvider} EmbeddingProvider */
/** @typedef {import('./embedder.cjs').KeylessProvider} KeylessProvider */
/** @typedef {import('./indexing.cjs').Snapshot} Snapshot */

// Each batch is one embed call and one whole-store save once it lands: an
// interrupted run loses at most one batch.
const VECTOR_BATCH_TEXTS = 100;

/**
 * @typedef {object} Unembedded  a file whose vectors failed
 * @property {string} file
 * @property {Error} error
 */

/**
 * @typedef {object} Vectoring  what embedding the chunks without a vector did
 * @property {Unembedded[]} unembedded
 * @property {number} awaiting  the chunks still without the vector they await
 */

/** @typedef {Array<{file: string, texts: Map<string, string>}>} VectorBatch  each file's texts, by the hash of each */

/**
 * The chunks' texts, each once under the first file holding it, packed file
 * by file into batches of about VECTOR_BATCH_TEXTS texts — a file never
 * split, one larger than a batch alone in its own.
 * @param {Chunk[]} chunks
 * @returns {VectorBatch[]}
 */
function vectorBatches(chunks) {
  /** @type {Map<string, Map<string, string>>} */
  const byFile = new Map();
  const seen = new Set();
  for (const { source_file: file, content_hash: hash, content } of chunks) {
    if (seen.has(hash)) continue;
    seen.add(hash);
    let texts = byFile.get(file);
    if (!texts) {
      texts = new Map();
      byFile.set(file, texts);
    }
    texts.set(hash, content);
  }
  /** @type {VectorBatch[]} */
  const batches = [];
  let size = Infinity;
  for (const [file, texts] of byFile) {
    if (size + texts.size > VECTOR_BATCH_TEXTS) {
      batches.push([]);
      size = 0;
    }
    batches[batches.length - 1].push({ file, texts });
    size += texts.size;
  }
  return batches;
}

/**
 * The texts' vectors from one embed call, a transient failure retried.
 * @param {EmbeddingProvider} embedder @param {Map<string, string>} texts  by hash
 * @returns {Promise<Map<string, number[]>>} by hash
 */
async function embedTexts(embedder, texts) {
  const vectors = await withRetry(async () => embedder.embedBatch([...texts.values()]), RETRY);
  return new Map([...texts.keys()].map((hash, i) => [hash, vectors[i]]));
}

/**
 * A file's vectors text by text, and the last failure that left a text
 * without its own. Any failure but the endpoint refusing the text ends it.
 * @param {EmbeddingProvider} embedder @param {Map<string, string>} texts  by hash
 * @returns {Promise<{vectors: Map<string, number[]>, error: Error|null}>}
 */
async function embedTextByText(embedder, texts) {
  /** @type {Map<string, number[]>} */
  const vectors = new Map();
  /** @type {Error|null} */
  let error = null;
  for (const [hash, text] of texts) {
    try {
      vectors.set(hash, /** @type {number[]} */ ((await embedTexts(embedder, new Map([[hash, text]]))).get(hash)));
    } catch (failure) {
      error = /** @type {Error} */ (failure);
      if (!(failure instanceof InvalidRequestError)) break;
    }
  }
  return { vectors, error };
}

/**
 * A file's vectors, and the failure that left any text without its own: one
 * call for them all, or — when the endpoint refuses an input among them —
 * text by text, so only the refused text goes without.
 * @param {EmbeddingProvider} embedder @param {Map<string, string>} texts  by hash
 * @returns {Promise<{vectors: Map<string, number[]>, error: Error|null}>}
 */
async function embedFile(embedder, texts) {
  try {
    return { vectors: await embedTexts(embedder, texts), error: null };
  } catch (error) {
    if (!(error instanceof InvalidRequestError) || texts.size === 1) return { vectors: new Map(), error: /** @type {Error} */ (error) };
    return embedTextByText(embedder, texts);
  }
}

/**
 * Each file's vectors embedded on its own, and the files whose vectors failed.
 * @param {EmbeddingProvider} embedder @param {VectorBatch} batch
 * @returns {Promise<{vectors: Map<string, number[]>, unembedded: Unembedded[]}>}
 */
async function embedFileByFile(embedder, batch) {
  /** @type {Map<string, number[]>} */
  const vectors = new Map();
  /** @type {Unembedded[]} */
  const unembedded = [];
  for (const { file, texts } of batch) {
    const landed = await embedFile(embedder, texts);
    for (const [hash, vector] of landed.vectors) vectors.set(hash, vector);
    if (landed.error) unembedded.push({ file, error: landed.error });
  }
  return { vectors, unembedded };
}

/**
 * A batch's vectors, and the files whose vectors failed. When the endpoint
 * refuses an input in the batch, file by file (see embedFile), so only the
 * refused text goes without; any other failure fails every file in it — each
 * would fail the same way.
 * @param {EmbeddingProvider} embedder @param {VectorBatch} batch
 * @returns {Promise<{vectors: Map<string, number[]>, unembedded: Unembedded[]}>}
 */
async function embedBatchOfFiles(embedder, batch) {
  try {
    return { vectors: await embedTexts(embedder, new Map(batch.flatMap(({ texts }) => [...texts]))), unembedded: [] };
  } catch (error) {
    if (error instanceof InvalidRequestError) return embedFileByFile(embedder, batch);
    return { vectors: new Map(), unembedded: batch.map(({ file }) => ({ file, error: /** @type {Error} */ (error) })) };
  }
}

/**
 * The failure that stops the embedding, or null — any but the endpoint
 * refusing an input, which leaves that text alone without its vector.
 * @param {Unembedded[]} unembedded
 * @returns {Error|null}
 */
function stoppingError(unembedded) {
  const stopping = unembedded.find(({ error }) => !(error instanceof InvalidRequestError));
  return stopping ? stopping.error : null;
}

/**
 * Save vectors into the store under the lock — each into the chunks without
 * one whose text it embeds, so a chunk re-cut since the embedding takes none
 * — and return the store as it then stands. A store gone since is left gone;
 * one rebuilt with another embedder since refuses them.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider} embedder
 * @param {Snapshot} snapshot @param {Map<string, number[]>} vectors  by the hash of the text each embeds
 * @returns {Snapshot}
 */
function saveVectors(files, cfg, embedder, snapshot, vectors) {
  return store.withLock(files.lock, () => {
    assertStoreEmbedder(files, cfg, embedder);
    const db = currentStore(files, snapshot);
    if (!db) return snapshot;
    if (store.attachVectors(db, vectors) > 0) {
      store.saveStore(db, files.store);
      recordWrite(files, cfg, embedder);
    }
    return { db, stamp: store.storeStamp(files.store) };
  });
}

/**
 * Embed every chunk `pending` admits that has no vector, batch by batch,
 * each batch's vectors saved as it lands. The first failure that is not the
 * endpoint refusing an input stops it, failing every file after with the
 * same error.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider} embedder
 * @param {Snapshot} snapshot @param {(chunk: Chunk) => boolean} pending
 * @returns {Promise<{unembedded: Unembedded[], snapshot: Snapshot}>} the store as the last save left it
 */
async function embedPending(files, cfg, embedder, snapshot, pending) {
  const batches = vectorBatches(snapshot.db ? store.chunksWithoutVector(snapshot.db).filter(pending) : []);
  let current = snapshot;
  /** @type {Unembedded[]} */
  const unembedded = [];
  for (const [at, batch] of batches.entries()) {
    const landed = await embedBatchOfFiles(embedder, batch);
    if (landed.vectors.size > 0) current = saveVectors(files, cfg, embedder, current, landed.vectors);
    unembedded.push(...landed.unembedded);
    const stopped = stoppingError(landed.unembedded);
    if (stopped) {
      unembedded.push(...batches.slice(at + 1).flat().map(({ file }) => ({ file, error: stopped })));
      break;
    }
  }
  return { unembedded, snapshot: current };
}

/**
 * What a fill's failures say, one line — the first file's, and how many
 * more fell short with it — or null when none did.
 * @param {Unembedded[]} unembedded @returns {string|null}
 */
function failureOf(unembedded) {
  if (unembedded.length === 0) return null;
  const [{ file, error }] = unembedded;
  const more = unembedded.length > 1 ? ` (and ${unembedded.length - 1} more)` : '';
  return `${file}: ${error.message.replace(/\s+/g, ' ').trim()}${more}`;
}

/**
 * The recorded shortfall while it still says something — a chunk awaits its
 * vector — or null: a shortfall whose chunks have since gone is moot.
 * @param {string|null} failure  the metadata's `fill_failure` @param {import('../../kernel/knowledge/store.cjs').Store} db
 * @returns {string|null}
 */
function fillShortfall(failure, db) {
  return failure && store.chunksWithoutVector(db).length > 0 ? failure : null;
}

/**
 * Record why the fill fell short — null once it landed everything — under
 * the store's lock, beside the metadata's other fields.
 * @param {KnowledgeFiles} files @param {string|null} failure
 */
function recordFillFailure(files, failure) {
  store.withLock(files.lock, () => {
    const metadata = storeMetadata(files);
    if (metadata && (metadata.fill_failure || null) !== failure) store.writeMetadata(files.metadata, { ...metadata, fill_failure: failure });
  });
}

/**
 * @typedef {object} FillOptions
 * @property {Snapshot} [snapshot]  the store as last written — read afresh when omitted
 * @property {string|null} [shortfall]  what already fell short before the embedding began, recorded with the outcome
 */

/**
 * Fill the vectors of every chunk `owed` admits that has none — again over
 * whatever a peer wrote meanwhile, which a save's reload brings in, each
 * text tried once — then record the outcome in the metadata.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider} embedder
 * @param {(chunk: Chunk) => boolean} owed @param {FillOptions} [options]
 * @returns {Promise<Vectoring>}
 */
async function fillVectors(files, cfg, embedder, owed, { snapshot = readStore(files), shortfall = null } = {}) {
  /** @type {Set<string>} */
  const tried = new Set();
  /** @type {Unembedded[]} */
  const unembedded = [];
  let current = snapshot;
  while (current.db) {
    const round = new Set(store.chunksWithoutVector(current.db)
      .filter((chunk) => owed(chunk) && !tried.has(chunk.content_hash))
      .map((chunk) => chunk.content_hash));
    if (round.size === 0) break;
    for (const hash of round) tried.add(hash);
    const embedded = await embedPending(files, cfg, embedder, current, (chunk) => round.has(chunk.content_hash));
    unembedded.push(...embedded.unembedded);
    current = embedded.snapshot;
    if (stoppingError(embedded.unembedded)) break;
  }
  recordFillFailure(files, [failureOf(unembedded), shortfall].filter(Boolean).join('; ') || null);
  return { unembedded, awaiting: current.db ? store.chunksWithoutVector(current.db).filter(owed).length : 0 };
}

// ---------------------------------------------------------------------------
// The background fill
// ---------------------------------------------------------------------------

const ENGINE_CJS = path.join(__dirname, '..', '..', 'engine.cjs');

/**
 * The one door a fill is launched through — replaced by a test that must
 * observe a launch without a process.
 */
const launcher = {
  /** @param {string} root */
  launch(root) {
    const child = childProcess.spawn(process.execPath, [ENGINE_CJS, 'knowledge', 'fill'], { cwd: root, detached: true, stdio: 'ignore' });
    // A fill that could not start leaves its chunks awaiting, for the next
    // launch — never an unhandled error in the command that launched it.
    child.on('error', () => {});
    child.unref();
  },
};

/**
 * Launch the vector fill when a write left chunks awaiting vectors a
 * provider can give — never for a keyword-only store, nor for a keyed
 * provider whose key does not resolve.
 * @param {string} root @param {{embedder: EmbeddingProvider|KeylessProvider|null, snapshot: Snapshot}} written
 * @returns {boolean} whether it launched
 */
function launchFillIfAwaiting(root, { embedder, snapshot }) {
  if (!canEmbed(embedder) || !snapshot.db || store.chunksWithoutVector(snapshot.db).length === 0) return false;
  launcher.launch(root);
  return true;
}

/**
 * The vector fill: every chunk awaiting a vector a provider can give — bar
 * those compact prunes — embedded and saved (see fillVectors). A second fill
 * finds the first's claim and ends at once. Manifests that cannot be read
 * leave it pruning nothing, and are recorded as a shortfall.
 * @param {string} root
 * @returns {Promise<Vectoring|null>} null where no fill ran
 */
async function fill(root) {
  const files = knowledgeFiles(root);
  if (!fs.existsSync(files.store)) return null;
  const release = tryClaimFile(files.fill);
  if (!release) return null;
  try {
    const { cfg, provider } = loadSettings(files);
    const embedder = indexProvider(files, cfg, provider);
    if (!canEmbed(embedder)) return null;
    /** @type {string|null} */
    let shortfall = null;
    let workUnits = [];
    try {
      workUnits = readManifests(root).workUnits;
    } catch (err) {
      shortfall = messageOf(err);
    }
    const pruning = indexPruning(cfg, workUnits);
    return await fillVectors(files, cfg, embedder, (chunk) => !(pruning && pruning.prunes(chunk.work_unit, chunk.phase)), { shortfall });
  } finally {
    release();
  }
}

module.exports = {
  fillShortfall,
  launcher,
  launchFillIfAwaiting,
  fillVectors,
  fill,
};
