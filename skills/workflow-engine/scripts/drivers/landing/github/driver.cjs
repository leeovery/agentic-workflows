'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (7.2.9, 7.2.10): each task a pull request, each
// phase a stack of them, merged whole, every pull request squashed, so the
// default branch gains one commit per task (7.2.2). It serves a remote on
// GitHub (22.4.3), and drives GitHub's CLI and its stack extension itself
// (gh.cjs), so no one needs GitHub's stack skill; it needs both, at their
// floors (22.4.6).
//
// What it lands is read off GitHub each time, and nothing is recorded: a
// task's pull request is the one whose head is the task's branch (its name
// is the task's, landing-names.cjs), the latest of them, one closed only
// where it has no other; a phase's stack is its tasks' pull requests, bottom
// first by their bases, each based on the one before. A stack is merged
// once every pull request of it is; one merged in part, or closed, by hand
// on GitHub stops every verb that reaches its phase, saying what happened
// and the way on.
//
// - The chain's tip: the top of the task's phase's stack; for its first
//   task, the top of the latest unmerged phase whose pull request the task's
//   branch holds, which the phase then stacks on, as a fix phase does on the
//   one before (7.2.6) — else the default branch. That the task's branch
//   descends from it is the seam's to check (landing.cjs).
// - Open: the task's branch pushed under its own name (7.2.14), then its
//   pull request opened onto the chain's tip, titled with its landing's
//   subject, its body the rest of that message, with the task's id.
// - Chain: the phase's pull requests linked into one stack, bottom to top,
//   always with the default branch as the stack's base — without it, the
//   extension retargets the bottom pull request onto GitHub's own default.
//   A stack of one pull request is no stack to link.
// - Phase: the stack merged whole, every pull request squashed, once the
//   phase it stacks on has merged — a lone pull request merged alone, its
//   base made the default branch first where it stood on another phase's
//   task. A task's branch here that is not where its pull request's head
//   is stops the phase, with the local driver's way back (landing-git.cjs).
// - Finish: every phase not yet merged, each after the one it stacks on.
// ---------------------------------------------------------------------------

const names = require('../../../domain/landing-names.cjs');
const lg = require('../../../domain/landing-git.cjs');
const { taskId, shownTask } = require('../../../domain/task-id.cjs');
const { gh, ghVersion, stackVersion, postRuleset } = require('./gh.cjs');

/** @typedef {import('../../../domain/task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../../../domain/landing.cjs').LandingContext} LandingContext */
/** @typedef {import('../../../domain/landing.cjs').LandingTask} LandingTask */

/** Where the driver lands: the project's remote, and the repository on GitHub it names, `{owner}/{repo}`. @typedef {{remote: string, repo: string}} Host */
/** A task's pull request as GitHub holds it. @typedef {{number: number, state: 'OPEN'|'CLOSED'|'MERGED', head: string, base: string, oid: string, title: string, body: string, ref: TaskRef}} Pull */
/** A phase's stack: its tasks' pull requests, bottom first. @typedef {{phase: number, pulls: Pull[]}} Stack */
/** The chain's tip, and the host `open` lands on. @typedef {import('../../../domain/landing.cjs').ChainTip & {host: Host}} ChainTip */

// A remote on GitHub, as a URL (https, ssh, git) or scp-like (`git@github.com:o/r`).
const GITHUB_URL = /^(?:(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/|[^@/:]+@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;
const PULL_FIELDS = 'number,state,headRefName,baseRefName,headRefOid,title,body';
// The unit's pull requests are among the repository's latest; past this many, the oldest are not read.
const PULL_LIMIT = '1000';

/**
 * The GitHub repository a remote URL names, or null where it is not on
 * GitHub.
 * @param {string} url
 * @returns {{owner: string, repo: string}|null}
 */
function repositoryOf(url) {
  const named = GITHUB_URL.exec(url.trim());
  return named === null ? null : { owner: named[1], repo: named[2] };
}

/**
 * The host a verb lands on, refused where the project has no remote, or one
 * not on GitHub.
 * @param {LandingContext} ctx
 * @returns {Host}
 */
function hostOf(ctx) {
  const change = 'or change the landing driver from manage on the start menu';
  if (ctx.remote === null) throw new Error(`land: GitHub's driver lands through the project's remote, and the project has none chosen — add its repository on GitHub as origin, ${change}`);
  const url = lg.remoteUrlOf(ctx.root, ctx.remote);
  const repository = repositoryOf(url);
  if (repository === null) throw new Error(`land: the project's remote, ${ctx.remote}, is not on GitHub (${lg.plain(url)}), where GitHub's driver lands — ${change}`);
  return { remote: ctx.remote, repo: `${repository.owner}/${repository.repo}` };
}

/**
 * gh's answer to `args`, run in the code root against the host's repository.
 * @param {LandingContext} ctx @param {Host} host @param {string[]} args @param {string} what as gh.cjs's
 */
const ghAt = (ctx, host, args, what) => gh(args, what, { cwd: ctx.root, repo: host.repo });

/** @param {TaskRef} a @param {TaskRef} b */
const sameTask = (a, b) => a.unit === b.unit && a.phase === b.phase && a.n === b.n;

/** How a pull request outranks another of its task's: any not closed above a closed one, then the latest. @param {Pull} pull */
const rank = (pull) => (pull.state === 'CLOSED' ? 0 : Number.MAX_SAFE_INTEGER / 2) + pull.number;

/**
 * Each of the unit's tasks' pull request, as GitHub holds it (see the header).
 * @param {LandingContext} ctx @param {Host} host
 * @returns {Pull[]}
 */
function pullsOf(ctx, host) {
  /** @type {{number: number, state: Pull['state'], headRefName: string, baseRefName: string, headRefOid: string, title: string, body: string}[]} */
  const listed = JSON.parse(ghAt(ctx, host, ['pr', 'list', '--state', 'all', '--limit', PULL_LIMIT, '--json', PULL_FIELDS], `read ${host.repo}'s pull requests`));
  /** @type {Map<string, Pull>} */
  const byTask = new Map();
  for (const pr of listed) {
    const ref = names.taskOfBranch(ctx.unit, pr.headRefName);
    if (ref === null) continue;
    const pull = { number: pr.number, state: pr.state, head: pr.headRefName, base: pr.baseRefName, oid: pr.headRefOid, title: pr.title, body: pr.body, ref };
    const held = byTask.get(taskId(ref));
    if (held === undefined || rank(pull) > rank(held)) byTask.set(taskId(ref), pull);
  }
  return [...byTask.values()];
}

/**
 * Pull requests bottom first: each chain from one whose base is none of
 * theirs, then each based on the one before.
 * @param {Pull[]} pulls
 * @returns {Pull[]}
 */
function chained(pulls) {
  const byNumber = (/** @type {Pull} */ a, /** @type {Pull} */ b) => a.number - b.number;
  const heads = new Set(pulls.map((pull) => pull.head));
  /** @type {Pull[]} */
  const order = [];
  const walk = (/** @type {Pull} */ pull) => {
    order.push(pull);
    pulls.filter((above) => above.base === pull.head).sort(byNumber).forEach(walk);
  };
  pulls.filter((pull) => !heads.has(pull.base)).sort(byNumber).forEach(walk);
  return order;
}

/**
 * The unit's stacks, by phase.
 * @param {Pull[]} pulls
 * @returns {Map<number, Stack>}
 */
function stacksOf(pulls) {
  const phases = [...new Set(pulls.map((pull) => pull.ref.phase))];
  return new Map(phases.map((phase) => [phase, { phase, pulls: chained(pulls.filter((pull) => pull.ref.phase === phase)) }]));
}

/** Whether every pull request of a stack is merged. @param {Stack} stack */
const isMerged = (stack) => stack.pulls.every((pull) => pull.state === 'MERGED');

/** The stack's pull request of a task, if any. @param {Stack|undefined} stack @param {TaskRef} ref */
const pullOf = (stack, ref) => stack?.pulls.find((pull) => sameTask(pull.ref, ref));

/** Pull requests as a refusal names them. @param {Pull[]} pulls */
const pullsNamed = (pulls) => pulls.map((pull) => `#${pull.number} (task ${shownTask(pull.ref)})`).join(', ');

/**
 * Refuse a stack something done by hand on GitHub stops: a pull request
 * closed without being merged, or the stack merged in part.
 * @param {Stack} stack
 */
function refuseHandled(stack) {
  const closed = stack.pulls.find((pull) => pull.state === 'CLOSED');
  if (closed !== undefined) {
    throw new Error(`land: task ${shownTask(closed.ref)}'s pull request #${closed.number} was closed on GitHub without being merged — reopen it there, as \`gh pr reopen ${closed.number}\` does, and land again`);
  }
  const merged = stack.pulls.filter((pull) => pull.state === 'MERGED');
  if (merged.length === 0 || merged.length === stack.pulls.length) return;
  const rest = stack.pulls.filter((pull) => pull.state !== 'MERGED');
  const is = (/** @type {Pull[]} */ pulls) => (pulls.length === 1 ? 'is' : 'are');
  throw new Error(
    `land: phase ${stack.phase}'s stack was merged in part by hand on GitHub — ${pullsNamed(merged)} ${is(merged)} merged, and ${pullsNamed(rest)} ${is(rest)} not; `
    + 'merge the rest there too, and land again',
  );
}

/**
 * The latest unmerged phase, other than `phase`, with a pull request whose
 * head `commit` holds — the phase a stack from `commit` is built on — or
 * undefined.
 * @param {LandingContext} ctx @param {Map<number, Stack>} stacks @param {number} phase @param {string} commit
 * @returns {Stack|undefined}
 */
function builtOn(ctx, stacks, phase, commit) {
  const reached = [...stacks.values()]
    .filter((stack) => stack.phase !== phase && stack.pulls.some((pull) => pull.state === 'OPEN' && lg.isAncestor(ctx.root, pull.oid, commit)))
    .sort((a, b) => b.phase - a.phase);
  reached.forEach(refuseHandled);
  return reached[0];
}

/**
 * The chain's tip a task lands on (see the header). Refuses a task whose
 * phase is merged or holds it already, and one built on a stack something
 * done by hand stops.
 * @param {LandingContext} ctx @param {LandingTask} task
 * @returns {ChainTip}
 */
function chainTip(ctx, task) {
  const host = hostOf(ctx);
  const { phase } = task.ref;
  const shown = shownTask(task.ref);
  const stacks = stacksOf(pullsOf(ctx, host));
  const own = stacks.get(phase);
  if (own !== undefined) {
    refuseHandled(own);
    if (isMerged(own)) throw new Error(`land: phase ${phase} is merged into ${ctx.into} — task ${shown} lands in a phase not yet merged, so number it in one`);
    if (pullOf(own, task.ref) !== undefined) throw new Error(`land: task ${shown} is in phase ${phase}'s stack already — there is nothing more to open`);
  }
  const top = own ?? builtOn(ctx, stacks, phase, task.branch);
  if (top === undefined) return { name: ctx.into, commit: /** @type {string} */ (lg.branches(ctx.root).get(ctx.into)), host };
  const last = top.pulls[top.pulls.length - 1];
  return { name: last.head, commit: last.oid, host };
}

/**
 * Open a task's pull request onto the chain's tip the seam checked it
 * descends from, its branch pushed first.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip
 */
function open(ctx, task, tip) {
  const shown = shownTask(task.ref);
  lg.pushBranch(ctx.root, tip.host.remote, task.branch, `task ${shown}'s pull request was not opened — clear what git names, and open the task again`);
  const [title, ...body] = task.message.split('\n');
  const url = ghAt(ctx, tip.host, ['pr', 'create', '--base', tip.name, '--head', task.branch, '--title', title, '--body', body.join('\n').trim()], `open task ${shown}'s pull request`);
  return { task: shown, branch: task.branch, base: tip.name, pull_request: Number(/\/pull\/(\d+)\s*$/.exec(url)?.[1]) };
}

/**
 * The stack's pull requests linked into one on GitHub, bottom to top, its
 * base the default branch — where it holds more than one.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack
 */
function link(ctx, host, stack) {
  if (stack.pulls.length < 2) return;
  const numbers = stack.pulls.map((pull) => String(pull.number));
  ghAt(ctx, host, ['stack', 'link', '--base', ctx.into, '--remote', host.remote, ...numbers], `link phase ${stack.phase}'s pull requests into its stack`);
}

/** A stack as a verb answers it: its tasks, bottom first, and their pull requests. @param {Stack} stack */
const answered = (stack) => ({ stack: stack.pulls.map((pull) => shownTask(pull.ref)), pull_requests: stack.pulls.map((pull) => pull.number) });

/**
 * Chain a task into its phase's stack, answered bottom first, in the order
 * its tasks were merged back.
 * @param {LandingContext} ctx @param {TaskRef} ref
 */
function chain(ctx, ref) {
  const host = hostOf(ctx);
  const { phase } = ref;
  const stack = stacksOf(pullsOf(ctx, host)).get(phase);
  if (stack !== undefined) refuseHandled(stack);
  if (stack !== undefined && isMerged(stack)) throw new Error(`land: phase ${phase} is merged into ${ctx.into} — its stack is landed`);
  if (stack === undefined || pullOf(stack, ref) === undefined) throw new Error(`land: task ${shownTask(ref)} is not open — open it first`);
  link(ctx, host, stack);
  return { phase, ...answered(stack) };
}

/**
 * Refuse a stack a task's branch here has moved from its pull request's
 * head on, keeping the branch as it stands and putting it back. A branch
 * not here is passed over: what merges is what GitHub holds.
 * @param {LandingContext} ctx @param {Stack} stack
 */
function refuseMoved(ctx, stack) {
  const refs = lg.branches(ctx.root);
  for (const pull of stack.pulls) {
    const at = refs.get(pull.head);
    if (at === undefined || at === pull.oid) continue;
    const [was, now] = [lg.short(pull.oid), lg.short(at)];
    const way = lg.remedy(ctx.root, pull.head, lg.moveTo(pull.head, was, `put ${pull.head} back`), {
      note: (kept) => `the change from ${was} to ${now}, on ${kept}, is a task of its own`,
    });
    throw new Error(`land: task ${shownTask(pull.ref)}'s branch ${pull.head} has moved since it was opened at ${was}, to ${now} — ${way}`);
  }
}

/**
 * Merge a stack whole into the default branch, every pull request squashed:
 * linked first, so a pull request chained late is in it, and merged by the
 * extension; a lone one merged alone, under its own title and body, onto
 * the default branch.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function mergeStack(ctx, host, stacks, stack) {
  refuseHandled(stack);
  const below = builtOn(ctx, stacks, stack.phase, stack.pulls[0].oid);
  if (below !== undefined) {
    throw new Error(`land: phase ${stack.phase} stacks on phase ${below.phase}, which has not merged — merge it first with \`land phase ${ctx.unit} ${below.phase}\`, then land again`);
  }
  refuseMoved(ctx, stack);
  const merging = `merge phase ${stack.phase}'s stack`;
  if (stack.pulls.length > 1) {
    link(ctx, host, stack);
    ghAt(ctx, host, ['stack', 'merge', String(stack.pulls[stack.pulls.length - 1].number), '--yes', '--squash'], merging);
  } else {
    const [lone] = stack.pulls;
    if (lone.base !== ctx.into) ghAt(ctx, host, ['pr', 'edit', String(lone.number), '--base', ctx.into], `base pull request #${lone.number} on ${ctx.into}`);
    ghAt(ctx, host, ['pr', 'merge', String(lone.number), '--squash', '--subject', lone.title, '--body', lone.body], merging);
  }
  const { stack: tasks, pull_requests } = answered(stack);
  return { phase: stack.phase, into: ctx.into, merged: tasks, pull_requests };
}

/**
 * Merge a phase whole into the default branch.
 * @param {LandingContext} ctx @param {number} phase
 */
function mergePhase(ctx, phase) {
  const host = hostOf(ctx);
  const stacks = stacksOf(pullsOf(ctx, host));
  const stack = stacks.get(phase);
  if (stack === undefined) throw new Error(`land: phase ${phase} of ${ctx.unit} has no task opened — open its tasks first`);
  if (isMerged(stack)) throw new Error(`land: phase ${phase} is merged into ${ctx.into} already — there is nothing more to merge`);
  return mergeStack(ctx, host, stacks, stack);
}

/**
 * Merge every phase not yet merged, lowest first, each after the one it
 * stacks on. Stops at the first that cannot merge, saying which merged.
 * @param {LandingContext} ctx
 */
function finish(ctx) {
  const host = hostOf(ctx);
  /** @type {ReturnType<typeof mergeStack>[]} */
  const merged = [];
  for (;;) {
    const stacks = stacksOf(pullsOf(ctx, host));
    const unmerged = [...stacks.values()].filter((stack) => !isMerged(stack)).sort((a, b) => a.phase - b.phase);
    if (unmerged.length === 0) return { into: ctx.into, phases: merged };
    const next = unmerged.find((stack) => builtOn(ctx, stacks, stack.phase, stack.pulls[0].oid) === undefined) ?? unmerged[0];
    try {
      merged.push(mergeStack(ctx, host, stacks, next));
    } catch (err) {
      if (merged.length === 0) throw err;
      throw new Error(`${err instanceof Error ? err.message : String(err)} (finish merged phase ${merged.map((done) => done.phase).join(', ')} before it)`);
    }
  }
}

/**
 * The repository rule refusing a branch's deletion and any push to it that
 * is not a fast-forward.
 * @param {string} branch
 */
function rulesetFor(branch) {
  return {
    name: branch,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: [`refs/heads/${branch}`], exclude: [] } },
    rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
  };
}

/**
 * Set the rule on a branch of the remote's repository (4.4.6): the
 * repository, and why the rule is not set, null where it is.
 * @param {string} url @param {string} branch
 */
function protectBranch(url, branch) {
  const { owner, repo } = /** @type {{owner: string, repo: string}} */ (repositoryOf(url));
  const repository = `${owner}/${repo}`;
  return { repository, unset: postRuleset(repository, rulesetFor(branch)) };
}

module.exports = {
  kind: 'landing',
  name: 'github',
  isDefault: false,
  needs: [
    { tool: 'gh', floor: '2.103.0', update: 'https://cli.github.com', found: ghVersion },
    { tool: 'gh-stack', floor: '0.3.0', update: 'https://github.com/github/gh-stack', found: stackVersion },
  ],
  serves: (/** @type {string} */ url) => repositoryOf(url) !== null,
  chainTip,
  open,
  chain,
  mergePhase,
  finish,
  protectBranch,
  repositoryOf,
  rulesetFor,
};
