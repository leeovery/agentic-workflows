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
const setupForms = require('./setup-forms');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEXED_PHASES = ['research', 'discussion', 'investigation', 'specification', 'imports', 'seeds', 'analysis', 'discovery'];

// Whitelist of indexable filenames in .workflows/{wu}/.state/, mapping each
// on-disk basename to its KB topic identity. The .state/ directory also holds
// operational metadata (migrations, environment-setup) that must never enter
// the KB. Restrict to the two analysis cache files.
const ANALYSIS_CACHE_FILES = {
  'research-analysis': 'research-analysis',
  'discovery-gap-analysis': 'gap-analysis',
};

// Resolve the engine CLI path (manifest reads go through `engine manifest`).
// In the bundled form, __dirname is skills/workflow-knowledge/scripts/. In
// source, __dirname is src/knowledge/. Both need to resolve to
// skills/workflow-engine/scripts/engine.cjs.
//
// Resolution is LAZY — at first manifest use, not module load. Keyless
// commands (`setup --keyword-only`, `check`) never touch the engine and
// must work without it; a load-time throw would kill them too. The
// fail-loud guarantee is preserved at use-time — a missing engine would
// otherwise turn every manifest-dependent command into a silent no-op
// (deferred-issue #5).
let ENGINE_JS = null;
function resolveEngineJs() {
  if (ENGINE_JS) return ENGINE_JS;
  const srcCandidate = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts', 'engine.cjs');
  const bundledCandidate = path.join(__dirname, '..', '..', 'workflow-engine', 'scripts', 'engine.cjs');
  if (fs.existsSync(srcCandidate)) {
    ENGINE_JS = srcCandidate;
  } else if (fs.existsSync(bundledCandidate)) {
    ENGINE_JS = bundledCandidate;
  } else {
    throw new Error(
      'Could not locate engine.cjs. Tried:\n' +
        `  ${srcCandidate}\n` +
        `  ${bundledCandidate}\n` +
        'This is an installation problem — the knowledge CLI cannot work without the workflow engine.'
    );
  }
  return ENGINE_JS;
}

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
  setup     Interactive setup wizard; non-interactive forms:
              setup --from-system
              setup --keyword-only
              setup --provider openai --model <m> [--dimensions <d>]
              setup --provider openai-compatible --base-url <u> --model <m> --dimensions <d>
              setup --key-only [--provider <id>]
            The API key is never a flag — it resolves from the provider env
            var or ~/.config/workflows/credentials.json (see --key-only)

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
  return path.resolve(config.findProjectRoot(), '.workflows', '.knowledge');
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

// Resolve a stored or relative artifact path against the PROJECT ROOT, never
// process.cwd(). Every artifact path that flows through the store — pending-
// queue entries, manifest-discovered imports/seeds/analysis/discovery files,
// and the source path handed to a single-file index — is recorded relative to
// the project root. Resolving them against cwd breaks every KB command
// invoked from a subdirectory: the pending queue evicts live items as "no
// longer exists" and bulk discovery silently skips unindexed artifacts.
// path.resolve short-circuits on an already-absolute input, so paths the
// engine returns absolute (manifest `resolve`) pass through unchanged.
function resolveArtifactPath(p) {
  return path.resolve(config.findProjectRoot(), p);
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
// Reject a work-unit or topic segment that contains a dot. deriveIdentity's
// `[^/]+` captures accept dots, but a dotted name is corrosive downstream: it
// is indexable once, then unreachable forever. Bulk discovery addresses topics
// as `wu.phase.topic` (manifest resolve), cmdStatus splits the same string on
// `.`, and cmdRemove probes `project.work_units.<wu>` — all break on an
// interior dot. Aligns with the engine's dot-free path rules.
function rejectDottedSegment(kind, name) {
  if (typeof name === 'string' && name.includes('.')) {
    throw new UserError(
      `Invalid ${kind} name "${name}": dots are not allowed. Work-unit and topic ` +
        'names double as manifest dot-path and knowledge-identity segments, so a ' +
        'dot leaves the artifact indexable but unreachable by status, remove, and discovery.'
    );
  }
}

function deriveIdentity(filePath) {
  // Normalise to forward slashes for pattern matching.
  const norm = filePath.replace(/\\/g, '/');

  // Analysis caches live at .workflows/{wu}/.state/{filename}.md and need a
  // separate match — the main phase regex enumerates known phases and would
  // not accept `.state` as a phase segment.
  const stateMatch = /\.workflows\/([^/]+)\/\.state\/(.+)$/.exec(norm);
  if (stateMatch) {
    const workUnit = stateMatch[1];
    const rest = stateMatch[2];
    if (workUnit === '.' || workUnit === '..' || workUnit.startsWith('.')) {
      throw new UserError(`Invalid work unit name: "${workUnit}"`);
    }
    rejectDottedSegment('work unit', workUnit);
    const fileMatch = /^([^/]+)\.md$/.exec(rest);
    if (!fileMatch) {
      throw new UserError(
        `Unexpected .state path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/.state/{filename}.md'
      );
    }
    const basename = fileMatch[1];
    if (!Object.prototype.hasOwnProperty.call(ANALYSIS_CACHE_FILES, basename)) {
      throw new UserError(
        `Refusing to index .state file "${basename}.md" — only analysis caches ` +
          `(${Object.keys(ANALYSIS_CACHE_FILES).join(', ')}) are indexable.`
      );
    }
    const topic = ANALYSIS_CACHE_FILES[basename];
    if (topic === '.' || topic === '..' || topic.startsWith('.')) {
      throw new UserError(`Invalid topic name: "${topic}"`);
    }
    return { workUnit, phase: 'analysis', topic };
  }

  // Match .workflows/{work_unit}/{phase}/{rest}
  const match = /\.workflows\/([^/]+)\/(research|discussion|investigation|specification|imports|seeds|discovery)\/(.+)$/.exec(norm);
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
  rejectDottedSegment('work unit', workUnit);

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
  } else if (phase === 'imports') {
    // .workflows/{wu}/imports/{filename}.md — flat file. Topic is the
    // basename without extension.
    const impMatch = /^([^/]+)\.md$/.exec(rest);
    if (!impMatch) {
      throw new UserError(
        `Unexpected imports path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/imports/{filename}.md'
      );
    }
    topic = impMatch[1];
  } else if (phase === 'seeds') {
    // .workflows/{wu}/seeds/{filename}.md — flat file. Topic is the
    // basename without extension. A seed is the work unit's origin (a
    // promoted inbox item), structurally a flat file like an import.
    const seedMatch = /^([^/]+)\.md$/.exec(rest);
    if (!seedMatch) {
      throw new UserError(
        `Unexpected seeds path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/seeds/{filename}.md'
      );
    }
    topic = seedMatch[1];
  } else if (phase === 'discovery') {
    // .workflows/{wu}/discovery/sessions/session-NNN.md — one file per session,
    // nested under sessions/. Topic is the session basename so each session is
    // a distinct KB identity and sessions never overwrite one another.
    const discMatch = /^sessions\/(session-\d+)\.md$/.exec(rest);
    if (!discMatch) {
      throw new UserError(
        `Unexpected discovery path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/discovery/sessions/session-NNN.md'
      );
    }
    topic = discMatch[1];
  }

  if (topic === '.' || topic === '..' || topic.startsWith('.')) {
    throw new UserError(`Invalid topic name: "${topic}"`);
  }
  rejectDottedSegment('topic', topic);

  return { workUnit, phase, topic };
}

/**
 * Read the work_type from the work unit's manifest.json.
 */
function readWorkType(workUnit) {
  const manifestFile = path.resolve(config.findProjectRoot(), '.workflows', workUnit, 'manifest.json');
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
 * Distinguish "provider configured but its API key could not be resolved"
 * from "no provider configured at all". Both leave config.resolveProvider()
 * returning null, but they demand opposite remedies. cfg.provider is the
 * tell: it's the provider NAME from config, set independently of whether the
 * key resolved. A provider that carries a key env var (openai) with no
 * resolved provider object means the key is missing — NOT that the store's
 * provider changed. Telling the two apart matters because the "changed —
 * rebuild" advice would discard the store's real embeddings for a keyword-only
 * rebuild when all that was actually needed was the key.
 */
function providerKeyUnresolved(cfg) {
  return !!(cfg && cfg.provider && config.PROVIDER_ENV_VARS[cfg.provider]);
}

/**
 * Build the UserError shown when a keyed provider is configured but its key
 * is unresolvable. Points at the env var and the key-only setup detour, and
 * explicitly warns against `rebuild` (which would destroy embeddings).
 */
function keyUnresolvedError(cfg) {
  const envVar = config.PROVIDER_ENV_VARS[cfg.provider];
  const keySource = envVar ? `export ${envVar}=...` : 'set the provider API key';
  return new UserError(
    `Embedding provider "${cfg.provider}" is configured, but its API key could not be resolved — ` +
      'the knowledge base fell back to keyword-only for this command.\n' +
      "  The store's embeddings are intact. Do NOT run `knowledge rebuild` — that discards them.\n" +
      '  Provide the key and retry:\n' +
      `    • ${keySource}            (session or CI), or\n` +
      '    • knowledge setup --key-only   (saves it to credentials.json)'
  );
}

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

  // Case 3: metadata has provider but resolveProvider() gave us none. Two
  // very different causes — a keyed provider whose key is missing (fix with
  // the key, never a rebuild) vs. a config that genuinely dropped its
  // provider. providerKeyUnresolved distinguishes them.
  if (providerKeyUnresolved(cfg)) {
    throw keyUnresolvedError(cfg);
  }
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

  // Validate file exists. Anchor at the project root, not cwd, so a source
  // path recorded relative to the project resolves the same from any
  // subdirectory (see resolveArtifactPath).
  const absSource = resolveArtifactPath(sourceFile);
  if (!fs.existsSync(absSource)) {
    process.stderr.write(`File not found: ${absSource}\n`);
    process.exit(1);
  }

  // Derive identity from path.
  const identity = deriveIdentity(sourceFile);

  // Index with retry wrapper.
  let chunkCount;
  try {
    chunkCount = await withRetry(
      () => indexSingleFile(sourceFile, identity, cfg, provider),
      { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
    );
  } catch (err) {
    // Permanent failures (validation UserError, bad/expired key AuthError,
    // programming errors) will fail identically on every retry — surface them
    // now with a non-zero exit rather than clogging the pending queue. Only a
    // TRANSIENT failure that exhausted its retries (network, lock timeout,
    // store I/O) is queued for automatic retry on the next index call — the
    // same durability contract cmdIndexBulk gives, which phase-completion (the
    // primary single-file caller) previously never got.
    const isPermanent =
      err instanceof UserError ||
      err instanceof AuthError ||
      err instanceof TypeError ||
      err instanceof ReferenceError ||
      err instanceof SyntaxError ||
      err instanceof RangeError;
    if (isPermanent) throw err;

    await addToPendingQueue(sourceFile, err.message);
    process.stderr.write(
      `Failed to index ${sourceFile} after 3 attempts: ${err.message}. Added to pending queue.\n`
    );
    if (err.stack) process.stderr.write(err.stack + '\n');
    return;
  }

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

  // Load chunking config. In the bundle, __dirname is
  // skills/workflow-knowledge/scripts/, whose sibling ../chunking/ ships the
  // configs. In source mode __dirname is src/knowledge/, whose sibling
  // ../chunking/ does NOT exist — fall back to the shipped skills directory so
  // the dev CLI can index too (mirrors resolveEngineJs's dual-candidate probe).
  let chunkConfigPath = path.join(__dirname, '..', 'chunking', identity.phase + '.json');
  if (!fs.existsSync(chunkConfigPath)) {
    const shipped = path.join(
      __dirname, '..', '..', 'skills', 'workflow-knowledge', 'chunking', identity.phase + '.json'
    );
    if (fs.existsSync(shipped)) chunkConfigPath = shipped;
  }
  if (!fs.existsSync(chunkConfigPath)) {
    throw new UserError(`Chunking config not found: ${chunkConfigPath}`);
  }
  const chunkConfig = JSON.parse(fs.readFileSync(chunkConfigPath, 'utf8'));

  // Read and chunk the source file. Anchor at the project root so a source
  // path recorded relative to the project (bulk discovery, pending queue)
  // reads correctly regardless of the invoking cwd.
  const absSource = resolveArtifactPath(sourceFile);
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

  // Build chunk documents. Stamp each chunk with the source document's date
  // (its mtime), not index time — otherwise bulk/fresh indexing (install,
  // reindex, migration) marks every legacy doc as "today", corrupting the
  // provenance shown in query headers and the recency signal. `last_indexed`
  // (set below) stays wall-clock; that one genuinely means "store last built".
  const docTimestamp = fs.statSync(absSource).mtimeMs;
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
      timestamp: docTimestamp,
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
 * Run an `engine manifest` read and return stdout.
 */
function runManifest(args) {
  const { execFileSync } = require('child_process');
  // Spawn with cwd anchored at the project root so the engine's own
  // cwd-relative resolution lands at the right place even when KB
  // commands are invoked from a subdirectory.
  return execFileSync('node', [resolveEngineJs(), 'manifest', ...args], {
    cwd: config.findProjectRoot(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Surface real manifest-read failures (corrupt JSON, broken paths, etc.).
 * Expected misses are no longer thrown — `get` returns empty stdout + exit 0
 * for missing work units / fields, so callers detect them by checking output.
 */
function reportUnexpectedManifestError(context, err) {
  const msg = err && err.stderr ? String(err.stderr).trim() : err.message;
  process.stderr.write(`Warning: manifest read failed in ${context}: ${msg}\n`);
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
 * Discover all completed artifacts across all work units via engine manifest reads.
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
      // Imports and seeds live at top-level wu.imports[] / wu.seeds[], not
      // under wu.phases.* — they need separate traversals. Skip in this loop
      // and handle below.
      if (phase === 'imports') continue;
      if (phase === 'seeds') continue;
      // Analysis caches are file-based, not manifest-tracked. Handled
      // separately at the end of this work-unit iteration.
      if (phase === 'analysis') continue;
      // Discovery logs are session files, not manifest-per-topic. Epic-only,
      // handled by a dedicated traversal at the end of this iteration.
      if (phase === 'discovery') continue;

      const phaseData = wu.phases && wu.phases[phase];
      if (!phaseData || !phaseData.items) continue;

      for (const [topicName, topicData] of Object.entries(phaseData.items)) {
        if (!topicData || topicData.status !== 'completed') continue;

        // Resolve file path via engine manifest resolve.
        try {
          const raw = runManifest(['resolve', `${wuName}.${phase}.${topicName}`]);
          const filePath = raw.trim();
          if (filePath && fs.existsSync(resolveArtifactPath(filePath))) {
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

    // Imports — top-level array on the work unit, no per-item status. Each
    // entry's path is relative to the work-unit directory. Topic identity is
    // the basename without .md (matches deriveIdentity).
    //
    // Path validation: import-files.md only ever writes "imports/<basename>.md"
    // to the manifest. A different shape here means either manual tampering
    // or a flow we don't recognise — refuse to index in either case so the
    // store can't be poisoned by a manifest-injection vector. The validation
    // mirrors deriveIdentity's checks (no slash beyond the imports/ prefix,
    // no .. segments, no dotfile basenames).
    const seenImportTopics = new Set();
    if (Array.isArray(wu.imports)) {
      for (const entry of wu.imports) {
        if (!entry || typeof entry.path !== 'string') continue;
        const rel = entry.path;
        // Must be exactly imports/{filename}.md — no subdirectories, no escapes.
        const m = /^imports\/([^/]+\.md)$/.exec(rel);
        if (!m) continue;
        const filename = m[1];
        if (filename.includes('..') || filename.startsWith('.')) continue;
        const base = filename.slice(0, -3); // strip .md
        if (!base || base === '.' || base === '..' || base.startsWith('.')) continue;
        // Dedupe by topic identity — re-imports may push duplicate manifest
        // entries (acceptable noise per the design), but bulk index should
        // process each identity once.
        if (seenImportTopics.has(base)) continue;
        seenImportTopics.add(base);
        const filePath = path.posix.join('.workflows', wuName, rel);
        if (!fs.existsSync(resolveArtifactPath(filePath))) continue;
        items.push({ file: filePath, workUnit: wuName, phase: 'imports', topic: base });
      }
    }

    // Seeds — top-level array on the work unit (the work's origin: promoted
    // inbox items), no per-item status. Same shape and validation as imports,
    // but rooted at "seeds/<basename>.md". Kept separate from imports so a
    // seed stays deterministically distinguishable from reference material.
    const seenSeedTopics = new Set();
    if (Array.isArray(wu.seeds)) {
      for (const entry of wu.seeds) {
        if (!entry || typeof entry.path !== 'string') continue;
        const rel = entry.path;
        // Must be exactly seeds/{filename}.md — no subdirectories, no escapes.
        const m = /^seeds\/([^/]+\.md)$/.exec(rel);
        if (!m) continue;
        const filename = m[1];
        if (filename.includes('..') || filename.startsWith('.')) continue;
        const base = filename.slice(0, -3); // strip .md
        if (!base || base === '.' || base === '..' || base.startsWith('.')) continue;
        if (seenSeedTopics.has(base)) continue;
        seenSeedTopics.add(base);
        const filePath = path.posix.join('.workflows', wuName, rel);
        if (!fs.existsSync(resolveArtifactPath(filePath))) continue;
        items.push({ file: filePath, workUnit: wuName, phase: 'seeds', topic: base });
      }
    }

    // Analysis caches — file-based, not manifest-tracked. Two known paths per
    // work unit; discover by existence on disk.
    for (const [basename, topic] of Object.entries(ANALYSIS_CACHE_FILES)) {
      const filePath = path.posix.join('.workflows', wuName, '.state', `${basename}.md`);
      if (!fs.existsSync(resolveArtifactPath(filePath))) continue;
      items.push({ file: filePath, workUnit: wuName, phase: 'analysis', topic });
    }

    // Discovery session logs — epic-only, file-based (not manifest-per-topic).
    // One indexed doc per session file, topic = session basename, so sessions
    // coexist rather than overwrite. Non-epic discovery logs are thin
    // shape-and-route and are not indexed.
    if (wu.work_type === 'epic') {
      const sessDir = path.posix.join('.workflows', wuName, 'discovery', 'sessions');
      let sessFiles = [];
      try {
        sessFiles = fs.readdirSync(resolveArtifactPath(sessDir)).filter((f) => /^session-\d+\.md$/.test(f));
      } catch (_) {
        sessFiles = [];
      }
      for (const f of sessFiles) {
        items.push({ file: path.posix.join(sessDir, f), workUnit: wuName, phase: 'discovery', topic: f.slice(0, -3) });
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
      // Skip the stack for UserError and AuthError — both are user-config
      // failures (validation / bad API key) where the message line alone
      // is the actionable signal.
      await addToPendingQueue(item.file, err.message);
      process.stderr.write(
        `Failed to index ${item.file} after 3 attempts: ${err.message}. Added to pending queue.\n`
      );
      const isUserFacing = err instanceof UserError || err instanceof AuthError;
      if (err.stack && !isUserFacing) process.stderr.write(err.stack + '\n');
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

    const absFile = resolveArtifactPath(item.file);
    if (!fs.existsSync(absFile)) {
      // File no longer exists — remove from queue. Anchored at the project
      // root so a pending entry (stored relative to the project) is not
      // wrongly evicted when the CLI runs from a subdirectory.
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

// C0 control characters except \t (0x09) and \n (0x0A). Indexed artifacts
// are user-authored files — one carrying ANSI escapes (\x1b[...m) or a raw
// NUL would otherwise pass through `query` output verbatim and be
// interpreted by the reader's terminal.
const CONTROL_CHARS_RE = /[\x00-\x08\x0b-\x1f]/g;

/**
 * Strip C0 control characters (except \n and \t) from chunk-derived text.
 * Applied at query-output composition time only — stored content is never
 * mutated.
 */
function stripControlChars(s) {
  return String(s).replace(CONTROL_CHARS_RE, '');
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

// ---------------------------------------------------------------------------
// Progress clock (watermark) — idea #33
//
// A logical clock that advances on completed WORK, not wall-clock time. For a
// given work unit, `progressElapsed` is the summed significance weight of the
// work units that completed strictly after it — where weight = topics ×
// weight[work_type] (a quick-fix advances the clock less than a feature; a
// multi-topic epic more). A dormant gap produces no completions, so the clock
// doesn't move — the whole point: decay tracks how far the project has moved
// past a unit, not how many calendar months have passed. Consumers (rerank
// down-rank, compact pruning) turn progressElapsed into a retrievability
// R = 0.9^(progressElapsed / S). Derived entirely from manifest completed_at +
// work_type/topics — no stored state, no migration.
// ---------------------------------------------------------------------------

/**
 * Parse a work unit's completed_at into epoch ms. Accepts an epoch number, an
 * ISO timestamp, or a "YYYY-MM-DD" date (via parseLocalDate). Returns null for
 * missing/blank/unparseable values — such units can't be placed on the clock.
 */
function parseCompletionTime(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim();
  if (str === '' || str === 'null') return null;
  const d = parseLocalDate(str);
  return d && !isNaN(d.getTime()) ? d.getTime() : null;
}

/**
 * Topics a work unit spans. Only epics are multi-topic; every other work type
 * is single-topic (topic === work unit). Counts distinct topic names across all
 * of the epic's phase items; falls back to 1.
 */
function topicCount(unit) {
  if (!unit || unit.work_type !== 'epic') return 1;
  const phases = unit.phases || {};
  const topics = new Set();
  for (const phase of Object.keys(phases)) {
    const items = phases[phase] && phases[phase].items;
    if (items) for (const t of Object.keys(items)) topics.add(t);
  }
  return topics.size > 0 ? topics.size : 1;
}

/**
 * Significance weight a completed unit contributes to the clock:
 * topics × weight[work_type]. An unknown/absent work type (or empty weights
 * map) falls back to a per-topic factor of 1.0 — so non-epics weigh 1 and an
 * epic still weighs its topic count.
 */
function unitWeight(unit, weights) {
  const w = weights && weights[unit.work_type];
  const factor = typeof w === 'number' && w >= 0 ? w : 1.0;
  return topicCount(unit) * factor;
}

/**
 * Build the progress clock from a set of completed work units.
 *
 * @param {Array<{name, completed_at?, work_type?, phases?}>} units
 * @param {Object<string, number>} [weights]  work_type → per-topic weight;
 *   omitted/empty → per-topic factor 1.0 (non-epics weigh 1, epics weigh topics).
 * @returns {Map<string, number>}  workUnitName → progressElapsed = summed
 *   significance weight of units that completed strictly later (by completed_at).
 *   Units with no usable completed_at are omitted; consumers treat an absent
 *   unit as 0 (frontier / not-yet-decaying). Ties do not count one another.
 */
function buildProgressClock(units, weights) {
  const dated = [];
  for (const u of Array.isArray(units) ? units : []) {
    if (!u || !u.name) continue;
    const t = parseCompletionTime(u.completed_at);
    if (t === null) continue;
    dated.push({ name: u.name, t, weight: unitWeight(u, weights || {}) });
  }
  const clock = new Map();
  for (const a of dated) {
    let elapsed = 0;
    for (const b of dated) {
      if (b.t > a.t) elapsed += b.weight;
    }
    clock.set(a.name, elapsed);
  }
  return clock;
}

/**
 * Merge configured decay_weights over the defaults. The config merge replaces
 * the whole object on override, so this refills any types the user omitted.
 */
function resolveDecayWeights(cfg) {
  const base = (config.DEFAULTS && config.DEFAULTS.decay_weights) || {};
  const override = cfg && cfg.decay_weights;
  if (override && typeof override === 'object' && !Array.isArray(override)) {
    return Object.assign({}, base, override);
  }
  return Object.assign({}, base);
}

/**
 * Gather completed work units from the manifest and build the progress clock.
 * Thin IO glue around buildProgressClock; degrades to an empty Map (→ no decay)
 * on any failure. `list` returns full manifests, so name/status/completed_at/
 * work_type/phases all come from a single call.
 *
 * @param {Object<string, number>} [weights]  significance weights (resolved
 *   from config by the caller). Omitted → plain unit-count.
 */
function getProgressClock(weights) {
  let units;
  try {
    units = JSON.parse(runManifest(['list']));
  } catch (err) {
    reportUnexpectedManifestError('getProgressClock:list', err);
    return new Map();
  }
  if (!Array.isArray(units)) return new Map();
  const completed = units
    .filter((u) => u && u.name && u.status === 'completed')
    .map((u) => ({
      name: u.name,
      completed_at: u.completed_at,
      work_type: u.work_type,
      phases: u.phases,
    }));
  return buildProgressClock(completed, weights);
}

const DECAY_BASE = 0.9;           // R when progressElapsed === stability (10% down)
const DEFAULT_BASE_STABILITY = 3; // S0 fallback when config is absent

/**
 * Retrievability R = DECAY_BASE^(progressElapsed / stability), in (0, 1].
 * progressElapsed 0 → R = 1 (frontier, undateable unit, or spec). More work
 * completed past a chunk's unit → smaller R. This is the multiplier the soft
 * down-rank applies to a chunk's base relevance.
 */
function retrievability(progressElapsed, stability) {
  const p = progressElapsed > 0 ? progressElapsed : 0;
  if (p === 0) return 1;
  const s = stability > 0 ? stability : DEFAULT_BASE_STABILITY;
  return Math.pow(DECAY_BASE, p / s);
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
 * Application-level re-ranking. Applies progress-driven soft down-rank, then
 * user-specified boosts (+0.1 per match) and an always-on confidence tier
 * boost. Returns the array sorted by adjusted score (descending).
 *
 * Soft down-rank: the base relevance is multiplied by retrievability
 * R = 0.9^(progressElapsed / stability), which decays as the project completes
 * work past a chunk's work unit (see the progress clock). A decayed chunk sinks
 * but is never removed. Specs never decay. R attenuates only the similarity
 * score — intentional boosts are added on top, undimmed. (Replaces the former
 * timestamp-relative recency boost, which was both weak and — pre-#33 — fed by
 * a broken index-time timestamp.)
 *
 * @param {Array} results  raw result rows; each may carry `progressElapsed`
 *        (attached by the query pipeline; absent → 0 → no decay)
 * @param {Array<{field: string, value: string}>} boosts  normalised boost list
 * @param {number} stability  S0 for the decay curve
 */
function rerank(results, boosts, stability = DEFAULT_BASE_STABILITY) {
  if (results.length === 0) return results;

  return results
    .map((r) => {
      // Specs never decay; everything else decays by progressElapsed.
      const progressElapsed = r.phase === 'specification' ? 0 : (r.progressElapsed || 0);
      const R = retrievability(progressElapsed, stability);
      let adjustedScore = (r.score || 0) * R;

      // User-specified boosts — +0.1 per match, additive (undimmed by decay).
      if (Array.isArray(boosts)) {
        for (const b of boosts) {
          if (r[b.field] === b.value) {
            adjustedScore += BOOST_AMOUNT;
          }
        }
      }

      // Always-on confidence tier boost (0 to 0.04), additive.
      const confRank = CONFIDENCE_RANK[r.confidence] || 0;
      adjustedScore += confRank * 0.01;

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
    // A keyed provider with an unresolved key looks identical to "no provider"
    // here, but the remedy is the key, not a store-destroying rebuild.
    if (providerKeyUnresolved(cfg)) {
      throw keyUnresolvedError(cfg);
    }
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

  // Attach the progress-clock distance to each result, then re-rank: soft
  // down-rank by retrievability + user --boost directives. The clock is derived
  // once from the manifest; on failure it's empty → progressElapsed 0 → no decay.
  const progressClock = getProgressClock(resolveDecayWeights(cfg));
  const stability =
    cfg && Number.isFinite(cfg.decay_base_stability)
      ? cfg.decay_base_stability
      : config.DEFAULTS.decay_base_stability;
  const merged = Array.from(allResults.values()).map((r) =>
    Object.assign({}, r, { progressElapsed: progressClock.get(r.work_unit) || 0 })
  );

  const normalisedBoosts = normaliseBoosts(options.boosts);
  let results = rerank(merged, normalisedBoosts, stability);

  if (results.length > limit) {
    results = results.slice(0, limit);
  }

  // Format output.
  const out = [];
  if (stubNote) out.push(stubNote);
  out.push(`[${results.length} results]`);

  for (const r of results) {
    out.push('');
    // Header date is the source document's date (its mtime at index time) —
    // i.e. when the work was authored, not when the store was indexed.
    const date = formatDate(r.timestamp);
    out.push(`[${r.phase} | ${r.work_unit}/${r.topic} | ${r.confidence} | ${date}]`);
    out.push(r.content);
    out.push(`Source: ${r.source_file}`);
  }

  // Sanitise the whole composed output (content, headers, source lines) at
  // the boundary — \n is exempt from the strip, so joins survive.
  process.stdout.write(stripControlChars(out.join('\n')) + '\n');
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

  // Condition 4: metadata.json exists. A store WITHOUT metadata is the
  // partial state `query` refuses ("metadata.json missing but store exists")
  // and that setup/setup-forms refuse toward rebuild — so `check` must not
  // report it ready. Without this, boot's gate would pass and the failure
  // would only surface later on the first query.
  if (!fs.existsSync(metadataPath())) {
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
  // Resolve relative to the project root (found by walking up from cwd)
  // rather than cwd directly, so status invoked from a subdirectory
  // does not mark every chunk as orphaned.
  const projectRoot = config.findProjectRoot();
  const orphans = [];
  const seenSources = new Set();
  for (const c of allChunks) {
    if (seenSources.has(c.source_file)) continue;
    seenSources.add(c.source_file);
    if (!fs.existsSync(path.resolve(projectRoot, c.source_file))) {
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
      'No artifacts to index. Aborting rebuild — ' +
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
    // pending[] resets to empty and pending_removals is deliberately dropped:
    // rebuild reindexes every artifact from scratch, so a queued index retry
    // is redundant and a queued removal targets chunks that no longer exist in
    // the fresh store. Both queues are meaningless against the rebuilt index.
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
  // Registry presence determines whether this is a "named WU" remove (the
  // common path) or an "orphan-chunk cleanup" remove (the escape hatch
  // when chunks linger after absorption / manual registry mutation). On
  // registry-not-found, fall through to a store probe — if the store has
  // chunks for this WU we treat it as an orphan cleanup and proceed; if
  // not, surface the typo error.
  let isOrphanCleanup = false;
  const projectEntry = runManifest(['get', `project.work_units.${options.workUnit}`]).trim();
  if (projectEntry === '') {
    const sp = storePath();
    let storeMatch = 0;
    if (fs.existsSync(sp)) {
      const db = await store.loadStore(sp);
      const where = { work_unit: { eq: options.workUnit } };
      if (options.phase) where.phase = { eq: options.phase };
      if (options.topic) where.topic = { eq: options.topic };
      storeMatch = await store.countByFilter(db, where);
    }
    if (storeMatch === 0) {
      throw new UserError(
        `Work unit "${options.workUnit}" not found in project manifest, ` +
          `and no matching chunks exist in the knowledge base.\n` +
          `  Check the name with \`knowledge status\`.`
      );
    }
    // Stranded chunks. Proceed with removal as an orphan cleanup.
    isOrphanCleanup = true;
    process.stderr.write(
      `Work unit "${options.workUnit}" is not in the project manifest, but ` +
        `${storeMatch} chunks remain in the store. Removing as an orphan cleanup.\n`
    );
  }

  const sp = storePath();
  const desc = formatRemoveDesc(options) + (isOrphanCleanup ? ' (orphan cleanup)' : '');

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

async function cmdCompact(_args, options, cfg) {
  // Drain any previously-failed removals first.
  await processPendingRemovals();

  const sp = storePath();
  const lp = lockFilePath();

  // Decay is progress-based now (idea #33). `compact` is a pure storage
  // backstop: it prunes a unit's non-spec chunks only once their retrievability
  // R has fallen below decay_prune_below — by then they're already unreachable
  // in ranking, so removal is hygiene, not a relevance call. false/null
  // disables pruning entirely; relevance still decays live in query ranking.
  const rawPrune = cfg && cfg.decay_prune_below !== undefined ? cfg.decay_prune_below : config.DEFAULTS.decay_prune_below;
  if (rawPrune === false || rawPrune === null) {
    process.stdout.write('Compaction disabled\n');
    return;
  }
  if (typeof rawPrune !== 'number' || !Number.isFinite(rawPrune) || rawPrune < 0 || rawPrune > 1) {
    process.stderr.write(
      `Invalid decay_prune_below: ${JSON.stringify(rawPrune)}. Expected false or a number in [0, 1].\n`
    );
    process.exit(1);
  }
  const pruneBelow = rawPrune;
  const stability =
    cfg && Number.isFinite(cfg.decay_base_stability)
      ? cfg.decay_base_stability
      : config.DEFAULTS.decay_base_stability;

  if (!fs.existsSync(sp)) return;

  const db = await store.loadStore(sp);

  // Discover unique work units in the store by searching for all docs.
  const allResults = await store.searchAllFulltext(db);
  if (allResults.length === 0) return;

  // Progress clock: how far the project has moved past each unit. A unit
  // absent from the clock (in-progress / undateable) has progressElapsed 0 →
  // R = 1 → never pruned.
  const progressClock = getProgressClock(resolveDecayWeights(cfg));

  // Group by work unit.
  const byWorkUnit = {};
  for (const r of allResults) {
    if (!byWorkUnit[r.work_unit]) byWorkUnit[r.work_unit] = [];
    byWorkUnit[r.work_unit].push(r);
  }

  // Evaluate each work unit against the prune floor.
  const removals = []; // { workUnit, count, phases: Set }
  const toRemoveIds = [];

  for (const [wu, chunks] of Object.entries(byWorkUnit)) {
    const progressElapsed = progressClock.get(wu) || 0;
    if (progressElapsed === 0) continue; // frontier / in-progress — keep
    const R = retrievability(progressElapsed, stability);
    if (R >= pruneBelow) continue; // still reachable in ranking — keep

    // Buried below the floor — prune non-spec chunks only (specs never decay).
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
    out.push(`[dry-run] Compacted: removed ${totalChunks} chunks from ${removals.length} work units (retrievability < ${pruneBelow})`);
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
  out.push(`Compacted: removed ${totalChunks} chunks from ${removals.length} work units (retrievability < ${pruneBelow})`);
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
    case 'setup':   await setupForms.cmdSetup(cmdIndexBulk, setup.cmdSetup, commandArgs, flags, options); break;
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
  setupForms,
  knowledgeDir,
  storePath,
  metadataPath,
  lockFilePath,
  INDEXED_PHASES,
  KEYWORD_ONLY_DIMENSIONS,
  buildProgressClock,
  getProgressClock,
  retrievability,
  rerank,
};

if (require.main === module) {
  main().catch((err) => {
    // No code path may ever dump a raw stack trace on the user — the CLI's
    // output is read (and re-displayed) by agents, so an unexpected error
    // surfaces as a single clean message line, same as UserError.
    const msg = err && err.message ? err.message : String(err);
    process.stderr.write('Error: ' + msg + '\n');
    process.exit(1);
  });
}
