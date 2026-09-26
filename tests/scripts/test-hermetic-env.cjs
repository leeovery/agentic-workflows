'use strict';

// The suite's own guard: the hermetic environment is pinned, every node test
// file adopts it, and a knowledge store built under it reaches no embedding
// provider. A future suite that forgets the module fails here rather than
// silently reading the developer's config and billing their key.

const hermeticEnv = require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const KNOWLEDGE = path.join(REPO, 'skills', 'workflow-knowledge', 'scripts', 'knowledge.cjs');
const HERMETIC_MODULE = './hermetic-env.cjs';

/** The module a file's first require names, comments and directives skipped. */
function firstRequired(dir, file) {
  const source = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const line of source.split('\n')) {
    const text = line.trim();
    if (!text || text.startsWith('//') || text.startsWith('/*') || text.startsWith('*')) continue;
    const required = text.match(/require\(\s*'([^']+)'/);
    if (required) return required[1];
  }
  return null;
}

/** Test files in `dir` that open with anything but the hermetic module. */
function offenders(dir) {
  return fs.readdirSync(dir)
    .filter((name) => /^test-.*\.cjs$/.test(name))
    .filter((name) => firstRequired(dir, name) !== HERMETIC_MODULE)
    .sort();
}

/** A project holding one indexable document. */
function setupProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'auth', 'discussion'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'),
    JSON.stringify({ name: 'auth', work_type: 'feature', status: 'in-progress', phases: {} }));
  fs.writeFileSync(path.join(dir, '.workflows', 'auth', 'discussion', 'auth.md'),
    '# Auth\n\nToken refresh is decided here.\n');
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/**
 * Index the project's one document; answers the run and the store's
 * metadata — null when no store was built.
 */
function indexUnderConfigDir(configDir) {
  const project = setupProject();
  try {
    const env = configDir === undefined ? process.env : { ...process.env, WORKFLOWS_CONFIG_DIR: configDir };
    const res = spawnSync('node', [KNOWLEDGE, 'index', '.workflows/auth/discussion/auth.md'],
      { cwd: project, encoding: 'utf8', env });
    const metadataFile = path.join(project, '.workflows', '.knowledge', 'metadata.json');
    return { res, metadata: fs.existsSync(metadataFile) ? JSON.parse(fs.readFileSync(metadataFile, 'utf8')) : null };
  } finally {
    cleanup(project);
  }
}

describe('hermetic environment — the pins', () => {
  it('the system config directory is set, exists, and holds nothing to read', () => {
    const dir = process.env.WORKFLOWS_CONFIG_DIR;
    assert.ok(dir, 'WORKFLOWS_CONFIG_DIR is set');
    assert.ok(fs.existsSync(dir), `${dir} exists`);
    assert.deepStrictEqual(
      ['config.json', 'credentials.json'].filter((name) => fs.existsSync(path.join(dir, name))),
      [],
      'the config directory holds neither file'
    );
  });

  it('the provider key is unset — it wins over stored credentials, so isolating the directory is not enough', () => {
    assert.strictEqual(process.env.OPENAI_API_KEY, undefined);
  });

  it('the gate surface is unannounced — a session that loads one announces it to every command, and the goldens pin the bytes without it', () => {
    assert.strictEqual(process.env.WORKFLOWS_GATE_SURFACE, undefined);
  });

  it('no Claude Code session reaches a test — every engine call marks the conversation whose id it carries', () => {
    assert.strictEqual(process.env.CLAUDE_CODE_SESSION_ID, undefined);
  });

  it('git reads no user or system config, and the display width is pinned', () => {
    assert.strictEqual(process.env.GIT_CONFIG_GLOBAL, '/dev/null');
    assert.strictEqual(process.env.GIT_CONFIG_SYSTEM, '/dev/null');
    assert.strictEqual(process.env.WORKFLOWS_DISPLAY_WIDTH, '65');
  });

  it('exports exactly what it pinned, for a caller composing a child environment', () => {
    assert.deepStrictEqual(hermeticEnv, {
      WORKFLOWS_CONFIG_DIR: process.env.WORKFLOWS_CONFIG_DIR,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      WORKFLOWS_DISPLAY_WIDTH: '65',
    });
  });

  it('a spawned process inherits the pins — every engine and knowledge call a test makes', () => {
    const res = spawnSync('node', ['-e', 'console.log(JSON.stringify({ dir: process.env.WORKFLOWS_CONFIG_DIR, key: process.env.OPENAI_API_KEY ?? null, surface: process.env.WORKFLOWS_GATE_SURFACE ?? null, session: process.env.CLAUDE_CODE_SESSION_ID ?? null, width: process.env.WORKFLOWS_DISPLAY_WIDTH }))'],
      { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout), {
      dir: process.env.WORKFLOWS_CONFIG_DIR,
      key: null,
      surface: null,
      session: null,
      width: '65',
    });
  });
});

describe('hermetic environment — no embedding provider', () => {
  it('under the suite environment nothing configures a provider — a store no test chose is never built', () => {
    const { res, metadata } = indexUnderConfigDir();
    assert.notStrictEqual(res.status, 0);
    assert.match(res.stderr, /no embedding provider is configured and keyword-only was never chosen/);
    assert.strictEqual(metadata, null);
  });

  // The control that gives the assertion above its teeth. It names the stub
  // provider, not openai: an openai config with no resolvable key builds no
  // store either — so openai would pass whether the pin held or not — while
  // the stub needs no key and no network and still reaches the metadata.
  it('a system config naming a provider would reach the store — the pin is what keeps it out', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-control-'));
    try {
      fs.writeFileSync(path.join(configDir, 'config.json'),
        JSON.stringify({ knowledge: { provider: 'stub', model: 'stub', dimensions: 128 } }));
      const { res, metadata } = indexUnderConfigDir(configDir);
      assert.strictEqual(res.status, 0, `index failed:\n${res.stdout}\n${res.stderr}`);
      assert.strictEqual(metadata.provider, 'stub');
    } finally {
      cleanup(configDir);
    }
  });
});

describe('hermetic environment — adoption', () => {
  it('every node test file requires the module before anything else', () => {
    const files = fs.readdirSync(__dirname).filter((name) => /^test-.*\.cjs$/.test(name));
    assert.ok(files.length > 50, `found ${files.length} test files — the corpus read is broken`);
    assert.deepStrictEqual(offenders(__dirname), []);
  });

  it('names the file that opens with another require', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-lint-'));
    try {
      fs.writeFileSync(path.join(dir, 'test-good.cjs'),
        `'use strict';\n\n// a header the scan walks past\nrequire('${HERMETIC_MODULE}');\nconst assert = require('node:assert');\n`);
      fs.writeFileSync(path.join(dir, 'test-bad.cjs'),
        `'use strict';\n\nconst assert = require('node:assert');\nrequire('${HERMETIC_MODULE}');\n`);
      assert.deepStrictEqual(offenders(dir), ['test-bad.cjs']);
    } finally {
      cleanup(dir);
    }
  });
});
