'use strict';

// The local landing driver's side of the landing conformance suites
// (test-engine-landing-conformance*.cjs): the landing world as it stands, no
// remote and no host, the project set to the driver, and a nested
// repository needing nothing more; a repository lands in itself, so what
// landed is what its default branch itself gained, what it holds is its
// own tree, and what the driver opened there is what its phases' branches
// land. A merge there is refused while its default branch's checkout is in
// the middle of a merge. A person merges a task by hand in their own
// terminal: its branch, with a merge commit, or its phase's branch, the
// default branch fast-forwarded to it; and deletes a task's branch.

const fs = require('fs');
const path = require('path');
const { git } = require('../../scripts/engine-harness.cjs');
const { UNIT, setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');
const { phaseBranch } = require('../../../skills/leeway-engine/scripts/domain/landing-names.cjs');

/** @typedef {import('../../../skills/leeway-engine/scripts/domain/task-id.cjs').TaskRef} TaskRef */

/** A git call made with the default branch checked out, the checkout then put back on the branch it was on. @param {string} dir @param {string[]} args */
function onMain(dir, args) {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['switch', '-q', 'main']);
  git(dir, args);
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
  /** The ways a person merges an opened task onto the default branch in their own terminal, the checkout put back where it was. */
  byHand: {
    /** The task's branch merged in with a merge commit. @param {string} dir @param {TaskRef} _ref @param {string} branch */
    'a merge commit of its branch': (dir, _ref, branch) => onMain(dir, ['merge', '-q', '--no-ff', '-m', `Merge ${branch}`, branch]),
    /** The default branch fast-forwarded to the task's phase's branch. @param {string} dir @param {TaskRef} ref */
    'its phase\'s branch fast-forwarded': (dir, ref) => onMain(dir, ['merge', '-q', '--ff-only', phaseBranch(ref.unit, ref.phase)]),
  },
  /** A task's branch deleted, the checkout first put on main where it has the branch out. @param {string} dir @param {string} branch */
  deleted: (dir, branch) => {
    if (git(dir, ['symbolic-ref', '-q', '--short', 'HEAD']).trim() === branch) git(dir, ['switch', '-q', 'main']);
    git(dir, ['branch', '-q', '-D', branch]);
  },
  /** What a merge back of the default branch takes: the branch itself. */
  back: 'main',
};
