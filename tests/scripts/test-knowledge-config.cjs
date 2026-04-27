'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig,
  readConfigFile,
  resolveProvider,
  writeConfigFile,
  loadCredentials,
  writeCredentials,
  resolveApiKey,
  DEFAULTS,
  PROVIDER_ENV_VARS,
} = require('../../src/knowledge/config');
const { StubProvider } = require('../../src/knowledge/embeddings');
const {
  buildSystemConfigOpenAI,
  buildSystemConfigStub,
  buildProjectConfigEmpty,
  detectSystemConfig,
  detectProjectInit,
  describeValidationError,
} = require('../../src/knowledge/setup');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-config-'));
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// readConfigFile
// ---------------------------------------------------------------------------

describe('readConfigFile', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns null when file does not exist', () => {
    const result = readConfigFile(path.join(tmpDir, 'missing.json'));
    assert.strictEqual(result, null);
  });

  it('reads a config file with the knowledge wrapper and returns unwrapped object', () => {
    const filePath = path.join(tmpDir, 'config.json');
    writeJSON(filePath, { knowledge: { provider: 'openai', model: 'text-embedding-3-small' } });
    const result = readConfigFile(filePath);
    assert.deepStrictEqual(result, { provider: 'openai', model: 'text-embedding-3-small' });
  });

  it('throws for config file missing the knowledge wrapper', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    writeJSON(filePath, { provider: 'openai' });
    assert.throws(() => readConfigFile(filePath), /missing the required top-level "knowledge" key/);
  });

  it('throws for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'broken.json');
    fs.writeFileSync(filePath, '{not json', 'utf8');
    assert.throws(() => readConfigFile(filePath), /Invalid JSON/);
  });

  it('throws when knowledge key is not an object', () => {
    const filePath = path.join(tmpDir, 'array.json');
    writeJSON(filePath, { knowledge: [1, 2, 3] });
    assert.throws(() => readConfigFile(filePath), /must be an object/);
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns defaults when no config files exist', () => {
    const cfg = loadConfig({
      systemPath: path.join(tmpDir, 'sys.json'),
      projectPath: path.join(tmpDir, 'proj.json'),
    });
    assert.strictEqual(cfg.similarity_threshold, DEFAULTS.similarity_threshold);
    assert.strictEqual(cfg.decay_months, DEFAULTS.decay_months);
    assert.strictEqual(cfg.provider, undefined);
    assert.strictEqual(cfg._api_key, null);
  });

  it('reads system config when project config is absent', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { provider: 'stub', dimensions: 256 } });
    const cfg = loadConfig({
      systemPath: sysPath,
      projectPath: path.join(tmpDir, 'proj.json'),
    });
    assert.strictEqual(cfg.provider, 'stub');
    assert.strictEqual(cfg.dimensions, 256);
  });

  it('reads project config when system config is absent', () => {
    const projPath = path.join(tmpDir, 'proj.json');
    writeJSON(projPath, { knowledge: { provider: 'stub', decay_months: 12 } });
    const cfg = loadConfig({
      systemPath: path.join(tmpDir, 'sys.json'),
      projectPath: projPath,
    });
    assert.strictEqual(cfg.provider, 'stub');
    assert.strictEqual(cfg.decay_months, 12);
  });

  it('merges system and project configs with project taking precedence', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    const projPath = path.join(tmpDir, 'proj.json');
    writeJSON(sysPath, { knowledge: { provider: 'stub', dimensions: 128, decay_months: 6 } });
    writeJSON(projPath, { knowledge: { dimensions: 256 } });
    const cfg = loadConfig({ systemPath: sysPath, projectPath: projPath });
    assert.strictEqual(cfg.provider, 'stub');
    assert.strictEqual(cfg.dimensions, 256); // project overrides
    assert.strictEqual(cfg.decay_months, 6); // system falls through
  });

  it('resolves api key from OPENAI_API_KEY when provider is openai', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { provider: 'openai' } });
    const oldVal = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-123';
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
        credentialsPath: path.join(tmpDir, 'credentials.json'),
      });
      assert.strictEqual(cfg._api_key, 'sk-test-123');
    } finally {
      if (oldVal === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('returns null api key when env var is not set and no credentials file', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { provider: 'openai' } });
    const oldVal = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
        credentialsPath: path.join(tmpDir, 'credentials.json'),
      });
      assert.strictEqual(cfg._api_key, null);
    } finally {
      if (oldVal !== undefined) process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('returns null api key when env var is empty string and no credentials file', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { provider: 'openai' } });
    const oldVal = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
        credentialsPath: path.join(tmpDir, 'credentials.json'),
      });
      assert.strictEqual(cfg._api_key, null);
    } finally {
      if (oldVal === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('falls back to credentials file when env var is not set', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    const credPath = path.join(tmpDir, 'credentials.json');
    writeJSON(sysPath, { knowledge: { provider: 'openai' } });
    writeJSON(credPath, { credentials: { openai: { api_key: 'sk-from-file' } } });
    const oldVal = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
        credentialsPath: credPath,
      });
      assert.strictEqual(cfg._api_key, 'sk-from-file');
    } finally {
      if (oldVal !== undefined) process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('env var wins over credentials file when both are set', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    const credPath = path.join(tmpDir, 'credentials.json');
    writeJSON(sysPath, { knowledge: { provider: 'openai' } });
    writeJSON(credPath, { credentials: { openai: { api_key: 'sk-from-file' } } });
    const oldVal = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-from-env';
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
        credentialsPath: credPath,
      });
      assert.strictEqual(cfg._api_key, 'sk-from-env');
    } finally {
      if (oldVal === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('returns null api key when provider is not configured', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: {} });
    const cfg = loadConfig({
      systemPath: sysPath,
      projectPath: path.join(tmpDir, 'proj.json'),
      credentialsPath: path.join(tmpDir, 'credentials.json'),
    });
    assert.strictEqual(cfg._api_key, null);
  });

  it('ignores unknown fields without error (forward compatibility)', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { provider: 'stub', future_field: 'whatever' } });
    const cfg = loadConfig({
      systemPath: sysPath,
      projectPath: path.join(tmpDir, 'proj.json'),
    });
    assert.strictEqual(cfg.provider, 'stub');
    assert.strictEqual(cfg.future_field, 'whatever');
  });
});

// ---------------------------------------------------------------------------
// resolveProvider
// ---------------------------------------------------------------------------

describe('resolveProvider', () => {
  it('returns StubProvider when provider is stub', () => {
    const provider = resolveProvider({ provider: 'stub' });
    assert.ok(provider instanceof StubProvider);
    assert.strictEqual(provider.dimensions(), 128); // default
  });

  it('StubProvider respects custom dimensions from config', () => {
    const provider = resolveProvider({ provider: 'stub', dimensions: 256 });
    assert.ok(provider instanceof StubProvider);
    assert.strictEqual(provider.dimensions(), 256);
  });

  it('StubProvider does not need an API key', () => {
    const provider = resolveProvider({ provider: 'stub', _api_key: null });
    assert.ok(provider instanceof StubProvider);
  });

  it('returns null when no provider field is configured (keyword-only mode)', () => {
    const provider = resolveProvider({});
    assert.strictEqual(provider, null);
  });

  it('returns null when provider is undefined (keyword-only mode)', () => {
    const provider = resolveProvider({ provider: undefined, _api_key: null });
    assert.strictEqual(provider, null);
  });

  it('errors for unknown provider names', () => {
    assert.throws(
      () => resolveProvider({ provider: 'nonexistent', _api_key: 'sk-123' }),
      /not available/
    );
  });

  it('returns null when api_key_env resolves to empty (keyword-only mode)', () => {
    // This only applies to known but unimplemented providers. In Phase 3,
    // only stub is available and stub doesn't need a key. But the function
    // must handle the pattern: provider is known + key is absent = null.
    // Since openai is not in AVAILABLE_PROVIDERS yet, this will throw.
    // We test the null-provider path instead.
    const provider = resolveProvider({ _api_key: null });
    assert.strictEqual(provider, null);
  });

  it('throws when config is not an object', () => {
    assert.throws(() => resolveProvider(null), /config is required/);
    assert.throws(() => resolveProvider(undefined), /config is required/);
  });
});

// ---------------------------------------------------------------------------
// loadCredentials
// ---------------------------------------------------------------------------

describe('loadCredentials', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns null when the file does not exist', () => {
    const result = loadCredentials(path.join(tmpDir, 'missing.json'));
    assert.strictEqual(result, null);
  });

  it('reads a credentials file and returns the unwrapped credentials object', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    writeJSON(filePath, { credentials: { openai: { api_key: 'sk-123' } } });
    const result = loadCredentials(filePath);
    assert.deepStrictEqual(result, { openai: { api_key: 'sk-123' } });
  });

  it('throws for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, '{not json', 'utf8');
    assert.throws(() => loadCredentials(filePath), /Invalid JSON/);
  });

  it('throws when credentials key is missing', () => {
    const filePath = path.join(tmpDir, 'nowrap.json');
    writeJSON(filePath, { openai: { api_key: 'sk-x' } });
    assert.throws(() => loadCredentials(filePath), /missing the required top-level "credentials" object/);
  });

  it('throws when credentials key is not an object', () => {
    const filePath = path.join(tmpDir, 'arr.json');
    writeJSON(filePath, { credentials: [] });
    assert.throws(() => loadCredentials(filePath), /missing the required top-level "credentials" object/);
  });
});

// ---------------------------------------------------------------------------
// writeCredentials
// ---------------------------------------------------------------------------

describe('writeCredentials', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('writes a credentials file with the expected shape', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    writeCredentials(filePath, 'openai', 'sk-123');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepStrictEqual(parsed, { credentials: { openai: { api_key: 'sk-123' } } });
  });

  it('writes the file with mode 0600 (user-private)', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    writeCredentials(filePath, 'openai', 'sk-123');
    const stat = fs.statSync(filePath);
    // Extract the permission bits from the mode — drop higher bits.
    const mode = stat.mode & 0o777;
    assert.strictEqual(mode, 0o600);
  });

  it('creates parent directories when they do not exist', () => {
    const filePath = path.join(tmpDir, 'nested', 'a', 'credentials.json');
    writeCredentials(filePath, 'openai', 'sk-1');
    assert.ok(fs.existsSync(filePath));
  });

  it('merges with existing credentials (no clobber)', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    writeCredentials(filePath, 'openai', 'sk-openai');
    writeCredentials(filePath, 'anthropic', 'sk-anthropic');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(parsed.credentials.openai.api_key, 'sk-openai');
    assert.strictEqual(parsed.credentials.anthropic.api_key, 'sk-anthropic');
  });

  it('removes a provider entry when apiKey is null', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    writeCredentials(filePath, 'openai', 'sk-openai');
    writeCredentials(filePath, 'anthropic', 'sk-anthropic');
    writeCredentials(filePath, 'openai', null);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(parsed.credentials.openai, undefined);
    assert.strictEqual(parsed.credentials.anthropic.api_key, 'sk-anthropic');
  });

  it('uses atomic write (no .tmp left behind on success)', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    writeCredentials(filePath, 'openai', 'sk-1');
    assert.ok(!fs.existsSync(filePath + '.tmp'));
  });

  it('rejects a missing provider name', () => {
    const filePath = path.join(tmpDir, 'credentials.json');
    assert.throws(() => writeCredentials(filePath, '', 'sk-1'), /provider name is required/);
    assert.throws(() => writeCredentials(filePath, null, 'sk-1'), /provider name is required/);
  });
});

// ---------------------------------------------------------------------------
// resolveApiKey — precedence (env wins) and fallback behaviour
// ---------------------------------------------------------------------------

describe('resolveApiKey', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns the env var value when set', () => {
    const oldVal = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env';
    try {
      const credPath = path.join(tmpDir, 'credentials.json');
      const k = resolveApiKey('openai', { credentialsPath: credPath });
      assert.strictEqual(k, 'sk-env');
    } finally {
      if (oldVal === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('falls back to credentials file when env var is not set', () => {
    const oldVal = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const credPath = path.join(tmpDir, 'credentials.json');
    writeJSON(credPath, { credentials: { openai: { api_key: 'sk-file' } } });
    try {
      const k = resolveApiKey('openai', { credentialsPath: credPath });
      assert.strictEqual(k, 'sk-file');
    } finally {
      if (oldVal !== undefined) process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('returns null when neither source provides a key', () => {
    const oldVal = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const credPath = path.join(tmpDir, 'credentials.json');
      const k = resolveApiKey('openai', { credentialsPath: credPath });
      assert.strictEqual(k, null);
    } finally {
      if (oldVal !== undefined) process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('returns null for providers with no registered env var', () => {
    const k = resolveApiKey('unknown-provider', {
      credentialsPath: path.join(tmpDir, 'credentials.json'),
    });
    assert.strictEqual(k, null);
  });

  it('returns null when provider is missing/empty', () => {
    assert.strictEqual(resolveApiKey(null), null);
    assert.strictEqual(resolveApiKey(''), null);
  });

  it('treats a whitespace-only env var as unset and falls back to file', () => {
    const oldVal = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '   ';
    const credPath = path.join(tmpDir, 'credentials.json');
    writeJSON(credPath, { credentials: { openai: { api_key: 'sk-file' } } });
    try {
      const k = resolveApiKey('openai', { credentialsPath: credPath });
      assert.strictEqual(k, 'sk-file');
    } finally {
      if (oldVal === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldVal;
    }
  });

  it('returns null when credentials file is corrupt (swallowed, not thrown)', () => {
    const oldVal = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const credPath = path.join(tmpDir, 'credentials.json');
    fs.writeFileSync(credPath, '{not json', 'utf8');
    try {
      const k = resolveApiKey('openai', { credentialsPath: credPath });
      assert.strictEqual(k, null);
    } finally {
      if (oldVal !== undefined) process.env.OPENAI_API_KEY = oldVal;
    }
  });
});

describe('PROVIDER_ENV_VARS', () => {
  it('maps openai to OPENAI_API_KEY', () => {
    assert.strictEqual(PROVIDER_ENV_VARS.openai, 'OPENAI_API_KEY');
  });
});

// ---------------------------------------------------------------------------
// writeConfigFile
// ---------------------------------------------------------------------------

describe('writeConfigFile', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('writes a well-formed JSON file with the knowledge wrapper', () => {
    const filePath = path.join(tmpDir, 'nested', 'config.json');
    writeConfigFile(filePath, { knowledge: { provider: 'openai', dimensions: 1536 } });
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepStrictEqual(parsed, { knowledge: { provider: 'openai', dimensions: 1536 } });
  });

  it('creates parent directories when they do not exist', () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c', 'config.json');
    writeConfigFile(filePath, { knowledge: {} });
    assert.ok(fs.existsSync(filePath));
  });

  it('uses atomic write (no .tmp left behind on success)', () => {
    const filePath = path.join(tmpDir, 'config.json');
    writeConfigFile(filePath, { knowledge: {} });
    assert.ok(fs.existsSync(filePath));
    assert.ok(!fs.existsSync(filePath + '.tmp'));
  });

  it('rejects payloads missing the knowledge wrapper', () => {
    const filePath = path.join(tmpDir, 'config.json');
    assert.throws(() => writeConfigFile(filePath, { provider: 'openai' }), /knowledge/);
  });

  it('overwrites an existing file', () => {
    const filePath = path.join(tmpDir, 'config.json');
    writeConfigFile(filePath, { knowledge: { provider: 'stub' } });
    writeConfigFile(filePath, { knowledge: { provider: 'openai' } });
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(parsed.knowledge.provider, 'openai');
  });
});

// ---------------------------------------------------------------------------
// Setup config builders
// ---------------------------------------------------------------------------

describe('buildSystemConfigOpenAI', () => {
  it('produces a config with provider, model, dimensions, and defaults (no api_key_env)', () => {
    const cfg = buildSystemConfigOpenAI({
      model: 'text-embedding-3-small',
      dimensions: 1536,
    });
    assert.strictEqual(cfg.knowledge.provider, 'openai');
    assert.strictEqual(cfg.knowledge.model, 'text-embedding-3-small');
    assert.strictEqual(cfg.knowledge.dimensions, 1536);
    assert.strictEqual(cfg.knowledge.api_key_env, undefined);
    assert.strictEqual(cfg.knowledge.similarity_threshold, DEFAULTS.similarity_threshold);
    assert.strictEqual(cfg.knowledge.decay_months, DEFAULTS.decay_months);
  });
});

describe('buildSystemConfigStub', () => {
  it('produces a stub-mode config with no provider field', () => {
    const cfg = buildSystemConfigStub();
    assert.strictEqual(cfg.knowledge.provider, undefined);
    assert.strictEqual(cfg.knowledge.model, undefined);
    assert.strictEqual(cfg.knowledge.dimensions, undefined);
    assert.strictEqual(cfg.knowledge.api_key_env, undefined);
    assert.strictEqual(cfg.knowledge.similarity_threshold, DEFAULTS.similarity_threshold);
    assert.strictEqual(cfg.knowledge.decay_months, DEFAULTS.decay_months);
  });

  it('round-trips through loadConfig as keyword-only (no provider)', () => {
    // Writing the stub config to disk then loading it should produce a
    // config where resolveProvider returns null — the keyword-only path.
    const sysPath = path.join(tmpDir, 'sys.json');
    writeConfigFile(sysPath, buildSystemConfigStub());
    const cfg = loadConfig({
      systemPath: sysPath,
      projectPath: path.join(tmpDir, 'proj.json'),
    });
    assert.strictEqual(cfg.provider, undefined);
    assert.strictEqual(resolveProvider(cfg), null);
  });
});

describe('buildProjectConfigEmpty', () => {
  it('produces { knowledge: {} } for inheritance from system', () => {
    const cfg = buildProjectConfigEmpty();
    assert.deepStrictEqual(cfg, { knowledge: {} });
  });
});

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

describe('detectSystemConfig', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('reports exists=false when the file is missing', () => {
    const result = detectSystemConfig(path.join(tmpDir, 'missing.json'));
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.knowledge, null);
  });

  it('reports exists=true, valid=true for a well-formed config', () => {
    const filePath = path.join(tmpDir, 'sys.json');
    writeJSON(filePath, { knowledge: { provider: 'openai' } });
    const result = detectSystemConfig(filePath);
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.knowledge, { provider: 'openai' });
  });

  it('reports exists=true, valid=false for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, '{not json', 'utf8');
    const result = detectSystemConfig(filePath);
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason);
  });

  it('reports exists=true, valid=false for missing knowledge wrapper', () => {
    const filePath = path.join(tmpDir, 'nowrap.json');
    writeJSON(filePath, { provider: 'openai' });
    const result = detectSystemConfig(filePath);
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.valid, false);
  });

  it('reports exists=true, valid=false when knowledge is an array', () => {
    const filePath = path.join(tmpDir, 'arr.json');
    writeJSON(filePath, { knowledge: [1, 2, 3] });
    const result = detectSystemConfig(filePath);
    assert.strictEqual(result.valid, false);
  });
});

describe('describeValidationError', () => {
  it('maps 401 to an invalid-key hint', () => {
    const { message, hint } = describeValidationError(new Error('OpenAI API key is invalid or expired. Check your OPENAI_API_KEY environment variable.'));
    assert.match(message, /rejected/i);
    assert.match(hint, /active|revoked|create a fresh key/i);
  });

  it('maps 429 to a rate-limit hint', () => {
    const { message, hint } = describeValidationError(new Error('OpenAI rate limit exceeded (HTTP 429).'));
    assert.match(message, /rate limit/i);
    assert.match(hint, /quota|retry/i);
  });

  it('maps network errors to a connection hint', () => {
    const { message, hint } = describeValidationError(new Error('OpenAI embedding request failed (network error): fetch failed'));
    assert.match(message, /Could not reach OpenAI/i);
    assert.match(hint, /connection|VPN|proxy/i);
  });

  it('maps 5xx to a transient-server hint', () => {
    const { message, hint } = describeValidationError(new Error('OpenAI embedding request failed (HTTP 503): service unavailable'));
    assert.match(message, /server error/i);
    assert.match(hint, /retry/i);
  });

  it('falls back to a generic message for unknown errors', () => {
    const { message, hint } = describeValidationError(new Error('something weird happened'));
    assert.match(message, /validation failed/i);
    assert.match(hint, /something weird happened/);
  });
});

describe('detectProjectInit', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('reports all-absent when the directory does not exist', () => {
    const result = detectProjectInit(path.join(tmpDir, '.workflows', '.knowledge'));
    assert.strictEqual(result.dirExists, false);
    assert.strictEqual(result.configExists, false);
    assert.strictEqual(result.storeExists, false);
    assert.strictEqual(result.metadataExists, false);
    assert.strictEqual(result.fullyInitialised, false);
    assert.strictEqual(result.partiallyInitialised, false);
  });

  it('reports partiallyInitialised when the directory exists but files are missing', () => {
    const dir = path.join(tmpDir, '.workflows', '.knowledge');
    fs.mkdirSync(dir, { recursive: true });
    const result = detectProjectInit(dir);
    assert.strictEqual(result.dirExists, true);
    assert.strictEqual(result.fullyInitialised, false);
    assert.strictEqual(result.partiallyInitialised, true);
  });

  it('reports partiallyInitialised when only some files are present', () => {
    const dir = path.join(tmpDir, '.workflows', '.knowledge');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), '{}', 'utf8');
    const result = detectProjectInit(dir);
    assert.strictEqual(result.configExists, true);
    assert.strictEqual(result.storeExists, false);
    assert.strictEqual(result.fullyInitialised, false);
    assert.strictEqual(result.partiallyInitialised, true);
  });

  it('reports fullyInitialised when all three files exist', () => {
    const dir = path.join(tmpDir, '.workflows', '.knowledge');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(dir, 'store.msp'), '', 'utf8');
    fs.writeFileSync(path.join(dir, 'metadata.json'), '{}', 'utf8');
    const result = detectProjectInit(dir);
    assert.strictEqual(result.fullyInitialised, true);
    assert.strictEqual(result.partiallyInitialised, false);
  });
});
