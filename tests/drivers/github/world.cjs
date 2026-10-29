'use strict';

// The fake GitHub a suite of GitHub's landing driver runs against
// (gh-stub.cjs): made inside a world's git directory, so each copy of the
// world carries its own (`githubWorld`) — and inside each nested
// repository's, a repository on GitHub of its own; reached by the stand-in
// `gh`, shadowing any other on the PATH, and by the stand-in ssh. Its remote is
// 29.2's fake GitHub remote (engine-harness.cjs, `githubOffline`): a GitHub
// URL rewritten to port 0, so a git call the stand-in ssh misses fails
// closed, never reaching github.com. Every call runs under `GH_ENV`, the
// stand-in first on the PATH, so the developer's gh is never reached; the
// hermetic environment keeps their login out (hermetic-env.cjs).
// What a person might do by hand on GitHub — close a pull request, merge
// one, change GitHub's default branch or its squash default — is done to
// the fake's state here. The fake starts with GitHub's own squash default.
// The verbs its suites call go through and refuse under `GH_ENV` (`ok`,
// `refused`), and a phase of two is built the one way (`stackOfTwo`).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { git, bareRepo, githubOffline, ok: harnessOk, refuses } = require('../../scripts/engine-harness.cjs');
const { TASKS, openArgs, mergeBack } = require('../../scripts/landing-world.cjs');
const { STATE_BRANCH } = require('../../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const stub = require('./gh-stub.cjs');

const REPOSITORY = 'acme/portal';
const SSH = path.join(__dirname, 'ssh');
/** The environment every call runs under, as a call's overlay. */
const GH_ENV = Object.freeze({ PATH: `${path.join(__dirname, 'bin')}:${process.env.PATH}` });

/** `GH_ENV` over the process's own, as a spawned shell takes it. @param {Record<string, string|undefined>} [more] */
function ghEnv(more = {}) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const [name, value] of Object.entries({ ...process.env, ...GH_ENV, ...more })) if (value !== undefined) env[name] = value;
  return env;
}

/** The fake GitHub's folder for the repository at `dir`, the world's own or one nested in it. @param {string} dir */
const githubOf = (dir) => stub.githubAt(dir);

/** The bare repository standing for GitHub's copy of the code of the repository at `dir`. @param {string} dir */
const bareOf = (dir) => stub.bareOf(githubOf(dir), stub.readState(githubOf(dir)));

/**
 * The fake GitHub made for the repository at `dir` — the world's own, or one
 * nested in it, standing for `repository` on GitHub — and its remote,
 * origin, on it: its URL GitHub's, reached through the stand-in ssh; its
 * default branch `into`, its tags and the state branch, where it has one,
 * pushed, and origin's HEAD naming the default branch.
 * @param {string} dir @param {{repository?: string, into?: string}} [opts]
 */
function githubWorld(dir, { repository = REPOSITORY, into = 'main' } = {}) {
  const at = githubOf(dir);
  const bare = bareRepo(path.join(at, `${repository}.git`), ['-b', into]);
  const state = git(dir, ['for-each-ref', '--format=%(refname:lstrip=2)', `refs/heads/${STATE_BRANCH}`]).trim();
  const pushed = [into, ...(state === '' ? [] : [state])].map((branch) => `refs/heads/${branch}:refs/heads/${branch}`);
  git(dir, ['config', 'include.path', path.basename(githubOffline(path.dirname(at)).GIT_CONFIG_GLOBAL)]);
  git(dir, ['config', 'core.sshCommand', SSH]);
  git(dir, ['remote', 'add', 'origin', `git@github.com:${repository}.git`]);
  git(dir, ['push', '-q', '--tags', 'origin', ...pushed]);
  git(dir, ['fetch', '-q', 'origin']);
  git(dir, ['remote', 'set-head', 'origin', into]);
  stub.writeState(at, { repo: repository, default: into, next: 1, method: 'merge', squash: { ...stub.GITHUB_SQUASH }, rulesets: [], pulls: [], stacks: [] });
  return bare;
}

/** What the fake GitHub in the world at `dir` holds. @param {string} dir */
const github = (dir) => stub.readState(githubOf(dir));

/** Change what the fake GitHub holds. @param {string} dir @param {(state: ReturnType<typeof github>) => void} change */
function onGithub(dir, change) {
  const state = github(dir);
  change(state);
  stub.writeState(githubOf(dir), state);
}

/** Every gh call made in the world, oldest first, each its words. @param {string} dir */
function calls(dir) {
  const log = path.join(githubOf(dir), 'calls');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
}

/** A pull request closed by hand on GitHub. @param {string} dir @param {number} number */
function closeByHand(dir, number) {
  onGithub(dir, (state) => {
    const pull = state.pulls.find((held) => held.number === number);
    if (pull !== undefined) pull.state = 'CLOSED';
  });
}

/** A pull request squash-merged by hand on GitHub, into `into`, else its base. @param {string} dir @param {number} number @param {string} [into] */
function mergeByHand(dir, number, into) {
  onGithub(dir, (state) => {
    const pull = state.pulls.find((held) => held.number === number);
    if (pull === undefined) throw new Error(`no pull request #${number}`);
    stub.mergePull(githubOf(dir), state, pull, 'squash', { into, subject: pull.title });
  });
}

/** GitHub's own default branch moved to `branch`, made from main there, as a person might change it after cloning. @param {string} dir @param {string} branch */
function defaultOnGithub(dir, branch) {
  execFileSync('git', ['branch', branch, 'main'], { cwd: bareOf(dir) });
  onGithub(dir, (state) => {
    state.default = branch;
  });
}

/** The repository's squash default made the pull request's title and description, as setup's yes makes it. @param {string} dir */
function squashFromPullRequests(dir) {
  onGithub(dir, (state) => {
    state.squash = { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'PR_BODY' };
  });
}

/** A branch's tip on GitHub, or '' where GitHub has none. @param {string} dir @param {string} branch */
const tipOnGithub = (dir, branch) => git(bareOf(dir), ['for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`]).trim();

/** The pull requests GitHub holds, each its number, state and base. @param {string} dir */
const pulls = (dir) => github(dir).pulls.map(({ number, state, base }) => ({ number, state, base }));

/** A verb that must go through, under the stand-in gh. @param {string} dir @param {string[]} args @param {Record<string, string|undefined>} [env] */
const ok = (dir, args, env = {}) => harnessOk(dir, args, { env: { ...GH_ENV, ...env } });

/** A verb that must refuse, its refusal. @param {string} dir @param {string[]} args @param {Record<string, string|undefined>} [env] */
const refused = (dir, args, env = {}) => refuses(dir, args, { env: { ...GH_ENV, ...env } }).error;

/** A phase of two in the landing world: card opened from main, total merged back onto it and opened on it, the two linked. @param {string} dir */
function stackOfTwo(dir) {
  const { card, total } = TASKS;
  ok(dir, openArgs(card));
  mergeBack(dir, total.branch, card.branch);
  ok(dir, openArgs(total));
  ok(dir, ['land', 'chain', 'pay', '1.2']);
}

module.exports = {
  REPOSITORY, GH_ENV, ghEnv, githubWorld, github, onGithub, bareOf, calls, closeByHand, mergeByHand, defaultOnGithub, squashFromPullRequests, tipOnGithub,
  pulls, ok, refused, stackOfTwo,
};
