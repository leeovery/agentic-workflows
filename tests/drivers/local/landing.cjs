'use strict';

// The local landing driver's side of the landing conformance suites
// (test-engine-landing-conformance*.cjs): the landing world as it stands, no
// remote and no host, the project set to the driver, and a nested
// repository needing nothing more; a repository lands in itself, so what
// landed is what its default branch itself gained, what it holds is its
// own tree, and what the driver opened there is what its phases' branches
// land. A merge there is refused while its default branch's checkout is in
// the middle of a merge.

const fs = require('fs');
const path = require('path');
const { git } = require('../../scripts/engine-harness.cjs');
const { UNIT, setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');

module.exports = {
  /** The environment every call runs under: the suite's own. */
  env: {},
  /** The world readied for the driver, once per process. @param {string} dir */
  prepare: (dir) => setLandingDriver(dir, 'local'),
  /** A repository nested in the world readied for the driver: nothing to ready. */
  nest: () => {},
  /** The repository the one at `dir` lands in: itself. @param {string} dir */
  on: (dir) => dir,
  /** What the default branch gained, oldest first. @param {string} dir @param {string} [into] */
  landed: (dir, into = 'main') => landedOn(dir, into),
  /** Every path the default branch holds. @param {string} dir @param {string} [into] */
  holds: (dir, into = 'main') => pathsOn(dir, into),
  /** The commit the default branch is at. @param {string} dir @param {string} [into] */
  defaultTip: (dir, into = 'main') => git(dir, ['rev-parse', into]).trim(),
  /** The unit's tasks the driver opened in the repository at `dir`, by id. @param {string} dir */
  opened: (dir) => {
    const phases = git(dir, ['for-each-ref', '--format=%(refname:lstrip=2)', `refs/heads/feat/${UNIT}-phase-*`]).split('\n').filter(Boolean);
    return [...new Set(phases.flatMap((branch) => landedOn(dir, branch).map(({ task }) => task)))].sort();
  },
  /** A merge in the repository at `dir` refused until `undo`: its checkout in the middle of a merge, as a merge stopped there leaves it. @param {string} dir */
  refuseMerge: (dir) => {
    const marker = path.resolve(dir, git(dir, ['rev-parse', '--git-path', 'MERGE_HEAD']).trim());
    fs.writeFileSync(marker, `${git(dir, ['rev-parse', 'HEAD']).trim()}\n`);
    return { env: {}, undo: () => fs.rmSync(marker) };
  },
};
