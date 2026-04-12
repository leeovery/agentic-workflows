'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadConfig, readConfigFile, resolveProvider, DEFAULTS } = require('../../src/knowledge/config');
const { StubProvider } = require('../../src/knowledge/embeddings');

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

  it('resolves api_key_env from environment', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { api_key_env: 'TEST_KB_KEY' } });
    const oldVal = process.env.TEST_KB_KEY;
    process.env.TEST_KB_KEY = 'sk-test-123';
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
      });
      assert.strictEqual(cfg._api_key, 'sk-test-123');
    } finally {
      if (oldVal === undefined) delete process.env.TEST_KB_KEY;
      else process.env.TEST_KB_KEY = oldVal;
    }
  });

  it('returns null api key when env var is not set', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { api_key_env: 'TEST_KB_MISSING_VAR' } });
    const oldVal = process.env.TEST_KB_MISSING_VAR;
    delete process.env.TEST_KB_MISSING_VAR;
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
      });
      assert.strictEqual(cfg._api_key, null);
    } finally {
      if (oldVal !== undefined) process.env.TEST_KB_MISSING_VAR = oldVal;
    }
  });

  it('returns null api key when env var is empty string', () => {
    const sysPath = path.join(tmpDir, 'sys.json');
    writeJSON(sysPath, { knowledge: { api_key_env: 'TEST_KB_EMPTY' } });
    const oldVal = process.env.TEST_KB_EMPTY;
    process.env.TEST_KB_EMPTY = '';
    try {
      const cfg = loadConfig({
        systemPath: sysPath,
        projectPath: path.join(tmpDir, 'proj.json'),
      });
      assert.strictEqual(cfg._api_key, null);
    } finally {
      if (oldVal === undefined) delete process.env.TEST_KB_EMPTY;
      else process.env.TEST_KB_EMPTY = oldVal;
    }
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
