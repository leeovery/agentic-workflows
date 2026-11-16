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
// first by their bases, each based on the one before, those merged by hand
// among them. A pull request has landed once merged, or closed as its task
// landed outside it (`closeLanded`), and its task landed on
// the default branch as GitHub holds it, its branch's tip with it, as the
// seam reads where every task stands against its landing (`landedPull`, the
// seam's `landedOn`, `stands`), from the head of its task's pull request,
// the commit the driver took it at (`taken`) — fetched from the pull
// request's own ref where the repository lacks it, as a commit made on the
// site leaves it, one GitHub no longer serves left out — its merged state
// never read alone, since GitHub's button merges a pull request into its
// own base, the branch of the one below it while that branch is kept, and
// a task can change after its pull request merged. A stack merged in part
// by hand is a stack still, and so is one merged whole, taking a task
// opened since (R30); one closed by hand whose task never landed stops
// every verb that reaches its phase, saying what happened and the way on.
// The default branch, below, is the branch a context lands on
// (landing.cjs): a unit's own branch, for a unit with one, which lands on
// the default branch itself at finish.
//
// - The chain's tip: the open pull request at the top of the task's phase's
//   stack; for its first task, or one opened since its phase landed, the
//   open one at the top of the latest unmerged phase whose pull request the
//   task's branch holds, which the phase then stacks on, as a fix phase does
//   on the one before (7.2.6) — else the default branch, so no pull request
//   is based on a merged one's branch, which GitHub may have deleted. Its
//   commit is the pull request's head, or its task's branch here where that
//   task changed after its landing and its branch moved on from the head,
//   which the phase pushes (`movedOn`); refused where the branch moved
//   otherwise, as the phase refuses it, and where the task has landed and
//   the head holds work the branch here lacks, the way on to pull it
//   first (`pullFirst`). That
//   the task's branch descends from it, with something past it, and holds
//   no other task's work not landed past it, is the seam's to check
//   (landing.cjs).
// - Holds: whether the task's pull request is in its phase's stack, read
//   off GitHub and fetching nothing, as the close in step reads it (7.2.4).
// - Open: the task's branch pushed under its own name (7.2.14), then its
//   pull request opened onto the chain's tip, titled with its landing's
//   subject, its body the rest of that message, with the task's id. A task
//   whose branch does not descend from the chain's tip, its change laid onto
//   it (the seam's `laidFrom`), has the tip merged into its branch first, the
//   merge settled to what laying its change there gives — one changed after
//   its landing laid onto the default branch as GitHub holds it, then the
//   tip merged in, so its pull request keeps the landed work its change is
//   read over (`laidOnTip`). Refused,
//   before anything opens in any repository, while the default branch here
//   holds commits GitHub's does not, naming them: a branch cut from it would
//   land them under the task's subject, and pushing them is the person's
//   call.
// - Chain: the phase's open pull requests linked into one stack, bottom to
//   top, always with the default branch as the stack's base — without it,
//   the extension retargets the bottom pull request onto GitHub's own
//   default. A stack of one open pull request is no stack to link.
// - Phase: the stack merged whole, every pull request squashed, once the
//   phase it stacks on has merged. First, each open pull request whose
//   task landed outside it — squashed or picked onto the default branch by
//   hand, which GitHub never marks merged — with nothing past that landing
//   is closed as landed, never merged, so no task lands twice
//   (`closeLanded`); one whose task changed since has its branch here
//   pushed over its head (`catchUpBranches`) and is brought up over that
//   landing, as one changed after it merged is. GitHub makes each squash commit as the
//   repository's squash default says, so a stack merges only where that is
//   the pull request's title and description — each commit then the task's
//   subject with GitHub's " (#N)", and its id in the body (7.2.18); setup
//   offers to set it on every repository the project lands in on GitHub,
//   merge commits allowed beside it, and `github-squash yes` sets both
//   wherever they are not, so a refusal names that verb (github-setup.cjs). A lone pull request is merged alone
//   under that same subject and body, its base made the default branch
//   first where it stood on another phase's task. A stack built on a phase
//   GitHub squashed is first brought up to date with the default branch,
//   its change read over where it was cut from that phase, so the squash,
//   which reads it over the default branch, keeps what it undid of that
//   phase's work (S3, `squashedBelow`); so is a task's pull request changed
//   after its landing, its change read over its tip at that landing, so the
//   squash lands just that change, what it takes back of its own work
//   among it (R29, `broughtOver`). Either merges only once
//   GitHub has worked out that each of its pull requests can, at the head
//   the driver last pushed or read — GitHub works it out again after
//   anything moves one: a push to its head, its base changed or moved, a
//   retarget — read again after each pause, half a minute in all: one
//   conflicting is refused before anything merges, naming it, and one
//   still not worked out is refused, to land again. A task's branch here
//   behind its pull request's head, its task not landed — a push of the
//   driver's that went before the branch here moved — is brought to it
//   first, refused where it is
//   checked out and cannot move; one anywhere else stops the phase, with the
//   local driver's way back (landing-git.cjs). A stack is refused before
//   anything merges where the default branch here is checked out with
//   changes not committed to files the merge changes, naming them. Once
//   merged, the default branch is fetched and moved here to the merge, as
//   the local driver leaves it, where git would fast-forward it, changes not
//   committed to any other file carried across; where it cannot be, the
//   answer warns why, and the merge stands. A phase whose every pull request
//   has landed is answered `already`, the default branch here brought to it
//   all the same, so landing again recovers one a merge left behind, or one
//   merged on GitHub by hand. A stack merged in part by hand is finished,
//   for every work type: each pull request not landed, bottom first, merged
//   alone as a lone one merges — one open on another's branch retargeted
//   onto the default branch first, its change read over the head of the one
//   below it where a squash landed that one (`squashedBelow`), so what it
//   undid of that one's work stays undone, one merged whose task's change never
//   reached it, merged into a branch that never reached it or changed
//   since, opened again onto the default branch from its branch as GitHub
//   holds it, anything merged into that since landing with it — the branch
//   here pushed over it first where it has moved on past it, or off a head
//   that has landed — its task read landed, that head its last commit
//   (task-landed.cjs, `landedAs`) — leased on that head, or GitHub holds it
//   no more; refused where GitHub's copy holds work the branch here lacks
//   after the task's landing, ahead of it or apart from it, the way on to
//   pull GitHub's first (`pullFirst`), and, as the seam refuses it, where
//   that branch holds another task's work not landed (`refuseHeld`). A
//   stack is refused too, before any of it merges or closes, where a task's
//   branch did what no verb reads after its landing on the default branch
//   as GitHub holds it (the seam's `refuseLanded`), which the default
//   branch here may not have seen, as a squash on the site not pulled
//   leaves it; and where a landed task's branch on GitHub holds work made
//   since its landing that the default branch lacks, nothing of it here, as
//   a commit made on the site after it landed leaves it, the way on to pull
//   GitHub's first (`refuseMovedSince`). A way on that remakes a task's
//   branch here ends with its push over GitHub's copy, leased on where
//   GitHub holds it (`pushedOver`), so that copy stands where the branch
//   here does and never refuses it again. Every refusal of its merge, its
//   change's conflict with the default branch among them, is made before
//   it opens, but GitHub's own — whether it can
//   merge, which GitHub works out once it is open (`awaitMergeable`), and
//   the merge itself — so one GitHub refuses is left open, and the next
//   `land phase` merges it as an open one. The default branch is read again
//   after each merge, so one whose change a merge below landed is passed.
// - Finish: the phase merged next, the lowest not landed that stacks on no
//   phase not landed; the seam makes each merge in turn (landing.cjs).
//   Every verb keeps its reads (landing.cjs), so each lists the pull
//   requests and fetches the default branch once in a repository, fetching
//   it again only after a merge of its own, the pull requests it merged
//   then read as merged.
// - A unit's own branch (landing.cjs): its pull request is the one open
//   whose head is the unit's branch, onto the default branch, of those
//   opened from the repository itself (`unitPull`), opened as the unit's
//   review phase begins where none is (`openUnit`). At finish it is merged
//   by a merge commit, opened first where none is open, titled and
//   described as the landing gives, under the landing's subject with
//   GitHub's " (#N)", once GitHub has worked out that it can, at the
//   branch's tip on GitHub, as a lone pull request merges, the default
//   branch here then brought to it. A repository that does not allow merge
//   commits refuses it, naming `github-squash yes`, which allows them beside
//   the squash default. A cancel closes the one open (`closeUnit`).
// - A quick-fix (landing.cjs): in each repository it touches, its one pull
//   request is the latest whose head is its branch, onto the default branch,
//   of those opened from the repository itself, never a fork, since the
//   time the seam names — so another's by that name is never its — read as
//   the head of the one open and the heads of those merged into
//   the default branch, each fetched from the pull request's own ref where
//   the repository here lacks it, and the branch on GitHub, fetched, which
//   is the truth for what the pull request holds; and, where the latest was
//   closed by hand, its reopening, which the seam's verbs refuse on. That
//   read is a verb's one read of its pull requests: it carries the open one
//   whole, and the seam hands it back to the opening and the move's close,
//   the merge taking the one the opening answered. Opening it pushes the branch while GitHub's copy stands where the
//   landing read it — the seam brings that copy in first, so a push never
//   drops a commit of GitHub's, and replaces it only once a merge by hand
//   cut the branch again — and opens the pull request onto the default
//   branch where none is open, or makes its title and body the landing's
//   where they are not — `already` where its head, title and body are the
//   landing's. Its merge is a squash, under its title with GitHub's " (#N)"
//   and its body, once GitHub has worked out that it can, refused as a lone
//   pull request's merge is, the default branch here then brought to it.
//   With nothing to merge, that branch is brought up alone. Its verbs keep their
//   reads (landing.cjs), so each fetches a repository's default branch once
//   before it merges there, and once more as a merge of its own moves it
//   (`defaultFetched`). A move closes the one
//   open unmerged, its branch on GitHub left as it stands.
// - A cancel (18.3.9, landing.cjs): every pull request open on a branch of
//   the unit's closed unmerged — each task's (`closeTasks`), the quick-fix's
//   and the unit's own — its branch on GitHub left as it stands, each
//   number told to the seam as it closes. The numbers the seam recorded
//   come back on every later context (`cancelClosed`), and every read of
//   the pull requests passes over each while it stays closed, a task's,
//   the quick-fix's and the unit's alike, so a landing after a reactivate
//   opens what it needs anew rather than refusing one closed by hand, and
//   one the person reopens is read as open. A task whose pull request the
//   cancel closed onto the head of the one below it, merged by hand since,
//   opens onto the default branch, its change laid from that head
//   (`overShut`), as the stack's finish would have read it.
// - Nested repositories: each repository a task touches lands on its own
//   repository on GitHub, named by its own remote, with a stack of its own
//   per phase; one whose remote is not on GitHub is refused before anything
//   moves (`assertServes`). A merge lands onto the default branch on GitHub,
//   fetched (`landsOn`); a read asking no host takes it as last fetched
//   (`landsOnAsFetched`).
// - Known edges: GitHub answering for a pull request on its old base in the
//   moment after the default branch moves under it — its answer names no
//   base the driver can check — leaves the merge GitHub's to refuse, in
//   its words, and landing again merges it.
// ---------------------------------------------------------------------------

const names = require('../../../domain/landing-names.cjs');
const lg = require('../../../domain/landing-git.cjs');
const { taskId, shownTask, sameTask } = require('../../../domain/task-id.cjs');
const { sleepSync } = require('../../../kernel/process.cjs');
const { gh, ghVersion, stackVersion, setOnGithub } = require('./gh.cjs');

/** @typedef {import('../../../domain/task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../../../domain/landing.cjs').LandingContext} LandingContext */
/** @typedef {import('../../../domain/landing.cjs').LandingTask} LandingTask */

/** Where the driver lands: the project's remote, and the repository on GitHub it names, `{owner}/{repo}`. @typedef {{remote: string, repo: string}} Host */
/** A pull request as GitHub holds it. @typedef {{number: number, state: 'OPEN'|'CLOSED'|'MERGED', head: string, base: string, oid: string, title: string, body: string}} BranchPull */
/** A task's pull request as GitHub holds it. @typedef {BranchPull & {ref: TaskRef}} Pull */
/** A phase's stack: its tasks' pull requests, bottom first; one merged alone, the head of the one below it in its phase where it has one (`finishStack`); and the branches its catch-up pushed, where it pushed any (`catchUpBranches`). @typedef {{phase: number, pulls: Pull[], under?: string, pushed?: string[]}} Stack */
/** Pull requests' heads moved to new commits, pushed. @typedef {{pull: Pull, commit: string}[]} Pushed */
/** The chain's tip, and the host `open` lands on. @typedef {import('../../../domain/landing.cjs').ChainTip & {host: Host}} ChainTip */

// A remote on GitHub, as a URL (https, ssh, git) or scp-like (`git@github.com:o/r`).
const GITHUB_URL = /^(?:(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/|[^@/:]+@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;
const PULL_FIELDS = 'number,state,headRefName,baseRefName,headRefOid,title,body';
// The unit's pull requests are among the repository's latest; past this many, the oldest are not read.
const PULL_LIMIT = '1000';
const MERGEABLE_FIELDS = 'mergeable,headRefOid,baseRefName';
// The key a context keeps its default branch's fetch under (`defaultFetched`).
const DEFAULT_FETCHED = 'default branch fetched';
// The pauses between reads of whether a stack's pull requests can merge: half a minute in all.
const CHECK_PAUSES_MS = Object.freeze([500, 1000, 2000, 4000, 8000, 15000]);

// Test hook: LEDGER_MERGEABLE_PAUSE_MS overrides each pause.
function checkPauseMs(/** @type {number} */ planned) {
  const env = process.env.LEDGER_MERGEABLE_PAUSE_MS;
  return env !== undefined && /^\d+$/.test(env) ? Number(env) : planned;
}

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
 * or one not on GitHub — its remote's URL read once on the context.
 * @param {LandingContext} ctx
 * @returns {Host}
 */
function hostOf(ctx) {
  const change = 'or change the landing driver from manage on the start menu';
  const own = ctx.repo === '.';
  const { remote } = ctx;
  if (remote === null) {
    throw new Error(own
      ? `land: GitHub's driver lands through the project's remote, and the project has none chosen — add its repository on GitHub as origin, ${change}`
      : `land: GitHub's driver lands every repository a task touches through that repository's own remote, and this one has none chosen — add its repository on GitHub as origin there, ${change}`);
  }
  const url = lg.readOnce(ctx, 'remote-url', () => lg.remoteUrlOf(ctx.root, remote));
  const repository = repositoryOf(url);
  if (repository === null) {
    throw new Error(`land: ${own ? 'the project\'s' : 'its'} remote, ${remote}, is not on GitHub (${lg.plain(url)}), where GitHub's driver lands — ${own ? '' : 'point it at its repository on GitHub, '}${change}`);
  }
  return { remote, repo: `${repository.owner}/${repository.repo}` };
}

/**
 * gh's answer to `args`, run in the code root against the host's repository.
 * @param {LandingContext} ctx @param {Host} host @param {string[]} args @param {string} what as gh.cjs's
 */
const ghAt = (ctx, host, args, what) => gh(args, what, { cwd: ctx.root, repo: host.repo });

/** How a pull request outranks another of its task's: any not closed above a closed one, then the latest. @param {Pull} pull */
const rank = (pull) => (pull.state === 'CLOSED' ? 0 : Number.MAX_SAFE_INTEGER / 2) + pull.number;

/** Whether the unit's cancel closed a pull request GitHub still holds closed (see the header). @param {LandingContext} ctx @param {{number: number, state: Pull['state']}} pr */
const cancelledShut = (ctx, pr) => pr.state === 'CLOSED' && ctx.cancelClosed.has(String(pr.number));

/**
 * Each of the unit's tasks' pull request, as GitHub holds it (see the
 * header), none its cancel closed that stays closed (`cancelledShut`).
 * @param {LandingContext} ctx @param {Host} host
 * @returns {Pull[]}
 */
function pullsOf(ctx, host) {
  /** @type {Map<string, Pull>} */
  const byTask = new Map();
  for (const pr of listedRead(ctx, host)) {
    const ref = names.taskOfBranch(ctx.unit, pr.headRefName);
    if (ref === null || cancelledShut(ctx, pr)) continue;
    const pull = { number: pr.number, state: pr.state, head: pr.headRefName, base: pr.baseRefName, oid: pr.headRefOid, title: pr.title, body: pr.body, ref };
    const held = byTask.get(taskId(ref));
    if (held === undefined || rank(pull) > rank(held)) byTask.set(taskId(ref), pull);
  }
  return [...byTask.values()];
}

/** A pull request as gh lists it. @typedef {{number: number, state: Pull['state'], headRefName: string, baseRefName: string, headRefOid: string, title: string, body: string}} Listed */

/**
 * Every pull request of the repository's, as gh lists it, read once on a
 * context that keeps its reads (landing-git.cjs, `readOnce`).
 * @param {LandingContext} ctx @param {Host} host
 * @returns {Listed[]}
 */
const listedRead = (ctx, host) => lg.readOnce(ctx, 'pulls listed', () => JSON.parse(ghAt(ctx, host, ['pr', 'list', '--state', 'all', '--limit', PULL_LIMIT, '--json', PULL_FIELDS], `read ${host.repo}'s pull requests`)));

/**
 * The unit's pull requests (`pullsOf`), read once on a context that keeps
 * its reads (landing-git.cjs, `readOnce`) — those a merge of the call's
 * own merges then read as merged (`mergeStack`).
 * @param {LandingContext} ctx @param {Host} [host] its host, where the caller holds it; else read (`hostOf`) only as the pull requests are
 */
const pullsRead = (ctx, host) => lg.readOnce(ctx, 'pulls', () => pullsOf(ctx, host ?? hostOf(ctx)));

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

/**
 * The commit the driver took each of the unit's tasks at, by its internal
 * id: the head of its pull request (see the header), fetched from the pull
 * request's own ref where the repository here lacks it, as a commit made on
 * GitHub's site leaves it — one GitHub no longer serves left out.
 * @param {LandingContext} ctx @returns {Map<string, string>}
 */
function taken(ctx) {
  const host = hostOf(ctx);
  const pulls = pullsRead(ctx, host);
  if (pulls.length === 0) return new Map();
  const held = lg.commitsIn(ctx.root, pulls.map(({ oid }) => oid));
  const readable = pulls.filter((pull) => held.has(pull.oid) || lg.fetchedCommit(ctx.root, host.remote, `refs/pull/${pull.number}/head`, pull.oid));
  return new Map(readable.map((pull) => [taskId(pull.ref), pull.oid]));
}

/**
 * Whether a pull request has landed on the default branch, at the commit
 * `tip` reads, read only where it is asked: merged, or closed as its task
 * landed outside it (`closeLanded`), and its task landed there, its
 * branch's tip with it, as the seam reads where every task stands
 * (`landedOn`, `stands`) — never its merged state alone, so one merged into
 * a branch whose change never reached the default branch has not, nor one
 * whose task changed after it merged. A stack's are read bottom first, each
 * below read before it.
 * @param {LandingContext} ctx @param {Pull} pull @param {() => string} tip
 */
const landedPull = (ctx, pull, tip) => pull.state !== 'OPEN' && ctx.landedOn(tip()).stands(pull.ref) === 'landed';

/**
 * Each open pull request of a stack whose task has landed outside it —
 * squashed or picked onto the default branch by hand, which GitHub never
 * marks merged — with nothing past its landing, as the seam reads where
 * every task stands at the commit `tip` reads (`landedOn`, `stands`),
 * closed on GitHub, never merged, so no task lands twice: each read then
 * as closed.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack @param {() => string} tip
 */
function closeLanded(ctx, host, stack, tip) {
  for (const pull of stack.pulls.filter((open) => open.state === 'OPEN' && ctx.landedOn(tip()).stands(open.ref) === 'landed')) {
    ghAt(ctx, host, ['pr', 'close', String(pull.number)], `close pull request #${pull.number}, its task landed outside it`);
    pull.state = 'CLOSED';
  }
}

/** Whether each pull request of a stack has landed (`landedPull`). @param {LandingContext} ctx @param {Stack} stack @param {() => string} tip */
const stackLanded = (ctx, stack, tip) => stack.pulls.every((pull) => landedPull(ctx, pull, tip));

/** The default branch here, for the reads that fetch nothing. @param {LandingContext} ctx */
const defaultHere = (ctx) => /** @type {string} */ (lg.branches(ctx.root).get(ctx.into));

/** The stack's pull request of a task, if any. @param {Stack|undefined} stack @param {TaskRef} ref */
const pullOf = (stack, ref) => stack?.pulls.find((pull) => sameTask(pull.ref, ref));

/** Pull requests as a refusal names them. @param {Pull[]} pulls */
const pullsNamed = (pulls) => pulls.map((pull) => `#${pull.number} (task ${shownTask(pull.ref)})`).join(', ');

/**
 * Refuse a stack a pull request closed on GitHub without being merged
 * stops: one whose task never landed, read at the default branch as last
 * fetched — one closed as its task landed outside it, changed since or not,
 * stops nothing.
 * @param {LandingContext} ctx @param {Stack} stack
 */
function refuseClosed(ctx, stack) {
  const closed = stack.pulls.find((pull) => pull.state === 'CLOSED' && ctx.landedOn(lastFetchedDefault(ctx)).stands(pull.ref) === 'unlanded');
  if (closed !== undefined) {
    throw new Error(`land: task ${shownTask(closed.ref)}'s pull request #${closed.number} was closed on GitHub without being merged — reopen it there, as \`gh pr reopen ${closed.number}\` does, and land again`);
  }
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
  for (const stack of reached) refuseClosed(ctx, stack);
  return reached[0];
}

/**
 * The stacks on GitHub and the task's phase's own — refused where a pull
 * request of it was closed by hand — the pull requests read once on its
 * context (landing-git.cjs, `readOnce`). A stack merged in part by hand,
 * or whole, is a stack still, its merged pull requests held in it.
 * @param {LandingContext} ctx @param {Host} host @param {TaskRef} ref
 */
function stacksFor(ctx, host, ref) {
  const stacks = stacksOf(pullsRead(ctx, host));
  const own = stacks.get(ref.phase);
  if (own !== undefined) refuseClosed(ctx, own);
  return { stacks, own };
}

/** Whether its phase's stack holds the task's pull request, refused as `stacksFor` refuses it. @param {LandingContext} ctx @param {TaskRef} ref */
const holds = (ctx, ref) => pullOf(stacksFor(ctx, hostOf(ctx), ref).own, ref) !== undefined;

/**
 * The chain's tip a task lands on (see the header) — null where its phase's
 * stack holds it already. Refuses as `stacksFor` does, a task GitHub's
 * default branch lacks commits of (`refuseUnpushed`), and one built on a
 * stack something done by hand stops.
 * @param {LandingContext} ctx @param {LandingTask} task
 * @returns {ChainTip|null}
 */
function chainTip(ctx, task) {
  const host = hostOf(ctx);
  const { phase } = task.ref;
  const { stacks, own } = stacksFor(ctx, host, task.ref);
  if (pullOf(own, task.ref) !== undefined) return null;
  refuseUnpushed(ctx, host, shownTask(task.ref));
  const top = openTop(own) ?? openTop(builtOn(ctx, stacks, phase, task.branch));
  const refs = lg.branches(ctx.root);
  if (top === undefined) {
    const commit = /** @type {string} */ (refs.get(ctx.into));
    return { name: ctx.into, commit, host, ...overShut(ctx, host, own, task, commit) };
  }
  const moved = movedOn(ctx, refs, top);
  return { name: top.head, commit: moved === 'changed' ? /** @type {string} */ (refs.get(top.head)) : top.oid, host };
}

/**
 * Where a task's change is laid onto the default branch, at `commit`, from
 * (the header's): where the unit's cancel closed its latest pull request,
 * based on the head of the one below it in its stack that has merged into
 * the default branch by hand since, that head, which its branch holds — as
 * the stack's finish would read it over that one's head (`finishStack`),
 * had the cancel not closed it. Nothing where its branch descends from
 * `commit`, or the cancel closed none of it so.
 * @param {LandingContext} ctx @param {Host} host @param {Stack|undefined} own its phase's stack @param {LandingTask} task @param {string} commit
 * @returns {{over?: string}}
 */
function overShut(ctx, host, own, task, commit) {
  if (ctx.cancelClosed.size === 0 || lg.isAncestor(ctx.root, commit, task.branch)) return {};
  const ofTask = (/** @type {Listed} */ pr) => {
    const ref = names.taskOfBranch(ctx.unit, pr.headRefName);
    return ref !== null && sameTask(ref, task.ref);
  };
  const base = listedRead(ctx, host).filter((pr) => cancelledShut(ctx, pr) && ofTask(pr)).sort((a, b) => b.number - a.number)[0]?.baseRefName;
  const under = own?.pulls.find((pull) => pull.state === 'MERGED' && pull.head === base && pull.base === ctx.into);
  return under === undefined || !lg.isAncestor(ctx.root, under.oid, task.branch) ? {} : { over: under.oid };
}

/**
 * Where a task's branch here stands against its pull request's head, as
 * the phase brings it up (`catchUpBranches`): null at it, or not here;
 * `behind` it, as a push that went before the branch here moved leaves it;
 * `changed`, moved on from it with its task changed after its landing
 * outside the pull request (the seam's `landedOn`, `stands`). Refused where
 * the task has landed and the head holds work the branch here lacks — ahead
 * of it, or apart from it — as a commit pushed to its pull request after
 * its landing leaves it, the way on to pull it first (`pullFirst`); and
 * where it moved on otherwise, keeping the branch as it stands and putting
 * it back.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {Pull} pull
 * @returns {'behind'|'changed'|null}
 */
function movedOn(ctx, refs, pull) {
  const at = refs.get(pull.head);
  if (at === undefined || at === pull.oid) return null;
  const stands = ctx.landedOn(lastFetchedDefault(ctx)).stands(pull.ref);
  if (stands !== 'unlanded' && !lg.isAncestor(ctx.root, pull.oid, at)) {
    throw new Error(`land: task ${shownTask(pull.ref)}'s branch ${pull.head} on GitHub, at ${lg.short(pull.oid)}, holds work the branch here, at ${lg.short(at)}, lacks, and nothing merged — ${pullFirst(hostOf(ctx), pull.head)}, and land again`);
  }
  if (lg.isAncestor(ctx.root, at, pull.oid)) return 'behind';
  if (stands === 'changed') return 'changed';
  throw new Error(lg.movedSinceOpened(ctx.root, shownTask(pull.ref), pull.head, pull.oid, at));
}

/**
 * The way on of a task's branch whose copy on GitHub holds work the branch
 * here lacks after its landing: that copy pulled onto it first, its commits
 * here laid on that copy, so no merge stands past its landing.
 * @param {Host} host @param {string} branch
 */
const pullFirst = (host, branch) => `on ${branch}, pull its copy on GitHub first with \`git pull --rebase ${host.remote} ${branch}\``;

/** The key a context keeps its read of the landed tasks' branches on GitHub under (`headsOnGithub`). */
const LANDED_HEADS = 'landed heads';

/**
 * The branches of the unit's pull requests not open, as GitHub holds them,
 * by name, read once on a context in one call, writing nothing — one GitHub
 * holds no more left out.
 * @param {LandingContext} ctx @param {Host} host @returns {Map<string, string>}
 */
const headsOnGithub = (ctx, host) => lg.readOnce(ctx, LANDED_HEADS, () => lg.remoteHeads(ctx.root, host.remote, pullsRead(ctx, host).filter((pull) => pull.state !== 'OPEN').map(({ head }) => head)));

/**
 * Refuse, before anything merges or closes, a task of a stack whose branch
 * did what no verb reads after its landing on the default branch as GitHub
 * holds it (the seam's `refuseLanded`), which the default branch here may
 * not have seen, as a pull request squashed on GitHub's site and not pulled
 * leaves it; then one whose branch on GitHub moved past its landing
 * (`refuseMovedSince`).
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack
 */
function refuseAfterLanding(ctx, host, stack) {
  const tip = () => tipOnGithub(ctx, host);
  ctx.refuseLanded(tip(), stack.pulls.map(({ ref }) => ref));
  refuseMovedSince(ctx, host, stack.pulls, tip);
}

/**
 * Refuse, before anything merges, a task of `pulls` whose pull request
 * landed (`landedPull`) and whose branch on GitHub moved past it with work
 * the default branch lacks, as a commit made on the site after it landed
 * leaves it, nothing of it here — the way on to pull that copy first
 * (`pullFirst`). One GitHub holds at its pull request's head, or holds no
 * more, passes on the one read of them all (`headsOnGithub`); one moved,
 * fetched as GitHub holds it, passes where it holds nothing past the task's
 * landing (the seam's `landedAs`), as a squash of it there leaves it, or
 * nothing past a pull request of the unit merged into it (`mergedOnly`).
 * @param {LandingContext} ctx @param {Host} host @param {Pull[]} pulls @param {() => string} tip
 */
function refuseMovedSince(ctx, host, pulls, tip) {
  const there = headsOnGithub(ctx, host);
  for (const pull of pulls) {
    const at = there.get(pull.head);
    if (at === undefined || at === pull.oid || !landedPull(ctx, pull, tip)) continue;
    if (!lg.fetchedCommit(ctx.root, host.remote, `refs/heads/${pull.head}`, at) || ctx.landedOn(tip()).landedAs(pull.ref, at) || mergedOnly(ctx, host, pull.head, at)) continue;
    throw new Error(`land: task ${shownTask(pull.ref)}'s branch ${pull.head} on GitHub, at ${lg.short(at)}, holds work made since its pull request #${pull.number} landed, which ${ctx.into} lacks, and nothing merged — ${pullFirst(host, pull.head)}, and land again`);
  }
}

/**
 * Whether a branch GitHub holds at `at` holds nothing past a pull request
 * of the unit merged into it, as the site's button merging one into its
 * own base leaves it — which the stack's finish opens again onto the
 * default branch (`finishStack`) — a commit made there since refused.
 * @param {LandingContext} ctx @param {Host} host @param {string} branch @param {string} at
 */
const mergedOnly = (ctx, host, branch, at) => pullsRead(ctx, host).some((pull) => pull.state === 'MERGED' && pull.base === branch
  && lg.fetchedCommit(ctx.root, host.remote, `refs/pull/${pull.number}/head`, pull.oid) && lg.holdsChange(ctx.root, pull.oid, at));

/**
 * The push a way on that remakes a task's branch here ends with, over its
 * copy on GitHub, leased on where GitHub holds it (`lg.remoteHeads`) —
 * null where it holds none.
 * @param {LandingContext} ctx @param {string} branch @returns {string|null}
 */
function pushedOver(ctx, branch) {
  const host = hostOf(ctx);
  const held = lg.remoteHeads(ctx.root, host.remote, [branch]).get(branch);
  return held === undefined ? null : lg.forcePushed(host.remote, branch, held);
}

/** The open pull request at the top of a stack, if any. @param {Stack|undefined} stack */
const openTop = (stack) => stack?.pulls.filter((pull) => pull.state === 'OPEN').at(-1);

/**
 * Refuse a task's open while the default branch here holds commits GitHub's
 * does not — a task's branch cut from it would carry them, and they would
 * land under the task's subject — naming them, and the way on: pushing them
 * is the person's call.
 * @param {LandingContext} ctx @param {Host} host @param {string} shown
 */
function refuseUnpushed(ctx, host, shown) {
  const theirs = `${host.remote}/${ctx.into}`;
  const fetched = lg.fetchBranch(ctx.root, host.remote, ctx.into);
  if ('failed' in fetched) throw new Error(`land: ${theirs} could not be fetched (${fetched.failed}), so task ${shown} was not opened — open it again once it can be`);
  const ahead = lg.commitsNamed(ctx.root, fetched.commit, ctx.into);
  if (ahead.length === 0) return;
  const [held, them, belong] = ahead.length === 1 ? ['a commit', 'it', 'it belongs'] : [`${ahead.length} commits`, 'them', 'they belong'];
  throw new Error(
    `land: ${ctx.into} here holds ${held} ${theirs} does not — ${ahead.join(', ')} — which a task's branch cut from it would land under the task's own subject, so task ${shown} was not opened; `
    + `push ${them} to ${ctx.into} on GitHub if ${belong} there, as \`git push ${host.remote} ${ctx.into}\` does, and open the task again`,
  );
}

/**
 * A task's change laid onto the chain's tip from where the seam reads it
 * (`over`, landing.cjs `laidFrom`), so its pull request descends from the
 * tip and holds the tip and that change alone, as a stack's squash reads it
 * past the pull request below: a merge into its branch whose tree is that
 * change laid there, as `bringUp` merges a pull request's base into it. A
 * task changed after its landing has its change laid onto the default
 * branch as GitHub's was last fetched instead, which holds that landing, so
 * its pull request keeps its landed work its change is read over again
 * (`broughtOver`); the tip, where it is another task's branch, then merged
 * in as git merges it. Refused, nothing moved, where either conflicts,
 * naming the paths and the way on, or where the branch here is checked out
 * and cannot move.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip @param {string} over
 */
function laidOnTip(ctx, task, tip, over) {
  const at = /** @type {string} */ (lg.branches(ctx.root).get(task.branch));
  const into = lastFetchedDefault(ctx);
  const changed = ctx.landedOn(into).stands(task.ref) === 'changed';
  const theirs = `${tip.host.remote}/${ctx.into}`;
  const onto = changed ? { name: theirs, commit: into } : { name: tip.name === ctx.into ? theirs : tip.name, commit: tip.commit };
  const laid = mergedOnto(ctx, task, at, onto, over, () => lg.rebasedPast(task.branch, onto.name, over));
  const commit = lg.isAncestor(ctx.root, tip.commit, laid) ? laid : mergedOnto(ctx, task, laid, tip, lg.mergeBase(ctx.root, tip.commit, laid), () => `merge ${tip.name} into ${task.branch}, settling the conflict`);
  refuseBlocked(ctx, [{ branch: task.branch, from: at, to: commit }]);
  lg.moveBranch(ctx.root, task.branch, at, commit);
}

/**
 * The commit `onto` merged into a task's work at `at` over `base`, as
 * `laidOnTip` makes it — refused, nothing moved, where that conflicts,
 * naming the paths and the way on (`wayOn`).
 * @param {LandingContext} ctx @param {LandingTask} task @param {string} at @param {{name: string, commit: string}} onto @param {string} base @param {() => string} wayOn
 * @returns {string}
 */
function mergedOnto(ctx, task, at, onto, base, wayOn) {
  const merged = lg.mergeTree(ctx.root, base, onto.commit, at);
  if ('conflicts' in merged) {
    throw new Error(`land: task ${shownTask(task.ref)}'s change past ${lg.short(base)} conflicts with ${onto.name} at ${merged.conflicts.map(lg.plain).join(', ')}, so its pull request was not opened — ${wayOn()}, and open the task again`);
  }
  const message = `chore(${ctx.unit}): merge ${onto.name} into ${task.branch}\n`;
  return lg.commitTree(ctx.root, { tree: merged.tree, parent: [at, onto.commit], message, signed: lg.signs(ctx.root) }, `the merge of ${onto.name} into ${task.branch}`, 'open the task again');
}

/**
 * Open a task's pull request onto the chain's tip the seam checked it
 * descends from, or lays its change onto (`laidOnTip`), with a commit past
 * it, its branch pushed first.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip
 */
function open(ctx, task, tip) {
  const shown = shownTask(task.ref);
  if (tip.over !== undefined) laidOnTip(ctx, task, tip, tip.over);
  lg.pushBranch(ctx.root, tip.host.remote, task.branch, `task ${shown}'s pull request was not opened — clear what git names, and open the task again`);
  const [title, ...body] = task.message.split('\n');
  const url = ghAt(ctx, tip.host, ['pr', 'create', '--base', tip.name, '--head', task.branch, '--title', title, '--body', body.join('\n').trim()], `open task ${shown}'s pull request`);
  return { base: tip.name, pull_request: Number(/\/pull\/(\d+)\s*$/.exec(url)?.[1]) };
}

/**
 * The stack's open pull requests linked into one on GitHub, bottom to top,
 * its base the default branch — where it holds more than one; one merged
 * by hand is linked no more.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack
 */
function link(ctx, host, stack) {
  const open = stack.pulls.filter((pull) => pull.state === 'OPEN');
  if (open.length < 2) return;
  const numbers = open.map((pull) => String(pull.number));
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
  const stack = stacksOf(pullsRead(ctx, host)).get(phase);
  if (stack !== undefined) refuseClosed(ctx, stack);
  if (stack !== undefined && stackLanded(ctx, stack, () => defaultHere(ctx))) throw new Error(`land: phase ${phase} is merged into ${ctx.into} — its stack is landed`);
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
 * refused, before any moves, where one is checked out and cannot. A task
 * changed after its landing outside its pull request (the seam's
 * `landedOn`, `stands`) has its branch here pushed to its head, leased on
 * it, so its change is brought up over its landing as the stack merges
 * (`broughtOver`, R29). Any other stack a task's branch here has moved on
 * from its head is refused, and so is one whose landed task's head holds
 * work the branch here lacks (`movedOn`). A branch not here is passed over:
 * what merges is what GitHub holds.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack
 */
function catchUpBranches(ctx, host, stack) {
  const refs = lg.branches(ctx.root);
  /** @type {{branch: string, from: string, to: string}[]} */
  const behind = [];
  /** @type {{pull: Pull, commit: string}[]} */
  const ahead = [];
  for (const pull of stack.pulls) {
    const moved = movedOn(ctx, refs, pull);
    const at = /** @type {string} */ (refs.get(pull.head));
    if (moved === 'behind') behind.push({ branch: pull.head, from: at, to: pull.oid });
    else if (moved === 'changed') ahead.push({ pull, commit: at });
  }
  refuseBlocked(ctx, behind);
  for (const { branch, from, to } of behind) lg.moveBranch(ctx.root, branch, from, to);
  if (ahead.length === 0) return;
  lg.pushBranches(ctx.root, host.remote, ahead.map(({ pull, commit }) => ({ branch: pull.head, commit, lease: pull.oid })), `phase ${stack.phase}'s changed tasks were not pushed, and nothing merged — clear what git names, and land again`);
  for (const { pull, commit } of ahead) pull.oid = commit;
  stack.pushed = ahead.map(({ pull }) => pull.head);
}

/**
 * What a stack's refusal after its catch-up says was pushed: the changed
 * tasks' branches it pushed (`catchUpBranches`), else nothing.
 * @param {Host} host @param {Stack} stack
 */
function pushedSaid(host, stack) {
  const pushed = stack.pushed ?? [];
  if (pushed.length === 0) return 'nothing was pushed and nothing merged';
  return `nothing merged, and ${pushed.join(', ')} ${pushed.length > 1 ? 'were' : 'was'} pushed to ${host.remote} as ${pushed.length > 1 ? 'they stand' : 'it stands'} here`;
}

/**
 * Refuse a merge, before anything merges, where the default branch here is
 * checked out with changes not committed to files the merge of `top`, the
 * head merged last, would change there, so it could not be brought to the
 * merge — naming them; the merge is read only where there are changes, over
 * `over` where given, a task's tip at its landing as its change is brought
 * up (`broughtOver`), else over their merge base. A merge that conflicts
 * with the default branch on GitHub is GitHub's to refuse, and one whose
 * default branch cannot be fetched merges all the same, the answer then
 * warning that it was not brought up — `theirs`, the default branch on
 * GitHub, as its fetch answered.
 * @param {LandingContext} ctx @param {string} top @param {{commit: string}|{failed: string}} theirs @param {() => string|null} [over]
 */
function refuseDirtyDefault(ctx, top, theirs, over = () => null) {
  const ours = lg.branches(ctx.root).get(ctx.into);
  if (ours === undefined || 'failed' in theirs) return;
  const block = lg.dirtBlock(ctx.root, ctx.into, () => {
    const merged = lg.mergeTree(ctx.root, over() ?? lg.mergeBase(ctx.root, theirs.commit, top), theirs.commit, top);
    return 'conflicts' in merged ? new Set() : lg.pathsChanged(ctx.root, ours, merged.tree);
  });
  if (block !== null) throw new Error(`land: ${block}`);
}

/**
 * Whether a repository, as GitHub's API reads it, squashes a pull request
 * into its title and description.
 * @param {string} read
 */
function squashesIntoPull(read) {
  /** @type {{squash_merge_commit_title?: string, squash_merge_commit_message?: string}} */
  const repository = JSON.parse(read);
  return repository.squash_merge_commit_title === 'PR_TITLE' && repository.squash_merge_commit_message === 'PR_BODY';
}

/**
 * Refuse a stack merge where the repository's squash default would not make
 * each commit from its pull request's title and description.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack
 */
function refuseSquashDefault(ctx, host, stack) {
  if (squashesIntoPull(ghAt(ctx, host, ['api', `repos/${host.repo}`], `read ${host.repo}'s squash default`))) return;
  throw new Error(
    `land: ${host.repo} does not squash a pull request into its title and description, so phase ${stack.phase}'s stack would land under other subjects than its tasks' — `
    + 'set that squash default on every repository the project lands in on GitHub, as `engine github-squash yes` does, and land again',
  );
}

/**
 * The default branch here brought to the merge GitHub's holds (see the
 * header), or the warning why it is not — whatever stops it, the merge
 * stands. GitHub's is fetched again where the call's own merge moved it
 * since it was fetched, else read as fetched (`defaultFetched`).
 * @param {LandingContext} ctx @param {Host} host @param {boolean} merged whether the call merged here
 * @returns {string[]}
 */
function bringDefaultUp(ctx, host, merged) {
  const { root, into } = ctx;
  const theirs = `${host.remote}/${into}`;
  const fetched = (merged ? lg.readAgain : lg.readOnce)(ctx, DEFAULT_FETCHED, () => lg.fetchBranch(root, host.remote, into));
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
 * A repository's default branch on GitHub as a fetch of it answered,
 * fetched once on its context, so a call fetches it
 * once before it merges — and once again after each merge of its own moves
 * it, as the default branch here is brought up (`bringDefaultUp`), the
 * reads after that merge taking that fetch.
 * @param {LandingContext} ctx @param {Host} host
 * @returns {{commit: string}|{failed: string}}
 */
const defaultFetched = (ctx, host) => lg.readOnce(ctx, DEFAULT_FETCHED, () => lg.fetchBranch(ctx.root, host.remote, ctx.into));

/**
 * The tip of a repository's default branch on GitHub, fetched — refused
 * where it cannot be.
 * @param {LandingContext} ctx
 * @returns {string}
 */
function fetchedDefault(ctx) {
  return defaultOn(ctx, defaultFetched(ctx, hostOf(ctx)));
}

/**
 * The tip of a repository's default branch on GitHub as last fetched,
 * fetching nothing — the branch here where it never has been.
 * @param {LandingContext} ctx
 * @returns {string}
 */
function lastFetchedDefault(ctx) {
  return lg.trackedTip(ctx.root, hostOf(ctx).remote, ctx.into) ?? /** @type {string} */ (lg.branches(ctx.root).get(ctx.into));
}

/**
 * The tip of a repository's default branch on GitHub as a fetch of it
 * answered — refused where the fetch failed.
 * @param {LandingContext} ctx @param {{commit: string}|{failed: string}} fetched
 * @returns {string}
 */
function defaultOn(ctx, fetched) {
  if ('failed' in fetched) {
    const named = ctx.repo === '.' ? ctx.into : `${lg.plain(ctx.repo)}'s ${ctx.into}`;
    throw new Error(`land: ${named} could not be fetched (${fetched.failed}), so nothing merged — land again once it can be`);
  }
  return fetched.commit;
}

/**
 * Where a stack was cut from the work below it that the default branch on
 * GitHub, `into`, holds the change of but not the commits, as a squash
 * landed it: of the pull request below it in its own phase, where it is
 * merged alone (`under`) and its change read over that one's head lands
 * otherwise than over their merge base, as its take-back of that one's
 * work does (`landsAlike`); then the nearest phase whose newest pull
 * request merged, the first sharing commits with the stack's bottom that
 * `into` lacks, the newest both hold — its head, or below it where its
 * branch moved on after the stack was cut — the merge base the stack's
 * change is read over (`bringUp`); null where none.
 * @param {LandingContext} ctx @param {Map<number, Stack>} stacks @param {Stack} stack @param {string} into
 * @returns {string|null}
 */
function squashedBelow(ctx, stacks, stack, into) {
  const bottom = stack.pulls[0].oid;
  if (stack.under !== undefined) {
    const cut = lg.mergeBase(ctx.root, stack.under, bottom);
    if (!lg.isAncestor(ctx.root, cut, into) && !landsAlike(ctx, into, bottom, cut)) return cut;
  }
  const heads = [...stacks.values()].filter((other) => other.phase !== stack.phase).sort((one, other) => other.phase - one.phase)
    .flatMap((other) => other.pulls.filter((pull) => pull.state === 'MERGED').slice(-1).map(({ oid }) => oid));
  for (const oid of heads) {
    const cut = lg.mergeBase(ctx.root, oid, bottom);
    if (!lg.isAncestor(ctx.root, cut, into)) return cut;
  }
  return null;
}

/**
 * Whether a pull request's head, `head`, merged into the default branch on
 * GitHub, `into`, gives over `over` what it gives over their merge base, as
 * GitHub's squash reads it, cleanly both ways — so bringing it up over
 * `over` changes nothing that lands.
 * @param {LandingContext} ctx @param {string} into @param {string} head @param {string} over
 */
function landsAlike(ctx, into, head, over) {
  const read = lg.mergeTree(ctx.root, over, into, head);
  const natural = lg.mergeTree(ctx.root, lg.mergeBase(ctx.root, into, head), into, head);
  return 'tree' in read && 'tree' in natural && read.tree === natural.tree;
}

/**
 * The commit each pull request of a stack is brought up to the default
 * branch on GitHub, `into`, over (`bringUp`), null for their merge base: a
 * task changed after its landing, over its tip at that landing
 * (task-landed.cjs, `landedTip`), so GitHub's squash lands just its change
 * since, what it takes back of its own work among it (R29) — or, its branch
 * holding that landing, over its merge base with `into` all the same, so
 * the pull requests below it hold the default branch its change was laid
 * on (`laidOnTip`); else the bottom, where the phase it is built
 * on was squashed (`squashedBelow`), over that phase's head (S3).
 * @param {LandingContext} ctx @param {Map<number, Stack>} stacks @param {Stack} stack @param {string} into
 * @returns {(string|null)[]}
 */
function broughtOver(ctx, stacks, stack, into) {
  const read = ctx.landedOn(into);
  const below = squashedBelow(ctx, stacks, stack, into);
  return stack.pulls.map((pull, i) => {
    if (read.stands(pull.ref) === 'changed') return read.landedTip(pull.ref) ?? lg.mergeBase(ctx.root, into, pull.oid);
    return i === 0 ? below : null;
  });
}

/**
 * A stack's branches brought up to date before GitHub squashes it, where a
 * pull request's change is read over another commit than its merge base
 * (`broughtOver`) — a task's tip at its landing, where it changed after,
 * or the head of the phase below that was squashed — so GitHub's squash,
 * reading it over the default branch, lands just that change, keeping what
 * it takes back (R29, S3) — against the default branch on GitHub as
 * `fetched` found it: each pull request's head it pushed. A default branch
 * not fetched leaves the stack as it is, GitHub's to refuse.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack @param {{commit: string}|{failed: string}} fetched
 * @returns {Pushed}
 */
function broughtUpFirst(ctx, host, stacks, stack, fetched) {
  if ('failed' in fetched) return [];
  const bases = broughtOver(ctx, stacks, stack, fetched.commit);
  return bases.every((base) => base === null) ? [] : bringUp(ctx, host, stack, fetched.commit, bases);
}

/**
 * A stack brought up to date with the default branch on GitHub, `into`:
 * merged into the bottom branch, then each branch into the one above —
 * each over its commit of `bases`, else their merge base (`broughtOver`),
 * a branch whose head already merges that commit in left as it is, so landing
 * again pushes nothing anew — refused, before anything is pushed, where a
 * merge conflicts in a file: its way on, where a pull request of it is
 * read over another commit its branches
 * hold, the stack's own commits past the lowest such rebased onto the
 * default branch and pushed, as a merge of that branch into it would bring
 * back what it took back (R29, S3), else that merge.
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack @param {string} into @param {(string|null)[]} bases
 * @returns {Pushed}
 */
function bringUp(ctx, host, stack, into, bases) {
  const signed = lg.signs(ctx.root);
  const theirs = `${host.remote}/${ctx.into}`;
  let below = { commit: into, name: ctx.into };
  const made = stack.pulls.flatMap((pull, i) => {
    if (lg.mergeOf(ctx.root, pull.oid, below.commit)) {
      below = { commit: pull.oid, name: pull.head };
      return [];
    }
    const merged = lg.mergeTree(ctx.root, bases[i] ?? lg.mergeBase(ctx.root, below.commit, pull.oid), pull.oid, below.commit);
    if ('conflicts' in merged) {
      const top = stack.pulls[stack.pulls.length - 1].oid;
      const rebasedFrom = bases.find((over) => over !== null && lg.isAncestor(ctx.root, over, top)) ?? null;
      throw new Error(`land: ${pull.head} conflicts with ${theirs} at ${merged.conflicts.map(lg.plain).join(', ')}, so ${pushedSaid(host, stack)} — `
        + `${rebasedFrom === null ? `merge ${theirs} into ${pull.head}, settling the conflict, push it,` : rebasedOnto(host, stack, theirs, rebasedFrom)} and land again`);
    }
    const message = `chore(${ctx.unit}): merge ${below.name} into ${pull.head}\n`;
    const commit = lg.commitTree(ctx.root, { tree: merged.tree, parent: [pull.oid, below.commit], message, signed }, `the merge of ${below.name} into ${pull.head}`, 'land again');
    below = { commit, name: pull.head };
    return [{ pull, commit }];
  });
  return made.length === 0 ? [] : pushUp(ctx, host, made, `phase ${stack.phase}'s branches were not brought up to date with ${ctx.into}`);
}

/**
 * The way on of a stack built on a squashed phase that conflicts with the
 * default branch on GitHub, `theirs` (`bringUp`): its own commits, those
 * past `squashed`, rebased onto it, settling the conflict, its branches
 * moved with them, then pushed — so its change keeps what it undid of the
 * phase below.
 * @param {Host} host @param {Stack} stack @param {string} theirs @param {string} squashed
 */
function rebasedOnto(host, stack, theirs, squashed) {
  const heads = stack.pulls.map(({ head }) => head);
  const all = heads.length > 1 ? ' --update-refs' : '';
  return `rebase phase ${stack.phase}'s own commits onto ${theirs}, settling the conflict, with \`git rebase --onto ${theirs} ${lg.short(squashed)} ${heads[heads.length - 1]}${all}\`, push ${heads.length > 1 ? 'its branches' : 'it'} with \`git push --force-with-lease ${host.remote} ${heads.join(' ')}\`,`;
}

/**
 * Each pull request's head moved to its new commit: refused, before
 * anything is pushed, where its branch here is checked out and cannot move;
 * then all pushed at once, and each branch here moved.
 * @param {LandingContext} ctx @param {Host} host @param {Pushed} made @param {string} then what did not happen, where the push fails
 * @returns {Pushed}
 */
function pushUp(ctx, host, made, then) {
  refuseBlocked(ctx, made.map(({ pull, commit }) => ({ branch: pull.head, from: pull.oid, to: commit })));
  lg.pushBranches(ctx.root, host.remote, made.map(({ pull, commit }) => ({ branch: pull.head, commit })), `${then} and nothing merged — clear what git names, and land again`);
  const here = lg.branches(ctx.root);
  for (const { pull, commit } of made) if (here.has(pull.head)) lg.moveBranch(ctx.root, pull.head, pull.oid, commit);
  return made;
}

/**
 * What a merge is, as its refusals name it: what was not merged, a pull
 * request of it, and a list of them, as they are named, and what follows
 * settling a conflict before landing again.
 * @template {BranchPull} P
 * @typedef {{what: string, named: (pull: P) => string, listed: (pulls: P[]) => string, then: string}} Merging
 */

/** A phase's stack's merge, as its refusals name it. @param {Stack} stack @returns {Merging<Pull>} */
const stackMerging = (stack) => ({
  what: `phase ${stack.phase}'s stack`,
  named: (pull) => `task ${shownTask(pull.ref)}'s pull request #${pull.number}`,
  listed: pullsNamed,
  then: 'push it, ',
});

/**
 * Whether GitHub has worked out that a pull request can merge, as it
 * stands at `head`: false while it is still working it out, or its answer
 * is of another head; refused where it conflicts with its base.
 * @template {BranchPull} P
 * @param {LandingContext} ctx @param {Host} host @param {Merging<P>} merging @param {P} pull @param {string} head
 */
function canMerge(ctx, host, merging, pull, head) {
  /** @type {{mergeable?: string|null, headRefOid: string, baseRefName: string}} */
  const read = JSON.parse(ghAt(ctx, host, ['pr', 'view', String(pull.number), '--json', MERGEABLE_FIELDS], `read whether pull request #${pull.number} can merge`));
  if (read.headRefOid !== head) return false;
  if (read.mergeable === 'MERGEABLE') return true;
  if (read.mergeable !== 'CONFLICTING') return false;
  throw new Error(`land: ${merging.named(pull)} conflicts with ${read.baseRefName} on GitHub, so ${merging.what} was not merged — `
    + `merge ${host.remote}/${read.baseRefName} into ${pull.head}, settling the conflict, ${merging.then}and land again`);
}

/**
 * Wait, before a merge, until GitHub has worked out whether each of its
 * pull requests can merge as it stands at its head in `heads`, else as
 * read, read again after each pause (`CHECK_PAUSES_MS`); refused where one
 * conflicts, or GitHub has not worked one out by the last read.
 * @template {BranchPull} P
 * @param {LandingContext} ctx @param {Host} host @param {Merging<P>} merging @param {P[]} pulls @param {Map<number, string>} heads
 */
function awaitMergeable(ctx, host, merging, pulls, heads) {
  let unchecked = pulls;
  for (const pause of [...CHECK_PAUSES_MS, null]) {
    unchecked = unchecked.filter((pull) => !canMerge(ctx, host, merging, pull, heads.get(pull.number) ?? pull.oid));
    if (unchecked.length === 0) return;
    if (pause !== null) sleepSync(checkPauseMs(pause));
  }
  throw new Error(`land: GitHub has not finished checking whether ${merging.listed(unchecked)} can merge, so ${merging.what} was not merged — land again in a moment`);
}

/**
 * A stack readied to merge — refused, before any of it merges or opens,
 * where a pull request of it was closed by hand, it is built on a phase not
 * merged, a task's branch here moved on from its pull request's head
 * (`catchUpBranches`), or the default branch here is checked out with
 * changes in the way (`refuseDirtyDefault`): the default branch on GitHub
 * as fetched.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function readyStack(ctx, host, stacks, stack) {
  refuseClosed(ctx, stack);
  const below = builtOn(ctx, stacks, stack.phase, stack.pulls[0].oid);
  if (below !== undefined) {
    throw new Error(`land: phase ${stack.phase} stacks on phase ${below.phase}, which has not merged — merge it first with \`land phase ${ctx.unit} ${below.phase}\`, then land again`);
  }
  catchUpBranches(ctx, host, stack);
  const fetched = defaultFetched(ctx, host);
  const over = () => ('failed' in fetched ? null : broughtOver(ctx, stacks, stack, fetched.commit).find((base) => base !== null) ?? null);
  refuseDirtyDefault(ctx, stack.pulls[stack.pulls.length - 1].oid, fetched, over);
  return fetched;
}

/**
 * Merge a stack whole into the default branch, every pull request squashed
 * (`squashStack`): readied (`readyStack`), linked first, so a pull request
 * chained late is in it — a lone one based on the default branch first,
 * where it stood on another phase's task — and brought up to date first
 * where it must be (`broughtUpFirst`).
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function mergeStack(ctx, host, stacks, stack) {
  const fetched = readyStack(ctx, host, stacks, stack);
  const [lone, ...more] = stack.pulls;
  if (more.length > 0) {
    refuseSquashDefault(ctx, host, stack);
    link(ctx, host, stack);
  } else if (lone.base !== ctx.into) {
    ghAt(ctx, host, ['pr', 'edit', String(lone.number), '--base', ctx.into], `base pull request #${lone.number} on ${ctx.into}`);
  }
  return squashStack(ctx, host, stack, broughtUpFirst(ctx, host, stacks, stack, fetched));
}

/**
 * A stack readied squashed into the default branch: merged by the
 * extension, a lone one merged alone under the subject and body a squash
 * makes, once GitHub has worked out that it can at the heads `pushed` moved
 * it to, else as read (`awaitMergeable`). The default branch here is then
 * brought to the merge, and each of the pull requests read as merged, for
 * the reads after it that the call keeps (`readOnce`).
 * @param {LandingContext} ctx @param {Host} host @param {Stack} stack @param {Pushed} pushed
 */
function squashStack(ctx, host, stack, pushed) {
  const [lone, ...more] = stack.pulls;
  const merging = `merge phase ${stack.phase}'s stack`;
  awaitMergeable(ctx, host, stackMerging(stack), stack.pulls, new Map(pushed.map(({ pull, commit }) => [pull.number, commit])));
  if (more.length > 0) ghAt(ctx, host, ['stack', 'merge', String(stack.pulls[stack.pulls.length - 1].number), '--yes', '--squash'], merging);
  else ghAt(ctx, host, ['pr', 'merge', String(lone.number), '--squash', '--subject', `${lone.title} (#${lone.number})`, '--body', lone.body], merging);
  for (const pull of stack.pulls) pull.state = 'MERGED';
  const { stack: tasks, pull_requests } = answered(stack);
  const warnings = bringDefaultUp(ctx, host, true);
  return { into: ctx.into, merged: tasks, pull_requests, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * The tip of the default branch on GitHub, as fetched (`defaultFetched`) —
 * else here, where it cannot be fetched, the merge then GitHub's to refuse.
 * @param {LandingContext} ctx @param {Host} host
 */
function tipOnGithub(ctx, host) {
  const fetched = defaultFetched(ctx, host);
  return 'failed' in fetched ? /** @type {string} */ (lg.branches(ctx.root).get(ctx.into)) : fetched.commit;
}

/**
 * The head a merged task's pull request opens again from, and the lease
 * it is pushed to GitHub on, where it is: its branch as GitHub holds it,
 * where the branch here is that, gone, or behind it with its task not
 * landed — else the branch here, pushed over GitHub's where GitHub holds
 * none, the branch here moved on past it, or moved off a head that has
 * landed — its task read landed, that head its last commit (task-landed.cjs,
 * `landedAs`) — so a push over it loses nothing (7.2.23). Refused where
 * GitHub's holds work the branch here lacks after the task's landing, the
 * way on to pull GitHub's first (`pullFirst`), and where it is gone here and on
 * GitHub, naming the commit its pull request merged, to make it again at.
 * @param {LandingContext} ctx @param {Host} host @param {Pull} merged
 * @returns {{oid: string, lease: string|null}}
 */
function headAgain(ctx, host, merged) {
  const { root } = ctx;
  const fetched = lg.fetchBranch(root, host.remote, merged.head);
  const here = lg.branches(root).get(merged.head);
  const read = () => ctx.landedOn(tipOnGithub(ctx, host));
  const takesFetched = (/** @type {string} */ commit) => here === undefined || here === commit || (lg.isAncestor(root, here, commit) && read().stands(merged.ref) === 'unlanded');
  if ('commit' in fetched && takesFetched(fetched.commit)) return { oid: fetched.commit, lease: null };
  const shown = shownTask(merged.ref);
  if (here === undefined) {
    throw new Error(`land: task ${shown}'s pull request #${merged.number} was merged into ${merged.base}, whose change never reached ${ctx.into}, and its branch ${merged.head} is gone here and on GitHub — `
      + `make it again at ${lg.short(merged.oid)} with \`git branch ${merged.head} ${lg.short(merged.oid)}\`, and land again`);
  }
  if ('failed' in fetched) return { oid: here, lease: '' };
  if (!lg.isAncestor(root, fetched.commit, here) && !read().landedAs(merged.ref, fetched.commit)) {
    throw new Error(`land: task ${shown}'s branch ${merged.head} has moved here and on GitHub since its pull request #${merged.number} merged, to ${lg.short(here)} and ${lg.short(fetched.commit)} — `
      + `${pullFirst(host, merged.head)}, and land again`);
  }
  return { oid: here, lease: fetched.commit };
}

/**
 * Refuse, before it opens, a task's pull request whose change would
 * conflict in a file with the default branch on GitHub, as `fetched` found
 * it — read over its tip at its landing where it changed after, as it is
 * brought up (`broughtOver`), else over their merge base, as GitHub's
 * squash reads it — naming the paths and the way on: for one read over its
 * tip at its landing, its commits since rebased onto the default branch on
 * GitHub and pushed (`lg.rebasedSince`); for one changed since brought onto
 * it, its commits past their merge base rebased onto it and pushed, as a
 * merge of the default branch into a landed task's branch is refused
 * (`lg.rebasedPast`); else that branch merged in; one whose default branch
 * was not fetched is GitHub's to refuse.
 * @param {LandingContext} ctx @param {Host} host @param {Pull} pull @param {{commit: string}|{failed: string}} fetched
 */
function refuseConflicting(ctx, host, pull, fetched) {
  if ('failed' in fetched) return;
  const read = ctx.landedOn(fetched.commit);
  const landedAt = read.landedTip(pull.ref);
  const base = landedAt ?? lg.mergeBase(ctx.root, fetched.commit, pull.oid);
  const merged = lg.mergeTree(ctx.root, base, fetched.commit, pull.oid);
  if (!('conflicts' in merged)) return;
  const theirs = `${host.remote}/${ctx.into}`;
  const pushed = `push it with \`git push --force-with-lease ${host.remote} ${pull.head}\`,`;
  const wayOn = landedAt !== null ? `${lg.rebasedSince(pull.head, theirs, landedAt)}, ${pushed}`
    : read.stands(pull.ref) === 'changed' ? `${lg.rebasedPast(pull.head, theirs, base)}, ${pushed}`
      : `merge ${theirs} into ${pull.head}, settling the conflict,`;
  throw new Error(`land: task ${shownTask(pull.ref)}'s change conflicts with ${theirs} at ${merged.conflicts.map(lg.plain).join(', ')}, so its pull request was not opened again and nothing merged — `
    + `${wayOn} and land again`);
}

/**
 * A task's change landed again through a pull request opened again onto
 * the default branch: one merged by hand whose change never reached it —
 * merged into a branch that never reached it, or the task changed after it
 * merged. It opens under the title and body of the message the seam gives
 * it (the context's `message`), as `open` titles one, from its branch as
 * `headAgain` leaves it on GitHub, anything merged into that since landing
 * with it, and merges as a lone one does (`squashStack`) — refused where
 * that branch holds another task's work not landed (the context's
 * `refuseHeld`), readied (`readyStack`), its change's conflict read
 * (`refuseConflicting`), its branch pushed and brought up to date where it
 * must be (`broughtUpFirst`) before it opens; GitHub's own refusals —
 * whether it can merge, worked out once it is open (`awaitMergeable`), and
 * the merge itself — leave it open, for the next `land phase` to merge as
 * an open one.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {number} phase @param {Pull} merged
 */
function landedAgain(ctx, host, stacks, phase, merged) {
  const { oid, lease } = headAgain(ctx, host, merged);
  ctx.refuseHeld({ ref: merged.ref, branch: merged.head }, oid, tipOnGithub(ctx, host));
  const [title, ...body] = ctx.message(merged.ref).split('\n');
  /** @type {Pull} */
  const pull = { ...merged, state: 'OPEN', base: ctx.into, oid, title, body: body.join('\n').trim() };
  const again = { phase, pulls: [pull] };
  const all = new Map([...stacks, [phase, again]]);
  const fetched = readyStack(ctx, host, all, again);
  refuseConflicting(ctx, host, pull, fetched);
  const shown = shownTask(merged.ref);
  if (lease !== null) lg.pushBranches(ctx.root, host.remote, [{ branch: merged.head, commit: oid, lease }], `task ${shown}'s pull request was not opened again — clear what git names, and land again`);
  const pushed = broughtUpFirst(ctx, host, all, again, fetched);
  const url = ghAt(ctx, host, ['pr', 'create', '--base', ctx.into, '--head', merged.head, '--title', pull.title, '--body', pull.body], `open task ${shown}'s pull request again`);
  const opened = { ...pull, number: Number(/\/pull\/(\d+)\s*$/.exec(url)?.[1]) };
  return squashStack(ctx, host, { phase, pulls: [opened] }, pushed.map(({ commit }) => ({ pull: opened, commit })));
}

/**
 * Finish a stack merged in part by hand (the header's): each of its pull
 * requests not landed, bottom first, merged alone into the default branch —
 * one open based on another's branch retargeted onto it first, its change
 * read over the head of the one below it where the default branch holds
 * that one's change but not its commits and that reads otherwise than its
 * merge base (`squashedBelow`), one merged whose
 * task's change never reached it landed again (`landedAgain`) — as a lone
 * pull request merges (`mergeStack`), the default branch read afresh after
 * each.
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function finishStack(ctx, host, stacks, stack) {
  refuseClosed(ctx, stack);
  /** @type {Record<string, any>[]} */
  const merges = [];
  for (const [at, pull] of stack.pulls.entries()) {
    if (landedPull(ctx, pull, () => tipOnGithub(ctx, host))) continue;
    const lone = { phase: stack.phase, pulls: [pull], ...(at === 0 ? {} : { under: stack.pulls[at - 1].oid }) };
    merges.push(pull.state === 'OPEN' ? mergeStack(ctx, host, new Map([...stacks, [stack.phase, lone]]), lone) : landedAgain(ctx, host, stacks, stack.phase, pull));
  }
  const warnings = [...new Set(merges.flatMap((merged) => merged.warnings ?? []))];
  return {
    into: ctx.into,
    merged: merges.flatMap((merged) => merged.merged),
    pull_requests: merges.flatMap((merged) => merged.pull_requests),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/**
 * A stack's merge, each open pull request whose task landed outside it
 * closed first (`closeLanded`): whole where none of it is merged or closed
 * yet, else finished (`finishStack`).
 * @param {LandingContext} ctx @param {Host} host @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function landStack(ctx, host, stacks, stack) {
  refuseAfterLanding(ctx, host, stack);
  closeLanded(ctx, host, stack, () => tipOnGithub(ctx, host));
  return (stack.pulls.some((pull) => pull.state !== 'OPEN') ? finishStack : mergeStack)(ctx, host, stacks, stack);
}

/**
 * Merge a phase whole into the default branch — null where no task of it
 * is open here, and `already` where each of its pull requests has landed
 * (`landedPull`), the default branch here brought to it all the same; one
 * merged in part by hand finished.
 * @param {LandingContext} ctx @param {number} phase
 */
function mergePhase(ctx, phase) {
  const host = hostOf(ctx);
  const stacks = stacksOf(pullsRead(ctx, host));
  const stack = stacks.get(phase);
  if (stack === undefined) return null;
  refuseClosed(ctx, stack);
  refuseAfterLanding(ctx, host, stack);
  closeLanded(ctx, host, stack, () => tipOnGithub(ctx, host));
  if (stackLanded(ctx, stack, () => tipOnGithub(ctx, host))) {
    const warnings = bringDefaultUp(ctx, host, false);
    return { into: ctx.into, already: true, ...(warnings.length > 0 ? { warnings } : {}) };
  }
  return landStack(ctx, host, stacks, stack);
}

/**
 * The merge finish makes next: the lowest phase not landed that stacks on
 * no phase not landed, else the lowest not landed — null where every one
 * is.
 * @param {LandingContext} ctx
 */
function nextMerge(ctx) {
  const host = hostOf(ctx);
  const stacks = stacksOf(pullsRead(ctx, host));
  const byPhase = [...stacks.values()].sort((a, b) => a.phase - b.phase);
  const landed = byPhase.filter((stack) => stackLanded(ctx, stack, () => tipOnGithub(ctx, host)));
  for (const stack of landed) refuseAfterLanding(ctx, host, stack);
  const unmerged = byPhase.filter((stack) => !landed.includes(stack));
  const next = unmerged.find((stack) => builtOn(ctx, stacks, stack.phase, stack.pulls[0].oid) === undefined) ?? unmerged[0];
  return next === undefined ? null : { phase: next.phase, merge: () => landStack(ctx, host, stacks, next) };
}

/** The quick-fix's landing as the seam gives it (landing.cjs). @typedef {import('../../../domain/landing.cjs').QuickFixTask} QuickFixTask */
/** The quick-fix's pull request as the seam reads it (landing.cjs). @typedef {import('../../../domain/landing.cjs').QuickFixPull} QuickFixPull */
/** What a close answers, and what it tells of each pull request it closes (drivers.cjs). @typedef {import('../../../domain/drivers.cjs').PullsClosed} PullsClosed @typedef {import('../../../domain/drivers.cjs').Closing} Closing */

/** What a quick-fix's pull requests are read with beside a phase's: whether each is a fork's, and when it was opened. */
const QUICK_FIX_FIELDS = `${PULL_FIELDS},isCrossRepository,createdAt`;

/**
 * The pull requests whose head is the quick-fix's branch, onto the default
 * branch, as GitHub holds them, latest first: those opened from the
 * repository itself, never a fork, at or after the time `since` names,
 * where it names one, and none the unit's cancel closed that stays
 * closed (`cancelledShut`).
 * @param {LandingContext} ctx @param {Host} host @param {string} branch @param {string|null} since
 * @returns {BranchPull[]}
 */
function listedPulls(ctx, host, branch, since) {
  /** @type {{number: number, state: Pull['state'], headRefName: string, baseRefName: string, headRefOid: string, title: string, body: string, isCrossRepository: boolean, createdAt: string}[]} */
  const listed = JSON.parse(ghAt(ctx, host, ['pr', 'list', '--state', 'all', '--head', branch, '--limit', PULL_LIMIT, '--json', QUICK_FIX_FIELDS], `read ${branch}'s pull requests`));
  const from = since === null ? -Infinity : Date.parse(since);
  return listed.filter((pr) => pr.headRefName === branch && pr.baseRefName === ctx.into && !pr.isCrossRepository && Date.parse(pr.createdAt) >= from && !cancelledShut(ctx, pr))
    .map((pr) => ({ number: pr.number, state: pr.state, head: pr.headRefName, base: pr.baseRefName, oid: pr.headRefOid, title: pr.title, body: pr.body }))
    .sort((a, b) => b.number - a.number);
}

/**
 * The quick-fix's pull request as this driver reads it: the seam's read,
 * carrying the open one, where one is, which the seam hands back to the
 * verbs that act on it, so a verb reads GitHub's pull requests once.
 * @typedef {QuickFixPull & {opened: BranchPull|null}} PullRead
 */

/**
 * The quick-fix's pull request as GitHub holds it (see the header): the
 * open one's head and those merged into the default branch, each fetched
 * from the pull request's own ref where the repository here lacks it; the
 * branch on GitHub, fetched, null where GitHub has none; where the latest
 * was closed by hand, its reopening; and the open one whole — of those
 * `listedPulls` reads since `since`.
 * @param {LandingContext} ctx @param {string} branch @param {string|null} since
 * @returns {PullRead}
 */
function quickFixPull(ctx, branch, since) {
  const host = hostOf(ctx);
  const pulls = listedPulls(ctx, host, branch, since);
  const [latest] = pulls;
  const held = (/** @type {BranchPull} */ pull) => lg.fetchedCommit(ctx.root, host.remote, `refs/pull/${pull.number}/head`, pull.oid);
  const open = pulls.find((pull) => pull.state === 'OPEN');
  const fetched = lg.fetchBranch(ctx.root, host.remote, branch);
  return {
    open: open !== undefined && held(open) ? open.oid : null,
    merged: pulls.filter((pull) => pull.state === 'MERGED' && held(pull)).map((pull) => pull.oid),
    head: 'commit' in fetched ? fetched.commit : null,
    closed: latest?.state === 'CLOSED' ? `${ctx.unit}'s pull request #${latest.number} was closed on GitHub without being merged — reopen it there, as \`gh pr reopen ${latest.number}\` does, and land again` : null,
    opened: open ?? null,
  };
}

/** The open pull request a read of this driver's carries (`quickFixPull`). @param {QuickFixPull} pull */
const openedIn = (pull) => /** @type {PullRead} */ (pull).opened;

/** The title and body a quick-fix's landing makes its pull request's. @param {QuickFixTask} landing */
function titled(landing) {
  const [title, ...body] = landing.message.split('\n');
  return { title, body: body.join('\n').trim() };
}

/**
 * The quick-fix's pull request opened, or kept as its landing stands (see
 * the header), from the open one the landing read: its branch pushed while
 * GitHub's copy stands where the landing read it, then the pull request
 * opened onto the default branch, or its title and body made the
 * landing's — `already` where its head, title and body are.
 * @param {LandingContext} ctx @param {QuickFixTask} landing
 * @returns {{pull_request: number, already?: true}}
 */
function openQuickFix(ctx, landing) {
  const host = hostOf(ctx);
  const { branch, pull: { head } } = landing;
  const { title, body } = titled(landing);
  const at = lg.branches(ctx.root).get(branch);
  const open = openedIn(landing.pull);
  if (open !== null && open.oid === at && open.title === title && open.body === body) return { pull_request: open.number, already: true };
  if (head !== at) {
    lg.pushBranches(ctx.root, host.remote, [{ branch, commit: `refs/heads/${branch}`, lease: head ?? '' }], `${ctx.unit}'s pull request was not opened — clear what git names, and open it again`);
  }
  if (open === null) {
    const url = ghAt(ctx, host, ['pr', 'create', '--base', ctx.into, '--head', branch, '--title', title, '--body', body], `open ${ctx.unit}'s pull request`);
    return { pull_request: Number(/\/pull\/(\d+)\s*$/.exec(url)?.[1]) };
  }
  if (open.title !== title || open.body !== body) ghAt(ctx, host, ['pr', 'edit', String(open.number), '--title', title, '--body', body], `give ${ctx.unit}'s pull request its landing's title and body`);
  return { pull_request: open.number };
}

/**
 * Pull requests closed unmerged on GitHub, as a move or a cancel closes
 * them, each number told to `closed` as it closes: whether any was.
 * @param {LandingContext} ctx @param {number[]} numbers @param {Closing} closed
 * @returns {PullsClosed}
 */
function closedPulls(ctx, numbers, closed) {
  if (numbers.length === 0) return { closed: false };
  const host = hostOf(ctx);
  for (const number of numbers) {
    ghAt(ctx, host, ['pr', 'close', String(number)], `close ${ctx.unit}'s pull request #${number}`);
    closed(String(number));
  }
  return { closed: true };
}

/**
 * The quick-fix's pull request closed unmerged for its move or its cancel
 * (see the header), where the read `pull` found one open: whether this
 * call closed one, its number told to `closed`.
 * @param {LandingContext} ctx @param {QuickFixPull} pull @param {Closing} closed
 * @returns {PullsClosed}
 */
function closeQuickFix(ctx, pull, closed) {
  const open = openedIn(pull);
  return closedPulls(ctx, open === null ? [] : [open.number], closed);
}

/**
 * The quick-fix's pull request merged (see the header), the one its
 * opening answered (`openQuickFix`), every commit of it squashed into one
 * under its title and body; with nothing to land, the default branch here
 * brought up alone.
 * @param {LandingContext} ctx @param {QuickFixTask|null} landing @param {{pull_request: number}} [opened] what `openQuickFix` answered for the landing, given with every one
 */
function mergeQuickFix(ctx, landing, opened) {
  const host = hostOf(ctx);
  if (landing === null) {
    const warnings = bringDefaultUp(ctx, host, false);
    return { into: ctx.into, already: /** @type {const} */ (true), ...(warnings.length > 0 ? { warnings } : {}) };
  }
  const number = /** @type {{pull_request: number}} */ (opened).pull_request;
  const head = /** @type {string} */ (lg.branches(ctx.root).get(landing.branch));
  refuseDirtyDefault(ctx, head, defaultFetched(ctx, host));
  const { title, body } = titled(landing);
  const pull = { number, state: /** @type {const} */ ('OPEN'), head: landing.branch, base: ctx.into, oid: head, title, body };
  const merging = { what: `${ctx.unit}'s pull request`, named: () => `${ctx.unit}'s pull request #${number}`, listed: () => `#${number}`, then: '' };
  awaitMergeable(ctx, host, merging, [pull], new Map([[number, head]]));
  ghAt(ctx, host, ['pr', 'merge', String(number), '--squash', '--subject', `${title} (#${number})`, '--body', body], `merge ${ctx.unit}'s pull request`);
  const warnings = bringDefaultUp(ctx, host, true);
  return { into: ctx.into, merged: landing.tasks, pull_requests: [number], ...(warnings.length > 0 ? { warnings } : {}) };
}

/** A unit's own pull request as the seam reads it (landing.cjs). @typedef {import('../../../domain/landing.cjs').UnitPull} UnitPull */
/** A unit's own branch to land, as the seam gives it (landing.cjs). @typedef {import('../../../domain/landing.cjs').UnitLanding} UnitLanding */
/** The unit's own pull request as this driver reads it (`unitPull`): the seam's read, carrying the open one whole, which the seam hands back with the landing. @typedef {UnitPull & {opened: BranchPull|null}} UnitRead */

/** Whether a repository, as GitHub's API reads it, takes a merge commit. @param {string} read */
function takesMerges(read) {
  /** @type {{allow_merge_commit?: boolean}} */
  const repository = JSON.parse(read);
  return repository.allow_merge_commit !== false;
}

/**
 * The unit's own pull request (see the header): the one open from its
 * branch onto the default branch, of those opened from the repository
 * itself, and, where the repository takes no merge commit, the refusal of
 * its landing, naming the verb that allows them.
 * @param {LandingContext} ctx @param {string} branch
 * @returns {UnitRead}
 */
function unitPull(ctx, branch) {
  const host = hostOf(ctx);
  const opened = listedPulls(ctx, host, branch, null).find((pull) => pull.state === 'OPEN') ?? null;
  const takes = takesMerges(ghAt(ctx, host, ['api', `repos/${host.repo}`], `read whether ${host.repo} takes merge commits`));
  const refused = takes ? null : `${host.repo} does not allow merge commits, and ${branch} lands on ${ctx.into} by one, so it did not land — allow them beside the squash default on every repository the project lands in on GitHub, as \`engine github-squash yes\` does, and land again`;
  return { open: opened?.number ?? null, refused, opened };
}

/**
 * The unit's own pull request, from its branch onto the default branch, as
 * the landing gives it: the one open, given its title and description where
 * it bears others, else one opened so — its number.
 * @param {LandingContext} ctx @param {Host} host @param {UnitLanding} landing @param {BranchPull|null} open
 * @returns {number}
 */
function unitOpened(ctx, host, { branch, title, body }, open) {
  if (open === null) {
    const what = `open ${ctx.unit}'s pull request from ${branch}`;
    return Number(/\/pull\/(\d+)\s*$/.exec(ghAt(ctx, host, ['pr', 'create', '--base', ctx.into, '--head', branch, '--title', title, '--body', body], what))?.[1]);
  }
  if (open.title !== title || open.body !== body) ghAt(ctx, host, ['pr', 'edit', String(open.number), '--title', title, '--body', body], `give ${ctx.unit}'s pull request its landing's title and body`);
  return open.number;
}

/**
 * The unit's own pull request opened as its review phase begins (see the
 * header), where none is open from its branch: its number, and whether
 * this call opened it.
 * @param {LandingContext} ctx @param {UnitLanding} landing
 */
function openUnit(ctx, landing) {
  const host = hostOf(ctx);
  const open = listedPulls(ctx, host, landing.branch, null).find((pull) => pull.state === 'OPEN') ?? null;
  return { into: ctx.into, pull_request: unitOpened(ctx, host, landing, open), ...(open === null ? { opened: /** @type {const} */ (true) } : {}) };
}

/**
 * The unit's own branch landed on the default branch (see the header):
 * through the pull request open from it, else one opened, titled and
 * described as the landing gives (`unitOpened`), merged by a merge commit
 * under its subject with GitHub's " (#N)" and its description, once GitHub
 * has worked out that it can at the branch's tip as the landing read it;
 * the default branch here then brought to it. Refused, before anything
 * opens, where the default branch here is checked out with changes in the
 * way; a repository taking no merge commit is refused before any landing
 * is made (landing.cjs, `unitSteps`). Given no landing, the default branch
 * here is brought up alone.
 * @param {LandingContext} ctx @param {UnitLanding|null} landing
 */
function landUnit(ctx, landing) {
  const host = hostOf(ctx);
  if (landing === null) {
    const warnings = bringDefaultUp(ctx, host, false);
    return { into: ctx.into, already: /** @type {const} */ (true), ...(warnings.length > 0 ? { warnings } : {}) };
  }
  const read = /** @type {UnitRead} */ (landing.pull);
  refuseDirtyDefault(ctx, landing.tip, defaultFetched(ctx, host));
  const { branch, title, body } = landing;
  const number = unitOpened(ctx, host, landing, read.opened);
  const pull = { number, state: /** @type {const} */ ('OPEN'), head: branch, base: ctx.into, oid: landing.tip, title, body };
  const merging = { what: `${ctx.unit}'s pull request`, named: () => `${ctx.unit}'s pull request #${number}`, listed: () => `#${number}`, then: `push ${branch}, ` };
  awaitMergeable(ctx, host, merging, [pull], new Map([[number, landing.tip]]));
  ghAt(ctx, host, ['pr', 'merge', String(number), '--merge', '--subject', `${landing.subject} (#${number})`, '--body', body], `merge ${ctx.unit}'s pull request`);
  const warnings = bringDefaultUp(ctx, host, true);
  return { into: ctx.into, landed: branch, pull_requests: [number], ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * The unit's own pull request closed unmerged for its cancel, where the
 * read given found one open: whether this call closed it, its number told
 * to `closed`.
 * @param {LandingContext} ctx @param {UnitPull|null} pull @param {Closing} closed
 * @returns {PullsClosed}
 */
function closeUnit(ctx, pull, closed) {
  return closedPulls(ctx, pull === null || pull.open === null ? [] : [pull.open], closed);
}

/**
 * Each of the unit's tasks' pull requests open closed unmerged for its
 * cancel (see the header), their branches on GitHub left as they stand:
 * whether this call closed any, each number told to `closed`.
 * @param {LandingContext} ctx @param {Closing} closed
 * @returns {PullsClosed}
 */
function closeTasks(ctx, closed) {
  return closedPulls(ctx, pullsRead(ctx).filter((pull) => pull.state === 'OPEN').map((pull) => pull.number), closed);
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
  return { repository, unset: setOnGithub(root, ['--method', 'POST', `repos/${repository}/rulesets`, '--input', '-'], { input: JSON.stringify(rulesetFor(branch)) }) };
}

/**
 * Make the remote's repository squash a pull request into its title and
 * description (7.2.18), and allow merge commits beside it, which a unit's
 * own branch lands by (7.2.38), left as it is where it does both already:
 * the repository, and why it does not, null where it does.
 * @param {string} root @param {string} url
 */
function setSquashDefault(root, url) {
  const repository = repositoryNamed(url);
  const squash = ['-f', 'squash_merge_commit_title=PR_TITLE', '-f', 'squash_merge_commit_message=PR_BODY', '-F', 'allow_merge_commit=true'];
  const held = { read: [`repos/${repository}`], made: (/** @type {string} */ read) => squashesIntoPull(read) && takesMerges(read) };
  return { repository, unset: setOnGithub(root, ['--method', 'PATCH', `repos/${repository}`, ...squash], { held }) };
}

module.exports = {
  kind: 'landing',
  name: 'github',
  isDefault: false,
  title: 'GitHub\'s driver',
  needs: [
    { tool: 'gh', label: 'GitHub\'s CLI', floor: '2.30.0', update: 'https://cli.github.com', found: ghVersion },
    { tool: 'gh-stack', label: 'GitHub\'s stack extension', floor: '0.1.0', update: 'https://github.com/github/gh-stack', found: stackVersion },
  ],
  serves: (/** @type {string} */ url) => repositoryOf(url) !== null,
  taken,
  pushedOver,
  assertServes: (/** @type {LandingContext} */ ctx) => {
    hostOf(ctx);
  },
  landsOn: fetchedDefault,
  landsOnAsFetched: lastFetchedDefault,
  chainTip,
  holds,
  open,
  chain,
  mergePhase,
  nextMerge,
  quickFixPull,
  openQuickFix,
  mergeQuickFix,
  closeQuickFix,
  unitPull,
  openUnit,
  landUnit,
  closeUnit,
  closeTasks,
  protectBranch,
  setSquashDefault,
  repositoryOf,
};
