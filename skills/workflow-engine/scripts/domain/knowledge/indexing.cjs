'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the store's keyword side — each artifact cut into chunks and
// written under the store lock, searchable by keyword at once, each chunk
// carrying any vector the store already holds for its text; and the bulk
// pass that brings the store in line with the files the manifests name.
// Embedding the chunks still without a vector is vectors.cjs's.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const store = require('../../kernel/knowledge/store.cjs');
const chunker = require('../../kernel/knowledge/chunker.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');
const { identityKey, deriveIdentity, workTypeOf, readManifests, discoverArtifacts, retirements } = require('./artifacts.cjs');
const { indexProvider, newStoreEmbedder, embedderIdentity, storeMetadata, assertStoreEmbedder } = require('./embedder.cjs');
const { indexPruning } = require('./decay.cjs');

/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */
/** @typedef {import('../../kernel/knowledge/store.cjs').Store} Store */
/** @typedef {import('../../kernel/knowledge/store.cjs').Chunk} Chunk */
/** @typedef {import('./artifacts.cjs').Artifact} Artifact */
/** @typedef {import('./artifacts.cjs').Manifests} Manifests */
/** @typedef {import('./embedder.cjs').Config} Config */
/** @typedef {import('./embedder.cjs').EmbeddingProvider} EmbeddingProvider */
/** @typedef {import('./embedder.cjs').KeylessProvider} KeylessProvider */
/** @typedef {import('./decay.cjs').Pruning} Pruning */

/**
 * @typedef {object} Settings  the knowledge config and the provider it names
 * @property {Config} cfg
 * @property {EmbeddingProvider|null} provider
 */

const CHUNKING_DIR = path.join(__dirname, '..', '..', '..', 'content', 'knowledge', 'chunking');

/**
 * The chunking config a phase indexes with.
 * @param {string} phase @returns {Record<string, any>}
 */
function readChunkConfig(phase) {
  const file = path.join(CHUNKING_DIR, `${phase}.json`);
  if (!fs.existsSync(file)) throw new UserError(`Chunking config not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * An artifact's chunks as store documents, not yet embedded. Refuses a file
 * that yields no chunks: indexing it would silently wipe the identity's
 * existing chunks.
 * @param {string} root @param {Artifact} artifact
 * @returns {Array<Record<string, any>>}
 */
function buildDocuments(root, artifact) {
  const workType = workTypeOf(root, artifact);
  const chunkConfig = readChunkConfig(artifact.phase);
  const absSource = path.resolve(root, artifact.file);
  const content = fs.readFileSync(absSource, 'utf8');
  const chunks = chunker.chunk(content, chunkConfig);
  if (chunks.length === 0) {
    throw new UserError(
      `No chunks produced from ${artifact.file}. Refusing to index an empty file — ` +
        'this would silently wipe any existing indexed chunks for this topic. ' +
        'Use `knowledge remove` explicitly if that is what you want.'
    );
  }
  // A chunk is dated by its source document (its mtime), never by the index:
  // results show when the work was written, however recently it was indexed.
  const timestamp = fs.statSync(absSource).mtimeMs;
  const sourceHash = store.contentHash(content);
  const confidence = chunkConfig.confidence || 'medium';
  return chunks.map((chunk, idx) => ({
    id: `${artifact.workUnit}-${artifact.phase}-${artifact.topic}-${String(idx + 1).padStart(3, '0')}`,
    content: chunk.content,
    work_unit: artifact.workUnit,
    work_type: workType,
    phase: artifact.phase,
    topic: artifact.topic,
    confidence,
    source_file: artifact.file,
    source_hash: sourceHash,
    timestamp,
  }));
}

/**
 * Give each document the vector the store already holds for its text.
 * @param {Array<Record<string, any>>} docs @param {Map<string, Float32Array>} known  by the hash of the text each embeds
 */
function reuseVectors(docs, known) {
  for (const doc of docs) {
    const vector = known.get(store.contentHash(doc.content));
    if (vector) doc.embedding = vector;
  }
}

/**
 * @typedef {object} Snapshot  the store as last read or written
 * @property {Store|null} db  null when the checkout has no store
 * @property {string|null} stamp  the stamp of the file it was read from or saved to
 */

/**
 * The store as an index plans from, and the stamp of the file it was read
 * from — taken before the load, so a write landing between the two reads as
 * a change.
 * @param {KnowledgeFiles} files @returns {Snapshot}
 */
function readStore(files) {
  const stamp = store.storeStamp(files.store);
  return { db: stamp === null ? null : store.loadStore(files.store), stamp };
}

/**
 * The store to write into, inside the lock: the snapshot while the file is
 * still the one it was read from or saved to, else a fresh load — null
 * where the checkout has none.
 * @param {KnowledgeFiles} files @param {Snapshot|null} snapshot
 * @returns {Store|null}
 */
function currentStore(files, snapshot) {
  const stamp = store.storeStamp(files.store);
  if (snapshot && snapshot.db && snapshot.stamp !== null && snapshot.stamp === stamp) return snapshot.db;
  return stamp === null ? null : store.loadStore(files.store);
}

/**
 * Save `db` as the checkout's store in place of whatever was there, with
 * metadata naming the embedder its vectors come from — the one place a
 * store is born. Called inside the lock.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider|null} embedder
 * @param {Store} db @param {string|null} lastIndexed
 */
function bearStore(files, cfg, embedder, db, lastIndexed) {
  store.saveStore(db, files.store);
  store.writeMetadata(files.metadata, { ...embedderIdentity(cfg, embedder), last_indexed: lastIndexed, fill_failure: null });
}

/**
 * A new empty store in place of whatever the checkout holds, built with the
 * embedder this machine's config says — refused where it says none.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider|null} provider
 */
function createStore(files, cfg, provider) {
  const embedder = newStoreEmbedder(files, cfg, provider);
  fs.mkdirSync(files.dir, { recursive: true });
  store.withLock(files.lock, () => bearStore(files, cfg, embedder, store.createStore(), null));
}

/**
 * Stamp the metadata with this write's time, keeping the last fill's
 * failure. Once a store records a provider, its provider, model and
 * dimensions never change: a keyword-only one written with a provider
 * records its embedder's.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider|null} embedder
 */
function recordWrite(files, cfg, embedder) {
  const existing = storeMetadata(files);
  const identity = existing && (existing.provider || !embedder) ? existing : embedderIdentity(cfg, embedder);
  store.writeMetadata(files.metadata, {
    ...identity,
    last_indexed: new Date().toISOString(),
    fill_failure: existing ? existing.fill_failure : null,
  });
}

/** @param {{workUnit: string, phase: string, topic: string}} entry */
function identityOf(entry) {
  return { work_unit: entry.workUnit, phase: entry.phase, topic: entry.topic };
}

/**
 * @typedef {object} Built
 * @property {Artifact} artifact
 * @property {'new'|'changed'} [state]  the bulk pass's classification
 * @property {Array<Record<string, any>>} docs  the artifact's store documents
 */

/**
 * @typedef {object} Indexed  the chunks of one identity
 * @property {string} workUnit
 * @property {string} phase
 * @property {string} topic
 * @property {string} file  the source file the chunks were indexed from
 * @property {Set<string|undefined>} hashes  the source hashes they carry — undefined for a chunk with no recorded hash
 * @property {Map<string, string>} texts  the hash of each chunk's text, by chunk id
 * @property {number} chunks
 */

/** @typedef {Indexed & {reason: string}} Retirement */

/**
 * @typedef {object} Written
 * @property {Retirement[]} retired
 * @property {Snapshot} snapshot  the store as it stands after the write
 */

/**
 * Write into the store in one locked load and save: each built identity's
 * chunks replaced by its new documents, then every identity `retire` names
 * over the result removed. A store the checkout lacked is created and saved,
 * empty or not, as is a retokenized one; otherwise nothing is saved when
 * nothing changed.
 * @param {KnowledgeFiles} files
 * @param {{cfg: Config, embedder: EmbeddingProvider|null, built: Built[], snapshot?: Snapshot|null, retire?: (db: Store) => Retirement[]}} write
 * @returns {Written}
 */
function writeStore(files, { cfg, embedder, built, snapshot = null, retire = () => [] }) {
  fs.mkdirSync(files.dir, { recursive: true });
  return store.withLock(files.lock, () => {
    assertStoreEmbedder(files, cfg, embedder);
    const current = currentStore(files, snapshot);
    const db = current || store.createStore();
    for (const { artifact, docs } of built) {
      store.removeByIdentity(db, identityOf(artifact));
      for (const doc of docs) store.insertDocument(db, doc);
    }
    const retired = retire(db);
    for (const entry of retired) store.removeByIdentity(db, identityOf(entry));
    if (!current) {
      bearStore(files, cfg, embedder, db, new Date().toISOString());
    } else if (db.retokenized || built.length > 0 || retired.length > 0) {
      store.saveStore(db, files.store);
      recordWrite(files, cfg, embedder);
    }
    return { retired, snapshot: { db, stamp: store.storeStamp(files.store) } };
  });
}

/**
 * @typedef {object} KeywordWrite  what a keyword-side write left
 * @property {EmbeddingProvider|KeylessProvider|null} embedder  the provider the store's vectors come from
 * @property {Snapshot} snapshot
 */

/**
 * Index one artifact into the store: its chunks written, searchable by
 * keyword, each with any vector the store holds for its text.
 * @param {string} root @param {Artifact} artifact @param {Settings} settings
 * @returns {KeywordWrite & {chunks: number}}
 */
function indexArtifact(root, artifact, { cfg, provider }) {
  const files = knowledgeFiles(root);
  const docs = buildDocuments(root, artifact);
  const embedder = indexProvider(files, cfg, provider);
  const snapshot = readStore(files);
  if (embedder && snapshot.db) reuseVectors(docs, store.vectorsByContentHash(snapshot.db));
  const written = writeStore(files, { cfg, embedder, built: [{ artifact, docs }], snapshot });
  return { chunks: docs.length, embedder, snapshot: written.snapshot };
}

/**
 * Index the artifact at a project-relative path (see indexArtifact).
 * @param {string} root @param {string} file @param {Settings} settings
 */
function indexPath(root, file, settings) {
  const abs = path.resolve(root, file);
  if (!fs.existsSync(abs)) throw new UserError(`File not found: ${abs}`);
  return indexArtifact(root, { file, ...deriveIdentity(file) }, settings);
}

// ---------------------------------------------------------------------------
// The bulk pass — the store's keyword side brought in line with the files
// ---------------------------------------------------------------------------

/**
 * Chunks grouped by identity.
 * @param {Chunk[]} chunks
 * @returns {Map<string, Indexed>}
 */
function identitiesOf(chunks) {
  /** @type {Map<string, Indexed>} */
  const byKey = new Map();
  for (const c of chunks) {
    const key = identityKey(c.work_unit, c.phase, c.topic);
    let entry = byKey.get(key);
    if (!entry) {
      entry = { workUnit: c.work_unit, phase: c.phase, topic: c.topic, file: c.source_file, hashes: new Set(), texts: new Map(), chunks: 0 };
      byKey.set(key, entry);
    }
    entry.hashes.add(c.source_hash);
    entry.texts.set(c.id, c.content_hash);
    entry.chunks += 1;
  }
  return byKey;
}

/**
 * The identities with a chunk awaiting its vector — none without an embedder
 * to give one.
 * @param {Snapshot} snapshot @param {EmbeddingProvider|null} embedder
 * @returns {Set<string>}
 */
function awaitingIdentities(snapshot, embedder) {
  if (!embedder || !snapshot.db) return new Set();
  return new Set(store.chunksWithoutVector(snapshot.db).map((c) => identityKey(c.work_unit, c.phase, c.topic)));
}

/**
 * Whether the file now cuts other chunk texts than the store holds for it —
 * a file that no longer builds included, so indexing it names the failure.
 * @param {string} root @param {Artifact} artifact @param {Indexed} entry
 */
function cutsOtherTexts(root, artifact, entry) {
  let docs;
  try {
    docs = buildDocuments(root, artifact);
  } catch {
    return true;
  }
  return docs.length !== entry.texts.size || docs.some((doc) => entry.texts.get(doc.id) !== store.contentHash(doc.content));
}

/**
 * @typedef {object} Plan  what the bulk pass does to the store
 * @property {Artifact[]} fresh  no chunks yet
 * @property {Artifact[]} changed  chunks indexed from other content, content with no recorded hash, or — with a chunk awaiting its vector — texts the file no longer cuts
 * @property {Artifact[]} unchanged
 * @property {Artifact[]} pruned  what compact prunes — never indexed again
 * @property {Retirement[]} retired
 */

/**
 * Sort the discovered artifacts against the store, set aside those compact
 * prunes, and name the indexed identities to retire. A scope confines all of
 * it to one work unit.
 * @param {string} root @param {Chunk[]} chunks @param {Manifests} manifests
 * @param {{scope: string|null, pruning: Pruning|null, awaiting?: Set<string>}} opts
 * @returns {Plan}
 */
function planIndex(root, chunks, manifests, { scope, pruning, awaiting = new Set() }) {
  const indexed = identitiesOf(chunks);
  /** @type {Plan} */
  const plan = { fresh: [], changed: [], unchanged: [], pruned: [], retired: retirements(root, indexed.values(), manifests, scope) };
  for (const artifact of discoverArtifacts(root, manifests)) {
    if (scope && artifact.workUnit !== scope) continue;
    if (pruning && pruning.prunes(artifact.workUnit, artifact.phase)) {
      plan.pruned.push(artifact);
      continue;
    }
    const key = identityKey(artifact.workUnit, artifact.phase, artifact.topic);
    const entry = indexed.get(key);
    if (!entry) {
      plan.fresh.push(artifact);
      continue;
    }
    const hash = store.contentHash(fs.readFileSync(path.resolve(root, artifact.file), 'utf8'));
    const current = entry.hashes.size === 1 && entry.hashes.has(hash) && !(awaiting.has(key) && cutsOtherTexts(root, artifact, entry));
    plan[current ? 'unchanged' : 'changed'].push(artifact);
  }
  return plan;
}

/**
 * Build each planned artifact's documents. A failure fails its own artifact
 * alone.
 * @param {string} root @param {Array<{artifact: Artifact, state: 'new'|'changed'}>} planned
 * @returns {{built: Built[], failures: Array<{artifact: Artifact, error: Error}>}}
 */
function buildAll(root, planned) {
  /** @type {Built[]} */
  const built = [];
  /** @type {Array<{artifact: Artifact, error: Error}>} */
  const failures = [];
  for (const { artifact, state } of planned) {
    try {
      built.push({ artifact, state, docs: buildDocuments(root, artifact) });
    } catch (error) {
      failures.push({ artifact, error: /** @type {Error} */ (error) });
    }
  }
  return { built, failures };
}

/**
 * @typedef {KeywordWrite & {
 *   built: Built[],
 *   failures: Array<{artifact: Artifact, error: Error}>,
 *   retired: Retirement[],
 *   unchanged: Artifact[],
 *   pending: (chunk: Chunk) => boolean,
 * }} Reconciled  what the bulk pass did; `pending` admits the chunks in its
 *   scope that compact leaves — the ones whose vectors it is owed
 */

/**
 * Bring the store's keyword side in line with the files (see planIndex),
 * creating it first when the checkout has none, and saving a retokenized
 * store's terms. Everything new or changed is built first; then, under the
 * lock, the manifests are read again — a topic retired mid-run leaves in the
 * same run — and the documents, each with any vector the store already holds
 * for its text, and the retirements land in one load and one save. Every
 * file is attempted, a failure counted in the result.
 * @param {string} root @param {Settings} settings @param {string|null} [scope]  one work unit
 * @returns {Reconciled}
 */
function reconcile(root, { cfg, provider }, scope = null) {
  const files = knowledgeFiles(root);
  const manifests = readManifests(root);
  // Resolved even when nothing needs embedding: a provider or model change
  // since the store was built must surface here, not read as a store in
  // line, and a store this machine may not create must never be started.
  const embedder = indexProvider(files, cfg, provider);
  const snapshot = readStore(files);
  const pruning = indexPruning(cfg, manifests.workUnits);
  const plan = planIndex(root, snapshot.db ? store.allChunks(snapshot.db) : [], manifests, {
    scope,
    pruning,
    awaiting: awaitingIdentities(snapshot, embedder),
  });

  const { built, failures } = buildAll(root, [
    ...plan.fresh.map((artifact) => ({ artifact, state: /** @type {const} */ ('new') })),
    ...plan.changed.map((artifact) => ({ artifact, state: /** @type {const} */ ('changed') })),
  ]);
  if (embedder && snapshot.db) {
    const known = store.vectorsByContentHash(snapshot.db);
    for (const { docs } of built) reuseVectors(docs, known);
  }

  const inLine = snapshot.db !== null && !snapshot.db.retokenized && built.length === 0 && plan.retired.length === 0;
  const written = inLine ? { retired: [], snapshot } : writeStore(files, {
    cfg,
    embedder,
    built,
    snapshot,
    retire: (db) => retirements(root, identitiesOf(store.allChunks(db)).values(), readManifests(root), scope),
  });
  /** @param {Chunk} chunk */
  const pending = (chunk) => (!scope || chunk.work_unit === scope) && !(pruning && pruning.prunes(chunk.work_unit, chunk.phase));
  return { built, failures, retired: written.retired, unchanged: plan.unchanged, embedder, snapshot: written.snapshot, pending };
}

module.exports = {
  readStore,
  currentStore,
  createStore,
  recordWrite,
  planIndex,
  indexArtifact,
  indexPath,
  reconcile,
};
