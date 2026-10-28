'use strict';

// ---------------------------------------------------------------------------
// The `npm test` script's own guard (package.json): it names every node
// suite in tests/scripts once, and nothing that is not one, so a suite split
// or added is never left out of the run.
//
// Layer: unit. World: none; the script and the folder are read as they
// stand.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PACKAGE = path.join(__dirname, '../../package.json');

/** The files the `npm test` script runs, in its order. */
function listed() {
  const script = JSON.parse(fs.readFileSync(PACKAGE, 'utf8')).scripts.test;
  assert.match(script, /^node --test /);
  return script.replace(/^node --test /, '').split(/\s+/);
}

describe('the npm test script', () => {
  it('runs every node suite in tests/scripts, each once, and names no file that is not one', () => {
    const suites = fs.readdirSync(__dirname).filter((name) => /^test-.*\.cjs$/.test(name)).map((name) => `tests/scripts/${name}`);
    const run = listed();
    assert.ok(suites.length > 50, `found ${suites.length} suites — the folder read is broken`);
    assert.deepStrictEqual(suites.filter((file) => !run.includes(file)), [], 'suites the script leaves out');
    assert.deepStrictEqual(run.filter((file) => !suites.includes(file)), [], 'files the script names that are not suites');
    assert.deepStrictEqual(run.filter((file, i) => run.indexOf(file) !== i), [], 'suites the script names twice');
  });
});
