'use strict';

// GitHub's landing driver's side of the landing conformance suites
// (test-engine-landing-conformance*.cjs): the landing world on a fake GitHub
// (world.cjs), the project set to the driver and the repository's squash
// default to the pull request's title and description, as setup's yes sets
// it, every call made under the stand-in gh; a repository nested in the
// world on a fake GitHub of its own, `acme/{folder}`, set the same. A
// repository lands in its copy on GitHub, so what landed is what the
// default branch there gained, each subject read past the " (#N)" GitHub
// ends it with, what it holds is its tree there, and what the driver opened
// is a pull request there. A merge there is refused while GitHub refuses
// it, as for a required check. A person merges a quick-fix's pull request
// by hand on GitHub's site, as the site's button does — squashed, with a
// merge commit or rebased — pulling main here after it or not, a merge
// commit pulled keeping its own commits here; cherry-picks a commit onto
// the default branch here, pushing it to GitHub, and squashes a task's
// branch onto it here under their own words, pushing it, no pull request
// of it opened — every push by hand marking merged each pull request open
// onto that branch whose head it now holds, as GitHub marks one, a squash
// or a pick leaving it open; and deletes a branch, on
// GitHub and here. A quick-fix is open in a repository while a pull
// request of its branch is open there. A person lands a phase by hand on
// GitHub's site too, each of its pull requests, bottom first, merged onto
// main — squashed under GitHub's own squash message, its commits' own, or
// under their own words, with a merge commit, or rebased — or pushes its
// last task's branch to main there, which GitHub reads as merging each of
// its pull requests, and pulls main here.

const path = require('path');
const { spawnSync } = require('child_process');
const { git } = require('../../scripts/engine-harness.cjs');
const { UNIT, setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');
const names = require('../../../skills/leeway-engine/scripts/domain/landing-names.cjs');
const { taskId } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');
const { GH_ENV, githubWorld, github, onGithub, bareOf, squashFromPullRequests, mergeByHand } = require('./world.cjs');
const stub = require('./gh-stub.cjs');

/**
 * Each open pull request of a phase, bottom first, merged by hand on
 * GitHub onto main by `method`, as the site's button merges it — a squash
 * under GitHub's own squash message, else under `words` where given — and
 * main here then pulled.
 * @param {string} dir @param {number} phase @param {'squash'|'merge'|'rebase'} method @param {{subject: string, body: string}} [words]
 */
function phaseOnGithub(dir, phase, method, words) {
  onGithub(dir, (state) => {
    const kept = state.squash;
    state.squash = { ...stub.GITHUB_SQUASH };
    const pulls = state.pulls.filter((pull) => pull.state === 'OPEN' && names.taskOfBranch(UNIT, pull.head)?.phase === phase).sort((a, b) => a.number - b.number);
    for (const pull of pulls) stub.mergePulls(stub.githubAt(dir), state, [pull], method, { into: 'main', ...words });
    state.squash = kept;
  });
  pulledHere(dir);
}

/**
 * A phase's last open pull request's branch pushed by hand onto main on
 * GitHub, a fast-forward — each open pull request of the phase then merged
 * there, as GitHub marks one whose head its base holds — and main here then
 * pulled.
 * @param {string} dir @param {number} phase
 */
function phasePushed(dir, phase) {
  const pulls = github(dir).pulls.filter((pull) => pull.state === 'OPEN' && names.taskOfBranch(UNIT, pull.head)?.phase === phase).sort((a, b) => a.number - b.number);
  git(dir, ['push', '-q', 'origin', `refs/heads/${pulls[pulls.length - 1].head}:refs/heads/main`]);
  onGithub(dir, (state) => {
    for (const pull of state.pulls.filter((held) => pulls.some(({ number }) => number === held.number))) {
      const head = git(bareOf(dir), ['rev-parse', `refs/heads/${pull.head}`]).trim();
      Object.assign(pull, { state: 'MERGED', merged: head });
      git(bareOf(dir), ['update-ref', `refs/pull/${pull.number}/head`, head]);
    }
  });
  pulledHere(dir);
}

/**
 * The open pull request of a branch merged by hand on GitHub by `method`,
 * as the site's button merges it, and the default branch `into` here then
 * brought to its copy there, as a person's pull does, where `pulled`.
 * @param {string} dir @param {string} branch @param {'merge'|'squash'|'rebase'} method @param {boolean} pulled @param {string} [into]
 */
function mergedOnGithub(dir, branch, method, pulled, into = 'main') {
  const pull = github(dir).pulls.find((held) => held.head === branch && held.state === 'OPEN');
  if (pull === undefined) throw new Error(`no pull request of ${branch} is open`);
  mergeByHand(dir, pull.number, undefined, method);
  if (pulled) pulledHere(dir, into);
}

/**
 * Git calls made by hand with the default branch `into` checked out here,
 * then pushed to GitHub, the checkout put back on the branch it was on.
 * @param {string} dir @param {string} into @param {string[][]} calls
 */
function pushedFrom(dir, into, calls) {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['switch', '-q', into]);
  for (const args of calls) git(dir, args);
  pushedHere(dir, into);
  git(dir, ['switch', '-q', back]);
}

/**
 * The default branch `into` here brought to its copy on GitHub, as a
 * person's pull brings it.
 * @param {string} dir @param {string} [into]
 */
function pulledHere(dir, into = 'main') {
  if (git(dir, ['branch', '--show-current']).trim() === into) git(dir, ['pull', '-q', '--ff-only', '--no-recurse-submodules', 'origin', into]);
  else git(dir, ['fetch', '-q', 'origin', `${into}:${into}`]);
}

/**
 * The default branch `into` here pushed to GitHub by hand, and each pull
 * request open onto it whose head it now holds marked merged, as GitHub
 * marks one; a squash or a pick leaves it open.
 * @param {string} dir @param {string} [into]
 */
function pushedHere(dir, into = 'main') {
  git(dir, ['push', '-q', 'origin', into]);
  const bare = bareOf(dir);
  onGithub(dir, (state) => {
    for (const pull of state.pulls.filter((held) => held.state === 'OPEN' && held.base === into)) {
      const head = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${pull.head}`], { cwd: bare, encoding: 'utf8' }).stdout.trim();
      if (head === '' || spawnSync('git', ['merge-base', '--is-ancestor', head, into], { cwd: bare }).status !== 0) continue;
      Object.assign(pull, { state: 'MERGED', merged: head });
      git(bare, ['update-ref', `refs/pull/${pull.number}/head`, head]);
    }
  });
}

/**
 * The open pull request of a branch onto the default branch `into` merged
 * by hand on GitHub's site by `method`, as `mergedOnGithub` merges it:
 * whether one was open there to merge.
 * @param {string} dir @param {string} branch @param {'merge'|'squash'|'rebase'} method @param {boolean} pulled @param {string} [into]
 */
function mergedOnHost(dir, branch, method, pulled, into = 'main') {
  if (!github(dir).pulls.some((held) => held.head === branch && held.state === 'OPEN' && held.base === into)) return false;
  mergedOnGithub(dir, branch, method, pulled, into);
  return true;
}

/**
 * A branch deleted on GitHub, as `gh pr merge --delete-branch` leaves it,
 * and here, the checkout first put on the default branch `into` where it
 * has the branch out.
 * @param {string} dir @param {string} branch @param {string} [into]
 */
function deleted(dir, branch, into = 'main') {
  git(bareOf(dir), ['update-ref', '-d', `refs/heads/${branch}`]);
  if (git(dir, ['symbolic-ref', '-q', '--short', 'HEAD']).trim() === branch) git(dir, ['switch', '-q', into]);
  git(dir, ['branch', '-q', '-D', branch]);
}

module.exports = {
  /** The environment every call runs under. */
  env: GH_ENV,
  /** The most git commands the engine runs for each land verb in the landing world (test-engine-landing-conformance-record.cjs). */
  gitCalls: { open: 44, phase: 85, again: 29, finish: 89 },
  /** The world readied for the driver, once per process. @param {string} dir */
  prepare: (dir) => {
    setLandingDriver(dir, 'github');
    githubWorld(dir);
    squashFromPullRequests(dir);
  },
  /** A repository nested in the world readied for the driver, its default branch `into`. @param {string} dir @param {string} into */
  nest: (dir, into) => {
    githubWorld(dir, { repository: `acme/${path.basename(dir)}`, into });
    squashFromPullRequests(dir);
  },
  /** The repository the one at `dir` lands in: its copy on GitHub. @param {string} dir */
  on: (dir) => bareOf(dir),
  /** What GitHub's default branch gained, oldest first. @param {string} dir @param {string} [into] */
  landed: (dir, into = 'main') => landedOn(bareOf(dir), into).map((commit) => ({ ...commit, subject: commit.subject.replace(/ \(#\d+\)$/, '') })),
  /** Every path GitHub's default branch holds. @param {string} dir @param {string} [into] */
  holds: (dir, into = 'main') => pathsOn(bareOf(dir), into),
  /** The commit GitHub's default branch is at. @param {string} dir @param {string} [into] */
  defaultTip: (dir, into = 'main') => git(bareOf(dir), ['rev-parse', into]).trim(),
  /** The unit's tasks the driver opened a pull request of in the repository at `dir`, by id. @param {string} dir */
  opened: (dir) => [...new Set(github(dir).pulls.flatMap((pull) => {
    const ref = names.taskOfBranch(UNIT, pull.head);
    return ref === null ? [] : [taskId(ref)];
  }))].sort(),
  /** Whether the quick-fix `unit` is open in the repository at `dir`: a pull request of its branch open on GitHub. @param {string} dir @param {string} unit */
  quickFixOpen: (dir, unit) => github(dir).pulls.some((pull) => pull.state === 'OPEN' && pull.head === names.quickFixBranch(unit)),
  /** The repository at `dir` made to allow no merge commits, as its settings on GitHub may. @param {string} dir */
  noMergeCommits: (dir) => onGithub(dir, (state) => {
    state.merges = false;
  }),
  /** A merge in the repository at `dir` refused by GitHub while its environment is the call's. @param {string} dir */
  refuseMerge: (dir) => ({ env: { GH_STUB_FAULT: 'unmergeable@pr merge', GH_STUB_FAULT_REPO: github(dir).repo }, undo: () => {} }),
  /** The ways a person merges a quick-fix's pull request on GitHub's site, the default branch `into` here pulled after it or not. */
  byHand: {
    /** Squashed, pulled. @param {string} dir @param {string} branch @param {string} [into] */
    'a squash on GitHub, pulled': (dir, branch, into) => mergedOnGithub(dir, branch, 'squash', true, into),
    /** With a merge commit, the site's default button, not pulled. @param {string} dir @param {string} branch @param {string} [into] */
    'a merge commit on GitHub, not pulled': (dir, branch, into) => mergedOnGithub(dir, branch, 'merge', false, into),
    /** Rebased, pulled. @param {string} dir @param {string} branch @param {string} [into] */
    'a rebase on GitHub, pulled': (dir, branch, into) => mergedOnGithub(dir, branch, 'rebase', true, into),
  },
  /** A task's pull request squashed by hand on GitHub under its default message, main here not pulled. @param {string} dir @param {string} branch */
  byHandUnpulled: (dir, branch) => mergedOnGithub(dir, branch, 'squash', false),
  /** The ways a person merges it there that keep the branch's own commits on the default branch here. */
  byHandKeeping: {
    /** With a merge commit, pulled. @param {string} dir @param {string} branch @param {string} [into] */
    'a merge commit on GitHub, pulled': (dir, branch, into) => mergedOnGithub(dir, branch, 'merge', true, into),
  },
  deleted,
  mergedOnGithub,
  /** The default branch here brought to GitHub's. */
  pulled: pulledHere,
  /** The default branch here pushed to GitHub by hand, each pull request it now holds the head of marked merged. */
  pushed: pushedHere,
  mergedOnHost,
  /** The push a way on that remakes a branch ends with, over its copy on GitHub, leased on where GitHub holds it — null where it holds none. @param {string} dir @param {string} branch */
  pushedOver: (dir, branch) => {
    const held = git(bareOf(dir), ['for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`]).trim();
    return held === '' ? null : `git push --force-with-lease=refs/heads/${branch}:${held} origin ${branch}`;
  },
  /** A commit cherry-picked by hand onto the default branch `into` here and pushed to GitHub. @param {string} dir @param {string} commit @param {string} [into] */
  picked: (dir, commit, into = 'main') => pushedFrom(dir, into, [['cherry-pick', commit]]),
  /** A task's branch squashed by hand onto the default branch `into` here, under the person's own message, and pushed to GitHub, no pull request of it opened. @param {string} dir @param {string} branch @param {string} [into] */
  squashedHere: (dir, branch, into = 'main') => pushedFrom(dir, into, [['merge', '-q', '--squash', branch], ['commit', '-q', '-m', 'Spell it the British way']]),
  /** A task's branch merged by hand onto the default branch `into` here by a merge commit, and pushed to GitHub, no pull request of it opened. @param {string} dir @param {string} branch @param {string} [into] */
  mergedHere: (dir, branch, into = 'main') => pushedFrom(dir, into, [['merge', '-q', '--no-ff', '-m', `Merge ${branch}`, branch]]),
  /** A task's branch fast-forwarded by hand onto the default branch `into` here, and pushed to GitHub, no pull request of it opened. @param {string} dir @param {string} branch @param {string} [into] */
  forwardedHere: (dir, branch, into = 'main') => pushedFrom(dir, into, [['merge', '-q', '--ff-only', branch]]),
  /** A task's own commits copied by hand onto the default branch `into` here, oldest first, as a rebase merge lays them, its branch as it was, and pushed to GitHub, no pull request of it opened. @param {string} dir @param {string} branch @param {string} [into] */
  rebasedHere: (dir, branch, into = 'main') => pushedFrom(dir, into, [['cherry-pick', `${into}..${branch}`]]),
  /** The ways a person lands a phase by hand on GitHub's site, main here pulled after. */
  phaseByHand: {
    /** Squashed under GitHub's own squash message. @param {string} dir @param {number} phase */
    'a squash under the default message': (dir, phase) => phaseOnGithub(dir, phase, 'squash'),
    /** Squashed under the person's own message. @param {string} dir @param {number} phase */
    'a squash under the person\'s own message': (dir, phase) => phaseOnGithub(dir, phase, 'squash', { subject: 'In my own words', body: '' }),
    /** With a merge commit. @param {string} dir @param {number} phase */
    'a merge commit': (dir, phase) => phaseOnGithub(dir, phase, 'merge'),
    /** Rebased, each pull request's own commits put onto main under their own messages. @param {string} dir @param {number} phase */
    'a rebase': (dir, phase) => phaseOnGithub(dir, phase, 'rebase'),
    /** Fast-forwarded, its last task's branch pushed onto main there. @param {string} dir @param {number} phase */
    'a fast-forward': (dir, phase) => phasePushed(dir, phase),
  },
};
