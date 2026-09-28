// Knowledge CLI entry point.
//
// Dispatches commands to their handlers, resolving config and provider
// once at startup.

'use strict';

const fs = require('fs');
const path = require('path');
const store = require('./store');
const chunker = require('./chunker');
const { searchFramings, mergeFramings, rerank, retrievability, explanation } = require('./ranking');
const { StubProvider } = require('./embeddings');
const { OpenAIProvider } = require('./providers/openai');
const { AuthError, InvalidRequestError, ConfigError, QuotaError, RateLimitError, WaitBudget } = require('./providers/openai-engine');
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
const RETRY = { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF };

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
// provider refusing the key or the request, an account out of quota, a
// provider configuration the model contradicts, and programming errors.
const PERMANENT_ERRORS = [
  UserError,
  AuthError,
  InvalidRequestError,
  QuotaError,
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

const SWITCHES = new Set(['explain']);

/**
 * Parse argv-style args into { positional, flags, boosts }.
 * Handles --flag value and --flag=value forms for regular flags; a switch
 * never takes the argument after it as its value.
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
        if (!SWITCHES.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
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
    explain: flags['explain'] === true || flags['explain'] === 'true',
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
  --explain                 Show how each query result ranked
  --dry-run                 Preview without making changes
  --help, -h                Show this usage and exit 0`;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** @param {string} [root]  the project root — by default, the one the working directory sits in */
function knowledgeDir(root = config.findProjectRoot()) {
  return path.resolve(root, '.workflows', '.knowledge');
}

/** @param {string} [root]  the project root — by default, the one the working directory sits in */
function storePath(root) {
  return path.join(knowledgeDir(root), store.STORE_FILE);
}

/** @param {string} [root]  the project root — by default, the one the working directory sits in */
function metadataPath(root) {
  return path.join(knowledgeDir(root), store.METADATA_FILE);
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
// bulk index reads every chunk's source as deleted. path.resolve short-circuits on
// an already-absolute input, so absolute paths pass through unchanged.
function resolveArtifactPath(p) {
  return path.resolve(config.findProjectRoot(), p);
}

// ---------------------------------------------------------------------------
// Retry wrapper — operation-level retry for transient failures
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether repeating the whole operation could change a failure's outcome —
 * never for a permanent failure, nor for a rate limit, which the provider
 * waits on request by request as far as its budget allows.
 * @param {unknown} err
 */
function isRetryable(err) {
  return !isPermanentError(err) && !(err instanceof RateLimitError);
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
      if (!isRetryable(err)) throw err;
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

const KEY_UNRESOLVED_NO_STORE = 'no store is created without it.\n';

/**
 * Build the UserError shown when a keyed provider is configured but its key
 * is unresolvable, where nothing can go on without it. Points at the env var
 * and the key-only setup detour.
 * @param {object} cfg
 * @param {string} consequence  what going without the key costs, one line ending
 *   in a newline — KEY_UNRESOLVED_NO_STORE, or a caller's own
 */
function keyUnresolvedError(cfg, consequence) {
  const envVar = config.PROVIDER_ENV_VARS[cfg.provider];
  const keySource = envVar ? `export ${envVar}=...` : 'set the provider API key';
  return new UserError(
    `Embedding provider "${cfg.provider}" is configured, but its API key could not be resolved — ` +
      consequence +
      '  Provide the key and retry:\n' +
      `    • ${keySource}            (session or CI), or\n` +
      '    • knowledge setup --key-only   (saves it to credentials.json)'
  );
}

/**
 * The one-line account of a configured provider's unresolved key, and the
 * key's two homes — the fix a query's note and an index's failure both name.
 * @param {object} cfg
 */
function keyCause(cfg) {
  return `the ${cfg.provider} API key could not be resolved; ` +
    `export ${config.PROVIDER_ENV_VARS[cfg.provider]}, or run knowledge setup --key-only`;
}

const NO_BUILD_CHOICE_MSG =
  'No knowledge store here, and no configuration says how to build one — no embedding provider ' +
  'is configured and keyword-only was never chosen.\n' +
  '  Run `knowledge setup` to choose, or `knowledge setup --keyword-only` for keyword-only search.';

/**
 * Whether keyword-only was chosen outright: the project config unsets the
 * provider, or a system config holds knowledge settings naming none.
 * Called once no provider is configured at either level.
 * @returns {boolean}
 */
function keywordOnlyChosen() {
  const project = config.readConfigFile(config.projectConfigPath());
  if (project && project.provider === null) return true;
  return config.readConfigFile(config.systemConfigPath(), { sharedFile: true }) !== null;
}

/**
 * The embedder a store created now is built with — the provider, or null for
 * keyword-only — when this machine's config says how: a provider that
 * resolves, or keyword-only chosen outright. Anything else refuses, so no
 * path creates a store the configuration never asked for: a provider whose
 * key cannot be resolved is never stood in for by a keyword-only store, and
 * no configuration at all is never read as a keyword-only choice.
 * @param {object} cfg @param {object|null} provider
 * @returns {object|null}
 */
function newStoreEmbedder(cfg, provider) {
  if (provider) return provider;
  if (cfg.provider) throw keyUnresolvedError(cfg, KEY_UNRESOLVED_NO_STORE);
  if (keywordOnlyChosen()) return null;
  throw new UserError(NO_BUILD_CHOICE_MSG);
}

/**
 * Whether this machine can build the store a checkout lacks — the question
 * `newStoreEmbedder` answers, asked without building anything.
 * @returns {boolean}
 */
function storeBuildable() {
  try {
    const cfg = config.loadConfig();
    newStoreEmbedder(cfg, config.resolveProvider(cfg));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @typedef {object} EmbedderIdentity  what a store records of the provider its vectors came from
 * @property {string|null} provider
 * @property {string|null} model
 * @property {number|null} dimensions
 */

/**
 * The identity a store built with `provider` records — nulls for keyword-only.
 * @param {object} cfg @param {object|null} provider
 * @returns {EmbedderIdentity}
 */
function embedderIdentity(cfg, provider) {
  return {
    provider: provider ? cfg.provider : null,
    model: provider ? provider.model() : null,
    dimensions: provider ? provider.dimensions() : null,
  };
}

/**
 * What keeps the configured provider from embedding into the store, or null
 * when nothing does — a keyword-only store takes any provider, or none, and a
 * store built with a provider takes its own alone. `key`: a keyed provider is
 * configured whose key cannot be resolved; `dropped`: the config names no
 * provider; `mismatch`: another provider, model or dimensions.
 * @param {Record<string, any>} metadata @param {object} cfg @param {object|null} provider
 * @returns {'key'|'dropped'|'mismatch'|null}
 */
function providerConflict(metadata, cfg, provider) {
  if (!metadata.provider) return null;
  if (!provider) return providerKeyUnresolved(cfg) ? 'key' : 'dropped';
  const configured = embedderIdentity(cfg, provider);
  const matches = ['provider', 'model', 'dimensions'].every((field) => metadata[field] === configured[field]);
  return matches ? null : 'mismatch';
}

const REBUILD_MISMATCH_MSG =
  'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n';

/**
 * Why an index refuses the store it would write into, by conflict — each
 * naming its fix. A key that does not resolve is no refusal (see
 * keylessProvider).
 * @type {Record<string, (metadata: Record<string, any>, cfg: object, provider: object|null) => Error>}
 */
const CONFLICT_ERRORS = {
  dropped: (metadata) => new UserError(
    REBUILD_MISMATCH_MSG +
      `  Store was indexed with: provider=${metadata.provider}, model=${metadata.model}\n` +
      '  Current config has no provider configured.'
  ),
  mismatch: (metadata, cfg, provider) => {
    const configured = embedderIdentity(cfg, provider);
    return new UserError(
      REBUILD_MISMATCH_MSG +
        `  Store: provider=${metadata.provider}, model=${metadata.model}, dimensions=${metadata.dimensions}\n` +
        `  Config: provider=${configured.provider}, model=${configured.model}, dimensions=${configured.dimensions}`
    );
  },
};

/**
 * The store's own provider while its key cannot be resolved: it answers to
 * the store's model and dimensions, and every embed fails with `missingKey`,
 * naming the key's fix — so an index writes its chunks by keyword, their
 * vectors wait for a start with the key, and a bulk index fails naming it
 * even with nothing to embed.
 * @param {Record<string, any>} metadata @param {object} cfg
 */
function keylessProvider(metadata, cfg) {
  const missingKey = new UserError(keyCause(cfg));
  return {
    model: () => metadata.model,
    dimensions: () => metadata.dimensions,
    embedBatch: async () => {
      throw missingKey;
    },
    missingKey,
  };
}

// ---------------------------------------------------------------------------
// Index command
// ---------------------------------------------------------------------------

async function cmdIndex(args, options, cfg, provider) {
  if (args.length === 0) {
    if (indexFailed(await cmdIndexBulk(options, cfg, provider))) process.exitCode = 1;
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

  let indexed;
  try {
    indexed = await withRetry(() => indexSingleFile(sourceFile, identity, cfg, provider), RETRY);
  } catch (err) {
    process.stderr.write(
      `Failed to index ${sourceFile}: ${err.message}\nThe next start will retry it.\n`
    );
    process.exit(1);
  }

  process.stdout.write(`Indexed ${indexed.chunks} chunks from ${sourceFile}\n`);
  if (indexed.unembedded.length > 0) {
    reportUnembedded(indexed.unembedded, 'The file');
    process.exitCode = 1;
  }
}

/**
 * Name each file whose vectors failed on stderr, then what that leaves — the
 * files the endpoint refused a chunk of apart from the rest.
 * @param {Unembedded[]} unembedded @param {string} subject  what the consequence speaks of: `The file`, or `Each`
 */
function reportUnembedded(unembedded, subject) {
  const refused = (/** @type {Unembedded} */ { error }) => error instanceof InvalidRequestError;
  reportFailures(unembedded.filter((u) => !refused(u)), `${subject} is searchable by keyword; its vectors come at the next start.`);
  reportFailures(unembedded.filter(refused), `${subject} is searchable by keyword; a chunk the endpoint refused goes without a vector.`);
}

/**
 * Name each file on stderr, then what its failure leaves.
 * @param {Unembedded[]} unembedded @param {string} consequence
 */
function reportFailures(unembedded, consequence) {
  for (const { file, error } of unembedded) process.stderr.write(`Failed to embed ${file}: ${error.message}\n`);
  if (unembedded.length > 0) process.stderr.write(`${consequence}\n`);
}

/**
 * @typedef {object} Artifact
 * @property {string} file  the source path, relative to the project root
 * @property {string} workUnit
 * @property {string} phase
 * @property {string} topic
 */

/**
 * @typedef {object} Built
 * @property {Artifact} artifact
 * @property {'new'|'changed'} [state]  the bulk index's classification
 * @property {Array<Record<string, any>>} docs  the artifact's store documents
 */

/**
 * The chunking config a phase indexes with. In the bundle, __dirname is
 * skills/workflow-knowledge/scripts/, whose sibling ../chunking/ ships the
 * configs; in source mode __dirname is src/knowledge/, so the dev CLI falls
 * back to the shipped skills directory (mirrors resolveEngineJs's probe).
 * @param {string} phase
 */
function readChunkConfig(phase) {
  let chunkConfigPath = path.join(__dirname, '..', 'chunking', phase + '.json');
  if (!fs.existsSync(chunkConfigPath)) {
    const shipped = path.join(__dirname, '..', '..', 'skills', 'workflow-knowledge', 'chunking', phase + '.json');
    if (fs.existsSync(shipped)) chunkConfigPath = shipped;
  }
  if (!fs.existsSync(chunkConfigPath)) {
    throw new UserError(`Chunking config not found: ${chunkConfigPath}`);
  }
  return JSON.parse(fs.readFileSync(chunkConfigPath, 'utf8'));
}

/**
 * An artifact's chunks as store documents, not yet embedded — the per-file
 * work every index shares. Refuses a file that yields no chunks: indexing it
 * would silently wipe the identity's existing chunks.
 * @param {Artifact} artifact
 * @returns {Array<Record<string, any>>}
 */
function buildDocuments(artifact) {
  // Baseline and roadmap are project-level — no work-unit manifest exists to
  // read, so their chunks carry the pseudo work_type.
  const workType = artifact.phase === 'baseline' ? BASELINE_IDENTITY
    : artifact.workUnit === ROADMAP_IDENTITY ? ROADMAP_IDENTITY
      : readWorkType(artifact.workUnit);
  const chunkConfig = readChunkConfig(artifact.phase);
  const absSource = resolveArtifactPath(artifact.file);
  const content = fs.readFileSync(absSource, 'utf8');
  const chunks = chunker.chunk(content, chunkConfig);

  if (chunks.length === 0) {
    throw new UserError(
      `No chunks produced from ${artifact.file}. Refusing to index an empty file — ` +
        'this would silently wipe any existing indexed chunks for this topic. ' +
        'Use `knowledge remove` explicitly if that is what you want.'
    );
  }

  // A chunk's date is its source document's (its mtime), never index time —
  // query headers show when the work was written, and a fresh index of old
  // documents would otherwise read as today's.
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
 * The metadata of the store this checkout has, or null when it has none —
 * metadata left without its store describes nothing, and the store created
 * next replaces it.
 * @returns {Record<string, any>|null}
 */
function storeMetadata() {
  const mp = metadataPath();
  return fs.existsSync(storePath()) && fs.existsSync(mp) ? store.readMetadata(mp) : null;
}

/**
 * The provider new documents are embedded with — null when they go in
 * keyword-only. Over a store built with a provider: that provider, or its
 * keyless stand-in while its key cannot be resolved (see keylessProvider).
 * Over a keyword-only store: whichever the config names, recorded at the next
 * write. Without a store: the one a store created now is built with (see
 * newStoreEmbedder). Throws on any other conflict with the store's own (see
 * providerConflict), and where no store may be created.
 * @param {object} cfg @param {object|null} provider
 * @returns {object|null}
 */
function indexProvider(cfg, provider) {
  const metadata = storeMetadata();
  if (!metadata) return newStoreEmbedder(cfg, provider);
  const conflict = providerConflict(metadata, cfg, provider);
  if (conflict === 'key') return keylessProvider(metadata, cfg);
  if (conflict) throw CONFLICT_ERRORS[conflict](metadata, cfg, provider);
  return provider;
}

/**
 * Give each document the vector the store already holds for its text — the
 * rest are embedded once the documents are written (see fillVectors).
 * @param {Array<Record<string, any>>} docs
 * @param {Map<string, Float32Array>} known  the store's vectors, by the hash of the text each embeds
 */
function reuseVectors(docs, known) {
  for (const doc of docs) {
    const vector = known.get(store.contentHash(doc.content));
    if (vector) doc.embedding = vector;
  }
}

/**
 * @typedef {object} Snapshot  the store as last read or written
 * @property {any} db  null when the checkout has no store
 * @property {string|null} stamp  the stamp of the file it was read from or saved to
 */

/**
 * The store as an index plans and embeds from, and the stamp of the file it
 * was read from — taken before the load, so a write that lands between the
 * two reads as a change.
 * @returns {Snapshot}
 */
function readStore() {
  const sp = storePath();
  const stamp = store.storeStamp(sp);
  return { db: stamp === null ? null : store.loadStore(sp), stamp };
}

/**
 * The vectors the store holds, by the hash of the text each embeds.
 * @param {Snapshot} snapshot
 * @returns {Map<string, Float32Array>}
 */
function knownVectors(snapshot) {
  return snapshot.db ? store.vectorsByContentHash(snapshot.db) : new Map();
}

/**
 * The store to write into, inside the lock: the snapshot while the file is
 * still the one it was read from or saved to, else a fresh load, else a new
 * empty store.
 * @param {Snapshot|null} snapshot
 * @returns {{db: any, created: boolean}}
 */
function currentStore(snapshot) {
  const sp = storePath();
  const stamp = store.storeStamp(sp);
  if (snapshot && snapshot.stamp !== null && snapshot.stamp === stamp) return { db: snapshot.db, created: false };
  if (stamp !== null) return { db: store.loadStore(sp), created: false };
  return { db: store.createStore(), created: true };
}

/**
 * Refuse to write vectors of a width the store no longer has — a concurrent
 * rebuild can change it between embedding and the lock.
 * @param {object|null} provider
 */
function assertStoreDimensions(provider) {
  const metadata = storeMetadata();
  if (!provider || !metadata) return;
  if (metadata.provider && metadata.dimensions !== provider.dimensions()) {
    throw new Error(
      "The store's vector width changed during index (concurrent rebuild). " +
        `Embeddings produced for dims=${provider.dimensions()}, store now has dims=${metadata.dimensions}.`
    );
  }
}

/**
 * Stamp the metadata with this write's time. Once a store records a
 * provider, its provider, model, and dimensions never change: a store
 * created by this write, one that lost its metadata, or a keyword-only one
 * written with a provider records its embedder's.
 * @param {object} cfg @param {object|null} provider @param {boolean} created
 */
function recordIndexed(cfg, provider, created) {
  const existing = created ? null : storeMetadata();
  const identity = existing && (existing.provider || !provider) ? existing : embedderIdentity(cfg, provider);
  store.writeMetadata(metadataPath(), { ...identity, last_indexed: new Date().toISOString() });
}

/**
 * @param {{workUnit: string, phase: string, topic: string}} entry
 */
function identityOf(entry) {
  return { work_unit: entry.workUnit, phase: entry.phase, topic: entry.topic };
}

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
 * @param {{
 *   cfg: object,
 *   provider: object|null,
 *   built: Built[],
 *   snapshot?: Snapshot|null,
 *   retire?: (db: any) => Retirement[],
 * }} write
 * @returns {Promise<Written>}
 */
async function writeStore({ cfg, provider, built, snapshot = null, retire = () => [] }) {
  fs.mkdirSync(knowledgeDir(), { recursive: true });
  return store.withLock(lockFilePath(), async () => {
    assertStoreDimensions(provider);
    const { db, created } = currentStore(snapshot);
    for (const { artifact, docs } of built) {
      store.removeByIdentity(db, identityOf(artifact));
      for (const doc of docs) store.insertDocument(db, doc);
    }
    const retired = retire(db);
    for (const entry of retired) store.removeByIdentity(db, identityOf(entry));
    const sp = storePath();
    if (created || db.retokenized || built.length > 0 || retired.length > 0) {
      store.saveStore(db, sp);
      recordIndexed(cfg, provider, created);
    }
    return { retired, snapshot: { db, stamp: store.storeStamp(sp) } };
  });
}

// ---------------------------------------------------------------------------
// Vectors — embedded once the chunks are written, saved batch by batch
// ---------------------------------------------------------------------------

// Each batch is one embedBatch call and one whole-store save once it lands:
// an interrupted run loses at most one batch.
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

/** @type {Vectoring} */
const NOTHING_EMBEDDED = { unembedded: [], awaiting: 0 };

/**
 * @typedef {Array<{file: string, texts: Map<string, string>}>} VectorBatch  each file's texts, by the hash of each
 */

/**
 * The chunks' texts, each once under the first file holding it, packed file
 * by file into batches of about VECTOR_BATCH_TEXTS texts — a file never
 * split, one larger than a batch alone in its own.
 * @param {Array<Record<string, any>>} chunks
 * @returns {VectorBatch[]}
 */
function vectorBatches(chunks) {
  const byFile = new Map();
  const seen = new Set();
  for (const { source_file: file, content_hash: hash, content } of chunks) {
    if (seen.has(hash)) continue;
    seen.add(hash);
    if (!byFile.has(file)) byFile.set(file, new Map());
    byFile.get(file).set(hash, content);
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
 * The texts' vectors from one embedBatch call, a transient failure retried.
 * @param {object} embedder @param {Map<string, string>} texts  by hash
 * @returns {Promise<Map<string, number[]>>} by hash
 */
async function embedTexts(embedder, texts) {
  const vectors = await withRetry(() => embedder.embedBatch([...texts.values()]), RETRY);
  return new Map([...texts.keys()].map((hash, i) => [hash, vectors[i]]));
}

/**
 * A file's vectors text by text, and the last failure that left a text
 * without its own. Any failure but the endpoint refusing the text ends it.
 * @param {object} embedder @param {Map<string, string>} texts  by hash
 * @returns {Promise<{vectors: Map<string, number[]>, error: Error|null}>}
 */
async function embedTextByText(embedder, texts) {
  const vectors = new Map();
  let error = null;
  for (const [hash, text] of texts) {
    try {
      vectors.set(hash, (await embedTexts(embedder, new Map([[hash, text]]))).get(hash));
    } catch (failure) {
      error = failure;
      if (!(failure instanceof InvalidRequestError)) break;
    }
  }
  return { vectors, error };
}

/**
 * A file's vectors, and the failure that left any text without its own: one
 * call for them all, or — when the endpoint refuses an input among them —
 * text by text, so only the refused text goes without.
 * @param {object} embedder @param {Map<string, string>} texts  by hash
 * @returns {Promise<{vectors: Map<string, number[]>, error: Error|null}>}
 */
async function embedFile(embedder, texts) {
  try {
    return { vectors: await embedTexts(embedder, texts), error: null };
  } catch (error) {
    if (!(error instanceof InvalidRequestError) || texts.size === 1) return { vectors: new Map(), error };
    return embedTextByText(embedder, texts);
  }
}

/**
 * Each file's vectors embedded on its own, and the files whose vectors failed.
 * @param {object} embedder @param {VectorBatch} batch
 * @returns {Promise<{vectors: Map<string, number[]>, unembedded: Unembedded[]}>}
 */
async function embedFileByFile(embedder, batch) {
  const vectors = new Map();
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
 * @param {object} embedder @param {VectorBatch} batch
 * @returns {Promise<{vectors: Map<string, number[]>, unembedded: Unembedded[]}>}
 */
async function embedBatchOfFiles(embedder, batch) {
  try {
    return { vectors: await embedTexts(embedder, new Map(batch.flatMap(({ texts }) => [...texts]))), unembedded: [] };
  } catch (error) {
    if (error instanceof InvalidRequestError) return embedFileByFile(embedder, batch);
    return { vectors: new Map(), unembedded: batch.map(({ file }) => ({ file, error })) };
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
 * Write vectors into the store under the lock, and return the store as it
 * then stands. A store gone since is left gone.
 * @param {object} cfg @param {object} embedder @param {Snapshot} snapshot
 * @param {Map<string, number[]>} vectors  by the hash of the text each embeds
 * @returns {Promise<Snapshot>}
 */
async function saveVectors(cfg, embedder, snapshot, vectors) {
  return store.withLock(lockFilePath(), async () => {
    assertStoreDimensions(embedder);
    const { db, created } = currentStore(snapshot);
    if (created) return snapshot;
    const sp = storePath();
    if (store.attachVectors(db, vectors) > 0) {
      store.saveStore(db, sp);
      recordIndexed(cfg, embedder, false);
    }
    return { db, stamp: store.storeStamp(sp) };
  });
}

/**
 * Embed every chunk `pending` admits that has no vector, batch by batch,
 * each batch's vectors saved as it lands — so a failure part-way keeps every
 * vector already landed. The first failure that is not the endpoint refusing
 * an input stops it, failing every file after with the same error.
 * @param {object} cfg @param {object} embedder @param {Snapshot} snapshot  the store as written
 * @param {(chunk: Record<string, any>) => boolean} pending
 * @returns {Promise<Vectoring>}
 */
async function fillVectors(cfg, embedder, snapshot, pending) {
  const awaiting = (db) => store.chunksWithoutVector(db).filter(pending);
  const batches = vectorBatches(awaiting(snapshot.db));
  let current = snapshot;
  const unembedded = [];
  for (const [at, batch] of batches.entries()) {
    const landed = await embedBatchOfFiles(embedder, batch);
    if (landed.vectors.size > 0) current = await saveVectors(cfg, embedder, current, landed.vectors);
    unembedded.push(...landed.unembedded);
    const stopped = stoppingError(landed.unembedded);
    if (stopped) {
      unembedded.push(...batches.slice(at + 1).flat().map(({ file }) => ({ file, error: stopped })));
      break;
    }
  }
  return { unembedded, awaiting: awaiting(current.db).length };
}

/**
 * Index a single file into the store: its chunks written, searchable by
 * keyword, then the vectors the store lacks for them embedded.
 * @param {string} sourceFile @param {{workUnit: string, phase: string, topic: string}} identity
 * @param {object} cfg @param {object|null} provider
 * @returns {Promise<{chunks: number, unembedded: Unembedded[]}>}
 */
async function indexSingleFile(sourceFile, identity, cfg, provider) {
  const artifact = { file: sourceFile, ...identity };
  const docs = buildDocuments(artifact);
  const embedder = indexProvider(cfg, provider);
  const snapshot = readStore();
  if (embedder) reuseVectors(docs, knownVectors(snapshot));
  const written = await writeStore({ cfg, provider: embedder, built: [{ artifact, docs }], snapshot });
  const own = identityKey(artifact.workUnit, artifact.phase, artifact.topic);
  const ofFile = (chunk) => identityKey(chunk.work_unit, chunk.phase, chunk.topic) === own;
  const vectoring = embedder ? await fillVectors(cfg, embedder, written.snapshot, ofFile) : NOTHING_EMBEDDED;
  return { chunks: docs.length, unembedded: vectoring.unembedded };
}

// ---------------------------------------------------------------------------
// Bulk index — bring the store in line with the files
// ---------------------------------------------------------------------------

// `manifest list` carries every work unit's whole manifest — past
// execFileSync's 1 MiB default on a large project.
const MANIFEST_READ_MAX_BUFFER = 256 * 1024 * 1024;

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
    maxBuffer: MANIFEST_READ_MAX_BUFFER,
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
 * `get` answers a missing work unit or field with empty stdout and exit 0,
 * so callers detect expected misses by checking the output.
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
 * The session number a manifest node marks live, or null.
 * @param {any} node  an epic's `phases.discovery`, or the project's `roadmap`
 */
function activeSession(node) {
  const session = node && node.active_session;
  return typeof session === 'string' && session !== '' ? session : null;
}

/**
 * @typedef {object} Manifests
 * @property {Array<any>} workUnits  every work unit's manifest the engine lists
 * @property {Set<string>|null} registry  the registered work-unit names — null
 *   when none are registered: the engine then lists work units by scanning the
 *   directory, so an empty registry says nothing about which units exist
 * @property {string|null} roadmapSession  the live roadmap session's number
 */

/**
 * The manifests the bulk index decides from. A failed read throws — it is
 * not evidence that anything is gone.
 * @returns {Manifests}
 */
function readManifests() {
  try {
    const project = JSON.parse(runManifest(['get', 'project'])) || {};
    const registered = Object.keys(project.work_units || {});
    return {
      workUnits: readWorkUnits(),
      registry: registered.length > 0 ? new Set(registered) : null,
      roadmapSession: activeSession(project.roadmap),
    };
  } catch (err) {
    throw new Error(`manifest read failed: ${manifestErrorDetail(err)}`);
  }
}

/**
 * readManifests for callers that degrade on a failed read: no work units,
 * and a warning.
 * @param {string} context  label for the failure warning
 * @returns {Manifests}
 */
function listManifests(context) {
  try {
    return readManifests();
  } catch (err) {
    process.stderr.write(`Warning: ${err.message} (${context})\n`);
    return { workUnits: [], registry: null, roadmapSession: null };
  }
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
 * The session logs in a sessions directory, bar the live session's — a live
 * log is indexed when its session closes.
 * @param {string} dir  project-relative @param {string|null} liveSession
 * @returns {string[]} the log filenames
 */
function closedSessionLogs(dir, liveSession) {
  let files;
  try {
    files = fs.readdirSync(resolveArtifactPath(dir));
  } catch {
    return [];
  }
  return files.filter((f) => /^session-\d+\.md$/.test(f) && (liveSession === null || f !== `session-${liveSession}.md`));
}

/**
 * Discover all completed artifacts across all work units. Per-topic phase
 * paths are derived locally from ARTIFACT_PATHS (no per-topic engine spawn);
 * imports, seeds, analysis caches, and closed discovery sessions are
 * file-based traversals.
 * Returns an array of { file, workUnit, phase, topic }.
 * @param {Manifests} [manifests]  already read — omitted, this reads its own
 *   and degrades to the project-level artifacts on a failed read
 * @returns {Artifact[]}
 */
function discoverArtifacts(manifests = listManifests('discoverArtifacts')) {
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
  for (const f of closedSessionLogs(roadmapSessDir, manifests.roadmapSession)) {
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

  for (const wu of manifests.workUnits) {
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
      const live = activeSession(wu.phases && wu.phases.discovery);
      for (const f of closedSessionLogs(sessDir, live)) {
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
 * @typedef {object} Indexed
 * @property {string} workUnit
 * @property {string} phase
 * @property {string} topic
 * @property {string} file  the source file the chunks were indexed from
 * @property {Set<string|undefined>} hashes  the source hashes they carry —
 *   undefined for a chunk with no recorded hash
 * @property {Map<string, string>} texts  the hash of each chunk's text, by chunk id
 * @property {number} chunks
 */

/**
 * @typedef {Indexed & {reason: string}} Retirement
 */

/**
 * Chunks grouped by identity.
 * @param {Array<{id: string, work_unit: string, phase: string, topic: string, source_file: string, source_hash?: string, content_hash: string}>} chunks
 * @returns {Map<string, Indexed>}
 */
function identitiesOf(chunks) {
  const byKey = new Map();
  for (const c of chunks) {
    const key = identityKey(c.work_unit, c.phase, c.topic);
    if (!byKey.has(key)) {
      byKey.set(key, { workUnit: c.work_unit, phase: c.phase, topic: c.topic, file: c.source_file, hashes: new Set(), texts: new Map(), chunks: 0 });
    }
    const entry = byKey.get(key);
    entry.hashes.add(c.source_hash);
    entry.texts.set(c.id, c.content_hash);
    entry.chunks += 1;
  }
  return byKey;
}

/**
 * The identities with a chunk awaiting its vector — none without an embedder
 * to give one.
 * @param {Snapshot} snapshot @param {object|null} embedder
 * @returns {Set<string>}
 */
function awaitingIdentities(snapshot, embedder) {
  if (!embedder || !snapshot.db) return new Set();
  return new Set(store.chunksWithoutVector(snapshot.db).map((c) => identityKey(c.work_unit, c.phase, c.topic)));
}

/**
 * Whether the file now cuts other chunk texts than the store holds for it —
 * a file that no longer builds included, so indexing it names the failure.
 * @param {Artifact} artifact @param {Indexed} entry
 */
function cutsOtherTexts(artifact, entry) {
  let docs;
  try {
    docs = buildDocuments(artifact);
  } catch (_) {
    return true;
  }
  return docs.length !== entry.texts.size || docs.some((doc) => entry.texts.get(doc.id) !== store.contentHash(doc.content));
}

/**
 * Sort discovered artifacts against the store: `fresh` has no chunks,
 * `changed` has chunks indexed from other content (or from content whose hash
 * was never recorded) — or, with a chunk awaiting its vector, chunks whose
 * texts the file no longer cuts; `unchanged` matches the file on disk.
 * @param {Artifact[]} artifacts
 * @param {Map<string, Indexed>} indexed
 * @param {Set<string>} awaiting  the identities with a chunk awaiting its vector
 */
function classifyArtifacts(artifacts, indexed, awaiting) {
  const out = { fresh: [], changed: [], unchanged: [] };
  for (const artifact of artifacts) {
    const key = identityKey(artifact.workUnit, artifact.phase, artifact.topic);
    const entry = indexed.get(key);
    if (!entry) {
      out.fresh.push(artifact);
      continue;
    }
    const hash = store.contentHash(fs.readFileSync(resolveArtifactPath(artifact.file), 'utf8'));
    const current = entry.hashes.size === 1 && entry.hashes.has(hash) && !(awaiting.has(key) && cutsOtherTexts(artifact, entry));
    out[current ? 'unchanged' : 'changed'].push(artifact);
  }
  return out;
}

/**
 * Split artifacts into those compact leaves in the store and those it prunes
 * — the bulk index never re-embeds a pruned one.
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
 * source outside the project is no evidence it was deleted, a work unit whose
 * manifest could not be read is evidence of nothing, and the project-level
 * identities answer to their files alone.
 * @param {Indexed} entry
 * @param {Map<string, any>} units  work-unit manifests by name
 * @param {Set<string>|null} registry
 */
function retiredReason(entry, units, registry) {
  if (!outsideProject(entry.file) && !fs.existsSync(resolveArtifactPath(entry.file))) return 'source deleted';
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
 * The indexed identities that no longer belong in the store, each with its
 * reason. A scope confines them to one work unit.
 * @param {Map<string, Indexed>} indexed @param {Manifests} manifests @param {string|null} scope
 * @returns {Retirement[]}
 */
function retirements(indexed, manifests, scope) {
  const units = new Map(manifests.workUnits.filter((u) => u && u.name).map((u) => [u.name, u]));
  return [...indexed.values()]
    .filter((entry) => !scope || entry.workUnit === scope)
    .map((entry) => ({ ...entry, reason: retiredReason(entry, units, manifests.registry) }))
    .filter((entry) => entry.reason);
}

/**
 * What the bulk index does to the store: the discovered artifacts sorted into
 * fresh, changed and unchanged (see classifyArtifacts), with those compact
 * prunes set aside, and the indexed identities to retire. A scope confines
 * all of it to one work unit.
 * @param {Array<any>} chunks  every chunk in the store
 * @param {Manifests} manifests
 * @param {{scope: string|null, pruning: ReturnType<typeof pruneTest>, awaiting?: Set<string>}} opts
 */
function planIndex(chunks, manifests, { scope, pruning, awaiting = new Set() }) {
  const indexed = identitiesOf(chunks);
  const artifacts = discoverArtifacts(manifests).filter((a) => !scope || a.workUnit === scope);
  const { kept, pruned } = splitPruned(artifacts, pruning);
  return { ...classifyArtifacts(kept, indexed, awaiting), pruned, retired: retirements(indexed, manifests, scope) };
}

/**
 * Compact's prune test as the bulk index skips by: an invalid
 * `decay_prune_below` prunes nothing here — compact alone refuses it.
 * @param {object} cfg @param {Array<object>} workUnits
 */
function indexPruning(cfg, workUnits) {
  try {
    return pruneTest(cfg, workUnits);
  } catch (err) {
    if (err instanceof UserError) return null;
    throw err;
  }
}

/**
 * Build each planned artifact's documents. A failure fails its own artifact
 * alone.
 * @param {Array<{artifact: Artifact, state: 'new'|'changed'}>} planned
 * @returns {{built: Built[], failures: Array<{artifact: Artifact, error: Error}>}}
 */
function buildAll(planned) {
  const built = [];
  const failures = [];
  for (const { artifact, state } of planned) {
    try {
      built.push({ artifact, state, docs: buildDocuments(artifact) });
    } catch (error) {
      failures.push({ artifact, error });
    }
  }
  return { built, failures };
}

/**
 * @typedef {object} IndexSummary
 * @property {number} new
 * @property {number} changed
 * @property {number} removed
 * @property {number} unchanged
 * @property {number} failed  the files that could not be indexed
 * @property {number} awaiting  the chunks left without the vector they await
 * @property {boolean} keyUnresolved  the store's provider key did not resolve, so no vector could land
 */

/**
 * Whether a bulk index fell short — a file it could not index, a chunk it
 * could not embed, or a store whose provider key does not resolve.
 * @param {IndexSummary} summary
 */
function indexFailed(summary) {
  return summary.failed > 0 || summary.awaiting > 0 || summary.keyUnresolved;
}

/**
 * Print what a bulk index did — each failure, the missing key, each removal,
 * each file indexed, then the summary — and return the summary. An identity
 * retired after it was built reads as removed alone.
 * @param {{built: Built[], failures: Array<{artifact: Artifact, error: Error}>, retired: Retirement[], unchanged: Artifact[], vectoring: Vectoring, missingKey: Error|null}} outcome
 * @returns {IndexSummary}
 */
function reportIndex({ built, failures, retired, unchanged, vectoring, missingKey }) {
  const gone = new Set(retired.map((e) => identityKey(e.workUnit, e.phase, e.topic)));
  const stays = (a) => !gone.has(identityKey(a.workUnit, a.phase, a.topic));
  const indexed = built.filter((b) => stays(b.artifact));

  for (const { artifact, error } of failures) {
    process.stderr.write(`Failed to index ${artifact.file}: ${error.message}\n`);
  }
  reportUnembedded(vectoring.unembedded, 'Each');
  if (missingKey) process.stderr.write(`Cannot embed: ${missingKey.message}\n`);
  for (const entry of retired) {
    process.stdout.write(`Removed ${entry.file} — ${entry.chunks} chunks (${entry.reason})\n`);
  }
  for (const { artifact, docs, state } of indexed) {
    process.stdout.write(`Indexed ${artifact.file} — ${docs.length} chunks (${state})\n`);
  }

  const summary = {
    new: indexed.filter((b) => b.state === 'new').length,
    changed: indexed.filter((b) => b.state === 'changed').length,
    removed: retired.length,
    unchanged: unchanged.filter(stays).length,
    failed: failures.length,
    awaiting: vectoring.awaiting,
    keyUnresolved: missingKey !== null,
  };
  const failed = summary.failed > 0 ? `, ${summary.failed} failed` : '';
  const awaiting = summary.awaiting > 0 ? `, ${summary.awaiting} chunks awaiting vectors` : '';
  process.stdout.write(
    `${summary.new} new, ${summary.changed} changed, ${summary.removed} removed, ${summary.unchanged} unchanged${failed}${awaiting}.\n`
  );
  return summary;
}

/**
 * Bring the store in line with the files (see planIndex), creating it first
 * when the checkout has none, and saving a retokenized store's terms.
 * Everything new or changed is built first; then, under the lock, the
 * manifests are read again — a topic retired mid-run leaves in the same
 * run — and the documents, each with any vector the store already holds
 * for its text, and the retirements land in one load and one save,
 * searchable by keyword from then on. Then every chunk in scope without a
 * vector is embedded (see fillVectors) — a pruned one excepted — and a
 * keyword-only store takes a configured provider. Every file is attempted;
 * a failure is counted in the returned summary, as is a store whose
 * provider key does not resolve.
 * @returns {Promise<IndexSummary>}
 */
async function cmdIndexBulk(options, cfg, provider) {
  const scope = (options && options.workUnit) || null;
  const manifests = readManifests();
  // Resolved even when nothing needs embedding: a provider or model change
  // since the store was built must surface here, not read as a store in line,
  // and a store this machine may not create must never be started.
  const embedder = indexProvider(cfg, provider);
  const snapshot = readStore();
  const chunks = snapshot.db ? store.allChunks(snapshot.db) : [];
  const pruning = indexPruning(cfg, manifests.workUnits);
  const plan = planIndex(chunks, manifests, { scope, pruning, awaiting: awaitingIdentities(snapshot, embedder) });

  const { built, failures } = buildAll([
    ...plan.fresh.map((artifact) => ({ artifact, state: 'new' })),
    ...plan.changed.map((artifact) => ({ artifact, state: 'changed' })),
  ]);
  if (embedder) {
    const known = knownVectors(snapshot);
    for (const { docs } of built) reuseVectors(docs, known);
  }

  const inLine = snapshot.db !== null && !snapshot.db.retokenized && built.length === 0 && plan.retired.length === 0;
  const written = inLine ? { retired: [], snapshot } : await writeStore({
    cfg,
    provider: embedder,
    built,
    snapshot,
    retire: (db) => retirements(identitiesOf(store.allChunks(db)), readManifests(), scope),
  });
  const pending = (chunk) => (!scope || chunk.work_unit === scope) && !(pruning && pruning.prunes(chunk.work_unit, chunk.phase));
  const vectoring = embedder ? await fillVectors(cfg, embedder, written.snapshot, pending) : NOTHING_EMBEDDED;
  const missingKey = (embedder && embedder.missingKey) || null;

  return reportIndex({ built, failures, retired: written.retired, unchanged: plan.unchanged, vectoring, missingKey });
}

// ---------------------------------------------------------------------------
// Query command
// ---------------------------------------------------------------------------

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
// Progress clock (watermark)
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
 * The progress clock over a manifest list — its completed units alone count.
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

/**
 * What is wrong with a --boost directive, or null when it is valid.
 * @param {{field: string, value: string|null}} boost
 * @returns {string|null}
 */
function boostProblem({ field, value }) {
  if (!field || !BOOST_FIELD_MAP[field]) {
    return `Unknown --boost field: "${field}". Valid fields: ${Object.keys(BOOST_FIELD_MAP).join(', ')}`;
  }
  if (value == null || value === '') return `--boost:${field} requires a value`;
  return null;
}

/**
 * Map --boost directives to the store schema's field names. Throws UserError
 * on an unknown field or a missing value, so a skill-template typo never
 * silently no-ops.
 * @param {Array<{field: string, value: string|null}>} boosts
 * @returns {Array<{field: string, value: string}>}
 */
function normaliseBoosts(boosts) {
  return boosts.map((boost) => {
    const problem = boostProblem(boost);
    if (problem) throw new UserError(problem);
    return { field: BOOST_FIELD_MAP[boost.field], value: boost.value };
  });
}

/**
 * The one-line note a query run keyword-only carries: why it is, and its fix.
 * @param {string} cause
 */
function keywordOnlyNote(cause) {
  return `[keyword-only mode — ${cause}]`;
}

const CHOSEN_KEYWORD_ONLY = 'configure embedding provider for semantic search';
const NO_VECTORS_YET = 'the store has no vectors yet; the next start embeds them';

/**
 * A store's embedder named, as a note words it.
 * @param {EmbedderIdentity} identity
 */
function embedderName({ provider, model, dimensions }) {
  return `${provider} (${model}, ${dimensions} dimensions)`;
}

/**
 * Why a query runs keyword-only, by conflict (see providerConflict).
 * @type {Record<string, (metadata: Record<string, any>, cfg: object, provider: object|null) => string>}
 */
const CONFLICT_CAUSES = {
  key: (_metadata, cfg) => keyCause(cfg),
  dropped: (metadata) =>
    `the store was embedded with ${embedderName(metadata)} and the config names no provider; ` +
    'restore it in the config, or run knowledge rebuild',
  mismatch: (metadata, cfg, provider) =>
    `the store was embedded with ${embedderName(metadata)} and the config names ` +
    `${embedderName(embedderIdentity(cfg, provider))}; run knowledge rebuild`,
};

/**
 * Why a query over the store runs keyword-only, and its fix — null when it
 * embeds its framings. A store built with a provider takes its own alone; a
 * keyword-only store has no vector to compare one with.
 * @param {Record<string, any>} metadata @param {object} cfg @param {object|null} provider
 * @returns {string|null}
 */
function keywordOnlyCause(metadata, cfg, provider) {
  const conflict = providerConflict(metadata, cfg, provider);
  if (conflict) return CONFLICT_CAUSES[conflict](metadata, cfg, provider);
  if (metadata.provider) return null;
  if (provider) return NO_VECTORS_YET;
  return providerKeyUnresolved(cfg) ? keyCause(cfg) : CHOSEN_KEYWORD_ONLY;
}

/**
 * The provider a query embeds its framings with — null when it runs
 * keyword-only — and the note that says why it does (see keywordOnlyCause).
 * @param {Record<string, any>} metadata @param {object} cfg @param {object|null} provider
 * @returns {{provider: object|null, note: string|null}}
 */
function queryEmbedder(metadata, cfg, provider) {
  const cause = keywordOnlyCause(metadata, cfg, provider);
  return cause ? { provider: null, note: keywordOnlyNote(cause) } : { provider, note: null };
}

/**
 * Why embedding a query's framings failed, and its fix: the failure's own
 * words, which name the fix where no retry can change them.
 * @param {Error} err
 */
function embedFailureCause(err) {
  if (err instanceof RateLimitError) return "the embedding provider's rate limit outlasted this command's wait; retry shortly";
  if (err instanceof QuotaError) return 'the embedding account is out of quota; add credit to it';
  const said = `the query could not be embedded: ${err.message.replace(/\s+/g, ' ').trim()}`;
  return isPermanentError(err) ? said : `${said}; retry once the provider answers`;
}

/**
 * Every framing's vector, from one embedBatch call, and the note a query run
 * without them carries — the settings' own when they name no provider, else
 * why the embedding failed.
 * @param {QuerySettings} settings @param {string[]} terms
 * @returns {Promise<{vectors: Array<ArrayLike<number>>|null, note: string|null}>}
 */
async function framingVectors({ provider, note }, terms) {
  if (!provider) return { vectors: null, note };
  try {
    return { vectors: await provider.embedBatch(terms), note: null };
  } catch (err) {
    return { vectors: null, note: keywordOnlyNote(embedFailureCause(err)) };
  }
}

/**
 * The line that says how many chunks await their vectors — null when none do.
 * @param {any} db
 * @returns {string|null}
 */
function awaitingNote(db) {
  const awaiting = store.chunksWithoutVector(db).length;
  return awaiting > 0 ? `[${awaiting} chunks await vectors — searched by keyword alone; each start retries them]` : null;
}

/**
 * Turn a CLI filter value into a where-clause term: a single value → { eq },
 * a comma-separated list → { in }. Every --flag that names a filterable
 * dimension (phase, work-type, work-unit, topic) runs through this.
 * @param {string} value
 */
function csv(value) {
  const parts = value.split(',').map((s) => s.trim());
  return parts.length === 1 ? { eq: parts[0] } : { in: parts };
}

// ?? (not ||) so an explicit `similarity_threshold: 0` — a legitimate
// "accept all vector matches, no filtering" setting — isn't silently
// rewritten to the default.
function resolveSimilarityThreshold(cfg) {
  const similarity = cfg.similarity_threshold ?? config.DEFAULTS.similarity_threshold;
  if (typeof similarity !== 'number' || !Number.isFinite(similarity) || similarity < 0 || similarity > 1) {
    throw new UserError(
      `Invalid similarity_threshold: ${JSON.stringify(similarity)}. Expected a number in [0, 1].`
    );
  }
  return similarity;
}

/**
 * The where clause a query's hard filters make — undefined when it has none.
 * @param {QueryOptions} options
 */
function queryWhere({ phase, workType, workUnit, topic }) {
  const where = {};
  if (phase) where.phase = csv(phase);
  if (workType) where.work_type = csv(workType);
  if (workUnit) where.work_unit = csv(workUnit);
  if (topic) where.topic = csv(topic);
  return Object.keys(where).length > 0 ? where : undefined;
}

/**
 * @typedef {object} QuerySettings
 * @property {object|null} provider  embeds the framings, on its own patience (see queryProvider) — null when the query runs keyword-only
 * @property {string|null} note  why the query runs keyword-only, when it does
 * @property {boolean} storeEmbedded  whether the store's identity names a provider — a chunk without a vector then awaits one
 * @property {number} similarity  the vector leg's cosine floor
 * @property {number} stability  S0 for the decay curve
 * @property {Object<string, number>} weights  the progress clock's significance weights
 */

// A query's patience with its endpoint is seconds, where an index's is
// minutes: keyword-only answers at once, and a phase's opening query must not
// stall.
const QUERY_TIMEOUT_MS = 5000;
const QUERY_RETRY = { maxAttempts: 2, backoff: DEFAULT_RETRY_BACKOFF };
const QUERY_WAIT_BUDGET_MS = 5000;

/**
 * The configured provider as a query embeds with it — each request answered
 * within QUERY_TIMEOUT_MS, a transient failure tried once more, a rate limit
 * waited out for QUERY_WAIT_BUDGET_MS in all — or null when none is.
 * @param {object} cfg
 * @param {import('./providers/openai-engine').Patience} [patience]  over the query's own, for a caller that must wait less
 * @returns {object|null}
 */
function queryProvider(cfg, patience = {}) {
  const provider = config.resolveProvider(cfg, {
    timeoutMs: QUERY_TIMEOUT_MS,
    waitBudget: new WaitBudget(QUERY_WAIT_BUDGET_MS),
    ...patience,
  });
  return provider && {
    model: () => provider.model(),
    dimensions: () => provider.dimensions(),
    embedBatch: (/** @type {string[]} */ texts) => withRetry(() => provider.embedBatch(texts), QUERY_RETRY),
  };
}

/**
 * The configured provider as a command embeds with it — a query on its own
 * patience (see queryProvider), every other command on the provider's — or
 * null when none is.
 * @param {string} command @param {object} cfg
 * @returns {object|null}
 */
function commandProvider(command, cfg) {
  return command === 'query' ? queryProvider(cfg) : config.resolveProvider(cfg);
}

/**
 * What a query over a store runs with: the provider the store's metadata and
 * the config leave it (see queryEmbedder), and the ranking settings the
 * config holds. Throws UserError on an invalid similarity threshold.
 * @param {Record<string, any>} metadata @param {object} cfg @param {object|null} provider
 * @returns {QuerySettings}
 */
function querySettings(metadata, cfg, provider) {
  return {
    ...queryEmbedder(metadata, cfg, provider),
    storeEmbedded: Boolean(metadata.provider),
    similarity: resolveSimilarityThreshold(cfg),
    stability: resolveStability(cfg),
    weights: resolveDecayWeights(cfg),
  };
}

/**
 * @typedef {object} QueryOptions  a query's options as buildOptions makes them
 *   from the CLI's flags — hard filters (each a value or a comma list), the
 *   limit, and the --boost directives by CLI field name
 * @property {string|null} [phase]
 * @property {string|null} [workType]
 * @property {string|null} [workUnit]
 * @property {string|null} [topic]
 * @property {number|null} [limit]
 * @property {Array<{field: string, value: string|null}>} [boosts]
 */

/**
 * @typedef {object} QueryRequest
 * @property {string[]} terms
 * @property {QueryOptions} options
 * @property {Array<object>} workUnits  the manifests the progress clock is built from
 */

const DEFAULT_QUERY_LIMIT = 10;

/**
 * @typedef {object} QueryOutcome
 * @property {Array<Record<string, any>>} results  ranked, cut to the limit
 * @property {string[]} notes  the lines above the count: why the query ran keyword-only, and the chunks awaiting vectors
 */

/** @type {QueryOutcome} */
const NO_RESULTS = { results: [], notes: [] };

/**
 * A query's ranked results: every framing embedded in one request — or,
 * whatever keeps the query from its vectors, none, the query then running
 * keyword-only — then every framing's hits merged by each chunk's best
 * score, dated by the progress clock, re-ranked, and cut to the limit, each
 * result carrying the scoring `--explain` prints. Throws UserError on an
 * invalid --boost directive.
 * @param {any} db @param {QuerySettings} settings @param {QueryRequest} request
 * @returns {Promise<QueryOutcome>}
 */
async function queryStore(db, settings, { terms, options, workUnits }) {
  const boosts = normaliseBoosts(options.boosts || []);
  const limit = options.limit || DEFAULT_QUERY_LIMIT;
  const { vectors, note } = await framingVectors(settings, terms);
  const { cut, framings } = searchFramings(db, terms, { where: queryWhere(options), limit, similarity: settings.similarity, vectors });
  const clock = progressClockOf(workUnits, settings.weights);
  const dated = mergeFramings(framings, cut).map((r) => ({ ...r, progressElapsed: clock.get(r.work_unit) || 0 }));
  return {
    results: rerank(dated, boosts, settings.stability).slice(0, limit),
    notes: [note, settings.storeEmbedded ? awaitingNote(db) : null].filter((line) => line !== null),
  };
}

/**
 * The text `query` prints: its notes, the count, then each result's header,
 * content and source — and, explained, how it ranked. Control characters are
 * stripped from the whole at the boundary — \n is exempt, so the joins
 * survive.
 * @param {QueryOutcome} outcome @param {{explain?: boolean}} [rendering]
 * @returns {string}
 */
function renderQuery({ results, notes }, { explain = false } = {}) {
  const out = [...notes, `[${results.length} results]`];
  for (const r of results) {
    // Header date is the source document's date (its mtime at index time) —
    // i.e. when the work was authored, not when the store was indexed.
    out.push(
      '',
      `[${r.phase} | ${r.work_unit}/${r.topic} | ${r.confidence} | ${formatDate(r.timestamp)}]`,
      r.content,
      `Source: ${r.source_file}`,
    );
    if (explain) out.push(...explanation(r));
  }
  return stripControlChars(out.join('\n')) + '\n';
}

async function cmdQuery(args, options, cfg, provider) {
  if (args.length === 0) {
    process.stderr.write('Usage: knowledge query <search_term> [<term2>...] [--work-unit ...] [--work-type ...] [--phase ...] [--topic ...] [--boost:<field> <value>]... [--limit N] [--explain]\n');
    process.exit(1);
  }

  // An empty or whitespace-only term is almost certainly a caller mistake
  // (fat-finger, variable template that wasn't substituted) — refused, not
  // answered with nothing.
  for (const t of args) {
    if (typeof t !== 'string' || t.trim() === '') {
      throw new UserError(
        'Empty search term. `knowledge query` requires at least one non-empty positional term. ' +
          'If you intended to list everything indexed, use `knowledge status` instead.'
      );
    }
  }

  const boostError = options.boosts.map(boostProblem).find(Boolean);
  if (boostError) {
    process.stderr.write(`${boostError}\n`);
    process.exit(1);
  }

  const sp = storePath();
  const mp = metadataPath();

  if (!fs.existsSync(sp)) {
    process.stdout.write(renderQuery(NO_RESULTS));
    return;
  }

  const db = store.loadStore(sp);

  if (!fs.existsSync(mp)) {
    process.stderr.write(`${store.METADATA_FILE} missing but store exists. Run \`knowledge rebuild\` to fix.\n`);
    process.exit(1);
  }

  const settings = querySettings(store.readMetadata(mp), cfg, provider);
  const outcome = await queryStore(db, settings, { terms: args, options, workUnits: listWorkUnits('query') });
  process.stdout.write(renderQuery(outcome, { explain: options.explain }));
}

// ---------------------------------------------------------------------------
// Check command
// ---------------------------------------------------------------------------

async function cmdCheck(/* args, options, cfg, provider */) {
  process.stdout.write(`${await readiness()}\n`);
}

/**
 * `ready` — set up, and the store is loadable with its metadata;
 * `buildable` — set up (the committed project config), no store on this
 * checkout, and this machine's config says how to build one; `not-ready` —
 * anything else.
 * @returns {Promise<'ready'|'buildable'|'not-ready'>}
 */
async function readiness() {
  const configFile = path.join(knowledgeDir(), 'config.json');
  const sp = storePath();

  if (!fs.existsSync(configFile)) return 'not-ready';

  // A corrupted config would otherwise pass `check`, and the user would only
  // see the JSON parse error later on `index` or `query`, with no hint that
  // the root cause is the config file itself.
  try {
    config.readConfigFile(configFile);
  } catch (err) {
    process.stderr.write(`config error: ${err.message}\n`);
    return 'not-ready';
  }

  if (!fs.existsSync(sp)) return storeBuildable() ? 'buildable' : 'not-ready';

  try {
    store.loadStore(sp);
  } catch (_) {
    return 'not-ready';
  }

  // A store WITHOUT metadata is the partial state `query` refuses
  // ("metadata.json missing but store exists") and that setup/setup-forms
  // refuse toward rebuild — so `check` must not report it ready. Without
  // this, boot's gate would pass and the failure would only surface later on
  // the first query.
  if (!fs.existsSync(metadataPath())) return 'not-ready';

  return 'ready';
}

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------

/**
 * The config and provider a command loads, or the error that fails it.
 * @returns {{cfg: object|null, provider: object|null, error: Error|null}}
 */
function statusSettings() {
  try {
    const cfg = config.loadConfig();
    return { cfg, provider: config.resolveProvider(cfg), error: null };
  } catch (error) {
    return { cfg: null, provider: null, error };
  }
}

/**
 * What a query over the store runs in — keyword-only naming why and the fix,
 * in its note's words (see keywordOnlyCause).
 * @param {Record<string, any>} metadata @param {ReturnType<typeof statusSettings>} settings
 */
function queryMode(metadata, { cfg, provider, error }) {
  if (error) return 'none — a query fails until the knowledge config loads';
  const cause = keywordOnlyCause(metadata, cfg, provider);
  return cause ? `Keyword-only — ${cause}` : 'Full (hybrid search)';
}

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

  const db = store.loadStore(sp);
  const allChunks = store.allChunks(db);

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

  const warn = (err) => out.push('', `WARNING: ${err.message}`);
  const settings = statusSettings();
  if (fs.existsSync(mp)) {
    const metadata = store.readMetadata(mp);
    out.push(`Last indexed: ${metadata.last_indexed || 'unknown'}`);
    out.push(metadata.provider ? `Provider: ${metadata.provider} (model: ${metadata.model}, dimensions: ${metadata.dimensions})` : 'Provider: none');
    out.push(`Mode: ${queryMode(metadata, settings)}`);
    if (metadata.provider) out.push(`Chunks awaiting vectors: ${store.chunksWithoutVector(db).length}`);
  } else {
    out.push('Metadata: missing (run `knowledge rebuild` to fix)');
  }
  if (settings.error) warn(settings.error);

  // What the next bulk index does: the artifacts it indexes — never indexed,
  // or changed since — those compact prunes below the decay floor, which it
  // skips, and the indexed identities it retires.
  let manifests = null;
  try {
    manifests = readManifests();
  } catch (err) {
    warn(err);
  }
  if (manifests) {
    let pruning = null;
    try {
      pruning = pruneTest(settings.cfg, manifests.workUnits);
    } catch (err) {
      warn(err);
    }
    const plan = planIndex(allChunks, manifests, { scope: null, pruning });
    for (const [label, rows] of [
      ['Unindexed completed artifacts', plan.fresh.map((a) => a.file)],
      ['Changed since indexing', plan.changed.map((a) => a.file)],
      ['Pruned below the decay floor', plan.pruned.map((a) => a.file)],
      ['Retired since indexing', plan.retired.map((e) => `${e.file} (${e.reason})`)],
    ]) {
      if (rows.length === 0) continue;
      out.push('', `${label}: ${rows.length}`);
      for (const row of rows) out.push(`  ${row}`);
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

  // Refuse before anything is touched when no store may be created here.
  newStoreEmbedder(cfg, provider);

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

  // Set the store aside under the lock, so a concurrent index/remove/compact
  // never writes into a half-moved one. A .bak rename rather than a delete,
  // so a bulk-index failure (network outage, provider down, Ctrl-C) can be
  // rolled back — otherwise a transient failure leaves the user with no
  // store and no metadata.
  await store.withLock(lp, async () => {
    // Clean any leftover .bak from a prior aborted rebuild.
    if (fs.existsSync(spBak)) fs.unlinkSync(spBak);
    if (fs.existsSync(mpBak)) fs.unlinkSync(mpBak);
    if (fs.existsSync(sp)) fs.renameSync(sp, spBak);
    if (fs.existsSync(mp)) fs.renameSync(mp, mpBak);
  });
  process.stdout.write('Deleted existing index.\n');

  let summary;
  try {
    // The bulk index creates the new store and fills it, taking the lock
    // itself, once, for its write — a store a concurrent writer created in
    // the meantime is loaded under that lock and filled in turn.
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

  // The rebuilt index stands — a file that failed to index, or a chunk that
  // failed to embed, is one the next start's bulk index retries — so the
  // backup goes.
  if (fs.existsSync(spBak)) fs.unlinkSync(spBak);
  if (fs.existsSync(mpBak)) fs.unlinkSync(mpBak);
  if (indexFailed(summary)) process.exitCode = 1;
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
      const db = store.loadStore(sp);
      storeMatch = store.countByFilter(db, removeFilter(options));
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
    const db = store.loadStore(sp);
    const count = store.countByFilter(db, removeFilter(options));
    process.stdout.write(`Would remove ${count} chunks for ${desc}\n`);
    return;
  }

  let removed;
  try {
    removed = await performRemoval(options);
  } catch (err) {
    process.stderr.write(`Removal of ${desc} failed: ${err.message}\nThe next start will remove them.\n`);
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
  await store.withLock(lockFilePath(), () => {
    const db = store.loadStore(sp);
    removed = store.removeByFilter(db, removeFilter(opts));
    store.saveStore(db, sp);
  });
  return removed;
}

// ---------------------------------------------------------------------------
// Compact command
// ---------------------------------------------------------------------------

async function cmdCompact(_args, options, cfg) {
  const sp = storePath();
  const lp = lockFilePath();

  // Decay is progress-based. `compact` is a pure storage backstop:
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

  const db = store.loadStore(sp);

  const chunks = store.allChunks(db);
  if (chunks.length === 0) return;

  // Group by work unit.
  const byWorkUnit = {};
  for (const chunk of chunks) {
    if (!byWorkUnit[chunk.work_unit]) byWorkUnit[chunk.work_unit] = [];
    byWorkUnit[chunk.work_unit].push(chunk);
  }

  // Evaluate each work unit against the prune floor.
  const removals = []; // { workUnit, count, phases: Set }
  const toRemoveIds = [];

  for (const [wu, unitChunks] of Object.entries(byWorkUnit)) {
    const candidates = unitChunks.filter((c) => pruning.prunes(wu, c.phase));
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
  await store.withLock(lp, () => {
    const freshDb = store.loadStore(sp);

    // Deduplicate removal keys.
    const seen = new Set();
    for (const key of toRemoveIds) {
      const k = `${key.work_unit}|${key.phase}|${key.topic}`;
      if (seen.has(k)) continue;
      seen.add(k);
      store.removeByIdentity(freshDb, key);
    }

    store.saveStore(freshDb, sp);
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
    provider = commandProvider(command, cfg);
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
  withRetry,
  isPermanentError,
  UserError,
  AuthError,
  InvalidRequestError,
  QuotaError,
  ConfigError,
  RateLimitError,
  main,
  cmdIndexBulk,
  indexSingleFile,
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
  ARTIFACT_PATHS,
  RETIRED_ITEM_STATUSES,
  buildProgressClock,
  retrievability,
  pruneTest,
  rerank,
  resolveSimilarityThreshold,
  boostProblem,
  keyUnresolvedError,
  QUERY_TIMEOUT_MS,
  QUERY_WAIT_BUDGET_MS,
  queryProvider,
  commandProvider,
  querySettings,
  queryStore,
  renderQuery,
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
