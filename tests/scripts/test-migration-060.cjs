'use strict';

//
// Tests for migration 060: ignore-knowledge-store (.cjs)
//
// Happy path (the rule appended to 053's file), fresh-file creation,
// already-present skip, no-trailing-newline edge, idempotency, content
// preservation, report accounting, and — against real git — that the rule
// ignores the whole knowledge directory.
//

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/060-ignore-knowledge-store.cjs');

const RULE = '.knowledge/';

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

describe('migration 060: ignore the knowledge directory', () => {
  it('happy path — the rule appends after 053 content, which is preserved', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), RULES_053.join('\n') + '\n');

    const c = runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), [...RULES_053, RULE]);
    assert.strictEqual(c.updates, 1, 'one update reported');
    assert.strictEqual(c.skips, 0, 'no skip reported');
    teardown(dir);
  });

  it('missing .workflows/.gitignore — created with the rule', () => {
    const dir = setup();

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), [RULE]);
    teardown(dir);
  });

  it('missing .workflows/ — directory created, file written', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-060-'));

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), [RULE]);
    teardown(dir);
  });

  it('the rule already present — skipped, content unchanged', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), `.cache/\n${RULE}\n`);

    const c = runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), ['.cache/', RULE]);
    assert.deepStrictEqual(c, { updates: 0, skips: 1 });
    teardown(dir);
  });

  it('no trailing newline — a newline lands before the append, no glued lines', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), '.cache/');

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), ['.cache/', RULE]);
    teardown(dir);
  });

  it('the rule as part of a longer line is no match — the whole line is the rule', () => {
    const dir = setup();
    fs.writeFileSync(nestedPath(dir), `# ${RULE}\n`);

    runMigration(dir);

    assert.deepStrictEqual(lines(nestedPath(dir)), [`# ${RULE}`, RULE]);
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

  it('git ignores everything in the knowledge directory — the config with the store', () => {
    const dir = setup();
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    const kdir = path.join(dir, '.workflows', '.knowledge');
    fs.mkdirSync(kdir, { recursive: true });
    for (const name of ['store.msp', 'metadata.json', 'store.msp.bak', 'config.json']) {
      fs.writeFileSync(path.join(kdir, name), '{}\n');
    }

    runMigration(dir);

    assert.strictEqual(git('status', '--porcelain', '--untracked-files=all', '--', '.workflows/.knowledge').trim(), '');
    teardown(dir);
  });
});
