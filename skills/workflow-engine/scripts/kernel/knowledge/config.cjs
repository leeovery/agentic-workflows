'use strict';

// ---------------------------------------------------------------------------
// Kernel: the knowledge configuration — two levels merged over the defaults,
// the provider's API key resolved, and the embedding provider it names.
//
// System config:  config.json in the workflows' system config directory
// Project config: .workflows/.knowledge/config.json
//
// Both wrap knowledge settings under a top-level "knowledge" key. Project
// overrides system; missing fields fall through; absent files are fine. An
// unknown key, or a tuning value its use cannot take, is ignored and named;
// the provider settings are read as written.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const { systemConfigDir } = require('../system-config.cjs');
const { ENGINE_COMMAND } = require('../call.cjs');
const { StubProvider } = require('./embeddings.cjs');
const { OpenAIProvider } = require('./providers/openai.cjs');
const { OpenAICompatibleProvider } = require('./providers/openai-compatible.cjs');

// Default values for all config fields.
const DEFAULTS = {
  // Minimum cosine similarity for a vector hit to count. Its one job is to
  // return nothing when nothing is relevant, so it sits low: too low and an
  // off-topic query returns a few noise chunks; too high and the vector leg
  // of every hybrid query comes back empty — silently keyword-only. Measured
  // on OpenAI text-embedding-3-small: noise peaks ≈0.2, relevance ≥0.5.
  similarity_threshold: 0.3,
  // Base stability S0 for the progress-decay curve R = 0.9^(progressElapsed/S),
  // in "feature-equivalents" (see decay_weights). Higher = slower decay;
  // half-life ≈ 6.6 × S0. Weighting inflates progressElapsed for epic-heavy
  // work, so S0 sits high enough to keep the curve gentle: one 4-topic epic
  // ≈ 0.92, three ≈ 0.78.
  decay_base_stability: 5,
  // Storage backstop: `compact` prunes a unit's non-spec chunks once their
  // retrievability R falls below this floor (i.e. already unreachable in
  // ranking). false disables pruning.
  decay_prune_below: 0.05,
  // Significance weighting for the progress clock. progressElapsed sums
  // topics(V) × weight[work_type(V)] over later units, so a quick-fix advances
  // the clock less than a feature and an epic (multi-topic) advances it more.
  // S0/prune are thus measured in "feature-equivalents". Tunable; missing keys
  // fall back to 1.0. cross-cutting = 0: it's terminal (stops at spec, never
  // implemented), so it doesn't move the codebase forward and shouldn't age
  // anything.
  decay_weights: {
    'quick-fix': 0.25,
    'bugfix': 0.5,
    'feature': 1.0,
    'cross-cutting': 0,
    'epic': 1.0,
  },
};

/**
 * @typedef {object} TuningRule  the values a tuning key's use can take
 * @property {string} expected  what a valid value is, as a warning words it
 * @property {(value: unknown) => boolean} valid
 */

/** @param {unknown} value @returns {value is number} */
function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** @param {unknown} value */
function isFraction(value) {
  return isNumber(value) && value >= 0 && value <= 1;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @type {Record<keyof typeof DEFAULTS, TuningRule>} */
const TUNING = {
  similarity_threshold: { expected: 'a number from 0 to 1', valid: isFraction },
  decay_base_stability: { expected: 'a number above 0', valid: (value) => isNumber(value) && value > 0 },
  decay_prune_below: { expected: 'false or a number from 0 to 1', valid: (value) => value === false || isFraction(value) },
  decay_weights: {
    expected: 'an object giving work types numbers of 0 or more',
    valid: (value) => isRecord(value) && Object.values(value).every((weight) => isNumber(weight) && weight >= 0),
  },
};

// The settings that name the embedding provider — what setup writes, and
// what decides the vectors a store holds.
const PROVIDER_FIELDS = ['provider', 'model', 'dimensions', 'base_url'];

// Known providers that have implementations in this codebase.
const AVAILABLE_PROVIDERS = ['stub', 'openai', 'openai-compatible'];

// Hardcoded env var per provider. The env var wins over credentials.json —
// power users and CI can override the stored key without editing files.
// No env var for openai-compatible: its key (if any) lives only in stored
// credentials and is optional, so there is nothing to override.
const PROVIDER_ENV_VARS = {
  openai: 'OPENAI_API_KEY',
};

/** @returns {string} */
function systemConfigPath() {
  return path.join(systemConfigDir(), 'config.json');
}

/**
 * The project root a knowledge command acts on: the nearest directory at or
 * above `startFrom` holding a `.workflows/` directory — `startFrom` itself
 * when none does, so a caller can surface its own not-initialised error.
 * @param {string} startFrom
 * @returns {string}
 */
function findProjectRoot(startFrom) {
  let dir = path.resolve(startFrom);
  const fallback = dir;
  while (true) {
    if (fs.existsSync(path.join(dir, '.workflows'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return fallback;
    dir = parent;
  }
}

/**
 * Resolve the credentials file path. Sits alongside system config.
 * @returns {string}
 */
function credentialsPath() {
  return path.join(systemConfigDir(), 'credentials.json');
}

/** A config file that does not read, with why in words that quote nothing from it. */
class ConfigFileError extends Error {
  /** @param {string} message @param {string} reason */
  constructor(message, reason) {
    super(message);
    this.name = 'ConfigFileError';
    this.reason = reason;
  }
}

/**
 * Read a single config file and return the unwrapped `knowledge` object.
 * Returns null if the file does not exist. A file without a `knowledge` key
 * throws by default — the project config is knowledge-owned, so a missing
 * wrapper there is corruption worth diagnosing. Pass `sharedFile: true` for
 * the system config, which other tools' settings share: there a
 * knowledge-less file simply means no knowledge settings, and reads null.
 * Throws on invalid JSON or a malformed `knowledge` value either way.
 *
 * @param {string} filePath
 * @param {{ sharedFile?: boolean }} [opts]
 * @returns {Record<string, any>|null}
 */
function readConfigFile(filePath, opts) {
  if (!fs.existsSync(filePath)) return null;

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new ConfigFileError(`Failed to read config file at ${filePath}: ${e.message}`, 'not readable');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ConfigFileError(`Invalid JSON in config file at ${filePath}: ${e.message}`, 'not valid JSON');
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ConfigFileError(
      `Config file at ${filePath} must be a JSON object. ` +
        'Expected format: { "knowledge": { ... } }',
      'not a JSON object'
    );
  }

  if (parsed.knowledge === undefined) {
    if (opts && opts.sharedFile) return null;
    throw new ConfigFileError(
      `Config file at ${filePath} is missing the required top-level "knowledge" key. ` +
        'Expected format: { "knowledge": { ... } }',
      'missing "knowledge" key'
    );
  }

  if (parsed.knowledge == null || typeof parsed.knowledge !== 'object' || Array.isArray(parsed.knowledge)) {
    throw new ConfigFileError(
      `Config file at ${filePath}: the "knowledge" key must be an object.`,
      'invalid "knowledge" key'
    );
  }

  return parsed.knowledge;
}

/**
 * Read the credentials file and return the unwrapped `credentials` object.
 * Returns null if the file does not exist. Throws on invalid JSON or a
 * missing `credentials` wrapper so the caller can surface the error
 * rather than silently ignoring a broken file.
 *
 * @param {string} filePath
 * @returns {Record<string, any>|null}
 */
function loadCredentials(filePath) {
  if (!fs.existsSync(filePath)) return null;

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new Error(`Failed to read credentials file at ${filePath}: ${e.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in credentials file at ${filePath}: ${e.message}`);
  }

  if (parsed == null || typeof parsed !== 'object' || !parsed.credentials ||
      typeof parsed.credentials !== 'object' || Array.isArray(parsed.credentials)) {
    throw new Error(
      `Credentials file at ${filePath} is missing the required top-level "credentials" object. ` +
      'Expected format: { "credentials": { "<provider>": { "api_key": "..." } } }'
    );
  }

  return parsed.credentials;
}

/**
 * Atomically write the credentials file with mode 0600 (user-private).
 * Merges with existing credentials so writing openai does not clobber
 * other providers. Use null apiKey to delete a provider's entry.
 *
 * @param {string} filePath
 * @param {string} provider  e.g. 'openai'
 * @param {string|null} apiKey  null removes the entry
 */
function writeCredentials(filePath, provider, apiKey) {
  if (!filePath) throw new Error('writeCredentials: filePath is required');
  if (!provider || typeof provider !== 'string') {
    throw new Error('writeCredentials: provider name is required');
  }

  let existing = {};
  if (fs.existsSync(filePath)) {
    try {
      existing = loadCredentials(filePath) || {};
    } catch (_) {
      // Corrupt file — overwrite with a fresh structure rather than
      // propagating the read error, since the caller is committing to a
      // write.
      existing = {};
    }
  }

  const credentials = Object.assign({}, existing);
  if (apiKey === null || apiKey === undefined) {
    delete credentials[provider];
  } else {
    credentials[provider] = Object.assign({}, credentials[provider] || {}, { api_key: apiKey });
  }

  const payload = { credentials };

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmp = filePath + '.tmp';
  // Open with mode 0600 so the file is user-private from the first byte
  // written — close/rename sequence keeps that mode.
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeSync(fd, JSON.stringify(payload, null, 2) + '\n');
  } finally {
    fs.closeSync(fd);
  }
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, filePath);
  // Rename preserves permissions, but chmod again defensively on the
  // final path for systems where rename semantics differ.
  try { fs.chmodSync(filePath, 0o600); } catch (_) { /* best effort */ }
}

/**
 * Resolve the API key for a provider. Env var takes precedence over the
 * credentials file. Returns null if neither source provides a non-empty
 * value.
 *
 * @param {string} provider
 * @param {{ credentialsPath?: string }} [opts]
 * @returns {string|null}
 */
function resolveApiKey(provider, opts) {
  if (!provider) return null;

  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar) {
    const envVal = process.env[envVar];
    if (envVal && envVal.trim() !== '') return envVal;
  }

  const credPath = (opts && opts.credentialsPath) || credentialsPath();
  let creds;
  try {
    creds = loadCredentials(credPath);
  } catch (_) {
    // Bad credentials file — treat as missing for resolution.
    return null;
  }

  if (creds && creds[provider] && typeof creds[provider].api_key === 'string') {
    const k = creds[provider].api_key.trim();
    if (k !== '') return k;
  }

  return null;
}

/**
 * @typedef {object} ConfigPaths
 * @property {string} projectPath
 * @property {string} [systemPath]  the system config — by default, the one in the system config directory
 * @property {string} [credentialsPath]  by default, the one beside the system config
 */

/**
 * Why loading ignores a key of a config file's knowledge settings, or null
 * when it reads it: a provider setting is read as written — a wrong one
 * refuses where it is used — a tuning key when its value is one its use can
 * take, or null, and any other key never.
 * @param {string} key @param {unknown} value
 * @returns {string|null}
 */
function ignoredBecause(key, value) {
  if (PROVIDER_FIELDS.includes(key)) return null;
  if (!Object.hasOwn(TUNING, key)) return 'not a knowledge setting';
  const rule = /** @type {Record<string, TuningRule>} */ (TUNING)[key];
  return value === null || rule.valid(value) ? null : `${JSON.stringify(value)} is not ${rule.expected}`;
}

/**
 * Load and merge config from the system and project levels over the
 * defaults. `null` at either level unsets a key, so a project config can
 * clear a system setting — the provider included. A key loading ignores
 * leaves the level beneath it in force, and is named in `_ignored`.
 * @param {ConfigPaths} paths
 * @returns {Record<string, any>} the merged config, the resolved key as `_api_key`, and a line per ignored key as `_ignored`
 */
function loadConfig(paths) {
  const systemPath = paths.systemPath || systemConfigPath();
  const levels = [
    { file: systemPath, settings: readConfigFile(systemPath, { sharedFile: true }) },
    { file: paths.projectPath, settings: readConfigFile(paths.projectPath) },
  ];

  /** @type {Record<string, any>} */
  const merged = Object.assign({}, DEFAULTS);
  /** @type {string[]} */
  const ignored = [];
  for (const { file, settings } of levels) {
    for (const [key, value] of Object.entries(settings || {})) {
      const because = ignoredBecause(key, value);
      if (because) ignored.push(`${key} in ${file} is ignored: ${because}`);
      else if (value === null) delete merged[key];
      else merged[key] = value;
    }
  }

  merged._api_key = resolveApiKey(merged.provider, { credentialsPath: paths.credentialsPath });
  merged._ignored = ignored;
  return merged;
}

/**
 * Instantiate an embedding provider based on the merged config.
 *
 * Returns:
 *   - StubProvider instance when config.provider === 'stub'
 *   - null when no provider is configured, or openai's key does not resolve
 *     (keyword-only mode)
 *   - Throws for unimplemented provider names, and for openai-compatible
 *     without a base_url
 *
 * @param {Record<string, any>} config  Merged config from loadConfig()
 * @param {import('./providers/openai-engine.cjs').Patience} [patience]  how long an endpoint provider waits on its endpoint
 * @returns {import('./embeddings.cjs').EmbeddingProvider|null}  Provider instance or null (keyword-only mode)
 */
function resolveProvider(config, patience = {}) {
  if (!config || typeof config !== 'object') {
    throw new Error('resolveProvider: config is required');
  }

  const providerName = config.provider;

  // No provider configured — keyword-only mode.
  if (!providerName) {
    return null;
  }

  // Stub provider — test path. Does not need an API key.
  if (providerName === 'stub') {
    const dims = config.dimensions || undefined;
    return new StubProvider(dims != null ? { dimensions: dims } : undefined);
  }

  // Named provider but not yet implemented.
  if (!AVAILABLE_PROVIDERS.includes(providerName)) {
    throw new Error(
      `Provider "${providerName}" is not available. Available providers: ${AVAILABLE_PROVIDERS.join(', ')}`
    );
  }

  // OpenAI cloud provider — requires a key. Missing key → null (the caller
  // degrades to keyword-only). This null is intentionally indistinguishable
  // here from "no provider configured"; the two are told apart at the call
  // sites via cfg.provider (see providerKeyUnresolved in
  // domain/knowledge/embedder.cjs) so a missing key surfaces "set your key",
  // not the store-destroying "provider changed — rebuild". Do NOT throw here:
  // many callers (setup, status) rely on null meaning "run keyword-only".
  if (providerName === 'openai') {
    if (!config._api_key) {
      return null;
    }
    return new OpenAIProvider({
      apiKey: config._api_key,
      model: config.model || undefined,
      dimensions: config.dimensions || undefined,
      ...patience,
    });
  }

  // OpenAI-compatible provider — key is OPTIONAL (local servers usually need
  // none), but base_url is REQUIRED. A missing base_url is a misconfiguration,
  // not a reason to silently degrade to keyword-only — throw a clear error.
  if (providerName === 'openai-compatible') {
    if (!config.base_url) {
      throw new Error(
        'Provider "openai-compatible" requires a "base_url" (e.g. http://localhost:1234/v1). ' +
        `Add it to your config or re-run \`${ENGINE_COMMAND} knowledge setup\`.`
      );
    }
    return new OpenAICompatibleProvider({
      baseUrl: config.base_url,
      apiKey: config._api_key || null,
      model: config.model || undefined,
      dimensions: config.dimensions || undefined,
      ...patience,
    });
  }

  return null;
}

/**
 * The parsed JSON object at a path — empty where there is no file, or where
 * it does not parse to an object: the caller is committing to a write, and
 * replaces it.
 * @param {string} filePath @returns {Record<string, unknown>}
 */
function readWritableObject(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isRecord(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * Atomically write a config file's provider settings — the payload's
 * `knowledge` object, as setup builds it. They replace the provider fields
 * the file holds as a set; every other key of its `knowledge` object, and
 * every other top-level key (another subsystem's), stays as the file has
 * it. Writes to `<path>.tmp` then renames — matches the
 * manifest/store convention so a crash mid-write never leaves a truncated
 * JSON file.
 *
 * @param {string} filePath  Absolute path to write
 * @param {{knowledge: Record<string, unknown>}} payload  the provider settings under the `knowledge` wrapper
 */
function writeConfigFile(filePath, payload) {
  if (!filePath) throw new Error('writeConfigFile: filePath is required');
  if (payload == null || typeof payload !== 'object' || !payload.knowledge) {
    throw new Error('writeConfigFile: payload must be an object with a top-level "knowledge" key');
  }

  const existing = readWritableObject(filePath);
  const kept = Object.entries(isRecord(existing.knowledge) ? existing.knowledge : {}).filter(([key]) => !PROVIDER_FIELDS.includes(key));
  const full = { ...existing, knowledge: { ...payload.knowledge, ...Object.fromEntries(kept) } };

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(full, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

module.exports = {
  DEFAULTS,
  PROVIDER_FIELDS,
  AVAILABLE_PROVIDERS,
  PROVIDER_ENV_VARS,
  systemConfigPath,
  findProjectRoot,
  credentialsPath,
  ConfigFileError,
  readConfigFile,
  loadConfig,
  loadCredentials,
  writeCredentials,
  resolveApiKey,
  resolveProvider,
  writeConfigFile,
};
