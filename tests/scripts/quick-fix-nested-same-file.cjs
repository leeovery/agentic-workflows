'use strict';

// ---------------------------------------------------------------------------
// The day the nested same-file suites
// (test-engine-landing-conformance-quick-fix-nested-same-file*.cjs) run on
// each landing driver (R16, R17's N1): a nested clone's branch gone here
// after its first fix, then the next fix in the file that fix changed. The
// next fix's start takes the clone's branch from the host's copy and puts
// the clone's checkout on it, as the project's own is put, so the fix reads
// the first's change, commits through the door, and lands with it: the
// clone's default branch on its host holding both.
// ---------------------------------------------------------------------------

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, createFix } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');

const FIRST = 'lib --colour\n';
const BOTH = `${FIRST}rates --colour\n`;

/** The day's names: on the driver `name`, the clone's branch gone `how`, and its test's. */
const SAME_FILE = {
  /** @param {string} name @param {string} how */
  title: (name, how) => `the ${name} landing driver's quick-fix, a nested clone's branch ${how}, then the next fix in the same file there (R16, N1)`,
  test: 'the start puts the clone\'s checkout on the branch it takes from the host, and the fix commits through the door and lands with the first',
};

/**
 * The day on a driver, the clone's branch gone by `away`.
 * @param {ReturnType<typeof import('./quick-fix-world.cjs').quickFixNestedConformance>} conf
 * @param {(dir: string, into: string) => void} away
 */
function nextInSameFile(conf, away) {
  const { side, as, project, built, ended, closed } = conf;
  const at = project();
  built(at, 1, { 'lib/lib.txt': FIRST });
  away(at.lib, NESTED.lib.into);
  createFix(at.dir, 2, SET[1].title, as());
  ok(at.dir, ['task', 'start', UNIT, '1.2'], as());
  const out = git(at.lib, ['symbolic-ref', '--short', 'HEAD']).trim();
  const reads = fs.readFileSync(path.join(at.lib, 'lib.txt'), 'utf8');
  fs.writeFileSync(path.join(at.lib, 'lib.txt'), BOTH);
  ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.2', '-m', `fix(${UNIT}): ${SET[1].title.toLowerCase()}`], as());
  ok(at.dir, ['land', 'open', UNIT, '1.2'], as());
  ended(at, 2);
  closed(at);

  assert.deepStrictEqual([out, reads, git(side.on(at.lib), ['show', `${NESTED.lib.into}:lib.txt`])], [BRANCH, FIRST, BOTH]);
}

module.exports = { SAME_FILE, nextInSameFile };
