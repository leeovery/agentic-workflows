'use strict';

// The suite's own guard: the hermetic environment is pinned, every node test
// file adopts it, a knowledge store built under it reaches no embedding
// provider, and Claude Code's config directory is never the developer's own.
// A future suite that forgets the module fails here rather than silently
// reading the developer's config, billing their key, or writing their
// settings.

const hermeticEnv = require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const engine = require('../../skills/workflow-engine/scripts/engine.cjs');
const { recordLaunches } = require('./knowledge-harness.cjs');
const { setupGitFixture, statePath, cleanupFixture } = require('./engine-harness.cjs');

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

/** A project whose state holds one indexable document. */
function setupProject() {
  const dir = setupGitFixture('hermetic-');
  fs.mkdirSync(statePath(dir, 'auth', 'discussion'), { recursive: true });
  fs.writeFileSync(statePath(dir, 'auth', 'manifest.json'),
    JSON.stringify({ name: 'auth', work_type: 'feature', status: 'in-progress', phases: {} }));
  fs.writeFileSync(statePath(dir, 'auth', 'discussion', 'auth.md'),
    '# Auth\n\nToken refresh is decided here.\n');
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/**
 * Index the project's one document; answers the run and the store's
 * metadata — null when no store was built.
 * @param {string} [configDir]  the system config directory, over the suite's own
 */
function indexUnderConfigDir(configDir) {
  const project = setupProject();
  try {
    const env = configDir === undefined ? {} : { WORKFLOWS_CONFIG_DIR: configDir };
    const res = engine.run(['knowledge', 'index', statePath(project, 'auth', 'discussion', 'auth.md')], { cwd: project, env });
    const metadataFile = statePath(project, '.knowledge', 'metadata.json');
    return { res, metadata: fs.existsSync(metadataFile) ? JSON.parse(fs.readFileSync(metadataFile, 'utf8')) : null };
  } finally {
    cleanupFixture(project);
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

  it('Claude Code\'s config directory is set, exists, and holds nothing — no test reaches the developer\'s own', () => {
    const dir = process.env.CLAUDE_CONFIG_DIR;
    assert.ok(dir, 'CLAUDE_CONFIG_DIR is set');
    assert.ok(fs.existsSync(dir), `${dir} exists`);
    assert.deepStrictEqual(fs.readdirSync(dir), []);
  });

  it('the provider key is unset — it wins over stored credentials, so isolating the directory is not enough', () => {
    assert.strictEqual(process.env.OPENAI_API_KEY, undefined);
  });

  it('the gate surface is unannounced — a session that loads one announces it to every command, and the goldens pin the bytes without it', () => {
    assert.strictEqual(process.env.WORKFLOWS_GATE_SURFACE, undefined);
  });

  it('the handoff is unannounced — the gate mod announces it to every command as it does the gate surface', () => {
    assert.strictEqual(process.env.WORKFLOWS_HANDOFF, undefined);
  });

  it('no Claude Code session reaches a test — every engine call marks the conversation whose id it carries', () => {
    assert.strictEqual(process.env.CLAUDE_CODE_SESSION_ID, undefined);
  });

  it('the separate Claude call runs the stub, never a real Claude — and the stub has no login until a test arms it', () => {
    assert.strictEqual(process.env.LEEWAY_CLAUDE, path.join(__dirname, 'claude-stub.sh'));
    assert.ok(fs.statSync(process.env.LEEWAY_CLAUDE).mode & 0o111, 'the stub runs as a binary');
    const res = spawnSync(process.env.LEEWAY_CLAUDE, ['-p'], { encoding: 'utf8', input: 'a question' });
    assert.strictEqual(res.status, 1, res.stderr);
    assert.strictEqual(JSON.parse(res.stdout).result, 'Not logged in · Please run /login');
  });

  it('the stub unarmed answers in the shell byte for byte as its node side does unarmed, and armed is its node side', () => {
    const ask = (/** @type {string} */ binary, /** @type {NodeJS.ProcessEnv} */ env) => {
      const res = spawnSync(binary, ['-p'], { encoding: 'utf8', input: 'a question', env });
      return [res.status, res.stdout, res.stderr];
    };
    const node = path.join(__dirname, 'claude-stub.cjs');
    assert.deepStrictEqual(ask(process.env.LEEWAY_CLAUDE, process.env), ask(node, process.env));
    const armed = { ...process.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { rules: ['One rule.'] } }) };
    assert.deepStrictEqual(ask(process.env.LEEWAY_CLAUDE, armed), ask(node, armed));
    assert.strictEqual(JSON.parse(ask(process.env.LEEWAY_CLAUDE, armed)[1]).structured_output.rules[0], 'One rule.');
  });

  it('the stub writes down its environment\'s names, and no value a test did not name — a login the environment holds never lands in its log', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-stub-log-'));
    try {
      const log = path.join(dir, 'calls.jsonl');
      const env = { ...process.env, CLAUDE_STUB_LOG: log, CLAUDE_STUB_LOG_VALUES: 'PATH', ANTHROPIC_API_KEY: 'sk-developer', CLAUDE_CODE_OAUTH_TOKEN: 'oauth-developer' };
      spawnSync(process.env.LEEWAY_CLAUDE, ['-p'], { encoding: 'utf8', input: 'a question', env });
      const text = fs.readFileSync(log, 'utf8');
      const logged = JSON.parse(text).env;
      assert.deepStrictEqual([logged.ANTHROPIC_API_KEY, logged.CLAUDE_CODE_OAUTH_TOKEN, logged.PATH], [null, null, process.env.PATH]);
      assert.ok(!text.includes('sk-developer') && !text.includes('oauth-developer'), 'a login reached the log');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('git reads no user or system config, and the display width is pinned', () => {
    assert.strictEqual(process.env.GIT_CONFIG_GLOBAL, '/dev/null');
    assert.strictEqual(process.env.GIT_CONFIG_SYSTEM, '/dev/null');
    assert.strictEqual(process.env.WORKFLOWS_DISPLAY_WIDTH, '65');
  });

  it('git runs no ssh command of the developer\'s — it would override a suite\'s stand-in for a remote, with their keys', () => {
    const res = spawnSync('node', ['-e', `require(${JSON.stringify(require.resolve(HERMETIC_MODULE))}); console.log(JSON.stringify([process.env.GIT_SSH_COMMAND ?? null, process.env.GIT_SSH ?? null]))`],
      { encoding: 'utf8', env: { ...process.env, GIT_SSH_COMMAND: 'ssh -i ~/.ssh/mine', GIT_SSH: 'plink' } });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout), [null, null]);
  });

  it('exports exactly what it pinned, for a caller composing a child environment', () => {
    assert.deepStrictEqual(hermeticEnv, {
      WORKFLOWS_CONFIG_DIR: process.env.WORKFLOWS_CONFIG_DIR,
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      WORKFLOWS_DISPLAY_WIDTH: '65',
      LEEWAY_CLAUDE: path.join(__dirname, 'claude-stub.sh'),
    });
  });

  it('a spawned process inherits the pins — every engine and knowledge call a test makes', () => {
    const res = spawnSync('node', ['-e', 'console.log(JSON.stringify({ dir: process.env.WORKFLOWS_CONFIG_DIR, claude: process.env.CLAUDE_CONFIG_DIR, key: process.env.OPENAI_API_KEY ?? null, surface: process.env.WORKFLOWS_GATE_SURFACE ?? null, handoff: process.env.WORKFLOWS_HANDOFF ?? null, session: process.env.CLAUDE_CODE_SESSION_ID ?? null, width: process.env.WORKFLOWS_DISPLAY_WIDTH, binary: process.env.LEEWAY_CLAUDE }))'],
      { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout), {
      dir: process.env.WORKFLOWS_CONFIG_DIR,
      claude: process.env.CLAUDE_CONFIG_DIR,
      key: null,
      surface: null,
      handoff: null,
      session: null,
      width: '65',
      binary: path.join(__dirname, 'claude-stub.sh'),
    });
  });
});

describe('hermetic environment — no embedding provider', () => {
  it('under the suite environment nothing configures a provider — a store no test chose is never built', () => {
    const { res, metadata } = indexUnderConfigDir();
    assert.notStrictEqual(res.code, 0);
    assert.match(res.stderr, /no embedding provider is configured and keyword-only was never chosen/);
    assert.strictEqual(metadata, null);
  });

  // The control that gives the assertion above its teeth. It names the stub
  // provider, not openai: an openai config with no resolvable key builds no
  // store either — so openai would pass whether the pin held or not — while
  // the stub needs no key and no network and still reaches the metadata.
  it('a system config naming a provider would reach the store — the pin is what keeps it out', (t) => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-control-'));
    const launched = recordLaunches(t);
    try {
      fs.writeFileSync(path.join(configDir, 'config.json'),
        JSON.stringify({ knowledge: { provider: 'stub', model: 'stub', dimensions: 128 } }));
      const { res, metadata } = indexUnderConfigDir(configDir);
      assert.strictEqual(res.code, 0, `index failed:\n${res.stdout}\n${res.stderr}`);
      assert.strictEqual(metadata.provider, 'stub');
      assert.strictEqual(launched.length, 1, 'its vectors handed to the fill');
    } finally {
      cleanup(configDir);
    }
  });
});

describe('hermetic environment — Claude Code\'s config directory', () => {
  /** The Claude Code config directory a fresh process pins, inheriting `inherited`. */
  function pinnedUnder(inherited) {
    const res = spawnSync('node', ['-e', `require(${JSON.stringify(require.resolve(HERMETIC_MODULE))}); console.log(process.env.CLAUDE_CONFIG_DIR)`],
      { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: inherited } });
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout.trim();
  }

  it('a process the suite spawns keeps the pinned directory — requiring the module twice pins once', () => {
    assert.strictEqual(pinnedUnder(process.env.CLAUDE_CONFIG_DIR), process.env.CLAUDE_CONFIG_DIR);
  });

  it('a directory holding anything — a developer\'s own — is never taken for the pin', () => {
    const own = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-claude-own-'));
    try {
      fs.writeFileSync(path.join(own, 'settings.json'), '{}\n');
      const pinned = pinnedUnder(own);
      assert.notStrictEqual(pinned, own);
      assert.notStrictEqual(pinned, '');
    } finally {
      cleanup(own);
    }
  });
});

describe('hermetic environment — the shell tiers', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')).scripts;

  /**
   * The environment a shell tier's npm script hands its suites, run from a
   * developer's own: the script's setup, everything before its loop over the
   * suites.
   */
  function tierEnv(script) {
    const setup = scripts[script].split('; for ')[0];
    const res = spawnSync('bash', ['-c', `${setup}; node -e 'console.log(JSON.stringify(process.env))'`], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/home/dev/.gitconfig', GIT_CONFIG_SYSTEM: '/etc/gitconfig', GIT_SSH_COMMAND: 'ssh -i ~/.ssh/mine', GIT_SSH: 'plink' },
    });
    assert.strictEqual(res.status, 0, res.stderr);
    return JSON.parse(res.stdout);
  }

  for (const script of ['test:cli', 'test:migrations']) {
    it(`${script} runs git with no user or system config and no ssh command of the developer's`, () => {
      const env = tierEnv(script);
      assert.deepStrictEqual(
        [env.GIT_CONFIG_GLOBAL, env.GIT_CONFIG_SYSTEM, env.GIT_SSH_COMMAND, env.GIT_SSH],
        ['/dev/null', '/dev/null', undefined, undefined],
      );
    });
  }
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
