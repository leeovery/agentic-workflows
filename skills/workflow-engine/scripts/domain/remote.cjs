'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's remote, read for whatever asks where the
// project's code is hosted — the drivers' landing default and the GitHub
// rule. The remote is the one the state goes to (state-worktree.cjs). Its
// URL is read here, and whether it names a GitHub repository; nothing here
// acts on a host.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { stateRemoteUrl } = require('./state-worktree.cjs');

/** @typedef {{owner: string, repo: string}} GithubRepository */

// A remote on GitHub, as a URL (https, ssh, git) or scp-like (`git@github.com:o/r`).
const GITHUB_URL = /^(?:(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/|[^@/:]+@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

/**
 * The URL of the project's remote, or null where it has none chosen.
 * @param {string} cwd
 * @returns {string|null}
 */
function remoteUrl(cwd) {
  return stateRemoteUrl(stateRoot(cwd));
}

/**
 * The GitHub repository a remote URL names, or null where it is not on
 * GitHub.
 * @param {string} url
 * @returns {GithubRepository|null}
 */
function githubRepository(url) {
  const named = GITHUB_URL.exec(url.trim());
  return named === null ? null : { owner: named[1], repo: named[2] };
}

module.exports = { remoteUrl, githubRepository };
