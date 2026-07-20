'use strict';

//
// Tests for migration 049: nested-workflows-gitignore (.cjs)
//
// Ported from test-migration-049.sh: happy path, root deletion, no-root skip,
// existing-nested preservation, idempotency, .workflows/ creation, and the
// no-trailing-newline root edge.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/049-nested-workflows-gitignore.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-049-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function runMigration(dir) {
  MIGRATION.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
}
// Mirror bash `$(cat file)` — read, stripping trailing newlines.
function catLike(p) {
  return fs.readFileSync(p, 'utf8').replace(/\n+$/, '');
}
function exists(p) {
  return fs.existsSync(p);
}
// grep -cxF: count of whole-line exact matches.
function countExactLines(content, needle) {
  return content.split('\n').filter((l) => l === needle).length;
}

describe('migration 049: nested .workflows/.gitignore', () => {
  it('happy path — nested rules created, root rule removed, other root lines kept', () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.workflows/.cache/\n.env\n');

    runMigration(dir);
    const nestedPath = path.join(dir, '.workflows', '.gitignore');
    const nested = catLike(nestedPath);

    assert.ok(exists(nestedPath), 'nested gitignore created');
    assert.ok(nested.split('\n').includes('.cache/'), 'nested carries cache rule');
    assert.ok(nested.split('\n').includes('.manifest.json.*.tmp'), 'nested carries tmp rule');
    const root = catLike(path.join(dir, '.gitignore'));
    assert.ok(!root.split('\n').includes('.workflows/.cache/'), 'root rule removed');
    assert.strictEqual(root, 'node_modules/\n.env', 'other root lines preserved');
    teardown(dir);
  });

  it('root .gitignore holding only the rule is deleted', () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, '.gitignore'), '.workflows/.cache/\n');

    runMigration(dir);

    assert.ok(!exists(path.join(dir, '.gitignore')), 'root gitignore deleted');
    assert.ok(exists(path.join(dir, '.workflows', '.gitignore')), 'nested gitignore created');
    teardown(dir);
  });

  it('skip — no root .gitignore; nested still created, no root conjured', () => {
    const dir = setup();

    runMigration(dir);

    assert.ok(!exists(path.join(dir, '.gitignore')), 'no root gitignore conjured');
    const nested = catLike(path.join(dir, '.workflows', '.gitignore'));
    assert.ok(nested.split('\n').includes('.cache/'), 'nested carries cache rule');
    assert.ok(nested.split('\n').includes('.manifest.json.*.tmp'), 'nested carries tmp rule');
    teardown(dir);
  });

  it('existing nested .gitignore — rules appended, user content preserved, no newline mangling', () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, '.workflows', '.gitignore'), 'my-scratch/\n');

    runMigration(dir);
    const nested = catLike(path.join(dir, '.workflows', '.gitignore'));

    assert.ok(nested.split('\n').includes('my-scratch/'), 'user rule preserved');
    assert.ok(nested.split('\n').includes('.cache/'), 'cache rule appended');
    assert.ok(nested.split('\n').includes('.manifest.json.*.tmp'), 'tmp rule appended');
    assert.strictEqual(nested, 'my-scratch/\n.cache/\n.manifest.json.*.tmp', 'exact content');
    teardown(dir);
  });

  it('idempotency — a second run changes nothing, no duplicate rules', () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.workflows/.cache/\n');

    runMigration(dir);
    const nestedFirst = catLike(path.join(dir, '.workflows', '.gitignore'));
    const rootFirst = catLike(path.join(dir, '.gitignore'));
    runMigration(dir);

    assert.strictEqual(catLike(path.join(dir, '.workflows', '.gitignore')), nestedFirst, 'nested identical');
    assert.strictEqual(catLike(path.join(dir, '.gitignore')), rootFirst, 'root identical');
    const nestedRaw = fs.readFileSync(path.join(dir, '.workflows', '.gitignore'), 'utf8');
    assert.strictEqual(countExactLines(nestedRaw, '.cache/'), 1, 'cache rule appears once');
    assert.strictEqual(countExactLines(nestedRaw, '.manifest.json.*.tmp'), 1, 'tmp rule appears once');
    teardown(dir);
  });

  it('missing .workflows/ — directory and nested gitignore created', () => {
    const dir = setup();
    fs.rmdirSync(path.join(dir, '.workflows'));

    runMigration(dir);

    assert.ok(fs.statSync(path.join(dir, '.workflows')).isDirectory(), 'workflows dir created');
    assert.ok(exists(path.join(dir, '.workflows', '.gitignore')), 'nested gitignore created');
    teardown(dir);
  });

  it('root file without trailing newline — removal still exact-line', () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.workflows/.cache/');

    runMigration(dir);
    const root = catLike(path.join(dir, '.gitignore'));

    assert.ok(!root.split('\n').includes('.workflows/.cache/'), 'root rule removed');
    assert.strictEqual(root, 'node_modules/', 'other root line preserved');
    teardown(dir);
  });
});
