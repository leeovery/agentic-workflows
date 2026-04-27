// Knowledge base interactive setup wizard.
//
// Human-only. Uses Node's built-in readline for prompts. Aborts cleanly
// on non-TTY invocation (Claude, pipes, CI). Idempotent — per-step
// prompts detect existing state and offer skip or reconfigure.
//
// Wizard steps:
//   1. System config at ~/.config/workflows/config.json (provider, model,
//      dimensions — no secrets). Stub mode when the user chooses "skip".
//   2. API key: read from $OPENAI_API_KEY if set, else ~/.config/workflows/
//      credentials.json (mode 0600), else prompt inline and store to that
//      file. Env wins over file.
//   3. Project init at .workflows/.knowledge/ (directory, config.json,
//      empty store.msp, metadata.json).
//   4. Initial bulk indexing via cmdIndexBulk (injected by caller).

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const config = require('./config');
const store = require('./store');
const { OpenAIProvider } = require('./providers/openai');

const OPENAI_DEFAULT_MODEL = 'text-embedding-3-small';
const OPENAI_DEFAULT_DIMENSIONS = 1536;

// Used when creating the initial store in stub / keyword-only mode —
// Orama's schema requires a dimension parameter even when docs omit
// the embedding field. Matches KEYWORD_ONLY_DIMENSIONS in index.js.
const KEYWORD_ONLY_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// TTY guard — abort cleanly on non-interactive invocation
// ---------------------------------------------------------------------------

function requireTTY() {
  if (!process.stdin.isTTY) {
    process.stderr.write(
      'knowledge setup requires an interactive terminal. ' +
      'Run it directly, not through Claude or a pipe.\n'
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Readline helpers
// ---------------------------------------------------------------------------

function createPrompter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('SIGINT', () => {
    process.stderr.write('\nSetup cancelled.\n');
    rl.close();
    process.exit(130);
  });

  return rl;
}

function ask(rl, prompt, defaultValue) {
  const suffix = defaultValue !== undefined && defaultValue !== null && defaultValue !== ''
    ? ` [${defaultValue}]`
    : '';
  return new Promise((resolve) => {
    rl.question(`${prompt}${suffix}: `, (answer) => {
      const trimmed = (answer || '').trim();
      if (trimmed === '' && defaultValue !== undefined && defaultValue !== null) {
        resolve(String(defaultValue));
      } else {
        resolve(trimmed);
      }
    });
  });
}

async function askYesNo(rl, prompt, defaultYes) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${prompt} (${hint}): `, (answer) => {
      const trimmed = (answer || '').trim().toLowerCase();
      if (trimmed === '') return resolve(Boolean(defaultYes));
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

/**
 * Read a line from stdin without echoing the characters — one '*' is
 * written per typed/pasted character so the prompt still feels alive,
 * but the secret itself never lands in the terminal scrollback. Used
 * for API keys.
 *
 * Bypasses the readline interface temporarily: pauses `rl`, switches
 * stdin to raw mode, consumes keystrokes directly, then restores
 * everything on Enter. Ctrl-C exits 130; Ctrl-D submits the current
 * buffer. Backspace edits as you'd expect.
 */
function askSecret(rl, prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    // Fallback when stdin is not a TTY — no masking available, read a
    // plain line. cmdSetup aborts before this in non-TTY mode, so this
    // branch is defensive only.
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      rl.question(prompt, (ans) => resolve((ans || '').trim()));
      return;
    }

    stdout.write(prompt);
    rl.pause();

    const wasRaw = stdin.isRaw === true;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      try { stdin.setRawMode(wasRaw); } catch (_) { /* best effort */ }
      stdin.pause();
      rl.resume();
    };

    const onData = (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\n' || ch === '\r') {
          cleanup();
          stdout.write('\n');
          return resolve(buf.trim());
        }
        if (ch === '\u0003') { // Ctrl-C
          cleanup();
          stdout.write('\n');
          process.exit(130);
          return;
        }
        if (ch === '\u0004') { // Ctrl-D — submit what's in the buffer
          cleanup();
          stdout.write('\n');
          return resolve(buf.trim());
        }
        if (ch === '\u007f' || ch === '\b') { // Backspace / DEL
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        // Ignore anything below space except the explicit cases above.
        if (ch < ' ') continue;
        buf += ch;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// Config shape builders — pure, unit-testable
// ---------------------------------------------------------------------------

function buildSystemConfigOpenAI({ model, dimensions }) {
  return {
    knowledge: {
      provider: 'openai',
      model,
      dimensions,
      similarity_threshold: config.DEFAULTS.similarity_threshold,
      decay_months: config.DEFAULTS.decay_months,
    },
  };
}

function buildSystemConfigStub() {
  return {
    knowledge: {
      similarity_threshold: config.DEFAULTS.similarity_threshold,
      decay_months: config.DEFAULTS.decay_months,
    },
  };
}

function buildProjectConfigEmpty() {
  return { knowledge: {} };
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function detectSystemConfig(sysPath) {
  if (!fs.existsSync(sysPath)) {
    return { exists: false, valid: false, knowledge: null };
  }
  try {
    const raw = fs.readFileSync(sysPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.knowledge ||
        typeof parsed.knowledge !== 'object' || Array.isArray(parsed.knowledge)) {
      return { exists: true, valid: false, knowledge: null, reason: 'missing or invalid "knowledge" key' };
    }
    return { exists: true, valid: true, knowledge: parsed.knowledge };
  } catch (e) {
    return { exists: true, valid: false, knowledge: null, reason: e.message };
  }
}

function detectProjectInit(projectDir) {
  const configFile = path.join(projectDir, 'config.json');
  const storeFile = path.join(projectDir, 'store.msp');
  const metadataFile = path.join(projectDir, 'metadata.json');
  const dirExists = fs.existsSync(projectDir);
  const configExists = fs.existsSync(configFile);
  const storeExists = fs.existsSync(storeFile);
  const metadataExists = fs.existsSync(metadataFile);
  return {
    dirExists,
    configExists,
    storeExists,
    metadataExists,
    fullyInitialised: configExists && storeExists && metadataExists,
    partiallyInitialised: dirExists && !(configExists && storeExists && metadataExists),
  };
}

// ---------------------------------------------------------------------------
// Test-embed validation — verify the API key actually works
// ---------------------------------------------------------------------------

async function validateApiKey({ apiKey, model, dimensions }) {
  const provider = new OpenAIProvider({ apiKey, model, dimensions });
  const vec = await provider.embed('knowledge base setup test');
  if (!Array.isArray(vec) || vec.length !== dimensions) {
    throw new Error(
      `Expected a vector of length ${dimensions}, got ${Array.isArray(vec) ? vec.length : typeof vec}`
    );
  }
  return true;
}

/**
 * Map a validation error to a human-friendly description and hint.
 * Returns { message, hint } — caller renders both.
 */
function describeValidationError(err) {
  const msg = (err && err.message) || String(err);

  if (/401/.test(msg) || /invalid or expired/i.test(msg)) {
    return {
      message: 'The API key was rejected (HTTP 401).',
      hint:
        'Check that the key is active and not revoked. Free-tier keys also need billing enabled ' +
        'for /v1/embeddings. Create a fresh key at https://platform.openai.com/api-keys and try again.',
    };
  }
  if (/403/.test(msg) || /permission/i.test(msg)) {
    return {
      message: 'The API key does not have permission for embeddings (HTTP 403).',
      hint:
        'If this is a restricted key, check its allowed endpoints in the OpenAI dashboard. ' +
        'Create a key with Embeddings access enabled.',
    };
  }
  if (/429/.test(msg) || /rate limit/i.test(msg)) {
    return {
      message: 'Rate limit hit during validation (HTTP 429).',
      hint:
        'Your account may be out of quota, or the default rate limit is saturated. ' +
        'Wait a moment and retry, or check billing at https://platform.openai.com/account.',
    };
  }
  if (/network error/i.test(msg) || /ENOTFOUND/.test(msg) || /ECONN/.test(msg) || /ETIMEDOUT/.test(msg)) {
    return {
      message: 'Could not reach OpenAI (network error).',
      hint:
        'Check your internet connection, VPN, or corporate proxy. No key was written — ' +
        'you can re-run `knowledge setup` once the connection is stable.',
    };
  }
  if (/HTTP 5\d\d/.test(msg)) {
    return {
      message: 'OpenAI returned a server error during validation.',
      hint: 'Transient on their side. Retry in a minute.',
    };
  }
  return {
    message: 'API key validation failed.',
    hint: `Error detail: ${msg}`,
  };
}

// ---------------------------------------------------------------------------
// System config step
// ---------------------------------------------------------------------------

async function runSystemConfigStep(rl) {
  const sysPath = config.systemConfigPath();
  const existing = detectSystemConfig(sysPath);

  if (existing.exists && existing.valid) {
    process.stdout.write(`\nSystem config already exists at ${sysPath}\n`);
    process.stdout.write('  Current settings:\n');
    const k = existing.knowledge;
    process.stdout.write(`    provider:     ${k.provider == null ? '(none — stub mode)' : k.provider}\n`);
    if (k.model) process.stdout.write(`    model:        ${k.model}\n`);
    if (k.dimensions) process.stdout.write(`    dimensions:   ${k.dimensions}\n`);
    process.stdout.write('\n');

    const reconfigure = await askYesNo(rl, 'Reconfigure system settings?', false);
    if (!reconfigure) {
      process.stdout.write('Keeping existing system config.\n');
      return { provider: k.provider || null, previouslyStub: !k.provider };
    }
  } else if (existing.exists && !existing.valid) {
    process.stdout.write(`\nSystem config at ${sysPath} is not valid: ${existing.reason}\n`);
    const overwrite = await askYesNo(rl, 'Overwrite it?', true);
    if (!overwrite) {
      process.stdout.write('Aborting setup so you can fix the file manually.\n');
      process.exit(1);
    }
  } else {
    process.stdout.write(`\nNo system config found at ${sysPath}. Creating a new one.\n`);
  }

  // Detect stub-to-full upgrade scenario (used after provider choice).
  const previouslyStub = existing.exists && existing.valid && !existing.knowledge.provider;

  // Prompt for provider.
  process.stdout.write('\nEmbedding provider:\n');
  process.stdout.write('  openai — OpenAI embeddings API (requires an API key)\n');
  process.stdout.write('  skip   — Stub mode (keyword-only search, no embeddings)\n\n');

  let providerChoice;
  while (true) {
    providerChoice = (await ask(rl, 'Provider (openai / skip)', 'openai')).toLowerCase();
    if (providerChoice === 'openai' || providerChoice === 'skip') break;
    process.stdout.write(`Unknown choice "${providerChoice}". Enter "openai" or "skip".\n`);
  }

  if (providerChoice === 'skip') {
    config.writeConfigFile(sysPath, buildSystemConfigStub());
    process.stdout.write(`\nWrote stub-mode system config to ${sysPath}\n`);
    process.stdout.write(
      'Stub mode uses keyword-only (BM25) search. Semantic search is disabled. ' +
      'Run `knowledge setup` again later to configure a provider.\n'
    );
    return { provider: null, previouslyStub };
  }

  // openai path.
  const model = await ask(rl, 'Embedding model', OPENAI_DEFAULT_MODEL);
  const dimsRaw = await ask(rl, 'Vector dimensions', String(OPENAI_DEFAULT_DIMENSIONS));
  const dimensions = parseInt(dimsRaw, 10);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    process.stderr.write(`Invalid dimensions: "${dimsRaw}". Must be a positive integer.\n`);
    process.exit(1);
  }

  // Resolve and validate the API key BEFORE writing any system config.
  // Writing `provider: openai` to disk with no working key leaves the
  // system in a state where the next `knowledge index` misreports a
  // provider/model change. ensureOpenAIKey aborts on irrecoverable
  // failures (bad env var, bad stored key kept) and returns a status
  // for the recoverable cases.
  const envVar = config.PROVIDER_ENV_VARS.openai;
  const keyStatus = await ensureOpenAIKey(rl, { envVar, model, dimensions });

  if (keyStatus === 'opted-out') {
    // User explicitly chose to skip past the inline prompt without a
    // working key. Honour the "skip to proceed without" feature by
    // writing stub-mode system config rather than openai-with-no-key.
    config.writeConfigFile(sysPath, buildSystemConfigStub());
    process.stdout.write(`\nWrote stub-mode system config to ${sysPath}\n`);
    process.stdout.write(
      'Stub mode uses keyword-only (BM25) search. Semantic search is disabled. ' +
      'Re-run `knowledge setup` once you have a working API key.\n'
    );
    return { provider: null, previouslyStub };
  }

  // keyStatus === 'validated' — safe to commit the openai config.
  config.writeConfigFile(sysPath, buildSystemConfigOpenAI({ model, dimensions }));
  process.stdout.write(`\nWrote system config to ${sysPath}\n`);
  return { provider: 'openai', previouslyStub };
}

/**
 * Ensure an OpenAI API key is available for this run and validate it.
 * Resolution order: process.env → credentials file → inline prompt.
 * Newly entered keys are written to the credentials file at 0600.
 *
 * Returns:
 *   'validated' — a working key is in place (env, file, or freshly stored)
 *   'opted-out' — user explicitly skipped after a failed inline prompt
 *
 * Aborts (process.exit 1) on irrecoverable failures: bad env-var key, or
 * bad stored key that the user opts to keep. Both leave the system in a
 * state where openai-mode setup cannot honestly proceed.
 */
async function ensureOpenAIKey(rl, { envVar, model, dimensions }) {
  const credPath = config.credentialsPath();

  // 1. Env var wins. Nothing is written to disk — env is authoritative.
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.trim() !== '') {
    process.stdout.write(`\nUsing API key from $${envVar} — validating via a test embed...\n`);
    try {
      await validateApiKey({ apiKey: fromEnv.trim(), model, dimensions });
      process.stdout.write('API key works.\n');
      return 'validated';
    } catch (err) {
      const { message, hint } = describeValidationError(err);
      process.stderr.write(`\n${message}\n  ${hint}\n`);
      process.stderr.write(
        `The failing key came from $${envVar}. Fix or unset it in your shell, ` +
        'then re-run `knowledge setup`.\n'
      );
      process.exit(1);
    }
  }

  // 2. Existing credentials file. Validate; let the user replace it if broken.
  const fromFile = config.resolveApiKey('openai', { credentialsPath: credPath });
  if (fromFile) {
    process.stdout.write(`\nFound an existing API key in ${credPath} — validating via a test embed...\n`);
    try {
      await validateApiKey({ apiKey: fromFile, model, dimensions });
      process.stdout.write('API key works.\n');
      return 'validated';
    } catch (err) {
      const { message, hint } = describeValidationError(err);
      process.stdout.write(`${message}\n  ${hint}\n`);
      const replace = await askYesNo(rl, 'Enter a new key to replace it?', true);
      if (!replace) {
        process.stderr.write(
          `\nKeeping the existing stored key would leave setup in an inconsistent state.\n` +
          `Edit ${credPath} or re-run \`knowledge setup\` when you have a new key.\n`
        );
        process.exit(1);
      }
      // Fall through to prompt path to collect and store a replacement.
    }
  }

  // 3. No valid key anywhere — prompt inline and store.
  return await promptForKeyAndStore(rl, { envVar, model, dimensions, credPath });
}

/**
 * Print the OpenAI key explainer, prompt for a key, validate it, and
 * write it to the credentials file at 0600. Loops on validation failure
 * so the user can retry with a different key.
 */
async function promptForKeyAndStore(rl, { envVar, model, dimensions, credPath }) {
  process.stdout.write(
    '\nOpenAI API Key\n' +
    '--------------\n' +
    'Semantic search in the knowledge base relies on OpenAI embeddings.\n' +
    'We recommend creating a dedicated key for this tool so you can rotate\n' +
    'or revoke it independently from other integrations.\n' +
    '\n' +
    '  1. Create a key: https://platform.openai.com/api-keys\n' +
    `     (Suggested name: "agentic-workflows")\n` +
    '  2. Paste the full key (starting with "sk-") at the prompt below.\n' +
    '\n' +
    `Your key will be stored at:\n` +
    `  ${credPath}  (mode 0600, user-private)\n` +
    `Setting $${envVar} in your shell takes precedence and overrides the\n` +
    'stored key, so you can swap it without editing the file.\n\n'
  );

  while (true) {
    const key = await askSecret(rl, 'API key (input hidden): ');

    if (key === '') {
      process.stdout.write('Empty input — enter the key, or Ctrl-C to abort setup.\n\n');
      continue;
    }

    process.stdout.write('\nValidating via a test embed...\n');
    try {
      await validateApiKey({ apiKey: key, model, dimensions });
    } catch (err) {
      const { message, hint } = describeValidationError(err);
      process.stdout.write(`${message}\n  ${hint}\n\n`);
      const retry = await askYesNo(rl, 'Try a different key?', true);
      if (!retry) {
        process.stdout.write(
          `No key stored. Falling back to stub mode — semantic search disabled.\n` +
          `Set $${envVar} in your shell or re-run \`knowledge setup\` once you have a working key.\n`
        );
        return 'opted-out';
      }
      continue;
    }

    // Validated — write the credentials file.
    config.writeCredentials(credPath, 'openai', key);
    process.stdout.write(`API key works. Stored at ${credPath} (mode 0600).\n`);
    return 'validated';
  }
}

// ---------------------------------------------------------------------------
// Project init step
// ---------------------------------------------------------------------------

async function runProjectInitStep(rl) {
  const projectDir = path.resolve(process.cwd(), '.workflows', '.knowledge');
  const projectConfigFile = path.join(projectDir, 'config.json');
  const storeFile = path.join(projectDir, 'store.msp');
  const metadataFile = path.join(projectDir, 'metadata.json');

  const detected = detectProjectInit(projectDir);

  if (detected.fullyInitialised) {
    process.stdout.write(`\nProject knowledge base already initialised at ${projectDir}\n`);
    const reinit = await askYesNo(rl, 'Reinitialise (destroys existing store)?', false);
    if (!reinit) {
      process.stdout.write('Keeping existing project files.\n');
      return { created: false };
    }
  } else if (detected.partiallyInitialised) {
    process.stdout.write(`\nProject knowledge base partially initialised at ${projectDir}\n`);
    process.stdout.write('  Missing files will be created.\n');
  } else {
    process.stdout.write(`\nInitialising project knowledge base at ${projectDir}\n`);
  }

  // mkdir -p equivalent — safe to run repeatedly.
  fs.mkdirSync(projectDir, { recursive: true });

  // Write project config (empty — inherits from system).
  if (!detected.configExists || detected.fullyInitialised /* reinit path */) {
    config.writeConfigFile(projectConfigFile, buildProjectConfigEmpty());
    process.stdout.write(`  config.json written\n`);
  }

  // Load merged config to resolve dimensions for the store.
  const cfg = config.loadConfig();
  const provider = cfg.provider || null;
  const dims = Number.isInteger(cfg.dimensions) && cfg.dimensions > 0
    ? cfg.dimensions
    : KEYWORD_ONLY_DIMENSIONS;

  // Create empty store and save.
  if (!detected.storeExists || detected.fullyInitialised) {
    const db = await store.createStore(dims);
    await store.saveStore(db, storeFile);
    process.stdout.write(`  store.msp written (${dims} dimensions)\n`);
  }

  // Write initial metadata.
  if (!detected.metadataExists || detected.fullyInitialised) {
    store.writeMetadata(metadataFile, {
      provider: provider || null,
      model: provider && cfg.model ? cfg.model : null,
      dimensions: provider ? dims : null,
      last_indexed: null,
      pending: [],
    });
    process.stdout.write(`  metadata.json written\n`);
  }

  return { created: true, provider, dimensions: dims };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

async function runInitialIndexStep(cmdIndexBulk, options) {
  const cfg = config.loadConfig();
  const provider = config.resolveProvider(cfg);

  process.stdout.write('\nInitial indexing\n');
  process.stdout.write('----------------\n');
  try {
    await cmdIndexBulk(options || {}, cfg, provider);
  } catch (err) {
    // Indexing failures don't abort setup — the project is initialised
    // and the pending queue retains any partial state.
    process.stderr.write(
      `\nInitial indexing hit an error: ${err.message}\n` +
      'Project is initialised; run `knowledge index` later to retry.\n'
    );
  }
}

// cmdIndexBulk is injected by the caller (index.js dispatch) to avoid
// a circular require — esbuild's CJS wrapping breaks `require.main ===
// module` on the entry when two modules require each other.
async function cmdSetup(cmdIndexBulk, args, options) {
  requireTTY();

  // Guard: .workflows/ must exist.
  const workflowsDir = path.resolve(process.cwd(), '.workflows');
  if (!fs.existsSync(workflowsDir)) {
    process.stderr.write(
      'No .workflows/ directory found. Initialise a workflow project first.\n'
    );
    process.exit(1);
  }

  const rl = createPrompter();
  let sysResult;

  try {
    process.stdout.write('\nKnowledge base setup\n');
    process.stdout.write('====================\n');

    sysResult = await runSystemConfigStep(rl);
    await runProjectInitStep(rl);
  } finally {
    // Close readline before indexing — indexing is non-interactive and
    // a lingering readline blocks process exit. Safe to call twice.
    rl.close();
  }

  await runInitialIndexStep(cmdIndexBulk, options);

  process.stdout.write('\nSetup complete.\n');

  if (!sysResult.provider) {
    process.stdout.write(
      '\nStub mode: no embedding provider configured. The knowledge base will run in keyword-only (BM25) mode. ' +
      'Semantic search is disabled until you configure a provider.\n'
    );
  } else if (sysResult.previouslyStub) {
    process.stdout.write(
      '\nUpgraded from stub mode to a configured provider. ' +
      'The existing store was indexed in keyword-only mode — run `knowledge rebuild` to re-index with embeddings for full hybrid search.\n'
    );
  }
}

module.exports = {
  cmdSetup,
  requireTTY,
  createPrompter,
  ask,
  askYesNo,
  askSecret,
  buildSystemConfigOpenAI,
  buildSystemConfigStub,
  buildProjectConfigEmpty,
  detectSystemConfig,
  detectProjectInit,
  validateApiKey,
  describeValidationError,
  ensureOpenAIKey,
  runSystemConfigStep,
  runProjectInitStep,
  runInitialIndexStep,
  KEYWORD_ONLY_DIMENSIONS,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_DIMENSIONS,
};
