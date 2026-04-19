// Knowledge base interactive setup wizard.
//
// Human-only. Uses Node's built-in readline for prompts. Aborts cleanly
// on non-TTY invocation (Claude, pipes, CI). Idempotent — running on a
// fully configured project exits with "already set up". Running on a
// partial configuration completes the missing pieces.
//
// Wizard steps:
//   1. System config at ~/.config/workflows/config.json (provider, model,
//      dimensions, api_key_env — or stub mode when the user skips).
//   2. Project init at .workflows/.knowledge/ (directory, config.json,
//      empty store.msp, metadata.json).
//   3. Initial bulk indexing (wired in Task 2).

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const config = require('./config');
const store = require('./store');
const { OpenAIProvider } = require('./providers/openai');

const OPENAI_DEFAULT_MODEL = 'text-embedding-3-small';
const OPENAI_DEFAULT_DIMENSIONS = 1536;
const OPENAI_DEFAULT_ENV_VAR = 'OPENAI_API_KEY';

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

// ---------------------------------------------------------------------------
// Config shape builders — pure, unit-testable
// ---------------------------------------------------------------------------

function buildSystemConfigOpenAI({ model, dimensions, apiKeyEnv }) {
  return {
    knowledge: {
      provider: 'openai',
      model,
      dimensions,
      api_key_env: apiKeyEnv,
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
    if (k.api_key_env) process.stdout.write(`    api_key_env:  ${k.api_key_env}\n`);
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
  const apiKeyEnv = await ask(rl, 'API key environment variable', OPENAI_DEFAULT_ENV_VAR);

  // Validate env var (non-blocking — warn only).
  const apiKey = process.env[apiKeyEnv];
  if (apiKey && apiKey.trim() !== '') {
    process.stdout.write(`\nValidating API key via a test embed...\n`);
    try {
      await validateApiKey({ apiKey: apiKey.trim(), model, dimensions });
      process.stdout.write('API key works.\n');
    } catch (err) {
      process.stdout.write(`API key validation failed: ${err.message}\n`);
      const cont = await askYesNo(rl, 'Continue anyway (you can fix the key later)?', true);
      if (!cont) {
        process.stdout.write('Aborting setup.\n');
        process.exit(1);
      }
    }
  } else {
    process.stdout.write(
      `\nEnvironment variable ${apiKeyEnv} is not set. ` +
      `Set it in your shell profile (e.g., ~/.zshrc) before using the knowledge base:\n` +
      `  export ${apiKeyEnv}="sk-..."\n` +
      `Setup will continue — the key is only needed at query/index time.\n`
    );
  }

  config.writeConfigFile(sysPath, buildSystemConfigOpenAI({ model, dimensions, apiKeyEnv }));
  process.stdout.write(`\nWrote system config to ${sysPath}\n`);

  return { provider: 'openai', previouslyStub };
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
  buildSystemConfigOpenAI,
  buildSystemConfigStub,
  buildProjectConfigEmpty,
  detectSystemConfig,
  detectProjectInit,
  validateApiKey,
  runSystemConfigStep,
  runProjectInitStep,
  runInitialIndexStep,
  KEYWORD_ONLY_DIMENSIONS,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_DIMENSIONS,
  OPENAI_DEFAULT_ENV_VAR,
};
