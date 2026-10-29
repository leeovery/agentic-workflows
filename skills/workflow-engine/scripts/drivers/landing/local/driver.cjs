'use strict';

// ---------------------------------------------------------------------------
// The local landing driver (7.2.11): the shape GitHub's driver lands, with no
// pull request and no push, for a project with no remote or one on another
// host (22.4.3). A phase's stack is its branch (landing-names.cjs): each task
// opened is squashed onto it as one commit, in the order the tasks are merged
// back; merging the phase moves the default branch to it, so the default
// branch gains one commit per task (7.2.2). A phase's stack is read off git
// each time — the commits its branch holds past the default branch that
// name the phase's tasks, each commit landing every task its message names.
// A commit on a phase's branch that is no task of the phase, or a task of it
// twice, stops every verb that reaches that phase, and no other. All that is
// recorded is where each task's branch stood when it opened, a local ref of
// the task's (`refs/leeway/opened/`), dropped only when its phase lands,
// when its phase's stack begins again without it, or at finish.
//
// - Merged, by one rule (`defaultFrom`): the default branch holds the trailer
//   of every task in question — on it already, or on any commit it gained
//   since the commit they were read from left it, whatever its parent. A
//   phase is merged once it holds every task the phase landed; a phase's
//   branch that landed nothing is no stack at all, its tasks opening afresh.
// - The chain's tip: the last task opened in the phase; for its first, the
//   last task of the latest unmerged phase the task was built on, which the
//   phase then stacks on, as a fix phase does on the one before (7.2.6) —
//   else the default branch. A task is built on another it holds the branch
//   of, or, that branch deleted, a commit of with the tree its stack landed;
//   a branch at the task's own tip counts for nothing but where its task's
//   stack landed it, so a task cut from it with nothing of its own lands
//   nothing. That the task descends from the tip is the seam's to check
//   (landing.cjs); putting a parallel task there is Claude's merge-back
//   (12.7.1), so the driver never rebases.
// - Open: the squash commits the task's tree onto the phase's branch, which
//   is exactly the task's own change while that branch's tree is the chain
//   tip's, and the task holds no other task's work the tip does not and the
//   default branch lacks: neither one landed in another phase's stack, nor
//   one not opened. A task whose commits change nothing past the tip — they
//   change nothing at all, or the tip holds their change already — opens as
//   a commit that changes nothing, which the answer names, and says why.
// - Phase: the default branch fast-forwarded to the phase's branch, its
//   commits first replayed onto the default branch where that moved on since
//   the phase began, as each pull request squash-merges onto it. A phase
//   stacked on another merges once the default branch holds every task of
//   that one, its branch kept or deleted. A task whose branch is not where
//   it opened stops the phase; a phase's commits otherwise land as its
//   branch stands.
// - A submodule's pointer: decided as its repository's phase merges, after
//   the submodule's own (landing.cjs merges children first). A landing
//   moves it where its commit points it other than the commit below it does
//   (`stackMoves`), so a pointer inherited from a phase below is no move of
//   it. Each that moves it is pointed at the submodule's landing of its own
//   task, read off the submodule's default branch by its trailer — or kept
//   as it is where the submodule landed none of its tasks, a pin kept — and
//   each that does not keeps the pointer of the landing below it, the
//   default branch's for the first, so every landing the default branch
//   gains names a commit on the submodule's, or the task's own pin. Git
//   never merges such a pointer: the phase is replayed onto the default
//   branch wherever one changes. It waits for the merge, not the open: until
//   then each landing keeps its task's own tree, which every check above
//   reads, and a submodule's phase replayed onto a default branch that
//   moved on makes commits no open could have named.
// - Finish: every phase not yet merged, each after the one it stacks on.
//
// Every refusal says the way on, its commands fitted to the repository as
// it stands (landing-git.cjs).
// ---------------------------------------------------------------------------

const names = require('../../../domain/landing-names.cjs');
const lg = require('../../../domain/landing-git.cjs');
const { taskId, shownTask, sameTask } = require('../../../domain/task-id.cjs');
const { GitError } = require('../../../kernel/git.cjs');

/** @typedef {import('../../../domain/task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../../../domain/landing.cjs').LandingContext} LandingContext */
/** @typedef {import('../../../domain/landing.cjs').LandingTask} LandingTask */
/** @typedef {import('../../../domain/landing-git.cjs').Pointers} Pointers */

/** A commit as git gives it. @typedef {{sha: string, tree: string, message: string}} Commit */
/** A commit on a phase's branch, and the unit's tasks it lands. @typedef {Commit & {refs: TaskRef[]}} Line */
/** A task landed on its phase's branch, by the commit that lands it. @typedef {Commit & {ref: TaskRef}} Landed */
/**
 * What stops a stack: a commit that is no task of its phase, at the branch's
 * top or below; or a task landed twice, the newer copy first.
 * @typedef {{kind: 'stray', commit: Commit, top: boolean} | {kind: 'twice', ref: TaskRef, upper: Commit, lower: Commit}} Fault
 */
/**
 * A phase's stack: its branch and tip; merged, or its tasks in the order
 * they landed, the unmerged phase it stacks on, if any, the commits of
 * tasks below its own that its line holds, newest first, and what stops it.
 * @typedef {{phase: number, branch: string, tip: string, merged: boolean, tasks: Landed[], stackedOn: number|null, base: Landed[], fault: Fault|null}} Stack
 */
/**
 * A task of the unit a task's branch holds: by its branch's name and tip,
 * or, that branch deleted, by its own and the commit its stack landed.
 * @typedef {{ref: TaskRef, name: string, from: string}} Held
 */
/**
 * Where a task's chain ends, as the seam reads it — the branch, and its
 * commit — with what `open` takes from it: the stack that branch's task
 * landed in, the phases the chain holds, the branches, the stacks, the tasks
 * the task's branch holds, and where the task's phase's branch is, if
 * anywhere.
 * @typedef {{name: string, commit: string, top: Stack|undefined, chain: number[], refs: Map<string, string>, stacks: Map<number, Stack>, held: Held[], phaseAt: string|null}} ChainTip
 */

const OPENED = 'refs/leeway/opened/';

/** A commit as a refusal names it. @param {Commit} commit */
const named = (commit) => `${lg.short(commit.sha)} "${lg.plain(commit.message.split('\n')[0])}"`;

/** Tasks as a refusal names them. @param {TaskRef[]} refs */
const tasksNamed = (refs) => `task${refs.length === 1 ? '' : 's'} ${refs.map(shownTask).join(', ')}`;

/** Where the unit's tasks' opened refs live. @param {string} unit */
const openedUnder = (unit) => `${OPENED}${unit}/`;

/** Where a task's branch stood when it opened, or null where nothing records it — a task landed by hand. @param {LandingContext} ctx @param {TaskRef} ref */
const openedAt = (ctx, ref) => lg.refsUnder(ctx.root, openedUnder(ctx.unit)).get(shownTask(ref)) ?? null;

/**
 * The default branch read off `from`: `lacks`, of tasks, those it lacks —
 * none where `from` is on it already, else those whose trailer no commit it
 * gained since `from` names; `holds`, the one rule for merged (see the
 * header), that it holds every one of them, and nothing is merged that
 * landed none. Each git read is made once, at the first question that needs
 * it — whether `from` is on it, where the caller knows it, never.
 * @param {LandingContext} ctx @param {string} from @param {boolean} [on] whether `from` is on the default branch
 */
function defaultFrom(ctx, from, on) {
  /** @type {Set<string>|undefined} */
  let gained;
  /** @param {TaskRef[]} refs @returns {TaskRef[]} */
  const lacks = (refs) => {
    if (refs.length === 0) return [];
    on ??= lg.isAncestor(ctx.root, from, ctx.into);
    if (on) return [];
    const landed = gained ??= new Set(lg.messagesPast(ctx.root, from, ctx.into).flatMap((message) => names.tasksOfMessage(ctx.unit, message).map(taskId)));
    return refs.filter((ref) => !landed.has(taskId(ref)));
  };
  return { lacks, holds: (/** @type {TaskRef[]} */ refs) => refs.length > 0 && lacks(refs).length === 0 };
}

/** Each task a commit lands, newest first, as a stack holds them. @param {Line} commit @param {TaskRef[]} refs @returns {Landed[]} */
const landings = (commit, refs) => [...refs].reverse().map((ref) => ({ sha: commit.sha, tree: commit.tree, message: commit.message, ref }));

/**
 * A phase's stack read off its branch's first-parent line past the default
 * branch, newest first: its own tasks, down to the first commit of another
 * phase's tasks below one of them, where the tasks it stacks on begin.
 * @param {number} phase @param {string} branch @param {string} tip @param {Line[]} line
 * @returns {Stack}
 */
function stackOf(phase, branch, tip, line) {
  /** @type {Landed[]} */
  const tasks = [];
  /** @type {Fault|null} */
  let fault = null;
  let at = 0;
  for (; at < line.length; at += 1) {
    const commit = line[at];
    const own = commit.refs.filter((ref) => ref.phase === phase);
    if (own.length === 0 && commit.refs.length > 0 && tasks.length > 0) break;
    if (own.length === 0 || own.length < commit.refs.length) {
      fault ??= { kind: 'stray', commit, top: at === 0 };
      continue;
    }
    for (const landed of landings(commit, own)) {
      const twin = tasks.find(({ ref }) => sameTask(ref, landed.ref));
      if (twin !== undefined) fault ??= { kind: 'twice', ref: landed.ref, upper: twin, lower: commit };
      tasks.push(landed);
    }
  }
  const base = line.slice(at).flatMap((commit) => landings(commit, commit.refs));
  return { phase, branch, tip, merged: false, tasks: tasks.reverse(), stackedOn: base[0]?.ref.phase ?? null, base, fault };
}

/**
 * The unit's phase stacks, by phase — a branch that landed nothing left out.
 * @param {LandingContext} ctx @param {Map<string, string>} refs
 * @returns {Map<number, Stack>}
 */
function stacksOf(ctx, refs) {
  const into = /** @type {string} */ (refs.get(ctx.into));
  /** @type {Map<number, Stack>} */
  const stacks = new Map();
  for (const [branch, tip] of refs) {
    const phase = names.phaseOfBranch(ctx.unit, branch);
    if (phase === null) continue;
    const line = lg.firstParentLine(ctx.root, into, tip).map((commit) => ({ ...commit, refs: names.tasksOfMessage(ctx.unit, commit.message) }));
    const onIt = line.length === 0;
    const stack = stackOf(phase, branch, tip, line);
    const landed = onIt ? names.tasksOfMessage(ctx.unit, lg.messageOf(ctx.root, tip)).filter((ref) => ref.phase === phase) : stack.tasks.map(({ ref }) => ref);
    const reading = defaultFrom(ctx, tip, onIt);
    if (reading.holds(landed)) {
      stacks.set(phase, { ...stack, merged: true, tasks: [], stackedOn: null, base: [], fault: null });
    } else if (stack.tasks.length > 0 || stack.fault !== null) {
      const baseMerged = stack.stackedOn !== null && reading.holds(stack.base.map(({ ref }) => ref));
      stacks.set(phase, baseMerged ? { ...stack, stackedOn: null } : stack);
    }
  }
  return stacks;
}

/**
 * The way to take a commit off a stack's branch (landing-git.cjs, `remedy`):
 * at the branch's top, by moving the branch past it; below, by a rebase.
 * @param {LandingContext} ctx @param {Stack} stack @param {Commit} commit @param {string} [then] what follows
 */
function offSteps(ctx, stack, commit, then) {
  const sha = lg.short(commit.sha);
  const how = `take ${sha} off ${stack.branch}`;
  const act = commit.sha === stack.tip ? lg.moveTo(stack.branch, `${sha}^`, how) : lg.rewrite(stack.branch, `--onto ${sha}^ ${sha}`, how);
  return lg.remedy(ctx.root, stack.branch, act, { then });
}

/**
 * Refuse a stack something stops, saying how to clear it. Of a task landed
 * twice, the copy is the one whose tree the task's branch does not have.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {Stack} stack
 */
function refuseFaulty(ctx, refs, stack) {
  const { fault } = stack;
  if (fault === null) return;
  if (fault.kind === 'stray') {
    throw new Error(`land: ${stack.branch} holds ${named(fault.commit)}, which is no task of phase ${stack.phase} — ${offSteps(ctx, stack, fault.commit)}`);
  }
  const branch = branchOf(refs, fault.ref);
  const [own] = branch === null ? [null] : lg.treesOf(ctx.root, [branch]);
  const [copy, landing] = fault.upper.tree === own && fault.lower.tree !== own ? [fault.lower, fault.upper] : [fault.upper, fault.lower];
  throw new Error(
    `land: ${stack.branch} holds task ${shownTask(fault.ref)} twice, ${named(landing)} its landing and ${named(copy)} a copy — ${offSteps(ctx, stack, copy)}`,
  );
}

/**
 * The branch of a task, found by the id its name carries, or null where none
 * is left. Refuses a task with several.
 * @param {Map<string, string>} refs @param {TaskRef} ref
 * @returns {string|null}
 */
function branchOf(refs, ref) {
  const found = [...refs.keys()].filter((branch) => {
    const of = names.taskOfBranch(ref.unit, branch);
    return of !== null && sameTask(of, ref);
  });
  if (found.length > 1) throw new Error(`land: task ${shownTask(ref)} has several branches — ${found.join(', ')}; delete those that are not its own and land again`);
  return found[0] ?? null;
}

/**
 * The branch a task's landing names, from the type and title its message
 * carries, or null where it carries none.
 * @param {Landed} landed
 * @returns {{branch: string, title: string, type: string}|null}
 */
function namedBranch(landed) {
  const landing = names.landingOf(landed.ref, landed.message);
  return landing === null ? null : { ...landing, branch: names.taskBranch(landed.ref, landing.type, landing.title) };
}

/** The phases a stack's chain holds: its own, then the unmerged ones below it. @param {Map<number, Stack>} stacks @param {number} phase @returns {number[]} */
function chainOf(stacks, phase) {
  const below = stacks.get(phase)?.stackedOn ?? null;
  return below === null ? [phase] : [phase, ...chainOf(stacks, below)];
}

/** Whether a stack landed a task. @param {Stack|undefined} stack @param {TaskRef} ref */
const lands = (stack, ref) => stack?.tasks.some((landed) => sameTask(landed.ref, ref)) === true;

/** Whether its phase's stack landed a task. @param {Map<number, Stack>} stacks @param {TaskRef} ref */
const landedIn = (stacks, ref) => lands(stacks.get(ref.phase), ref);

/**
 * The way to make a gone task's branch again, by the name its landing
 * carries: where it stood when it opened, else at `fallback`.
 * @param {LandingContext} ctx @param {Landed} landed @param {() => string} fallback
 */
function remake(ctx, landed, fallback) {
  const at = lg.short(openedAt(ctx, landed.ref) ?? fallback());
  const branch = namedBranch(landed);
  return branch === null
    ? `make task ${shownTask(landed.ref)}'s branch again at ${at}`
    : `make it again with \`git branch ${branch.branch} ${at}\``;
}

/**
 * The refusal of a chain whose last task's branch is gone, naming the
 * branch and where to make it again: where it opened; for a task landed by
 * hand, the commit the opening task holds with the tree that landed, else
 * the landing itself.
 * @param {LandingContext} ctx @param {LandingTask} task @param {Stack} top
 */
function goneRefusal(ctx, task, top) {
  const last = top.tasks[top.tasks.length - 1];
  const at = () => lg.commitWithTree(ctx.root, ctx.into, task.branch, last.tree) ?? last.sha;
  return `land: task ${shownTask(last.ref)}'s branch is gone, and phase ${top.phase}'s chain ends at it — ${remake(ctx, last, at)} and land again`;
}

/**
 * The unit's other tasks a task's branch holds: those whose branch it
 * holds, and, a branch deleted, those whose stack landed them with the tree
 * of a commit it holds. A branch at the task's own tip counts for nothing
 * but where its task's stack landed it.
 * @param {LandingContext} ctx @param {LandingTask} task @param {Map<string, string>} refs @param {Map<number, Stack>} stacks
 * @returns {Held[]}
 */
function heldBy(ctx, task, refs, stacks) {
  const own = /** @type {string} */ (refs.get(task.branch));
  /** @type {Held[]} */
  const held = [...lg.branchesHeldBy(ctx.root, own)].flatMap((name) => {
    const from = /** @type {string} */ (refs.get(name));
    const ref = names.taskOfBranch(ctx.unit, name);
    return ref !== null && (from !== own || landedIn(stacks, ref)) && !sameTask(ref, task.ref) ? [{ ref, name, from }] : [];
  });
  const gone = [...stacks.values()].flatMap((stack) => stack.tasks).filter(({ ref }) => branchOf(refs, ref) === null);
  if (gone.length === 0) return held;
  const trees = lg.treesPast(ctx.root, ctx.into, task.branch);
  for (const { ref, tree, sha } of gone) {
    if (trees.has(tree)) held.push({ ref, name: `task ${shownTask(ref)}`, from: sha });
  }
  return held;
}

/**
 * The chain's tip a task lands on, and what opening it takes (see the
 * header) — null where its phase's stack holds it already. Refuses a task
 * whose phase is merged, one built on a stack something stops, and a chain
 * whose last task's branch is gone.
 * @param {LandingContext} ctx @param {LandingTask} task
 * @returns {ChainTip|null}
 */
function chainTip(ctx, task) {
  const { phase } = task.ref;
  const shown = shownTask(task.ref);
  const refs = lg.branches(ctx.root);
  const stacks = stacksOf(ctx, refs);
  const own = stacks.get(phase);
  if (own?.merged) {
    throw new Error(`land: phase ${phase} is merged into ${ctx.into} — task ${shown} lands in a phase not yet merged, so number it in one`);
  }
  if (own !== undefined) refuseFaulty(ctx, refs, own);
  if (lands(own, task.ref)) return null;
  const held = heldBy(ctx, task, refs, stacks);
  const reached = [...stacks.values()].filter((stack) => stack !== own && held.some(({ ref }) => lands(stack, ref))).sort((a, b) => b.phase - a.phase);
  for (const stack of reached) refuseFaulty(ctx, refs, stack);
  const top = own ?? reached[0];
  const at = { top, refs, stacks, held, phaseAt: refs.get(names.phaseBranch(ctx.unit, phase)) ?? null };
  if (top === undefined) {
    const into = /** @type {string} */ (refs.get(ctx.into));
    return { name: ctx.into, commit: into, chain: [], ...at };
  }
  const lastBranch = branchOf(refs, top.tasks[top.tasks.length - 1].ref);
  if (lastBranch === null) throw new Error(goneRefusal(ctx, task, top));
  return { name: lastBranch, commit: /** @type {string} */ (refs.get(lastBranch)), chain: chainOf(stacks, top.phase), ...at };
}

/**
 * Refuse a task whose branch holds work its chain's tip does not and the
 * default branch lacks: a task landed in a phase's stack off its chain, or
 * one not opened.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip
 */
function refuseStrays(ctx, task, tip) {
  const shown = shownTask(task.ref);
  const under = lg.branchesHeldBy(ctx.root, tip.commit);
  const off = tip.held
    .filter(({ ref, name }) => !under.has(name) && !(landedIn(tip.stacks, ref) && tip.chain.includes(ref.phase)))
    .filter(({ ref, from }) => !defaultFrom(ctx, from).holds([ref]));
  const elsewhere = off.filter(({ ref }) => landedIn(tip.stacks, ref));
  if (elsewhere.length > 0) {
    const merges = [...new Set(elsewhere.map(({ ref }) => ref.phase))].map((phase) => `\`land phase ${ctx.unit} ${phase}\``).join(', then ');
    throw new Error(
      `land: task ${shown}'s branch ${task.branch} holds ${elsewhere.map(({ name }) => name).join(', ')}, landed in a phase's stack off its chain — `
      + `merge that phase first with ${merges}, or cut the branch again from ${tip.name} without it, and land again`,
    );
  }
  const unopened = off.filter(({ ref }) => !landedIn(tip.stacks, ref));
  if (unopened.length > 0) {
    throw new Error(`land: task ${shown}'s branch ${task.branch} holds ${unopened.map(({ name }) => name).join(', ')}, not opened — open ${tasksNamed(unopened.map(({ ref }) => ref))} first`);
  }
}

/**
 * Refuse a task of `tasks` whose branch is not where it was when it opened —
 * moved on, or rewritten — keeping it as it stands, and putting it back.
 * A task nothing records the opening of, landed by hand, is passed over.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {Landed[]} tasks
 */
function refuseMoved(ctx, refs, tasks) {
  const opened = lg.refsUnder(ctx.root, openedUnder(ctx.unit));
  for (const { ref } of tasks) {
    const at = opened.get(shownTask(ref));
    const branch = branchOf(refs, ref);
    if (at === undefined || branch === null || refs.get(branch) === at) continue;
    const now = lg.short(/** @type {string} */ (refs.get(branch)));
    const was = lg.short(at);
    const way = lg.remedy(ctx.root, branch, lg.moveTo(branch, was, `put ${branch} back`), {
      note: (kept) => `the change from ${was} to ${now}, on ${kept}, is a task of its own`,
    });
    throw new Error(`land: task ${shownTask(ref)}'s branch ${branch} has moved since it was opened at ${was}, to ${now} — ${way}`);
  }
}

/**
 * Drop the opened refs of the unit's tasks `which` picks.
 * @param {LandingContext} ctx @param {(phase: number, shown: string) => boolean} which
 */
function forgetOpened(ctx, which) {
  const under = openedUnder(ctx.unit);
  const drop = [...lg.refsUnder(ctx.root, under).keys()].filter((shown) => which(Number(shown.split('.')[0]), shown)).map((shown) => `${under}${shown}`);
  lg.updateRefs(ctx.root, { drop });
}

/**
 * Open a task on the chain's tip the seam checked it descends from, with a
 * commit past it: its change squashed onto its phase's branch, and where its
 * branch stands recorded — the phase's other tasks' records dropped where
 * its stack begins again with this one. A task whose commits change nothing
 * past the tip opens as a commit that changes nothing, which the answer
 * names.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip
 */
function open(ctx, task, tip) {
  const { root } = ctx;
  const shown = shownTask(task.ref);
  refuseStrays(ctx, task, tip);
  const onto = tip.top?.tip ?? tip.commit;
  if (tip.top !== undefined) refuseMoved(ctx, tip.refs, tip.top.tasks.slice(-1));
  const [tree, tipTree, ontoTree] = lg.treesOf(root, [task.branch, tip.commit, onto]);
  if (tip.top !== undefined && ontoTree !== tipTree) {
    const last = tip.top.tasks[tip.top.tasks.length - 1];
    const again = `open task ${shownTask(last.ref)} again`;
    throw new Error(`land: ${tip.top.branch}'s commit for task ${shownTask(last.ref)}, ${named(last)}, has changed since it was opened — ${offSteps(ctx, tip.top, last, again)}`);
  }
  const at = /** @type {string} */ (tip.refs.get(task.branch));
  const { phase } = task.ref;
  const branch = names.phaseBranch(ctx.unit, phase);
  const landing = { tree, parent: onto, message: task.message, signed: lg.signs(root) };
  const commit = lg.commitTree(root, landing, `task ${shown}'s landing on ${branch}`, 'open the task again');
  lg.moveBranch(root, branch, tip.phaseAt, commit);
  if (!tip.stacks.has(phase)) forgetOpened(ctx, (of, other) => of === phase && other !== shown);
  lg.updateRefs(root, { set: [[`${openedUnder(ctx.unit)}${shown}`, at]] });
  if (tree !== tipTree) return { base: tip.name, phase_branch: branch, commit };
  const why = lg.ownChangeEmpty(root, tip.commit, task.branch) ? 'its commits change nothing' : `its change was on ${tip.name} already`;
  return { base: tip.name, phase_branch: branch, commit, landed_empty: [{ task: shown, why }] };
}

/**
 * Chain a task: it is in its phase's stack once opened, so this answers the
 * stack, in the order its tasks were merged back — null where it is not
 * open.
 * @param {LandingContext} ctx @param {TaskRef} ref
 */
function chain(ctx, ref) {
  const { phase } = ref;
  const refs = lg.branches(ctx.root);
  const stack = stacksOf(ctx, refs).get(phase);
  if (stack?.merged) throw new Error(`land: phase ${phase} is merged into ${ctx.into} — its stack is landed`);
  if (stack !== undefined) refuseFaulty(ctx, refs, stack);
  if (stack === undefined || !lands(stack, ref)) return null;
  return { phase_branch: stack.branch, stack: stack.tasks.map((landed) => shownTask(landed.ref)) };
}

/**
 * The refusal of a stack whose base the default branch lacks a task of,
 * the oldest first: wait for the phase that lands it; take it off where its
 * phase merged without it; else open it again, its branch made again first
 * where it is gone.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {Map<number, Stack>} stacks @param {Stack} stack
 * @returns {string}
 */
function waitingOn(ctx, refs, stacks, stack) {
  const missing = new Set(defaultFrom(ctx, stack.tip).lacks(stack.base.map(({ ref }) => ref)).map(taskId));
  const lacking = /** @type {Landed} */ (stack.base.filter(({ ref }) => missing.has(taskId(ref))).pop());
  const { phase } = lacking.ref;
  const shown = shownTask(lacking.ref);
  const below = stacks.get(phase);
  const merge = `\`land phase ${ctx.unit} ${phase}\``;
  if (lands(below, lacking.ref)) {
    return `land: phase ${stack.phase} stacks on phase ${phase}, which has not merged — merge it first with ${merge}, then land again`;
  }
  if (below?.merged) {
    return `land: phase ${stack.phase} is built on task ${shown}, which phase ${phase} merged into ${ctx.into} without — ${offSteps(ctx, stack, lacking)}`;
  }
  const gone = branchOf(refs, lacking.ref) === null ? `${remake(ctx, lacking, () => lacking.sha)}, ` : '';
  return `land: phase ${stack.phase} is built on task ${shown}, which ${ctx.into} does not hold and no branch of phase ${phase} lands — `
    + `${gone}open it again with \`land open ${ctx.unit} ${shown}\`, merge it with ${merge}, and land again`;
}

/** An error's message. @param {unknown} err */
const errorText = (err) => (err instanceof Error ? err.message : String(err));

/** What a failed git call said, as a refusal quotes it. @param {unknown} err */
const gitSaid = (err) => lg.plain(errorText(err));

/** A commit a stack replays, with the tasks it lands. @typedef {{sha: string, message: string, name: string, tasks: string[]}} Replayed */

/**
 * The commits a stack replays, each once, oldest first, with the tasks it
 * lands.
 * @param {Stack} stack
 * @returns {Replayed[]}
 */
function replayed(stack) {
  const shas = [...new Set(stack.tasks.map(({ sha }) => sha))];
  return shas.map((sha) => {
    const landed = stack.tasks.filter((task) => task.sha === sha);
    const refs = landed.map(({ ref }) => ref);
    return { sha, message: landed[0].message, name: tasksNamed(refs), tasks: refs.map(shownTask) };
  });
}

/**
 * The pointers the stack's commits record of each of the repository's
 * submodules (see the header) — null where it holds none — and whether each
 * records its own, so the stack lands as it stands.
 * @param {LandingContext} ctx @param {Replayed[]} commits @param {string} intoTip
 * @returns {(Pointers & {kept: boolean})|null}
 */
function pointersOf(ctx, commits, intoTip) {
  const paths = ctx.gitlinks;
  if (paths.length === 0) return null;
  const subs = new Map(ctx.submodules.map(({ path, ctx: sub }) => [path, { root: sub.root, unit: sub.unit, tip: () => sub.into }]));
  const moves = lg.stackMoves(ctx.root, commits.map(({ sha, tasks }) => ({ sha, parents: [`${sha}^`], tasks })), paths, subs, intoTip);
  const held = lg.pointersAt(ctx.root, commits.map(({ sha }) => sha), paths);
  const kept = moves.every((moved, i) => [...moved].every(([at, sha]) => sha === (held[i].get(at) ?? null)));
  return { paths, moves, kept };
}

/**
 * The stack's commits replayed onto the default branch, as its pull
 * requests squash onto it, each submodule's pointer as `pointers` records
 * it — refused, naming the conflict and the way on, where one of them
 * conflicts there.
 * @param {LandingContext} ctx @param {Stack} stack @param {Replayed[]} commits @param {string} intoTip @param {Pointers|null} pointers
 */
function replayOnto(ctx, stack, commits, intoTip, pointers) {
  const { root, into } = ctx;
  try {
    return lg.replay(root, commits, intoTip, into, pointers ?? undefined);
  } catch (err) {
    if (!(err instanceof lg.Conflict)) throw err;
    const way = lg.remedy(root, stack.branch, lg.rewrite(stack.branch, lg.quoted(into), `bring ${stack.branch} up to date with ${into}`));
    throw new Error(`${err.message}, so nothing moved — ${way}`);
  }
}

/**
 * Merge a stack into the default branch. Where the stack lands as its
 * branch stands — the default branch where it was cut, and every
 * submodule's pointer its own (`pointersOf`) — the default branch
 * fast-forwards to it. Else its commits are replayed onto the default
 * branch, and nothing moves until both branches can: the default branch checked
 * where it is out, then the phase's branch moved to the new commits, then
 * the default branch — the phase's branch put back where that last move
 * fails. A task whose change the default branch held already lands as a
 * commit that changes nothing, which the answer names. The phase's opened
 * refs are dropped once it lands.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function mergeStack(ctx, refs, stacks, stack) {
  const { root, into } = ctx;
  refuseFaulty(ctx, refs, stack);
  if (stack.stackedOn !== null) throw new Error(waitingOn(ctx, refs, stacks, stack));
  const rebased = lg.rebaseBlock(root, stack.branch);
  if (rebased !== null) throw new Error(`land: ${rebased}`);
  refuseMoved(ctx, refs, stack.tasks);
  const intoTip = /** @type {string} */ (refs.get(into));
  const merged = { into, merged: stack.tasks.map((landed) => shownTask(landed.ref)) };
  const landed = () => forgetOpened(ctx, (phase) => phase === stack.phase);
  const commits = replayed(stack);
  const pointers = pointersOf(ctx, commits, intoTip);
  if (lg.isAncestor(root, intoTip, stack.tip) && (pointers === null || pointers.kept)) {
    try {
      lg.moveBranch(root, into, intoTip, stack.tip);
    } catch (err) {
      if (!(err instanceof GitError)) throw err;
      throw new Error(`land: ${into} could not move (${gitSaid(err)}), so nothing moved — clear what git names and land again`);
    }
    landed();
    return { ...merged, commit: stack.tip };
  }
  const { tip, empty } = replayOnto(ctx, stack, commits, intoTip, pointers);
  const block = lg.checkoutBlock(root, into, { from: intoTip, to: tip });
  if (block !== null) throw new Error(`land: ${block}`);
  lg.moveBranch(root, stack.branch, stack.tip, tip);
  try {
    lg.moveBranch(root, into, intoTip, tip);
  } catch (err) {
    try {
      lg.moveBranch(root, stack.branch, tip, stack.tip);
    } catch (back) {
      throw new Error(
        `land: ${into} could not move (${gitSaid(err)}), nor could ${stack.branch} be put back (${gitSaid(back)}) — `
        + `${stack.branch} stands at the replay, ${lg.short(tip)}; \`git branch -f ${stack.branch} ${lg.short(stack.tip)}\` puts it back`,
      );
    }
    throw new Error(`land: ${into} could not move (${gitSaid(err)}), so ${stack.branch} is put back and nothing moved — clear what git names and land again`);
  }
  landed();
  const why = `its change was on ${into} already`;
  return { ...merged, commit: tip, ...(empty.length > 0 ? { landed_empty: empty.flatMap(({ tasks }) => tasks.map((task) => ({ task, why }))) } : {}) };
}

/**
 * Merge a phase whole into the default branch — null where no task of it
 * is open here, and `already` where it is merged.
 * @param {LandingContext} ctx @param {number} phase
 */
function mergePhase(ctx, phase) {
  const refs = lg.branches(ctx.root);
  const stacks = stacksOf(ctx, refs);
  const stack = stacks.get(phase);
  if (stack === undefined) return null;
  if (stack.merged) return { into: ctx.into, already: true };
  return mergeStack(ctx, refs, stacks, stack);
}

/**
 * Merge every phase not yet merged, lowest first, each after the one it
 * stacks on, and then drop every opened ref the unit has. Stops at the
 * first that cannot merge, saying which merged.
 * @param {LandingContext} ctx
 */
function finish(ctx) {
  /** @type {({phase: number} & ReturnType<typeof mergeStack>)[]} */
  const merged = [];
  for (;;) {
    const refs = lg.branches(ctx.root);
    const stacks = stacksOf(ctx, refs);
    const unmerged = [...stacks.values()].filter((stack) => !stack.merged).sort((a, b) => a.phase - b.phase);
    if (unmerged.length === 0) {
      forgetOpened(ctx, () => true);
      return { into: ctx.into, phases: merged };
    }
    const next = unmerged.find(({ stackedOn }) => stackedOn === null) ?? unmerged[0];
    try {
      merged.push({ phase: next.phase, ...mergeStack(ctx, refs, stacks, next) });
    } catch (err) {
      if (merged.length === 0) throw err;
      throw new Error(`${errorText(err)} (finish merged phase ${merged.map((done) => done.phase).join(', ')} before it)`);
    }
  }
}

module.exports = {
  kind: 'landing',
  name: 'local',
  isDefault: true,
  needs: [],
  serves: () => false,
  chainTip,
  open,
  chain,
  mergePhase,
  finish,
};
