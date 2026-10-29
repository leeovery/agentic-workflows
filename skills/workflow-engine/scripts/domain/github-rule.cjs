'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the GitHub rule (4.4.6). Where the state's remote is served by
// a code host's driver that can set it — the landing driver serving the
// remote, whatever the project's landing setting (drivers.cjs, `hostDriver`)
// — setup offers a rule on `leeway-state` refusing its deletion and any push
// that is not a fast-forward, for anything run outside Claude Code. The
// offer stands until it is answered, and the answer is recorded on the
// project manifest either way, as the walkthrough's is, so it is never made
// again — and, on the state branch, never made to another clone of the
// project. A yes sets the rule through that driver; a rule it could not set
// is said, with why, and setup carries on without it. What is recorded is
// what happened: the rule `set`, the offer `declined`, or the yes `failed`,
// with why — so the manifest never says the rule is there when it is not.
// ---------------------------------------------------------------------------

const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { commitStateScoped, noteIfNothingCommitted, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { STATE_BRANCH } = require('./state-worktree.cjs');
const { remoteUrl } = require('./remote.cjs');
const { hostDriver } = require('./drivers.cjs');

/** What the project manifest records once the offer is answered. */
const STATUSES = /** @type {const} */ (['set', 'declined', 'failed']);

/** @typedef {typeof STATUSES[number]} GithubRuleStatus */
/** @typedef {{status: GithubRuleStatus, reason?: string}} GithubRuleRecord */

/**
 * The state's remote's URL and the code host's driver that sets the rule
 * there, or null where none can.
 * @param {string} cwd
 * @returns {{url: string, protectBranch: NonNullable<import('./drivers.cjs').LandingDriver['protectBranch']>}|null}
 */
function codeHost(cwd) {
  const url = remoteUrl(cwd);
  const host = url === null ? null : hostDriver(url);
  return host === null || host.protectBranch === undefined ? null : { url: /** @type {string} */ (url), protectBranch: host.protectBranch };
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
 * Whether boot offers the rule: the state's remote is served by a code
 * host's driver that sets it, and the offer was never answered.
 * @param {string} cwd
 * @returns {boolean}
 */
function githubRuleOffered(cwd) {
  return recordedAnswer(cwd) === null && codeHost(cwd) !== null;
}

/**
 * What a yes did: the rule set, or why it was not — said as a warning too,
 * with where to set it by hand. Refuses where no code host's driver serves
 * the state's remote.
 * @param {string} cwd @param {string[]} warnings
 * @returns {GithubRuleRecord}
 */
function setOnYes(cwd, warnings) {
  const host = codeHost(cwd);
  if (host === null) throw new Error('github-rule: the state\'s remote is not on GitHub — there is no repository to set the rule on');
  const { repository, unset } = host.protectBranch(host.url, STATE_BRANCH);
  if (unset === null) return { status: 'set' };
  warnings.push(`the rule against deleting or force-pushing ${STATE_BRANCH} was not set on ${repository}: ${unset} — set it by hand under the repository's Settings → Rules`);
  return { status: 'failed', reason: unset };
}

/**
 * Answer the offer — `yes` sets the rule through the code host's driver,
 * `no` sets nothing — and record what happened on the project manifest,
 * committed confined to it: `set`, `declined`, or `failed` with why. The
 * offer is never made again, whichever is recorded. Refuses another answer,
 * a yes where no code host's driver serves the state's remote, and an
 * offer already answered.
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

module.exports = { githubRuleOffered, answerGithubRule };
