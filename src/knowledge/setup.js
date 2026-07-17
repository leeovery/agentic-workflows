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
const { SETUP_DESCRIPTOR: OPENAI_SETUP } = require('./providers/openai');
const { SETUP_DESCRIPTOR: COMPATIBLE_SETUP } = require('./providers/openai-compatible');

const OPENAI_DEFAULT_MODEL = 'text-embedding-3-small';
const OPENAI_DEFAULT_DIMENSIONS = 1536;

// Registry of selectable embedding-provider setup descriptors. Adding a new
// provider = a new driver module exporting a SETUP_DESCRIPTOR + one entry
// here; runSystemConfigStep stays untouched.
const PROVIDER_SETUPS = [OPENAI_SETUP, COMPATIBLE_SETUP];

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

/**
 * Prompt for a vector-dimension count, re-prompting until the answer is a
 * clean positive integer. parseInt is lenient ('1536abc' → 1536), so insist
 * on a digits-only string before parsing. Pass defaultValue=null to make the
 * answer required (no default).
 */
async function askDimensions(rl, prompt, defaultValue) {
  while (true) {
    const raw = await ask(rl, prompt, defaultValue != null ? String(defaultValue) : undefined);
    if (!/^\d+$/.test(raw.trim())) {
      process.stdout.write(`Invalid dimensions: "${raw}". Must be a positive integer.\n`);
      continue;
    }
    const d = parseInt(raw, 10);
    if (!Number.isInteger(d) || d <= 0) {
      process.stdout.write(`Invalid dimensions: "${raw}". Must be a positive integer.\n`);
      continue;
    }
    return d;
  }
}

// ---------------------------------------------------------------------------
// Config shape builders — pure, unit-testable
// ---------------------------------------------------------------------------

// Generic system-config builder. Provider-specific scalar fields ride on top
// of the shared defaults block. Used by the per-provider wrappers below and
// by the setup toolkit so driver descriptors stay free of config internals.
function buildSystemConfig(fields) {
  return {
    knowledge: Object.assign({}, fields, {
      similarity_threshold: config.DEFAULTS.similarity_threshold,
      decay_prune_below: config.DEFAULTS.decay_prune_below,
    }),
  };
}

function buildSystemConfigOpenAI({ model, dimensions }) {
  return buildSystemConfig({ provider: 'openai', model, dimensions });
}

function buildSystemConfigCompatible({ baseUrl, model, dimensions }) {
  return buildSystemConfig({ provider: 'openai-compatible', base_url: baseUrl, model, dimensions });
}

function buildSystemConfigStub() {
  return {
    knowledge: {
      similarity_threshold: config.DEFAULTS.similarity_threshold,
      decay_prune_below: config.DEFAULTS.decay_prune_below,
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

async function validateProvider(provider, dimensions) {
  const vec = await provider.embed('knowledge base setup test');
  if (!Array.isArray(vec) || vec.length !== dimensions) {
    throw new Error(
      `Expected a vector of length ${dimensions}, got ${Array.isArray(vec) ? vec.length : typeof vec}. ` +
      'The configured dimensions must match the model native output.'
    );
  }
  return true;
}

/**
 * Map a validation error to a human-friendly description and hint.
 * Shared cases (auth/permission/rate-limit/network/server) live here; each
 * driver supplies provider-specific remedy text via `remedies` (keyed by
 * case: auth, permission, rateLimit, network, connRefused, server5xx,
 * unknown). Returns { message, hint } — caller renders both.
 */
function describeValidationError(err, remedies) {
  remedies = remedies || {};
  const msg = (err && err.message) || String(err);

  // ECONNREFUSED first — it also matches the generic /ECONN/ network case
  // below, but the "server not running" remedy is more specific.
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
      hint: remedies.rateLimit || 'Wait a moment and retry.',
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

  // Build a numbered menu from the registered driver descriptors, plus a
  // static "skip" entry for stub mode. Widest label sets the column width so
  // hints line up.
  const entries = PROVIDER_SETUPS.map((d) => ({ id: d.id, label: d.menuLabel, hint: d.menuHint }));
  entries.push({ id: 'skip', label: 'skip', hint: 'Stub mode (keyword-only search, no embeddings)' });
  const width = entries.reduce((w, e) => Math.max(w, e.label.length), 0);
  const pad = (s) => s + ' '.repeat(width - s.length);

  process.stdout.write('\nEmbedding provider:\n');
  entries.forEach((e, i) => {
    process.stdout.write(`  ${i + 1}. ${pad(e.label)} — ${e.hint}\n`);
  });
  process.stdout.write('\n');

  let providerChoice;
  while (true) {
    // Accept the menu number; also accept the provider id/label for convenience.
    const answer = (await ask(rl, `Select provider (1-${entries.length})`, '1')).toLowerCase();
    let picked = null;
    if (/^\d+$/.test(answer)) {
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < entries.length) picked = entries[idx];
    } else {
      picked = entries.find((e) => e.id === answer || e.label === answer) || null;
    }
    if (picked) { providerChoice = picked.id; break; }
    process.stdout.write(`Invalid choice "${answer}". Enter a number from 1 to ${entries.length}.\n`);
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

  // Delegate to the chosen driver's collect(). It owns that provider's
  // prompts + validate/retry loop and returns either a config to write
  // (with an optional key to persist) or a request to fall back to stub
  // mode. Validating BEFORE writing keeps a broken provider from landing on
  // disk, where the next `knowledge index` would misreport a provider change.
  const descriptor = PROVIDER_SETUPS.find((d) => d.id === providerChoice);
  const result = await descriptor.collect(createSetupToolkit(rl));

  if (result.stub) {
    config.writeConfigFile(sysPath, buildSystemConfigStub());
    process.stdout.write(`\nWrote stub-mode system config to ${sysPath}\n`);
    process.stdout.write(
      'Stub mode uses keyword-only (BM25) search. Semantic search is disabled. ' +
      'Re-run `knowledge setup` once the provider is reachable.\n'
    );
    return { provider: null, previouslyStub };
  }

  // Persist a freshly entered key (key === null means env-sourced or already
  // stored — leave credentials untouched), then commit the system config.
  if (result.key) {
    const credPath = config.credentialsPath();
    config.writeCredentials(credPath, descriptor.id, result.key);
    process.stdout.write(`Key stored at ${credPath} (mode 0600).\n`);
  }
  config.writeConfigFile(sysPath, result.knowledgeConfig);
  process.stdout.write(`\nWrote system config to ${sysPath}\n`);
  return { provider: descriptor.id, previouslyStub };
}

/**
 * Build the toolkit injected into a driver descriptor's collect(). Bundles
 * the readline prompts, the shared test-embed validator and error describer,
 * config helpers (env/stored key lookup, config builder), and a fail() that
 * aborts setup. Keeping drivers behind this toolkit means they require no
 * readline or config internals and stay unit-testable against a fake.
 */
function createSetupToolkit(rl) {
  return {
    ask: (prompt, def) => ask(rl, prompt, def),
    askYesNo: (prompt, defYes) => askYesNo(rl, prompt, defYes),
    askSecret: (prompt) => askSecret(rl, prompt),
    askDimensions: (prompt, def) => askDimensions(rl, prompt, def),
    out: (s) => process.stdout.write(s),
    fail: (s) => {
      process.stderr.write(s);
      process.exit(1);
    },
    validate: validateProvider,
    describeError: describeValidationError,
    buildSystemConfig,
    envVarName: (id) => config.PROVIDER_ENV_VARS[id],
    envKey: (id) => {
      const name = config.PROVIDER_ENV_VARS[id];
      if (!name) return null;
      const v = process.env[name];
      return v && v.trim() !== '' ? v.trim() : null;
    },
    storedKey: (id) => config.resolveApiKey(id, { credentialsPath: config.credentialsPath() }),
  };
}

// ---------------------------------------------------------------------------
// Project init step
// ---------------------------------------------------------------------------

async function runProjectInitStep(rl) {
  const projectDir = path.resolve(config.findProjectRoot(), '.workflows', '.knowledge');
  const projectConfigFile = path.join(projectDir, 'config.json');
  const storeFile = path.join(projectDir, 'store.msp');
  const metadataFile = path.join(projectDir, 'metadata.json');

  const detected = detectProjectInit(projectDir);

  // Reject the dangerous partial-state where the store has chunks but
  // metadata is missing. Writing fresh metadata against an existing
  // populated store would create a provider/model/dimensions mismatch
  // we cannot detect from the store alone — the next `knowledge index`
  // would surface a misleading error or, worse, mix incompatible
  // vectors. The escape hatch is `knowledge rebuild`.
  if (detected.storeExists && !detected.metadataExists) {
    process.stderr.write(
      `\nProject knowledge base at ${projectDir} is in an inconsistent state:\n` +
      `  store.msp is present but metadata.json is missing.\n` +
      `  Setup cannot recover this safely — run \`knowledge rebuild\` (which\n` +
      `  re-creates the store from scratch and writes matching metadata) and\n` +
      `  then re-run \`knowledge setup\` if needed.\n`
    );
    process.exit(1);
  }

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
  const wroteStore = !detected.storeExists || detected.fullyInitialised;
  if (wroteStore) {
    const db = await store.createStore(dims);
    await store.saveStore(db, storeFile);
    process.stdout.write(`  store.msp written (${dims} dimensions)\n`);
  }

  // Write initial metadata. Also rewrite whenever a new store was just
  // created — stale metadata paired with a fresh empty store surfaces
  // as a misleading "Provider/model changed — run rebuild" error on
  // the next `knowledge index` (the partial-state recovery case).
  if (!detected.metadataExists || detected.fullyInitialised || wroteStore) {
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
// Non-interactive init — keyword-only
// ---------------------------------------------------------------------------

/**
 * `knowledge init --keyword-only`: initialise the project store without any
 * prompts. Creates .workflows/.knowledge/ with an empty project config, an
 * empty store, and keyword-only metadata (provider null — BM25 mode
 * regardless of any system config; `knowledge setup` / `knowledge rebuild`
 * upgrade to embeddings later). The system config is never touched: stub
 * mode there records an explicit user choice, which this path is not.
 *
 * Idempotent: fully-initialised → "already-initialised" no-op; partial
 * states create only the missing files. The one refusal mirrors setup's:
 * store.msp present with metadata.json missing is unrecoverable here —
 * `knowledge rebuild` is the escape hatch.
 */
async function cmdInit(flags) {
  if (!flags || flags['keyword-only'] !== true) {
    process.stderr.write('Usage: knowledge init --keyword-only\n');
    process.exit(1);
  }

  const projectDir = path.resolve(config.findProjectRoot(), '.workflows', '.knowledge');
  const projectConfigFile = path.join(projectDir, 'config.json');
  const storeFile = path.join(projectDir, 'store.msp');
  const metadataFile = path.join(projectDir, 'metadata.json');

  const detected = detectProjectInit(projectDir);

  if (detected.storeExists && !detected.metadataExists) {
    process.stderr.write(
      `Project knowledge base at ${projectDir} is in an inconsistent state:\n` +
      '  store.msp is present but metadata.json is missing.\n' +
      '  Run `knowledge rebuild` to recover.\n'
    );
    process.exit(1);
  }

  if (detected.fullyInitialised) {
    process.stdout.write('already-initialised\n');
    return;
  }

  fs.mkdirSync(projectDir, { recursive: true });

  if (!detected.configExists) {
    config.writeConfigFile(projectConfigFile, buildProjectConfigEmpty());
  }

  const wroteStore = !detected.storeExists;
  if (wroteStore) {
    const db = await store.createStore(KEYWORD_ONLY_DIMENSIONS);
    await store.saveStore(db, storeFile);
  }

  // Rewrite metadata whenever a new store was just created — stale metadata
  // over a fresh empty store misreports a provider change on the next index.
  if (!detected.metadataExists || wroteStore) {
    store.writeMetadata(metadataFile, {
      provider: null,
      model: null,
      dimensions: null,
      last_indexed: null,
      pending: [],
    });
  }

  process.stdout.write(`initialised keyword-only at ${projectDir}\n`);
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

  // Guard: .workflows/ must exist somewhere at or above cwd.
  const workflowsDir = path.resolve(config.findProjectRoot(), '.workflows');
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
  cmdInit,
  requireTTY,
  createPrompter,
  ask,
  askYesNo,
  askSecret,
  askDimensions,
  buildSystemConfig,
  buildSystemConfigOpenAI,
  buildSystemConfigCompatible,
  buildSystemConfigStub,
  buildProjectConfigEmpty,
  detectSystemConfig,
  detectProjectInit,
  validateProvider,
  describeValidationError,
  createSetupToolkit,
  runSystemConfigStep,
  runProjectInitStep,
  runInitialIndexStep,
  KEYWORD_ONLY_DIMENSIONS,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_DIMENSIONS,
};
