'use strict';

// GitHub's landing driver's side of the landing conformance suite
// (test-engine-landing-conformance.cjs): the landing world on a fake GitHub
// (world.cjs), the project set to the driver and the repository's squash
// default to the pull request's title and description, as setup's yes sets
// it, every call made under the stand-in gh; what landed is what GitHub's
// default branch gained, each subject read past the " (#N)" GitHub ends it
// with, and what it holds is its tree there.

const { git } = require('../../scripts/engine-harness.cjs');
const { setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');
const { GH_ENV, githubWorld, bareOf, squashFromPullRequests } = require('./world.cjs');

module.exports = {
  /** The environment every call runs under. */
  env: GH_ENV,
  /** The world readied for the driver, once per process. @param {string} dir */
  prepare: (dir) => {
    setLandingDriver(dir, 'github');
    githubWorld(dir);
    squashFromPullRequests(dir);
  },
  /** What GitHub's default branch gained, oldest first. @param {string} dir */
  landed: (dir) => landedOn(bareOf(dir), 'main').map((commit) => ({ ...commit, subject: commit.subject.replace(/ \(#\d+\)$/, '') })),
  /** Every path GitHub's default branch holds. @param {string} dir */
  holds: (dir) => pathsOn(bareOf(dir), 'main'),
  /** The commit GitHub's default branch is at. @param {string} dir */
  defaultTip: (dir) => git(bareOf(dir), ['rev-parse', 'main']).trim(),
};
