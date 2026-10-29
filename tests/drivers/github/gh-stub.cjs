'use strict';

// The stand-in `gh` GitHub's landing driver runs in the suites (bin/gh runs
// it), and the fake GitHub it serves: a repository on GitHub, kept inside
// the git directory of the repository a call runs in (`github/`), so a copy
// of a world carries its own. There, a bare repository stands for GitHub's
// copy of the code, which the world's remote reaches through the stand-in
// ssh beside this file, and `state.json` for what GitHub holds besides:
// the pull requests, their bases and states, the stacks, GitHub's own
// default branch, the repository's squash default, its rulesets and the
// merge method last used. Every call is logged to `calls`, one line each.
// It fails closed: it runs only with GH_CONFIG_DIR pinned to a temp folder,
// never reaches a network, and refuses to run anywhere no fake GitHub was
// made.
//
// What it answers, as gh and the stack extension do: its versions; `auth
// status`; `api` reading the repository, changing its squash default, and
// adding a ruleset; `pr list`, `create` — refused where the head holds no
// commit past the base — `edit --base`, `merge` and `reopen`; `stack
// link`, bottom to top, the bottom based on `--base` or else GitHub's
// default branch, each other on the one before, a stack's members only ever
// added; and `stack merge`, every unmerged pull request up to the one named,
// or the stack's whole, all or none, each merged by the method named or the
// last one used. A squash commits the merge of the pull request's head onto
// its base as one commit under the subject and body given, else as the
// repository's squash default makes them — GitHub's own, unless changed:
// a lone commit's message, or the title over the commits' — the subject
// ending " (#N)". GH_STUB_FAULT makes calls fail as gh does: `signed-out`,
// `rate-limit`, `offline`, `refused` or `unmergeable`, every call or,
// after an `@`, only the one whose words begin so (`rate-limit@pr
// create`), the extension's calls exiting 4 as it does on any failure of
// GitHub's API; GH_STUB_NO_STACK makes the extension missing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const VERSION = 'gh version 2.30.0 (2023-05-30)\nhttps://github.com/cli/cli/releases/tag/v2.30.0\n';
const STACK_VERSION = 'gh stack version 0.1.0\n';
const IDENTITY = { GIT_AUTHOR_NAME: 'GitHub', GIT_AUTHOR_EMAIL: 'noreply@github.com', GIT_COMMITTER_NAME: 'GitHub', GIT_COMMITTER_EMAIL: 'noreply@github.com' };
const FAULTS = Object.freeze({
  'signed-out': { code: 4, said: 'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.' },
  'rate-limit': { code: 1, said: 'GraphQL: API rate limit already exceeded for user ID 1.' },
  offline: { code: 1, said: 'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com' },
  refused: { code: 1, said: 'HTTP 403: Resource not accessible by integration' },
  unmergeable: { code: 1, said: 'GraphQL: Required status check "test" is expected. (mergePullRequest)' },
});
const SIGNED_OUT_STATUS = 'You are not logged into any GitHub hosts. To log in, run: gh auth login';
/** GitHub's own squash default. */
const GITHUB_SQUASH = Object.freeze({ squash_merge_commit_title: 'COMMIT_OR_PR_TITLE', squash_merge_commit_message: 'COMMIT_MESSAGES' });

/** @typedef {{number: number, state: 'OPEN'|'CLOSED'|'MERGED', head: string, base: string, title: string, body: string}} Pull */
/** @typedef {{number: number, base: string, pulls: number[]}} Stack */
/** @typedef {{repo: string, default: string, next: number, method: string, squash: Record<string, string>, rulesets: object[], pulls: Pull[], stacks: Stack[]}} Github */

/** A call's refusal, as gh's: its words on stderr, its exit code. */
class Refused extends Error {
  /** @param {string} message @param {number} [code] */
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

/** The fake GitHub's folder in the git directory of the repository at `dir`, read off its `.git` folder where it has one. @param {string} dir */
function githubAt(dir) {
  const own = path.join(dir, '.git');
  if (fs.statSync(own, { throwIfNoEntry: false })?.isDirectory()) return path.join(own, 'github');
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: dir, encoding: 'utf8' }).trim();
  return path.join(common, 'github');
}

/** What the fake GitHub at `at` holds. @param {string} at @returns {Github} */
const readState = (at) => JSON.parse(fs.readFileSync(path.join(at, 'state.json'), 'utf8'));

/** @param {string} at @param {Github} state */
const writeState = (at, state) => fs.writeFileSync(path.join(at, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);

/** The bare repository standing for GitHub's copy of the code. @param {string} at @param {Github} state */
const bareOf = (at, state) => path.join(at, `${state.repo}.git`);

/** Git in the bare repository. @param {string} bare @param {string[]} args @param {{env?: Record<string, string>, input?: string}} [opts] */
const inBare = (bare, args, { env, input } = {}) => execFileSync('git', args, { cwd: bare, encoding: 'utf8', input, env: { ...process.env, ...env } }).trim();

/** A branch's tip on GitHub, or null. @param {string} bare @param {string} branch */
function tipOf(bare, branch) {
  const ran = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: bare, encoding: 'utf8' });
  return ran.status === 0 ? ran.stdout.trim() : null;
}

/** A pull request by number. @param {Github} state @param {string|number} number */
function pullOf(state, number) {
  const pull = state.pulls.find((held) => held.number === Number(number));
  if (pull === undefined) throw new Refused(`GraphQL: Could not resolve to a PullRequest with the number of ${number}.`);
  return pull;
}

/**
 * The squash commit's subject and body as the repository's squash default
 * makes them, the subject ending " (#N)".
 * @param {string} bare @param {Github} state @param {Pull} pull @param {string} onto @param {string} head
 * @returns {{subject: string, body: string}}
 */
function squashed(bare, state, pull, onto, head) {
  const messages = inBare(bare, ['log', '-z', '--format=%B', `${onto}..${head}`]).split('\0').filter(Boolean).map((message) => message.trim());
  const lone = messages.length === 1 ? messages[0].split('\n') : null;
  const { squash_merge_commit_title: title, squash_merge_commit_message: message } = state.squash;
  const subject = title === 'COMMIT_OR_PR_TITLE' && lone !== null ? lone[0] : pull.title;
  const commits = lone === null ? messages.map((text) => `* ${text}`).join('\n\n') : lone.slice(1).join('\n').trim();
  return { subject: `${subject} (#${pull.number})`, body: { PR_BODY: pull.body, COMMIT_MESSAGES: commits }[message] ?? '' };
}

/**
 * A pull request merged into its base by a method, as GitHub merges it:
 * squashed into one commit, or merged by a merge commit; under `subject`
 * and `body` where given, else as the squash default makes them.
 * @param {string} at @param {Github} state @param {Pull} pull @param {string} method @param {{into?: string, subject?: string, body?: string}} [opts]
 */
function mergePull(at, state, pull, method, { into = pull.base, subject, body } = {}) {
  if (pull.state !== 'OPEN') throw new Refused(`Pull request #${pull.number} is not open`);
  const bare = bareOf(at, state);
  const [onto, head] = [tipOf(bare, into), tipOf(bare, pull.head)];
  if (onto === null || head === null) throw new Refused(`Pull request #${pull.number} has no branch to merge`);
  const merged = spawnSync('git', ['merge-tree', '--write-tree', onto, head], { cwd: bare, encoding: 'utf8' });
  if (merged.status !== 0) throw new Refused(`Pull request #${pull.number} is not mergeable: the merge commit cannot be cleanly created.`);
  const tree = merged.stdout.split('\n')[0];
  const squash = method === 'squash';
  const made = squash ? squashed(bare, state, pull, onto, head) : null;
  const message = made === null ? `Merge pull request #${pull.number} from ${pull.head}\n\n${pull.title}\n` : `${subject ?? made.subject}\n\n${body ?? made.body}\n`;
  const merge = inBare(bare, ['commit-tree', tree, '-p', onto, ...(squash ? [] : ['-p', head]), '-F', '-'], { env: IDENTITY, input: message });
  inBare(bare, ['update-ref', `refs/heads/${into}`, merge, onto]);
  pull.state = 'MERGED';
}

/** The value of a flag, and the arguments without it. @param {string[]} args @param {string} flag */
function take(args, flag) {
  const at = args.indexOf(flag);
  if (at === -1) return { value: undefined, rest: args };
  return { value: args[at + 1], rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

/** The merge method a call names, if any. @param {string[]} args */
function methodIn(args) {
  const named = ['squash', 'merge', 'rebase'].find((method) => args.includes(`--${method}`));
  return named ?? take(args, '--merge-method').value;
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function prList(at, state, args) {
  const fields = (take(args, '--json').value ?? 'number').split(',');
  const tips = new Map(inBare(bareOf(at, state), ['for-each-ref', '--format=%(refname:lstrip=2) %(objectname)', 'refs/heads/']).split('\n').map((line) => line.split(' ')));
  const rows = [...state.pulls].sort((a, b) => b.number - a.number).map((pull) => {
    /** @type {Record<string, unknown>} */
    const all = { number: pull.number, state: pull.state, headRefName: pull.head, baseRefName: pull.base, headRefOid: tips.get(pull.head) ?? null, title: pull.title, body: pull.body };
    return Object.fromEntries(fields.map((field) => [field, all[field]]));
  });
  return `${JSON.stringify(rows)}\n`;
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function prCreate(at, state, args) {
  const [base, head, title, body] = ['--base', '--head', '--title', '--body'].map((flag) => take(args, flag).value);
  if (base === undefined || head === undefined || title === undefined) throw new Refused('must provide --base, --head and --title when not running interactively');
  const bare = bareOf(at, state);
  if (tipOf(bare, head) === null) throw new Refused(`pull request create failed: GraphQL: Head sha can't be blank, No commits between ${base} and ${head}`);
  if (tipOf(bare, base) === null) throw new Refused('pull request create failed: GraphQL: Base ref must be a branch (createPullRequest)');
  if (spawnSync('git', ['merge-base', '--is-ancestor', head, base], { cwd: bare }).status === 0) {
    throw new Refused(`pull request create failed: GraphQL: No commits between ${base} and ${head} (createPullRequest)`);
  }
  const twin = state.pulls.find((pull) => pull.state === 'OPEN' && pull.head === head && pull.base === base);
  if (twin !== undefined) throw new Refused(`a pull request for branch "${head}" into branch "${base}" already exists:\nhttps://github.com/${state.repo}/pull/${twin.number}`);
  const number = state.next;
  state.next += 1;
  state.pulls.push({ number, state: 'OPEN', head, base, title, body: body ?? '' });
  return `https://github.com/${state.repo}/pull/${number}\n`;
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function prEdit(at, state, args) {
  const pull = pullOf(state, args[0]);
  const base = take(args, '--base').value;
  if (base !== undefined) pull.base = base;
  return `https://github.com/${state.repo}/pull/${pull.number}\n`;
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function prMerge(at, state, args) {
  const method = methodIn(args);
  if (method === undefined) throw new Refused('--merge, --rebase, or --squash required when not running interactively');
  mergePull(at, state, pullOf(state, args[0]), method, { subject: take(args, '--subject').value, body: take(args, '--body').value });
  return '';
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function prReopen(at, state, args) {
  const pull = pullOf(state, args[0]);
  if (pull.state !== 'CLOSED') throw new Refused(`Pull request #${pull.number} is not closed`);
  pull.state = 'OPEN';
  return '';
}

/** The stack holding a pull request, if any. @param {Github} state @param {number} number */
const stackHolding = (state, number) => state.stacks.find((stack) => stack.pulls.includes(number));

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function stackLink(at, state, args) {
  const { value: base, rest } = take(take(args, '--remote').rest, '--base');
  const items = rest.filter((arg) => !arg.startsWith('--'));
  if (items.length < 2) throw new Refused(`requires at least 2 arg(s), only received ${items.length}`, 5);
  const appended = state.stacks.find((stack) => stack.number === Number(items[0]));
  const numbers = (appended === undefined ? items : items.slice(1)).map((item) => {
    const pull = /^\d+$/.test(item) ? state.pulls.find((held) => held.number === Number(item)) : state.pulls.find((held) => held.state === 'OPEN' && held.head === item);
    if (pull === undefined) throw new Refused(`no pull request for ${item}`);
    return pull.number;
  });
  const holding = [...new Set(numbers.map((number) => stackHolding(state, number)).filter((stack) => stack !== undefined))];
  if (holding.length > 1 || (appended !== undefined && holding.some((stack) => stack !== appended))) throw new Refused('pull requests belong to different stacks');
  let stack = appended ?? holding[0];
  if (stack === undefined) {
    stack = { number: state.next, base: '', pulls: [] };
    state.next += 1;
    state.stacks.push(stack);
  }
  stack.base = base ?? state.default;
  for (const number of numbers) if (!stack.pulls.includes(number)) stack.pulls.push(number);
  stack.pulls.forEach((number, i) => {
    const pull = pullOf(state, number);
    if (pull.state === 'OPEN') pull.base = i === 0 ? stack.base : pullOf(state, stack.pulls[i - 1]).head;
  });
  return `Linked ${stack.pulls.length} pull requests into stack #${stack.number}\n`;
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function stackMerge(at, state, args) {
  const target = args.find((arg) => /^\d+$/.test(arg));
  if (target === undefined) throw new Refused('not in a stack', 2);
  const named = state.stacks.find((stack) => stack.number === Number(target));
  const stack = named ?? stackHolding(state, Number(target));
  if (stack === undefined) throw new Refused(`pull request #${target} is not in a stack`, 2);
  const upTo = named === undefined ? stack.pulls.indexOf(Number(target)) + 1 : stack.pulls.length;
  const merging = stack.pulls.slice(0, upTo).map((number) => pullOf(state, number)).filter((pull) => pull.state !== 'MERGED');
  const shut = merging.find((pull) => pull.state !== 'OPEN');
  if (shut !== undefined) throw new Refused(`cannot merge the stack: pull request #${shut.number} is closed`);
  const method = methodIn(args) ?? state.method;
  state.method = method;
  for (const pull of merging) mergePull(at, state, pull, method, { into: stack.base });
  return `Merged ${merging.length} pull requests\n`;
}

/** @param {string} at @param {Github} state @param {string[]} args @returns {string} */
function api(at, state, args) {
  const { value: method = 'GET', rest } = take(args, '--method');
  const [route] = rest.filter((arg, i) => !arg.startsWith('-') && !['-f', '--input'].includes(rest[i - 1]));
  if (route === `repos/${state.repo}` && method === 'GET') return `${JSON.stringify({ full_name: state.repo, ...state.squash })}\n`;
  if (route === `repos/${state.repo}` && method === 'PATCH') {
    for (const [i, arg] of rest.entries()) {
      if (arg !== '-f') continue;
      const [field, value] = rest[i + 1].split('=');
      state.squash[field] = value;
    }
    return `${JSON.stringify({ full_name: state.repo, ...state.squash })}\n`;
  }
  if (route === `repos/${state.repo}/rulesets` && method === 'POST') {
    state.rulesets.push(JSON.parse(fs.readFileSync(0, 'utf8')));
    return '{}\n';
  }
  throw new Refused(`HTTP 404: Not Found (https://api.github.com/${route})`);
}

/** gh signed in, as `auth status` says it. @returns {string} */
const authStatus = () => `github.com\n  ✓ Logged in to github.com account stub (${process.env.GH_CONFIG_DIR}/hosts.yml)\n`;

const COMMANDS = Object.freeze({
  'auth status': authStatus,
  'pr list': prList, 'pr create': prCreate, 'pr edit': prEdit, 'pr merge': prMerge, 'pr reopen': prReopen,
  'stack link': stackLink, 'stack merge': stackMerge, api,
});

/** The fault GH_STUB_FAULT sets for a call, if any. @param {string[]} args */
function faultFor(args) {
  const [kind, only] = (process.env.GH_STUB_FAULT ?? '').split('@');
  if (kind === '' || (only !== undefined && !args.join(' ').startsWith(only))) return null;
  return FAULTS[/** @type {keyof typeof FAULTS} */ (kind)] ?? null;
}

/**
 * Answer a call made in `cwd`, as gh would.
 * @param {string[]} args @param {string} cwd
 * @returns {string} what it prints
 */
function answer(args, cwd) {
  const config = process.env.GH_CONFIG_DIR;
  if (config === undefined || !fs.existsSync(config) || !fs.realpathSync(config).startsWith(fs.realpathSync(os.tmpdir()))) {
    throw new Refused('the stub runs only with GH_CONFIG_DIR pinned to a temp folder', 99);
  }
  if (args[0] === '--version') return VERSION;
  if (args[0] === 'stack' && process.env.GH_STUB_NO_STACK) throw new Refused('unknown command "stack" for "gh"\n\nUsage:  gh <command> <subcommand> [flags]');
  if (args[0] === 'stack' && args[1] === '--version') return STACK_VERSION;
  const at = githubAt(cwd);
  if (!fs.existsSync(path.join(at, 'state.json'))) throw new Refused(`the stub has no fake GitHub at ${at}`, 98);
  fs.appendFileSync(path.join(at, 'calls'), `${args.join(' ')}\n`);
  const fault = faultFor(args);
  if (fault !== null && args[0] === 'auth') throw new Refused(fault === FAULTS['signed-out'] ? SIGNED_OUT_STATUS : fault.said, 1);
  if (fault !== null) throw new Refused(fault.said, args[0] === 'stack' ? 4 : fault.code);
  const [named, cut] = args[0] === 'api' ? ['api', 1] : [args.slice(0, 2).join(' '), 2];
  const command = COMMANDS[/** @type {keyof typeof COMMANDS} */ (named)];
  if (command === undefined) throw new Refused(`the stub does not answer gh ${args.join(' ')}`, 97);
  const state = readState(at);
  const printed = command(at, state, args.slice(cut));
  writeState(at, state);
  return printed;
}

if (require.main === module) {
  try {
    process.stdout.write(answer(process.argv.slice(2), process.cwd()));
  } catch (err) {
    if (!(err instanceof Refused)) throw err;
    process.stderr.write(`${err.message}\n`);
    process.exit(err.code);
  }
}

module.exports = { GITHUB_SQUASH, githubAt, readState, writeState, bareOf, mergePull };
