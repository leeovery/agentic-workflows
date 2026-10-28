'use strict';

// ---------------------------------------------------------------------------
// The `npm test` script's own guard (package.json): it names every node
// suite under tests/scripts once, and nothing that is not one, so a suite
// split or added is never left out of the run. A suite is a `test-*.cjs`
// file, or any `.cjs` at any depth that takes a test from `node:test`,
// whatever its name; a support module that takes only hooks is not one.
//
// Layer: unit. World: the script and the folder as they stand, and a temp
// folder for the scan's own cases.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PACKAGE = path.join(__dirname, '../../package.json');
const REPO = path.join(__dirname, '../..');
// Run by hand against the real API, never by the script (tests/README.md §3).
const MANUAL = ['tests/scripts/knowledge-openai-smoke.cjs'];

/** The files the `npm test` script runs, in its order. */
function listed() {
  const script = JSON.parse(fs.readFileSync(PACKAGE, 'utf8')).scripts.test;
  assert.match(script, /^node --test /);
  return script.replace(/^node --test /, '').split(/\s+/);
}

/**
 * The suites under `dir`, relative to `root`: each `test-*.cjs` at its top,
 * and each `.cjs` at any depth that takes `describe`, `it` or `test` from
 * `node:test`.
 * @param {string} dir @param {string} root
 * @returns {string[]}
 */
function suites(dir, root) {
  return /** @type {string[]} */ (fs.readdirSync(dir, { recursive: true }))
    .filter((name) => name.endsWith('.cjs'))
    .filter((name) => /^test-[^/]*\.cjs$/.test(name) || takesATest(fs.readFileSync(path.join(dir, name), 'utf8')))
    .map((name) => path.relative(root, path.join(dir, name)))
    .sort();
}

/** Whether a source takes a test from `node:test`. @param {string} source */
function takesATest(source) {
  return [...source.matchAll(/const \{([^}]*)\} = require\('node:test'\)/g)]
    .some(([, names]) => names.split(',').some((name) => ['describe', 'it', 'test'].includes(name.trim())));
}

describe('the npm test script', () => {
  it('runs every node suite under tests/scripts, each once, and names no file that is not one', () => {
    const found = suites(__dirname, REPO).filter((file) => !MANUAL.includes(file));
    const run = listed();
    assert.ok(found.length > 50, `found ${found.length} suites — the folder read is broken`);
    assert.deepStrictEqual(found.filter((file) => !run.includes(file)), [], 'suites the script leaves out');
    assert.deepStrictEqual(run.filter((file) => !found.includes(file)), [], 'files the script names that are not suites');
    assert.deepStrictEqual(run.filter((file, i) => run.indexOf(file) !== i), [], 'suites the script names twice');
  });

  it('counts a file that takes a test, whatever its name or depth, and never a module that takes only hooks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-list-'));
    try {
      const dir = path.join(root, 'scripts');
      fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'test-named.cjs'), "require('./hermetic-env.cjs');\n");
      fs.writeFileSync(path.join(dir, 'checks.cjs'), "const { describe, it } = require('node:test');\n");
      fs.writeFileSync(path.join(dir, 'nested', 'more.cjs'), "const {\n  test,\n} = require('node:test');\n");
      fs.writeFileSync(path.join(dir, 'family-world.cjs'), "const { beforeEach, afterEach } = require('node:test');\n");
      fs.writeFileSync(path.join(dir, 'helper.cjs'), "const assert = require('node:assert');\n");
      assert.deepStrictEqual(suites(dir, root), ['scripts/checks.cjs', 'scripts/nested/more.cjs', 'scripts/test-named.cjs']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
