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
 * Load and merge config from system and project levels.
 *
 * @param {{ systemPath?: string, projectPath?: string }} [paths]
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

  // Resolve API key from environment.
  if (merged.api_key_env) {
    const envVal = process.env[merged.api_key_env];
    merged._api_key = envVal && envVal.trim() !== '' ? envVal : null;
  } else {
    merged._api_key = null;
  }

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

module.exports = {
  DEFAULTS,
  AVAILABLE_PROVIDERS,
  systemConfigPath,
  projectConfigPath,
  readConfigFile,
  loadConfig,
  resolveProvider,
};
