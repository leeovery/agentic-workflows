'use strict';

// The fake GitHub a suite of GitHub's landing driver runs against
// (gh-stub.cjs): made inside a world's git directory, so each copy of the
// world carries its own (`githubWorld`); reached by the stand-in `gh`,
// shadowing any other on the PATH, and by the stand-in ssh. Its remote is
// 29.2's fake GitHub remote (engine-harness.cjs, `githubOffline`): a GitHub
// URL rewritten to port 0, so a git call the stand-in ssh misses fails
// closed, never reaching github.com. Every call runs under `GH_ENV`, the
// stand-in first on the PATH, so the developer's gh is never reached; the
// hermetic environment keeps their login out (hermetic-env.cjs).
// What a person might do by hand on GitHub — close a pull request, merge
// one, change GitHub's default branch or its squash default — is done to
// the fake's state here. The fake starts with GitHub's own squash default.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { git, bareRepo, githubOffline } = require('../../scripts/engine-harness.cjs');
const stub = require('./gh-stub.cjs');

const REPOSITORY = 'acme/portal';
const URL = `git@github.com:${REPOSITORY}.git`;
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

/** The fake GitHub's folder in the world at `dir`. @param {string} dir */
const githubOf = (dir) => path.join(dir, '.git', 'github');

/** The bare repository standing for GitHub's copy of the world's code. @param {string} dir */
const bareOf = (dir) => path.join(githubOf(dir), `${REPOSITORY}.git`);

/**
 * The fake GitHub made in the world at `dir`, and the world's remote, origin,
 * on it: its URL GitHub's, reached through the stand-in ssh; the default
 * branch, its tags and the state branch pushed, and origin's HEAD naming
 * the default branch.
 * @param {string} dir
 */
function githubWorld(dir) {
  const bare = bareRepo(bareOf(dir), ['-b', 'main']);
  git(dir, ['config', 'include.path', path.basename(githubOffline(path.join(dir, '.git')).GIT_CONFIG_GLOBAL)]);
  git(dir, ['config', 'core.sshCommand', SSH]);
  git(dir, ['remote', 'add', 'origin', URL]);
  git(dir, ['push', '-q', '--tags', 'origin', 'refs/heads/main:refs/heads/main', 'refs/heads/leeway-state:refs/heads/leeway-state']);
  git(dir, ['fetch', '-q', 'origin']);
  git(dir, ['remote', 'set-head', 'origin', 'main']);
  stub.writeState(githubOf(dir), { repo: REPOSITORY, default: 'main', next: 1, method: 'merge', squash: { ...stub.GITHUB_SQUASH }, rulesets: [], pulls: [], stacks: [] });
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

module.exports = { REPOSITORY, GH_ENV, ghEnv, githubWorld, github, onGithub, bareOf, calls, closeByHand, mergeByHand, defaultOnGithub, squashFromPullRequests, tipOnGithub };
