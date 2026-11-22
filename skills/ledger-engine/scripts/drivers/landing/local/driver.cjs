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
// recorded of each task opened is where its branch stood, a local ref of the
// task's (`refs/ledger/opened/`) — the commit the driver took it at
// (`taken`), which the seam reads where a task stands against its landing
// (landing.cjs) — and the commit its opening made on its phase's branch
// (`refs/ledger/phase-commit/`), so a later opening finds that commit's
// tree changed by hand; both dropped only when its phase's stack begins
// again without it, or at finish. The default branch, below, is the
// branch a context lands on (landing.cjs): a unit's own branch, for a unit
// with one, which lands on the default branch itself at finish.
//
// - Merged, by one rule: every task a phase's branch landed — those its
//   stack holds past the default branch, or, the default branch holding its
//   branch, those the commit at its top names (`landedTop`), each landed
//   below it among those the phase took — has
//   landed, or changed after its landing, as the seam reads where each
//   stands (the context's `landedOn`, task-landed.cjs `stands`): none never
//   landed, by the engine's squash or by hand however the person merged it.
//   A phase's branch that landed nothing is no stack at all, its tasks
//   opening afresh. A phase merged holds every task it took, as GitHub's
//   driver holds each pull request of a stack merged: those its branch
//   landed, and each opened since it landed (R30) — each opened already,
//   chained and held — those not landed waiting for its next merge, or
//   finish (`landAlone`). No verb moves its branch off its landing.
// - The chain's tip: the last task opened in the phase; for a phase merged,
//   the last opened since it landed that waits; for a phase's first, the
//   last task of the latest unmerged phase the task was built on, which the
//   phase then stacks on, as a fix phase does on the one before (7.2.6) —
//   else the default branch. A task is built on another it holds the branch
//   of, or, that branch deleted, a commit of with the tree its stack landed;
//   a branch at the task's own tip counts for nothing but where its task's
//   stack landed it, so a task cut from it with nothing of its own lands
//   nothing. That the task descends from the tip is the seam's to check
//   (landing.cjs); putting a parallel task there is Claude's merge-back
//   (12.7.1), so the driver never rebases.
// - Holds: whether the task's phase's stack landed it, as the close in step
//   reads it (7.2.4).
// - Open: the squash commits the task's tree onto the phase's branch, which
//   is exactly the task's own change while that branch's tree is the chain
//   tip's — the seam refusing a task whose branch holds another's work not
//   landed past it (landing.cjs, `refuseHeld`); a task whose branch does
//   not descend from the tip, its change laid onto it from where the seam
//   reads it (landing.cjs, `laidFrom`), squashes that merge's tree — a
//   conflict refused, the way on its commits past there rebased onto the
//   tip — never its branch's tree, which lacks what the chain took since
//   (S1). A task whose commits change
//   nothing past the tip — they change nothing at all, or the tip holds
//   their change already — opens as a commit that changes nothing, which the
//   answer names, and says why. A task of a phase merged is recorded alone,
//   where its branch stands, its phase's branch left at its landing.
// - Phase: the default branch fast-forwarded to the phase's branch, its
//   commits first replayed onto the default branch where that moved on since
//   the phase began, as each pull request squash-merges onto it — but a
//   task's landed by hand, which never lands again. A phase
//   stacked on another merges once the default branch holds every task of
//   that one, its branch kept or deleted. A task never landed whose branch
//   is not where it opened stops the phase; a phase's commits otherwise land
//   as its branch stands. A task waiting on a phase merged — changed after
//   its landing, or opened since — lands its branch's change, as the branch
//   stands, onto the default branch over their merge base, as a pull request
//   squash-merges — over where its own work starts, where the default branch
//   lacks that commit — under the message the seam gives it (the context's
//   `message`) — refused where that conflicts, the way on to merge the
//   default branch into its branch, and where its branch holds another
//   task's work not landed, as the seam refuses it (`refuseHeld`). It moves
//   the default branch alone: the phase's branch stays at its landing, so a
//   later change of any task it landed is read off it again.
// - Finish: the phase merged next, the lowest with something to land — a
//   stack not merged, or a phase merged with a task waiting — that stacks on
//   no phase not merged; the seam makes each merge in turn (landing.cjs),
//   and then every opened ref the unit has is dropped.
// - A unit's own branch (landing.cjs): landed on the default branch at
//   finish by one merge commit of the two, the default branch its first
//   parent, under the landing's subject and description, and the default
//   branch moved to it — refused, nothing moved, where the default branch
//   is out with changes in the way; the two never conflict, the landing
//   bringing the default branch into the unit's branch first where they
//   would. It opens no pull request, so a cancel closes none.
// - A quick-fix (landing.cjs): in each repository it touches, its one pull
//   request is a ref of the unit's (`refs/ledger/quick-fix/{unit}/open`) at
//   the commit its branch was opened at — the host's copy of the branch,
//   which the seam takes where the branch here is gone — opening it again
//   moving the ref to the branch as it stands, `already` where it stands
//   there. Its merge squashes the branch onto the default branch as one
//   commit under its landing's message, as GitHub squashes a pull request,
//   and moves the default branch to it, refused,
//   nothing moved, where the squash conflicts, naming the way on, or the
//   default branch is out with changes in the way; the opening is then
//   dropped, as it is alone where there is nothing to merge, and the head
//   merged kept under `merged/{landing}`, as GitHub keeps a merged pull
//   request's, so a fix reverted after it landed still reads as landed —
//   until the quick-fix closes, its merge made wherever it lands, when
//   every ref of the unit's is dropped (`finished`). Each is read as the
//   seam names its unit's time, those committed before it an earlier
//   unit's of the same name. A merge by hand is the seam's to read off the
//   default branch. A move closes it, its opening dropped, and so does a
//   cancel, which a reactivate's next opening opens again.
// - A cancel (landing.cjs) closes nothing else: nothing is open on a host,
//   and each phase's stack is its branch, which the cancel keeps.
//
// Every refusal says the way on, its commands fitted to the repository as
// it stands (landing-git.cjs).
// ---------------------------------------------------------------------------

const names = require('../../../domain/landing-names.cjs');
const lg = require('../../../domain/landing-git.cjs');
const { taskId, shownTask, sameTask, parseShownTask } = require('../../../domain/task-id.cjs');
const { GitError } = require('../../../kernel/git.cjs');
const { messageOf } = require('../../../kernel/call.cjs');

/** @typedef {import('../../../domain/task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../../../domain/landing.cjs').LandingContext} LandingContext */
/** @typedef {import('../../../domain/landing.cjs').LandingTask} LandingTask */

/** A commit as git gives it. @typedef {{sha: string, tree: string, message: string}} Commit */
/** A commit on a phase's branch, and the unit's tasks it lands. @typedef {Commit & {refs: TaskRef[]}} Line */
/** A task landed on its phase's branch, by the commit that lands it. @typedef {Commit & {ref: TaskRef}} Landed */
/**
 * What stops a stack: a commit that is no task of its phase, at the branch's
 * top or below; or a task landed twice, the newer copy first.
 * @typedef {{kind: 'stray', commit: Commit, top: boolean} | {kind: 'twice', ref: TaskRef, upper: Commit, lower: Commit}} Fault
 */
/** A task waiting for its phase's next merge, and whether it changed after its landing — else it was opened since its phase landed. @typedef {{ref: TaskRef, changed: boolean}} Waiting */
/**
 * A phase's stack: its branch and tip; merged, or its tasks in the order
 * they landed, the unmerged phase it stacks on, if any, the commits of
 * tasks below its own that its line holds, newest first, and what stops it;
 * and, merged (`stacksOf`), every task it took and those waiting for its
 * next merge, each oldest first — none for any other.
 * @typedef {{phase: number, branch: string, tip: string, merged: boolean, tasks: Landed[], stackedOn: number|null, base: Landed[], fault: Fault|null, took: TaskRef[], waiting: Waiting[]}} Stack
 */
/**
 * A task of the unit a task's branch holds: by its branch's name and tip,
 * or, that branch deleted, by its own and the commit its stack landed.
 * @typedef {{ref: TaskRef, name: string, from: string}} Held
 */
/**
 * Where a task's chain ends, as the seam reads it — the branch, and its
 * commit — with what `open` takes from it: the task whose branch that is,
 * if any; the stack that branch's task landed in; the branches, the stacks,
 * where the task's phase's branch is, if anywhere, and whether that phase
 * is merged, the task then recorded alone; and, where the task's branch
 * does not descend from it, the commit the seam lays its change from.
 * @typedef {{name: string, commit: string, last: TaskRef|undefined, top: Stack|undefined, refs: Map<string, string>, stacks: Map<number, Stack>, phaseAt: string|null, alone: boolean, over?: string}} ChainTip
 */

const LEDGER_REFS = 'refs/ledger/';
const OPENED = `${LEDGER_REFS}opened/`;
const QUICK_FIX = `${LEDGER_REFS}quick-fix/`;
const PHASE_COMMIT = `${LEDGER_REFS}phase-commit/`;

/** A commit as a refusal names it. @param {Commit} commit */
const named = (commit) => `${lg.short(commit.sha)} "${lg.plain(commit.message.split('\n')[0])}"`;

/** Tasks as a refusal names them. @param {TaskRef[]} refs */
const tasksNamed = (refs) => `task${refs.length === 1 ? '' : 's'} ${refs.map(shownTask).join(', ')}`;

/** Where the unit's tasks' opened refs live. @param {string} unit */
const openedUnder = (unit) => `${OPENED}${unit}/`;

/** The unit's tasks opened here, each where its branch stood when it opened, by the task shown. @param {LandingContext} ctx */
const openedRefs = (ctx) => lg.refsUnder(ctx.root, openedUnder(ctx.unit));

/** Where a task's branch stood when it opened, or null where nothing records it — a task landed by hand. @param {LandingContext} ctx @param {TaskRef} ref */
const openedAt = (ctx, ref) => openedRefs(ctx).get(shownTask(ref)) ?? null;

/** Where the commits the unit's tasks' openings made on their phases' branches live. @param {string} unit */
const phaseCommitUnder = (unit) => `${PHASE_COMMIT}${unit}/`;

/** The commit a task's opening made on its phase's branch, or null where nothing records one. @param {LandingContext} ctx @param {TaskRef} ref */
const madeAt = (ctx, ref) => lg.refsUnder(ctx.root, phaseCommitUnder(ctx.unit)).get(shownTask(ref)) ?? null;

/**
 * The commit the driver took each of the unit's tasks at, by its internal
 * id: where its branch stood when it opened (see the header).
 * @param {LandingContext} ctx @returns {Map<string, string>}
 */
const taken = (ctx) => new Map([...openedRefs(ctx)].map(([shown, at]) => [taskId(parseShownTask(ctx.unit, shown)), at]));

/** Each task a commit lands, newest first, as a stack holds them. @param {Commit} commit @param {TaskRef[]} refs @returns {Landed[]} */
const landings = (commit, refs) => [...refs].reverse().map((ref) => ({ sha: commit.sha, tree: commit.tree, message: commit.message, ref }));

/**
 * The tasks of `phase` a phase's branch the default branch holds landed, as
 * the commit at its top names them, newest first — none where it names
 * none, a branch that landed nothing. The commits below it are never read:
 * the driver opened each task they land and keeps where it opened until
 * finish, so the stack takes it all the same (`stacksOf`).
 * @param {LandingContext} ctx @param {number} phase @param {string} tip
 * @returns {Landed[]}
 */
function landedTop(ctx, phase, tip) {
  const top = lg.commitAt(ctx.root, tip);
  return landings(top, names.tasksOfMessage(ctx.unit, top.message).filter((ref) => ref.phase === phase));
}

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
  return { phase, branch, tip, merged: false, tasks: tasks.reverse(), stackedOn: base[0]?.ref.phase ?? null, base, fault, took: [], waiting: [] };
}

/** Each task once, oldest first. @param {TaskRef[]} refs @returns {TaskRef[]} */
const inOrder = (refs) => [...new Map(refs.map((ref) => [taskId(ref), ref])).values()].sort((a, b) => a.n - b.n);

/**
 * The unit's phase stacks, by phase — a branch that landed nothing left out
 * — each task read where it stands against its landing by the seam (the
 * context's `landedOn`, `stands`). One whose every task its branch landed
 * has landed, or changed after its landing, is merged (see the header),
 * with every task it took — those, and each opened since — and those of
 * them waiting for its next merge.
 * @param {LandingContext} ctx @param {Map<string, string>} refs
 * @returns {Map<number, Stack>}
 */
function stacksOf(ctx, refs) {
  const into = /** @type {string} */ (refs.get(ctx.into));
  const read = ctx.landedOn(into);
  const opened = [...openedRefs(ctx).keys()].map((shown) => parseShownTask(ctx.unit, shown));
  /** @type {Map<number, Stack>} */
  const stacks = new Map();
  for (const [branch, tip] of refs) {
    const phase = names.phaseOfBranch(ctx.unit, branch);
    if (phase === null) continue;
    const line = lg.firstParentLine(ctx.root, into, tip).map((commit) => ({ ...commit, refs: names.tasksOfMessage(ctx.unit, commit.message) }));
    const stack = stackOf(phase, branch, tip, line);
    const landed = inOrder((line.length === 0 ? landedTop(ctx, phase, tip) : stack.tasks).map(({ ref }) => ref));
    if (landed.length > 0 && landed.every((ref) => read.stands(ref) !== 'unlanded')) {
      const took = inOrder([...landed, ...opened.filter((ref) => ref.phase === phase)]);
      const waiting = took.flatMap((ref) => {
        const stands = read.stands(ref);
        return stands === 'landed' ? [] : [{ ref, changed: stands === 'changed' }];
      });
      stacks.set(phase, { ...stack, merged: true, tasks: [], stackedOn: null, base: [], fault: null, took, waiting });
    } else if (stack.tasks.length > 0 || stack.fault !== null) {
      const baseMerged = stack.stackedOn !== null && stack.base.every(({ ref }) => read.stands(ref) !== 'unlanded');
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
 * @param {{ref: TaskRef, message: string}} landed
 * @returns {{branch: string, title: string, type: string}|null}
 */
function namedBranch(landed) {
  const landing = names.landingOf(landed.ref, landed.message);
  return landing === null ? null : { ...landing, branch: names.taskBranch(landed.ref, landing.type, landing.title) };
}

/** Whether a stack landed a task. @param {Stack|undefined} stack @param {TaskRef} ref */
const lands = (stack, ref) => stack?.tasks.some((landed) => sameTask(landed.ref, ref)) === true;

/**
 * The tasks a phase's stack holds, oldest first: those it lands; merged,
 * every task it took (`stacksOf`).
 * @param {Stack} stack @returns {TaskRef[]}
 */
const heldIn = (stack) => (stack.merged ? stack.took : stack.tasks.map(({ ref }) => ref));

/** Whether a phase's stack holds a task (`heldIn`). @param {Stack|undefined} stack @param {TaskRef} ref */
const holdsTask = (stack, ref) => stack !== undefined && heldIn(stack).some((held) => sameTask(held, ref));

/** Whether its phase's stack landed a task. @param {Map<number, Stack>} stacks @param {TaskRef} ref */
const landedIn = (stacks, ref) => lands(stacks.get(ref.phase), ref);

/**
 * The way to make a gone task's branch again at the commit `at`, by the
 * name its landing carries.
 * @param {{ref: TaskRef, message: string}} landed @param {string} at
 */
function remake(landed, at) {
  const branch = namedBranch(landed);
  return branch === null
    ? `make task ${shownTask(landed.ref)}'s branch again at ${lg.short(at)}`
    : `make it again with \`git branch ${branch.branch} ${lg.short(at)}\``;
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
  const at = openedAt(ctx, last.ref) ?? lg.commitWithTree(ctx.root, ctx.into, task.branch, last.tree) ?? last.sha;
  return `land: task ${shownTask(last.ref)}'s branch is gone, and phase ${top.phase}'s chain ends at it — ${remake(last, at)} and land again`;
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
 * The branches here, the stacks they hold, and the task's phase's own —
 * refused where something stops it — read once on its context
 * (landing-git.cjs, `readOnce`).
 * @param {LandingContext} ctx @param {TaskRef} ref
 */
function stacksFor(ctx, ref) {
  const { refs, stacks } = lg.readOnce(ctx, 'stacks', () => {
    const read = lg.branches(ctx.root);
    return { refs: read, stacks: stacksOf(ctx, read) };
  });
  const own = stacks.get(ref.phase);
  if (own !== undefined) refuseFaulty(ctx, refs, own);
  return { refs, stacks, own };
}

/** Whether its phase's stack holds the task (`holdsTask`), refused as `stacksFor` refuses it. @param {LandingContext} ctx @param {TaskRef} ref */
const holds = (ctx, ref) => holdsTask(stacksFor(ctx, ref).own, ref);

/**
 * The chain's tip a task lands on, and what opening it takes (see the
 * header) — null where its phase's stack holds it already (`holdsTask`),
 * so no open moves a phase's branch off its landing. Refuses as
 * `stacksFor` does, a task built on a stack something stops, and a chain
 * whose last task's branch is gone.
 * @param {LandingContext} ctx @param {LandingTask} task
 * @returns {ChainTip|null}
 */
function chainTip(ctx, task) {
  const { refs, stacks, own } = stacksFor(ctx, task.ref);
  if (holdsTask(own, task.ref)) return null;
  const alone = own?.merged === true;
  const at = { refs, stacks, phaseAt: refs.get(names.phaseBranch(ctx.unit, task.ref.phase)) ?? null, alone };
  const opening = alone ? own.waiting.filter(({ changed }) => !changed).at(-1)?.ref : undefined;
  if (opening !== undefined) {
    const name = branchOf(refs, opening);
    if (name === null) throw new Error(`land: task ${shownTask(opening)}'s branch is gone, and phase ${task.ref.phase}'s chain ends at it — ${remake({ ref: opening, message: ctx.message(opening) }, /** @type {string} */ (openedAt(ctx, opening)))} and land again`);
    return { name, commit: /** @type {string} */ (refs.get(name)), last: opening, top: undefined, ...at };
  }
  const held = heldBy(ctx, task, refs, stacks);
  const reached = [...stacks.values()].filter((stack) => stack !== own && held.some(({ ref }) => lands(stack, ref))).sort((a, b) => b.phase - a.phase);
  for (const stack of reached) refuseFaulty(ctx, refs, stack);
  const top = alone ? reached[0] : own ?? reached[0];
  if (top === undefined) return { name: ctx.into, commit: /** @type {string} */ (refs.get(ctx.into)), last: undefined, top, ...at };
  const last = top.tasks[top.tasks.length - 1].ref;
  const lastBranch = branchOf(refs, last);
  if (lastBranch === null) throw new Error(goneRefusal(ctx, task, top));
  return { name: lastBranch, commit: /** @type {string} */ (refs.get(lastBranch)), last, top, ...at };
}

/**
 * Refuse a task of `tasks` never landed (R29, the context's `landedOn`,
 * `stands`) whose branch is not where it was when it opened — moved on, or
 * rewritten — keeping it as it stands, and putting it back. A task nothing
 * records the opening of, landed by hand, is passed over.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {TaskRef[]} tasks
 */
function refuseMoved(ctx, refs, tasks) {
  const opened = openedRefs(ctx);
  const read = ctx.landedOn(/** @type {string} */ (refs.get(ctx.into)));
  for (const ref of tasks) {
    const at = opened.get(shownTask(ref));
    const branch = branchOf(refs, ref);
    if (at === undefined || branch === null || refs.get(branch) === at || read.stands(ref) !== 'unlanded') continue;
    throw new Error(lg.movedSinceOpened(ctx.root, shownTask(ref), branch, at, /** @type {string} */ (refs.get(branch))));
  }
}

/**
 * Drop the opened refs of the unit's tasks `which` picks, and the commits
 * their openings made.
 * @param {LandingContext} ctx @param {(phase: number, shown: string) => boolean} which
 */
function forgetOpened(ctx, which) {
  const forgotten = [...openedRefs(ctx).keys()].filter((shown) => which(Number(shown.split('.')[0]), shown));
  lg.updateRefs(ctx.root, { drop: forgotten.flatMap((shown) => [`${openedUnder(ctx.unit)}${shown}`, `${phaseCommitUnder(ctx.unit)}${shown}`]) });
}

/**
 * The tree of a task's change laid onto the phase's branch at `onto`, its
 * chain's tip there, from where the seam reads it (`over`, landing.cjs
 * `laidFrom`) — or, for one descending from the chain's last task whose own
 * change was laid there, from that task's branch's tip — so the branch
 * holds the chain's tip and that change alone, never the task's branch's
 * tree, which lacks what the chain took since. A task changed after its
 * landing has its change laid onto the default branch first, which holds
 * that landing, then merged onto the chain's tip, which may have been cut
 * before it, as GitHub's driver lays it (its `laidOnTip`). Refused, nothing
 * moved, where either conflicts, naming the paths and the way on.
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip @param {string} onto @param {string} over
 */
function laidTree(ctx, task, tip, onto, over) {
  const shown = shownTask(task.ref);
  /** @param {string} base @param {string} ours @param {string} theirs @param {string} name @param {string} wayOn */
  const laid = (base, ours, theirs, name, wayOn) => {
    const merged = lg.mergeTree(ctx.root, base, ours, theirs);
    if (!('conflicts' in merged)) return merged.tree;
    throw new Error(`land: task ${shown}'s change past ${lg.short(base)} conflicts with ${name} at ${merged.conflicts.map(lg.plain).join(', ')}, so nothing moved — ${wayOn}, and open the task again`);
  };
  const into = /** @type {string} */ (tip.refs.get(ctx.into));
  if (ctx.landedOn(into).stands(task.ref) !== 'changed') return laid(over, onto, task.branch, tip.name, lg.rebasedPast(task.branch, tip.name, over));
  const tree = laid(over, into, task.branch, ctx.into, lg.rebasedPast(task.branch, ctx.into, over));
  if (onto === into) return tree;
  const message = `chore(${ctx.unit}): task ${shown}'s change laid on ${ctx.into}\n`;
  const commit = lg.commitTree(ctx.root, { tree, parent: into, message, signed: false }, `task ${shown}'s change laid on ${ctx.into}`, 'open the task again');
  return laid(lg.mergeBase(ctx.root, onto, into), onto, commit, tip.name, `merge ${lg.plain(tip.name)} into ${lg.plain(task.branch)}, settling the conflict`);
}

/**
 * Open a task on the chain's tip the seam checked it descends from, or lays
 * its change onto (`laidTree`), with a commit past it: its change squashed
 * onto its phase's branch, where its branch stands and that commit recorded
 * — the phase's other tasks' records dropped where its stack begins again
 * with this one; of a phase merged, where its branch stands recorded alone
 * (see the header). A task whose commits change nothing past the tip opens
 * as a commit that changes nothing, which the answer names. Refused where
 * the phase's branch no longer holds the tree the chain's last task's
 * opening made there, as its opening recorded it — else, nothing recording
 * it, that task's branch's tree — its commit then taken off the phase's
 * branch and the task opened again; where that task's change was laid
 * there, never its branch's whole tree, this task's change past that
 * branch is laid onto it (`laidTree`).
 * @param {LandingContext} ctx @param {LandingTask} task @param {ChainTip} tip
 */
function open(ctx, task, tip) {
  const { root } = ctx;
  const shown = shownTask(task.ref);
  const at = /** @type {string} */ (tip.refs.get(task.branch));
  /** Where the task's branch stands recorded, and the commit its opening made on its phase's branch, where it made one. @param {string} [made] */
  const record = (made) => lg.updateRefs(root, { set: [[`${openedUnder(ctx.unit)}${shown}`, at], ...(made === undefined ? [] : [/** @type {[string, string]} */ ([`${phaseCommitUnder(ctx.unit)}${shown}`, made])])] });
  refuseMoved(ctx, tip.refs, tip.last === undefined ? [] : [tip.last]);
  if (tip.alone) {
    record();
    return { base: tip.name };
  }
  const onto = tip.top?.tip ?? tip.commit;
  const last = tip.top?.tasks[tip.top.tasks.length - 1];
  const made = last === undefined ? null : madeAt(ctx, last.ref);
  const [branchTree, tipTree, ontoTree, madeTree] = lg.treesOf(root, [task.branch, tip.commit, onto, ...(made === null ? [] : [made])]);
  if (tip.top !== undefined && last !== undefined && ontoTree !== (madeTree ?? tipTree)) {
    const again = `open task ${shownTask(last.ref)} again`;
    throw new Error(`land: ${tip.top.branch}'s commit for task ${shownTask(last.ref)}, ${named(last)}, has changed since it was opened — ${offSteps(ctx, tip.top, last, again)}`);
  }
  const over = tip.over ?? (ontoTree === tipTree ? undefined : tip.commit);
  const tree = over === undefined ? branchTree : laidTree(ctx, task, tip, onto, over);
  const { phase } = task.ref;
  const branch = names.phaseBranch(ctx.unit, phase);
  const landing = { tree, parent: onto, message: task.message, signed: lg.signs(root) };
  const commit = lg.commitTree(root, landing, `task ${shown}'s landing on ${branch}`, 'open the task again');
  lg.moveBranch(root, branch, tip.phaseAt, commit);
  if (!tip.stacks.has(phase)) forgetOpened(ctx, (of, other) => of === phase && other !== shown);
  record(commit);
  if (tree !== tipTree) return { base: tip.name, phase_branch: branch, commit };
  const why = lg.ownChangeEmpty(root, tip.commit, task.branch) ? 'its commits change nothing' : `its change was on ${tip.name} already`;
  return { base: tip.name, phase_branch: branch, commit, landed_empty: [{ task: shown, why }] };
}

/**
 * Chain a task: it is in its phase's stack once opened, so this answers the
 * stack (`heldIn`), in the order its tasks were merged back — null where it
 * is not open; refused where its phase is merged, no task of it waiting.
 * @param {LandingContext} ctx @param {TaskRef} ref
 */
function chain(ctx, ref) {
  const { phase } = ref;
  const refs = lg.branches(ctx.root);
  const stack = stacksOf(ctx, refs).get(phase);
  if (stack?.merged && stack.waiting.length === 0) throw new Error(`land: phase ${phase} is merged into ${ctx.into} — its stack is landed`);
  if (stack !== undefined) refuseFaulty(ctx, refs, stack);
  if (stack === undefined || !holdsTask(stack, ref)) return null;
  return { phase_branch: stack.branch, stack: heldIn(stack).map(shownTask) };
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
  const read = ctx.landedOn(/** @type {string} */ (refs.get(ctx.into)));
  const lacking = /** @type {Landed} */ (stack.base.filter(({ ref }) => read.stands(ref) === 'unlanded').pop());
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
  const gone = branchOf(refs, lacking.ref) === null ? `${remake(lacking, openedAt(ctx, lacking.ref) ?? lacking.sha)}, ` : '';
  return `land: phase ${stack.phase} is built on task ${shown}, which ${ctx.into} does not hold and no branch of phase ${phase} lands — `
    + `${gone}open it again with \`land open ${ctx.unit} ${shown}\`, merge it with ${merge}, and land again`;
}

/** What a failed git call said, on one line, as a refusal quotes it. @param {unknown} err */
const errorSaid = (err) => lg.plain(messageOf(err));

/**
 * The default branch moved from `from` to `to` — refused, nothing moved,
 * where it cannot move.
 * @param {LandingContext} ctx @param {string} from @param {string} to
 */
function movedDefault(ctx, from, to) {
  try {
    lg.moveBranch(ctx.root, ctx.into, from, to);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    throw new Error(`land: ${ctx.into} could not move (${errorSaid(err)}), so nothing moved — clear what git names and land again`);
  }
}

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
 * The stack's commits replayed onto the default branch, as its pull
 * requests squash onto it — refused, naming the conflict and the way on,
 * where one of them conflicts there.
 * @param {LandingContext} ctx @param {Stack} stack @param {Replayed[]} commits @param {string} intoTip
 */
function replayOnto(ctx, stack, commits, intoTip) {
  const { root, into } = ctx;
  try {
    return lg.replay(root, commits, intoTip, into);
  } catch (err) {
    if (!(err instanceof lg.Conflict)) throw err;
    const way = lg.remedy(root, stack.branch, lg.rewrite(stack.branch, lg.quoted(into), `bring ${stack.branch} up to date with ${into}`));
    throw new Error(`${err.message}, so nothing moved — ${way}`);
  }
}

/**
 * The phase's branch, then the default branch, moved from where they stand
 * to `tip`, nothing moved until both can: the default branch checked where
 * it is out, and the phase's branch put back where the default branch's
 * move fails.
 * @param {LandingContext} ctx @param {string} branch the phase's @param {string} from where it stands @param {string} intoTip @param {string} tip @param {string} made what `tip` is, as a refusal names it
 */
function moveBoth(ctx, branch, from, intoTip, tip, made) {
  const { root, into } = ctx;
  const block = lg.checkoutBlock(root, into, { from: intoTip, to: tip });
  if (block !== null) throw new Error(`land: ${block}`);
  lg.moveBranch(root, branch, from, tip);
  try {
    lg.moveBranch(root, into, intoTip, tip);
  } catch (err) {
    try {
      lg.moveBranch(root, branch, tip, from);
    } catch (back) {
      throw new Error(
        `land: ${into} could not move (${errorSaid(err)}), nor could ${branch} be put back (${errorSaid(back)}) — `
        + `${branch} stands at ${made}, ${lg.short(tip)}; \`git branch -f ${branch} ${lg.short(from)}\` puts it back`,
      );
    }
    throw new Error(`land: ${into} could not move (${errorSaid(err)}), so ${branch} is put back and nothing moved — clear what git names and land again`);
  }
}

/** Tasks a landing names as changing nothing, and why: their change was on the default branch already. @param {LandingContext} ctx @param {string[]} tasks */
const landedEmpty = (ctx, tasks) => (tasks.length === 0 ? {} : { landed_empty: tasks.map((task) => ({ task, why: `its change was on ${ctx.into} already` })) });

/**
 * Merge a stack into the default branch. Where the stack lands as its
 * branch stands — the default branch where it was cut, and no task of it
 * changed after its landing, whose change lands alone — the default
 * branch fast-forwards to it. Else the commits of its tasks never landed
 * are replayed onto the default branch, both branches moved to them
 * (`moveBoth`) — a task landed by hand never lands again, nor is it
 * answered merged. A task whose change the default branch held already
 * lands as a commit that changes nothing, which the answer names. A task
 * of it never landed is refused where its branch moved since it opened
 * (`refuseMoved`); one landed by hand and changed after (the context's
 * `landedOn`, `stands`) lands its change after, as a task waiting on a
 * phase merged does (`landAlone`).
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {Map<number, Stack>} stacks @param {Stack} stack
 */
function mergeStack(ctx, refs, stacks, stack) {
  const { root, into } = ctx;
  refuseFaulty(ctx, refs, stack);
  if (stack.stackedOn !== null) throw new Error(waitingOn(ctx, refs, stacks, stack));
  const rebased = lg.rebaseBlock(root, stack.branch);
  if (rebased !== null) throw new Error(`land: ${rebased}`);
  const intoTip = /** @type {string} */ (refs.get(into));
  const read = ctx.landedOn(intoTip);
  const stands = new Map(stack.tasks.map(({ ref }) => [shownTask(ref), read.stands(ref)]));
  const changed = stack.tasks.map(({ ref }) => ref).filter((ref) => stands.get(shownTask(ref)) === 'changed');
  refuseMoved(ctx, refs, stack.tasks.map(({ ref }) => ref));
  const merged = { into, merged: stack.tasks.map((landed) => shownTask(landed.ref)).filter((shown) => stands.get(shown) !== 'landed') };
  const commits = replayed(stack).filter((commit) => commit.tasks.some((shown) => stands.get(shown) === 'unlanded'));
  /** @type {{commit: string, empty: string[]}} */
  let landed;
  if (changed.length === 0 && lg.isAncestor(root, intoTip, stack.tip)) {
    movedDefault(ctx, intoTip, stack.tip);
    landed = { commit: stack.tip, empty: [] };
  } else {
    const { tip, empty } = replayOnto(ctx, stack, commits, intoTip);
    moveBoth(ctx, stack.branch, stack.tip, intoTip, tip, 'the replay');
    landed = { commit: tip, empty: empty.flatMap(({ tasks }) => tasks) };
  }
  if (changed.length === 0) return { ...merged, commit: landed.commit, ...landedEmpty(ctx, landed.empty) };
  const again = landAlone(ctx, lg.branches(root), stack.phase, changed.map((ref) => ({ ref, changed: true })));
  const shown = new Set(changed.map(shownTask));
  return { ...merged, commit: again.commit, ...landedEmpty(ctx, [...landed.empty.filter((task) => !shown.has(task)), ...(again.landed_empty ?? []).map(({ task }) => task)]) };
}

/**
 * Land each task of a phase merged that waits for its next merge
 * (`stacksOf`) — changed after its landing, or opened since — as GitHub's
 * driver lands each pull request of a stack merged in part (7.2.23, R30):
 * its branch as it stands merged onto the default branch — one changed after
 * its landing over its tip at that landing, the base its change was read
 * over (the context's `landedOn`, `landedTip`), so just that change lands,
 * what it takes back of its own work among it; one opened since over where
 * its own work starts, where the default branch lacks that commit — a task
 * below it landed by a squash (`startOff`); else over their merge base, as a
 * pull request squash-merges — one commit a task under the message the seam
 * gives it (the context's `message`), oldest first, the default branch alone
 * moved to the last: the phase's branch stays at its landing, so a later
 * change of any task it landed is read off it again. Refused, nothing moved,
 * where a task never landed is not where it opened (`refuseMoved`), a task's
 * branch holds another task's work not landed (the context's `refuseHeld`),
 * a task's branch is gone, naming where to make it again, its change
 * conflicts there, naming the paths and the way on — for one read over its
 * tip at its landing, its commits since rebased onto the default branch
 * (`lg.rebasedSince`); for one changed since brought onto it, its commits
 * past their merge base rebased onto it, as a merge of the default branch
 * into a landed task's branch is refused (`lg.rebasedPast`); else the
 * default branch merged in — or the default branch is out with changes in
 * the way.
 * @param {LandingContext} ctx @param {Map<string, string>} refs @param {number} phase @param {Waiting[]} waiting
 */
function landAlone(ctx, refs, phase, waiting) {
  const { root, into } = ctx;
  const intoTip = /** @type {string} */ (refs.get(into));
  refuseMoved(ctx, refs, waiting.map(({ ref }) => ref));
  const read = ctx.landedOn(intoTip);
  const signed = lg.signs(root);
  let at = intoTip;
  /** @type {string[]} */
  const empty = [];
  for (const { ref, changed } of waiting) {
    const shown = shownTask(ref);
    const since = changed ? `task ${shown} changed since phase ${phase} landed on ${into}, and its` : `task ${shown}'s`;
    const own = branchOf(refs, ref);
    if (own === null) throw new Error(`land: ${since} branch is gone — ${remake({ ref, message: ctx.message(ref) }, remadeAt(ctx, ref, changed, intoTip))} and land again`);
    const head = /** @type {string} */ (refs.get(own));
    ctx.refuseHeld({ ref, branch: own }, head, intoTip);
    const landedAt = changed ? read.landedTip(ref) : null;
    const base = landedAt ?? (changed ? null : startOff(ctx, read, ref, at)) ?? lg.mergeBase(root, at, head);
    const merged = lg.mergeTree(root, base, at, head);
    if ('conflicts' in merged) {
      const wayOn = landedAt !== null ? lg.rebasedSince(own, into, landedAt) : changed ? lg.rebasedPast(own, into, base) : `merge ${into} into ${own}, settling the conflict`;
      throw new Error(`land: ${since} change conflicts with ${into} at ${merged.conflicts.map(lg.plain).join(', ')}, so nothing moved — ${wayOn}, and land again`);
    }
    const { tree } = merged;
    if (tree === lg.treesOf(root, [at])[0]) empty.push(shown);
    at = lg.commitTree(root, { tree, parent: at, message: ctx.message(ref), signed }, `task ${shown}'s landing on ${into}`, 'land again');
  }
  const block = lg.checkoutBlock(root, into, { from: intoTip, to: at });
  if (block !== null) throw new Error(`land: ${block}`);
  movedDefault(ctx, intoTip, at);
  return { into, merged: waiting.map(({ ref }) => shownTask(ref)), commit: at, ...landedEmpty(ctx, empty) };
}

/**
 * Where a task's own work starts on its branch (task-landed.cjs,
 * `ownStart`), where the default branch at `at` lacks that commit — a task
 * below it landed by a squash — so its change lands over it, keeping what
 * it undid of that task's work undone; else null, its change read over its
 * merge base.
 * @param {LandingContext} ctx @param {import('../../../domain/task-landed.cjs').RepoLanded} read @param {TaskRef} ref @param {string} at
 * @returns {string|null}
 */
function startOff(ctx, read, ref, at) {
  const start = read.ownStart(ref);
  return start !== null && !lg.isAncestor(ctx.root, start, at) ? start : null;
}

/**
 * Where a gone branch of a task waiting on its phase is made again: one
 * changed after its landing, at its last commit, wherever the repository
 * holds it; one opened since, where it stood when it opened.
 * @param {LandingContext} ctx @param {TaskRef} ref @param {boolean} changed @param {string} intoTip
 * @returns {string}
 */
const remadeAt = (ctx, ref, changed, intoTip) => /** @type {string} */ ((changed ? ctx.landedOn(intoTip).task(ref).found : null) ?? openedAt(ctx, ref));

/**
 * Merge a phase whole into the default branch — null where no task of it
 * is open here, and `already` where it is merged, no task of it waiting; a
 * phase merged landing each that waits (`landAlone`).
 * @param {LandingContext} ctx @param {number} phase
 */
function mergePhase(ctx, phase) {
  const refs = lg.branches(ctx.root);
  const stacks = stacksOf(ctx, refs);
  const stack = stacks.get(phase);
  if (stack === undefined) return null;
  if (!stack.merged) return mergeStack(ctx, refs, stacks, stack);
  return stack.waiting.length > 0 ? landAlone(ctx, refs, phase, stack.waiting) : { into: ctx.into, already: true };
}

/**
 * The merge finish makes next: of the phases with something to land — a
 * stack not merged, or a phase merged with a task waiting (`landAlone`) —
 * the lowest that stacks on no phase not merged, else the lowest; null
 * where none has.
 * @param {LandingContext} ctx
 */
function nextMerge(ctx) {
  const refs = lg.branches(ctx.root);
  const stacks = stacksOf(ctx, refs);
  const pending = [...stacks.values()].filter((stack) => !stack.merged || stack.waiting.length > 0).sort((a, b) => a.phase - b.phase);
  const next = pending.find(({ stackedOn }) => stackedOn === null) ?? pending[0];
  if (next === undefined) return null;
  return { phase: next.phase, merge: () => (next.merged ? landAlone(ctx, refs, next.phase, next.waiting) : mergeStack(ctx, refs, stacks, next)) };
}

/** The quick-fix's landing as the seam gives it (landing.cjs). @typedef {import('../../../domain/landing.cjs').QuickFixTask} QuickFixTask */
/** The quick-fix's pull request as the seam reads it (landing.cjs). @typedef {import('../../../domain/landing.cjs').QuickFixPull} QuickFixPull */
/** What a close answers (drivers.cjs). @typedef {import('../../../domain/drivers.cjs').PullsClosed} PullsClosed */

/** Where the unit's quick-fix refs live: `open`, and `merged/{landing}` for each merge (the header's). @param {string} unit */
const quickFixUnder = (unit) => `${QUICK_FIX}${unit}/`;

/**
 * The quick-fix's pull request (the header's): where its branch was opened,
 * null where it is not, which is the host's copy of it, and where it was
 * at each merge — each committed at or after the time `since` names, where
 * it names one, so a unit's name used again never reads an earlier unit's;
 * never closed by hand.
 * @param {LandingContext} ctx @param {string} branch @param {string|null} since
 * @returns {QuickFixPull}
 */
function quickFixPull(ctx, branch, since) {
  const held = lg.refsUnder(ctx.root, quickFixUnder(ctx.unit), since);
  const open = held.get('open') ?? null;
  return { open, merged: [...held].filter(([name]) => name.startsWith('merged/')).map(([, head]) => head), head: open, closed: null };
}

/**
 * The quick-fix opened at its branch as it stands — `already` where the
 * landing read it opened there.
 * @param {LandingContext} ctx @param {QuickFixTask} landing
 * @returns {{already?: true}}
 */
function openQuickFix(ctx, landing) {
  const at = /** @type {string} */ (lg.branches(ctx.root).get(landing.branch));
  if (landing.pull.open === at) return { already: true };
  lg.updateRefs(ctx.root, { set: [[`${quickFixUnder(ctx.unit)}open`, at]] });
  return {};
}

/** What a close answers where it closed nothing. @returns {PullsClosed} */
const noneClosed = () => ({ closed: false });

/**
 * The quick-fix closed for its move or its cancel (the header's), its
 * opening dropped where the read `pull` found it open: whether this call
 * closed it, which no host names, so nothing is told of it.
 * @param {LandingContext} ctx @param {QuickFixPull} pull @returns {PullsClosed}
 */
function closeQuickFix(ctx, pull) {
  if (pull.open === null) return noneClosed();
  lg.updateRefs(ctx.root, { drop: [`${quickFixUnder(ctx.unit)}open`] });
  return { closed: true };
}

/**
 * The quick-fix merged (the header's): its branch squashed onto the default
 * branch as one commit under its landing's message, the default branch moved
 * to it, then its opening dropped and the head it merged kept; refused,
 * nothing moved, where the squash conflicts or the default branch cannot
 * move. With nothing to land, its opening is dropped alone.
 * @param {LandingContext} ctx @param {QuickFixTask|null} landing
 */
function mergeQuickFix(ctx, landing) {
  const { root, into } = ctx;
  const opening = `${quickFixUnder(ctx.unit)}open`;
  const forget = (/** @type {[string, string][]} */ set = []) => lg.updateRefs(root, { set, drop: lg.refsUnder(root, quickFixUnder(ctx.unit)).has('open') ? [opening] : [] });
  if (landing === null) {
    forget();
    return { into, already: /** @type {const} */ (true) };
  }
  const refs = lg.branches(root);
  const intoTip = /** @type {string} */ (refs.get(into));
  const at = /** @type {string} */ (refs.get(landing.branch));
  const merged = lg.mergeTree(root, lg.mergeBase(root, intoTip, at), intoTip, at);
  if ('conflicts' in merged) {
    throw new Error(`land: ${landing.branch} conflicts with ${into} at ${merged.conflicts.map(lg.plain).join(', ')}, so nothing moved — ${names.quickFixMerged(ctx.unit, into, lg.quoted(ctx.repo))}, and land again`);
  }
  const commit = lg.commitTree(root, { tree: merged.tree, parent: intoTip, message: landing.message, signed: lg.signs(root) }, `${ctx.unit}'s squash onto ${into}`, 'land again');
  movedDefault(ctx, intoTip, commit);
  forget([[`${quickFixUnder(ctx.unit)}merged/${commit}`, at]]);
  return { into, merged: landing.tasks, commit };
}

/**
 * The unit's own branch landed on the default branch (the header's): one
 * merge commit of the two, the default branch its first parent, under the
 * landing's subject and description, the default branch moved to it —
 * refused, nothing moved, where the default branch cannot move. The two
 * never conflict here: the landing brings the default branch into the
 * unit's branch first where they would (landing.cjs, `unitLanded`). Given
 * no landing, nothing moves.
 * @param {LandingContext} ctx @param {import('../../../domain/landing.cjs').UnitLanding|null} landing
 */
function landUnit(ctx, landing) {
  const { root, into } = ctx;
  if (landing === null) return { into, already: /** @type {const} */ (true) };
  const intoTip = /** @type {string} */ (lg.branches(root).get(into));
  const merged = /** @type {{tree: string}} */ (lg.mergeTree(root, lg.mergeBase(root, intoTip, landing.tip), intoTip, landing.tip));
  const message = `${landing.subject}\n\n${landing.body}\n`;
  const commit = lg.commitTree(root, { tree: merged.tree, parent: [intoTip, landing.tip], message, signed: lg.signs(root) }, `${landing.branch}'s merge onto ${into}`, 'land again');
  movedDefault(ctx, intoTip, commit);
  return { into, landed: landing.branch, commit };
}

/** The unit's own pull request closed: the local driver opens none. @returns {PullsClosed} */
const closeUnit = () => noneClosed();

/** The tasks' pull requests closed for a cancel: a phase's stack is its branch, which the cancel keeps. @returns {PullsClosed} */
const closeTasks = () => noneClosed();

/**
 * Every ref the driver keeps of the unit here dropped, once finish has
 * merged it all (the header's): its tasks' openings and the commits they
 * made, and a quick-fix's opening and the heads it merged — read in one
 * call.
 * @param {LandingContext} ctx
 */
function finished(ctx) {
  const unders = [openedUnder(ctx.unit), phaseCommitUnder(ctx.unit), quickFixUnder(ctx.unit)];
  const drop = [...lg.refsUnder(ctx.root, LEDGER_REFS).keys()].map((name) => `${LEDGER_REFS}${name}`).filter((ref) => unders.some((under) => ref.startsWith(under)));
  lg.updateRefs(ctx.root, { drop });
}

module.exports = {
  kind: 'landing',
  name: 'local',
  isDefault: true,
  title: 'the local driver',
  needs: [],
  serves: () => false,
  taken,
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
  landUnit,
  closeUnit,
  closeTasks,
  finished,
};
