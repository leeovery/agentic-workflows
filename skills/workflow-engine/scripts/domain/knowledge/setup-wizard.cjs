'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the knowledge setup a person runs at a terminal — human-only,
// refused anywhere but the shell door with a terminal on stdin.
//
//   the wizard       1. the system config (provider, model, dimensions — no
//                       secrets), or keyword-only when the person skips;
//                    2. the API key: $OPENAI_API_KEY when set, else
//                       credentials.json (mode 0600), else asked for here
//                       and stored there — the environment wins over the file;
//                    3. the project's knowledge directory, with an empty store;
//                    4. the initial bulk index.
//   --key-only       the API key alone, asked for with the input hidden and
//                    written to credentials.json.
//
// Each step finds what exists and offers to keep or reconfigure it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../../kernel/knowledge/config.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { ExitSignal } = require('../../kernel/call.cjs');
const { SETUP_DESCRIPTOR: OPENAI_SETUP } = require('../../kernel/knowledge/providers/openai.cjs');
const { SETUP_DESCRIPTOR: COMPATIBLE_SETUP } = require('../../kernel/knowledge/providers/openai-compatible.cjs');
const setup = require('./setup.cjs');

/** @typedef {import('../../kernel/call.cjs').Call} Call */
/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */

/**
 * @typedef {object} Prompter  the readline surface the wizard asks through
 * @property {(prompt: string, answer: (text: string) => void) => void} question
 * @property {() => void} close
 * @property {() => void} [pause]
 * @property {() => void} [resume]
 * @property {(text: string) => void} [_writeToOutput]
 */

/**
 * @typedef {object} TerminalDeps  the terminal's parts, replaceable by a test
 * @property {(call: Call) => void} [requireTTY]
 * @property {(call: Call) => Prompter} [createPrompter]
 * @property {(prompt: string) => Promise<string>} [askSecret]
 */

// Adding a provider is a driver module exporting a SETUP_DESCRIPTOR and an
// entry here.
const PROVIDER_SETUPS = [OPENAI_SETUP, COMPATIBLE_SETUP];

/** @param {Call} call */
function requireTTY(call) {
  if (!call.terminal) {
    call.err(
      'knowledge setup requires an interactive terminal. ' +
      'Run it directly, not through Claude or a pipe.\n'
    );
    throw new ExitSignal(1);
  }
}

/**
 * A readline prompter on the call's terminal. Ctrl-C ends the process — the
 * terminal's interrupt, which only the shell door ever receives.
 * @param {Call} call @returns {Prompter}
 */
function createPrompter(call) {
  const { input, output } = /** @type {NonNullable<Call['terminal']>} */ (call.terminal);
  const rl = readline.createInterface({ input, output });
  rl.on('SIGINT', () => {
    call.err('\nSetup cancelled.\n');
    rl.close();
    process.exit(130);
  });
  return /** @type {Prompter} */ (/** @type {unknown} */ (rl));
}

/**
 * @param {Prompter} rl @param {string} prompt @param {string|null} [defaultValue]
 * @returns {Promise<string>}
 */
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

/**
 * @param {Prompter} rl @param {string} prompt @param {boolean} defaultYes
 * @returns {Promise<boolean>}
 */
function askYesNo(rl, prompt, defaultYes) {
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
 * A line read without echoing it — one '*' per character, so the prompt
 * stays alive while the secret never reaches the scrollback. The prompter is
 * set aside and stdin read raw until Enter; Ctrl-C ends the process, Ctrl-D
 * submits what was typed, and backspace edits.
 * @param {Call} call @param {Prompter} rl @param {string} prompt
 * @returns {Promise<string>}
 */
function askSecret(call, rl, prompt) {
  const { input, output } = /** @type {NonNullable<Call['terminal']>} */ (call.terminal);
  return new Promise((resolve) => {
    output.write(prompt);
    if (rl.pause) rl.pause();
    // Pausing leaves readline's keypress echo live — each character would
    // echo in plain text beside the mask — so its writer is muted meanwhile.
    const savedWrite = rl._writeToOutput;
    rl._writeToOutput = () => {};

    const wasRaw = input.isRaw === true;
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let buf = '';
    const cleanup = () => {
      input.removeListener('data', onData);
      try { input.setRawMode(wasRaw); } catch { /* best effort */ }
      input.pause();
      rl._writeToOutput = savedWrite;
      if (rl.resume) rl.resume();
    };

    /** @param {string|Buffer} chunk */
    const onData = (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          cleanup();
          output.write('\n');
          resolve(buf.trim());
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          output.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }
        if (ch < ' ') continue;
        buf += ch;
        output.write('*');
      }
    };

    input.on('data', onData);
  });
}

/**
 * A vector width, asked again until the answer is a clean positive integer —
 * parseInt alone would take '1536abc'. A null default makes it required.
 * @param {Call} call @param {Prompter} rl @param {string} prompt @param {number|null} defaultValue
 * @returns {Promise<number>}
 */
async function askDimensions(call, rl, prompt, defaultValue) {
  while (true) {
    const raw = await ask(rl, prompt, defaultValue != null ? String(defaultValue) : undefined);
    const d = parseInt(raw, 10);
    if (/^\d+$/.test(raw.trim()) && d > 0) return d;
    call.out(`Invalid dimensions: "${raw}". Must be a positive integer.\n`);
  }
}

/**
 * The toolkit a provider's setup descriptor collects its settings through:
 * the prompts, the test-embed validator and its error describer, the key
 * lookups, and a fail that ends setup. Behind it, a driver needs no readline
 * or config of its own.
 * @param {Call} call @param {Prompter} rl
 */
function createSetupToolkit(call, rl) {
  return {
    ask: (/** @type {string} */ prompt, /** @type {string|null} */ def) => ask(rl, prompt, def),
    askYesNo: (/** @type {string} */ prompt, /** @type {boolean} */ defYes) => askYesNo(rl, prompt, defYes),
    askSecret: (/** @type {string} */ prompt) => askSecret(call, rl, prompt),
    askDimensions: (/** @type {string} */ prompt, /** @type {number|null} */ def) => askDimensions(call, rl, prompt, def),
    out: (/** @type {string} */ s) => call.out(s),
    /** @param {string} s @returns {never} */
    fail: (s) => {
      call.err(s);
      throw new ExitSignal(1);
    },
    validate: setup.validateProvider,
    describeError: setup.describeValidationError,
    buildSystemConfig: setup.buildSystemConfig,
    envVarName: (/** @type {string} */ id) => /** @type {Record<string, string>} */ (config.PROVIDER_ENV_VARS)[id],
    envKey: (/** @type {string} */ id) => {
      const name = /** @type {Record<string, string>} */ (config.PROVIDER_ENV_VARS)[id];
      const v = name ? process.env[name] : undefined;
      return v && v.trim() !== '' ? v.trim() : null;
    },
    storedKey: (/** @type {string} */ id) => config.resolveApiKey(id, { credentialsPath: config.credentialsPath() }),
  };
}

/**
 * Write keyword-only as the system config, and say what it leaves.
 * @param {Call} call @param {string} sysPath @param {string} rerun  when to run setup again
 */
function writeStubSystemConfig(call, sysPath, rerun) {
  config.writeConfigFile(sysPath, setup.buildSystemConfigStub());
  call.out(`\nWrote stub-mode system config to ${sysPath}\n`);
  call.out(`Stub mode uses keyword-only (BM25) search. Semantic search is disabled. ${rerun}\n`);
}

/**
 * The provider the person picks from the registered drivers, or `skip`.
 * @param {Call} call @param {Prompter} rl
 * @returns {Promise<string>}
 */
async function pickProvider(call, rl) {
  const entries = PROVIDER_SETUPS.map((d) => ({ id: d.id, label: d.menuLabel, hint: d.menuHint }));
  entries.push({ id: 'skip', label: 'skip', hint: 'Stub mode (keyword-only search, no embeddings)' });
  const width = entries.reduce((w, e) => Math.max(w, e.label.length), 0);
  call.out('\nEmbedding provider:\n');
  entries.forEach((e, i) => call.out(`  ${i + 1}. ${e.label.padEnd(width)} — ${e.hint}\n`));
  call.out('\n');
  while (true) {
    const answer = (await ask(rl, `Select provider (1-${entries.length})`, '1')).toLowerCase();
    const picked = /^\d+$/.test(answer)
      ? entries[parseInt(answer, 10) - 1]
      : entries.find((e) => e.id === answer || e.label === answer);
    if (picked) return picked.id;
    call.out(`Invalid choice "${answer}". Enter a number from 1 to ${entries.length}.\n`);
  }
}

/**
 * The wizard's first step: the system config kept, or written from the
 * provider the person picks — validated before it is written, so a broken
 * provider never lands on disk.
 * @param {Call} call @param {Prompter} rl
 * @returns {Promise<{provider: string|null}>}
 */
async function runSystemConfigStep(call, rl) {
  const sysPath = config.systemConfigPath();
  const existing = setup.detectSystemConfig(sysPath);

  if (existing.exists && existing.valid) {
    const k = /** @type {Record<string, any>} */ (existing.knowledge);
    call.out(`\nSystem config already exists at ${sysPath}\n`);
    call.out('  Current settings:\n');
    call.out(`    provider:     ${k.provider == null ? '(none — stub mode)' : k.provider}\n`);
    if (k.model) call.out(`    model:        ${k.model}\n`);
    if (k.dimensions) call.out(`    dimensions:   ${k.dimensions}\n`);
    call.out('\n');
    if (!(await askYesNo(rl, 'Reconfigure system settings?', false))) {
      call.out('Keeping existing system config.\n');
      return { provider: k.provider || null };
    }
  } else if (existing.exists) {
    call.out(`\nSystem config at ${sysPath} is not valid: ${existing.reason}\n`);
    if (!(await askYesNo(rl, 'Overwrite it?', true))) {
      call.out('Aborting setup so you can fix the file manually.\n');
      throw new ExitSignal(1);
    }
  } else {
    call.out(`\nNo system config found at ${sysPath}. Creating a new one.\n`);
  }

  const providerChoice = await pickProvider(call, rl);
  if (providerChoice === 'skip') {
    writeStubSystemConfig(call, sysPath, 'Run `knowledge setup` again later to configure a provider.');
    return { provider: null };
  }

  const descriptor = /** @type {typeof PROVIDER_SETUPS[number]} */ (PROVIDER_SETUPS.find((d) => d.id === providerChoice));
  const result = await descriptor.collect(createSetupToolkit(call, rl));
  if (result.stub) {
    writeStubSystemConfig(call, sysPath, 'Re-run `knowledge setup` once the provider is reachable.');
    return { provider: null };
  }
  // A null key came from the environment or was already stored: left alone.
  if (result.key) {
    const credPath = config.credentialsPath();
    config.writeCredentials(credPath, descriptor.id, result.key);
    call.out(`Key stored at ${credPath} (mode 0600).\n`);
  }
  config.writeConfigFile(sysPath, result.knowledgeConfig);
  call.out(`\nWrote system config to ${sysPath}\n`);
  return { provider: descriptor.id };
}

/**
 * The wizard's project step: the knowledge directory set up, a finished one
 * reinitialised only when the person asks. A store without its metadata is
 * refused toward rebuild.
 * @param {Call} call @param {KnowledgeFiles} files @param {Prompter} rl
 */
async function runProjectInitStep(call, files, rl) {
  const detected = setup.detectProjectInit(files);
  if (detected.storeExists && !detected.metadataExists) {
    call.err(
      `\nProject ${setup.inconsistentStoreMessage(files)}\n` +
      '  Setup cannot recover this safely — run `knowledge rebuild` (which\n' +
      '  re-creates the store from scratch and writes matching metadata) and\n' +
      '  then re-run `knowledge setup` if needed.\n'
    );
    throw new ExitSignal(1);
  }

  if (detected.fullyInitialised) {
    call.out(`\nProject knowledge base already initialised at ${files.dir}\n`);
    if (!(await askYesNo(rl, 'Reinitialise (destroys existing store)?', false))) {
      call.out('Keeping existing project files.\n');
      return;
    }
  } else if (detected.partiallyInitialised) {
    call.out(`\nProject knowledge base partially initialised at ${files.dir}\n`);
    call.out('  Missing files will be created.\n');
  } else {
    call.out(`\nInitialising project knowledge base at ${files.dir}\n`);
  }

  fs.mkdirSync(files.dir, { recursive: true });
  if (!detected.configExists || detected.fullyInitialised) {
    config.writeConfigFile(files.config, setup.buildProjectConfigEmpty());
    call.out(`  ${path.basename(files.config)} written\n`);
  }
  if (!detected.storeExists || detected.fullyInitialised) {
    const cfg = config.loadConfig({ projectPath: files.config });
    const provider = cfg.provider || null;
    const dimensions = Number.isInteger(cfg.dimensions) && cfg.dimensions > 0 ? cfg.dimensions : setup.OPENAI_DEFAULT_DIMENSIONS;
    setup.createEmptyStore(call, files, {
      provider,
      model: provider && cfg.model ? cfg.model : null,
      dimensions: provider ? dimensions : null,
    });
  }
}

/**
 * The interactive wizard.
 * @param {Call} call @param {string} root @param {TerminalDeps} [deps]
 */
async function runWizard(call, root, deps = {}) {
  (deps.requireTTY || requireTTY)(call);
  const files = knowledgeFiles(root);
  if (!fs.existsSync(path.join(root, '.workflows'))) {
    call.err('No .workflows/ directory found. Initialise a workflow project first.\n');
    throw new ExitSignal(1);
  }

  const rl = (deps.createPrompter || createPrompter)(call);
  let sysResult;
  try {
    call.out('\nKnowledge base setup\n');
    call.out('====================\n');
    sysResult = await runSystemConfigStep(call, rl);
    if (sysResult.provider) setup.stripProviderOverrides(call, files.config);
    await runProjectInitStep(call, files, rl);
  } finally {
    // Before indexing: a lingering prompter holds the process open.
    rl.close();
  }

  await setup.runInitialIndexStep(call, root, files);
  call.out('\nSetup complete.\n');
  if (!sysResult.provider) {
    call.out(
      '\nStub mode: no embedding provider configured. The knowledge base will run in keyword-only (BM25) mode. ' +
      'Semantic search is disabled until you configure a provider.\n'
    );
  }
}

/**
 * `setup --key-only [--provider <id>]` — the API key alone, asked for with
 * the input hidden and written straight to credentials.json (mode 0600).
 * Nothing else is touched.
 * @param {Call} call @param {Record<string, string|boolean>} flags @param {TerminalDeps} [deps]
 */
async function runKeyOnly(call, flags, deps = {}) {
  const providerId = flags.provider === undefined ? 'openai' : flags.provider;
  if (providerId !== 'openai' && providerId !== 'openai-compatible') {
    throw new setup.SetupRefusal(`--key-only supports providers openai and openai-compatible (got "${String(flags.provider)}").`);
  }
  (deps.requireTTY || requireTTY)(call);
  const rl = (deps.createPrompter || createPrompter)(call);
  const secret = deps.askSecret || ((/** @type {string} */ prompt) => askSecret(call, rl, prompt));
  try {
    call.out(`\nStoring the ${providerId} API key. Input is hidden — nothing is echoed.\n`);
    let key = '';
    while (key === '') {
      key = await secret('API key (input hidden): ');
      if (key === '') call.out('Empty input — enter the key, or Ctrl-C to abort.\n');
    }
    const credPath = config.credentialsPath();
    config.writeCredentials(credPath, providerId, key);
    call.out(`Key stored at ${credPath} (mode 0600).\n`);
  } finally {
    rl.close();
  }
}

module.exports = { runWizard, runKeyOnly };
