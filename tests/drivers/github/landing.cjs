'use strict';

// GitHub's landing driver's side of the landing conformance suite
// (test-engine-landing-conformance.cjs): the landing world on a fake GitHub
// (world.cjs), the project set to the driver, every call made under the
// stand-in gh; what landed is what GitHub's default branch gained, and
// what it holds is its tree there.

const { setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');
const { GH_ENV, githubWorld, bareOf } = require('./world.cjs');

module.exports = {
  /** The environment every call runs under. */
  env: GH_ENV,
  /** The world readied for the driver, once per process. @param {string} dir */
  prepare: (dir) => {
    setLandingDriver(dir, 'github');
    githubWorld(dir);
  },
  /** What GitHub's default branch gained, oldest first. @param {string} dir */
  landed: (dir) => landedOn(bareOf(dir), 'main'),
  /** Every path GitHub's default branch holds. @param {string} dir */
  holds: (dir) => pathsOn(bareOf(dir), 'main'),
};
