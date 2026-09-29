'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the non-interactive knowledge setup forms, dispatched by flag:
//
//   --from-system    reuse the system config: resolve the key (env →
//                    credentials.json), validate with one test embed
//                    (provider configs only), initialise the project store,
//                    bulk-index.
//   --keyword-only   project-level keyword-only init, pinned in the project
//                    config. Never touches the system config.
//   --provider ...   first-time (or replacement) system-config creation from
//                    flags, then as --from-system. The key resolves from
//                    env/credentials — never from argv.
//
// There is deliberately no --key flag on any form: argv lands in shell
// history and process listings, so keys never transit it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const config = require('../../kernel/knowledge/config.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { OpenAIProvider } = require('../../kernel/knowledge/providers/openai.cjs');
const { OpenAICompatibleProvider } = require('../../kernel/knowledge/providers/openai-compatible.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { metadataMissing } = require('./embedder.cjs');
const setup = require('./setup.cjs');

/** @typedef {import('../../kernel/call.cjs').Call} Call */
/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */
/** @typedef {import('./embedder.cjs').EmbeddingProvider} EmbeddingProvider */
/** @typedef {Record<string, string|boolean>} Flags */

/** @param {string} msg @returns {never} */
function refuse(msg) {
  throw new UserError(msg);
}

const KEY_FLAG_REFUSAL =
  '--key is not accepted: API keys must never pass through command arguments ' +
  '(argv lands in shell history and process listings). Set $OPENAI_API_KEY, or run ' +
  '`knowledge setup --key-only` to store the key at a private prompt.';

const FORM_CONFLICT_REFUSAL =
  'choose one setup form: --from-system, --keyword-only, --provider, or --key-only.';

/** @typedef {'wizard'|'from-system'|'keyword-only'|'provider'|'key-only'} SetupForm */

/**
 * The setup form the flags select. `--provider` doubles as `--key-only`'s
 * modifier (the provider the key is stored under), so it is a form of its
 * own only without --key-only.
 * @param {Flags} flags
 * @returns {{ form?: SetupForm, error?: string }}
 */
function parseSetupForm(flags) {
  if (flags.key !== undefined) return { error: KEY_FLAG_REFUSAL };
  /** @type {SetupForm[]} */
  const chosen = [];
  if (flags['from-system'] !== undefined) chosen.push('from-system');
  if (flags['keyword-only'] !== undefined) chosen.push('keyword-only');
  if (flags['key-only'] !== undefined) chosen.push('key-only');
  if (flags.provider !== undefined && flags['key-only'] === undefined) chosen.push('provider');
  if (chosen.length === 0) return { form: 'wizard' };
  if (chosen.length > 1) return { error: FORM_CONFLICT_REFUSAL };
  return { form: chosen[0] };
}

/** @param {string} root */
function requireWorkflowsDir(root) {
  if (!fs.existsSync(path.join(root, '.workflows'))) {
    refuse('no .workflows/ directory found. Initialise a workflow project first.');
  }
}

function missingOpenAiKeyMessage() {
  const envVar = config.PROVIDER_ENV_VARS.openai;
  return (
    'no OpenAI API key found.\n' +
    `  Checked $${envVar} and ${config.credentialsPath()}.\n` +
    `  Export ${envVar} in your shell, or run \`knowledge setup --key-only\` to store\n` +
    '  the key at a private prompt. Never paste the key into a chat.'
  );
}

/**
 * Refuse a system config that is present but unreadable — every knowledge
 * command merges it in — before anything is written.
 * @param {string} sysPath @param {setup.SystemConfigState} detected
 */
function refuseInvalidSystemConfig(sysPath, detected) {
  if (!detected.exists || detected.valid) return;
  refuse(
    `system config at ${sysPath} is not valid: ${detected.reason}.\n` +
    '  Re-create it with `knowledge setup --provider ...` or the interactive `knowledge setup`.'
  );
}

/**
 * The summary of the active settings — provider and model, and the base URL
 * for openai-compatible. Never the key, never internal defaults.
 * @param {{ provider?: string|null, model?: string|null, base_url?: string|null }|null} k
 * @returns {string[]}
 */
function summaryLines(k) {
  if (!k || !k.provider) {
    return [
      'Knowledge base ready — keyword-only (BM25) mode.',
      'Semantic search is disabled until an embedding provider is configured.',
      'Upgrade anytime: `knowledge setup --provider ...` or the interactive `knowledge setup`.',
    ];
  }
  const lines = ['Knowledge base ready.', `  provider: ${k.provider}`];
  if (k.model) lines.push(`  model:    ${k.model}`);
  if (k.provider === 'openai-compatible' && k.base_url) lines.push(`  base URL: ${k.base_url}`);
  return lines;
}

/**
 * Validate a provider by one test embed, said on stdout; refuse on failure.
 * @param {Call} call @param {string} name @param {EmbeddingProvider} provider @param {number} dimensions
 * @param {string} refusal  the refusal's first line
 */
async function validateOrRefuse(call, name, provider, dimensions, refusal) {
  call.out(`Validating ${name} via a test embed...\n`);
  try {
    await setup.validateProvider(provider, dimensions);
  } catch (err) {
    const { message, hint } = setup.describeValidationError(err, {});
    refuse(`${refusal}\n  ${message}\n  ${hint}`);
  }
  call.out('Embedding provider works.\n');
}

/**
 * The provider the merged config names, validated — nothing to validate for
 * a providerless (keyword-only) config. The openai key must resolve;
 * openai-compatible may go keyless, as local servers usually do.
 * @param {Call} call @param {Record<string, any>} cfg
 */
async function validateConfiguredProvider(call, cfg) {
  if (!cfg.provider) return;
  if (cfg.provider === 'openai' && !cfg._api_key) refuse(missingOpenAiKeyMessage());
  /** @type {EmbeddingProvider|null} */
  let provider = null;
  try {
    provider = config.resolveProvider(cfg);
  } catch (err) {
    refuse(`cannot use the configured provider: ${messageOf(err)}`);
  }
  if (!provider) refuse(`provider "${cfg.provider}" could not be initialised from the config.`);
  await validateOrRefuse(call, cfg.provider, provider, provider.dimensions(), 'provider validation failed.');
}

/**
 * Which of the project's knowledge files exist — refused when the store is
 * there without its metadata.
 * @param {KnowledgeFiles} files
 */
function consistentProjectInit(files) {
  if (metadataMissing(files)) {
    refuse(`project ${setup.inconsistentStoreMessage(files)}\n  Run \`knowledge rebuild\` to re-create the store with matching metadata.`);
  }
  return setup.detectProjectInit(files);
}

/**
 * The project's knowledge directory set up: missing pieces filled in,
 * existing ones kept.
 * @param {Call} call @param {KnowledgeFiles} files
 */
function initProjectStore(call, files) {
  const detected = consistentProjectInit(files);
  fs.mkdirSync(files.dir, { recursive: true });
  if (!detected.configExists) {
    config.writeConfigFile(files.config, setup.buildProjectConfigEmpty());
    call.out(`  ${path.basename(files.config)} written\n`);
  }
  if (!detected.storeExists) setup.createEmptyStore(call, files);
}

/**
 * `setup --from-system` — the project store initialised from the existing
 * system config.
 * @param {Call} call @param {string} root
 */
async function runFromSystem(call, root) {
  requireWorkflowsDir(root);
  const files = knowledgeFiles(root);
  const sysPath = config.systemConfigPath();
  const detected = setup.detectSystemConfig(sysPath);
  if (!detected.exists) {
    refuse(
      `no system config found at ${sysPath}.\n` +
      '  `knowledge setup --from-system` reuses an existing system config.\n' +
      '  Create one with `knowledge setup --provider ...`, run `knowledge setup\n' +
      '  --keyword-only` for keyword-only search, or run the interactive `knowledge setup`.'
    );
  }
  refuseInvalidSystemConfig(sysPath, detected);
  setup.stripProviderOverrides(call, files.config);

  const cfg = config.loadConfig({ projectPath: files.config });
  await validateConfiguredProvider(call, cfg);
  initProjectStore(call, files);
  await setup.runInitialIndexStep(call, root, files);
  call.out('\n' + summaryLines({
    provider: cfg.provider || null,
    model: cfg.model || null,
    base_url: cfg.base_url || null,
  }).join('\n') + '\n');
}

/**
 * `setup --keyword-only` — project-level keyword-only init. Never touches
 * the system config: the project config pins `provider: null`, whatever the
 * system layer names, so the choice travels with the project and a checkout
 * without a store rebuilds it keyword-only.
 * @param {Call} call @param {string} root
 */
async function runKeywordOnly(call, root) {
  requireWorkflowsDir(root);
  const files = knowledgeFiles(root);
  const sysPath = config.systemConfigPath();
  refuseInvalidSystemConfig(sysPath, setup.detectSystemConfig(sysPath));

  /** @type {Record<string, any>} */
  let knowledge = {};
  if (fs.existsSync(files.config)) {
    try {
      knowledge = config.readConfigFile(files.config) || {};
    } catch (err) {
      refuse(`project config at ${files.config} is invalid: ${messageOf(err)}`);
    }
  }
  knowledge.provider = null;

  consistentProjectInit(files);
  fs.mkdirSync(files.dir, { recursive: true });
  config.writeConfigFile(files.config, { knowledge });

  initProjectStore(call, files);
  await setup.runInitialIndexStep(call, root, files);
  call.out('\n' + summaryLines(null).join('\n') + '\n');
}

/**
 * `setup --provider <id> ...` — the system config written from flags (its
 * `knowledge` key rewritten whole; the file's other top-level keys kept),
 * then as --from-system. The key comes from env/credentials only.
 * @param {Call} call @param {string} root @param {Flags} flags
 */
async function runProviderForm(call, root, flags) {
  requireWorkflowsDir(root);
  const files = knowledgeFiles(root);

  const providerId = flags.provider;
  if (typeof providerId !== 'string' || providerId === '') {
    refuse('--provider requires a value: openai or openai-compatible.');
  }
  if (providerId !== 'openai' && providerId !== 'openai-compatible') {
    refuse(`unknown provider "${providerId}". Available: openai, openai-compatible.`);
  }
  const model = flags.model;
  if (typeof model !== 'string' || model === '') {
    refuse(`--provider ${providerId} requires --model (e.g. ${setup.OPENAI_DEFAULT_MODEL}).`);
  }
  /** @type {number|undefined} */
  let dimensions;
  if (flags.dimensions !== undefined) {
    if (typeof flags.dimensions !== 'string' || !/^\d+$/.test(flags.dimensions.trim()) ||
        parseInt(flags.dimensions, 10) <= 0) {
      refuse(`invalid --dimensions "${flags.dimensions}". Must be a positive integer.`);
    }
    dimensions = parseInt(flags.dimensions, 10);
  }

  /** @type {EmbeddingProvider} */
  let provider;
  /** @type {import('./setup.cjs').ConfigPayload} */
  let payload;
  const baseUrl = flags['base-url'];
  if (providerId === 'openai') {
    if (dimensions === undefined) dimensions = setup.OPENAI_DEFAULT_DIMENSIONS;
    const key = config.resolveApiKey('openai', { credentialsPath: config.credentialsPath() });
    if (!key) refuse(missingOpenAiKeyMessage());
    provider = new OpenAIProvider({ apiKey: key, model, dimensions });
    payload = setup.buildSystemConfigOpenAI({ model, dimensions });
  } else {
    if (typeof baseUrl !== 'string' || baseUrl === '') {
      refuse('--provider openai-compatible requires --base-url (e.g. http://localhost:1234/v1).');
    }
    if (dimensions === undefined) {
      refuse("--provider openai-compatible requires --dimensions — it must match the model's native output.");
    }
    // A stored credential for this provider is picked up when present;
    // keyless endpoints are fine.
    const key = config.resolveApiKey('openai-compatible', { credentialsPath: config.credentialsPath() });
    provider = new OpenAICompatibleProvider({ baseUrl, apiKey: key, model, dimensions });
    payload = setup.buildSystemConfigCompatible({ baseUrl, model, dimensions });
  }

  // Validated before anything is written: a broken provider must never land on disk.
  await validateOrRefuse(call, providerId, provider, dimensions, 'provider validation failed — system config not written.');

  const sysPath = config.systemConfigPath();
  config.writeConfigFile(sysPath, payload);
  call.out(`Wrote system config to ${sysPath}\n`);

  setup.stripProviderOverrides(call, files.config);
  initProjectStore(call, files);
  await setup.runInitialIndexStep(call, root, files);
  call.out('\n' + summaryLines({
    provider: providerId,
    model,
    base_url: providerId === 'openai-compatible' ? /** @type {string} */ (baseUrl) : null,
  }).join('\n') + '\n');
}

module.exports = {
  KEY_FLAG_REFUSAL,
  FORM_CONFLICT_REFUSAL,
  parseSetupForm,
  summaryLines,
  runFromSystem,
  runKeywordOnly,
  runProviderForm,
};
