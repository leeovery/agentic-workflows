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
//   descends from it, with something past it, is the seam's to check
//   (landing.cjs).
// - Open: the task's branch pushed under its own name (7.2.14), then its
//   pull request opened onto the chain's tip, titled with its landing's
//   subject, its body the rest of that message, with the task's id.
// - Chain: the phase's pull requests linked into one stack, bottom to top,
//   always with the default branch as the stack's base — without it, the
//   extension retargets the bottom pull request onto GitHub's own default.
//   A stack of one pull request is no stack to link.
// - Phase: the stack merged whole, every pull request squashed, once the
//   phase it stacks on has merged. GitHub makes each squash commit as the
//   repository's squash default says, so a stack merges only where that is
//   the pull request's title and description — each commit then the task's
//   subject with GitHub's " (#N)", and its id in the body (7.2.18); setup
//   offers to set it (github-setup.cjs). A lone pull request is merged alone
//   under that same subject and body, its base made the default branch
//   first where it stood on another phase's task. A task's branch here
//   behind its pull request's head — a push of the driver's that went before
//   the branch here moved — is brought to it first, refused where it is
//   checked out and cannot move; one anywhere else stops the phase, with the
//   local driver's way back (landing-git.cjs). Once merged, the default
//   branch is fetched and moved here to the merge, as the local driver
//   leaves it, where git would fast-forward it; where it cannot be, the
//   answer warns why, and the merge stands. A phase found merged already is
//   refused, the default branch here brought to it all the same, so landing
//   again recovers one a merge left behind, or one merged on GitHub by hand.
// - Finish: every phase not yet merged, each after the one it stacks on,
//   each warning given once.
// - Nested repositories: each repository a task touches lands on its own
//   repository on GitHub, named by its own remote, with a stack of its own
//   per phase; one whose remote is not on GitHub is refused before anything
//   moves (`assertServes`). A repository's submodules' pointers are settled
//   before its stack merges, each submodule's stack merged first
//   (landing.cjs merges children first), squashed into new commits the
//   pointers its tasks carry do not name. A stack moves a pointer only
//   where its own commits do — those no pull request below it, no other
//   phase's and not the default branch on GitHub holds — each against every
//   parent of it, so a pointer it inherited from a phase below is no move of
//   its. At each pull request, a submodule the stack moved points where the
//   local driver points it: at the submodule's landing, on its default
//   branch on GitHub, of the latest task that moved it, read by its trailer
//   — else at that task's own pointer, a pin kept; every other submodule at
//   the default branch's pointer. GitHub cannot merge two moves of a
//   pointer, having no copy of the submodule: where its squash of any pull
//   request — onto the default branch as those below left it, over the head
//   below it, the bottom's over its merge base with the default branch —
//   would meet a pointer both sides moved, the stack is brought up to date
//   first. The default branch on GitHub is merged into the bottom branch,
//   then each branch into the one above, every merge made without a checkout
//   over a base that leaves each pointer to that rule; all are pushed at
//   once, then each branch here moved — refused before anything is pushed
//   where a merge conflicts in a file, or a branch here is checked out and
//   cannot move. Else, where the top's pointers are not the rule's, one
//   commit on the top branch records them, pushed the same way, so it
//   squashes into the top task's landing under its subject; the landings
//   below the top then name the submodule's commits from before its squash,
//   which GitHub keeps under each of its pull requests' own refs.
// ---------------------------------------------------------------------------

const names = require('../../../domain/landing-names.cjs');
const lg = require('../../../domain/landing-git.cjs');
const { taskId, shownTask, sameTask } = require('../../../domain/task-id.cjs');
const { gh, ghVersion, stackVersion, setOnGithub } = require('./gh.cjs');

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
 * The host a verb lands on in a repository, refused where it has no remote,
 * or one not on GitHub.
 * @param {LandingContext} ctx
 * @returns {Host}
 */
function hostOf(ctx) {
  const change = 'or change the landing driver from manage on the start menu';
  const own = ctx.repo === '.';
  if (ctx.remote === null) {
    throw new Error(own
      ? `land: GitHub's driver lands through the project's remote, and the project has none chosen — add its repository on GitHub as origin, ${change}`
      : `land: GitHub's driver lands every repository a task touches through that repository's own remote, and this one has none chosen — add its repository on GitHub as origin there, ${change}`);
  }
  const url = lg.remoteUrlOf(ctx.root, ctx.remote);
  const repository = repositoryOf(url);
  if (repository === null) {
    throw new Error(`land: ${own ? 'the project\'s' : 'its'} remote, ${ctx.remote}, is not on GitHub (${lg.plain(url)}), where GitHub's driver lands — ${own ? '' : 'point it at its repository on GitHub, '}${change}`);
  }
  return { remote: ctx.remote, repo: `${repository.owner}/${repository.repo}` };
}

/**
 * gh's answer to `args`, run in the code root against the host's repository.
 * @param {LandingContext} ctx @param {Host} host @param {string[]} args @param {string} what as gh.cjs's
 */
const ghAt = (ctx, host, args, what) => gh(args, what, { cwd: ctx.root, repo: host.repo });

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
    + 'merge the rest there too, and the phase is landed',
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
 * The chain's tip a task lands on (see the header) — null where its phase's
 * stack holds it already. Refuses a task whose phase is merged, and one
 * built on a stack something done by hand stops.
 * @param {LandingContext} ctx @param {LandingTask} task
 * @returns {ChainTip|null}
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
    if (pullOf(own, task.ref) !== undefined) return null;
  }
  const top = own ?? builtOn(ctx, stacks, phase, task.branch);
  if (top === undefined) return { name: ctx.into, commit: /** @type {string} */ (lg.branches(ctx.root).get(ctx.into)), host };
  const last = top.pulls[top.pulls.length - 1];
  return { name: last.head, commit: last.oid, host };
}

/**
 * Open a task's pull request onto the chain's tip the seam checked it
 * descends from, with a commit past it, its branch pushed first.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip
 */
function open(ctx, task, tip) {
  const shown = shownTask(task.ref);
  lg.pushBranch(ctx.root, tip.host.remote, task.branch, `task ${shown}'s pull request was not opened — clear what git names, and open the task again`);
  const [title, ...body] = task.message.split('\n');
  const url = ghAt(ctx, tip.host, ['pr', 'create', '--base', tip.name, '--head', task.branch, '--title', title, '--body', body.join('\n').trim()], `open task ${shown}'s pull request`);
  return { base: tip.name, pull_request: Number(/\/pull\/(\d+)\s*$/.exec(url)?.[1]) };
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
 * its tasks were merged back — null where it is not open.
 * @param {LandingContext} ctx @param {TaskRef} ref
 */
function chain(ctx, ref) {
  const host = hostOf(ctx);
  const { phase } = ref;
  const stack = stacksOf(pullsOf(ctx, host)).get(phase);
  if (stack !== undefined) refuseHandled(stack);
  if (stack !== undefined && isMerged(stack)) throw new Error(`land: phase ${phase} is merged into ${ctx.into} — its stack is landed`);
  if (stack === undefined || pullOf(stack, ref) === undefined) return null;
  link(ctx, host, stack);
  return answered(stack);
}

/**
 * Refuse, before any of them moves, where a branch here is checked out and
 * cannot move as `moves` would move it (`checkoutBlock`).
 * @param {LandingContext} ctx @param {{branch: string, from: string, to: string}[]} moves
 */
function refuseBlocked(ctx, moves) {
  for (const { branch, from, to } of moves) {
    const block = lg.checkoutBlock(ctx.root, branch, { from, to });
    if (block !== null) throw new Error(`land: ${block}`);
  }
}

/**
 * Each task's branch here brought to its pull request's head where it is
 * behind it, as a push that went before the branch here moved leaves it;
 * refused, before any moves, where one is checked out and cannot. A stack
 * a task's branch here has moved on from its head is refused, keeping the
 * branch as it stands and putting it back. A branch not here is passed
 * over: what merges is what GitHub holds.
 * @param {LandingContext} ctx @param {Stack} stack
 */
function catchUpBranches(ctx, stack) {
  const refs = lg.branches(ctx.root);
  /** @type {{branch: string, from: string, to: string}[]} */
  const behind = [];
  for (const pull of stack.pulls) {
    const at = refs.get(pull.head);
    if (at === undefined || at === pull.oid) continue;
    if (lg.isAncestor(ctx.root, at, pull.oid)) {
      behind.push({ branch: pull.head, from: at, to: pull.oid });
      continue;
    }
    const [was, now] = [lg.short(pull.oid), lg.short(at)];
    const way = lg.remedy(ctx.root, pull.head, lg.moveTo(pull.head, was, `put ${pull.head} back`), {
      note: (kept) => `the change from ${was} to ${now}, on ${kept}, is a task of its own`,
    });
    throw new Error(`land: task ${shownTask(pull.ref)}'s branch ${pull.head} has moved since it was opened at ${was}, to ${now} — ${way}`);
  }
  refuseBlocked(ctx, behind);
  for (const { branch, from, to } of behind) lg.moveBranch(ctx.root, branch, from, to);
}

/**
 * Refuse a stack merge where the repository's squash default would not make
 * each commit from its pull request's title and description.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack
 */
function refuseSquashDefault(ctx, host, stack) {
  /** @type {{squash_merge_commit_title?: string, squash_merge_commit_message?: string}} */
  const repository = JSON.parse(ghAt(ctx, host, ['api', `repos/${host.repo}`], `read ${host.repo}'s squash default`));
  if (repository.squash_merge_commit_title === 'PR_TITLE' && repository.squash_merge_commit_message === 'PR_BODY') return;
  throw new Error(
    `land: ${host.repo} does not squash a pull request into its title and description, so phase ${stack.phase}'s stack would land under other subjects than its tasks' — `
    + 'set the repository\'s squash default to "Pull request title and description" in its Settings, under Pull Requests, and land again',
  );
}

/**
 * The default branch here brought to the merge GitHub's holds (see the
 * header), or the warning why it is not — whatever stops it, the merge
 * stands.
 * @param {LandingContext} ctx @param {Host} host
 * @returns {string[]}
 */
function bringDefaultUp(ctx, host) {
  const { root, into } = ctx;
  const theirs = `${host.remote}/${into}`;
  const fetched = lg.fetchBranch(root, host.remote, into);
  if ('failed' in fetched) return [`${into} here was not brought up to the merge, as ${theirs} could not be fetched (${fetched.failed}) — fetch it, and fast-forward ${into} to it`];
  const ours = /** @type {string} */ (lg.branches(root).get(into));
  if (ours === fetched.commit) return [];
  if (!lg.isAncestor(root, ours, fetched.commit)) return [`${into} here holds commits ${theirs} does not, so it was not moved to the merge — bring it up to date with ${theirs} yourself`];
  const notMoved = (/** @type {string} */ why) => [
    `${into} here was not moved to the merge, ${theirs} at ${lg.short(fetched.commit)}: ${why} — once that is clear, \`git merge --ff-only ${theirs}\` where ${into} is checked out brings it up`,
  ];
  try {
    const block = lg.checkoutBlock(root, into, { from: ours, to: fetched.commit });
    if (block !== null) return notMoved(block.split(', so nothing moved')[0]);
    lg.moveBranch(root, into, ours, fetched.commit);
  } catch (err) {
    return notMoved(lg.gitSaid(/** @type {Error} */ (err)));
  }
  return [];
}

/**
 * The tip of a repository's default branch on GitHub, fetched — refused
 * where it cannot be, no pointer then recorded.
 * @param {LandingContext} ctx
 * @returns {string}
 */
function fetchedDefault(ctx) {
  const fetched = lg.fetchBranch(ctx.root, hostOf(ctx).remote, ctx.into);
  if ('failed' in fetched) {
    const named = ctx.repo === '.' ? ctx.into : `${lg.plain(ctx.repo)}'s ${ctx.into}`;
    throw new Error(`land: ${named} could not be fetched (${fetched.failed}), so no submodule's pointer was recorded and nothing merged — land again once it can be`);
  }
  return fetched.commit;
}

/**
 * Each of a stack's pull requests' moves of the repository's submodules'
 * pointers, bottom first (see the header): those its own commits make —
 * which no pull request below it holds, nor the default branch on GitHub,
 * nor any other phase's but one built on the stack — the last of each
 * submodule's.
 * @param {LandingContext} ctx @param {Map<number, Stack>} stacks @param {Stack} stack @param {string} into the default branch on GitHub
 * @returns {Map<string, string|null>[]}
 */
function movesOf(ctx, stacks, stack, into) {
  const bottom = stack.pulls[0].oid;
  const others = [...stacks.values()].filter((other) => other !== stack).flatMap((other) => other.pulls.map(({ oid }) => oid))
    .filter((oid) => !lg.isAncestor(ctx.root, bottom, oid));
  const owned = stack.pulls.map((pull, i) => lg.commitsPast(ctx.root, pull.oid, [into, ...others, ...stack.pulls.slice(0, i).map(({ oid }) => oid)])
    .map((commit) => ({ ...commit, tasks: [shownTask(pull.ref)] })));
  const moves = lg.stackMoves(ctx, owned.flat(), into, fetchedDefault);
  let at = 0;
  return owned.map((commits) => {
    const own = moves.slice(at, at + commits.length);
    at += commits.length;
    return new Map(own.flatMap((moved) => [...moved]));
  });
}

/**
 * Whether GitHub's squash of any pull request of a stack whose heads point
 * as `heads` do — each onto the default branch as those below it left it,
 * over the head below it, the bottom's over `base` — would meet a pointer
 * both sides moved, the default branch pointing as `onto` does.
 * @param {string[]} paths @param {Map<string, string|null>} base @param {Map<string, string|null>} onto @param {Map<string, string|null>[]} heads
 */
function meetsMove(paths, base, onto, heads) {
  return paths.some((at) => {
    let below = base.get(at) ?? null;
    let landed = onto.get(at) ?? null;
    for (const head of heads) {
      const own = head.get(at) ?? null;
      if (own !== below && landed !== below && own !== landed) return true;
      if (own !== below) landed = own;
      below = own;
    }
    return false;
  });
}

/**
 * The repository's submodules' pointers settled on a stack's branches
 * before GitHub merges it (see the header): the stack brought up to date
 * with the default branch on GitHub where a squash would meet a pointer
 * both sides moved, else the top's pointers recorded where they are not the
 * rule's.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function settlePointers(ctx, host, stacks, stack) {
  if (ctx.gitlinks.length === 0) return;
  const into = fetchedDefault(ctx);
  const moves = movesOf(ctx, stacks, stack, into);
  const heads = stack.pulls.map(({ oid }) => oid);
  const [base, onto, ...held] = lg.pointersAt(ctx.root, [lg.mergeBase(ctx.root, into, heads[0]), into, ...heads], ctx.gitlinks);
  const top = stack.pulls[stack.pulls.length - 1];
  const own = held[held.length - 1];
  const recorded = new Map(moves.flatMap((moved) => [...moved]));
  const pointed = new Map([...recorded].filter(([at, sha]) => sha !== (own.get(at) ?? null)));
  if (meetsMove(ctx.gitlinks, base, onto, [...held.slice(0, -1), new Map([...own, ...pointed])])) {
    bringUp(ctx, host, stack, into, moves);
  } else if (pointed.size > 0) {
    const listed = [...pointed.keys()].map(lg.plain).join(', ');
    const message = `chore(${ctx.unit}): point ${listed} at ${pointed.size === 1 ? 'its' : 'their'} landing\n`;
    const tree = lg.treeWithPointers(ctx.root, top.oid, pointed);
    const commit = lg.commitTree(ctx.root, { tree, parent: top.oid, message, signed: lg.signs(ctx.root) }, `${listed}'s pointer on ${top.head}`, 'land again');
    pushUp(ctx, host, [{ pull: top, commit }], `${listed}'s pointer was not recorded`);
  }
}

/**
 * A stack brought up to date with the default branch on GitHub, `into`:
 * merged into the bottom branch, then each branch into the one above, each
 * pull request's `moves` set on its merge (see the header) — refused, before
 * anything is pushed, where a merge conflicts in a file.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack @param {string} into @param {Map<string, string|null>[]} moves
 */
function bringUp(ctx, host, stack, into, moves) {
  const signed = lg.signs(ctx.root);
  const theirs = `${host.remote}/${ctx.into}`;
  let below = { commit: into, name: ctx.into };
  const made = stack.pulls.map((pull, i) => {
    const base = lg.pointedLike(ctx.root, lg.mergeBase(ctx.root, below.commit, pull.oid), pull.oid, ctx.gitlinks);
    const merged = lg.mergeTree(ctx.root, base, pull.oid, below.commit);
    if ('conflicts' in merged) {
      throw new Error(`land: ${pull.head} conflicts with ${theirs} at ${merged.conflicts.map(lg.plain).join(', ')}, so nothing was pushed and nothing merged — `
        + `merge ${theirs} into ${pull.head}, settling the conflict, push it, and land again`);
    }
    const tree = moves[i].size === 0 ? merged.tree : lg.treeWithPointers(ctx.root, merged.tree, moves[i]);
    const message = `chore(${ctx.unit}): merge ${below.name} into ${pull.head}\n`;
    const commit = lg.commitTree(ctx.root, { tree, parent: [pull.oid, below.commit], message, signed }, `the merge of ${below.name} into ${pull.head}`, 'land again');
    below = { commit, name: pull.head };
    return { pull, commit };
  });
  pushUp(ctx, host, made, `phase ${stack.phase}'s branches were not brought up to date with ${ctx.into}`);
}

/**
 * Each pull request's head moved to its new commit: refused, before
 * anything is pushed, where its branch here is checked out and cannot move;
 * then all pushed at once, and each branch here moved.
 * @param {LandingContext} ctx @param {Host} host @param {{pull: Pull, commit: string}[]} made @param {string} then what did not happen, where the push fails
 */
function pushUp(ctx, host, made, then) {
  refuseBlocked(ctx, made.map(({ pull, commit }) => ({ branch: pull.head, from: pull.oid, to: commit })));
  lg.pushBranches(ctx.root, host.remote, made.map(({ pull, commit }) => ({ branch: pull.head, commit })), `${then} and nothing merged — clear what git names, and land again`);
  const here = lg.branches(ctx.root);
  for (const { pull, commit } of made) if (here.has(pull.head)) lg.moveBranch(ctx.root, pull.head, pull.oid, commit);
}

/**
 * Merge a stack whole into the default branch, every pull request squashed:
 * linked first, so a pull request chained late is in it, its submodules'
 * pointers settled (`settlePointers`), and merged by the extension; a lone
 * one merged alone, under the subject and body a squash makes, onto the
 * default branch. The default branch here is then brought to the merge.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function mergeStack(ctx, host, stacks, stack) {
  refuseHandled(stack);
  const below = builtOn(ctx, stacks, stack.phase, stack.pulls[0].oid);
  if (below !== undefined) {
    throw new Error(`land: phase ${stack.phase} stacks on phase ${below.phase}, which has not merged — merge it first with \`land phase ${ctx.unit} ${below.phase}\`, then land again`);
  }
  catchUpBranches(ctx, stack);
  const merging = `merge phase ${stack.phase}'s stack`;
  const [lone, ...more] = stack.pulls;
  if (more.length > 0) {
    refuseSquashDefault(ctx, host, stack);
    link(ctx, host, stack);
  } else if (lone.base !== ctx.into) {
    ghAt(ctx, host, ['pr', 'edit', String(lone.number), '--base', ctx.into], `base pull request #${lone.number} on ${ctx.into}`);
  }
  settlePointers(ctx, host, stacks, stack);
  if (more.length > 0) ghAt(ctx, host, ['stack', 'merge', String(stack.pulls[stack.pulls.length - 1].number), '--yes', '--squash'], merging);
  else ghAt(ctx, host, ['pr', 'merge', String(lone.number), '--squash', '--subject', `${lone.title} (#${lone.number})`, '--body', lone.body], merging);
  const { stack: tasks, pull_requests } = answered(stack);
  const warnings = bringDefaultUp(ctx, host);
  return { into: ctx.into, merged: tasks, pull_requests, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * Merge a phase whole into the default branch — null where no task of it
 * is open here, and `already` where it is merged, the default branch here
 * brought to it all the same.
 * @param {LandingContext} ctx @param {number} phase
 */
function mergePhase(ctx, phase) {
  const host = hostOf(ctx);
  const stacks = stacksOf(pullsOf(ctx, host));
  const stack = stacks.get(phase);
  if (stack === undefined) return null;
  if (isMerged(stack)) {
    const warnings = bringDefaultUp(ctx, host);
    return { into: ctx.into, already: true, ...(warnings.length > 0 ? { warnings } : {}) };
  }
  return mergeStack(ctx, host, stacks, stack);
}

/**
 * Merge every phase not yet merged, lowest first, each after the one it
 * stacks on, each warning given once. Stops at the first that cannot merge,
 * saying which merged.
 * @param {LandingContext} ctx
 */
function finish(ctx) {
  const host = hostOf(ctx);
  /** @type {({phase: number} & Omit<ReturnType<typeof mergeStack>, 'warnings'>)[]} */
  const merged = [];
  /** @type {Set<string>} */
  const warned = new Set();
  for (;;) {
    const stacks = stacksOf(pullsOf(ctx, host));
    const unmerged = [...stacks.values()].filter((stack) => !isMerged(stack)).sort((a, b) => a.phase - b.phase);
    if (unmerged.length === 0) return { into: ctx.into, phases: merged, ...(warned.size > 0 ? { warnings: [...warned] } : {}) };
    try {
      const next = unmerged.find((stack) => builtOn(ctx, stacks, stack.phase, stack.pulls[0].oid) === undefined) ?? unmerged[0];
      const { warnings = [], ...landed } = mergeStack(ctx, host, stacks, next);
      merged.push({ phase: next.phase, ...landed });
      warnings.forEach((warning) => warned.add(warning));
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

/** The repository a remote URL names, as GitHub names it, for a URL the driver serves. @param {string} url */
function repositoryNamed(url) {
  const { owner, repo } = /** @type {{owner: string, repo: string}} */ (repositoryOf(url));
  return `${owner}/${repo}`;
}

/**
 * Set the rule on a branch of the remote's repository (4.4.6): the
 * repository, and why the rule is not set, null where it is.
 * @param {string} root @param {string} url @param {string} branch
 */
function protectBranch(root, url, branch) {
  const repository = repositoryNamed(url);
  return { repository, unset: setOnGithub(root, ['--method', 'POST', `repos/${repository}/rulesets`, '--input', '-'], JSON.stringify(rulesetFor(branch))) };
}

/**
 * Make the remote's repository squash a pull request into its title and
 * description (7.2.18): the repository, and why it does not, null where it
 * does.
 * @param {string} root @param {string} url
 */
function setSquashDefault(root, url) {
  const repository = repositoryNamed(url);
  const squash = ['-f', 'squash_merge_commit_title=PR_TITLE', '-f', 'squash_merge_commit_message=PR_BODY'];
  return { repository, unset: setOnGithub(root, ['--method', 'PATCH', `repos/${repository}`, ...squash]) };
}

module.exports = {
  kind: 'landing',
  name: 'github',
  isDefault: false,
  needs: [
    { tool: 'gh', floor: '2.30.0', update: 'https://cli.github.com', found: ghVersion },
    { tool: 'gh-stack', floor: '0.1.0', update: 'https://github.com/github/gh-stack', found: stackVersion },
  ],
  serves: (/** @type {string} */ url) => repositoryOf(url) !== null,
  assertServes: (/** @type {LandingContext} */ ctx) => {
    hostOf(ctx);
  },
  chainTip,
  open,
  chain,
  mergePhase,
  finish,
  protectBranch,
  setSquashDefault,
  repositoryOf,
};
