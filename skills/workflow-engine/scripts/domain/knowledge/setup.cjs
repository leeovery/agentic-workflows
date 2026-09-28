'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what every knowledge setup form shares — the system config's
// shape and state, the project's knowledge directory and the store created
// there, the provider validated by one test embed, and the initial index.
// The non-interactive forms are setup-forms.cjs's; the terminal's are
// setup-wizard.cjs's.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const config = require('../../kernel/knowledge/config.cjs');
const { QuotaError } = require('../../kernel/knowledge/providers/openai-engine.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');
const { loadSettings } = require('./embedder.cjs');
const { createStore } = require('./indexing.cjs');
const { indexBulk } = require('./bulk.cjs');

/** @typedef {import('../../kernel/call.cjs').Call} Call */
/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */
/** @typedef {import('./embedder.cjs').EmbeddingProvider} EmbeddingProvider */

const OPENAI_DEFAULT_MODEL = 'text-embedding-3-small';
const OPENAI_DEFAULT_DIMENSIONS = 1536;


// ---------------------------------------------------------------------------
// The system config's shape — provider identity alone, never a tuning
// default: a default written here would freeze at the value of the day setup
// ran, where DEFAULTS apply at load time.
// ---------------------------------------------------------------------------

/** @param {Record<string, unknown>} fields */
function buildSystemConfig(fields) {
  return { knowledge: { ...fields } };
}

/** @param {{model: string, dimensions: number}} settings */
function buildSystemConfigOpenAI({ model, dimensions }) {
  return buildSystemConfig({ provider: 'openai', model, dimensions });
}

/** @param {{baseUrl: string, model: string, dimensions: number}} settings */
function buildSystemConfigCompatible({ baseUrl, model, dimensions }) {
  return buildSystemConfig({ provider: 'openai-compatible', base_url: baseUrl, model, dimensions });
}

function buildSystemConfigStub() {
  return { knowledge: {} };
}

function buildProjectConfigEmpty() {
  return { knowledge: {} };
}

/**
 * @typedef {object} SystemConfigState
 * @property {boolean} exists  a file holding knowledge settings
 * @property {boolean} valid
 * @property {Record<string, any>|null} knowledge
 * @property {string} [reason]  why it is not valid
 */

/**
 * The system config's knowledge settings. A file without a knowledge key —
 * the file is shared with other subsystems — holds none, the same as no file.
 * @param {string} sysPath
 * @returns {SystemConfigState}
 */
function detectSystemConfig(sysPath) {
  try {
    const knowledge = config.readConfigFile(sysPath, { sharedFile: true });
    return knowledge ? { exists: true, valid: true, knowledge } : { exists: false, valid: false, knowledge: null };
  } catch (err) {
    // Never the error's message: a parse error quotes the untrusted file.
    return { exists: true, valid: false, knowledge: null, reason: err instanceof config.ConfigFileError ? err.reason : 'not readable' };
  }
}

/**
 * Which of a project's knowledge files exist.
 * @param {KnowledgeFiles} files
 */
function detectProjectInit(files) {
  const dirExists = fs.existsSync(files.dir);
  const configExists = fs.existsSync(files.config);
  const storeExists = fs.existsSync(files.store);
  const metadataExists = fs.existsSync(files.metadata);
  return {
    dirExists,
    configExists,
    storeExists,
    fullyInitialised: configExists && storeExists && metadataExists,
    partiallyInitialised: dirExists && !(configExists && storeExists && metadataExists),
  };
}

/**
 * What is wrong with a store without its metadata — fresh metadata against
 * it would hide a provider or dimensions mismatch, so rebuild is the way out.
 * @param {KnowledgeFiles} files
 */
function inconsistentStoreMessage(files) {
  return `knowledge base at ${files.dir} is in an inconsistent state:\n` +
    `  ${path.basename(files.store)} is present but ${path.basename(files.metadata)} is missing.`;
}

/**
 * An empty store and the metadata naming the embedder the project's config
 * builds it with, each file said once written.
 * @param {Call} call @param {KnowledgeFiles} files
 */
function createEmptyStore(call, files) {
  const { cfg, provider } = loadSettings(files);
  createStore(files, cfg, provider);
  call.out(`  ${path.basename(files.store)} written\n`);
  call.out(`  ${path.basename(files.metadata)} written\n`);
}

/**
 * Drop the provider-selection overrides (provider, model, dimensions,
 * base_url) from an existing project config, so the project inherits the
 * system settings.
 * @param {Call} call @param {string} projectConfigFile
 */
function stripProviderOverrides(call, projectConfigFile) {
  if (!fs.existsSync(projectConfigFile)) return;
  let knowledge;
  try {
    knowledge = config.readConfigFile(projectConfigFile) || {};
  } catch (err) {
    throw new UserError(`project config at ${projectConfigFile} is invalid: ${messageOf(err)}`);
  }
  const overrides = ['provider', 'model', 'dimensions', 'base_url'].filter((f) => f in knowledge);
  if (overrides.length === 0) return;
  for (const f of overrides) delete knowledge[f];
  config.writeConfigFile(projectConfigFile, { knowledge });
  call.out(`Project config overrode ${overrides.join(', ')} — reset to inherit the system settings.\n`);
}

// ---------------------------------------------------------------------------
// Validation — one test embed proves the key and the dimensions
// ---------------------------------------------------------------------------

/**
 * @param {EmbeddingProvider} provider @param {number} dimensions
 */
async function validateProvider(provider, dimensions) {
  const vec = await /** @type {(text: string) => number[]|Promise<number[]>} */ (provider.embed)('knowledge base setup test');
  if (!Array.isArray(vec) || vec.length !== dimensions) {
    throw new Error(
      `Expected a vector of length ${dimensions}, got ${Array.isArray(vec) ? vec.length : typeof vec}. ` +
      'The configured dimensions must match the model native output.'
    );
  }
  return true;
}

/**
 * @typedef {object} Remedies  a provider's own remedy text, by case
 * @property {string} [quota]
 * @property {string} [auth]
 * @property {string} [permission]
 * @property {string} [rateLimit]
 * @property {string} [network]
 * @property {string} [connRefused]
 * @property {string} [server5xx]
 * @property {string} [unknown]
 */

/**
 * A validation failure described, and the hint that fixes it — each
 * provider's own remedy where it gives one.
 * @param {unknown} err @param {Remedies} [remedies]
 * @returns {{message: string, hint: string}}
 */
function describeValidationError(err, remedies = {}) {
  const msg = (err instanceof Error && err.message) || String(err);

  if (err instanceof QuotaError) {
    return {
      message: 'The account is out of quota (HTTP 429).',
      hint: remedies.quota || "No wait restores it — add credit or raise the plan's usage limit, then retry.",
    };
  }
  // Before the generic network case: "server not running" is the sharper remedy.
  if (/ECONNREFUSED/.test(msg)) {
    return {
      message: 'Could not connect to the embeddings endpoint (connection refused).',
      hint: remedies.connRefused ||
        'The server may not be running, or the base URL host/port is wrong. Start it and retry.',
    };
  }
  if (/401/.test(msg) || /invalid or expired/i.test(msg) || /rejected \(HTTP 401\)/.test(msg)) {
    return {
      message: 'The request was rejected (HTTP 401).',
      hint: remedies.auth || 'Check that the API key is active and not revoked.',
    };
  }
  if (/403/.test(msg) || /permission/i.test(msg)) {
    return {
      message: 'The request lacks permission (HTTP 403).',
      hint: remedies.permission || 'Check the API key has embeddings access.',
    };
  }
  if (/429/.test(msg) || /rate limit/i.test(msg)) {
    return {
      message: 'Rate limit hit during validation (HTTP 429).',
      hint: remedies.rateLimit ||
        "The limit held through setup's own waits — try again later, or check your plan's rate limits.",
    };
  }
  if (/network error/i.test(msg) || /ENOTFOUND/.test(msg) || /ECONN/.test(msg) || /ETIMEDOUT/.test(msg)) {
    return {
      message: 'Could not reach the embeddings endpoint (network error).',
      hint: remedies.network ||
        'Check your connection, VPN, or proxy. No key was written — re-run `knowledge setup` once stable.',
    };
  }
  if (/HTTP 5\d\d/.test(msg)) {
    return {
      message: 'The server returned an error during validation.',
      hint: remedies.server5xx || 'Likely transient. Retry in a minute.',
    };
  }
  return {
    message: 'Validation failed.',
    hint: remedies.unknown || `Error detail: ${msg}`,
  };
}

// ---------------------------------------------------------------------------
// The initial index
// ---------------------------------------------------------------------------

/**
 * The bulk index every setup form ends with. Its failures never fail setup:
 * the project is set up, and the index at every start retries what fell short.
 * @param {Call} call @param {string} root @param {KnowledgeFiles} files
 */
async function runInitialIndexStep(call, root, files) {
  call.out('\nInitial indexing\n');
  call.out('----------------\n');
  try {
    const summary = await indexBulk(call, root, loadSettings(files));
    if (summary.failed > 0) {
      call.err(`\n${summary.failed} artifact(s) failed to index — the next start retries them.\n`);
    }
    if (summary.awaiting > 0) {
      call.err(`\n${summary.awaiting} chunk(s) await vectors — searchable by keyword; each start retries them.\n`);
    }
  } catch (err) {
    call.err(
      `\nInitial indexing hit an error: ${messageOf(err)}\n` +
      'The project is initialised; the next start retries the indexing.\n'
    );
  }
}

module.exports = {
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_DIMENSIONS,
  buildSystemConfig,
  buildSystemConfigOpenAI,
  buildSystemConfigCompatible,
  buildSystemConfigStub,
  buildProjectConfigEmpty,
  detectSystemConfig,
  detectProjectInit,
  inconsistentStoreMessage,
  createEmptyStore,
  stripProviderOverrides,
  validateProvider,
  describeValidationError,
  runInitialIndexStep,
};
