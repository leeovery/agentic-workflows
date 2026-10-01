'use strict';

//
// Tests for migration 065: remove-project-function-hooks-flag (.cjs)
//
// Happy path (the flag removed, `env` with it when emptied), the flag beside
// other env keys, the value guard (any value but "1" stands), skip/no-op
// (no file, no env, no flag), idempotency, content preservation (every other
// key and the engine's serialisation), the write through a symlink, and the
// malformed-file guards (unparseable, a non-object root, a non-object env).
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/065-remove-project-function-hooks-flag.cjs');

const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const HOOKS = { SessionEnd: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup' }] }] };

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

const settingsFile = () => path.join(dir, '.claude', 'settings.json');
/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function writeSettings(content) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), typeof content === 'string' ? content : json(content));
}

const readText = () => fs.readFileSync(settingsFile(), 'utf8');

describe('migration 065: remove the function-hooks flag from the project settings', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-065-'));
    updates = 0;
    skips = 0;
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('happy path — the flag the workflows wrote goes, and `env` with it when nothing else is left', () => {
    writeSettings({ hooks: HOOKS, env: { [FLAG]: '1' } });
    run();
    assert.strictEqual(readText(), json({ hooks: HOOKS }));
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('the flag beside other env keys — they stand, in order', () => {
    writeSettings({ env: { EDITOR: 'vim', [FLAG]: '1', PAGER: 'less' } });
    run();
    assert.strictEqual(readText(), json({ env: { EDITOR: 'vim', PAGER: 'less' } }));
    assert.strictEqual(updates, 1);
  });

  it('every other key stands, in place and in the engine\'s serialisation', () => {
    const permissions = { allow: ['Edit(.workflows/**)'] };
    writeSettings({ permissions, env: { [FLAG]: '1' }, hooks: HOOKS, model: 'opus' });
    run();
    assert.strictEqual(readText(), json({ permissions, hooks: HOOKS, model: 'opus' }));
  });

  it('any value but "1" is the project\'s own and stands', () => {
    for (const value of ['0', 'true', '', 1, true, null]) {
      const content = json({ env: { [FLAG]: value } });
      writeSettings(content);
      run();
      assert.strictEqual(readText(), content, JSON.stringify(value));
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 6 });
  });

  it('no settings file — skip, and none is made', () => {
    run();
    assert.ok(!fs.existsSync(settingsFile()));
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('no env, or an env without the flag — skip, the file untouched byte for byte', () => {
    for (const content of ['{"hooks":{}}', '{\n  "env": {\n    "EDITOR": "vim"\n  }\n}']) {
      writeSettings(content);
      run();
      assert.strictEqual(readText(), content);
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 2 });
  });

  it('idempotent — a second run finds nothing to remove', () => {
    writeSettings({ hooks: HOOKS, env: { EDITOR: 'vim', [FLAG]: '1' } });
    run();
    const once = readText();
    run();
    assert.strictEqual(readText(), once);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 1 });
  });

  it('a symlinked settings file is written at the file it names — the link stands', () => {
    const target = path.join(dir, 'shared-settings.json');
    fs.writeFileSync(target, json({ env: { [FLAG]: '1' } }));
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.symlinkSync(target, settingsFile());
    run();
    assert.ok(fs.lstatSync(settingsFile()).isSymbolicLink());
    assert.strictEqual(fs.readFileSync(target, 'utf8'), json({}));
    assert.strictEqual(updates, 1);
  });

  it('a file that does not parse, a root that is not an object, an env that is not an object — skip, untouched', () => {
    for (const content of ['{not json', '[]\n', 'null\n', `{"env":["${FLAG}"]}`, '{"env":"1"}']) {
      writeSettings(content);
      run();
      assert.strictEqual(readText(), content);
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 5 });
  });
});
