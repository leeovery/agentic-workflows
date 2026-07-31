'use strict';

//
// Tests for migration 053: ignore-lock-and-temp-files (.cjs)
//
// Happy path (rules appended to 049's file), fresh-file creation,
// partial-presence append, no-trailing-newline edge, idempotency,
// content preservation, and report accounting.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/053-ignore-lock-and-temp-files.cjs');

const RULES = [
  '.lock',
  '.lock.breaking',
  '.project-lock',
  '.project-lock.breaking',
  '.commit-lock',
  '.commit-lock.breaking',
  '.knowledge/*.tmp',
];

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-053-'));
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

describe('migration 053: ignore lock and temp files', () => {
  it('happy path — all rules appended after 049 content, which is preserved', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/\n.manifest.json.*.tmp\n');

    const c = runMigration(dir);
    const got = lines(nestedPath(dir));

    for (const rule of RULES) {
      assert.ok(got.includes(rule), `carries ${rule}`);
    }
    assert.strictEqual(got[0], '.cache/', '049 cache rule preserved first');
    assert.strictEqual(got[1], '.manifest.json.*.tmp', '049 tmp rule preserved');
    assert.strictEqual(c.updates, 1, 'one update reported');
    assert.strictEqual(c.skips, 0, 'no skip reported');
    teardown(dir);
  });

  it('missing .workflows/.gitignore — created with all rules', () => {
    const dir = setup();

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), RULES, 'file created with exactly the rules');
    teardown(dir);
  });

  it('missing .workflows/ — directory created, file written', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-053-'));

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), RULES, 'rules written under conjured .workflows/');
    teardown(dir);
  });

  it('partial presence — only missing rules appended, no duplicates', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/\n.lock\n.project-lock\n');

    runMigration(dir);
    const got = lines(nestedPath(dir));

    assert.strictEqual(got.filter((l) => l === '.lock').length, 1, '.lock not duplicated');
    assert.strictEqual(got.filter((l) => l === '.project-lock').length, 1, '.project-lock not duplicated');
    for (const rule of RULES) {
      assert.ok(got.includes(rule), `carries ${rule}`);
    }
    teardown(dir);
  });

  it('no trailing newline — newline inserted before append, no glued lines', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/');

    runMigration(dir);
    const got = lines(nestedPath(dir));

    assert.strictEqual(got[0], '.cache/', 'existing rule intact');
    assert.ok(got.includes('.lock'), 'first appended rule on its own line');
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
    const got = lines(nestedPath(dir));

    assert.ok(got.includes('my-custom-rule/'), 'custom rule survives');
    teardown(dir);
  });
});
