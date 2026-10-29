'use strict';

// The local landing driver's side of the landing conformance suite
// (test-engine-landing-conformance.cjs): the landing world as it stands, no
// remote and no host, the project set to the driver; what landed is what
// the default branch itself gained, and what it holds is its own tree.

const { git } = require('../../scripts/engine-harness.cjs');
const { setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');

module.exports = {
  /** The environment every call runs under: the suite's own. */
  env: {},
  /** The world readied for the driver, once per process. @param {string} dir */
  prepare: (dir) => setLandingDriver(dir, 'local'),
  /** What the default branch gained, oldest first. @param {string} dir */
  landed: (dir) => landedOn(dir, 'main'),
  /** Every path the default branch holds. @param {string} dir */
  holds: (dir) => pathsOn(dir, 'main'),
  /** The commit the default branch is at. @param {string} dir */
  defaultTip: (dir) => git(dir, ['rev-parse', 'main']).trim(),
};
