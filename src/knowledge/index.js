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
const { OpenAIProvider, AuthError } = require('./providers/openai');
const config = require('./config');
const setup = require('./setup');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEXED_PHASES = ['research', 'discussion', 'investigation', 'specification'];

// Resolve manifest CLI path. In the bundled form, __dirname is
// skills/workflow-knowledge/scripts/. In source, __dirname is
// src/knowledge/. Both need to resolve to skills/workflow-manifest/scripts/manifest.cjs.
const MANIFEST_JS = (() => {
  const srcCandidate = path.join(__dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs');
  const bundledCandidate = path.join(__dirname, '..', '..', 'workflow-manifest', 'scripts', 'manifest.cjs');
  if (fs.existsSync(srcCandidate)) return srcCandidate;
  if (fs.existsSync(bundledCandidate)) return bundledCandidate;
  // Fail loud at load time — a missing manifest CLI would otherwise turn
  // every manifest-dependent command into a silent no-op (deferred-issue #5).
  throw new Error(
    'Could not locate manifest.cjs. Tried:\n' +
      `  ${srcCandidate}\n` +
      `  ${bundledCandidate}\n` +
      'This is an installation problem — the knowledge CLI cannot work without the manifest CLI.'
  );
})();

const DEFAULT_RETRY_BACKOFF = [1000, 2000, 4000];
const PENDING_CATCHUP_LIMIT = 5;
const PENDING_MAX_ATTEMPTS = 10;

// Default dimensions when creating a store in keyword-only mode.
// The store schema requires a dimension parameter, but keyword-only docs
// omit the embedding field entirely — this value just satisfies the schema.
const KEYWORD_ONLY_DIMENSIONS = 1536;

// Emit the stub-to-full upgrade note at most once per process to avoid
// spamming bulk-index runs that iterate over many files.
let stubUpgradeWarned = false;

// ---------------------------------------------------------------------------
// UserError — marker class for user-visible validation failures. Thrown at
// input-validation sites (bad path, provider mismatch, missing chunking
// config, etc.) where the error message is actionable advice for the user.
//
// Two behavioural contracts:
//   1. withRetry does not retry UserError (same treatment as programming
//      errors — retry would waste backoff budget on a permanent failure).
//   2. The top-level main().catch prints the message alone, no stack trace.
// ---------------------------------------------------------------------------

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

/**
 * Parse argv-style args into { positional, flags, boosts }.
 * Handles --flag value and --flag=value forms for regular flags.
 *
 * `--boost:<field> <value>` is special — repeatable, collected into an
 * ordered list. The field name is embedded in the flag name (not the value)
 * so skill templates never have to parse or escape a key/value separator.
 */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const boosts = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--boost:')) {
      const field = arg.slice('--boost:'.length);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        boosts.push({ field, value: argv[i + 1] });
        i += 2;
      } else {
        // Missing value — leave null so the command handler can error out
        // with a clear message at validation time.
        boosts.push({ field, value: null });
        i++;
      }
      continue;
    }
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
  return { positional, flags, boosts };
}

/**
 * Build an options object from parsed flags for command handlers.
 * `--work-unit` is a hard filter on every command that accepts it
 * (consistent with --phase, --topic, --work-type). Re-ranking happens
 * exclusively through --boost:<field>.
 */
function buildOptions(flags, boosts) {
  return {
    workType: flags['work-type'] || null,
    phase: flags['phase'] || null,
    workUnit: flags['work-unit'] || null,
    topic: flags['topic'] || null,
    limit: flags['limit'] ? parseInt(flags['limit'], 10) : null,
    dryRun: flags['dry-run'] === true || flags['dry-run'] === 'true',
    boosts: boosts || [],
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

Filter options (hard filters — non-matching chunks excluded):
  --work-type <type>        Filter by work type
  --work-unit <unit>        Filter by work unit
  --phase <phase>           Filter by phase
  --topic <topic>           Filter by topic

Re-ranking (query only, additive; repeat for multiple boosts):
  --boost:<field> <value>   Boost chunks matching <field>:<value> by +0.1
                            Valid fields: work-unit, work-type, phase,
                            topic, confidence

Other options:
  --limit <n>               Limit number of results
  --dry-run                 Preview without making changes
  --help, -h                Show this usage and exit 0`;

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
      // Don't retry programming errors — retrying a TypeError just burns
      // 7s of backoff before the stack trace reaches the user.
      // Also don't retry UserError or AuthError: validation failures and
      // bad/expired API keys will fail identically on every retry.
      if (
        err instanceof UserError ||
        err instanceof AuthError ||
        err instanceof TypeError ||
        err instanceof ReferenceError ||
        err instanceof SyntaxError ||
        err instanceof RangeError
      ) {
        throw err;
      }
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
    throw new UserError(
      `Cannot derive identity from path: ${filePath}\n` +
        'Expected path matching: .workflows/{work_unit}/{phase}/...'
    );
  }

  const workUnit = match[1];
  const phase = match[2];
  const rest = match[3];

  // Reject path-traversal and hidden-dir names. The regex allows
  // anything-without-slash, which would otherwise accept `..` or `.`
  // and escape the .workflows directory when path.resolve() is applied.
  if (workUnit === '.' || workUnit === '..' || workUnit.startsWith('.')) {
    throw new UserError(`Invalid work unit name: "${workUnit}"`);
  }

  // Validate indexed phase.
  if (!INDEXED_PHASES.includes(phase)) {
    throw new UserError(`File is in phase "${phase}" which is not indexed.`);
  }

  let topic;
  if (phase === 'specification') {
    // .workflows/{wu}/specification/{topic}/specification.md
    const specMatch = /^([^/]+)\/specification\.md$/.exec(rest);
    if (!specMatch) {
      throw new UserError(
        `Unexpected specification path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/specification/{topic}/specification.md'
      );
    }
    topic = specMatch[1];
  } else if (phase === 'discussion' || phase === 'investigation') {
    // .workflows/{wu}/{phase}/{topic}.md — flat file, no subdirectories.
    const flatMatch = /^([^/]+)\.md$/.exec(rest);
    if (!flatMatch) {
      throw new UserError(
        `Unexpected ${phase} path structure: ${rest}\n` +
          `Expected: .workflows/{work_unit}/${phase}/{topic}.md`
      );
    }
    topic = flatMatch[1];
  } else if (phase === 'research') {
    // .workflows/{wu}/research/{filename}.md — flat file.
    const resMatch = /^([^/]+)\.md$/.exec(rest);
    if (!resMatch) {
      throw new UserError(
        `Unexpected research path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/research/{filename}.md'
      );
    }
    topic = resMatch[1];
  }

  if (topic === '.' || topic === '..' || topic.startsWith('.')) {
    throw new UserError(`Invalid topic name: "${topic}"`);
  }

  return { workUnit, phase, topic };
}

/**
 * Read the work_type from the work unit's manifest.json.
 */
function readWorkType(workUnit) {
  const manifestFile = path.resolve(process.cwd(), '.workflows', workUnit, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    throw new UserError(`Work unit manifest not found: ${manifestFile}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!manifest.work_type) {
    throw new UserError(`Work unit manifest missing work_type field: ${manifestFile}`);
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
  // If the user has since configured a provider, warn once so they know
  // they're still in keyword-only mode and must `rebuild` to upgrade.
  if (metaProvider === null || metaProvider === undefined) {
    if (provider && !stubUpgradeWarned) {
      stubUpgradeWarned = true;
      process.stderr.write(
        'Note: store is keyword-only but an embedding provider is now configured. ' +
        'Run `knowledge rebuild` to switch to full hybrid search.\n'
      );
    }
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
    throw new UserError(
      'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n' +
        `  Store: provider=${metaProvider}, model=${metaModel}, dimensions=${metaDimensions}\n` +
        `  Config: provider=${cfg.provider}, model=${curModel}, dimensions=${curDimensions}`
    );
  }

  // Case 3: metadata has provider but current config does not.
  throw new UserError(
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
    throw new UserError(`Chunking config not found: ${chunkConfigPath}`);
  }
  const chunkConfig = JSON.parse(fs.readFileSync(chunkConfigPath, 'utf8'));

  // Read and chunk the source file.
  const absSource = path.resolve(sourceFile);
  const content = fs.readFileSync(absSource, 'utf8');
  const chunks = chunker.chunk(content, chunkConfig);

  if (chunks.length === 0) {
    throw new UserError(
      `No chunks produced from ${sourceFile}. Refusing to index an empty file — ` +
        'this would silently wipe any existing indexed chunks for this topic. ' +
        'Use `knowledge remove` explicitly if that is what you want.'
    );
  }

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

    // Re-validate provider state inside the lock. A concurrent rebuild or
    // another indexer could have rewritten the store with different
    // dimensions between our embedBatch call (outside the lock) and now
    // (deferred-issue #1 TOCTOU). If dimensions diverged, our embeddings
    // are the wrong width — abort, and withRetry at the CLI layer will
    // re-enter with fresh state.
    if (effectiveMode === 'full' && fs.existsSync(mp)) {
      const reloadedMeta = store.readMetadata(mp);
      const expectedDims = effectiveProvider.dimensions();
      if (reloadedMeta.provider && reloadedMeta.dimensions !== expectedDims) {
        throw new Error(
          'Store schema changed during index (concurrent rebuild). ' +
          `Embeddings produced for dims=${expectedDims}, store now has dims=${reloadedMeta.dimensions}. Retrying.`
        );
      }
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

    // Re-read metadata inside the lock to avoid clobbering concurrent
    // pending-queue mutations (addToPendingQueue runs under the same
    // lock, but an earlier addToPendingQueue may have committed between
    // our pre-lock load at line ~376 and this write).
    const freshMeta = fs.existsSync(mp) ? store.readMetadata(mp) : null;

    if (!freshMeta) {
      const newMeta = {
        provider: effectiveProvider ? cfg.provider : null,
        model: effectiveProvider ? effectiveProvider.model() : null,
        dimensions: effectiveProvider ? effectiveProvider.dimensions() : null,
        last_indexed: new Date().toISOString(),
        pending: [],
      };
      store.writeMetadata(mp, newMeta);
    } else {
      // Preserve provider/model/dimensions (never change once set) and
      // preserve the FRESHEST pending[] from disk.
      freshMeta.last_indexed = new Date().toISOString();
      if (!Array.isArray(freshMeta.pending)) freshMeta.pending = [];
      store.writeMetadata(mp, freshMeta);
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
 * Distinguish expected "not found" misses from broken-manifest / corrupt-JSON
 * / bad-path errors. Knowledge-base helpers swallow the former (lookups are
 * best-effort); the latter must be surfaced or bulk operations become silent
 * no-ops (deferred-issue #4).
 *
 * manifest.cjs uses exit code 2 for expected misses, 1 for real errors —
 * stable and unambiguous. execFileSync surfaces the code on err.status.
 */
function reportUnexpectedManifestError(context, err) {
  if (err && err.status === 2) return;
  const msg = err && err.stderr ? String(err.stderr).trim() : err.message;
  process.stderr.write(`Warning: manifest CLI failed in ${context}: ${msg}\n`);
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
  } catch (err) {
    reportUnexpectedManifestError('discoverArtifacts:list', err);
    return items;
  }

  if (!Array.isArray(workUnits) || workUnits.length === 0) return items;

  for (const wu of workUnits) {
    const wuName = wu.name;
    if (!wuName) continue;
    if (wu.status === 'cancelled') continue;

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
        } catch (err) {
          reportUnexpectedManifestError(
            `discoverArtifacts:resolve(${wuName}.${phase}.${topicName})`,
            err
          );
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
  const mp = metadataPath();

  // Ensure knowledge directory exists.
  if (!fs.existsSync(kDir)) {
    fs.mkdirSync(kDir, { recursive: true });
  }

  // Preflight: if a prior store exists, validate the current config's
  // provider/model/dimensions match what the store was built with. Without
  // this check, a config change (e.g. 128-dim stub → 1536-dim OpenAI) that
  // triggers bulk index would short-circuit at the isIndexed() step for
  // every file and report "Indexed 0 files. N already indexed." as though
  // everything were fine — while the stored embeddings are still at the old
  // dimensions. resolveProviderState throws a UserError with the "Run
  // `knowledge rebuild`" hint, same as `query` surfaces on mismatch.
  if (fs.existsSync(mp)) {
    const meta = store.readMetadata(mp);
    resolveProviderState(meta, cfg, provider);
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
      // All retries exhausted — add to pending queue. Write the stack to
      // stderr so debugging does not depend on users capturing it later.
      // Skip the stack for UserError — those are user-config validation
      // failures and the message line alone is the actionable signal.
      await addToPendingQueue(item.file, err.message);
      process.stderr.write(
        `Failed to index ${item.file} after 3 attempts: ${err.message}. Added to pending queue.\n`
      );
      if (err.stack && !(err instanceof UserError)) process.stderr.write(err.stack + '\n');
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

// Both pending-queue helpers are async and lock-protected to avoid
// read-modify-write races with concurrent index/bulk operations.

async function addToPendingQueue(file, errorMsg) {
  const mp = metadataPath();
  const kDir = knowledgeDir();
  const lp = lockFilePath();
  if (!fs.existsSync(kDir)) fs.mkdirSync(kDir, { recursive: true });

  await store.withLock(lp, async () => {
    let metadata;
    if (fs.existsSync(mp)) {
      metadata = store.readMetadata(mp);
    } else {
      // First-ever failure before any successful index — create a minimal
      // metadata file so failure tracking doesn't silently drop entries.
      metadata = {
        provider: null,
        model: null,
        dimensions: null,
        last_indexed: null,
        pending: [],
      };
    }
    if (!Array.isArray(metadata.pending)) metadata.pending = [];

    const existing = metadata.pending.findIndex((p) => p.file === file);
    const base = { file, failed_at: new Date().toISOString(), error: errorMsg };
    if (existing >= 0) {
      const prior = metadata.pending[existing];
      metadata.pending[existing] = { ...base, attempts: (prior.attempts || 1) + 1 };
    } else {
      metadata.pending.push({ ...base, attempts: 1 });
    }
    store.writeMetadata(mp, metadata);
  });
}

async function removePendingItem(file) {
  const mp = metadataPath();
  const lp = lockFilePath();
  if (!fs.existsSync(mp)) return;

  await store.withLock(lp, async () => {
    if (!fs.existsSync(mp)) return;
    const metadata = store.readMetadata(mp);
    if (!Array.isArray(metadata.pending)) return;
    metadata.pending = metadata.pending.filter((p) => p.file !== file);
    store.writeMetadata(mp, metadata);
  });
}

// IMPORTANT: The store lock is NOT reentrant. processPendingQueue calls
// indexSingleFile (acquires lock) and removePendingItem (acquires lock)
// from inside this function — each call must happen with no lock held
// at entry. Never wrap a call to processPendingQueue in withLock —
// doing so would cause a same-process deadlock.
async function processPendingQueue(cfg, provider, limit) {
  const mp = metadataPath();
  if (!fs.existsSync(mp)) return;

  const metadata = store.readMetadata(mp);
  if (!Array.isArray(metadata.pending) || metadata.pending.length === 0) return;

  const toProcess = metadata.pending.slice(0, limit);

  for (const item of toProcess) {
    if ((item.attempts || 0) >= PENDING_MAX_ATTEMPTS) {
      // Permanent failure — evict so the queue doesn't grow forever.
      process.stderr.write(
        `Pending item ${item.file} exceeded ${PENDING_MAX_ATTEMPTS} attempts — evicting. Last error: ${item.error}\n`
      );
      await removePendingItem(item.file);
      continue;
    }

    const absFile = path.resolve(item.file);
    if (!fs.existsSync(absFile)) {
      // File no longer exists — remove from queue.
      process.stderr.write(`Pending item ${item.file} no longer exists. Removing from queue.\n`);
      await removePendingItem(item.file);
      continue;
    }

    let identity;
    try {
      identity = deriveIdentity(item.file);
    } catch (_) {
      // Can't derive identity — remove from queue.
      await removePendingItem(item.file);
      continue;
    }

    try {
      await withRetry(
        () => indexSingleFile(item.file, identity, cfg, provider),
        { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
      );
      await removePendingItem(item.file);
    } catch (err) {
      // Still failing — bump attempts so eviction eventually fires.
      await addToPendingQueue(item.file, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Pending removal queue — mirrors the pending-index queue but for failed
// `knowledge remove` calls (lock timeout, store I/O error). Without this,
// a cancelled/superseded/promoted work unit's stale chunks persist in the
// store until the user manually retries.
// ---------------------------------------------------------------------------

const REMOVAL_MAX_ATTEMPTS = 10;

function removalKey(r) {
  return `${r.workUnit}|${r.phase || ''}|${r.topic || ''}`;
}

async function addPendingRemoval(opts, errorMsg) {
  const mp = metadataPath();
  const kDir = knowledgeDir();
  const lp = lockFilePath();
  if (!fs.existsSync(kDir)) fs.mkdirSync(kDir, { recursive: true });

  await store.withLock(lp, async () => {
    let metadata;
    if (fs.existsSync(mp)) {
      metadata = store.readMetadata(mp);
    } else {
      metadata = {
        provider: null,
        model: null,
        dimensions: null,
        last_indexed: null,
        pending: [],
        pending_removals: [],
      };
    }
    if (!Array.isArray(metadata.pending_removals)) metadata.pending_removals = [];

    const key = removalKey(opts);
    const existing = metadata.pending_removals.findIndex((r) => removalKey(r) === key);
    const base = {
      workUnit: opts.workUnit,
      phase: opts.phase || null,
      topic: opts.topic || null,
      queued_at: new Date().toISOString(),
      error: errorMsg,
    };
    if (existing >= 0) {
      const prior = metadata.pending_removals[existing];
      metadata.pending_removals[existing] = { ...base, attempts: (prior.attempts || 0) + 1 };
    } else {
      metadata.pending_removals.push({ ...base, attempts: 1 });
    }
    store.writeMetadata(mp, metadata);
  });
}

async function removePendingRemoval(opts) {
  const mp = metadataPath();
  const lp = lockFilePath();
  if (!fs.existsSync(mp)) return;

  await store.withLock(lp, async () => {
    if (!fs.existsSync(mp)) return;
    const metadata = store.readMetadata(mp);
    if (!Array.isArray(metadata.pending_removals)) return;
    const key = removalKey(opts);
    metadata.pending_removals = metadata.pending_removals.filter((r) => removalKey(r) !== key);
    store.writeMetadata(mp, metadata);
  });
}

// Lock semantics mirror processPendingQueue: never call while holding the
// store lock — each queued retry acquires the lock itself.
async function processPendingRemovals() {
  const mp = metadataPath();
  if (!fs.existsSync(mp)) return;

  const metadata = store.readMetadata(mp);
  if (!Array.isArray(metadata.pending_removals) || metadata.pending_removals.length === 0) return;

  const toProcess = metadata.pending_removals.slice();

  for (const item of toProcess) {
    if ((item.attempts || 0) >= REMOVAL_MAX_ATTEMPTS) {
      process.stderr.write(
        `Pending removal for ${removalKey(item)} exceeded ${REMOVAL_MAX_ATTEMPTS} attempts — evicting.\n`
      );
      await removePendingRemoval(item);
      continue;
    }

    try {
      await performRemoval({ workUnit: item.workUnit, phase: item.phase, topic: item.topic });
      process.stderr.write(`Drained pending removal for ${removalKey(item)}.\n`);
      await removePendingRemoval(item);
    } catch (err) {
      // Still failing — bump attempts so we eventually evict.
      try {
        await addPendingRemoval(
          { workUnit: item.workUnit, phase: item.phase, topic: item.topic },
          err.message
        );
      } catch (_) {
        // Metadata write failed — the next invocation will retry.
      }
    }
  }
}

// Perform the actual remove-by-filter operation under the store lock.
// Extracted from cmdRemove so the pending-removal queue can invoke it
// without re-running the CLI layer (argument parsing, exit codes).
async function performRemoval(opts) {
  const sp = storePath();
  const lp = lockFilePath();

  if (!fs.existsSync(sp)) return 0;

  let removed = 0;
  await store.withLock(lp, async () => {
    const db = await store.loadStore(sp);
    const where = { work_unit: { eq: opts.workUnit } };
    if (opts.phase) where.phase = { eq: opts.phase };
    if (opts.topic) where.topic = { eq: opts.topic };
    removed = await store.removeByFilter(db, where);
    await store.saveStore(db, sp);
  });
  return removed;
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
 * Parse a date-only string "YYYY-MM-DD" as local midnight. Returns null
 * on invalid input. Using `new Date("YYYY-MM-DD")` directly parses as
 * UTC, which shifts the effective date in non-UTC timezones — this
 * helper keeps the semantics consistent with `new Date()` (local).
 */
function parseLocalDate(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) {
    // Fall back to Date parser for ISO timestamps with time component.
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

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

// CLI boost field → store schema field. Kebab-case on the CLI surface,
// snake_case in the schema. Keeps the CLI consistent with --work-unit /
// --work-type while matching the indexed field names internally.
const BOOST_FIELD_MAP = {
  'work-unit': 'work_unit',
  'work-type': 'work_type',
  'phase': 'phase',
  'topic': 'topic',
  'confidence': 'confidence',
};
const BOOST_AMOUNT = 0.1;

/**
 * Application-level re-ranking per design doc lines 566-574.
 * Adjusts Orama scores based on user-specified boosts (+0.1 per match,
 * additive across boosts), plus always-on confidence tier and recency
 * signals. Returns the array sorted by adjusted score (descending).
 *
 * @param {Array} results  raw result rows
 * @param {Array<{field: string, value: string}>} boosts  normalised boost
 *        list — field is already mapped to the store schema name
 */
function rerank(results, boosts) {
  if (results.length === 0) return results;

  const maxTs = Math.max(...results.map((r) => r.timestamp || 0));
  const minTs = Math.min(...results.map((r) => r.timestamp || 0));
  const tsRange = maxTs - minTs || 1;

  return results
    .map((r) => {
      let adjustedScore = r.score || 0;

      // User-specified boosts — +0.1 per match, additive.
      if (Array.isArray(boosts)) {
        for (const b of boosts) {
          if (r[b.field] === b.value) {
            adjustedScore += BOOST_AMOUNT;
          }
        }
      }

      // Always-on confidence tier boost (0 to 0.04).
      const confRank = CONFIDENCE_RANK[r.confidence] || 0;
      adjustedScore += confRank * 0.01;

      // Always-on recency boost (0 to 0.05).
      const recency = ((r.timestamp || 0) - minTs) / tsRange;
      adjustedScore += recency * 0.05;

      return Object.assign({}, r, { score: adjustedScore });
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Validate user-supplied boost directives and map CLI field names to the
 * store schema field names. Exits with a clear error on unknown field or
 * missing value so skill-template typos don't silently no-op.
 */
function normaliseBoosts(boosts) {
  const out = [];
  for (const b of boosts) {
    if (!b.field || !BOOST_FIELD_MAP[b.field]) {
      process.stderr.write(
        `Unknown --boost field: "${b.field}". Valid fields: ${Object.keys(BOOST_FIELD_MAP).join(', ')}\n`
      );
      process.exit(1);
    }
    if (b.value == null || b.value === '') {
      process.stderr.write(`--boost:${b.field} requires a value\n`);
      process.exit(1);
    }
    out.push({ field: BOOST_FIELD_MAP[b.field], value: b.value });
  }
  return out;
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
    throw new UserError(
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
  throw new UserError(
    'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n' +
      `  Store: provider=${metaProvider}, model=${metaModel}, dimensions=${metaDimensions}\n` +
      `  Config: provider=${cfg.provider}, model=${curModel}, dimensions=${curDimensions}`
  );
}

async function cmdQuery(args, options, cfg, provider) {
  if (args.length === 0) {
    process.stderr.write('Usage: knowledge query <search_term> [<term2>...] [--work-unit ...] [--work-type ...] [--phase ...] [--topic ...] [--boost:<field> <value>]... [--limit N]\n');
    process.exit(1);
  }

  // Reject empty/whitespace-only terms. Orama treats an empty term as
  // "match everything" and returns up to `limit` arbitrary chunks — almost
  // certainly a caller mistake (fat-finger, variable template that wasn't
  // substituted) rather than an intentional "give me anything" request.
  for (const t of args) {
    if (typeof t !== 'string' || t.trim() === '') {
      throw new UserError(
        'Empty search term. `knowledge query` requires at least one non-empty positional term. ' +
          'If you intended to list everything indexed, use `knowledge status` instead.'
      );
    }
  }

  const searchTerms = args; // batch: multiple positional args
  const limit = options.limit || 10;
  const sp = storePath();
  const mp = metadataPath();

  if (!fs.existsSync(sp)) {
    process.stdout.write('[0 results]\n');
    return;
  }

  const db = await store.loadStore(sp);

  let queryMode = 'keyword-only';
  let effectiveProvider = null;
  let stubNote = null;

  if (!fs.existsSync(mp)) {
    process.stderr.write('metadata.json missing but store exists. Run `knowledge rebuild` to fix.\n');
    process.exit(1);
  }

  const metadata = store.readMetadata(mp);
  const state = resolveQueryMode(metadata, cfg, provider);
  queryMode = state.mode;
  effectiveProvider = state.provider;

  if (queryMode === 'keyword-only') {
    stubNote = '[keyword-only mode — configure embedding provider for semantic search]';
  } else if (queryMode === 'upgrade-available') {
    stubNote = '[keyword-only mode but embedding provider configured — run knowledge rebuild for full hybrid search]';
  }

  // Build where clause from hard filters. Every --flag that names a
  // dimension is a filter; re-ranking happens exclusively via --boost:<field>.
  const where = {};
  if (options.phase) {
    const phases = options.phase.split(',').map((s) => s.trim());
    where.phase = phases.length === 1 ? { eq: phases[0] } : { in: phases };
  }
  if (options.workType) {
    const types = options.workType.split(',').map((s) => s.trim());
    where.work_type = types.length === 1 ? { eq: types[0] } : { in: types };
  }
  if (options.workUnit) {
    const units = options.workUnit.split(',').map((s) => s.trim());
    where.work_unit = units.length === 1 ? { eq: units[0] } : { in: units };
  }
  if (options.topic) {
    const topics = options.topic.split(',').map((s) => s.trim());
    where.topic = topics.length === 1 ? { eq: topics[0] } : { in: topics };
  }

  // ?? (not ||) so an explicit `similarity_threshold: 0` — a legitimate
  // "accept all vector matches, no filtering" setting — isn't silently
  // rewritten to the default.
  const similarity = cfg.similarity_threshold ?? 0.8;
  const whereClause = Object.keys(where).length > 0 ? where : undefined;

  // Run a search per term and merge.
  const allResults = new Map(); // key: chunk id → result (highest score wins)

  for (const term of searchTerms) {
    let termResults;
    if (queryMode === 'full' && effectiveProvider) {
      const queryVector = await withRetry(
        () => effectiveProvider.embed(term),
        { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
      );
      termResults = await store.searchHybrid(db, {
        term,
        vector: queryVector,
        where: whereClause,
        limit: limit * 2, // over-fetch per term to improve merged coverage
        similarity,
      });
    } else {
      termResults = await store.searchFulltext(db, {
        term,
        where: whereClause,
        limit: limit * 2,
      });
    }

    // Merge — keep highest score per chunk.
    for (const r of termResults) {
      const existing = allResults.get(r.id);
      if (!existing || r.score > existing.score) {
        allResults.set(r.id, r);
      }
    }
  }

  // Re-rank merged results using --boost:<field> directives.
  const normalisedBoosts = normaliseBoosts(options.boosts);
  let results = rerank(Array.from(allResults.values()), normalisedBoosts);

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

  // Condition 2b: config.json parses and has the expected shape.
  // Without this, a corrupted config would pass `check` and the user
  // would only see the JSON parse error later on `index` or `query`,
  // with no hint that the root cause is the config file itself.
  try {
    config.readConfigFile(configFile);
  } catch (err) {
    process.stderr.write(`config error: ${err.message}\n`);
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
// Status command
// ---------------------------------------------------------------------------

async function cmdStatus() {
  const kDir = knowledgeDir();
  const sp = storePath();
  const mp = metadataPath();
  const out = [];

  out.push('=== Knowledge Base Status ===');
  out.push('');

  // Store existence check.
  if (!fs.existsSync(sp)) {
    out.push('Store: not initialized');
    out.push('Run `knowledge index` to build the index.');
    process.stdout.write(out.join('\n') + '\n');
    return;
  }

  const db = await store.loadStore(sp);
  const allChunks = await store.searchAllFulltext(db);

  // 1. Index summary.
  out.push(`Total chunks: ${allChunks.length}`);

  const byWu = {};
  const byPhase = {};
  const byWorkType = {};
  for (const c of allChunks) {
    byWu[c.work_unit] = (byWu[c.work_unit] || 0) + 1;
    byPhase[c.phase] = (byPhase[c.phase] || 0) + 1;
    byWorkType[c.work_type] = (byWorkType[c.work_type] || 0) + 1;
  }

  if (Object.keys(byWu).length > 0) {
    out.push('');
    out.push('By work unit:');
    for (const [wu, count] of Object.entries(byWu)) {
      out.push(`  ${wu}: ${count}`);
    }
  }

  if (Object.keys(byPhase).length > 0) {
    out.push('');
    out.push('By phase:');
    for (const [phase, count] of Object.entries(byPhase)) {
      out.push(`  ${phase}: ${count}`);
    }
  }

  if (Object.keys(byWorkType).length > 0) {
    out.push('');
    out.push('By work type:');
    for (const [wt, count] of Object.entries(byWorkType)) {
      out.push(`  ${wt}: ${count}`);
    }
  }

  // 2. Last indexed + 3. Store health.
  out.push('');
  const stat = fs.statSync(sp);
  const sizeKb = (stat.size / 1024).toFixed(1);
  out.push(`Store size: ${sizeKb} KB`);

  if (fs.existsSync(mp)) {
    const metadata = store.readMetadata(mp);
    out.push(`Last indexed: ${metadata.last_indexed || 'unknown'}`);

    // Provider info.
    if (metadata.provider) {
      out.push(`Provider: ${metadata.provider} (model: ${metadata.model}, dimensions: ${metadata.dimensions})`);
      out.push('Mode: Full (hybrid search)');
    } else {
      out.push('Provider: none');
      out.push('Mode: Keyword-only');
    }

    // 4. Pending items.
    if (Array.isArray(metadata.pending) && metadata.pending.length > 0) {
      out.push('');
      out.push(`Pending items: ${metadata.pending.length}`);
      for (const p of metadata.pending) {
        const a = p.attempts || 1;
        out.push(`  ${p.file} — ${p.error} (attempt ${a}/${PENDING_MAX_ATTEMPTS}, ${p.failed_at})`);
      }
    }

    // 4b. Pending removals.
    if (Array.isArray(metadata.pending_removals) && metadata.pending_removals.length > 0) {
      out.push('');
      out.push(`Pending removals: ${metadata.pending_removals.length}`);
      for (const r of metadata.pending_removals) {
        out.push(`  ${removalKey(r)} — ${r.error} (attempt ${r.attempts || 1}/${REMOVAL_MAX_ATTEMPTS})`);
      }
    }

    // 6. Provider mismatch warning.
    let cfg;
    try { cfg = config.loadConfig(); } catch (_) { cfg = null; }
    if (cfg) {
      const cfgProvider = config.resolveProvider(cfg);
      if (metadata.provider && cfgProvider) {
        if (metadata.provider !== cfg.provider ||
            metadata.model !== cfgProvider.model() ||
            metadata.dimensions !== cfgProvider.dimensions()) {
          out.push('');
          out.push('WARNING: Config has changed since last index. Run `knowledge rebuild` to reindex.');
        }
      }

      // 10. Stub-to-full upgrade note.
      if ((metadata.provider === null || metadata.provider === undefined) && cfgProvider) {
        out.push('');
        out.push('NOTE: Keyword-only mode but embedding provider configured. Run `knowledge rebuild` for full hybrid search.');
      }
    }
  } else {
    out.push('Metadata: missing (run `knowledge rebuild` to fix)');
  }

  // 7. Orphan detection — source files that no longer exist.
  const orphans = [];
  const seenSources = new Set();
  for (const c of allChunks) {
    if (seenSources.has(c.source_file)) continue;
    seenSources.add(c.source_file);
    if (!fs.existsSync(path.resolve(c.source_file))) {
      orphans.push(c.source_file);
    }
  }
  if (orphans.length > 0) {
    out.push('');
    out.push(`Orphaned chunks (source deleted): ${orphans.length} files`);
    for (const f of orphans) {
      out.push(`  ${f}`);
    }
  }

  // 8. Unindexed artifacts.
  try {
    const artifacts = discoverArtifacts();
    const unindexed = [];
    for (const a of artifacts) {
      const indexed = await isIndexed(db, a.workUnit, a.phase, a.topic);
      if (!indexed) unindexed.push(a.file);
    }
    if (unindexed.length > 0) {
      out.push('');
      out.push(`Unindexed completed artifacts: ${unindexed.length}`);
      for (const f of unindexed) {
        out.push(`  ${f}`);
      }
    }
  } catch (err) {
    // Discovery may fail if no manifest — surface so user can tell.
    process.stderr.write(`Warning: unindexed-artifact discovery failed: ${err.message}\n`);
  }

  // 9. Manifest-knowledge consistency. Load all manifests once via
  // `manifest list` rather than shelling out per spec topic — status was
  // O(specs) processes before, which meant ~5s on 50-spec repos.
  const consistency = [];
  let allManifests = null;
  try {
    allManifests = JSON.parse(runManifest(['list']));
  } catch (err) {
    reportUnexpectedManifestError('cmdStatus:list', err);
  }
  const manifestByName = new Map();
  if (Array.isArray(allManifests)) {
    for (const m of allManifests) if (m && m.name) manifestByName.set(m.name, m);
  }

  for (const wu of Object.keys(byWu)) {
    const m = manifestByName.get(wu);
    if (!m) continue;
    if (m.status === 'cancelled') {
      consistency.push(`Cancelled work unit still indexed: ${wu}`);
    }
  }
  // Superseded specs: look up each topic in the cached manifest tree.
  const specChunks = allChunks.filter((c) => c.phase === 'specification');
  const specTopics = new Set(specChunks.map((c) => `${c.work_unit}.specification.${c.topic}`));
  for (const key of specTopics) {
    const [wuName, , topicName] = key.split('.');
    const m = manifestByName.get(wuName);
    if (!m || !m.phases || !m.phases.specification || !m.phases.specification.items) continue;
    const topicData = m.phases.specification.items[topicName];
    if (topicData && topicData.status === 'superseded') {
      consistency.push(`Superseded spec still indexed: ${key}`);
    }
  }
  if (consistency.length > 0) {
    out.push('');
    out.push('Consistency warnings:');
    for (const w of consistency) {
      out.push(`  ${w}`);
    }
  }

  process.stdout.write(out.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Rebuild command
// ---------------------------------------------------------------------------

async function cmdRebuild(_args, options, cfg, provider) {
  const sp = storePath();
  const mp = metadataPath();
  const lp = lockFilePath();

  process.stderr.write(
    'Warning: This will delete the existing index and rebuild from scratch.\n' +
    'This is non-deterministic — the rebuilt index will differ from the original.\n' +
    "Type 'rebuild' to confirm: "
  );

  // Read a full line from stdin. Must not use `once('data', ...)` because
  // slow typers or non-line-buffered pipes can deliver input in multiple
  // chunks — the first chunk alone ("re") would fail the comparison.
  const input = await readStdinLine();

  if (input !== 'rebuild') {
    // Leading newline so the message doesn't run into whatever the user
    // typed at the prompt line.
    process.stderr.write('\nAborted.\n');
    process.exit(1);
  }

  // Discover artifacts BEFORE destroying the store. If discovery fails
  // or returns zero, we'd be wiping the index for nothing — refuse.
  const artifacts = discoverArtifacts();
  if (artifacts.length === 0) {
    process.stderr.write(
      'No completed artifacts found to index. Aborting rebuild — ' +
      'the existing index has NOT been modified.\n' +
      '(If you believe this is wrong, check that .workflows/ exists and ' +
      'that work units have items with status "completed".)\n'
    );
    process.exit(1);
  }

  const spBak = sp + '.bak';
  const mpBak = mp + '.bak';

  // Acquire lock before mutating files so a concurrent index/remove/
  // compact does not race past and resurrect partial state. Then write
  // an empty placeholder store+metadata inside the same lock so there
  // is no "uninitialised" window where another process could build a
  // fresh store racing with our bulk-index.
  //
  // Use .bak rename rather than delete so a bulk-index failure (network
  // outage, provider down, Ctrl-C) can be rolled back — otherwise a
  // transient failure leaves the user with no store and no metadata.
  await store.withLock(lp, async () => {
    // Clean any leftover .bak from a prior aborted rebuild.
    if (fs.existsSync(spBak)) fs.unlinkSync(spBak);
    if (fs.existsSync(mpBak)) fs.unlinkSync(mpBak);
    if (fs.existsSync(sp)) fs.renameSync(sp, spBak);
    if (fs.existsSync(mp)) fs.renameSync(mp, mpBak);

    // Write a sentinel empty store + keyword-only metadata so cmdCheck
    // and concurrent invocations see a valid (empty) state. The bulk
    // index below will overwrite these per-file.
    const dims = provider
      ? provider.dimensions()
      : (cfg && cfg.dimensions) || KEYWORD_ONLY_DIMENSIONS;
    const emptyDb = await store.createStore(dims);
    await store.saveStore(emptyDb, sp);
    store.writeMetadata(mp, {
      provider: provider ? cfg.provider : null,
      model: provider ? provider.model() : null,
      dimensions: provider ? provider.dimensions() : null,
      last_indexed: new Date().toISOString(),
      pending: [],
    });
  });
  process.stdout.write('Deleted existing index.\n');

  try {
    // Run bulk index (acquires the lock per-file internally).
    await cmdIndexBulk(options, cfg, provider);
  } catch (err) {
    // Roll back to the pre-rebuild state. Best-effort: if the rollback
    // itself fails (disk full, permission change), we surface both errors
    // so the user has enough to recover manually.
    try {
      await store.withLock(lp, async () => {
        if (fs.existsSync(spBak)) {
          if (fs.existsSync(sp)) fs.unlinkSync(sp);
          fs.renameSync(spBak, sp);
        }
        if (fs.existsSync(mpBak)) {
          if (fs.existsSync(mp)) fs.unlinkSync(mp);
          fs.renameSync(mpBak, mp);
        }
      });
      process.stderr.write(
        'Rebuild failed; restored previous index from backup.\n'
      );
    } catch (rollbackErr) {
      process.stderr.write(
        `Rebuild failed and rollback also failed. Previous index is at:\n` +
        `  ${spBak}\n  ${mpBak}\n` +
        `Rename them back manually to recover. Rollback error: ${rollbackErr.message}\n`
      );
    }
    throw err;
  }

  // Bulk index succeeded — discard the backup.
  if (fs.existsSync(spBak)) fs.unlinkSync(spBak);
  if (fs.existsSync(mpBak)) fs.unlinkSync(mpBak);
}

/**
 * Read stdin until a newline or 'end'. Accumulates chunks — safe against
 * partial reads on slow typers or non-line-buffered pipes.
 */
function readStdinLine() {
  return new Promise((resolve) => {
    let buf = '';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Trim trailing CR/LF plus any whitespace.
      const nl = buf.search(/\r|\n/);
      const line = nl === -1 ? buf : buf.slice(0, nl);
      resolve(line.trim());
    };

    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      buf += chunk;
      if (/\r|\n/.test(buf)) {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('end', onEnd);
        // Pause to release the reference — otherwise an unused stdin keeps
        // the event loop alive if the CLI is used as a library.
        process.stdin.pause();
        finish();
      }
    };
    const onEnd = () => {
      process.stdin.removeListener('data', onData);
      finish();
    };

    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.resume();
  });
}

// ---------------------------------------------------------------------------
// Remove command
// ---------------------------------------------------------------------------

async function cmdRemove(_args, options) {
  if (!options.workUnit) {
    process.stderr.write('Usage: knowledge remove --work-unit <wu> [--phase <p>] [--topic <t>] [--dry-run]\n');
    process.exit(1);
  }

  if (options.topic && !options.phase) {
    process.stderr.write('Error: --topic requires --phase\n');
    process.exit(1);
  }

  // Validate the work unit exists in the project registry. Without this,
  // `remove --work-unit <typo>` silently succeeds with "Removed 0 chunks"
  // — a fat-finger is indistinguishable from a real no-op. The registry
  // is authoritative (migration 031 backfills it from the filesystem),
  // so a miss here means the caller has the wrong name.
  //
  // This check lives in cmdRemove only, not performRemoval — the pending-
  // removal queue's drain path may legitimately target a WU that has since
  // been removed from the registry (e.g. after absorption), and the stored
  // chunks can still be cleaned up even when the WU entry is gone.
  try {
    runManifest(['project', 'get', options.workUnit]);
  } catch (err) {
    if (err && err.status === 2) {
      throw new UserError(
        `Work unit "${options.workUnit}" not found in project manifest. ` +
          'Check the name, or run `knowledge status` to see what is indexed.'
      );
    }
    // Any other manifest error is unexpected — rethrow so the stack shows.
    throw err;
  }

  const sp = storePath();
  const desc = formatRemoveDesc(options);

  // --dry-run is observational only: count what would be removed, touch
  // nothing on disk. Don't drain the pending-removal queue either — that
  // would be a real side effect.
  if (options.dryRun) {
    if (!fs.existsSync(sp)) {
      process.stdout.write(`Would remove 0 chunks for ${desc} (store not initialised)\n`);
      return;
    }
    const db = await store.loadStore(sp);
    const where = { work_unit: { eq: options.workUnit } };
    if (options.phase) where.phase = { eq: options.phase };
    if (options.topic) where.topic = { eq: options.topic };
    const count = await store.countByFilter(db, where);
    process.stdout.write(`Would remove ${count} chunks for ${desc}\n`);
    return;
  }

  // Drain any previously-failed removals first so stale chunks from earlier
  // cancellations/supersessions don't linger just because the store was
  // briefly locked.
  await processPendingRemovals();

  if (!fs.existsSync(sp)) {
    process.stdout.write(`Removed 0 chunks for ${desc}\n`);
    return;
  }

  try {
    const removed = await performRemoval(options);
    process.stdout.write(`Removed ${removed} chunks for ${desc}\n`);
  } catch (err) {
    await addPendingRemoval(options, err.message);
    process.stderr.write(
      `Removal of ${desc} failed (${err.message}). Queued for automatic retry on next remove/compact.\n`
    );
    process.exit(1);
  }
}

function formatRemoveDesc(options) {
  if (options.topic) return `${options.workUnit}/${options.phase}/${options.topic}`;
  if (options.phase) return `${options.workUnit}/${options.phase}`;
  return `${options.workUnit} (all phases)`;
}

// ---------------------------------------------------------------------------
// Compact command
// ---------------------------------------------------------------------------

/**
 * Get work unit status and completed_at via manifest CLI.
 * Returns { status, completed_at } or null on failure.
 */
function getWorkUnitMeta(workUnit) {
  try {
    const status = runManifest(['get', workUnit, 'status']).trim();
    let completedAt = null;
    try {
      completedAt = runManifest(['get', workUnit, 'completed_at']).trim();
      if (completedAt === '' || completedAt === 'undefined' || completedAt === 'null') {
        completedAt = null;
      }
    } catch (err) {
      // completed_at may not exist — expected. But surface unexpected errors.
      reportUnexpectedManifestError(`getWorkUnitMeta:get(${workUnit}.completed_at)`, err);
    }
    return { status, completed_at: completedAt };
  } catch (err) {
    // Work unit missing or manifest broken. "Not found" is expected for
    // orphaned work units referenced by stale chunks; anything else is a
    // real problem the user should see.
    reportUnexpectedManifestError(`getWorkUnitMeta:get(${workUnit}.status)`, err);
    return null;
  }
}

async function cmdCompact(_args, options, cfg) {
  // Drain any previously-failed removals first.
  await processPendingRemovals();

  const sp = storePath();
  const lp = lockFilePath();

  // Check decay config. Accept only: false (disabled) or non-negative integer.
  // Reject strings, negatives, NaN, non-integers — these would silently
  // produce either no-op (NaN cutoff) or mass deletion (negative cutoff).
  const rawDecay = cfg && cfg.decay_months !== undefined ? cfg.decay_months : config.DEFAULTS.decay_months;
  if (rawDecay === false) {
    process.stdout.write('Compaction disabled\n');
    return;
  }
  if (!Number.isInteger(rawDecay) || rawDecay < 0) {
    process.stderr.write(
      `Invalid decay_months: ${JSON.stringify(rawDecay)}. Expected false or a non-negative integer.\n`
    );
    process.exit(1);
  }
  const decayMonths = rawDecay;

  if (!fs.existsSync(sp)) return;

  const db = await store.loadStore(sp);

  // Calculate cutoff date.
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setMonth(cutoffDate.getMonth() - decayMonths);

  // Discover unique work units in the store by searching for all docs.
  const allResults = await store.searchAllFulltext(db);
  if (allResults.length === 0) return;

  // Group by work unit.
  const byWorkUnit = {};
  for (const r of allResults) {
    if (!byWorkUnit[r.work_unit]) byWorkUnit[r.work_unit] = [];
    byWorkUnit[r.work_unit].push(r);
  }

  // Evaluate each work unit.
  const removals = []; // { workUnit, count, phases: Set }
  const toRemoveIds = [];

  for (const [wu, chunks] of Object.entries(byWorkUnit)) {
    const meta = getWorkUnitMeta(wu);
    if (!meta) continue; // Orphaned — skip.
    if (meta.status !== 'completed') continue;
    if (!meta.completed_at) continue;

    // Parse completed_at as local midnight to match `now` (also local).
    // Using `new Date("YYYY-MM-DD")` parses as UTC, which can shift the
    // date by ±1 day in non-UTC timezones.
    const completedDate = parseLocalDate(meta.completed_at);
    if (!completedDate || isNaN(completedDate.getTime())) continue;

    // Check if expired: completed_at + decay_months <= now.
    const expiryDate = new Date(completedDate);
    expiryDate.setMonth(expiryDate.getMonth() + decayMonths);
    if (expiryDate > now) continue;

    // Expired — collect non-spec chunks.
    const candidates = chunks.filter((c) => c.phase !== 'specification');
    if (candidates.length === 0) continue;

    const phases = new Set(candidates.map((c) => c.phase));
    removals.push({ workUnit: wu, count: candidates.length, phases });

    for (const c of candidates) {
      toRemoveIds.push({ work_unit: c.work_unit, phase: c.phase, topic: c.topic });
    }
  }

  if (removals.length === 0) return; // Nothing to compact — silent exit.

  const totalChunks = removals.reduce((sum, r) => sum + r.count, 0);

  if (options.dryRun) {
    const out = [];
    out.push(`[dry-run] Compacted: removed ${totalChunks} chunks from ${removals.length} work units (completed > ${decayMonths} months ago)`);
    for (const r of removals) {
      out.push(`  • ${r.workUnit}: ${r.count} chunks (${Array.from(r.phases).join(', ')})`);
    }
    process.stdout.write(out.join('\n') + '\n');
    return;
  }

  // Actual removal — acquire lock.
  await store.withLock(lp, async () => {
    const freshDb = await store.loadStore(sp);

    // Deduplicate removal keys.
    const seen = new Set();
    for (const key of toRemoveIds) {
      const k = `${key.work_unit}|${key.phase}|${key.topic}`;
      if (seen.has(k)) continue;
      seen.add(k);
      await store.removeByIdentity(freshDb, key);
    }

    await store.saveStore(freshDb, sp);
  });

  const out = [];
  out.push(`Compacted: removed ${totalChunks} chunks from ${removals.length} work units (completed > ${decayMonths} months ago)`);
  for (const r of removals) {
    out.push(`  • ${r.workUnit}: ${r.count} chunks (${Array.from(r.phases).join(', ')})`);
  }
  process.stdout.write(out.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rawArgs = process.argv.slice(2);

  // Informational help: --help / -h / `help` subcommand. Writes USAGE to
  // stdout and exits 0 so scripts can probe the CLI without treating
  // help as a failure. `knowledge` with no args is still an error —
  // the user forgot a command (stderr, exit 1, handled below).
  if (rawArgs.includes('--help') || rawArgs.includes('-h') || rawArgs[0] === 'help') {
    process.stdout.write(USAGE + '\n');
    process.exit(0);
  }

  const { positional, flags, boosts } = parseArgs(rawArgs);
  const command = positional[0];
  const commandArgs = positional.slice(1);
  const options = buildOptions(flags, boosts);

  if (!command) {
    process.stderr.write(USAGE + '\n');
    process.exit(1);
  }

  // Load config and resolve provider for commands that need them.
  let cfg = null;
  let provider = null;
  if (['index', 'query', 'rebuild', 'compact'].includes(command)) {
    cfg = config.loadConfig();
    provider = config.resolveProvider(cfg);
  }

  switch (command) {
    case 'index':   await cmdIndex(commandArgs, options, cfg, provider); break;
    case 'query':   await cmdQuery(commandArgs, options, cfg, provider); break;
    case 'check':   await cmdCheck(commandArgs, options, cfg, provider); break;
    case 'status':  await cmdStatus(); break;
    case 'remove':  await cmdRemove(commandArgs, options, cfg, provider); break;
    case 'compact': await cmdCompact(commandArgs, options, cfg, provider); break;
    case 'rebuild': await cmdRebuild(commandArgs, options, cfg, provider); break;
    case 'setup':   await setup.cmdSetup(cmdIndexBulk, commandArgs, options); break;
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
  UserError,
  AuthError,
  main,
  cmdIndexBulk,
  StubProvider,
  OpenAIProvider,
  store,
  chunker,
  config,
  setup,
  knowledgeDir,
  storePath,
  metadataPath,
  lockFilePath,
  INDEXED_PHASES,
  KEYWORD_ONLY_DIMENSIONS,
};

if (require.main === module) {
  main().catch((err) => {
    // UserError: validation failure — show the message alone, no stack.
    // Anything else: full stack (likely a bug worth investigating).
    if (err instanceof UserError) {
      process.stderr.write('Error: ' + err.message + '\n');
    } else {
      process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    }
    process.exit(1);
  });
}
