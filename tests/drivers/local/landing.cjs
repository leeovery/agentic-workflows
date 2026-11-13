'use strict';

// The local landing driver's side of the landing conformance suites
// (test-engine-landing-conformance*.cjs): the landing world as it stands, no
// remote and no host, the project set to the driver, and a nested
// repository needing nothing more; a repository lands in itself, so what
// landed is what its default branch itself gained, what it holds is its
// own tree, and what the driver opened there is what its phases' branches
// land. A merge there is refused while its default branch's checkout is in
// the middle of a merge. A person merges a quick-fix's branch by hand in
// their own terminal, squashed, with a merge commit or fast-forwarded — the
// last two keeping its own commits — and a task's branch squashed under
// git's own message, or, no landing of it opened, under their own;
// cherry-picks a commit onto the default branch there; and deletes a
// branch. A quick-fix is
// open in a repository while its opening's ref is there. A person lands a
// phase's branch by hand in their terminal too: squashed under git's own
// squash message or their own, or with a merge commit; its tasks' own
// commits rebased onto the default branch, as GitHub's rebase merges them;
// or fast-forwarded, the default branch moved to its last task's branch.

const fs = require('fs');
const path = require('path');
const { git } = require('../../scripts/engine-harness.cjs');
const { UNIT, setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');
const names = require('../../../skills/leeway-engine/scripts/domain/landing-names.cjs');

/** A phase's branch squashed onto main, committed under git's own squash message, else `message`. @param {string} dir @param {number} phase @param {string} [message] */
const phaseSquashed = (dir, phase, message) => onMain(dir, [['merge', '-q', '--squash', names.phaseBranch(UNIT, phase)], ['commit', '-q', ...(message === undefined ? ['--no-edit'] : ['-m', message])]]);

/** Git calls made with the default branch `into` checked out, the checkout then put back on the branch it was on. @param {string} dir @param {string[][]} calls @param {string} [into] */
function onMain(dir, calls, into = 'main') {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['switch', '-q', into]);
  for (const args of calls) git(dir, args);
  git(dir, ['switch', '-q', back]);
}

/** The branch of the phase's last task. @param {string} dir @param {number} phase */
function lastTaskBranch(dir, phase) {
  const tasks = git(dir, ['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads/']).split('\n')
    .flatMap((branch) => {
      const ref = names.taskOfBranch(UNIT, branch);
      return ref?.phase === phase ? [{ branch, n: ref.n }] : [];
    });
  return tasks.reduce((last, task) => (task.n > last.n ? task : last)).branch;
}

/** Squashed, under the person's own message. @param {string} dir @param {string} branch @param {string} [into] */
const squashedOwn = (dir, branch, into) => onMain(dir, [['merge', '-q', '--squash', branch], ['commit', '-q', '-m', 'Spell it the British way']], into);

/** Merged in with a merge commit. @param {string} dir @param {string} branch @param {string} [into] */
const mergeCommit = (dir, branch, into) => onMain(dir, [['merge', '-q', '--no-ff', '-m', `Merge ${branch}`, branch]], into);

module.exports = {
  /** The environment every call runs under: the suite's own. */
  env: {},
  /** The most git commands the engine runs for each land verb in the landing world (test-engine-landing-conformance-record.cjs). */
  gitCalls: { open: 36, phase: 38, again: 23, finish: 76 },
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
  /** Whether the quick-fix `unit` is open in the repository at `dir`: its opening's ref there. @param {string} dir @param {string} unit */
  quickFixOpen: (dir, unit) => git(dir, ['for-each-ref', '--format=%(refname)', `refs/leeway/quick-fix/${unit}/open`]).trim() !== '',
  /** A merge in the repository at `dir` refused until `undo`: its checkout in the middle of a merge, as a merge stopped there leaves it. @param {string} dir */
  refuseMerge: (dir) => {
    const marker = path.resolve(dir, git(dir, ['rev-parse', '--git-path', 'MERGE_HEAD']).trim());
    fs.writeFileSync(marker, `${git(dir, ['rev-parse', 'HEAD']).trim()}\n`);
    return { env: {}, undo: () => fs.rmSync(marker) };
  },
  /** The ways a person merges a quick-fix's branch onto the default branch `into` in their own terminal, the checkout put back where it was. */
  byHand: {
    'a squash of its branch': squashedOwn,
    'a merge commit of its branch': mergeCommit,
  },
  /** A task's branch squashed by hand onto the default branch `into` under the person's own message, no landing of it opened. */
  squashedHere: squashedOwn,
  /** A task's branch merged by hand onto the default branch `into` by a merge commit, no landing of it opened. */
  mergedHere: mergeCommit,
  /** A task's branch fast-forwarded by hand onto the default branch `into`, no landing of it opened. @param {string} dir @param {string} branch @param {string} [into] */
  forwardedHere: (dir, branch, into) => onMain(dir, [['merge', '-q', '--ff-only', branch]], into),
  /** A task's own commits copied by hand onto the default branch `into`, oldest first, as a rebase merge lays them, its branch as it was, no landing of it opened. @param {string} dir @param {string} branch @param {string} [into] */
  rebasedHere: (dir, branch, into = 'main') => onMain(dir, [['cherry-pick', `${into}..${branch}`]], into),
  /** A task's branch squashed by hand under git's own squash message — here, the default branch landing it having nowhere else to be brought from. @param {string} dir @param {string} branch */
  byHandUnpulled: (dir, branch) => onMain(dir, [['merge', '-q', '--squash', branch], ['commit', '-q', '--no-edit']]),
  /** The ways of those, and others, that keep the branch's own commits on the default branch here. */
  byHandKeeping: {
    /** Fast-forwarded. @param {string} dir @param {string} branch @param {string} [into] */
    'a fast-forward of its branch': (dir, branch, into) => onMain(dir, [['merge', '-q', '--ff-only', branch]], into),
    'a merge commit of its branch': mergeCommit,
  },
  /** The default branch here brought to the host's: nothing to bring, the repository landing in itself. */
  pulled: () => {},
  /** The default branch here pushed to the host: nowhere to push it. */
  pushed: () => {},
  /** A pull request merged by hand on the host: none, there being no host. */
  mergedOnHost: null,
  /** A branch deleted, the checkout first put on the default branch `into` where it has the branch out. @param {string} dir @param {string} branch @param {string} [into] */
  deleted: (dir, branch, into = 'main') => {
    if (git(dir, ['symbolic-ref', '-q', '--short', 'HEAD']).trim() === branch) git(dir, ['switch', '-q', into]);
    git(dir, ['branch', '-q', '-D', branch]);
  },
  /** The push a way on that remakes a branch ends with, over its copy on the host: none, there being no host. */
  pushedOver: () => null,
  /** A commit cherry-picked by hand onto the default branch `into`, in the person's own terminal. @param {string} dir @param {string} commit @param {string} [into] */
  picked: (dir, commit, into) => onMain(dir, [['cherry-pick', commit]], into),
  /** The ways a person lands a phase's branch onto main in their own terminal, the checkout put back where it was. */
  phaseByHand: {
    /** Squashed under git's own squash message. @param {string} dir @param {number} phase */
    'a squash under the default message': (dir, phase) => phaseSquashed(dir, phase),
    /** Squashed under the person's own message. @param {string} dir @param {number} phase */
    'a squash under the person\'s own message': (dir, phase) => phaseSquashed(dir, phase, 'In my own words'),
    /** With a merge commit. @param {string} dir @param {number} phase */
    'a merge commit': (dir, phase) => mergeCommit(dir, names.phaseBranch(UNIT, phase)),
    /** Its tasks' own commits put onto main one by one, under their own messages. @param {string} dir @param {number} phase */
    'a rebase': (dir, phase) => onMain(dir, [['cherry-pick', `main..${lastTaskBranch(dir, phase)}`]]),
    /** Fast-forwarded to its last task's branch. @param {string} dir @param {number} phase */
    'a fast-forward': (dir, phase) => onMain(dir, [['merge', '-q', '--ff-only', lastTaskBranch(dir, phase)]]),
  },
};
