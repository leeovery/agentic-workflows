'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the GitHub rule (4.4.6). Where the state's remote is on
// GitHub, setup offers a repository ruleset on `leeway-state` refusing its
// deletion and any push that is not a fast-forward, for anything run outside
// Claude Code. The offer stands until it is answered, and the answer is
// recorded on the project manifest either way, as the walkthrough's is, so
// it is never made again — and, on the state branch, never made to another
// clone of the project. A yes sets the rule through `gh`; a `gh` that is
// missing, signed out or refused is said, and setup carries on without it.
// What is recorded is what happened: the rule `set`, the offer `declined`,
// or the yes `failed`, with why — so the manifest never says the rule is
// there when it is not.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { commitStateScoped, noteIfNothingCommitted, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { STATE_BRANCH, stateRemoteUrl } = require('./state-worktree.cjs');

/** What the project manifest records once the offer is answered. */
const STATUSES = /** @type {const} */ (['set', 'declined', 'failed']);

/** @typedef {typeof STATUSES[number]} GithubRuleStatus */
/** @typedef {{status: GithubRuleStatus, reason?: string}} GithubRuleRecord */
/** @typedef {{owner: string, repo: string}} GithubRepository */

const GITHUB_HOST = 'github.com';
const GH_TIMEOUT_MS = 30000;

// A remote on GitHub, as a URL (https, ssh, git) or scp-like (`git@github.com:o/r`).
const GITHUB_URL = /^(?:(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/|[^@/:]+@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

/** The ruleset the yes sets: `leeway-state` never deleted, never pushed but by a fast-forward. */
const RULESET = Object.freeze({
  name: STATE_BRANCH,
  target: 'branch',
  enforcement: 'active',
  conditions: { ref_name: { include: [`refs/heads/${STATE_BRANCH}`], exclude: [] } },
  rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
});

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

/** The state's remote's GitHub repository, or null. @param {string} cwd @returns {GithubRepository|null} */
function stateRepository(cwd) {
  const url = stateRemoteUrl(stateRoot(cwd));
  return url === null ? null : githubRepository(url);
}

/**
 * The answer the project manifest records, or null where none is — a
 * missing or unreadable manifest, or a field of another shape, records none.
 * @param {string} cwd
 * @returns {GithubRuleStatus|null}
 */
function recordedAnswer(cwd) {
  /** @type {unknown} */
  let manifest;
  try {
    manifest = readProjectManifest(cwd);
  } catch {
    return null;
  }
  const rule = isObject(manifest) ? manifest.github_rule : undefined;
  const status = isObject(rule) ? rule.status : undefined;
  return STATUSES.find((recorded) => recorded === status) ?? null;
}

/**
 * Whether boot offers the rule: the state's remote is on GitHub, and the
 * offer was never answered.
 * @param {string} cwd
 * @returns {boolean}
 */
function githubRuleOffered(cwd) {
  return recordedAnswer(cwd) === null && stateRepository(cwd) !== null;
}

/**
 * Set the rule on the repository through `gh`: null where it is set, else
 * why it is not.
 * @param {GithubRepository} repository
 * @returns {string|null}
 */
function setRule({ owner, repo }) {
  const signedIn = spawnSync('gh', ['auth', 'status', '--hostname', GITHUB_HOST], { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  if (signedIn.error) {
    const missing = /** @type {NodeJS.ErrnoException} */ (signedIn.error).code === 'ENOENT';
    return missing ? 'gh is not installed' : `gh could not run: ${signedIn.error.message}`;
  }
  if (signedIn.status !== 0) return `gh is not signed in to ${GITHUB_HOST}`;
  const made = spawnSync('gh', ['api', '--method', 'POST', `repos/${owner}/${repo}/rulesets`, '--input', '-'], {
    encoding: 'utf8', input: JSON.stringify(RULESET), timeout: GH_TIMEOUT_MS,
  });
  if (made.error) return `gh could not run: ${made.error.message}`;
  if (made.status !== 0) return `gh refused it: ${(made.stderr || made.stdout || `exit ${made.status}`).trim()}`;
  return null;
}

/**
 * What a yes did: the rule set, or why it was not — said as a warning too,
 * with where to set it by hand. Refuses where the state's remote is not on
 * GitHub.
 * @param {string} cwd @param {string[]} warnings
 * @returns {GithubRuleRecord}
 */
function setOnYes(cwd, warnings) {
  const repository = stateRepository(cwd);
  if (repository === null) throw new Error('github-rule: the state\'s remote is not on GitHub — there is no repository to set the rule on');
  const unset = setRule(repository);
  if (unset === null) return { status: 'set' };
  warnings.push(`the rule against deleting or force-pushing ${STATE_BRANCH} was not set on ${repository.owner}/${repository.repo}: ${unset} — set it by hand under the repository's Settings → Rules`);
  return { status: 'failed', reason: unset };
}

/**
 * Answer the offer — `yes` sets the rule through `gh`, `no` sets nothing —
 * and record what happened on the project manifest, committed confined to
 * it: `set`, `declined`, or `failed` with why. The offer is never made
 * again, whichever is recorded. Refuses another answer, a yes where the
 * state's remote is not on GitHub, and an offer already answered.
 * @param {string} cwd @param {string} answer
 * @returns {{github_rule: GithubRuleStatus, reason?: string, committed: string|null, note?: string, warnings?: string[]}}
 */
function answerGithubRule(cwd, answer) {
  if (answer !== 'yes' && answer !== 'no') throw new Error(`github-rule: the answer is yes or no — got "${answer}"`);
  const recorded = recordedAnswer(cwd);
  if (recorded !== null) throw new Error(`github-rule: the offer is answered — "${recorded}" is recorded, and an answer is recorded once`);
  /** @type {string[]} */
  const warnings = [];
  /** @type {GithubRuleRecord} */
  const record = answer === 'yes' ? setOnYes(cwd, warnings) : { status: 'declined' };
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    manifest.github_rule = record;
    writeProjectManifestAtomic(cwd, manifest);
  });
  const committed = commitStateScoped(cwd, PROJECT_MANIFEST_SPEC, `chore: the GitHub rule on ${STATE_BRANCH} ${record.status}`);
  warnings.push(...committed.warnings);
  /** @type {ReturnType<typeof answerGithubRule>} */
  const result = { github_rule: record.status, ...(record.reason === undefined ? {} : { reason: record.reason }), committed: committed.committed };
  noteIfNothingCommitted(result, committed.committed);
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

module.exports = { RULESET, githubRepository, stateRepository, githubRuleOffered, answerGithubRule };
