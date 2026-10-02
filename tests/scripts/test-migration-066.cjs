'use strict';

//
// Tests for migration 066: remove-user-function-hooks-flag (.cjs)
//
// Happy path (the key removed whatever its value, `env` with it when
// emptied), the key beside other env keys, content preservation (every other
// key, Claude Code's serialisation), skip/no-op (no file, no env, no key),
// the malformed-file guards (unparseable, a non-object root, a non-object
// env), idempotency, the write through a symlink, the file's mode, a write
// that fails, the addendum the summary reads, and where the file is — in
// CLAUDE_CONFIG_DIR, else the home's `.claude`. Every test points both at a
// fresh temp directory, so none reaches the developer's own settings.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/066-remove-user-function-hooks-flag.cjs');

const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const HOOKS = { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] };

let root, configDir, home, project, saved, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: project, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

const settingsFile = () => path.join(configDir, 'settings.json');
/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function writeSettings(content, file = settingsFile()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : json(content));
}

const readText = (file = settingsFile()) => fs.readFileSync(file, 'utf8');

describe('migration 066: remove the function-hooks flag from the user\'s Claude Code settings', () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-066-'));
    configDir = path.join(root, 'claude-config');
    home = path.join(root, 'home');
    project = path.join(root, 'project');
    fs.mkdirSync(project);
    saved = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, HOME: process.env.HOME };
    process.env.CLAUDE_CONFIG_DIR = configDir;
    process.env.HOME = home;
    updates = 0;
    skips = 0;
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('happy path — "1" goes, and `env` with it when nothing else is left', () => {
    writeSettings({ hooks: HOOKS, env: { [FLAG]: '1' } });
    run();
    assert.strictEqual(readText(), json({ hooks: HOOKS }));
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('any value goes — Claude Code ignores the key whatever it says', () => {
    for (const value of ['0', 'true', '', 1, true, null]) {
      writeSettings({ env: { [FLAG]: value } });
      run();
      assert.strictEqual(readText(), json({}), JSON.stringify(value));
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 6, skips: 0 });
  });

  it('the key beside other env keys — they stand, in order', () => {
    writeSettings({ env: { EDITOR: 'vim', [FLAG]: '0', PAGER: 'less' } });
    run();
    assert.strictEqual(readText(), json({ env: { EDITOR: 'vim', PAGER: 'less' } }));
    assert.strictEqual(updates, 1);
  });

  it('every other key stands, in place and in Claude Code\'s serialisation', () => {
    const permissions = { allow: ['Bash(ls)'] };
    writeSettings({ model: 'opus', permissions, env: { [FLAG]: '1' }, hooks: HOOKS, theme: 'dark' });
    run();
    assert.strictEqual(readText(), json({ model: 'opus', permissions, hooks: HOOKS, theme: 'dark' }));
  });

  it('a removal hands the session an addendum naming the file for the summary', () => {
    writeSettings({ env: { [FLAG]: '1' } });
    const ret = run();
    assert.ok(ret && typeof ret.verify === 'string', 'an addendum');
    assert.ok(ret.verify.includes(settingsFile()), ret.verify);
    assert.match(ret.verify, /outside this project/);
    assert.match(MIGRATION.info, /never staged or committed/);
  });

  it('no settings file — skip, no addendum, and nothing is made', () => {
    assert.strictEqual(run(), undefined);
    assert.ok(!fs.existsSync(configDir), 'the config directory not made');
    assert.ok(!fs.existsSync(home), 'nor the home');
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('no env, or an env without the key — skip, the file untouched byte for byte', () => {
    for (const content of ['{"model":"opus"}', '{\n  "env": {\n    "EDITOR": "vim"\n  }\n}']) {
      writeSettings(content);
      assert.strictEqual(run(), undefined);
      assert.strictEqual(readText(), content);
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 2 });
  });

  it('a file that does not parse, a root that is not an object, an env that is not an object — skip, untouched', () => {
    for (const content of ['{not json', '[]\n', 'null\n', `{"env":["${FLAG}"]}`, '{"env":"1"}']) {
      writeSettings(content);
      run();
      assert.strictEqual(readText(), content);
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 5 });
  });

  it('idempotent — a second run finds nothing to remove', () => {
    writeSettings({ env: { EDITOR: 'vim', [FLAG]: '1' } });
    run();
    const once = readText();
    assert.strictEqual(run(), undefined);
    assert.strictEqual(readText(), once);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 1 });
  });

  it('a symlinked settings file is written at the file it names — the link stands', () => {
    const target = path.join(root, 'dotfiles', 'claude-settings.json');
    writeSettings({ model: 'opus', env: { [FLAG]: '1' } }, target);
    fs.mkdirSync(configDir, { recursive: true });
    fs.symlinkSync(target, settingsFile());
    run();
    assert.ok(fs.lstatSync(settingsFile()).isSymbolicLink(), 'still a link');
    assert.strictEqual(fs.readlinkSync(settingsFile()), target);
    assert.strictEqual(readText(target), json({ model: 'opus' }));
    assert.deepStrictEqual(fs.readdirSync(path.dirname(target)), ['claude-settings.json'], 'no temp file left beside it');
    assert.strictEqual(updates, 1);
  });

  it('the file keeps its permission mode', () => {
    for (const mode of [0o600, 0o644]) {
      writeSettings({ model: 'opus', env: { [FLAG]: '1' } });
      fs.chmodSync(settingsFile(), mode);
      run();
      assert.strictEqual(readText(), json({ model: 'opus' }));
      assert.strictEqual(fs.statSync(settingsFile()).mode & 0o777, mode, mode.toString(8));
    }
    assert.deepStrictEqual(fs.readdirSync(configDir), ['settings.json'], 'no temp file left behind');
  });

  it('a file that cannot be written — skip, no addendum, left as found, never a throw', () => {
    const content = json({ env: { [FLAG]: '1' } });
    writeSettings(content);
    fs.chmodSync(configDir, 0o500);
    try {
      assert.strictEqual(run(), undefined);
    } finally {
      fs.chmodSync(configDir, 0o755);
    }
    assert.strictEqual(readText(), content);
    assert.deepStrictEqual(fs.readdirSync(configDir), ['settings.json'], 'no temp file left behind');
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('without CLAUDE_CONFIG_DIR, or with it empty, the file is the home\'s .claude/settings.json — resolved at run time', () => {
    const file = path.join(home, '.claude', 'settings.json');
    for (const value of [undefined, '']) {
      if (value === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = value;
      writeSettings({ model: 'opus', env: { [FLAG]: '1' } }, file);
      run();
      assert.strictEqual(readText(file), json({ model: 'opus' }), JSON.stringify(value));
    }
    assert.ok(!fs.existsSync(configDir), 'the unset config directory never read or made');
    assert.strictEqual(updates, 2);
  });

  it('CLAUDE_CONFIG_DIR set — the home\'s own settings are not touched', () => {
    const own = path.join(home, '.claude', 'settings.json');
    const content = json({ env: { [FLAG]: '1' } });
    writeSettings(content, own);
    writeSettings({ env: { [FLAG]: '1' } });
    run();
    assert.strictEqual(readText(own), content);
    assert.strictEqual(readText(), json({}));
  });

  it('writes nothing into the project', () => {
    writeSettings({ env: { [FLAG]: '1' } });
    run();
    assert.deepStrictEqual(fs.readdirSync(project), []);
  });
});
