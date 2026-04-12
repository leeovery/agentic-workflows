// Knowledge CLI entry point.
//
// Dispatches commands to their handlers, resolving config and provider
// once at startup. Phase 3 implements: index, query, check. Other
// commands dispatch with a "not yet implemented" error until Phase 4.

'use strict';

const fs = require('fs');
const path = require('path');
const store = require('./store');
const chunker = require('./chunker');
const { StubProvider } = require('./embeddings');
const { OpenAIProvider } = require('./providers/openai');
const config = require('./config');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEXED_PHASES = ['research', 'discussion', 'investigation', 'specification'];

// Resolve manifest CLI path. In the bundled form, __dirname is
// skills/workflow-knowledge/scripts/. In source, __dirname is
// src/knowledge/. Both need to resolve to skills/workflow-manifest/scripts/manifest.cjs.
const MANIFEST_JS = fs.existsSync(path.join(__dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs'))
  ? path.join(__dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs')
  : path.join(__dirname, '..', '..', 'workflow-manifest', 'scripts', 'manifest.cjs');

const DEFAULT_RETRY_BACKOFF = [1000, 2000, 4000];
const PENDING_CATCHUP_LIMIT = 5;

// Default dimensions when creating a store in keyword-only mode.
// The store schema requires a dimension parameter, but keyword-only docs
// omit the embedding field entirely — this value just satisfies the schema.
const KEYWORD_ONLY_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

/**
 * Parse argv-style args into { positional: string[], flags: object }.
 * Handles --flag value and --flag=value forms.
 */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        flags[key] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          flags[key] = argv[i + 1];
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { positional, flags };
}

/**
 * Build an options object from parsed flags for command handlers.
 */
function buildOptions(flags) {
  return {
    workType: flags['work-type'] || null,
    phase: flags['phase'] || null,
    workUnit: flags['work-unit'] || null,
    topic: flags['topic'] || null,
    limit: flags['limit'] ? parseInt(flags['limit'], 10) : null,
    dryRun: flags['dry-run'] === true || flags['dry-run'] === 'true',
  };
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

const USAGE = `Usage: knowledge <command> [options]

Commands:
  index     Index a file or all pending artifacts
  query     Search the knowledge base
  check     Check if the knowledge base is ready
  status    Show knowledge base status
  remove    Remove indexed content
  compact   Compact the knowledge base
  rebuild   Rebuild the knowledge base from scratch
  setup     Interactive setup wizard

Options:
  --work-type <type>   Filter by work type
  --work-unit <unit>   Filter by work unit
  --phase <phase>      Filter by phase
  --topic <topic>      Filter by topic
  --limit <n>          Limit number of results
  --dry-run            Preview without making changes`;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function knowledgeDir() {
  return path.resolve(process.cwd(), '.workflows', '.knowledge');
}

function storePath() {
  return path.join(knowledgeDir(), 'store.msp');
}

function metadataPath() {
  return path.join(knowledgeDir(), 'metadata.json');
}

function lockFilePath() {
  return path.join(knowledgeDir(), '.lock');
}

// ---------------------------------------------------------------------------
// Retry wrapper — single-layer retry for all operations
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn          Async function to retry
 * @param {{ maxAttempts?: number, backoff?: number[] }} opts
 * @returns {Promise<*>}
 */
async function withRetry(fn, opts) {
  const maxAttempts = (opts && opts.maxAttempts) || 3;
  const backoff = (opts && opts.backoff) || DEFAULT_RETRY_BACKOFF;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        const delay = backoff[attempt] || backoff[backoff.length - 1];
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Identity derivation — parse file path to extract work_unit, phase, topic
// ---------------------------------------------------------------------------

/**
 * Derive identity fields from a workflow artifact file path.
 * Returns { work_unit, phase, topic } or throws on invalid path.
 */
function deriveIdentity(filePath) {
  // Normalise to forward slashes for pattern matching.
  const norm = filePath.replace(/\\/g, '/');

  // Match .workflows/{work_unit}/{phase}/{rest}
  const match = /\.workflows\/([^/]+)\/(research|discussion|investigation|specification)\/(.+)$/.exec(norm);
  if (!match) {
    throw new Error(
      `Cannot derive identity from path: ${filePath}\n` +
        'Expected path matching: .workflows/{work_unit}/{phase}/...'
    );
  }

  const workUnit = match[1];
  const phase = match[2];
  const rest = match[3];

  // Validate indexed phase.
  if (!INDEXED_PHASES.includes(phase)) {
    throw new Error(`File is in phase "${phase}" which is not indexed.`);
  }

  let topic;
  if (phase === 'specification') {
    // .workflows/{wu}/specification/{topic}/specification.md
    const specMatch = /^([^/]+)\/specification\.md$/.exec(rest);
    if (!specMatch) {
      throw new Error(
        `Unexpected specification path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/specification/{topic}/specification.md'
      );
    }
    topic = specMatch[1];
  } else if (phase === 'discussion' || phase === 'investigation') {
    // .workflows/{wu}/{phase}/{topic}.md — flat file, no subdirectories.
    const flatMatch = /^([^/]+)\.md$/.exec(rest);
    if (!flatMatch) {
      throw new Error(
        `Unexpected ${phase} path structure: ${rest}\n` +
          `Expected: .workflows/{work_unit}/${phase}/{topic}.md`
      );
    }
    topic = flatMatch[1];
  } else if (phase === 'research') {
    // .workflows/{wu}/research/{filename}.md — flat file.
    const resMatch = /^([^/]+)\.md$/.exec(rest);
    if (!resMatch) {
      throw new Error(
        `Unexpected research path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/research/{filename}.md'
      );
    }
    topic = resMatch[1];
  }

  return { workUnit, phase, topic };
}

/**
 * Read the work_type from the work unit's manifest.json.
 */
function readWorkType(workUnit) {
  const manifestFile = path.resolve(process.cwd(), '.workflows', workUnit, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Work unit manifest not found: ${manifestFile}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!manifest.work_type) {
    throw new Error(`Work unit manifest missing work_type field: ${manifestFile}`);
  }
  return manifest.work_type;
}

// ---------------------------------------------------------------------------
// Provider state resolution
// ---------------------------------------------------------------------------

/**
 * Check provider state against metadata.
 * Returns { mode: 'full'|'keyword-only', provider: object|null }
 * Throws on mismatch (cases 2 and 3 from the task spec).
 */
function resolveProviderState(metadata, cfg, provider) {
  const metaProvider = metadata.provider;
  const metaModel = metadata.model;
  const metaDimensions = metadata.dimensions;

  // Case 4: metadata.provider is null (keyword-only store).
  // Always allowed — index WITHOUT vectors regardless of current config.
  if (metaProvider === null || metaProvider === undefined) {
    return { mode: 'keyword-only', provider: null };
  }

  // Cases 1-3: metadata HAS a provider.
  if (provider) {
    // Current config has a provider.
    const curModel = provider.model();
    const curDimensions = provider.dimensions();

    if (metaProvider === cfg.provider && metaModel === curModel && metaDimensions === curDimensions) {
      // Case 1: match — proceed with full embedding.
      return { mode: 'full', provider };
    }

    // Case 2: mismatch.
    throw new Error(
      'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n' +
        `  Store: provider=${metaProvider}, model=${metaModel}, dimensions=${metaDimensions}\n` +
        `  Config: provider=${cfg.provider}, model=${curModel}, dimensions=${curDimensions}`
    );
  }

  // Case 3: metadata has provider but current config does not.
  throw new Error(
    'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n' +
      `  Store was indexed with: provider=${metaProvider}, model=${metaModel}\n` +
      '  Current config has no provider configured.'
  );
}

// ---------------------------------------------------------------------------
// Index command
// ---------------------------------------------------------------------------

async function cmdIndex(args, options, cfg, provider) {
  if (args.length === 0) {
    // Bulk index mode — discover and index all missing completed artifacts.
    return cmdIndexBulk(options, cfg, provider);
  }

  const sourceFile = args[0];

  // Validate file exists.
  const absSource = path.resolve(sourceFile);
  if (!fs.existsSync(absSource)) {
    process.stderr.write(`File not found: ${absSource}\n`);
    process.exit(1);
  }

  // Derive identity from path.
  const identity = deriveIdentity(sourceFile);

  // Index with retry wrapper.
  const chunkCount = await withRetry(
    () => indexSingleFile(sourceFile, identity, cfg, provider),
    { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
  );

  process.stdout.write(`Indexed ${chunkCount} chunks from ${sourceFile}\n`);

  // After successful single-file index, catch up pending queue (up to 5).
  await processPendingQueue(cfg, provider, PENDING_CATCHUP_LIMIT);
}

/**
 * Index a single file into the store. Returns the number of chunks indexed.
 * Separated from cmdIndex so it can be called by both single-file and bulk modes.
 */
async function indexSingleFile(sourceFile, identity, cfg, provider) {
  // Read work_type from manifest.
  const workType = readWorkType(identity.workUnit);

  // Load chunking config.
  const chunkConfigPath = path.join(__dirname, '..', 'chunking', identity.phase + '.json');
  if (!fs.existsSync(chunkConfigPath)) {
    throw new Error(`Chunking config not found: ${chunkConfigPath}`);
  }
  const chunkConfig = JSON.parse(fs.readFileSync(chunkConfigPath, 'utf8'));

  // Read and chunk the source file.
  const absSource = path.resolve(sourceFile);
  const content = fs.readFileSync(absSource, 'utf8');
  const chunks = chunker.chunk(content, chunkConfig);

  // Resolve store and metadata.
  const kDir = knowledgeDir();
  const sp = storePath();
  const mp = metadataPath();
  const lp = lockFilePath();

  // Ensure knowledge directory exists.
  if (!fs.existsSync(kDir)) {
    fs.mkdirSync(kDir, { recursive: true });
  }

  // Load or create store.
  let db;
  let metadata;
  const storeExists = fs.existsSync(sp);
  const metadataExists = fs.existsSync(mp);

  if (storeExists) {
    db = await store.loadStore(sp);
  }

  if (metadataExists) {
    metadata = store.readMetadata(mp);
    if (!Array.isArray(metadata.pending)) {
      metadata.pending = [];
    }
  }

  // Determine effective mode (full vs keyword-only).
  let effectiveMode;
  let effectiveProvider;

  if (metadata) {
    const state = resolveProviderState(metadata, cfg, provider);
    effectiveMode = state.mode;
    effectiveProvider = state.provider;
  } else {
    if (provider) {
      effectiveMode = 'full';
      effectiveProvider = provider;
    } else {
      effectiveMode = 'keyword-only';
      effectiveProvider = null;
    }
  }

  // Create store if it doesn't exist.
  if (!db) {
    const dims = effectiveProvider
      ? effectiveProvider.dimensions()
      : (cfg.dimensions || KEYWORD_ONLY_DIMENSIONS);
    db = await store.createStore(dims);
  }

  // Embed chunks if in full mode (with retry for embed calls).
  let embeddings = null;
  if (effectiveMode === 'full' && effectiveProvider && chunks.length > 0) {
    const texts = chunks.map((c) => c.content);
    embeddings = await effectiveProvider.embedBatch(texts);
  }

  // Build chunk documents.
  const now = Date.now();
  const confidence = chunkConfig.confidence || 'medium';
  const docs = chunks.map((chunk, idx) => {
    const seq = String(idx + 1).padStart(3, '0');
    const doc = {
      id: `${identity.workUnit}-${identity.phase}-${identity.topic}-${seq}`,
      content: chunk.content,
      work_unit: identity.workUnit,
      work_type: workType,
      phase: identity.phase,
      topic: identity.topic,
      confidence,
      source_file: sourceFile,
      timestamp: now,
    };
    if (embeddings) {
      doc.embedding = embeddings[idx];
    }
    return doc;
  });

  // Acquire lock, remove old chunks, insert new, save.
  await store.withLock(lp, async () => {
    if (storeExists) {
      db = await store.loadStore(sp);
    } else if (fs.existsSync(sp)) {
      db = await store.loadStore(sp);
    }

    await store.removeByIdentity(db, {
      work_unit: identity.workUnit,
      phase: identity.phase,
      topic: identity.topic,
    });

    for (const doc of docs) {
      await store.insertDocument(db, doc);
    }

    await store.saveStore(db, sp);

    if (!metadata) {
      const newMeta = {
        provider: effectiveProvider ? cfg.provider : null,
        model: effectiveProvider ? effectiveProvider.model() : null,
        dimensions: effectiveProvider ? effectiveProvider.dimensions() : null,
        last_indexed: new Date().toISOString(),
        pending: [],
      };
      store.writeMetadata(mp, newMeta);
    } else {
      metadata.last_indexed = new Date().toISOString();
      store.writeMetadata(mp, metadata);
    }
  });

  return docs.length;
}

// ---------------------------------------------------------------------------
// Bulk index — discover and index all missing completed artifacts
// ---------------------------------------------------------------------------

/**
 * Run the manifest CLI and return stdout.
 */
function runManifest(args) {
  const { execFileSync } = require('child_process');
  return execFileSync('node', [MANIFEST_JS, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Check if chunks exist for the given identity triple.
 */
async function isIndexed(db, workUnit, phase, topic) {
  const res = await store.searchFulltext(db, {
    term: '',
    where: {
      work_unit: { eq: workUnit },
      phase: { eq: phase },
      topic: { eq: topic },
    },
    limit: 1,
  });
  return res.length > 0;
}

/**
 * Discover all completed artifacts across all work units using the manifest CLI.
 * Returns an array of { file, workUnit, phase, topic }.
 */
function discoverArtifacts() {
  const items = [];
  let workUnits;

  try {
    const raw = runManifest(['list']);
    workUnits = JSON.parse(raw);
  } catch (_) {
    return items;
  }

  if (!Array.isArray(workUnits) || workUnits.length === 0) return items;

  for (const wu of workUnits) {
    const wuName = wu.name;
    if (!wuName) continue;

    for (const phase of INDEXED_PHASES) {
      const phaseData = wu.phases && wu.phases[phase];
      if (!phaseData || !phaseData.items) continue;

      for (const [topicName, topicData] of Object.entries(phaseData.items)) {
        if (!topicData || topicData.status !== 'completed') continue;

        // Resolve file path via manifest CLI.
        try {
          const raw = runManifest(['resolve', `${wuName}.${phase}.${topicName}`]);
          const filePath = raw.trim();
          if (filePath && fs.existsSync(path.resolve(filePath))) {
            items.push({ file: filePath, workUnit: wuName, phase, topic: topicName });
          }
        } catch (_) {
          // Skip unresolvable items.
        }
      }
    }
  }

  return items;
}

async function cmdIndexBulk(options, cfg, provider) {
  const artifacts = discoverArtifacts();

  const kDir = knowledgeDir();
  const sp = storePath();

  // Ensure knowledge directory exists.
  if (!fs.existsSync(kDir)) {
    fs.mkdirSync(kDir, { recursive: true });
  }

  // Load existing store to check what's already indexed.
  let db = null;
  if (fs.existsSync(sp)) {
    db = await store.loadStore(sp);
  }

  let totalNew = 0;
  let totalChunks = 0;
  let skipped = 0;

  for (const item of artifacts) {
    // Check if already indexed.
    if (db) {
      const indexed = await isIndexed(db, item.workUnit, item.phase, item.topic);
      if (indexed) {
        skipped++;
        continue;
      }
    }

    // Index with retry.
    try {
      const identity = { workUnit: item.workUnit, phase: item.phase, topic: item.topic };
      const count = await withRetry(
        () => indexSingleFile(item.file, identity, cfg, provider),
        { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
      );
      process.stdout.write(`Indexing ${item.file}... ${count} chunks\n`);
      totalNew++;
      totalChunks += count;
      // Reload db after indexing so subsequent isIndexed checks see the new data.
      if (fs.existsSync(sp)) {
        db = await store.loadStore(sp);
      }
    } catch (err) {
      // All retries exhausted — add to pending queue.
      addToPendingQueue(item.file, err.message);
      process.stderr.write(
        `Failed to index ${item.file} after 3 attempts: ${err.message}. Added to pending queue.\n`
      );
    }
  }

  // In bulk mode, process entire pending queue (no limit).
  await processPendingQueue(cfg, provider, Infinity);

  process.stdout.write(
    `Indexed ${totalNew} files (${totalChunks} chunks). ${skipped} already indexed.\n`
  );
}

// ---------------------------------------------------------------------------
// Pending queue helpers
// ---------------------------------------------------------------------------

function addToPendingQueue(file, errorMsg) {
  const mp = metadataPath();
  if (!fs.existsSync(mp)) return;
  const metadata = store.readMetadata(mp);
  if (!Array.isArray(metadata.pending)) metadata.pending = [];
  // Don't duplicate — update if same file already queued.
  const existing = metadata.pending.findIndex((p) => p.file === file);
  const entry = { file, failed_at: new Date().toISOString(), error: errorMsg };
  if (existing >= 0) {
    metadata.pending[existing] = entry;
  } else {
    metadata.pending.push(entry);
  }
  store.writeMetadata(mp, metadata);
}

function removePendingItem(file) {
  const mp = metadataPath();
  if (!fs.existsSync(mp)) return;
  const metadata = store.readMetadata(mp);
  if (!Array.isArray(metadata.pending)) return;
  metadata.pending = metadata.pending.filter((p) => p.file !== file);
  store.writeMetadata(mp, metadata);
}

async function processPendingQueue(cfg, provider, limit) {
  const mp = metadataPath();
  if (!fs.existsSync(mp)) return;

  const metadata = store.readMetadata(mp);
  if (!Array.isArray(metadata.pending) || metadata.pending.length === 0) return;

  const toProcess = metadata.pending.slice(0, limit);

  for (const item of toProcess) {
    const absFile = path.resolve(item.file);
    if (!fs.existsSync(absFile)) {
      // File no longer exists — remove from queue.
      process.stderr.write(`Pending item ${item.file} no longer exists. Removing from queue.\n`);
      removePendingItem(item.file);
      continue;
    }

    let identity;
    try {
      identity = deriveIdentity(item.file);
    } catch (_) {
      // Can't derive identity — remove from queue.
      removePendingItem(item.file);
      continue;
    }

    try {
      await withRetry(
        () => indexSingleFile(item.file, identity, cfg, provider),
        { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
      );
      removePendingItem(item.file);
    } catch (_) {
      // Still failing — leave in queue.
    }
  }
}

// ---------------------------------------------------------------------------
// Query command
// ---------------------------------------------------------------------------

// Confidence tiers for re-ranking — higher number = higher boost.
const CONFIDENCE_RANK = {
  'high': 4,
  'medium': 3,
  'low-medium': 2,
  'low': 1,
};

/**
 * Format a timestamp (epoch ms) as YYYY-MM-DD.
 */
function formatDate(ts) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Application-level re-ranking per design doc lines 566-574.
 * Adjusts Orama scores based on work-unit proximity, confidence tier,
 * and recency. Returns the array sorted by adjusted score (descending).
 */
function rerank(results, workUnitHint) {
  if (results.length === 0) return results;

  // Find the most recent timestamp for normalisation.
  const maxTs = Math.max(...results.map((r) => r.timestamp || 0));
  const minTs = Math.min(...results.map((r) => r.timestamp || 0));
  const tsRange = maxTs - minTs || 1;

  return results
    .map((r) => {
      let adjustedScore = r.score || 0;

      // Work-unit proximity boost (0.1 when matching).
      if (workUnitHint && r.work_unit === workUnitHint) {
        adjustedScore += 0.1;
      }

      // Confidence tier boost (0 to 0.04).
      const confRank = CONFIDENCE_RANK[r.confidence] || 0;
      adjustedScore += confRank * 0.01;

      // Recency boost (0 to 0.05).
      const recency = ((r.timestamp || 0) - minTs) / tsRange;
      adjustedScore += recency * 0.05;

      return Object.assign({}, r, { score: adjustedScore });
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Resolve provider state for query. Symmetric with index-time resolution
 * but returns mode information instead of throwing for the upgrade case.
 */
function resolveQueryMode(metadata, cfg, provider) {
  const metaProvider = metadata.provider;
  const metaModel = metadata.model;
  const metaDimensions = metadata.dimensions;

  // Keyword-only store (metadata.provider is null).
  if (metaProvider === null || metaProvider === undefined) {
    if (provider) {
      // Stub-to-full upgrade case — store has no vectors, can't use provider.
      return { mode: 'upgrade-available', provider: null };
    }
    return { mode: 'keyword-only', provider: null };
  }

  // Store has vectors — check provider compatibility.
  if (!provider) {
    // Config has no provider but store has vectors — mismatch.
    throw new Error(
      'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n' +
        `  Store was indexed with: provider=${metaProvider}, model=${metaModel}\n` +
        '  Current config has no provider configured.'
    );
  }

  const curModel = provider.model();
  const curDimensions = provider.dimensions();

  if (metaProvider === cfg.provider && metaModel === curModel && metaDimensions === curDimensions) {
    return { mode: 'full', provider };
  }

  // Mismatch.
  throw new Error(
    'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n' +
      `  Store: provider=${metaProvider}, model=${metaModel}, dimensions=${metaDimensions}\n` +
      `  Config: provider=${cfg.provider}, model=${curModel}, dimensions=${curDimensions}`
  );
}

async function cmdQuery(args, options, cfg, provider) {
  if (args.length === 0) {
    process.stderr.write('Usage: knowledge query <search_term> [--phase ...] [--work-type ...] [--work-unit ...] [--limit N]\n');
    process.exit(1);
  }

  const searchTerm = args[0];
  const limit = options.limit || 10;
  const sp = storePath();
  const mp = metadataPath();

  // Load store.
  if (!fs.existsSync(sp)) {
    process.stdout.write('[0 results]\n');
    return;
  }

  const db = await store.loadStore(sp);

  // Determine query mode from metadata.
  let queryMode = 'keyword-only';
  let effectiveProvider = null;
  let stubNote = null;

  if (!fs.existsSync(mp)) {
    process.stderr.write('metadata.json missing but store exists. Run `knowledge rebuild` to fix.\n');
    process.exit(1);
  }

  if (fs.existsSync(mp)) {
    const metadata = store.readMetadata(mp);
    const state = resolveQueryMode(metadata, cfg, provider);
    queryMode = state.mode;
    effectiveProvider = state.provider;
  }

  if (queryMode === 'keyword-only') {
    stubNote = '[keyword-only mode — configure embedding provider for semantic search]';
  } else if (queryMode === 'upgrade-available') {
    stubNote = '[keyword-only mode store — run `knowledge rebuild` for semantic search with your configured provider]';
  }

  // Build where clause from filters.
  const where = {};
  if (options.phase) {
    const phases = options.phase.split(',').map((s) => s.trim());
    where.phase = phases.length === 1 ? { eq: phases[0] } : { in: phases };
  }
  if (options.workType) {
    const types = options.workType.split(',').map((s) => s.trim());
    where.work_type = types.length === 1 ? { eq: types[0] } : { in: types };
  }

  // Search.
  let results;
  const similarity = cfg.similarity_threshold || 0.8;

  if (queryMode === 'full' && effectiveProvider) {
    // Hybrid search — embed the query with retry, then search.
    const queryVector = await withRetry(
      () => effectiveProvider.embed(searchTerm),
      { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
    );
    results = await store.searchHybrid(db, {
      term: searchTerm,
      vector: queryVector,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit,
      similarity,
    });
  } else {
    // Fulltext only.
    results = await store.searchFulltext(db, {
      term: searchTerm,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit,
    });
  }

  // Re-rank.
  results = rerank(results, options.workUnit);

  // Apply limit after re-ranking (Orama may have returned up to limit,
  // but re-ranking could change nothing about count).
  if (results.length > limit) {
    results = results.slice(0, limit);
  }

  // Format output.
  const out = [];
  if (stubNote) out.push(stubNote);
  out.push(`[${results.length} results]`);

  for (const r of results) {
    out.push('');
    const date = formatDate(r.timestamp);
    out.push(`[${r.phase} | ${r.work_unit}/${r.topic} | ${r.confidence} | ${date}]`);
    out.push(r.content);
    out.push(`Source: ${r.source_file}`);
  }

  process.stdout.write(out.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Check command
// ---------------------------------------------------------------------------

async function cmdCheck(/* args, options, cfg, provider */) {
  const kDir = knowledgeDir();
  const configFile = path.join(kDir, 'config.json');
  const sp = storePath();

  // Condition 1: directory exists.
  if (!fs.existsSync(kDir)) {
    process.stdout.write('not-ready\n');
    return;
  }

  // Condition 2: config.json exists.
  if (!fs.existsSync(configFile)) {
    process.stdout.write('not-ready\n');
    return;
  }

  // Condition 3: store.msp exists and is loadable.
  if (!fs.existsSync(sp)) {
    process.stdout.write('not-ready\n');
    return;
  }

  try {
    await store.loadStore(sp);
  } catch (_) {
    process.stdout.write('not-ready\n');
    return;
  }

  process.stdout.write('ready\n');
}

// ---------------------------------------------------------------------------
// Remove command
// ---------------------------------------------------------------------------

async function cmdRemove(_args, options) {
  if (!options.workUnit) {
    process.stderr.write('Usage: knowledge remove --work-unit <wu> [--phase <p>] [--topic <t>]\n');
    process.exit(1);
  }

  if (options.topic && !options.phase) {
    process.stderr.write('Error: --topic requires --phase\n');
    process.exit(1);
  }

  const sp = storePath();
  const lp = lockFilePath();

  if (!fs.existsSync(sp)) {
    const desc = formatRemoveDesc(options);
    process.stdout.write(`Removed 0 chunks for ${desc}\n`);
    return;
  }

  let removed = 0;

  await store.withLock(lp, async () => {
    const db = await store.loadStore(sp);

    const where = { work_unit: { eq: options.workUnit } };
    if (options.phase) where.phase = { eq: options.phase };
    if (options.topic) where.topic = { eq: options.topic };

    removed = await store.removeByFilter(db, where);
    await store.saveStore(db, sp);
  });

  const desc = formatRemoveDesc(options);
  process.stdout.write(`Removed ${removed} chunks for ${desc}\n`);
}

function formatRemoveDesc(options) {
  if (options.topic) return `${options.workUnit}/${options.phase}/${options.topic}`;
  if (options.phase) return `${options.workUnit}/${options.phase}`;
  return `${options.workUnit} (all phases)`;
}

// ---------------------------------------------------------------------------
// Not-yet-implemented stub
// ---------------------------------------------------------------------------

function notYetImplemented(name) {
  process.stderr.write(`Command "${name}" is not yet implemented.\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rawArgs = process.argv.slice(2);
  const { positional, flags } = parseArgs(rawArgs);
  const command = positional[0];
  const commandArgs = positional.slice(1);
  const options = buildOptions(flags);

  if (!command) {
    process.stderr.write(USAGE + '\n');
    process.exit(1);
  }

  // Load config and resolve provider for commands that need them.
  let cfg = null;
  let provider = null;
  if (['index', 'query', 'rebuild'].includes(command)) {
    cfg = config.loadConfig();
    provider = config.resolveProvider(cfg);
  }

  switch (command) {
    case 'index':   await cmdIndex(commandArgs, options, cfg, provider); break;
    case 'query':   await cmdQuery(commandArgs, options, cfg, provider); break;
    case 'check':   await cmdCheck(commandArgs, options, cfg, provider); break;
    case 'status':  notYetImplemented('status'); break;
    case 'remove':  await cmdRemove(commandArgs, options, cfg, provider); break;
    case 'compact': notYetImplemented('compact'); break;
    case 'rebuild': notYetImplemented('rebuild'); break;
    case 'setup':   notYetImplemented('setup'); break;
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${USAGE}\n`);
      process.exit(1);
  }
}

module.exports = {
  parseArgs,
  buildOptions,
  deriveIdentity,
  resolveProviderState,
  withRetry,
  main,
  StubProvider,
  OpenAIProvider,
  store,
  chunker,
  config,
  knowledgeDir,
  storePath,
  metadataPath,
  lockFilePath,
  INDEXED_PHASES,
  KEYWORD_ONLY_DIMENSIONS,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  });
}
