'use strict';

// ---------------------------------------------------------------------------
// GitHub's CLI and its stack extension as GitHub's landing driver runs them:
// never prompting, never telling of updates, against the repository named,
// in the code root, within a time limit. Each tool's version is read as the
// driver's needs declare it (22.4.9): null where it is not installed, the
// extension among them where gh does not know the command. A call that
// fails is refused in the words of what happened and the way on — gh not
// signed in, GitHub's rate limit, GitHub out of reach — or else in GitHub's
// own words, to settle what they name and land again; a setting setup could
// not make is said by the same reasons, in setup's words. gh's own calls exit 4
// where it is not signed in; the extension exits 4 on any failure of
// GitHub's API, so its calls are told apart by their words alone. A call
// that cannot run at all throws as it falls, for the seam to name the tool
// missing (landing.cjs). No refusal names an install command.
// ---------------------------------------------------------------------------

const { spawnSync } = require('../../../kernel/spawn.cjs');
const { plain } = require('../../../domain/landing-git.cjs');

const GH = 'gh';
const HOST = 'github.com';
const TIMEOUT_MS = 60000;
const QUIET = Object.freeze({ GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1', GH_SPINNER_DISABLED: '1', NO_COLOR: '1' });

const SIGNED_OUT = /gh auth login|not logged in|authentication required|bad credentials|HTTP 401/i;
const RATE_LIMITED = /rate limit/i;
const OFFLINE = /error connecting to|internet connection|could not resolve host|no such host|dial tcp|network is unreachable|connection refused|i\/o timeout|TLS handshake timeout/i;
const NO_STACK = /unknown command "stack"/;

/** @typedef {import('child_process').SpawnSyncReturns<string>} Ran */

/**
 * gh run with `args`: in `cwd`, against `repo` where one is named, `input`
 * on its stdin.
 * @param {string[]} args @param {{cwd?: string, repo?: string, input?: string}} [opts]
 * @returns {Ran}
 */
function spawnGh(args, { cwd, repo, input } = {}) {
  return spawnSync(GH, args, {
    cwd, input, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...QUIET, ...(repo === undefined ? {} : { GH_REPO: repo }) },
  });
}

/** What a run said, on one line. @param {Ran} ran */
function saidBy(ran) {
  return plain((ran.stderr || ran.stdout || `exited ${ran.status}`).split('\n').map((line) => line.trim()).filter(Boolean).join(' '));
}

/** Whether a failed run says gh is not signed in: gh's own exit for it, or its words. @param {string[]} args @param {Ran} ran @param {string} said */
const signedOut = (args, ran, said) => (args[0] !== 'stack' && ran.status === 4) || SIGNED_OUT.test(said);

/** @typedef {'signed-out'|'rate-limit'|'offline'|'refused'} Failure */

/**
 * Why a run that ran and exited non-zero failed, with what it said: gh not
 * signed in, GitHub's rate limit, GitHub out of reach, or else refused.
 * @param {string[]} args @param {Ran} ran
 * @returns {{why: Failure, said: string}}
 */
function failureOf(args, ran) {
  const said = saidBy(ran);
  if (signedOut(args, ran, said)) return { why: 'signed-out', said };
  if (RATE_LIMITED.test(said)) return { why: 'rate-limit', said };
  if (OFFLINE.test(said)) return { why: 'offline', said };
  return { why: 'refused', said };
}

/** A landing's refusal of a call, by why it failed. @type {Record<Failure, (said: string) => string>} */
const LANDING_SAYS = {
  'signed-out': () => `it is not signed in to ${HOST} — sign in with \`gh auth login\`, and land again`,
  'rate-limit': (said) => `GitHub's rate limit stopped it (${said}) — wait for the limit to reset, and land again`,
  offline: (said) => `it could not reach GitHub (${said}) — land again once the network is back`,
  refused: (said) => `${said} — settle what GitHub names, then land again`,
};

/** Setup's reason a setting is not made, by why its call failed. @type {Record<Failure, (said: string) => string>} */
const SETUP_SAYS = {
  'signed-out': () => `${GH} is not signed in to ${HOST}`,
  'rate-limit': (said) => `GitHub's rate limit stopped it (${said})`,
  offline: (said) => `${GH} could not reach GitHub (${said})`,
  refused: (said) => `${GH} refused it: ${said}`,
};

/**
 * gh's answer to `args`, refused where it fails: `what` names the call, as
 * a refusal says what gh could not do.
 * @param {string[]} args @param {string} what @param {{cwd?: string, repo?: string, input?: string}} [opts]
 * @returns {string}
 */
function gh(args, what, opts) {
  const ran = spawnGh(args, opts);
  const code = /** @type {NodeJS.ErrnoException|undefined} */ (ran.error)?.code;
  if (code === 'ETIMEDOUT') throw new Error(`land: gh could not ${what}: GitHub did not answer within ${TIMEOUT_MS / 1000} s — land again once it does`);
  if (ran.error) throw ran.error;
  if (ran.status === 0) return ran.stdout;
  const { why, said } = failureOf(args, ran);
  throw new Error(`land: gh could not ${what}: ${LANDING_SAYS[why](said)}`);
}

/**
 * The version a tool's run reports, null where it is not installed — or,
 * for the extension, where gh does not know the command — and the run's
 * own error where it runs and fails.
 * @param {string[]} args @param {RegExp} version
 * @returns {string|null}
 */
function versionOf(args, version) {
  const ran = spawnGh(args);
  if (/** @type {NodeJS.ErrnoException|undefined} */ (ran.error)?.code === 'ENOENT') return null;
  if (ran.error) throw ran.error;
  if (ran.status !== 0 && NO_STACK.test(ran.stderr)) return null;
  const found = ran.status === 0 ? version.exec(ran.stdout)?.[1] : undefined;
  if (found === undefined) throw new Error(`${GH} ${args.join(' ')}: ${saidBy(ran)}`);
  return found;
}

/** gh's version, or null where it is not installed. @returns {string|null} */
const ghVersion = () => versionOf(['--version'], /^gh version (\S+)/);

/** The stack extension's version, or null where it is not installed. @returns {string|null} */
const stackVersion = () => versionOf(['stack', '--version'], /^gh stack version (\S+)/);

/**
 * Why a call setup made did not make its setting, as setup's warning says
 * it: gh missing or unable to run, or the call's failure.
 * @param {string[]} args @param {Ran} ran
 * @returns {string}
 */
function whyUnset(args, ran) {
  const error = /** @type {NodeJS.ErrnoException|undefined} */ (ran.error);
  if (error?.code === 'ENOENT') return `${GH} is not installed`;
  if (error) return `${GH} could not run: ${error.message}`;
  const { why, said } = failureOf(args, ran);
  return SETUP_SAYS[why](said);
}

/**
 * Why gh did not make a setting on GitHub through its API, or null where it
 * did — or where `held`, read first, finds it made already, and it is left
 * as it is. The call alone decides whether gh is signed in: `auth status`
 * fails where any account gh holds for the host does, the one in use
 * working. A read that fails as signed out makes no call; any other leaves
 * the call to say why.
 * @param {string} cwd @param {string[]} api the call's arguments past `api`
 * @param {{input?: string, held?: {read: string[], made: (read: string) => boolean}}} [opts]
 * @returns {string|null}
 */
function setOnGithub(cwd, api, { input, held } = {}) {
  if (held !== undefined) {
    const args = ['api', ...held.read];
    const read = spawnGh(args, { cwd });
    if (read.status === 0 && held.made(read.stdout)) return null;
    if (read.status !== 0 && signedOut(args, read, saidBy(read))) return SETUP_SAYS['signed-out']('');
  }
  const args = ['api', ...api];
  const made = spawnGh(args, { cwd, input });
  return made.status === 0 ? null : whyUnset(args, made);
}

module.exports = { gh, ghVersion, stackVersion, setOnGithub };
