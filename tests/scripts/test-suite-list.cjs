'use strict';

// ---------------------------------------------------------------------------
// The `npm test` script's own guard (package.json): it names every node
// suite under tests/ once, and nothing that is not one, so a suite split or
// added is never left out of the run. A suite is any file that takes a test
// from `node:test`, whatever its name, extension or folder; a support module
// that takes only hooks, or names the module only as a type, is not one.
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
const HOOKS = ['before', 'after', 'beforeEach', 'afterEach', 'mock'];

/** The files the `npm test` script runs, in its order. */
function listed() {
  const script = JSON.parse(fs.readFileSync(PACKAGE, 'utf8')).scripts.test;
  assert.match(script, /^node --test /);
  return script.replace(/^node --test /, '').split(/\s+/);
}

/** Whether a source takes a test from `node:test`: the module whole, or any name of it but a hook. @param {string} source */
function takesATest(source) {
  const taken = [
    ...[...source.matchAll(/(?:const|let|var)\s+(\{[^}]*\}|[\w$]+)\s*=\s*require\(\s*['"]node:test['"]\s*\)/g)].map((m) => m[1]),
    ...[...source.matchAll(/^\s*import\s+([^'"]+?)\s+from\s+['"]node:test['"]/gm)].map((m) => m[1]),
  ];
  return taken.some((binding) => {
    const names = /^\{([^}]*)\}$/.exec(binding.trim());
    if (names === null) return true;
    return names[1].split(',').map((name) => name.trim().split(/\s*(?::|\bas\b)\s*/)[0]).some((name) => name && !HOOKS.includes(name));
  });
}

/**
 * The suites under `dir`, relative to `root`: every `.cjs`, `.js` or `.mjs`
 * at any depth that takes a test from `node:test`.
 * @param {string} dir @param {string} root
 * @returns {string[]}
 */
function suites(dir, root) {
  return /** @type {string[]} */ (fs.readdirSync(dir, { recursive: true }))
    .filter((name) => /\.(c|m)?js$/.test(name) && !name.split(path.sep).includes('node_modules'))
    .filter((name) => takesATest(fs.readFileSync(path.join(dir, name), 'utf8')))
    .map((name) => path.relative(root, path.join(dir, name)))
    .sort();
}

describe('the npm test script', () => {
  it('runs every node suite under tests/, each once, and names no file that is not one', () => {
    const found = suites(path.join(REPO, 'tests'), REPO).filter((file) => !MANUAL.includes(file));
    const run = listed();
    assert.ok(found.length > 50, `found ${found.length} suites — the folder read is broken`);
    assert.deepStrictEqual(found.filter((file) => !run.includes(file)), [], 'suites the script leaves out');
    assert.deepStrictEqual(run.filter((file) => !found.includes(file)), [], 'files the script names that are not suites');
    assert.deepStrictEqual(run.filter((file, i) => run.indexOf(file) !== i), [], 'suites the script names twice');
  });

  it('counts a file that takes a test, whatever its name, extension or depth, and never one that takes only hooks or a type', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-list-'));
    const files = {
      'tests/test-named.cjs': "const { describe, it } = require('node:test');\n",
      'tests/checks.test.cjs': "const {\n  test,\n} = require('node:test');\n",
      'tests/nested/deep/more.js': "const test = require('node:test');\n",
      'tests/esm.mjs': "import { describe, it as check } from 'node:test';\n",
      'tests/esm-whole.mjs': "import test from 'node:test';\n",
      'tests/family-world.cjs': "const { beforeEach, afterEach } = require('node:test');\n",
      'tests/harness.cjs': "/** @param {import('node:test').TestContext} t */\nfunction f(t) {}\n",
      'tests/helper.cjs': "const assert = require('node:assert');\n",
      'tests/node_modules/dep/test.js': "const { it } = require('node:test');\n",
    };
    try {
      for (const [name, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), text);
      }
      assert.deepStrictEqual(suites(path.join(root, 'tests'), root),
        ['tests/checks.test.cjs', 'tests/esm-whole.mjs', 'tests/esm.mjs', 'tests/nested/deep/more.js', 'tests/test-named.cjs']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
