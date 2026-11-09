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
// commit pulled keeping its own commits here; and deletes a branch, on
// GitHub and here.

const path = require('path');
const { git } = require('../../scripts/engine-harness.cjs');
const { UNIT, setLandingDriver, landedOn, pathsOn } = require('../../scripts/landing-world.cjs');
const names = require('../../../skills/leeway-engine/scripts/domain/landing-names.cjs');
const { taskId } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');
const { GH_ENV, githubWorld, github, bareOf, squashFromPullRequests, mergeByHand } = require('./world.cjs');

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
  if (pulled) git(dir, ['fetch', '-q', 'origin', `${into}:${into}`]);
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
  /** The ways a person merges it there that keep the branch's own commits on the default branch here. */
  byHandKeeping: {
    /** With a merge commit, pulled. @param {string} dir @param {string} branch @param {string} [into] */
    'a merge commit on GitHub, pulled': (dir, branch, into) => mergedOnGithub(dir, branch, 'merge', true, into),
  },
  deleted,
  mergedOnGithub,
};
