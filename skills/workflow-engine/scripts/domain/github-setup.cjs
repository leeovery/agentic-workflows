'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what setup offers to set on GitHub, each through the code
// host's driver — the landing driver serving the state's remote, whatever
// the project's landing setting (drivers.cjs, `hostDriver`) — and each on
// the person's yes alone:
//
// - The GitHub rule (4.4.6): a rule on `leeway-state` refusing its deletion
//   and any push that is not a fast-forward, for anything run outside Claude
//   Code; offered wherever the code host's driver can set it.
// - The squash default (7.2.18): a squash merge's commit made from the pull
//   request's title and description, so each task lands under its own
//   subject and id; offered only where the project also lands through that
//   driver, since landing refuses a stack merge until it is set.
//
// An offer stands until it is answered, and the answer is recorded on the
// project manifest either way, as the walkthrough's is, so it is never made
// again — and, on the state branch, never made to another clone of the
// project. A setting the driver could not make is said, with why, and setup
// carries on without it. What is recorded is what happened: `set`,
// `declined`, or `failed` with why — so the manifest never says a setting is
// made when it is not.
// ---------------------------------------------------------------------------

const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { commitStateScoped, noteIfNothingCommitted, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { STATE_BRANCH } = require('./state-worktree.cjs');
const { remoteUrl } = require('./remote.cjs');
const { hostDriver, chosenDriver } = require('./drivers.cjs');

/** @typedef {import('./drivers.cjs').LandingDriver} LandingDriver */

/** What the project manifest records once an offer is answered. */
const STATUSES = /** @type {const} */ (['set', 'declined', 'failed']);

/** @typedef {typeof STATUSES[number]} GithubStatus */
/** @typedef {{status: GithubStatus, reason?: string}} GithubRecord */

/**
 * An offer: its verb and the project manifest's field for its answer; what
 * a commit names it; the driver's method that makes it, how it is called,
 * and whether the project must land through that driver for it to be
 * offered; and the words of a yes where it is not offered, and of a setting
 * not made.
 * @typedef {{
 *   verb: string, field: string, named: string, landingOnly: boolean, method: 'protectBranch'|'setSquashDefault',
 *   make: (host: Required<LandingDriver>, root: string, url: string) => {repository: string, unset: string|null},
 *   nowhere: string, unset: (repository: string, why: string) => string,
 * }} Offer
 */

/** @type {Offer} */
const RULE = {
  verb: 'github-rule',
  field: 'github_rule',
  named: `the GitHub rule on ${STATE_BRANCH}`,
  landingOnly: false,
  method: 'protectBranch',
  make: (host, root, url) => host.protectBranch(root, url, STATE_BRANCH),
  nowhere: 'the state\'s remote is not on GitHub — there is no repository to set the rule on',
  unset: (repository, why) => `the rule against deleting or force-pushing ${STATE_BRANCH} was not set on ${repository}: ${why} — set it by hand under the repository's Settings → Rules`,
};

/** @type {Offer} */
const SQUASH = {
  verb: 'github-squash',
  field: 'github_squash',
  named: 'the GitHub squash default',
  landingOnly: true,
  method: 'setSquashDefault',
  make: (host, root, url) => host.setSquashDefault(root, url),
  nowhere: 'the project does not land through GitHub — there is no repository to set the squash default on',
  unset: (repository, why) => `the squash default was not set on ${repository}: ${why} — set it by hand in the repository's Settings, under Pull Requests, as the default commit message "Pull request title and description"`,
};

/**
 * The code host's driver that makes an offer's setting, and the state's
 * remote's URL, or null where none does — or, for an offer only landing
 * calls for, where the project does not land through it.
 * @param {string} cwd @param {Offer} offer
 * @returns {{host: LandingDriver, url: string}|null}
 */
function codeHost(cwd, offer) {
  const url = remoteUrl(cwd);
  const host = url === null ? null : hostDriver(url);
  if (host === null || host[offer.method] === undefined) return null;
  if (offer.landingOnly && landsThrough(cwd) !== host.name) return null;
  return { host, url: /** @type {string} */ (url) };
}

/**
 * The name of the driver the project lands through, settled or not, or
 * null where the project manifest names one the workflows don't ship.
 * @param {string} cwd
 * @returns {string|null}
 */
function landsThrough(cwd) {
  try {
    return chosenDriver(cwd, 'landing').driver.name;
  } catch {
    return null;
  }
}

/**
 * The answer the project manifest records for an offer, or null where none
 * is — a missing or unreadable manifest, or a field of another shape,
 * records none.
 * @param {string} cwd @param {Offer} offer
 * @returns {GithubStatus|null}
 */
function recordedAnswer(cwd, offer) {
  /** @type {unknown} */
  let manifest;
  try {
    manifest = readProjectManifest(cwd);
  } catch {
    return null;
  }
  const record = isObject(manifest) ? manifest[offer.field] : undefined;
  const status = isObject(record) ? record.status : undefined;
  return STATUSES.find((recorded) => recorded === status) ?? null;
}

/**
 * Whether boot makes an offer: there is a code host's driver to make it,
 * and it was never answered.
 * @param {string} cwd @param {Offer} offer
 * @returns {boolean}
 */
function offered(cwd, offer) {
  return recordedAnswer(cwd, offer) === null && codeHost(cwd, offer) !== null;
}

/**
 * What a yes did: the setting made, or why it was not — said as a warning
 * too, with where to make it by hand. Refuses where the offer is not made.
 * @param {string} cwd @param {Offer} offer @param {string[]} warnings
 * @returns {GithubRecord}
 */
function makeOnYes(cwd, offer, warnings) {
  const at = codeHost(cwd, offer);
  if (at === null) throw new Error(`${offer.verb}: ${offer.nowhere}`);
  const { repository, unset } = offer.make(/** @type {Required<LandingDriver>} */ (at.host), codeRoot(cwd), at.url);
  if (unset === null) return { status: 'set' };
  warnings.push(offer.unset(repository, unset));
  return { status: 'failed', reason: unset };
}

/**
 * Answer an offer — `yes` makes the setting through the code host's
 * driver, `no` makes nothing — and record what happened on the project
 * manifest, committed confined to it: `set`, `declined`, or `failed` with
 * why. The offer is never made again, whichever is recorded. Refuses
 * another answer, a yes where the offer is not made, and an offer already
 * answered.
 * @param {string} cwd @param {Offer} offer @param {string} answer
 * @returns {{status: GithubStatus, reason?: string, committed: string|null, note?: string, warnings?: string[]}}
 */
function answerOffer(cwd, offer, answer) {
  if (answer !== 'yes' && answer !== 'no') throw new Error(`${offer.verb}: the answer is yes or no — got "${answer}"`);
  const recorded = recordedAnswer(cwd, offer);
  if (recorded !== null) throw new Error(`${offer.verb}: the offer is answered — "${recorded}" is recorded, and an answer is recorded once`);
  /** @type {string[]} */
  const warnings = [];
  /** @type {GithubRecord} */
  const record = answer === 'yes' ? makeOnYes(cwd, offer, warnings) : { status: 'declined' };
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    manifest[offer.field] = record;
    writeProjectManifestAtomic(cwd, manifest);
  });
  const committed = commitStateScoped(cwd, PROJECT_MANIFEST_SPEC, `chore: ${offer.named} ${record.status}`);
  warnings.push(...committed.warnings);
  /** @type {ReturnType<typeof answerOffer>} */
  const result = { status: record.status, ...(record.reason === undefined ? {} : { reason: record.reason }), committed: committed.committed };
  noteIfNothingCommitted(result, committed.committed);
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/**
 * An offer's answer as its verb gives it, the status under the offer's field.
 * @param {Offer} offer
 * @returns {(cwd: string, answer: string) => Record<string, unknown>}
 */
const answering = (offer) => (cwd, answer) => {
  const { status, ...rest } = answerOffer(cwd, offer, answer);
  return { [offer.field]: status, ...rest };
};

module.exports = {
  githubRuleOffered: (/** @type {string} */ cwd) => offered(cwd, RULE),
  answerGithubRule: answering(RULE),
  githubSquashOffered: (/** @type {string} */ cwd) => offered(cwd, SQUASH),
  answerGithubSquash: answering(SQUASH),
};
