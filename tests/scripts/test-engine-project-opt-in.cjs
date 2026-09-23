'use strict';

//
// Tests for the project opt-in mechanics the session labels and the gate
// surface share: the recorded answer's read, the status boot reports, and
// the record — the answer, its settings sync, and one confined commit.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { optInValue, optInStatus, recordOptIn } = require('../../skills/workflow-engine/scripts/domain/project-opt-in.cjs');

const KEY = 'an_opt_in';
const SETTINGS = '.claude/settings.json';

let dir;

function setup() {
  dir = setupGitFixture('engine-project-opt-in-');
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'init']);
}

function teardown() {
  cleanupFixture(dir);
}

function writeManifest(content) {
  fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'),
    typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

function projectManifest() {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'));
}

/** HEAD's subject and the sorted paths it touched. */
function head() {
  return {
    subject: git(dir, ['log', '-1', '--pretty=%s']).trim(),
    files: git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
  };
}

/**
 * An opt-in whose sync answers `result`, writing the settings file when it
 * reports a change, and records each call — the answer it was handed and
 * whether the project lock was held.
 */
function optIn(result = { changed: false }) {
  /** @type {{value: boolean, locked: boolean}[]} */
  const calls = [];
  return {
    calls,
    key: KEY,
    sync: (cwd, value) => {
      calls.push({ value, locked: fs.existsSync(path.join(cwd, '.workflows', '.project-lock')) });
      if (result.changed) {
        fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(cwd, SETTINGS), '{}\n');
      }
      return result;
    },
    unsynced: 'the opt-in not synced',
    message: 'chore: record the opt-in',
  };
}

describe('optInValue', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('reads a recorded answer, either way', () => {
    writeManifest({ defaults: { [KEY]: true } });
    assert.strictEqual(optInValue(dir, KEY), true);
    writeManifest({ defaults: { [KEY]: false } });
    assert.strictEqual(optInValue(dir, KEY), false);
  });

  it('reads null while never asked — no manifest, no defaults, no key', () => {
    assert.strictEqual(optInValue(dir, KEY), null);
    writeManifest({ work_units: {} });
    assert.strictEqual(optInValue(dir, KEY), null);
    writeManifest({ defaults: { another: true } });
    assert.strictEqual(optInValue(dir, KEY), null);
  });

  it('only a boolean counts — anything else reads as never asked', () => {
    for (const value of ['true', 1, null, {}]) {
      writeManifest({ defaults: { [KEY]: value } });
      assert.strictEqual(optInValue(dir, KEY), null, JSON.stringify(value));
    }
  });

  it('a manifest that does not parse, or whose root or defaults is no object, reads null — never a throw', () => {
    for (const content of ['{not json', '[]', 'null', JSON.stringify({ defaults: [true] })]) {
      writeManifest(content);
      assert.strictEqual(optInValue(dir, KEY), null, content);
    }
  });
});

describe('optInStatus', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('reports on, off, and prompt while never asked', () => {
    assert.strictEqual(optInStatus(dir, KEY), 'prompt');
    writeManifest({ defaults: { [KEY]: true } });
    assert.strictEqual(optInStatus(dir, KEY), 'on');
    writeManifest({ defaults: { [KEY]: false } });
    assert.strictEqual(optInStatus(dir, KEY), 'off');
  });
});

describe('recordOptIn', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the answer beside every other key, syncs under the project lock, and commits the manifest alone when the sync changed nothing', () => {
    writeManifest({ work_units: { pay: { work_type: 'feature' } }, defaults: { plan_format: 'x' } });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'manifest']);
    fs.writeFileSync(path.join(dir, 'peer-dirt.txt'), 'a peer session\'s file\n');
    const o = optIn();
    assert.deepStrictEqual(recordOptIn(dir, o, true), { [KEY]: true });
    assert.deepStrictEqual(projectManifest(), {
      work_units: { pay: { work_type: 'feature' } },
      defaults: { plan_format: 'x', [KEY]: true },
    });
    assert.deepStrictEqual(o.calls, [{ value: true, locked: true }]);
    assert.deepStrictEqual(head(), { subject: 'chore: record the opt-in', files: ['.workflows/manifest.json'] });
    assert.match(git(dir, ['status', '--porcelain']), /\?\? peer-dirt\.txt/, 'the commit takes its own paths and nothing else');
  });

  it('hands the sync the answer given — a no as much as a yes', () => {
    const o = optIn();
    recordOptIn(dir, o, false);
    assert.deepStrictEqual(o.calls, [{ value: false, locked: true }]);
    assert.strictEqual(projectManifest().defaults[KEY], false);
  });

  it('a sync that changed the settings file commits it beside the manifest', () => {
    recordOptIn(dir, optIn({ changed: true }), true);
    assert.deepStrictEqual(head(), { subject: 'chore: record the opt-in', files: ['.claude/settings.json', '.workflows/manifest.json'] });
  });

  it('a sync that could not read the settings file is a warning led by the opt-in\'s own words — the answer stands', () => {
    const res = recordOptIn(dir, optIn({ changed: false, error: 'unreadable' }), true);
    assert.deepStrictEqual(res, { [KEY]: true, warnings: ['the opt-in not synced: unreadable'] });
    assert.deepStrictEqual(head(), { subject: 'chore: record the opt-in', files: ['.workflows/manifest.json'] });
  });

  it('a commit git refuses is a warning, never a failure — the answer is on disk', () => {
    const hooksDir = path.join(dir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const res = recordOptIn(dir, optIn(), true);
    assert.strictEqual(res[KEY], true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^commit failed: /);
    assert.deepStrictEqual(projectManifest(), { defaults: { [KEY]: true } });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'init', 'nothing landed');
  });

  it('refuses a project manifest that does not parse, before anything is written or synced', () => {
    writeManifest('{not json');
    const o = optIn({ changed: true });
    assert.throws(() => recordOptIn(dir, o, true), /not valid JSON/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'), '{not json');
    assert.deepStrictEqual(o.calls, []);
    assert.ok(!fs.existsSync(path.join(dir, SETTINGS)));
  });
});
