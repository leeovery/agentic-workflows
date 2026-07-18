// Non-interactive knowledge-base setup forms.
//
// Sits beside the interactive wizard (setup.js) and shares its building
// blocks. Four forms, dispatched from the CLI's `setup` command by flag:
//
//   --from-system    reuse the system config at ~/.config/workflows/
//                    config.json: resolve the key (env → credentials.json),
//                    validate with one test embed (provider configs only),
//                    initialise the project store, bulk-index.
//   --keyword-only   project-level keyword-only init. Never touches the
//                    system config.
//   --provider ...   first-time (or replacement) system-config creation
//                    from flags, then proceeds as --from-system. The key is
//                    resolved from env/credentials — never from argv.
//   --key-only       interactive masked prompt for the API key ALONE;
//                    writes credentials.json (mode 0600) and exits.
//
// There is deliberately NO --key flag on any form: argv lands in shell
// history and process listings, so keys never transit it. Refusals throw
// SetupRefusal — the dispatcher prints the message alone (no stack) and
// exits 1.

'use strict';

const fs = require('fs');
const path = require('path');

const config = require('./config');
const store = require('./store');
const setup = require('./setup');
const { OpenAIProvider } = require('./providers/openai');
const { OpenAICompatibleProvider } = require('./providers/openai-compatible');

// Marker class for user-facing refusals: message-only output, exit 1.
class SetupRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'SetupRefusal';
  }
}

/** @param {string} msg @returns {never} */
function refuse(msg) {
  throw new SetupRefusal(msg);
}

const KEY_FLAG_REFUSAL =
  '--key is not accepted: API keys must never pass through command arguments ' +
  '(argv lands in shell history and process listings). Set $OPENAI_API_KEY, or run ' +
  '`knowledge setup --key-only` to store the key at a private prompt.';

const FORM_CONFLICT_REFUSAL =
  'choose one setup form: --from-system, --keyword-only, --provider, or --key-only.';

// ---------------------------------------------------------------------------
// Form selection — pure, unit-testable
// ---------------------------------------------------------------------------

/**
 * Decide which setup form the flags select. `--provider` doubles as a
 * modifier of `--key-only` (which provider the key is stored under), so it
 * only counts as its own form when --key-only is absent.
 *
 * @param {Record<string, string|boolean>} flags
 * @returns {{ form?: 'wizard'|'from-system'|'keyword-only'|'provider'|'key-only', error?: string }}
 */
function parseSetupForm(flags) {
  if (flags.key !== undefined) return { error: KEY_FLAG_REFUSAL };
  const chosen = [];
  if (flags['from-system'] !== undefined) chosen.push('from-system');
  if (flags['keyword-only'] !== undefined) chosen.push('keyword-only');
  if (flags['key-only'] !== undefined) chosen.push('key-only');
  if (flags.provider !== undefined && flags['key-only'] === undefined) chosen.push('provider');
  if (chosen.length === 0) return { form: 'wizard' };
  if (chosen.length > 1) return { error: FORM_CONFLICT_REFUSAL };
  return { form: /** @type {any} */ (chosen[0]) };
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function requireWorkflowsDir() {
  const workflowsDir = path.resolve(config.findProjectRoot(), '.workflows');
  if (!fs.existsSync(workflowsDir)) {
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
 * Summary of the ACTIVE settings only — provider and model (plus the base
 * URL for openai-compatible). Never the key, never internal defaults.
 * @param {{ provider?: string|null, model?: string|null, base_url?: string|null }} k
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
 * Drop provider-selection overrides (provider, model, dimensions, base_url)
 * from an existing project config so the project genuinely inherits the
 * system settings. No-op when the file is absent or carries no overrides.
 * @param {string} projectConfigFile
 */
function stripProviderOverrides(projectConfigFile) {
  if (!fs.existsSync(projectConfigFile)) return;
  let knowledge;
  try {
    knowledge = config.readConfigFile(projectConfigFile) || {};
  } catch (err) {
    refuse(`project config at ${projectConfigFile} is invalid: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  const overrides = ['provider', 'model', 'dimensions', 'base_url'].filter((f) => f in knowledge);
  if (overrides.length === 0) return;
  for (const f of overrides) delete knowledge[f];
  config.writeConfigFile(projectConfigFile, { knowledge });
  process.stdout.write(
    `Project config overrode ${overrides.join(', ')} — reset to inherit the system settings.\n`
  );
}

/**
 * Resolve and validate the provider named by the merged config. Refuses when
 * the openai key is unresolvable (env → credentials); openai-compatible is
 * allowed keyless (local servers usually need none — the stored credential is
 * picked up when present). Runs one test embed for provider configs; a
 * providerless (keyword-only) config validates nothing and returns null.
 *
 * @param {object} cfg merged config from config.loadConfig()
 * @returns {Promise<object|null>} validated provider instance, or null
 */
async function resolveValidatedProvider(cfg) {
  if (!cfg.provider) return null;
  if (cfg.provider === 'openai' && !cfg._api_key) refuse(missingOpenAiKeyMessage());

  let provider;
  try {
    provider = config.resolveProvider(cfg);
  } catch (err) {
    refuse(`cannot use the configured provider: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!provider) {
    // Defensive — the openai keyless case is refused above and the other
    // providers construct without a key.
    refuse(`provider "${cfg.provider}" could not be initialised from the config.`);
  }

  process.stdout.write(`Validating ${cfg.provider} via a test embed...\n`);
  try {
    await setup.validateProvider(provider, provider.dimensions());
  } catch (err) {
    const { message, hint } = setup.describeValidationError(err, {});
    refuse(`provider validation failed.\n  ${message}\n  ${hint}`);
  }
  process.stdout.write('Embedding provider works.\n');
  return provider;
}

/**
 * Non-interactive project init at .workflows/.knowledge/. Idempotent:
 * missing pieces are filled in, existing pieces are kept. The dangerous
 * store-without-metadata partial state refuses toward `knowledge rebuild`
 * (same reasoning as the wizard: fresh metadata against an unknown store
 * would hide a provider/dimensions mismatch).
 *
 * @param {{ provider: object|null, providerName: string|null, cfg: object,
 *           projectConfigPayload?: object }} args
 */
async function initProjectStore({ provider, providerName, cfg, projectConfigPayload }) {
  const projectDir = path.resolve(config.findProjectRoot(), '.workflows', '.knowledge');
  const projectConfigFile = path.join(projectDir, 'config.json');
  const storeFile = path.join(projectDir, 'store.msp');
  const metadataFile = path.join(projectDir, 'metadata.json');
  const detected = setup.detectProjectInit(projectDir);

  if (detected.storeExists && !detected.metadataExists) {
    refuse(
      `project knowledge base at ${projectDir} is in an inconsistent state:\n` +
      '  store.msp is present but metadata.json is missing.\n' +
      '  Run `knowledge rebuild` to re-create the store with matching metadata.'
    );
  }

  fs.mkdirSync(projectDir, { recursive: true });

  if (!detected.configExists) {
    config.writeConfigFile(projectConfigFile, projectConfigPayload || setup.buildProjectConfigEmpty());
    process.stdout.write('  config.json written\n');
  }

  const dims = provider
    ? provider.dimensions()
    : (Number.isInteger(cfg.dimensions) && cfg.dimensions > 0 ? cfg.dimensions : setup.KEYWORD_ONLY_DIMENSIONS);

  const wroteStore = !detected.storeExists;
  if (wroteStore) {
    const db = await store.createStore(dims);
    await store.saveStore(db, storeFile);
    process.stdout.write(`  store.msp written (${dims} dimensions)\n`);
  }

  // Rewrite metadata whenever a fresh store was just created — stale
  // metadata paired with a fresh empty store misreports a provider change
  // on the next `knowledge index`.
  if (!detected.metadataExists || wroteStore) {
    store.writeMetadata(metadataFile, {
      provider: provider ? providerName : null,
      model: provider ? provider.model() : null,
      dimensions: provider ? provider.dimensions() : null,
      last_indexed: null,
      pending: [],
    });
    process.stdout.write('  metadata.json written\n');
  }
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/**
 * `setup --from-system` — initialise the project store from the existing
 * system config.
 */
async function runFromSystem(cmdIndexBulk, options) {
  requireWorkflowsDir();
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
  if (!detected.valid) {
    refuse(
      `system config at ${sysPath} is not valid: ${detected.reason}.\n` +
      '  Re-create it with `knowledge setup --provider ...` or the interactive `knowledge setup`.'
    );
  }

  stripProviderOverrides(config.projectConfigPath());

  const cfg = config.loadConfig();
  const provider = await resolveValidatedProvider(cfg);

  await initProjectStore({ provider, providerName: cfg.provider || null, cfg });
  await setup.runInitialIndexStep(cmdIndexBulk, options);
  process.stdout.write('\n' + summaryLines({
    provider: cfg.provider || null,
    model: cfg.model || null,
    base_url: cfg.base_url || null,
  }).join('\n') + '\n');
}

/**
 * `setup --keyword-only` — project-level keyword-only init. Never touches
 * the system config: when the system layer names a provider, the project
 * config pins `provider: null` (the documented per-project unset sentinel)
 * so this project genuinely runs keyword-only.
 */
async function runKeywordOnly(cmdIndexBulk, options) {
  requireWorkflowsDir();
  const projectConfigFile = config.projectConfigPath();

  const sys = setup.detectSystemConfig(config.systemConfigPath());
  const systemProvider = sys.valid && sys.knowledge && sys.knowledge.provider
    ? sys.knowledge.provider
    : null;

  let knowledge = {};
  if (fs.existsSync(projectConfigFile)) {
    try {
      knowledge = config.readConfigFile(projectConfigFile) || {};
    } catch (err) {
      refuse(`project config at ${projectConfigFile} is invalid: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (systemProvider) knowledge.provider = null;
  else delete knowledge.provider;

  // Refuse the partial state before writing anything.
  const projectDir = path.dirname(projectConfigFile);
  const detected = setup.detectProjectInit(projectDir);
  if (detected.storeExists && !detected.metadataExists) {
    refuse(
      `project knowledge base at ${projectDir} is in an inconsistent state:\n` +
      '  store.msp is present but metadata.json is missing.\n' +
      '  Run `knowledge rebuild` to re-create the store with matching metadata.'
    );
  }

  fs.mkdirSync(projectDir, { recursive: true });
  config.writeConfigFile(projectConfigFile, { knowledge });

  const cfg = config.loadConfig();
  await initProjectStore({ provider: null, providerName: null, cfg });
  await setup.runInitialIndexStep(cmdIndexBulk, options);
  process.stdout.write('\n' + summaryLines(null).join('\n') + '\n');
}

/**
 * `setup --provider <id> ...` — non-interactive system-config creation (or
 * replacement — every system-config write path rewrites clean, dropping any
 * fields the current schema no longer knows), then proceeds as
 * --from-system. The key comes from env/credentials only.
 */
async function runProviderForm(cmdIndexBulk, flags, options) {
  requireWorkflowsDir();

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

  let dimensions;
  if (flags.dimensions !== undefined) {
    if (typeof flags.dimensions !== 'string' || !/^\d+$/.test(flags.dimensions.trim()) ||
        parseInt(flags.dimensions, 10) <= 0) {
      refuse(`invalid --dimensions "${flags.dimensions}". Must be a positive integer.`);
    }
    dimensions = parseInt(flags.dimensions, 10);
  }

  let provider;
  let payload;
  if (providerId === 'openai') {
    if (dimensions === undefined) dimensions = setup.OPENAI_DEFAULT_DIMENSIONS;
    const key = config.resolveApiKey('openai', { credentialsPath: config.credentialsPath() });
    if (!key) refuse(missingOpenAiKeyMessage());
    provider = new OpenAIProvider({ apiKey: key, model, dimensions });
    payload = setup.buildSystemConfigOpenAI({ model, dimensions });
  } else {
    const baseUrl = flags['base-url'];
    if (typeof baseUrl !== 'string' || baseUrl === '') {
      refuse('--provider openai-compatible requires --base-url (e.g. http://localhost:1234/v1).');
    }
    if (dimensions === undefined) {
      refuse("--provider openai-compatible requires --dimensions — it must match the model's native output.");
    }
    // Key is optional — keyless endpoints are fine; a stored credential for
    // this provider is picked up when present.
    const key = config.resolveApiKey('openai-compatible', { credentialsPath: config.credentialsPath() });
    provider = new OpenAICompatibleProvider({ baseUrl, apiKey: key, model, dimensions });
    payload = setup.buildSystemConfigCompatible({ baseUrl, model, dimensions });
  }

  // Validate BEFORE writing — a broken provider must not land on disk.
  process.stdout.write(`Validating ${providerId} via a test embed...\n`);
  try {
    await setup.validateProvider(provider, dimensions);
  } catch (err) {
    const { message, hint } = setup.describeValidationError(err, {});
    refuse(`provider validation failed — system config not written.\n  ${message}\n  ${hint}`);
  }
  process.stdout.write('Embedding provider works.\n');

  const sysPath = config.systemConfigPath();
  config.writeConfigFile(sysPath, payload);
  process.stdout.write(`Wrote system config to ${sysPath}\n`);

  stripProviderOverrides(config.projectConfigPath());
  const cfg = config.loadConfig();
  await initProjectStore({ provider, providerName: providerId, cfg });
  await setup.runInitialIndexStep(cmdIndexBulk, options);
  process.stdout.write('\n' + summaryLines({
    provider: providerId,
    model,
    base_url: providerId === 'openai-compatible' ? /** @type {string} */ (flags['base-url']) : null,
  }).join('\n') + '\n');
}

/**
 * `setup --key-only [--provider <id>]` — interactive masked prompt for the
 * API key alone. TTY-required like the wizard; the key is read with hidden
 * input and written straight to credentials.json (mode 0600). Nothing else
 * is touched.
 *
 * @param {Record<string, string|boolean>} flags
 * @param {{ requireTTY?: Function, createPrompter?: Function,
 *           askSecret?: (prompt: string) => Promise<string> }} [deps]
 *   injectable for tests
 */
async function runKeyOnly(flags, deps) {
  const providerId = flags.provider === undefined ? 'openai' : flags.provider;
  if (providerId !== 'openai' && providerId !== 'openai-compatible') {
    refuse(`--key-only supports providers openai and openai-compatible (got "${String(flags.provider)}").`);
  }

  const d = deps || {};
  (d.requireTTY || setup.requireTTY)();
  const rl = (d.createPrompter || setup.createPrompter)();
  const askSecret = d.askSecret || ((prompt) => setup.askSecret(rl, prompt));

  try {
    process.stdout.write(`\nStoring the ${providerId} API key. Input is hidden — nothing is echoed.\n`);
    let key = '';
    while (key === '') {
      key = await askSecret('API key (input hidden): ');
      if (key === '') process.stdout.write('Empty input — enter the key, or Ctrl-C to abort.\n');
    }
    const credPath = config.credentialsPath();
    config.writeCredentials(credPath, /** @type {string} */ (providerId), key);
    process.stdout.write(`Key stored at ${credPath} (mode 0600).\n`);
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch `knowledge setup` to a non-interactive form or the wizard.
 * SetupRefusal prints message-only on stderr and exits 1; anything else
 * propagates to the CLI's top-level handler.
 *
 * @param {Function} cmdIndexBulk injected by index.js (circular-require guard)
 * @param {Function} wizard       setup.cmdSetup
 * @param {string[]} args         positional args after `setup`
 * @param {Record<string, string|boolean>} flags parsed flags
 * @param {object} options        built options object
 */
async function cmdSetup(cmdIndexBulk, wizard, args, flags, options) {
  try {
    const parsed = parseSetupForm(flags);
    if (parsed.error) refuse(parsed.error);
    switch (parsed.form) {
      case 'from-system': await runFromSystem(cmdIndexBulk, options); break;
      case 'keyword-only': await runKeywordOnly(cmdIndexBulk, options); break;
      case 'provider': await runProviderForm(cmdIndexBulk, flags, options); break;
      case 'key-only': await runKeyOnly(flags); break;
      default: await wizard(cmdIndexBulk, args, options); break;
    }
  } catch (err) {
    if (err instanceof SetupRefusal) {
      process.stderr.write('Error: ' + err.message + '\n');
      process.exit(1);
    }
    throw err;
  }
}

module.exports = {
  cmdSetup,
  parseSetupForm,
  runFromSystem,
  runKeywordOnly,
  runProviderForm,
  runKeyOnly,
  summaryLines,
  SetupRefusal,
  KEY_FLAG_REFUSAL,
  FORM_CONFLICT_REFUSAL,
};
