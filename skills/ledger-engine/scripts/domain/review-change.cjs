'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the whole change the review phase holds against the spec
// (14.1.1), read off git in every repository of the project holding the
// unit's work (7.2.17) — what an area pair's and the test reader's briefs
// draw its commits and scratch worktree from (brief-records.cjs), and the
// code a round's scenarios are judged at (runs.cjs, 15.3.3).
//
// By the review phase every phase of the cut has closed, each merged onto
// the branch it lands on — or, in step, its stack waiting at its gate
// (7.2.4). A failing round's fix phase is built on the unit's work not
// landed below it, in every repository holding that work, so the work not
// landed is one stack, its tip holding every fix (`fixBase`, which `land
// open` holds a fix task to), each fix task laid out on that work with its
// own phase's chain (`belowTips`, task-worktree.cjs) and its pair reading
// it from there (`workBelow`, brief-records.cjs). A task of the cut is laid
// out on its own phase's chain alone: a phase relying on another starts
// once that one has merged, and one relying on nothing unfinished may start
// beside one still open, whose review's fixes go on moving its chain
// (12.11.3), so no other phase's work not landed is ever under it. In auto
// the fix phases land only at finish, in that order (7.2.6), and in step
// each merges at its gate before the next round is read (14.6.2,
// review-phase.cjs). The change is the unit's own work, never what others
// landed beside it — a quick-fix taking its turn (12.7.8), the person's own
// commits, another unit's phase. What has landed is read as every type's
// task is (task-landed.cjs, 7.2.22), so a merge by hand by any method still
// gives the change its landing. So in each repository:
// - its base is the branch given where it has that branch, else the branch
//   it lands the unit's work on — for a unit with a branch of its own
//   there, the default branch (landing-git.cjs, `landingBranch`); a base
//   given that no repository has is refused, so a misnamed one never passes
//   as the default;
// - for a unit with a branch of its own there (7.2.34), one part: that
//   branch, here or as last fetched, against the base, from where they last
//   met (`againstBase`, 14.1.6) — so the merges that brought the default
//   branch in, their settlements among them, are read as the unit will
//   land; its tasks' landings still read on that branch, and those found by
//   hand recorded, as the work not landed reads them;
// - else the unit's landings (`landingParts`), oldest first: each of its tasks
//   landed on the base, at its landing there as every type's is read
//   (task-landed.cjs) — the oldest commit on the base's first-parent line
//   holding its change: the one that brought its last commit in, by a
//   fast-forward or a merge commit; else the one that brought in the oldest
//   commit naming it by a `Task:` line since that commit, as the engine's
//   squash does, one changing nothing passed over; else the oldest holding
//   its change, as a rebase's copies and a squash under the person's own
//   message do — a part for each run on the line of a landed task's own
//   commits: each run holding one of its landings — that one, and where its
//   first commit landed, so a task landed, changed and landed again keeps
//   its first landing (task-landed.cjs, `landings`) — reaching back and on
//   through the commits of the line naming the task, stamped with it or its
//   work, as the one read of what has landed reads whose work a commit is
//   (`ownersOf`, R32), a copy of it, or a merge commit bringing them in,
//   among them, as a rebase lays a task's commits one by one; and each run
//   of them apart from those, as a task changed after its landing lands
//   again past others' work. So every commit of a landed task's own on the
//   line lies in a part of its, and a commit no task's — the person's own
//   on main, or on a task's branch below its first commit — in none; runs
//   never overlap;
// - the work not landed is every task of the unit's phases, cut and fix,
//   done in the tracker and not landed (task-landed.cjs) — a task that
//   landed before the migration cut the unit landed before Ledger
//   (`landedBefore`, derivations.cjs); the stack those tasks make there
//   (phase-stack.cjs), read from where its tip leaves the base, or the
//   unit's own branch where it has one — a task not done holds nothing
//   yet to review;
// - the change's tip, where its scratch worktree and its runs stand, is
//   that stack's tip where the repository holds such work, else the unit's
//   own branch where it has one, else its base.
// A quick-fix's review, asked for at its close, reads its landing through
// its own one read (`quickFixLanding`, landing.cjs) in each repository it
// touches — every task of it, the review's fix tasks among them,
// committing on its one branch, `fix/{unit}` (19.5.15, fix-branch.cjs) —
// on the branch it lands on as the host has it, never refused for having
// landed; its work not landed is that branch, where it holds a commit not
// landed, read from where it leaves the branch it lands on, as the landing
// cuts it again; its tip the branch there, else the landing's.
// A repository with neither landings nor work not landed holds none of the
// change. Refused where no repository holds any — but for a unit that
// landed work before the migration cut it (`landedAnyBefore`), whose change
// is what landed since (21.8.8): none holding any, its change is empty,
// standing at each repository's base, its tips there, where the review
// reads every area built before at the change's tips.
// The cut's scenarios — a quick-fix's, its fixes' (fix-acceptance.cjs) —
// stand where their runs at or behind the change's tips put them
// (`cutStandings`), as a round records them and the board shows
// round 1's while it is read, the board reading the change from its read
// of the tracker, no writer lock taken (`trackedChange`), and a
// quick-fix's off git alone, its host's branches as last fetched: no
// fetch, and no pull request read.
// ---------------------------------------------------------------------------

const { git } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { projectRepos, repoName } = require('../kernel/repos.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const {
  isFixPhase, cutPhases, quickFixBuild, hasLanded, builtSince, landedAnyBefore,
} = require('./derivations.cjs');
const { runsOf } = require('./runs.cjs');
const { trackedLists, trackedPhase } = require('./task-verbs.cjs');
const { quickFixLanding } = require('./landing.cjs');
const { unitLanded } = require('./task-landed.cjs');
const { recordLandings } = require('./landing-record.cjs');
const { branches, landingBranch, landingRev, unitBranchIn, repoDefault, remoteOf, trackedTip, latestOf, mergeBase } = require('./landing-git.cjs');
const { dayBefore } = require('./dates.cjs');
const { fixAcceptance, fixScenarios } = require('./fix-acceptance.cjs');
const { stackOf } = require('./phase-stack.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./runs.cjs').RepoCommit} RepoCommit */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./task-landed.cjs').RepoLanded} RepoLanded */
/** @typedef {import('./task-landed.cjs').UnitLanded} UnitLanded */
/** @typedef {import('./landing.cjs').QuickFixLanding} QuickFixLanding */
/** @typedef {import('./fix-acceptance.cjs').FixAcceptance} FixAcceptance */

/**
 * One part of the change in a repository, read `from..to`: a landing, by
 * its commit and its subject; the unit's own branch, by its name, against
 * the base it is read against (`against`); or the work not landed, by its
 * stack's tip.
 * @typedef {{from: string, to: string, landed: {commit: string, subject: string}|null, branch: string|null, against?: string}} ChangePart
 */
/**
 * The change in one repository: its base, its parts in order — its
 * landings, then its work not landed — and its tip by the branch it is on
 * and by its commit.
 * @typedef {{repo: Repo, base: string, parts: ChangePart[], tip: string, commit: string}} ChangeIn
 */
/** The whole change: the project's repositories, and the change in each holding it, the project's own first. @typedef {{repos: Repo[], holding: ChangeIn[]}} Change */

/** The branch `read` answers for a repository, null where it names none. @param {() => string} read */
function branchOf(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

/** Where a part starting before a commit starts: its first parent, or the empty tree before a first commit. @param {Repo} repo @param {string[]} parents */
function before(repo, [first]) {
  return first ?? git(repo.path, ['hash-object', '-t', 'tree', '--stdin'], undefined, '').trim();
}

/** The time the unit's work is read from: the day before it was made, none where it names no date. @param {string} cwd @param {string} unit */
const workSince = (cwd, unit) => dayBefore(manifestOf(stateRoot(cwd), unit)?.created);

/**
 * Where each run of a task's own commits stands on a line, by where it
 * ends, at its start: of `own`, the places on the line of its landing and
 * of the commits marking it.
 * @param {Set<number>} own @param {Map<number, number>} runs where each run found so far starts, by where it ends
 */
function ownRuns(own, runs) {
  for (const end of own) {
    if (own.has(end + 1)) continue;
    let start = end;
    while (own.has(start - 1)) start -= 1;
    runs.set(end, Math.min(start, runs.get(end) ?? start));
  }
}

/**
 * The spans of the run from `start` to `end` that no span before it holds,
 * each `[first, last]`, those it gives then held (`covered`).
 * @param {number} start @param {number} end @param {Set<number>} covered
 * @returns {[number, number][]}
 */
function uncovered(start, end, covered) {
  /** @type {[number, number][]} */
  const spans = [];
  for (let at = start; at <= end; at += 1) {
    if (covered.has(at)) continue;
    let last = at;
    while (last < end && !covered.has(last + 1)) last += 1;
    spans.push([at, last]);
    for (let held = at; held <= last; held += 1) covered.add(held);
    at = last;
  }
  return spans;
}

/**
 * The unit's landings in a repository, oldest first (the header's), a part
 * for each run of a landed task's own commits on the first-parent line
 * `read` reads (task-landed.cjs): its landings there (`landings`), and the
 * commits of the line marking it (`marking`) — naming it, stamped with it,
 * or its work, a copy of it or a merge commit bringing them in among them —
 * each run read from the first parent of its first commit to its last, as
 * a rebase lays a task's commits one by one; every commit of every run in
 * one part, a run holding another's drawn in the spans of it that one
 * lacks, so none is dropped.
 * @param {Repo} repo @param {Pick<RepoLanded, 'marking'|'line'|'landings'>} read @param {TaskRef[]} tasks
 * @returns {ChangePart[]}
 */
function landingParts(repo, read, tasks) {
  const line = read.line();
  const places = new Map(line.map(({ sha }, at) => [sha, at]));
  /** @param {string[]} shas */
  const placed = (shas) => shas.flatMap((sha) => places.get(sha) ?? []);
  /** @type {Map<number, number>} where each run starts, by where it ends on the line */
  const runs = new Map();
  for (const ref of tasks) {
    const landed = placed(read.landings(ref));
    if (landed.length > 0) ownRuns(new Set([...landed, ...placed(read.marking(ref))]), runs);
  }
  /** @type {Set<number>} */
  const covered = new Set();
  const spans = [...runs].sort(([a], [b]) => a - b).flatMap(([end, start]) => uncovered(start, end, covered));
  return spans.sort(([a], [b]) => a - b).map(([first, end]) => {
    const { sha, message } = line[end];
    return { from: before(repo, line[first].parents), to: sha, landed: { commit: sha, subject: message.split('\n')[0] }, branch: null };
  });
}

/** The phases 1 to `phases`. @param {number} phases */
const phasesTo = (phases) => Array.from({ length: phases }, (_, at) => at + 1);

/**
 * The project's repos: those read already, else read now.
 * @param {string} cwd @param {Repo[]} [repos]
 */
const reposOr = (cwd, repos) => repos ?? projectRepos(codeRoot(cwd));

/** The unit's manifest, none read as an empty one. @param {string} cwd @param {string} unit @returns {Record<string, any>} */
const manifestOr = (cwd, unit) => manifestOf(stateRoot(cwd), unit) ?? {};

/**
 * The unit's tasks done and not landed (`hasLanded`), whole, in each of the
 * phases `numbers`, in order, from each phase's list `lists` holds, what
 * has landed as `landedOf` reads it, and the tasks whole `wholeOf` reads of
 * the phases among them holding any — read only where a task built since
 * the migration is done.
 * @param {Record<string, any>} manifest @param {number[]} numbers @param {(TaskRow[]|null|undefined)[]} lists
 * @param {() => (ref: TaskRef) => boolean} landedOf @param {(phases: number[]) => TaskDetail[][]} wholeOf
 * @returns {TaskDetail[]}
 */
function notLanded(manifest, numbers, lists, landedOf, wholeOf) {
  if (!lists.some((list) => builtSince(manifest, list ?? []).some(({ status }) => status === 'done'))) return [];
  const landed = hasLanded(manifest, landedOf());
  const waiting = (/** @type {TaskRow} */ { ref, status }) => status === 'done' && !landed(ref);
  return wholeOf(numbers.filter((_, at) => (lists[at] ?? []).some(waiting))).flatMap((tasks) => tasks.filter(waiting));
}

/**
 * The unit's tasks done and not landed (`notLanded`), whole, in each of
 * the phases `numbers`, in order, as the tracker holds them under the
 * writer lock.
 * @param {string} cwd @param {string} unit @param {number[]} numbers @param {Repo[]} [repos] the project's, where read already
 * @returns {TaskDetail[]}
 */
function unlandedTasks(cwd, unit, numbers, repos) {
  const lists = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, numbers).phases);
  return notLanded(manifestOr(cwd, unit), numbers, lists, () => unitLanded(cwd, unit, reposOr(cwd, repos), workSince(cwd, unit)).landed, wholeOf(cwd, unit));
}

/** The tasks whole of the phases asked, as the tracker holds them under the writer lock. @param {string} cwd @param {string} unit @returns {(phases: number[]) => TaskDetail[][]} */
const wholeOf = (cwd, unit) => (phases) => withStateLock(stateRoot(cwd), () => phases.map((phase) => trackedPhase(cwd, unit, phase).tasks ?? []));

/**
 * The stack the tasks among `pending` make: its tip in each repository
 * holding their work, none where there are none.
 * @param {string} cwd @param {string} unit @param {TaskDetail[]} pending @param {string} what the work, as a refusal names it @param {Repo[]} [repos] the project's, where read already
 * @returns {Map<Repo, string>}
 */
const stackTips = (cwd, unit, pending, what, repos) => (pending.length === 0 ? new Map() : stackOf(reposOr(cwd, repos), unit, pending, what).tips);

/**
 * The stack the unit's work not landed in its phases to `phases` makes (`stackTips`).
 * @param {string} cwd @param {string} unit @param {number} phases @param {string} what @param {Repo[]} [repos]
 */
const unlandedStack = (cwd, unit, phases, what, repos) => stackTips(cwd, unit, unlandedTasks(cwd, unit, phasesTo(phases), repos), what, repos);

/**
 * The unit's work not landed below a task of phase `phase`, whole — what
 * the task is laid out on and its pair reads from (brief-records.cjs): for
 * one of the review's fix phases, its tasks done and not landed in its
 * phases to `phase`, the work below it with its own chain (7.2.6); for a
 * phase of the cut, its own chain alone (the header's).
 * @param {string} cwd @param {string} unit @param {number} phase @param {Repo[]} [repos] the project's, where read already
 * @returns {TaskDetail[]}
 */
function workBelow(cwd, unit, phase, repos) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return unlandedTasks(cwd, unit, manifest !== null && isFixPhase(manifest, phase) ? phasesTo(phase) : [phase], repos);
}

/**
 * Where a task of phase `phase` is laid out, by the folder of each
 * repository holding the work below it (`workBelow`): the branch at that
 * work's tip there (task-worktree.cjs, 12.7.10); none where nothing below
 * it waits to land. Refused where that work is no one stack in a
 * repository (phase-stack.cjs).
 * @param {string} cwd @param {string} unit @param {number} phase @param {Repo[]} repos the project's
 * @returns {Map<string, string>}
 */
function belowTips(cwd, unit, phase, repos) {
  return new Map([...stackTips(cwd, unit, workBelow(cwd, unit, phase, repos), `the work below ${unit}'s phase ${phase}`, repos)].map(([repo, tip]) => [repo.dir, tip]));
}

/**
 * What a task of a phase is built on, by the folder of each repository
 * holding it: for one of the review's fix phases, the branch at the tip of
 * the unit's work not landed below it (the header's); nothing for any other
 * phase, nor where nothing below it waits to land.
 * @param {string} cwd @param {string} unit @param {number} phase @param {Repo[]} repos the project's
 * @returns {Map<string, string>}
 */
function fixBase(cwd, unit, phase, repos) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest === null || !isFixPhase(manifest, phase)) return new Map();
  return new Map([...unlandedStack(cwd, unit, phase - 1, `${unit}'s work not landed below phase ${phase}`, repos)].map(([repo, tip]) => [repo.dir, tip]));
}

/**
 * The whole change (the header's), its work not landed read from the
 * unit's phases to `phases`, and each landing its read found that no
 * record names, recorded (landing-record.cjs), the record's commit's
 * warnings pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {number} phases @param {string|null} given the base named, or null for each repository's own @param {Repo[]} repos the project's @param {string[]} warnings
 * @returns {Change}
 */
function changeOf(cwd, unit, phases, given, repos, warnings) {
  const numbers = phasesTo(phases);
  const lists = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, numbers).phases);
  /** @type {UnitLanded|undefined} */
  let read;
  /** @type {QuickFixLanding|undefined} */
  let quickFix;
  const landed = () => (read ??= unitLanded(cwd, unit, repos, workSince(cwd, unit)));
  const manifest = manifestOr(cwd, unit);
  const pending = () => notLanded(manifest, numbers, lists, () => landed().landed, wholeOf(cwd, unit));
  const change = changeFrom(cwd, unit, { pending, tasks: () => tasksIn(manifest, lists), landed, quickFix: () => (quickFix ??= quickFixLanding(cwd, unit)) }, given, repos);
  recordLandings(cwd, unit, [...(read?.found() ?? []), ...(quickFix?.found() ?? [])], warnings);
  return change;
}

/**
 * The whole change, each repository at its own base, its work not landed
 * read from the unit's phases to `phases` as the caller read them, for a
 * reader that never takes the writer lock: each phase's list, the tasks
 * landed, and the tasks whole of the phases holding one done and not
 * landed, read only where any is — a quick-fix's off git alone, its host's
 * branches as last fetched, no host asked (`quickFixLanding`).
 * @param {string} cwd @param {string} unit @param {number} phases
 * @param {{lists: (TaskRow[]|null)[], landed: UnitLanded, wholeOf: (phases: number[]) => TaskDetail[][]}} read @param {Repo[]} repos the project's
 * @returns {Change}
 */
function trackedChange(cwd, unit, phases, { lists, landed, wholeOf }, repos) {
  const numbers = phasesTo(phases);
  const listed = numbers.map((phase) => lists[phase - 1]);
  const manifest = manifestOr(cwd, unit);
  return changeFrom(cwd, unit, {
    pending: () => notLanded(manifest, numbers, listed, () => landed.landed, wholeOf), tasks: () => tasksIn(manifest, listed), landed: () => landed, quickFix: () => quickFixLanding(cwd, unit, { asFetched: true }),
  }, null, repos);
}

/** Every task among phases' lists built since the migration (`builtSince`). @param {Record<string, any>} manifest @param {(TaskRow[]|null|undefined)[]} lists @returns {TaskRef[]} */
const tasksIn = (manifest, lists) => lists.flatMap((list) => builtSince(manifest, list ?? []).map(({ ref }) => ref));

/**
 * The whole change (the header's), its landings of its tasks: a
 * quick-fix's, its work not landed its one branch, as its landing's read
 * `quickFix` reads it (`quickFixChange`); any other unit's, its tasks done
 * and not landed (`changeOn`) — each read only where asked.
 * @param {string} cwd @param {string} unit @param {{pending: () => TaskDetail[], tasks: () => TaskRef[], landed: () => UnitLanded, quickFix: () => QuickFixLanding}} read @param {string|null} given @param {Repo[]} repos
 * @returns {Change}
 */
function changeFrom(cwd, unit, { pending, tasks, landed, quickFix }, given, repos) {
  return isQuickFix(cwd, unit) ? quickFixChange(unit, tasks(), given, repos, quickFix()) : changeOn(cwd, unit, { pending: pending(), tasks: tasks(), landed: landed() }, given, repos);
}

/** Whether the unit is built as a quick-fix (`quickFixBuild`). @param {string} cwd @param {string} unit */
function isQuickFix(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest !== null && quickFixBuild(manifest);
}

/** Refuse a base named that no repository of the project has as a local branch. @param {string|null} given @param {Repo[]} repos */
function refuseBase(given, repos) {
  if (given !== null && !repos.some((repo) => branches(repo.path).has(given))) throw new Error(`the base ${given} is no local branch in any repository of the project`);
}

/** The refusal of a change no repository holds. @param {string} unit */
const noChange = (unit) => new Error(`no repository of the project holds ${unit}'s change — nothing of it has landed, and no task of it is done`);

/**
 * The whole change (the header's): the landings of `tasks`, read on each
 * repository's base through the unit's one read of what has landed
 * (`landed`), then its work not landed, `pending`.
 * @param {string} cwd @param {string} unit @param {{pending: TaskDetail[], tasks: TaskRef[], landed: UnitLanded}} work @param {string|null} given the base named, or null for each repository's own @param {Repo[]} repos the project's
 * @returns {Change}
 */
function changeOn(cwd, unit, { pending, tasks, landed }, given, repos) {
  refuseBase(given, repos);
  const stack = new Map([...stackTips(cwd, unit, pending, `${unit}'s build`, repos)].map(([repo, tip]) => [repo.path, tip]));
  const based = repos.flatMap((repo) => {
    const own = unitBranchIn(cwd, repo, unit);
    const base = given !== null && branches(repo.path).has(given) ? given : branchOf(() => (own === null ? landingBranch(cwd, repo, unit) : repoDefault(cwd, repo)));
    return base === null ? [] : [{ repo, base, own }];
  });
  const holding = based.flatMap(({ repo, base, own }) => {
    const on = own === null ? `refs/heads/${base}` : landingRev(cwd, repo, unit);
    const parts = own === null ? landingParts(repo, landed.on(repo, on), tasks) : againstBase(cwd, repo, own, on, base);
    const branch = stack.get(repo.path);
    if (branch !== undefined) {
      const to = git(repo.path, ['rev-parse', `refs/heads/${branch}`]).trim();
      parts.push({ from: mergeBase(repo.path, on, to), to, landed: null, branch });
    }
    if (parts.length === 0) return [];
    return [{ repo, base, parts, tip: branch ?? own ?? base, commit: git(repo.path, ['rev-parse', branch === undefined ? on : `refs/heads/${branch}`]).trim() }];
  });
  if (holding.length > 0) return { repos, holding };
  if (!landedAnyBefore(manifestOr(cwd, unit))) throw noChange(unit);
  return { repos, holding: based.map(({ repo, base }) => changeIn(repo, base, [], base)) };
}

/** The change in a repository, standing at the branch `tip`. @param {Repo} repo @param {string} base @param {ChangePart[]} parts @param {string} tip @returns {ChangeIn} */
const changeIn = (repo, base, parts, tip) => ({ repo, base, parts, tip, commit: git(repo.path, ['rev-parse', `refs/heads/${tip}`]).trim() });

/**
 * A repository's part of the change for a unit with a branch of its own
 * (the header's, 14.1.6): its branch, read at `on`, against the base, from
 * where they last met — where it meets the base here, or as last fetched
 * from the repository's remote, whichever is later, so a base here behind
 * its host's, or ahead of it with commits never pushed, is read as the
 * branch brought it in; none where the branch holds nothing past it.
 * @param {string} cwd @param {Repo} repo @param {string} own the unit's branch @param {string} on @param {string} base
 * @returns {ChangePart[]}
 */
function againstBase(cwd, repo, own, on, base) {
  const to = git(repo.path, ['rev-parse', on]).trim();
  const remote = remoteOf(cwd, repo);
  const fetched = remote === null ? null : trackedTip(repo.path, remote, base);
  const met = [`refs/heads/${base}`, ...(fetched === null ? [] : [fetched])].map((rev) => mergeBase(repo.path, rev, to));
  const from = met[Math.max(latestOf(repo.path, met), 0)];
  return from === to ? [] : [{ from, to, landed: null, branch: own, against: base }];
}

/**
 * A quick-fix's whole change (the header's), read through its landing's
 * one read, `read` (`quickFixLanding`, landing.cjs), `tasks` its tasks: in
 * each repository it touches, each landing of one on the branch it lands
 * on as the host has it (`landingParts`), then its branch where that holds
 * a commit not landed past it.
 * @param {string} unit @param {TaskRef[]} tasks @param {string|null} given the base named, or null for each repository's own @param {Repo[]} repos the project's
 * @param {QuickFixLanding} read
 * @returns {Change}
 */
function quickFixChange(unit, tasks, given, repos, read) {
  refuseBase(given, repos);
  const holding = repos.flatMap((repo) => {
    const held = read.repos.find((each) => each.repo.path === repo.path);
    if (held === undefined) return [];
    const parts = landingParts(repo, held, tasks);
    const at = held.at();
    const working = at !== undefined && held.holdsUnlanded(at);
    if (working) parts.push({ from: mergeBase(repo.path, held.tip, at), to: at, landed: null, branch: held.branch });
    if (parts.length === 0) return [];
    const base = given !== null && branches(repo.path).has(given) ? given : held.ctx.into;
    return [{ repo, base, parts, tip: working ? held.branch : base, commit: working ? at : held.tip }];
  });
  if (holding.length === 0) throw noChange(unit);
  return { repos, holding };
}

/** The change's tips, each repository by its name at its tip's commit, as a run names its commits. @param {Change} change @returns {RepoCommit[]} */
const changeTips = ({ holding }) => holding.map(({ repo, commit }) => ({ repo: repoName(repo), commit }));

/**
 * The scenarios the unit's review holds the change to, in order: its
 * cut's, or a quick-fix's, its fixes' as `acceptance` reads them
 * (fix-acceptance.cjs).
 * @param {Record<string, any>} manifest @param {() => FixAcceptance[]} acceptance @returns {string[]}
 */
function reviewScenarios(manifest, acceptance) {
  if (quickFixBuild(manifest)) return fixScenarios(acceptance()).map(({ scenario }) => scenario);
  return cutPhases(manifest).flatMap(({ scenarios }) => scenarios);
}

/**
 * What each scenario of the cut — a quick-fix's, of its fixes — stands at,
 * at a change's tips: the code a round reads (runs.cjs, 15.3.3). A
 * quick-fix's fixes are read from the tracker under the state's lock, but
 * where `acceptance` reads them, as the board does from its own read.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {Change} change
 * @param {() => FixAcceptance[]} [acceptance]
 * @returns {{scenario: string, standing: string}[]}
 */
function cutStandings(cwd, unit, manifest, change, acceptance = () => fixAcceptance(cwd, unit)) {
  const tips = changeTips(change);
  return reviewScenarios(manifest, acceptance).map((scenario) => ({ scenario, standing: runsOf(cwd, unit, scenario, tips).standing }));
}

module.exports = { changeOf, trackedChange, changeTips, cutStandings, fixBase, workBelow, belowTips };
