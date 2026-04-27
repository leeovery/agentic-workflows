// Knowledge base configuration — two-level config resolution and provider
// instantiation.
//
// System config:  ~/.config/workflows/config.json
// Project config: .workflows/.knowledge/config.json
//
// Both wrap knowledge settings under a top-level "knowledge" key. Project
// overrides system; missing fields fall through; absent files are fine.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { StubProvider } = require('./embeddings');
const { OpenAIProvider } = require('./providers/openai');

// Default values for all config fields.
const DEFAULTS = {
  similarity_threshold: 0.8,
  decay_months: 6,
};

// Known providers that have implementations in this codebase.
const AVAILABLE_PROVIDERS = ['stub', 'openai'];

// Hardcoded env var per provider. The env var wins over credentials.json —
// power users and CI can override the stored key without editing files.
const PROVIDER_ENV_VARS = {
  openai: 'OPENAI_API_KEY',
};

/**
 * Resolve the system config path.
 * @returns {string}
 */
function systemConfigPath() {
  return path.join(os.homedir(), '.config', 'workflows', 'config.json');
}

/**
 * Resolve the project config path relative to CWD.
 * @param {string} [cwd]
 * @returns {string}
 */
function projectConfigPath(cwd) {
  return path.join(cwd || process.cwd(), '.workflows', '.knowledge', 'config.json');
}

/**
 * Resolve the credentials file path. Sits alongside system config.
 * @returns {string}
 */
function credentialsPath() {
  return path.join(os.homedir(), '.config', 'workflows', 'credentials.json');
}

/**
 * Read a single config file and return the unwrapped `knowledge` object.
 * Returns null if the file does not exist.
 * Throws on invalid JSON or missing `knowledge` wrapper.
 *
 * @param {string} filePath
 * @returns {object|null}
 */
function readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new Error(`Failed to read config file at ${filePath}: ${e.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in config file at ${filePath}: ${e.message}`);
  }

  if (parsed == null || typeof parsed !== 'object' || !parsed.knowledge) {
    throw new Error(
      `Config file at ${filePath} is missing the required top-level "knowledge" key. ` +
        'Expected format: { "knowledge": { ... } }'
    );
  }

  if (typeof parsed.knowledge !== 'object' || Array.isArray(parsed.knowledge)) {
    throw new Error(
      `Config file at ${filePath}: the "knowledge" key must be an object.`
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
 * @returns {object|null}
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
    // Bad credentials file — treat as missing for resolution. A future
    // `knowledge doctor` command could surface the error to the user.
    return null;
  }

  if (creds && creds[provider] && typeof creds[provider].api_key === 'string') {
    const k = creds[provider].api_key.trim();
    if (k !== '') return k;
  }

  return null;
}

/**
 * Load and merge config from system and project levels.
 *
 * @param {{ systemPath?: string, projectPath?: string, credentialsPath?: string }} [paths]
 *   Override default paths (for testing).
 * @returns {object} Merged config with defaults applied.
 */
function loadConfig(paths) {
  const sysPath = (paths && paths.systemPath) || systemConfigPath();
  const projPath = (paths && paths.projectPath) || projectConfigPath();

  const system = readConfigFile(sysPath);
  const project = readConfigFile(projPath);

  // Merge: defaults <- system <- project. Shallow merge — all fields are
  // scalars, no nested objects to worry about.
  const merged = Object.assign({}, DEFAULTS);
  if (system) {
    for (const key of Object.keys(system)) {
      if (system[key] !== undefined) merged[key] = system[key];
    }
  }
  if (project) {
    for (const key of Object.keys(project)) {
      if (project[key] !== undefined) merged[key] = project[key];
    }
  }

  // Resolve API key via env-then-credentials-file precedence.
  merged._api_key = resolveApiKey(
    merged.provider,
    { credentialsPath: paths && paths.credentialsPath }
  );

  return merged;
}

/**
 * Instantiate an embedding provider based on the merged config.
 *
 * Returns:
 *   - StubProvider instance when config.provider === 'stub'
 *   - null when no provider is configured OR api_key_env resolves to empty
 *     (keyword-only mode)
 *   - Throws for unimplemented provider names
 *
 * @param {object} config  Merged config from loadConfig()
 * @returns {object|null}  Provider instance or null (keyword-only mode)
 */
function resolveProvider(config) {
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

  // Provider is known but the API key is missing — keyword-only mode.
  if (!config._api_key) {
    return null;
  }

  // OpenAI provider.
  if (providerName === 'openai') {
    return new OpenAIProvider({
      apiKey: config._api_key,
      model: config.model || undefined,
      dimensions: config.dimensions || undefined,
    });
  }

  return null;
}

/**
 * Atomically write a config file. The payload is the full object as it
 * should appear on disk (including the top-level `knowledge` wrapper).
 * Writes to `<path>.tmp` then renames — matches the manifest/store
 * convention so a crash mid-write never leaves a truncated JSON file.
 *
 * @param {string} filePath  Absolute path to write
 * @param {object} payload   Full JSON object (must include `knowledge` key)
 */
function writeConfigFile(filePath, payload) {
  if (!filePath) throw new Error('writeConfigFile: filePath is required');
  if (payload == null || typeof payload !== 'object' || !payload.knowledge) {
    throw new Error('writeConfigFile: payload must be an object with a top-level "knowledge" key');
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

module.exports = {
  DEFAULTS,
  AVAILABLE_PROVIDERS,
  PROVIDER_ENV_VARS,
  systemConfigPath,
  projectConfigPath,
  credentialsPath,
  readConfigFile,
  loadConfig,
  loadCredentials,
  writeCredentials,
  resolveApiKey,
  resolveProvider,
  writeConfigFile,
};
