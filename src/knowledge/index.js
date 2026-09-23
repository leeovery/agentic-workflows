// Knowledge CLI entry point.
//
// Dispatches commands to their handlers, resolving config and provider
// once at startup.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const chunker = require('./chunker');
const { StubProvider } = require('./embeddings');
const { OpenAIProvider } = require('./providers/openai');
const { AuthError, InvalidRequestError, ConfigError } = require('./providers/openai-engine');
const config = require('./config');
const setup = require('./setup');
const setupForms = require('./setup-forms');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEXED_PHASES = ['research', 'discussion', 'investigation', 'specification', 'imports', 'seeds', 'analysis', 'discovery', 'baseline', 'roadmap'];

// Baseline docs are project-level (`.workflows/.baseline/{topic}.md`) — they
// belong to no work unit, so their chunks carry this reserved pseudo-identity
// for both work_unit and work_type. The engine reserves the name at
// work-unit creation, so a real work unit can never collide with it.
const BASELINE_IDENTITY = 'baseline';

// The product roadmap's session logs and imports are project-level too
// (`.workflows/.roadmap/sessions/…`, `.workflows/.roadmap/imports/…`) — same
// reserved-pseudo-identity carve-out: chunks carry `roadmap` for both
// work_unit and work_type, and the engine reserves the name.
const ROADMAP_IDENTITY = 'roadmap';

const RESERVED_IDENTITIES = new Set([BASELINE_IDENTITY, ROADMAP_IDENTITY]);

// Phases whose artifact is a flat `{phase}/{basename}.md` file — one identical
// derivation (topic = basename, no subdirectories). specification (nested under
// a per-topic dir) and discovery (nested under sessions/) derive differently.
const FLAT_PHASES = new Set(['research', 'discussion', 'investigation', 'imports', 'seeds']);

// Whitelist of indexable filenames in .workflows/{wu}/.state/, mapping each
// on-disk basename to its KB topic identity. The .state/ directory also holds
// operational metadata (migrations, environment-setup) that must never enter
// the KB. Restrict to the gap-analysis cache file.
const ANALYSIS_CACHE_FILES = {
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
// ---------------------------------------------------------------------------

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

// Failures that repeat identically on every attempt: input validation, a
// provider refusing the key or the request, a provider configuration the
// model contradicts, and programming errors.
const PERMANENT_ERRORS = [
  UserError,
  AuthError,
  InvalidRequestError,
  ConfigError,
  TypeError,
  ReferenceError,
  SyntaxError,
  RangeError,
];

/**
 * Whether a failure is permanent — no retry can change its outcome.
 * @param {unknown} err
 */
function isPermanentError(err) {
  return PERMANENT_ERRORS.some((type) => err instanceof type);
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
  index     Index a file, or with no file bring the store in line with every artifact
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
// process.cwd(). Every artifact path that flows through the store — chunk
// source files, manifest-discovered imports/seeds/analysis/discovery files,
// and the source path handed to a single-file index — is recorded relative to
// the project root. Resolving them against cwd breaks every KB command
// invoked from a subdirectory: bulk discovery skips live artifacts and the
// sync reads every chunk's source as deleted. path.resolve short-circuits on
// an already-absolute input, so absolute paths pass through unchanged.
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
      if (isPermanentError(err)) throw err;
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

// Non-markdown imports are reference material tracked on the manifest — the
// store embeds markdown alone, so they are never index candidates.
function isIndexableImportPath(name) {
  return name.endsWith('.md');
}

// A flat import file carrying any other extension. Refused by name, with the
// policy as the reason; a subdirectory or a dotfile is still a bad shape.
function isNonMarkdownImport(name) {
  return !isIndexableImportPath(name) && /^[^./][^/]*\.[^/.]+$/.test(name);
}

function nonMarkdownImportError(filePath) {
  return new UserError(
    `Refusing to index ${filePath} — imports are tracked on the manifest; ` +
      'only markdown imports are indexed.'
  );
}

function deriveIdentity(filePath) {
  // Normalise to forward slashes for pattern matching.
  const norm = filePath.replace(/\\/g, '/');

  // Baseline docs live at .workflows/.baseline/{topic}.md — project-level,
  // under no work unit. Matched first: the dotted directory would otherwise
  // fall into the .state capture below and surface a misleading "invalid
  // work unit" error. Only flat {topic}.md files are docs; anything nested
  // (the interview ledger and research dossiers under .baseline/.state/) is
  // session state and refused loudly.
  const baselineMatch = /\.workflows\/\.baseline\/(.+)$/.exec(norm);
  if (baselineMatch) {
    const rest = baselineMatch[1];
    const fileMatch = /^([^/]+)\.md$/.exec(rest);
    if (!fileMatch) {
      throw new UserError(
        `Unexpected baseline path structure: ${rest}\n` +
          'Expected: .workflows/.baseline/{topic}.md'
      );
    }
    const topic = fileMatch[1];
    if (topic === '.' || topic === '..' || topic.startsWith('.')) {
      throw new UserError(`Invalid topic name: "${topic}"`);
    }
    rejectDottedSegment('topic', topic);
    return { workUnit: BASELINE_IDENTITY, phase: 'baseline', topic };
  }

  // Roadmap material lives under .workflows/.roadmap/ — project-level, under
  // no work unit. Session logs (topic = session basename, so sessions coexist
  // rather than overwrite) and imports (topic = filename, mirroring the
  // work-unit imports shape). Anything else under the dir is refused loudly.
  const roadmapMatch = /\.workflows\/\.roadmap\/(.+)$/.exec(norm);
  if (roadmapMatch) {
    const rest = roadmapMatch[1];
    const sessMatch = /^sessions\/(session-\d+)\.md$/.exec(rest);
    if (sessMatch) {
      return { workUnit: ROADMAP_IDENTITY, phase: 'roadmap', topic: sessMatch[1] };
    }
    const importMatch = /^imports\/([^/]+)\.md$/.exec(rest);
    if (importMatch) {
      const topic = importMatch[1];
      if (topic === '.' || topic === '..' || topic.startsWith('.')) {
        throw new UserError(`Invalid topic name: "${topic}"`);
      }
      rejectDottedSegment('topic', topic);
      return { workUnit: ROADMAP_IDENTITY, phase: 'imports', topic };
    }
    const otherImport = /^imports\/(.+)$/.exec(rest);
    if (otherImport && isNonMarkdownImport(otherImport[1])) {
      throw nonMarkdownImportError(filePath);
    }
    throw new UserError(
      `Unexpected roadmap path structure: ${rest}\n` +
        'Expected: .workflows/.roadmap/sessions/session-NNN.md or .workflows/.roadmap/imports/{name}.md'
    );
  }

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
  } else if (FLAT_PHASES.has(phase)) {
    // .workflows/{wu}/{phase}/{basename}.md — flat file, no subdirectories.
    // The topic is the basename without .md (research/imports/seeds identity is
    // the filename; discussion/investigation the topic — same shape either way).
    const flatMatch = /^([^/]+)\.md$/.exec(rest);
    if (!flatMatch) {
      if (phase === 'imports' && isNonMarkdownImport(rest)) {
        throw nonMarkdownImportError(filePath);
      }
      throw new UserError(
        `Unexpected ${phase} path structure: ${rest}\n` +
          `Expected: .workflows/{work_unit}/${phase}/{topic}.md`
      );
    }
    topic = flatMatch[1];
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

// Shared first line of every provider/model-mismatch error. It appeared four
// times across the two resolvers (two variants × index/query); a single
// constant keeps the user-facing wording in exactly one place.
const REBUILD_MISMATCH_MSG =
  'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n';

/**
 * Shared provider-state resolution for both index-time and query-time. The two
 * callers agree on every outcome — full match, hard mismatch, and the
 * missing-key vs dropped-provider diagnosis — EXCEPT one: a keyword-only store
 * while a provider is now configured. `upgradeMode` names that one divergence:
 *   • 'keyword-only' (index): index WITHOUT vectors, and warn once so the user
 *     knows to `rebuild` to upgrade.
 *   • 'upgrade-available' (query): surface the upgrade hint; the store has no
 *     vectors to search, so results stay keyword-only either way. No warn here
 *     — query composes its own note from the returned mode.
 * @returns {{mode: string, provider: object|null}}  throws UserError on mismatch.
 */
function resolveProviderMode(metadata, cfg, provider, upgradeMode) {
  const metaProvider = metadata.provider;
  const metaModel = metadata.model;
  const metaDimensions = metadata.dimensions;

  // Keyword-only store (metadata.provider null/undefined). Always allowed —
  // index/search WITHOUT vectors regardless of current config. The one divergent
  // case: a provider is now configured.
  if (metaProvider === null || metaProvider === undefined) {
    if (provider) {
      // The index path (upgradeMode 'keyword-only') warns once; the query path
      // ('upgrade-available') stays silent and lets cmdQuery emit its own note.
      if (upgradeMode === 'keyword-only' && !stubUpgradeWarned) {
        stubUpgradeWarned = true;
        process.stderr.write(
          'Note: store is keyword-only but an embedding provider is now configured. ' +
          'Run `knowledge rebuild` to switch to full hybrid search.\n'
        );
      }
      return { mode: upgradeMode, provider: null };
    }
    return { mode: 'keyword-only', provider: null };
  }

  // Store HAS a provider but the current config resolved none. Two very
  // different causes — a keyed provider whose key is missing (fix with the key,
  // never a rebuild) vs. a config that genuinely dropped its provider.
  if (!provider) {
    if (providerKeyUnresolved(cfg)) {
      throw keyUnresolvedError(cfg);
    }
    throw new UserError(
      REBUILD_MISMATCH_MSG +
        `  Store was indexed with: provider=${metaProvider}, model=${metaModel}\n` +
        '  Current config has no provider configured.'
    );
  }

  // Both sides have a provider — full match or hard mismatch.
  const curModel = provider.model();
  const curDimensions = provider.dimensions();
  if (metaProvider === cfg.provider && metaModel === curModel && metaDimensions === curDimensions) {
    return { mode: 'full', provider };
  }
  throw new UserError(
    REBUILD_MISMATCH_MSG +
      `  Store: provider=${metaProvider}, model=${metaModel}, dimensions=${metaDimensions}\n` +
      `  Config: provider=${cfg.provider}, model=${curModel}, dimensions=${curDimensions}`
  );
}

/**
 * Index-time provider-state check. Returns { mode: 'full'|'keyword-only',
 * provider: object|null }; throws UserError on a provider/model mismatch.
 */
function resolveProviderState(metadata, cfg, provider) {
  return resolveProviderMode(metadata, cfg, provider, 'keyword-only');
}

// ---------------------------------------------------------------------------
// Index command
// ---------------------------------------------------------------------------

async function cmdIndex(args, options, cfg, provider) {
  if (args.length === 0) {
    const summary = await cmdIndexBulk(options, cfg, provider);
    if (summary.failed > 0) process.exitCode = 1;
    return;
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

  let chunkCount;
  try {
    chunkCount = await withRetry(
      () => indexSingleFile(sourceFile, identity, cfg, provider),
      { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
    );
  } catch (err) {
    process.stderr.write(
      `Failed to index ${sourceFile}: ${err.message}\nThe next start will retry it.\n`
    );
    process.exit(1);
  }

  process.stdout.write(`Indexed ${chunkCount} chunks from ${sourceFile}\n`);
}

/**
 * The sha256 of an artifact's content — what a chunk records as its
 * `source_hash`, and what the sync compares against the file on disk.
 * @param {string} content
 */
function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Index a single file into the store. Returns the number of chunks indexed.
 * Separated from cmdIndex so it can be called by both single-file and bulk modes.
 */
async function indexSingleFile(sourceFile, identity, cfg, provider) {
  // Read work_type from manifest. Baseline is project-level — no work-unit
  // manifest exists to read, so its chunks carry the pseudo work_type.
  const workType = identity.phase === 'baseline' ? BASELINE_IDENTITY
    : identity.workUnit === ROADMAP_IDENTITY ? ROADMAP_IDENTITY
      : readWorkType(identity.workUnit);

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
  // path recorded relative to the project (bulk discovery) reads correctly
  // regardless of the invoking cwd.
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

  // Resolve store state. The store is NOT loaded here: the pre-lock load's
  // contents were only ever consulted to decide whether a fresh store had to
  // be created — a question fs.existsSync answers — and the authoritative load
  // happens inside the lock below. Dropping it removes one full store load per
  // file without touching the lock window (the in-lock reload is unchanged).
  let db;
  let metadata;
  const storeExists = fs.existsSync(sp);
  const metadataExists = fs.existsSync(mp);

  if (metadataExists) {
    metadata = store.readMetadata(mp);
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

  // Materialise a fresh empty store only when none exists on disk. When one
  // does exist it is loaded inside the lock (never pre-lock) so the write sees
  // the freshest committed state. The !storeExists lock branch falls back to
  // this empty store when no concurrent writer created one first.
  if (!storeExists) {
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
  const sourceHash = contentHash(content);
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
      source_hash: sourceHash,
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

    // Provider, model, and dimensions never change once set, so an existing
    // record keeps them and takes the new timestamp alone.
    const freshMeta = fs.existsSync(mp) ? store.readMetadata(mp) : null;
    if (!freshMeta) {
      store.writeMetadata(mp, {
        provider: effectiveProvider ? cfg.provider : null,
        model: effectiveProvider ? effectiveProvider.model() : null,
        dimensions: effectiveProvider ? effectiveProvider.dimensions() : null,
        last_indexed: new Date().toISOString(),
      });
    } else {
      freshMeta.last_indexed = new Date().toISOString();
      store.writeMetadata(mp, freshMeta);
    }
  });

  return docs.length;
}

// ---------------------------------------------------------------------------
// Bulk index — bring the store in line with the files
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
 * What a failed manifest read says — the engine's stderr when it spoke.
 * @param {any} err
 */
function manifestErrorDetail(err) {
  return err && err.stderr ? String(err.stderr).trim() : err.message;
}

/**
 * Surface real manifest-read failures (corrupt JSON, broken paths, etc.).
 * Expected misses are no longer thrown — `get` returns empty stdout + exit 0
 * for missing work units / fields, so callers detect them by checking output.
 */
function reportUnexpectedManifestError(context, err) {
  process.stderr.write(`Warning: manifest read failed in ${context}: ${manifestErrorDetail(err)}\n`);
}

/**
 * Read every work unit's full manifest via a single `manifest list` spawn.
 * Throws when the read fails; a non-array payload reads as no work units.
 */
function readWorkUnits() {
  const parsed = JSON.parse(runManifest(['list']));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * readWorkUnits for callers that degrade on a failed read: [] and a warning.
 * Callers that need both the discovered artifacts AND the manifest tree
 * (cmdStatus) fetch once and share, rather than listing twice.
 * @param {string} context  label for the failure warning
 */
function listWorkUnits(context) {
  try {
    return readWorkUnits();
  } catch (err) {
    reportUnexpectedManifestError(context, err);
    return [];
  }
}

/**
 * The names the project manifest registers as work units, or null when it
 * registers none — the engine then lists work units by scanning the
 * directory, so an empty registry says nothing about which units exist.
 * Throws when the read fails.
 */
function readRegistry() {
  const raw = runManifest(['get', 'project.work_units']).trim();
  const names = raw === '' ? [] : Object.keys(JSON.parse(raw) || {});
  return names.length > 0 ? new Set(names) : null;
}

// Per-topic artifact path shapes, keyed by phase. The shapes are static, so a
// completed topic's file is derivable directly from (work_unit, topic) with no
// engine round-trip. This MIRRORS the INDEXED_ARTIFACTS table in the engine's
// domain/kb.cjs (the counterpart used by reindexWorkUnit) — the two must stay
// in sync; a phase added there needs a row here and a `resolve` branch there.
// Only these four phases are per-topic manifest items; imports/seeds/analysis/
// discovery are file-based and discovered by their own traversals below.
const ARTIFACT_PATHS = {
  research: (wu, topic) => `.workflows/${wu}/research/${topic}.md`,
  discussion: (wu, topic) => `.workflows/${wu}/discussion/${topic}.md`,
  investigation: (wu, topic) => `.workflows/${wu}/investigation/${topic}.md`,
  specification: (wu, topic) => `.workflows/${wu}/specification/${topic}/specification.md`,
};

/**
 * Collect a work unit's flat-file entries for a top-level array field (imports
 * or seeds). Both fields share the same on-disk shape ("{field}/{basename}",
 * no subdirectories or escapes) and the same dedupe-by-topic-identity rule, so
 * one helper walks either. Only the markdown entries are index candidates.
 * Returns an array of { file, workUnit, phase, topic }.
 *
 * Path validation mirrors deriveIdentity: the landers only ever write
 * "{field}/<basename>" to the manifest, so a different shape means manual
 * tampering or an unrecognised flow — refuse it either way so a manifest-
 * injection vector can't poison the store.
 * @param {object} wu  the work-unit manifest @param {string} wuName @param {string} field
 */
function collectFlatEntries(wu, wuName, field) {
  const out = [];
  const entries = wu[field];
  if (!Array.isArray(entries)) return out;
  const shape = new RegExp(`^${field}/([^/]+)$`);
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string') continue;
    const rel = entry.path;
    // Must be exactly {field}/{filename} — no subdirectories, no escapes — and
    // markdown: any other import is manifest-tracked reference material.
    const m = shape.exec(rel);
    if (!m || !isIndexableImportPath(m[1])) continue;
    const filename = m[1];
    if (filename.includes('..') || filename.startsWith('.')) continue;
    const base = filename.slice(0, -3); // strip .md
    if (!base || base === '.' || base === '..' || base.startsWith('.')) continue;
    // Dedupe by topic identity — re-imports may push duplicate manifest entries
    // (acceptable noise per the design), but bulk index processes each once.
    if (seen.has(base)) continue;
    seen.add(base);
    const filePath = path.posix.join('.workflows', wuName, rel);
    if (!fs.existsSync(resolveArtifactPath(filePath))) continue;
    out.push({ file: filePath, workUnit: wuName, phase: field, topic: base });
  }
  return out;
}

/**
 * Discover all completed artifacts across all work units from a single
 * `manifest list` read. Per-topic phase paths are derived locally from
 * ARTIFACT_PATHS (no per-topic engine spawn); imports, seeds, analysis caches,
 * and discovery sessions are file-based traversals.
 * Returns an array of { file, workUnit, phase, topic }.
 * @param {Array} [workUnits]  pre-fetched manifest list (via listWorkUnits) —
 *   passed by cmdStatus so the manifest tree is read once, not once here plus
 *   once for its consistency checks. Omitted → this fetches its own.
 */
function discoverArtifacts(workUnits) {
  const items = [];

  // Baseline docs — project-level and registry-independent. They exist before
  // the first work unit (the brownfield install moment), so they are
  // discovered ahead of the manifest walk and never gated on it. Flat
  // {topic}.md only, no dots in the topic (mirrors deriveIdentity); the
  // .baseline/.state/ session files never match.
  const baselineDir = path.posix.join('.workflows', '.baseline');
  let baselineFiles = [];
  try {
    baselineFiles = fs.readdirSync(resolveArtifactPath(baselineDir)).filter((f) => /^[^./]+\.md$/.test(f));
  } catch (_) {
    baselineFiles = [];
  }
  for (const f of baselineFiles) {
    items.push({
      file: path.posix.join(baselineDir, f),
      workUnit: BASELINE_IDENTITY,
      phase: 'baseline',
      topic: f.slice(0, -3),
    });
  }

  // Roadmap sessions and imports — project-level like baseline, discovered
  // ahead of the manifest walk (the genesis conversation predates the first
  // work unit). Shapes mirror deriveIdentity exactly.
  const roadmapSessDir = path.posix.join('.workflows', '.roadmap', 'sessions');
  let roadmapSessions = [];
  try {
    roadmapSessions = fs.readdirSync(resolveArtifactPath(roadmapSessDir)).filter((f) => /^session-\d+\.md$/.test(f));
  } catch (_) {
    roadmapSessions = [];
  }
  for (const f of roadmapSessions) {
    items.push({
      file: path.posix.join(roadmapSessDir, f),
      workUnit: ROADMAP_IDENTITY,
      phase: 'roadmap',
      topic: f.slice(0, -3),
    });
  }
  const roadmapImportsDir = path.posix.join('.workflows', '.roadmap', 'imports');
  let roadmapImports = [];
  try {
    // Markdown alone is an index candidate; any other import is manifest-
    // tracked reference material. The stem carries no dot (deriveIdentity).
    roadmapImports = fs
      .readdirSync(resolveArtifactPath(roadmapImportsDir))
      .filter((f) => isIndexableImportPath(f) && /^[^./]+$/.test(f.slice(0, -3)));
  } catch (_) {
    roadmapImports = [];
  }
  for (const f of roadmapImports) {
    items.push({
      file: path.posix.join(roadmapImportsDir, f),
      workUnit: ROADMAP_IDENTITY,
      phase: 'imports',
      topic: f.slice(0, -3),
    });
  }

  const units = workUnits || listWorkUnits('discoverArtifacts:list');
  if (!Array.isArray(units) || units.length === 0) return items;

  for (const wu of units) {
    const wuName = wu.name;
    if (!wuName) continue;
    if (wu.status === 'cancelled') continue;

    // Per-topic phase artifacts. The completed-topic set already arrived in the
    // `list` payload and the paths are static (ARTIFACT_PATHS), so each file is
    // derived locally — no `engine manifest resolve` spawn per topic.
    for (const [phase, buildPath] of Object.entries(ARTIFACT_PATHS)) {
      const phaseData = wu.phases && wu.phases[phase];
      if (!phaseData || !phaseData.items) continue;

      for (const [topicName, topicData] of Object.entries(phaseData.items)) {
        if (!topicData || topicData.status !== 'completed') continue;
        const filePath = buildPath(wuName, topicName);
        if (fs.existsSync(resolveArtifactPath(filePath))) {
          items.push({ file: filePath, workUnit: wuName, phase, topic: topicName });
        }
      }
    }

    // Imports (reference material) and seeds (the work's origin: promoted inbox
    // items) — top-level arrays, no per-item status, same flat-file shape and
    // dedupe rule. Kept as distinct phases so a seed stays deterministically
    // distinguishable from reference material.
    for (const it of collectFlatEntries(wu, wuName, 'imports')) items.push(it);
    for (const it of collectFlatEntries(wu, wuName, 'seeds')) items.push(it);

    // Analysis cache — file-based, not manifest-tracked. One known path per
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

// Statuses under which the engine removes a per-topic item's chunks — its
// `knowledge remove` call sites: supersede, topic cancel, topic postpone,
// and specification promote.
const RETIRED_ITEM_STATUSES = new Set(['superseded', 'cancelled', 'postponed', 'promoted']);

/**
 * @param {string} workUnit @param {string} phase @param {string} topic
 */
function identityKey(workUnit, phase, topic) {
  return `${workUnit}/${phase}/${topic}`;
}

/**
 * Chunks grouped by identity: the source file they were indexed from, the
 * source hashes they carry (undefined for a chunk indexed before hashes were
 * recorded), and how many there are.
 * @param {Array<{work_unit: string, phase: string, topic: string, source_file: string, source_hash?: string}>} chunks
 * @returns {Map<string, {workUnit: string, phase: string, topic: string, file: string, hashes: Set<string|undefined>, chunks: number}>}
 */
function identitiesOf(chunks) {
  const byKey = new Map();
  for (const c of chunks) {
    const key = identityKey(c.work_unit, c.phase, c.topic);
    if (!byKey.has(key)) {
      byKey.set(key, { workUnit: c.work_unit, phase: c.phase, topic: c.topic, file: c.source_file, hashes: new Set(), chunks: 0 });
    }
    const entry = byKey.get(key);
    entry.hashes.add(c.source_hash);
    entry.chunks += 1;
  }
  return byKey;
}

/**
 * Sort discovered artifacts against the store: `fresh` has no chunks,
 * `changed` has chunks indexed from other content (or from content whose hash
 * was never recorded), `unchanged` matches the file on disk.
 * @param {Array<{file: string, workUnit: string, phase: string, topic: string}>} artifacts
 * @param {Map<string, {hashes: Set<string|undefined>}>} indexed
 */
function classifyArtifacts(artifacts, indexed) {
  const out = { fresh: [], changed: [], unchanged: [] };
  for (const artifact of artifacts) {
    const entry = indexed.get(identityKey(artifact.workUnit, artifact.phase, artifact.topic));
    if (!entry) {
      out.fresh.push(artifact);
      continue;
    }
    const hash = contentHash(fs.readFileSync(resolveArtifactPath(artifact.file), 'utf8'));
    const current = entry.hashes.size === 1 && entry.hashes.has(hash);
    out[current ? 'unchanged' : 'changed'].push(artifact);
  }
  return out;
}

/**
 * Split artifacts into those compact leaves in the store and those it prunes
 * — the sync never re-embeds a pruned one.
 * @template {{workUnit: string, phase: string}} T
 * @param {T[]} artifacts
 * @param {ReturnType<typeof pruneTest>} pruning
 * @returns {{kept: T[], pruned: T[]}}
 */
function splitPruned(artifacts, pruning) {
  const out = { kept: [], pruned: [] };
  for (const a of artifacts) {
    out[pruning && pruning.prunes(a.workUnit, a.phase) ? 'pruned' : 'kept'].push(a);
  }
  return out;
}

/**
 * Whether a recorded source path lands outside this project — a chunk indexed
 * by absolute path from another checkout.
 * @param {string} file
 */
function outsideProject(file) {
  const rel = path.relative(config.findProjectRoot(), resolveArtifactPath(file));
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

/**
 * Why an indexed identity no longer belongs in the store, or null while it
 * may. Only positive knowledge removes: the source file gone from disk, the
 * work unit unregistered or cancelled, the per-topic item gone or retired. A
 * source outside the project and a work unit whose manifest could not be read
 * are evidence of nothing, and the project-level identities answer to their
 * files alone.
 * @param {{workUnit: string, phase: string, topic: string, file: string}} entry
 * @param {Map<string, any>} units  work-unit manifests by name
 * @param {Set<string>|null} registry
 */
function retiredReason(entry, units, registry) {
  if (outsideProject(entry.file)) return null;
  if (!fs.existsSync(resolveArtifactPath(entry.file))) return 'source deleted';
  if (RESERVED_IDENTITIES.has(entry.workUnit)) return null;
  if (registry && !registry.has(entry.workUnit)) return 'work unit not registered';
  const unit = units.get(entry.workUnit);
  if (!unit) return null;
  if (unit.status === 'cancelled') return 'work unit cancelled';
  if (!ARTIFACT_PATHS[entry.phase]) return null;
  const items = (unit.phases && unit.phases[entry.phase] && unit.phases[entry.phase].items) || {};
  const item = items[entry.topic];
  if (!item) return `no ${entry.phase} item`;
  return RETIRED_ITEM_STATUSES.has(item.status) ? `${entry.phase} ${item.status}` : null;
}

/**
 * Remove every listed identity's chunks in one locked store write.
 * @param {Array<{workUnit: string, phase: string, topic: string}>} identities
 */
async function removeIdentities(identities) {
  const sp = storePath();
  await store.withLock(lockFilePath(), async () => {
    const db = await store.loadStore(sp);
    for (const { workUnit, phase, topic } of identities) {
      await store.removeByIdentity(db, { work_unit: workUnit, phase, topic });
    }
    await store.saveStore(db, sp);
  });
}

/**
 * The manifest list and the registry the sync decides from. A failed read
 * aborts the sync — it is not evidence that anything is gone.
 */
function readSyncManifests() {
  try {
    return { workUnits: readWorkUnits(), registry: readRegistry() };
  } catch (err) {
    throw new Error(`manifest read failed: ${manifestErrorDetail(err)}`);
  }
}

/**
 * What the sync does to the store: the discovered artifacts sorted into
 * fresh, changed, and unchanged — bar those compact prunes — and the indexed
 * identities to retire, each with its reason. A scope confines both to one
 * work unit.
 * @param {{scope: string|null, workUnits: Array<any>, registry: Set<string>|null, cfg: object}} inputs
 */
async function planSync({ scope, workUnits, registry, cfg }) {
  const inScope = (workUnit) => !scope || workUnit === scope;
  const sp = storePath();
  const chunks = fs.existsSync(sp) ? await store.searchAllFulltext(await store.loadStore(sp)) : [];
  const indexed = new Map([...identitiesOf(chunks)].filter(([, entry]) => inScope(entry.workUnit)));
  const artifacts = discoverArtifacts(workUnits).filter((a) => inScope(a.workUnit));

  const discovered = new Set(artifacts.map((a) => identityKey(a.workUnit, a.phase, a.topic)));
  const units = new Map(workUnits.filter((u) => u && u.name).map((u) => [u.name, u]));
  const retired = [...indexed]
    .filter(([key]) => !discovered.has(key))
    .map(([, entry]) => ({ ...entry, reason: retiredReason(entry, units, registry) }))
    .filter((entry) => entry.reason);

  const { kept } = splitPruned(artifacts, pruneTest(cfg, workUnits));
  return { ...classifyArtifacts(kept, indexed), retired };
}

/**
 * Index one artifact, reporting the outcome on stdout or stderr. Resolves
 * false when it failed.
 * @param {{file: string, workUnit: string, phase: string, topic: string}} artifact
 * @param {'new'|'changed'} state
 */
async function indexArtifact(artifact, state, cfg, provider) {
  const identity = { workUnit: artifact.workUnit, phase: artifact.phase, topic: artifact.topic };
  try {
    const count = await withRetry(
      () => indexSingleFile(artifact.file, identity, cfg, provider),
      { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF }
    );
    process.stdout.write(`Indexed ${artifact.file} — ${count} chunks (${state})\n`);
    return true;
  } catch (err) {
    process.stderr.write(`Failed to index ${artifact.file}: ${err.message}\n`);
    return false;
  }
}

/**
 * Bring the store in line with the files (see planSync). Every file is
 * attempted; a failure is counted in the returned summary.
 * @returns {Promise<{new: number, changed: number, removed: number, unchanged: number, failed: number}>}
 */
async function cmdIndexBulk(options, cfg, provider) {
  const { workUnits, registry } = readSyncManifests();

  // A provider/model change since the store was built must surface here:
  // otherwise every unchanged file would skip and the run would report the
  // store in line while its vectors are the old width.
  const mp = metadataPath();
  if (fs.existsSync(mp)) {
    resolveProviderState(store.readMetadata(mp), cfg, provider);
  }

  const plan = await planSync({ scope: options && options.workUnit, workUnits, registry, cfg });
  const summary = { new: 0, changed: 0, removed: plan.retired.length, unchanged: plan.unchanged.length, failed: 0 };

  if (plan.retired.length > 0) {
    await removeIdentities(plan.retired);
    for (const entry of plan.retired) {
      process.stdout.write(`Removed ${entry.file} — ${entry.chunks} chunks (${entry.reason})\n`);
    }
  }

  for (const [state, artifacts] of [['new', plan.fresh], ['changed', plan.changed]]) {
    for (const artifact of artifacts) {
      if (await indexArtifact(artifact, state, cfg, provider)) summary[state] += 1;
      else summary.failed += 1;
    }
  }

  const failed = summary.failed > 0 ? `, ${summary.failed} failed` : '';
  process.stdout.write(
    `${summary.new} new, ${summary.changed} changed, ${summary.removed} removed, ${summary.unchanged} unchanged${failed}.\n`
  );
  return summary;
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
  return progressClockOf(listWorkUnits('getProgressClock:list'), weights);
}

/**
 * The progress clock over an already-read manifest list.
 * @param {Array<object>} workUnits @param {Object<string, number>} [weights]
 */
function progressClockOf(workUnits, weights) {
  const completed = workUnits
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

/** @param {object} cfg */
function resolveStability(cfg) {
  return cfg && Number.isFinite(cfg.decay_base_stability)
    ? cfg.decay_base_stability
    : config.DEFAULTS.decay_base_stability;
}

/**
 * Compact's prune test: a unit's non-spec chunks are pruned once its
 * retrievability has decayed below `decay_prune_below`. A unit the progress
 * clock has not moved past — in progress, undateable, the frontier — never
 * is, and specifications never decay. Null when `decay_prune_below` is false.
 * @param {object} cfg
 * @param {Array<object>} workUnits  the manifest list the clock is built from
 * @returns {{floor: number, prunes: (workUnit: string, phase: string) => boolean} | null}
 */
function pruneTest(cfg, workUnits) {
  const floor = cfg && cfg.decay_prune_below !== undefined ? cfg.decay_prune_below : config.DEFAULTS.decay_prune_below;
  if (floor === false) return null;
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor < 0 || floor > 1) {
    throw new UserError(`Invalid decay_prune_below: ${JSON.stringify(floor)}. Expected false or a number in [0, 1].`);
  }
  const stability = resolveStability(cfg);
  const clock = progressClockOf(workUnits, resolveDecayWeights(cfg));
  return {
    floor,
    prunes: (workUnit, phase) => {
      if (phase === 'specification') return false;
      const elapsed = clock.get(workUnit) || 0;
      return elapsed > 0 && retrievability(elapsed, stability) < floor;
    },
  };
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
 * Query-time provider-state check. Symmetric with resolveProviderState but, for
 * a keyword-only store while a provider is configured, returns
 * 'upgrade-available' (so cmdQuery emits the rebuild hint) rather than warning
 * and indexing keyword-only. Every other outcome is shared.
 */
function resolveQueryMode(metadata, cfg, provider) {
  return resolveProviderMode(metadata, cfg, provider, 'upgrade-available');
}

/**
 * Turn a CLI filter value into an Orama where-clause term: a single value →
 * { eq }, a comma-separated list → { in }. Every --flag that names a filterable
 * dimension (phase, work-type, work-unit, topic) runs through this.
 * @param {string} value
 */
function csv(value) {
  const parts = value.split(',').map((s) => s.trim());
  return parts.length === 1 ? { eq: parts[0] } : { in: parts };
}

// ?? (not ||) so an explicit `similarity_threshold: 0` — a legitimate
// "accept all vector matches, no filtering" setting — isn't silently
// rewritten to the default. Anything but a number in [0, 1] is refused here:
// the store drops a wrong-typed value and Orama's own default takes over.
function resolveSimilarityThreshold(cfg) {
  const similarity = cfg.similarity_threshold ?? config.DEFAULTS.similarity_threshold;
  if (typeof similarity !== 'number' || !Number.isFinite(similarity) || similarity < 0 || similarity > 1) {
    throw new UserError(
      `Invalid similarity_threshold: ${JSON.stringify(similarity)}. Expected a number in [0, 1].`
    );
  }
  return similarity;
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
  if (options.phase) where.phase = csv(options.phase);
  if (options.workType) where.work_type = csv(options.workType);
  if (options.workUnit) where.work_unit = csv(options.workUnit);
  if (options.topic) where.topic = csv(options.topic);

  const similarity = resolveSimilarityThreshold(cfg);
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
  const stability = resolveStability(cfg);
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

  // Index summary.
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

  // Last indexed + store health.
  out.push('');
  const stat = fs.statSync(sp);
  const sizeKb = (stat.size / 1024).toFixed(1);
  out.push(`Store size: ${sizeKb} KB`);

  let cfg;
  try { cfg = config.loadConfig(); } catch (_) { cfg = null; }

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

    // Provider mismatch warning.
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

      // Stub-to-full upgrade note.
      if ((metadata.provider === null || metadata.provider === undefined) && cfgProvider) {
        out.push('');
        out.push('NOTE: Keyword-only mode but embedding provider configured. Run `knowledge rebuild` for full hybrid search.');
      }
    }
  } else {
    out.push('Metadata: missing (run `knowledge rebuild` to fix)');
  }

  // Orphan detection — source files that no longer exist.
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

  // The manifest tree is read ONCE and shared by both the artifact
  // classification and the manifest-knowledge consistency checks.
  const workUnits = listWorkUnits('cmdStatus:list');

  let pruning = null;
  try {
    pruning = pruneTest(cfg, workUnits);
  } catch (err) {
    out.push('');
    out.push(`WARNING: ${err.message}`);
  }

  // Artifacts the store is behind on — never indexed, or changed since — and
  // those compact prunes below the decay floor, which are neither.
  try {
    const { kept, pruned } = splitPruned(discoverArtifacts(workUnits), pruning);
    const { fresh, changed } = classifyArtifacts(kept, identitiesOf(allChunks));
    for (const [label, artifacts] of [
      ['Unindexed completed artifacts', fresh],
      ['Changed since indexing', changed],
      ['Pruned below the decay floor', pruned],
    ]) {
      if (artifacts.length === 0) continue;
      out.push('');
      out.push(`${label}: ${artifacts.length}`);
      for (const a of artifacts) {
        out.push(`  ${a.file}`);
      }
    }
  } catch (err) {
    // Discovery may fail if no manifest — surface so user can tell.
    process.stderr.write(`Warning: artifact discovery failed: ${err.message}\n`);
  }

  // Manifest-knowledge consistency, over the shared manifest tree.
  const consistency = [];
  const manifestByName = new Map();
  for (const m of workUnits) if (m && m.name) manifestByName.set(m.name, m);

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
    store.writeMetadata(mp, {
      provider: provider ? cfg.provider : null,
      model: provider ? provider.model() : null,
      dimensions: provider ? provider.dimensions() : null,
      last_indexed: new Date().toISOString(),
    });
  });
  process.stdout.write('Deleted existing index.\n');

  let summary;
  try {
    // Run bulk index (acquires the lock per-file internally).
    summary = await cmdIndexBulk(options, cfg, provider);
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

  // The rebuilt index stands — a file that failed to index is one the next
  // start's sync retries — so the backup goes.
  if (fs.existsSync(spBak)) fs.unlinkSync(spBak);
  if (fs.existsSync(mpBak)) fs.unlinkSync(mpBak);
  if (summary.failed > 0) process.exitCode = 1;
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
  // so a miss here means the caller has the wrong name — unless the store
  // still holds chunks for the name (after absorption or a manual registry
  // edit), which makes it an orphan-chunk cleanup instead.
  // Baseline and roadmap are file-based, project-level, and never in the
  // work-unit registry — the registry probe below would misreport a
  // legitimate remove as an orphan cleanup. Skip straight to removal.
  let isOrphanCleanup = false;
  const projectEntry = RESERVED_IDENTITIES.has(options.workUnit)
    ? options.workUnit
    : runManifest(['get', `project.work_units.${options.workUnit}`]).trim();
  if (projectEntry === '') {
    const sp = storePath();
    let storeMatch = 0;
    if (fs.existsSync(sp)) {
      const db = await store.loadStore(sp);
      storeMatch = await store.countByFilter(db, removeFilter(options));
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
  // nothing on disk.
  if (options.dryRun) {
    if (!fs.existsSync(sp)) {
      process.stdout.write(`Would remove 0 chunks for ${desc} (store not initialised)\n`);
      return;
    }
    const db = await store.loadStore(sp);
    const count = await store.countByFilter(db, removeFilter(options));
    process.stdout.write(`Would remove ${count} chunks for ${desc}\n`);
    return;
  }

  let removed;
  try {
    removed = await performRemoval(options);
  } catch (err) {
    process.stderr.write(`Removal of ${desc} failed: ${err.message}\n`);
    process.exit(1);
  }
  process.stdout.write(`Removed ${removed} chunks for ${desc}\n`);
}

function formatRemoveDesc(options) {
  if (options.topic) return `${options.workUnit}/${options.phase}/${options.topic}`;
  if (options.phase) return `${options.workUnit}/${options.phase}`;
  return `${options.workUnit} (all phases)`;
}

/**
 * The where-clause a remove's options name.
 * @param {{workUnit: string, phase?: string|null, topic?: string|null}} opts
 */
function removeFilter(opts) {
  const where = { work_unit: { eq: opts.workUnit } };
  if (opts.phase) where.phase = { eq: opts.phase };
  if (opts.topic) where.topic = { eq: opts.topic };
  return where;
}

/**
 * Remove every chunk the options name under the store lock. Returns the
 * count removed — 0 when no store exists yet.
 * @param {{workUnit: string, phase?: string|null, topic?: string|null}} opts
 */
async function performRemoval(opts) {
  const sp = storePath();
  if (!fs.existsSync(sp)) return 0;

  let removed = 0;
  await store.withLock(lockFilePath(), async () => {
    const db = await store.loadStore(sp);
    removed = await store.removeByFilter(db, removeFilter(opts));
    await store.saveStore(db, sp);
  });
  return removed;
}

// ---------------------------------------------------------------------------
// Compact command
// ---------------------------------------------------------------------------

async function cmdCompact(_args, options, cfg) {
  const sp = storePath();
  const lp = lockFilePath();

  // Decay is progress-based (idea #33). `compact` is a pure storage backstop:
  // it prunes a unit's non-spec chunks only once their retrievability R has
  // fallen below decay_prune_below — by then they're already unreachable in
  // ranking, so removal is hygiene, not a relevance call. false disables
  // pruning entirely; relevance still decays live in query ranking.
  const pruning = pruneTest(cfg, listWorkUnits('cmdCompact:list'));
  if (!pruning) {
    process.stdout.write('Compaction disabled\n');
    return;
  }

  if (!fs.existsSync(sp)) return;

  const db = await store.loadStore(sp);

  // Discover unique work units in the store by searching for all docs.
  const allResults = await store.searchAllFulltext(db);
  if (allResults.length === 0) return;

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
    const candidates = chunks.filter((c) => pruning.prunes(wu, c.phase));
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
    out.push(`[dry-run] Compacted: removed ${totalChunks} chunks from ${removals.length} work units (retrievability < ${pruning.floor})`);
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
  out.push(`Compacted: removed ${totalChunks} chunks from ${removals.length} work units (retrievability < ${pruning.floor})`);
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
  isPermanentError,
  UserError,
  AuthError,
  InvalidRequestError,
  ConfigError,
  main,
  cmdIndexBulk,
  discoverArtifacts,
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
  pruneTest,
  rerank,
  resolveSimilarityThreshold,
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
