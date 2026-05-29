// OpenAI-compatible embedding provider — entry for any local/self-hosted
// endpoint that speaks the OpenAI /v1/embeddings wire protocol (LM Studio,
// Ollama's OpenAI shim, vLLM, LiteLLM, ...).
//
// Thin OUTER driver: validates that a base URL is present (required) and
// treats the API key as optional (local servers usually need none), builds
// the local policy, and delegates to the shared OpenAIEmbeddingsEngine.
//
// Local policy differences from cloud:
//   - sendDimensionsParam: false — most local models ignore/reject the
//     OpenAI `dimensions` request param.
//   - error context carries generic/connection remedies (no
//     platform.openai.com hints; ECONNREFUSED reads as "server not running").

'use strict';

const { OpenAIEmbeddingsEngine, AuthError } = require('./openai-engine');

class OpenAICompatibleProvider {
  /**
   * @param {{ baseUrl: string, apiKey?: string|null, model?: string, dimensions?: number }} options
   */
  constructor(options) {
    if (!options || !options.baseUrl) {
      throw new Error('OpenAICompatibleProvider: baseUrl is required');
    }
    if (!options.model) {
      throw new Error('OpenAICompatibleProvider: model is required');
    }
    if (typeof options.dimensions !== 'number' || !Number.isInteger(options.dimensions) || options.dimensions <= 0) {
      throw new Error('OpenAICompatibleProvider: dimensions must be a positive integer');
    }
    this._engine = new OpenAIEmbeddingsEngine({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey || null,
      model: options.model,
      dimensions: options.dimensions,
      sendDimensionsParam: false,
      errorContext: {
        label: 'Embeddings endpoint',
        authHint: 'The server requires an API key, or the provided key was rejected. Re-run `knowledge setup` to set one.',
        permissionHint: 'The provided API key lacks permission for this request.',
      },
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
// Setup descriptor — see openai.js for the toolkit contract. Prompts for
// base_url (required), model (required), dimensions (required positive int,
// must match the local model's native output), then a single optional key
// (Enter = none). Validates via a test embed against the endpoint.
// ---------------------------------------------------------------------------

const SETUP_DESCRIPTOR = {
  id: 'openai-compatible',
  menuLabel: 'openai-compatible',
  menuHint: 'Local/self-hosted OpenAI-compatible endpoint (LM Studio, Ollama, vLLM)',

  async collect(tk) {
    while (true) {
      let baseUrl = '';
      while (baseUrl === '') {
        baseUrl = await tk.ask('Base URL (e.g. http://localhost:1234/v1)', '');
        if (baseUrl === '') tk.out('A base URL is required for an OpenAI-compatible provider.\n');
      }

      let model = '';
      while (model === '') {
        model = await tk.ask('Embedding model', '');
        if (model === '') tk.out('A model name is required.\n');
      }

      const dimensions = await tk.askDimensions(
        'Vector dimensions (must match the model native output)',
        null
      );

      tk.out('\nAPI key is optional — press Enter if your local provider does not need one.\n');
      const keyInput = await tk.askSecret('API key (input hidden, optional): ');
      const key = keyInput === '' ? null : keyInput;

      const remedies = {
        auth:
          'The server requires an API key, or the key was rejected. Enter one and retry, ' +
          'or leave it empty if the server is open.',
        permission: 'The provided API key lacks permission for embeddings on this server.',
        connRefused:
          `No server is listening at ${baseUrl}. Start your local embeddings server ` +
          '(LM Studio, Ollama, vLLM, ...) and confirm the base URL, then retry.',
        network:
          `Could not reach ${baseUrl}. Check the host and port, and that the server is running.`,
        unknown:
          'The endpoint did not respond as expected. Confirm it exposes an OpenAI-compatible ' +
          '/v1/embeddings route and that the model name and dimensions are correct.',
      };

      tk.out('\nValidating via a test embed...\n');
      try {
        await tk.validate(
          new OpenAICompatibleProvider({ baseUrl, apiKey: key, model, dimensions }),
          dimensions
        );
      } catch (err) {
        const { message, hint } = tk.describeError(err, remedies);
        tk.out(`${message}\n  ${hint}\n\n`);
        const retry = await tk.askYesNo('Try again with different settings?', true);
        if (!retry) {
          tk.out('Falling back to stub mode — semantic search disabled.\n');
          return { stub: true };
        }
        continue;
      }

      tk.out('Embeddings endpoint works.\n');
      return {
        knowledgeConfig: tk.buildSystemConfig({
          provider: 'openai-compatible',
          base_url: baseUrl,
          model,
          dimensions,
        }),
        key,
      };
    }
  },
};

module.exports = {
  OpenAICompatibleProvider,
  AuthError,
  SETUP_DESCRIPTOR,
};
