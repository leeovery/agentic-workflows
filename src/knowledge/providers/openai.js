// OpenAI embedding provider — public cloud entry for the /v1/embeddings API.
//
// Thin OUTER driver: validates that an API key is present (cloud requires
// one), builds the cloud policy, and delegates the four-method interface to
// the shared OpenAIEmbeddingsEngine. The wire logic lives in the engine so
// it stays single-source across this and the openai-compatible driver.
//
// Re-exports AuthError, DEFAULT_MODEL and DEFAULT_DIMENSIONS for the tests that
// import them from this module.

'use strict';

const { OpenAIEmbeddingsEngine, AuthError } = require('./openai-engine');

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Cloud error context — keeps the platform.openai.com remedies and the
// `knowledge setup` hint that the existing tests assert on.
const OPENAI_ERROR_CONTEXT = {
  label: 'OpenAI',
  authHint: 'The API key is invalid or expired. Run `knowledge setup` to fix.',
  permissionHint: 'The API key lacks permission for this request. Run `knowledge setup` to fix.',
};

class OpenAIProvider {
  /**
   * @param {{ apiKey: string, model?: string, dimensions?: number }} options
   */
  constructor(options) {
    if (!options || !options.apiKey) {
      throw new Error('OpenAIProvider: apiKey is required');
    }
    const dimensions = typeof options.dimensions === 'number'
      ? options.dimensions
      : DEFAULT_DIMENSIONS;
    this._engine = new OpenAIEmbeddingsEngine({
      baseUrl: OPENAI_BASE_URL,
      apiKey: options.apiKey,
      model: options.model || DEFAULT_MODEL,
      dimensions,
      sendDimensionsParam: true,
      errorContext: OPENAI_ERROR_CONTEXT,
    });
  }

  embed(text) {
    return this._engine.embed(text);
  }

  embedBatch(texts) {
    return this._engine.embedBatch(texts);
  }

  dimensions() {
    return this._engine.dimensions();
  }

  model() {
    return this._engine.model();
  }
}

// ---------------------------------------------------------------------------
// Setup descriptor — drives the `knowledge setup` provider menu and the
// prompt/validate/retry flow for this driver. Readline-free: every IO and
// config helper is supplied via the injected toolkit (tk), so the driver is
// unit-testable against a fake prompter. collect() returns either
// { knowledgeConfig, key } (key=null means "do not persist") or { stub:true }
// to fall back to keyword-only mode.
// ---------------------------------------------------------------------------

const OPENAI_REMEDIES = {
  auth:
    'Check that the key is active and not revoked. Free-tier keys also need billing enabled ' +
    'for /v1/embeddings. Create a fresh key at https://platform.openai.com/api-keys and try again.',
  permission:
    'If this is a restricted key, check its allowed endpoints in the OpenAI dashboard. ' +
    'Create a key with Embeddings access enabled.',
  rateLimit:
    'Your account may be out of quota, or the default rate limit is saturated. ' +
    'Wait a moment and retry, or check billing at https://platform.openai.com/account.',
  network:
    'Check your internet connection, VPN, or corporate proxy. No key was written — ' +
    'you can re-run `knowledge setup` once the connection is stable.',
  server5xx: 'Transient on their side. Retry in a minute.',
};

const SETUP_DESCRIPTOR = {
  id: 'openai',
  menuLabel: 'openai',
  menuHint: 'OpenAI embeddings API (requires an API key)',

  async collect(tk) {
    const model = await tk.ask('Embedding model', DEFAULT_MODEL);
    const dimensions = await tk.askDimensions('Vector dimensions', DEFAULT_DIMENSIONS);
    const envVar = tk.envVarName('openai');

    const build = () => tk.buildSystemConfig({ provider: 'openai', model, dimensions });

    // 1. Env var wins. Nothing is persisted — env is authoritative.
    const fromEnv = tk.envKey('openai');
    if (fromEnv) {
      tk.out(`\nUsing API key from $${envVar} — validating via a test embed...\n`);
      try {
        await tk.validate(new OpenAIProvider({ apiKey: fromEnv, model, dimensions }), dimensions);
        tk.out('API key works.\n');
        return { knowledgeConfig: build(), key: null };
      } catch (err) {
        const { message, hint } = tk.describeError(err, OPENAI_REMEDIES);
        tk.fail(
          `\n${message}\n  ${hint}\n` +
          `The failing key came from $${envVar}. Fix or unset it in your shell, then re-run \`knowledge setup\`.\n`
        );
      }
    }

    // 2. Existing stored key. Validate; let the user replace it if broken.
    const fromFile = tk.storedKey('openai');
    if (fromFile) {
      tk.out('\nFound an existing API key — validating via a test embed...\n');
      try {
        await tk.validate(new OpenAIProvider({ apiKey: fromFile, model, dimensions }), dimensions);
        tk.out('API key works.\n');
        return { knowledgeConfig: build(), key: null };
      } catch (err) {
        const { message, hint } = tk.describeError(err, OPENAI_REMEDIES);
        tk.out(`${message}\n  ${hint}\n`);
        const replace = await tk.askYesNo('Enter a new key to replace it?', true);
        if (!replace) {
          tk.fail(
            '\nKeeping the existing stored key would leave setup in an inconsistent state.\n' +
            'Re-run `knowledge setup` when you have a new key.\n'
          );
        }
        // Fall through to the prompt path to collect a replacement.
      }
    }

    // 3. No valid key anywhere — prompt inline and (via dispatcher) store.
    tk.out(
      '\nOpenAI API Key\n' +
      '--------------\n' +
      'Semantic search in the knowledge base relies on OpenAI embeddings.\n' +
      'We recommend creating a dedicated key for this tool so you can rotate\n' +
      'or revoke it independently from other integrations.\n' +
      '\n' +
      '  1. Create a key: https://platform.openai.com/api-keys\n' +
      '     (Suggested name: "agentic-workflows")\n' +
      '  2. Paste the full key (starting with "sk-") at the prompt below.\n' +
      '\n' +
      `Setting $${envVar} in your shell takes precedence and overrides the\n` +
      'stored key, so you can swap it without editing the file.\n\n'
    );

    while (true) {
      const key = await tk.askSecret('API key (input hidden): ');
      if (key === '') {
        tk.out('Empty input — enter the key, or Ctrl-C to abort setup.\n\n');
        continue;
      }
      tk.out('\nValidating via a test embed...\n');
      try {
        await tk.validate(new OpenAIProvider({ apiKey: key, model, dimensions }), dimensions);
      } catch (err) {
        const { message, hint } = tk.describeError(err, OPENAI_REMEDIES);
        tk.out(`${message}\n  ${hint}\n\n`);
        const retry = await tk.askYesNo('Try a different key?', true);
        if (!retry) {
          tk.out(
            'No key stored. Falling back to stub mode — semantic search disabled.\n' +
            `Set $${envVar} in your shell or re-run \`knowledge setup\` once you have a working key.\n`
          );
          return { stub: true };
        }
        continue;
      }
      tk.out('API key works.\n');
      return { knowledgeConfig: build(), key };
    }
  },
};

module.exports = {
  OpenAIProvider,
  AuthError,
  DEFAULT_MODEL,
  DEFAULT_DIMENSIONS,
  SETUP_DESCRIPTOR,
};
