'use strict';

//
// Tests for migration 067: remove-plan-accept-setting (.cjs)
//
// Against real git: the key removed where it reads `true`, the notice handed
// back only where the project's last commit carried it set `true` (a key
// written moments earlier in the same run, or committed `false`, goes
// silently), a project nested in a larger repository reading its own file,
// the value guard (only `true` goes), skip/no-op (no file, no key, a file
// that does not parse), no history to read (not a repository, no commit
// yet, git unavailable), idempotency, and content preservation (every other
// key, in the engine's serialisation).
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/067-remove-plan-accept-setting.cjs');

const KEY = 'showClearContextOnPlanAccept';
const SETTINGS = '.claude/settings.json';
const HOOKS = { SessionEnd: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup' }] }] };

let dir, updates, skips;

function run(projectDir = dir) {
  return MIGRATION.run({ projectDir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function writeSettings(content, root = dir) {
  const file = path.join(root, SETTINGS);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : json(content));
}

const readText = (root = dir) => fs.readFileSync(path.join(root, SETTINGS), 'utf8');

function commitSettings(content, root = dir) {
  writeSettings(content, root);
  git(root, ['add', '--', SETTINGS]);
  git(root, ['commit', '-q', '-m', 'settings']);
}

describe('migration 067: remove the plan-mode setting from the project settings', () => {
  beforeEach(() => {
    dir = setupGitFixture('migration-067-');
    updates = 0;
    skips = 0;
  });
  afterEach(() => {
    cleanupFixture(dir);
  });

  it('happy path — a key the project had committed goes, and the person is told how to add it back', () => {
    commitSettings({ hooks: HOOKS, [KEY]: true });

    const handed = run();

    assert.strictEqual(readText(), json({ hooks: HOOKS }));
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    assert.match(handed.notice, /^Removed `showClearContextOnPlanAccept` from `\.claude\/settings\.json` — the workflows no longer use plan mode\. /);
    assert.match(handed.notice, /Add `"showClearContextOnPlanAccept": true` back if you want plan mode's option to clear context when you approve a plan\.$/);
  });

  it('a key written in this same run — never committed — goes silently', () => {
    commitSettings({ hooks: HOOKS });
    writeSettings({ hooks: HOOKS, [KEY]: true });

    assert.strictEqual(run(), undefined);
    assert.strictEqual(readText(), json({ hooks: HOOKS }));
    assert.strictEqual(updates, 1);
  });

  it('a new project — no settings committed at all — loses the key silently', () => {
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'init']);
    writeSettings({ [KEY]: true });

    assert.strictEqual(run(), undefined);
    assert.strictEqual(readText(), json({}));
    assert.strictEqual(updates, 1);
  });

  it('a key committed `false` and set `true` since goes silently — the project had it off', () => {
    commitSettings({ [KEY]: false });
    writeSettings({ [KEY]: true });

    assert.strictEqual(run(), undefined);
    assert.strictEqual(readText(), json({}));
  });

  it('a committed file that does not parse is no history of the key — the removal is silent', () => {
    commitSettings('{ "showClearContextOnPlanAccept": true,\n');
    writeSettings({ [KEY]: true });

    assert.strictEqual(run(), undefined);
    assert.strictEqual(readText(), json({}));
  });

  it('a project nested in a larger repository reads its own committed file', () => {
    const project = path.join(dir, 'apps', 'web');
    commitSettings({ [KEY]: true }, project);
    commitSettings({ hooks: HOOKS });

    const handed = run(project);

    assert.ok(handed && handed.notice, 'the nested project\'s own commit carried the key');
    assert.strictEqual(readText(project), json({}));
    assert.strictEqual(readText(), json({ hooks: HOOKS }), 'the repository root\'s file is not the project\'s');
  });

  it('every other key stands, in place and in the engine\'s serialisation', () => {
    const permissions = { allow: ['Edit(.workflows/**)'] };
    commitSettings({ permissions, [KEY]: true, hooks: HOOKS, model: 'opus' });

    run();

    assert.strictEqual(readText(), json({ permissions, hooks: HOOKS, model: 'opus' }));
  });

  it('any value but `true` is the project\'s own and stands', () => {
    for (const value of [false, 'true', 1, null]) {
      const content = json({ [KEY]: value });
      commitSettings(content);
      assert.strictEqual(run(), undefined, JSON.stringify(value));
      assert.strictEqual(readText(), content, JSON.stringify(value));
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 4 });
  });

  it('no key, no file, a file that does not parse, a root that is not an object — a skip, the file untouched', () => {
    run();
    assert.ok(!fs.existsSync(path.join(dir, SETTINGS)), 'no file is created');
    for (const content of [json({ hooks: HOOKS }), '{ "showClearContextOnPlanAccept": true,\n', '[true]\n']) {
      writeSettings(content);
      assert.strictEqual(run(), undefined);
      assert.strictEqual(readText(), content);
    }
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 4 });
  });

  it('no history to read — not a repository, no commit yet, git unavailable — the removal is silent', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-067-plain-'));
    try {
      writeSettings({ [KEY]: true }, plain);
      assert.strictEqual(run(plain), undefined);
      assert.strictEqual(readText(plain), json({}));
    } finally {
      cleanupFixture(plain);
    }

    writeSettings({ [KEY]: true });
    assert.strictEqual(run(), undefined, 'a repository with no commit yet');
    assert.strictEqual(readText(), json({}));

    commitSettings({ [KEY]: true });
    const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-067-path-'));
    const saved = process.env.PATH;
    let handed;
    try {
      process.env.PATH = emptyPath;
      handed = run();
    } finally {
      process.env.PATH = saved;
      cleanupFixture(emptyPath);
    }
    assert.strictEqual(handed, undefined, 'git unavailable');
    assert.strictEqual(readText(), json({}));
    assert.deepStrictEqual({ updates, skips }, { updates: 3, skips: 0 });
  });

  it('idempotency — a second run finds no key, changes nothing, and tells nothing', () => {
    commitSettings({ hooks: HOOKS, [KEY]: true });
    run();
    const after = readText();

    assert.strictEqual(run(), undefined);
    assert.strictEqual(readText(), after);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 1 });
  });
});
