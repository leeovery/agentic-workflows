'use strict';

// ---------------------------------------------------------------------------
// The day the nested by-hand suites
// (test-engine-landing-conformance-quick-fix-nested-by-hand*.cjs) run on
// each landing driver (R17): a quick-fix's pull request in its nested clone
// merged by hand, by one of the driver's side's ways, once before its fix
// is done and once after — the clone read by its content, whatever its
// branches here hold. Fix 1, opened in the clone, merged there by hand,
// then done and recorded; fix 2, opened there, done, recorded, then merged
// there by hand; the close: each fix done, the unit completed, nothing
// landed again, the clone's default branch on its host holding both
// changes.
// ---------------------------------------------------------------------------

const assert = require('node:assert');

const { git, readManifest } = require('./engine-harness.cjs');
const { UNIT, BRANCH } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');

/** The two fixes' files in the clone, by their paths in the project, and the text each writes. */
const FILES = Object.freeze([{ 'lib/lib.txt': 'lib --colour\n' }, { 'lib/rates.txt': 'rates --colour\n' }]);

/** The day's names: on the driver `name`, merged by the side's way `how`, and its test's. */
const NESTED_BY_HAND = {
  /** @param {string} name @param {string} how */
  title: (name, how) => `the ${name} landing driver's quick-fix, its pull request in a nested clone merged by hand by ${how}, before a fix is done and after (R17)`,
  test: 'each fix is done, the close completes the unit landing nothing again, and the clone\'s default branch holds both changes',
};

/**
 * The day on a driver, the clone's pull request merged by hand by `merge`.
 * @param {ReturnType<typeof import('./quick-fix-world.cjs').quickFixNestedConformance>} conf
 * @param {(dir: string, branch: string, into?: string) => void} merge
 */
function mergedInClone(conf, merge) {
  const { side, project, opened, ended, closed } = conf;
  const { into } = NESTED.lib;
  const at = project();
  opened(at, 1, FILES[0]);
  merge(at.lib, BRANCH, into);
  ended(at, 1);
  opened(at, 2, FILES[1]);
  ended(at, 2);
  merge(at.lib, BRANCH, into);
  const close = closed(at);

  const held = (/** @type {string} */ file) => git(side.on(at.lib), ['show', `${into}:${file}`]);
  assert.deepStrictEqual([close.landed, readManifest(at.dir, UNIT).status, held('lib.txt'), held('rates.txt')], [[], 'completed', 'lib --colour\n', 'rates --colour\n']);
}

module.exports = { NESTED_BY_HAND, FILES, mergedInClone };
