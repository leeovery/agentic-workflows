'use strict';

// The local landing driver's side of the landing conformance suites
// (test-engine-landing-conformance*.cjs): the landing world as it stands, no
// remote and no host, the project set to the driver, and a nested
// repository needing nothing more; a repository lands in itself, so what
// landed is what its default branch itself gained, what it holds is its
// own tree, and what the driver opened there is what its phases' branches
// land. A merge there is refused while its default branch's checkout is in
// the middle of a merge. A person merges a quick-fix's branch by hand in
// their own terminal, squashed or with a merge commit; and deletes a
// branch.

const fs = require('fs');
const path = require('path');
const { git } = require('../../scripts/engine-harness.cjs');
const { UNIT, setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');

/** Git calls made with the default branch checked out, the checkout then put back on the branch it was on. @param {string} dir @param {string[][]} calls */
function onMain(dir, calls) {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['switch', '-q', 'main']);
  for (const args of calls) git(dir, args);
  git(dir, ['switch', '-q', back]);
}

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
  /** The ways a person merges a quick-fix's branch onto the default branch in their own terminal, the checkout put back where it was. */
  byHand: {
    /** Squashed, under the person's own message. @param {string} dir @param {string} branch */
    'a squash of its branch': (dir, branch) => onMain(dir, [['merge', '-q', '--squash', branch], ['commit', '-q', '-m', 'Spell it the British way']]),
    /** Merged in with a merge commit. @param {string} dir @param {string} branch */
    'a merge commit of its branch': (dir, branch) => onMain(dir, [['merge', '-q', '--no-ff', '-m', `Merge ${branch}`, branch]]),
  },
  /** A branch deleted, the checkout first put on main where it has the branch out. @param {string} dir @param {string} branch */
  deleted: (dir, branch) => {
    if (git(dir, ['symbolic-ref', '-q', '--short', 'HEAD']).trim() === branch) git(dir, ['switch', '-q', 'main']);
    git(dir, ['branch', '-q', '-D', branch]);
  },
};
