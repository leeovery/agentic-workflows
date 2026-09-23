'use strict';

//
// Tests for migration 060: ignore-knowledge-store (.cjs)
//
// Happy path (rules appended to 053's file), fresh-file creation,
// partial-presence append, no-trailing-newline edge, idempotency,
// content preservation, report accounting, and — against real git — that
// the rules ignore the store while config.json stays visible.
//

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/060-ignore-knowledge-store.cjs');

const RULES = [
  '.knowledge/store.msp',
  '.knowledge/metadata.json',
  '.knowledge/*.bak',
];

const RULES_053 = [
  '.cache/',
  '.manifest.json.*.tmp',
  '.lock',
  '.lock.breaking',
  '.project-lock',
  '.project-lock.breaking',
  '.commit-lock',
  '.commit-lock.breaking',
  '.knowledge/*.tmp',
];

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-060-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function runMigration(dir, counters) {
  const c = counters || { updates: 0, skips: 0 };
  MIGRATION.run({
    projectDir: dir,
    reportUpdate: () => { c.updates++; },
    reportSkip: () => { c.skips++; },
  });
  return c;
}
function nestedPath(dir) {
  return path.join(dir, '.workflows', '.gitignore');
}
function lines(p) {
  return fs.readFileSync(p, 'utf8').split('\n').filter((l) => l !== '');
}

describe('migration 060: ignore the knowledge store', () => {
  it('happy path — the rules append after 053 content, which is preserved', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), RULES_053.join('\n') + '\n');

    const c = runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), [...RULES_053, ...RULES]);
    assert.strictEqual(c.updates, 1, 'one update reported');
    assert.strictEqual(c.skips, 0, 'no skip reported');
    teardown(dir);
  });

  it('missing .workflows/.gitignore — created with the rules', () => {
    const dir = setup();

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), RULES);
    teardown(dir);
  });

  it('missing .workflows/ — directory created, file written', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-060-'));

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), RULES);
    teardown(dir);
  });

  it('partial presence — only the missing rules append, no duplicates', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/\n.knowledge/store.msp\n');

    runMigration(dir);
    const got = lines(nestedPath(dir));

    assert.deepStrictEqual(got, ['.cache/', '.knowledge/store.msp', '.knowledge/metadata.json', '.knowledge/*.bak']);
    teardown(dir);
  });

  it('no trailing newline — a newline lands before the append, no glued lines', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/');

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), ['.cache/', ...RULES]);
    teardown(dir);
  });

  it('a rule as part of a longer line is no match — the whole line is the rule', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '# .knowledge/store.msp\n');

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), ['# .knowledge/store.msp', ...RULES]);
    teardown(dir);
  });

  it('idempotency — second run reports skip, content unchanged', () => {
    const dir = setup();

    runMigration(dir);
    const after = fs.readFileSync(nestedPath(dir), 'utf8');
    const c = runMigration(dir);

    assert.strictEqual(fs.readFileSync(nestedPath(dir), 'utf8'), after, 'content unchanged');
    assert.strictEqual(c.updates, 0, 'no update on second run');
    assert.strictEqual(c.skips, 1, 'skip reported on second run');
    teardown(dir);
  });

  it('custom user rules preserved', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/\nmy-custom-rule/\n');

    runMigration(dir);

    assert.ok(lines(nestedPath(dir)).includes('my-custom-rule/'), 'custom rule survives');
    teardown(dir);
  });

  it('git ignores the store, its metadata and a rebuild backup — config.json stays visible', () => {
    const dir = setup();
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    const kdir = path.join(dir, '.workflows', '.knowledge');
    fs.mkdirSync(kdir, { recursive: true });
    for (const name of ['store.msp', 'metadata.json', 'store.msp.bak', 'config.json']) {
      fs.writeFileSync(path.join(kdir, name), '{}\n');
    }

    runMigration(dir);

    const untracked = git('status', '--porcelain', '--untracked-files=all', '--', '.workflows/.knowledge')
      .split('\n').filter(Boolean);
    assert.deepStrictEqual(untracked, ['?? .workflows/.knowledge/config.json']);
    teardown(dir);
  });
});
