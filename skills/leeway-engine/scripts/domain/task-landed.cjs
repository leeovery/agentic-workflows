'use strict';

// ---------------------------------------------------------------------------
// Domain ring: whether a task has landed (7.2.22), one read for every work
// type — a feature's, an epic's and a bugfix's tasks, a quick-fix's fixes,
// and the fix tasks of every review phase — and every driver's question of
// it (landing.cjs gives each its repository's read, `landedOn`).
//
// A task the unit's landing record names in a repository (landing-record
// .cjs) has landed there wherever the revision's first-parent line holds
// its record's commit, whatever its branch does after, and is never read by
// its content: it has changed after its landing (R29) where its branch's
// tip — a quick-fix's task's, its newest own commit on the quick-fix's
// branch; its branch gone, its newest stamped commit anywhere — holds a
// commit that neither its recorded tip nor the default branch holds, and
// carries a change the default branch lacks (`changedSince`), so an amend,
// a rebase with no change or the default branch merged back stays landed;
// its landings are its record's first and last, and its record's commit is
// its work alone (R32). Everything below reads a task no record names —
// landed by hand and not yet read, or by the engine before the record —
// once, at the first verb acting on its landing, which records each such
// task it was asked of that it finds landed (`found`); a read for display
// records nothing. A task landed by hand whose branch was rewritten past
// the revision before any verb read it — a commit stamped with it that its
// branch no longer holds, its reflog saying the branch once stood there,
// landed, and none it holds did — is the stated edge (`rewritten`, F1),
// which `open`, `phase` and `finish` refuse before anything moves,
// naming the commit to put the branch back to.
//
// A task has landed in a repository once the revision it lands on held its
// change, however it got there — the engine's squash, or a merge by hand by
// any method: a fast-forward, a merge commit, a squash or a rebase — and a
// task that has landed stays landed, later work rewriting its lines never
// taking it back (R25). Its last commit is the one the door stamped with it
// (commit-task.cjs) nearest its work branch's tip on its line — the tip's
// first-parent line, read in one home (`lg.taskLine`), so a merge's other
// parents, the default branch merged back with its copies of the task's
// commits among them, are never on it — committed since its unit's work
// began: on its work branch past the revision, where the caller names one —
// a quick-fix's one branch; else on its work branch as it stands here
// (`lg.lastStamped`) — where that line holds none, the newest its tip
// holds, as its branch fast-forwarded onto a default branch a merge commit
// landed it on leaves it; else, its branch gone, the newest anywhere the
// repository holds it, on any ref or reflog, so a branch deleted loses none
// — never on a branch the engine kept a moved branch's work aside on, a
// task of its own, nor a commit dropped from a branch that stands. Only
// content decides a landing (R28), and never when a commit was made: two
// made in one second read as they do a second apart, or a clock set wrong.
// The one name of one read is a `Task:` line, which the engine's squash
// writes, and the door's stamp, which every commit of a task and every copy
// of one carries, never names one. Where it has a last commit, the task has
// landed where the revision holds that commit; or where a commit on the
// revision's first-parent line past where that commit was cut, changing a
// path its work changes, held its change — merging its last commit there,
// over the commit below its own work, would have changed nothing, so a
// task undoing work below it, landed or not, is change still to land (S3);
// a submodule's pointer held where the submodule holds it
// (`lg.holdChanges`); and the line held the change its work is laid on
// there (`holdsTaskChange`) — or a copy of each of its own
// commits was there (`holdsCopy`) — as the engine's squash, its
// pointers moved to the submodules' landings, a rebase's copies, git's own
// squash, a squash under the person's own message, the person's duplicate
// work by hand, and a cherry-pick of every commit of it land it, a
// cherry-pick of some of them never; or where its work changes nothing
// past the revision; or, its change gone from the line, as a later fix
// reverting it in a pull request leaves it, where a pull request the host
// merged holds that commit, landed as one whose work changes nothing
// (`pulledAt`). One laid on the revision, changing something there, has
// not landed. Where it has none, it has landed where a commit on the
// revision names it by its `Task:` line. A task holds work in a
// repository where it has such a commit there, or has landed there; across
// the project's repositories, it has landed where it has in every one holding
// its work, one at least (`landedAcross`). A commit alone — one of a
// quick-fix's on its branch, stamped or the person's own — has landed where
// the revision holds it, its change, or a copy of it, or a pull request the
// host merged there holds it; one stamped with a task, where that task has
// landed and its last commit holds it, as a fix of two commits squashed by
// hand lands its first. Whose work a commit since the unit's work began
// is, past the revision or on it, has one answer (`ownersOf`, R32): the
// tasks it is stamped with; else those a commit on the revision names by
// its `Task:` lines, a landing's copy of its tasks' work, never another's;
// else, the person's own or the engine's — its commit pointing a
// submodule at its landing, or bringing a branch up to date — the task
// whose branch's tip holds it on its line past the oldest commit there
// stamped with that task — a copy, where the branch holds the task's
// commits copied — never one a merge brought in, the default branch merged
// back or another task's; the lowest such tip, holding the fewest commits
// since the unit's work began, the earlier task where two hold as many;
// else no task's. So the person's own commit between a task's own on its
// branch, or past its last, is its work, a copy of it among those a
// landing by copies needs — one the default branch gained, fast-forwarded
// into a task's branch past its first commit, among them; one on the
// revision a task's branch does not hold so, or on a task's branch below
// that task's first commit, is no task's, landing with the branch it is on
// all the same; and the change a task's branch is laid on lies below its
// own commits and no task's. A
// task's work on the revision — fast-forwarded there, or copied, as a
// rebase merged by a host lays it — marks the task beside the commits
// naming or stamped with it, so the review's change draws it (`marking`);
// and a commit of its past the revision, read whole, landed at its task's
// landing where it holds the task's last commit and past that merges
// alone, else at the oldest commit on the line past where it was cut
// holding its change — its copy, the copies of its work, or their squash —
// none where its change has not landed, as for one past its task's landing
// (`landedCopy`), a submodule's pointer at it moving there. A commit
// standing for a task whole — the one its branch opened at, its pull
// request's head, its
// branch's tip — is never read as a commit alone: it has landed where the
// task has, read as above with that commit for its last, its work every
// commit it holds past the revision of the task's or of no task's
// (`landedAs`), so later work rewriting a line of it never takes it back;
// where it holds the task's last commit and past that no such commit but
// merges — the default branch merged back, another task's work — it has
// landed where the task's last commit has.
//
// A task has landed where its branch's tip has — its branch here, else its
// last commit — read as a commit standing for it whole, so every reader of
// a task's landing, the build's checks and the drivers alike, reads one
// answer (R29). A task a driver took — opened its branch at a commit, or a
// pull request's head — stands against its landing one way, whichever
// driver took it and however it landed (`stands`): landed where it has;
// changed after its landing where it has not and the commit the driver
// took has, whatever its branch gained since — its own commits, a
// restack's, the person's own; else never landed. A branch holds another
// task's work not landed where a commit it holds past a revision, that
// task's (`ownersOf`), has not landed there, read as a commit inside its
// task (R31, `heldPast`): a task cut from another's branch holds the
// person's own commit there as that task's work.
//
// Its landing, as the review's change reads it (review-change.cjs), is the
// oldest commit on the revision's first-parent line holding its change:
// the one that brought its last commit in; the one that brought in the
// oldest commit naming it since — never a later one naming it again — but
// where that one changes nothing, as a commit made again over a landing by
// hand does, the oldest holding its change; or that oldest one, where it
// landed by its change alone. Its landings are that one and where the
// oldest commit stamped with it that its branch's tip holds landed, read
// so from that commit (`landings`): a task landed, changed and landed
// again has both, but one whose oldest such commit is its last — a task of
// one commit made again over its landing by hand — its later alone. A
// submodule's pointer the
// engine moves to a commit's landing (`landedCopy`) never moves back: a
// landing the pointer holds moves nothing (landing-git.cjs,
// `pointerFrom`), and a commit with no landing of its own keeps its pin.
//
// A feature's, an epic's or a bugfix's tasks are read on each repository's
// default branch here (`unitLanded`), as the build's checks, the review's
// change and a bugfix's door read them; a quick-fix's on each default branch
// as the host has it (landing.cjs, `quickFixLanding`). Each read is made once
// a call, writing nothing. Every task's last commit and its branch's tip,
// where those commits stand against the revision, the commits on it naming a
// task or stamped with one, its line, and the paths each commit of the line
// changes are each read for every task at once (`lg.branches`,
// `lg.lastStamped`, `lg.standings`, `lg.tasksMarkedOn`, `lg.lineSince`,
// `lg.commitPaths`): a task the revision holds, or one laid on it, costs
// no read of its own, and nor does its landing. The commits every task's
// branch's tip holds past the revision are read in one call, at the first
// commit read
// whole or asked whose work it is, with the commits read whole then
// (`lg.commitPaths`) — one no tip holds read later in a call with the rest
// of its kind. Every tip past its task's last commit, and every commit a
// driver took a task at not landed, is read whole with the rest of its
// kind, at the first asked, a recorded task's never; every other task's
// last commit no record names, and every such
// commit standing for its task whole, is read by
// its change with the rest, at the first asked (`scan`): the paths their work
// changes; whether each commit of the line past where each was cut
// changing one of them holds its change, every such pair in one merge
// (`lg.holdChanges`), with the change below each where the line lacks it
// (`lg.belowOwn`); and the copies of their own commits (`lg.copiesOf`). So
// a chain of tasks below one, a
// phase landed by a squash, by merge commits or under the person's own
// message, tasks not landed while the revision moves on past their paths, or
// tasks changed after their landing, cost the git calls one task does,
// however many tasks and commits (12.14);
// only a task read from a last commit of its own, a quick-fix's on its
// branch, other than the one read for every task, is scanned alone. Whose
// work a commit is reads the commits every task's branch's tip holds since
// the unit's work began, on the revision or past it, in one call, at the
// first asked (`lg.commitGraph`); and where every task's first commit
// landed is read in one scan, at the first asked (`firstLanding`).
// ---------------------------------------------------------------------------

const lg = require('./landing-git.cjs');
const names = require('./landing-names.cjs');
const { recordsIn } = require('./landing-record.cjs');
const { repoName } = require('../kernel/repos.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { taskId, shownTask, stepOfId } = require('./task-id.cjs');

/** The trailer the door stamps a task's commit with, read when asked: commit-task.cjs reads the landing. */
const stamp = () => require('./commit-task.cjs').TRAILER;

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./landing-git.cjs').TimedCommit} TimedCommit */
/** @typedef {import('./landing-git.cjs').PathsCommit} PathsCommit */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./landing-record.cjs').LandingRecord} LandingRecord */
/** What the scan read of a task (`scan`): the last commit read from, the oldest commit of the line holding its change, null where none did, and whether that was read by its change. @typedef {{sha: string, at: string|null, byChange: boolean}} Scanned */
/** A commit a scan reads a task from, standing for its last. @typedef {{sha: string}} ReadFrom */
/** A task the scan reads by its change: the commit read from, the paths its work changes, its own commits but merges, and the commits of the line past where it was cut changing one. @typedef {{id: string, last: ReadFrom, own: Set<string>, commits: string[], touching: import('./landing-git.cjs').LineCommit[]}} Searched */
/** A task's work past a revision: the paths it changes, and its commits but merges. @typedef {{paths: Set<string>, commits: string[]}} Work */

/**
 * A task as one repository's read takes it: its newest own commit on its
 * work branch past the revision, null where it has none there; its last
 * commit the repository holds anywhere, null for none; whether it holds
 * work there; and whether that work has landed, as its branch's tip stands
 * (the header's).
 * @typedef {{own: string|null, found: string|null, held: boolean, landed: boolean}} TaskLanding
 */

/**
 * How a task landed, where it did (the header's): its last commit held by
 * the revision; the commit of the line that held its change, or that a pull
 * request the host merged holding its last commit landed at; or, where it
 * has no last commit, the oldest commit there naming it.
 * @typedef {{landed: false}|{landed: true, held: string}|{landed: true, named: string}|{landed: true, at: string}} Landed
 */

/**
 * The unit's tasks' work in a repository, by each task's internal id, each
 * read once at the first question, for the reads of every revision there:
 * each one's last commit (`lg.lastStamped`), the tip of its branch here,
 * and every commit stamped with it anywhere the repository holds it
 * (`lg.stampedAnywhere`), newest first; each task's branch here, by its
 * name; and the commits every task's branch's tip holds since the unit's
 * work began, on any revision or past it, each after its parents
 * (`lg.commitGraph`).
 * @param {string} root @param {string} unit @param {string|null} since @param {Map<string, string>} [local] the branches here, where the caller read them
 * @returns {{stamps: () => Map<string, TimedCommit>, tips: () => Map<string, string>, anywhere: () => Map<string, TimedCommit[]>, names: () => Map<string, string>, graph: () => TipGraph}}
 */
function workIn(root, unit, since, local) {
  /** @type {Map<string, string>|undefined} */
  let refs = local;
  /** @type {TipGraph|undefined} */
  let tipGraph;
  /** @type {Map<string, TimedCommit>|undefined} */
  let last;
  /** @type {Map<string, string>|undefined} */
  let tips;
  /** @type {Map<string, string>|undefined} */
  let named;
  /** @type {Map<string, TimedCommit[]>|undefined} */
  let all;
  const branches = () => (refs ??= lg.branches(root));
  const anywhere = () => (all ??= lg.stampedAnywhere(root, stamp(), unit, since, branches()));
  /** Each task's branch here, by the task's internal id. */
  const branchNames = () => (named ??= new Map([...branches().keys()].flatMap((name) => {
    const ref = names.taskOfBranch(unit, name);
    return ref === null ? [] : [[taskId(ref), name]];
  })));
  const tipsHere = () => (tips ??= new Map([...branchNames()].map(([id, name]) => [id, /** @type {string} */ (branches().get(name))])));
  return {
    anywhere,
    stamps: () => (last ??= lg.lastStamped(root, stamp(), unit, since, branches(), anywhere())),
    tips: tipsHere,
    names: branchNames,
    graph: () => {
      if (tipGraph === undefined) {
        const order = lg.commitGraph(root, [...new Set(tipsHere().values())], since, stamp());
        tipGraph = { order, bySha: new Map(order.map((commit) => [commit.sha, commit])) };
      }
      return tipGraph;
    },
  };
}

/** The commits `workIn` reads every task's branch's tip holding, in order and by their commits. @typedef {{order: import('./landing-git.cjs').GraphCommit[], bySha: Map<string, import('./landing-git.cjs').GraphCommit>}} TipGraph */

/**
 * Where a task stands against its landing (`stands`, the header's): landed,
 * changed after its landing, or never landed.
 * @typedef {'landed'|'changed'|'unlanded'} Standing
 */

/** `read`, run at its first call alone. @param {() => void} read */
const once = (read) => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    read();
  };
};

/** Tasks in their order, phase then number, by their internal ids. @param {string} one @param {string} other */
const byStep = (one, other) => {
  const [a, b] = [stepOfId(one), stepOfId(other)];
  return (a?.phase ?? 0) - (b?.phase ?? 0) || (a?.n ?? 0) - (b?.n ?? 0);
};

/** The work `commits` make: the paths they change, and those but merges. @param {PathsCommit[]} commits @returns {Work} */
const workOf = (commits) => ({ paths: new Set(commits.flatMap(({ paths }) => [...paths])), commits: commits.filter(({ merge }) => !merge).map(({ sha }) => sha) });

/**
 * The commits of the task `id`'s line from its branch's tip, `tip`, past
 * the oldest one stamped with it (R32): those on the tip's first-parent
 * line down to the oldest there stamped with it, that one among them —
 * never one a merge brought in, the default branch merged back or another
 * task's — and that oldest one, undefined where the line holds none; of
 * the commits read, `bySha`.
 * @param {Map<string, import('./landing-git.cjs').GraphCommit>} bySha @param {string} tip @param {string} id
 * @returns {{past: Set<string>, first: import('./landing-git.cjs').GraphCommit|undefined}}
 */
function pastStamped(bySha, tip, id) {
  const line = lg.taskLine(bySha, tip);
  const oldest = line.reduce((found, { values }, at) => (values.includes(id) ? at : found), -1);
  return { past: new Set(line.slice(0, oldest + 1).map(({ sha }) => sha)), first: line[oldest] };
}

/**
 * What has landed on the revision `tip` of one repository (the header's),
 * each read made once: a task's read (`TaskLanding`); whether a commit
 * stamped with a task, or with none, has landed; whether a task has, a
 * commit standing for it whole; where a task stands against its landing;
 * the tasks whose work a commit holds past the revision, not landed; the
 * commits on the revision naming a task or stamped with it; the revision's
 * first-parent line since the unit's work began, oldest first; a task's
 * landing on it, null where it has none; and the tasks whose work a
 * revision's commits past it are.
 * @param {string} root @param {string} unit @param {string} tip
 * @param {{since: string|null, own?: (id: string) => TimedCommit|null, merged?: () => string[], work?: ReturnType<typeof workIn>, taken?: () => Map<string, string>, recorded?: Map<string, LandingRecord>, trunk?: () => string}} how the time the unit's work is read from; its newest own commit on its work branch, by its id; the heads of the pull requests the host merged onto the revision; each task's last commit and branch's tip, where the caller reads them for other revisions too (`workIn`); the commit a driver took each task at, by its id; the repository's landing records, by the task's id (landing-record.cjs); the default branch's tip, a recorded task's change after its landing read against it, the revision where the caller names none (`changedSince`)
 */
function repoLanded(root, unit, tip, { since, own = () => null, merged = () => [], work = workIn(root, unit, since), taken = () => new Map(), recorded = new Map(), trunk = () => tip }) {
  const { stamps, tips, anywhere } = work;
  const key = stamp();
  /** @type {ReturnType<typeof lg.tasksMarkedOn>|undefined} */
  let marks;
  /** @type {Map<string, import('./landing-git.cjs').Standing>|undefined} */
  let placed;
  /** @type {ReturnType<typeof lg.lineSince>|undefined} */
  let region;
  /** @type {Map<string, Set<string>>|undefined} */
  let changed;
  const marked = () => (marks ??= lg.tasksMarkedOn(root, tip, unit, key, since));
  /** The commits on the tip naming the task by a `Task:` line, newest first: the only name a landing is read by (R28). @param {string} id */
  const naming = (id) => marked().named.get(id) ?? [];
  /** Each task's last commit, and where those and its branch's tip stand against the tip, read together, so a read costs the same whichever tasks it is asked of. */
  const lasts = () => {
    const last = stamps();
    placed ??= lg.standings(root, tip, [...[...last.values()].map((commit) => commit.sha), ...tips().values()]);
    return { last, placed };
  };
  /** @param {string} sha */
  const placing = (sha) => lasts().placed.get(sha);
  const lineOf = () => (region ??= lg.lineSince(root, tip, since));
  /** The task's landing record, where the tip holds the landing it names: a recorded task stays landed (landing-record.cjs). @param {string} id @returns {LandingRecord|null} */
  const recordOf = (id) => {
    const record = recorded.get(id);
    return record !== undefined && lineOf().broughtIn.has(record.commit) ? record : null;
  };
  /** @type {Map<string, string[]>|undefined} */
  let recordedAt;
  /** The tasks each recorded landing the tip holds landed, by its commit, its first landing's among them. */
  const landedByRecord = () => {
    if (recordedAt === undefined) {
      recordedAt = new Map();
      for (const [id, record] of recorded) {
        if (recordOf(id) === null) continue;
        for (const sha of new Set([record.first, record.commit])) recordedAt.set(sha, [...(recordedAt.get(sha) ?? []), id]);
      }
    }
    return recordedAt;
  };
  /** @type {Map<string, boolean>|undefined} */
  let movedOn;
  /**
   * Whether a recorded task has changed after its landing (R29), the one
   * rule: its branch's tip — a quick-fix's task's, its newest own commit on
   * the quick-fix's branch; its branch gone, its newest stamped commit
   * anywhere — holds a commit neither its recorded tip nor the default
   * branch holds, and carries a change the default branch lacks: merging
   * it there over the recorded tip changes something, a conflict among
   * them (`lg.holdChanges`). A branch amended, rebased with no change, or
   * with the default branch merged back, stays landed at any revision
   * read. Every recorded task read at once, at the first asked; the change
   * read only of those whose branch moved past the recorded tip. A
   * recorded tip git no longer holds, as an expired reflog leaves it, holds
   * nothing, the change read over the branch's merge base instead.
   * @param {string} id
   */
  const changedSince = (id) => {
    if (movedOn === undefined) {
      movedOn = new Map();
      const asked = [...recorded.keys()].flatMap((task) => {
        const record = recordOf(task);
        const at = tips().get(task) ?? own(task)?.sha ?? stamps().get(task)?.sha;
        return record === null || at === undefined || at === record.tip ? [] : [{ task, at, from: record.tip }];
      });
      if (asked.length > 0) {
        const into = trunk();
        const present = lg.commitsIn(root, asked.map(({ from }) => from));
        const shas = [...asked.map(({ at }) => at), ...present];
        const listed = into === tip ? pastOf(shas) : new Map(lg.commitPaths(root, [...new Set(shas), '--not', into], key).map((commit) => [commit.sha, commit]));
        const moved = asked.filter(({ at, from }) => {
          const before = lg.heldIn(listed, from);
          return [...lg.heldIn(listed, at)].some((sha) => !before.has(sha));
        });
        if (moved.length > 0) {
          const [tree] = lg.treesOf(root, [into]);
          const held = lg.holdChanges(root, moved.map(({ at, from }) => ({ ours: into, tree, theirs: at, ...(present.has(from) ? { base: from } : {}) })));
          moved.forEach(({ task }, n) => movedOn?.set(task, !held[n]));
        }
      }
    }
    return movedOn.get(id) ?? false;
  };
  /** Whether the tip holds a copy of the commit `sha`, or, where it is the task `id`'s, its change and the change it is laid on (`lg.holdsTaskChange`). @param {string} sha @param {string|null} id */
  const holdsAt = (sha, id) => (id !== null && lg.holdsTaskChange(root, tip, sha, key, id, ownersOf)) || lg.holdsCopy(root, tip, sha);
  /** @type {Map<string, Scanned>|undefined} */
  let scanned;
  /**
   * Each task's work past the tip, of the commits past it that `lasts` hold
   * (`pastOf`), by whose work each is (`ownersOf`, `workOf`).
   * @param {string[]} lasts @returns {Map<string, Work>}
   */
  const workOfTasks = (lasts) => {
    if (lasts.length === 0) return new Map();
    const listed = pastOf(lasts);
    const held = new Set(lasts.flatMap((sha) => [...lg.heldIn(listed, sha)]));
    /** @type {Map<string, PathsCommit[]>} */
    const byTask = new Map();
    for (const commit of [...listed.values()].filter(({ sha }) => held.has(sha))) {
      for (const id of ownersOf(commit.sha, commit.values)) byTask.set(id, [...(byTask.get(id) ?? []), commit]);
    }
    return new Map([...byTask].map(([id, commits]) => [id, workOf(commits)]));
  };
  /** The paths each commit of the line changes, read once. */
  const lineChanges = () => {
    const bound = since === null ? [] : [`--since=${since}`];
    return (changed ??= new Map(lg.commitPaths(root, ['--first-parent', ...bound, tip], key).map(({ sha, paths }) => [sha, paths])));
  };
  /** A task's last commit and a commit of the line, as the scan's sets hold the pair. @param {string} last @param {string} sha */
  const pairOf = (last, sha) => `${last} ${sha}`;
  /**
   * The pairs of a task's last commit and a commit of the line holding the
   * task's change, of each task's `touching` (`lg.holdsTaskChange`):
   * merging its last commit there, over the commit below its own work,
   * changes nothing — so its undoing of work below it, landed or not, is
   * change still to land — nor the change its work is laid on, below its
   * chain's, where the line lacks that (`lg.belowOwn`).
   * @param {Searched[]} searched @returns {Set<string>}
   */
  const changesHeld = (searched) => {
    const pairs = searched.flatMap(({ id, last, touching }) => touching.map(({ sha, tree }) => ({ id, last: last.sha, ours: sha, tree })));
    const lastsRead = [...new Map(pairs.map(({ id, last }) => [last, { sha: last, id }])).values()];
    const below = new Map(lg.belowOwn(root, tip, key, lastsRead, ownersOf, inChain).map((under, at) => [lastsRead[at].sha, under]));
    const merged = lg.holdChanges(root, pairs.map(({ ours, tree, last }) => ({ ours, tree, theirs: last, base: below.get(last)?.own })));
    const holding = pairs.filter((_, at) => merged[at]);
    const laid = holding.flatMap((pair) => {
      const theirs = below.get(pair.last)?.laid;
      return theirs === undefined ? [] : [{ ...pair, theirs }];
    });
    const laidHeld = lg.holdChanges(root, laid);
    const unheld = new Set(laid.filter((_, at) => !laidHeld[at]).map(({ last, ours }) => pairOf(last, ours)));
    return new Set(holding.map(({ last, ours }) => pairOf(last, ours)).filter((pair) => !unheld.has(pair)));
  };
  /**
   * Whether the line held a copy of each of a task's own commits at a
   * commit of it (`lg.holdsCopy`), as a rebase or a cherry-pick of every one
   * leaves them — a copy of one alone never its change — for each of
   * `searched`'s.
   * @param {Searched[]} searched @returns {(id: string, sha: string) => boolean}
   */
  const copiesHeld = (searched) => {
    const { line, broughtIn } = lineOf();
    const places = new Map(line.map(({ sha }, at) => [sha, at]));
    const copies = lg.copiesOf(root, tip, since, [...new Set(searched.flatMap(({ commits }) => commits))], [...new Set(searched.flatMap(({ own }) => [...own]))]);
    /** @param {string} commit */
    const firstCopy = (commit) => Math.min(...(copies.get(commit) ?? []).map((copy) => places.get(broughtIn.get(copy) ?? '') ?? Infinity));
    const all = new Map(searched.map(({ id, commits }) => [id, commits.length === 0 ? Infinity : Math.max(...commits.map(firstCopy))]));
    return (id, sha) => (places.get(sha) ?? -1) >= (all.get(id) ?? Infinity);
  };
  /**
   * Where on the line the commit `sha` past the tip was cut from, of the
   * line's commits by their places, `places`: the place of the newest a
   * commit it holds past the tip has for a parent, -1 where none has one —
   * never by when any was made.
   * @param {string} sha @param {Map<string, number>} places
   */
  const cutAt = (sha, places) => {
    const listed = pastOf([sha]);
    return Math.max(-1, ...[...lg.heldIn(listed, sha)].flatMap((at) => /** @type {PathsCommit} */ (listed.get(at)).parents.map((parent) => places.get(parent) ?? -1)));
  };
  /**
   * For each task of `asked`, the oldest commit on the line past where its
   * last commit was cut (`cutAt`), changing a path its work changes, that
   * held its change (R25) — its change (`changesHeld`), or a copy of each of
   * its own commits (`copiesHeld`); the oldest past it, else the tip's, where
   * its work changes nothing past the tip; null where none did. Every
   * task's questions of every such commit are read at once, so a scan costs
   * the same reads however many tasks and commits it asks of.
   * @param {{id: string, last: ReadFrom}[]} asked @param {Map<string, Work>} work each task's, by its id
   * @returns {Map<string, Scanned>} by task
   */
  const scan = (asked, work) => {
    const { line } = lineOf();
    const places = new Map(line.map(({ sha }, at) => [sha, at]));
    const byLine = lineChanges();
    /** @type {Map<string, Scanned>} */
    const found = new Map();
    /** @type {Searched[]} */
    const searched = [];
    for (const { id, last } of asked) {
      const { paths: own, commits } = work.get(id) ?? { paths: new Set(), commits: [] };
      const after = line.slice(cutAt(last.sha, places) + 1);
      if (own.size === 0) found.set(id, { sha: last.sha, at: (after[0] ?? line.at(-1))?.sha ?? tip, byChange: false });
      else searched.push({ id, last, own, commits, touching: after.filter((commit) => [...(byLine.get(commit.sha) ?? [])].some((path) => own.has(path))) });
    }
    const held = changesHeld(searched);
    const copied = copiesHeld(searched.filter(({ last, touching }) => touching.length > 0 && !held.has(pairOf(last.sha, touching[0].sha))));
    for (const { id, last, touching } of searched) {
      const at = touching.find(({ sha }) => held.has(pairOf(last.sha, sha)) || copied(id, sha));
      found.set(id, { sha: last.sha, at: at?.sha ?? null, byChange: true });
    }
    return found;
  };
  /** `scan` of tasks read from their last commits, each task's work of its own commits (`workOfTasks`). @param {{id: string, last: ReadFrom}[]} asked */
  const scanLasts = (asked) => scan(asked, workOfTasks(asked.map(({ last }) => last.sha)));
  /**
   * The oldest commit on the line past where `last` was cut that held the
   * task's change (`scan`): read for every task no record names whose last
   * commit the tip does not hold at once, at the first asked; a last commit
   * read from elsewhere, or a recorded task's, on its own.
   * @param {TimedCommit} last @param {string} id @returns {Scanned}
   */
  const heldSince = (last, id) => {
    scanned ??= scanLasts([...lasts().last].filter(([held, commit]) => recordOf(held) === null && placing(commit.sha) === 'moved').map(([held, commit]) => ({ id: held, last: commit })));
    const read = scanned.get(id);
    return read !== undefined && read.sha === last.sha ? read : /** @type {Scanned} */ (scanLasts([{ id, last }]).get(id));
  };
  /**
   * Whether a commit stamped with the task `id`, or with none, has landed
   * (the header's): one its task's recorded tip holds, whatever the tip's
   * lines became since, or its last commit holds wherever its task has. A
   * commit inside a task, never one standing for it whole (`landedAs`).
   * @param {string} sha @param {string|null} id
   */
  const landedCommit = (sha, id) => {
    const at = placing(sha) ?? (lg.isAncestor(root, sha, tip) ? 'held' : 'moved');
    if (at !== 'moved') return at === 'held';
    const record = id === null ? null : recordOf(id);
    if (record !== null && (sha === record.tip || lg.isAncestor(root, sha, record.tip))) return true;
    if (id !== null && inLandedTask(sha, id)) return true;
    return holdsAt(sha, id) || merged().some((head) => lg.isAncestor(root, sha, head));
  };
  /** @param {TimedCommit} last @param {string} id @returns {Landed} */
  const landedBy = (last, id) => {
    const at = placing(last.sha) ?? (lg.isAncestor(root, last.sha, tip) ? 'held' : 'moved');
    if (at === 'held') return { landed: true, held: last.sha };
    if (at === 'apart') return { landed: false };
    const { at: since } = heldSince(last, id);
    if (since !== null) return { landed: true, at: since };
    return merged().some((head) => lg.isAncestor(root, last.sha, head)) ? { landed: true, at: pulledAt(last.sha) } : { landed: false };
  };
  /**
   * Where a task whose last commit, `sha`, a pull request the host merged
   * holds landed, its change gone from the line — as a later fix reverting
   * it in that pull request leaves it: as a task whose work changes nothing
   * past the tip lands (`scan`), at the oldest commit on the line past where
   * `sha` was cut (`cutAt`), else the tip's.
   * @param {string} sha
   */
  const pulledAt = (sha) => {
    const { line } = lineOf();
    return (line[cutAt(sha, new Map(line.map((commit, at) => [commit.sha, at]))) + 1] ?? line.at(-1))?.sha ?? tip;
  };
  /** @type {Map<string, {mine: TimedCommit|null, last: TimedCommit|null, how: Landed}>} */
  const byLast = new Map();
  /** A task's last commit — its newest own, where the caller reads one — and how it landed, read from that commit. @param {string} id */
  const lastRead = (id) => {
    if (!byLast.has(id)) {
      const mine = own(id);
      const last = mine ?? lasts().last.get(id) ?? null;
      const oldest = naming(id).at(-1);
      /** @type {Landed} */
      const how = last !== null ? landedBy(last, id) : oldest !== undefined ? { landed: true, named: oldest.sha } : { landed: false };
      byLast.set(id, { mine, last, how });
    }
    return /** @type {{mine: TimedCommit|null, last: TimedCommit|null, how: Landed}} */ (byLast.get(id));
  };
  /** @type {Map<string, Set<string>>} */
  const tipHolds = new Map();
  /** The commits since the unit's work began on the first-parent line of the task's branch's tip (`lg.taskLine`), read once: a merge's other parents never on it. @param {string} id */
  const heldByTip = (id) => {
    const at = tips().get(id);
    if (at === undefined) return new Set();
    if (!tipHolds.has(at)) tipHolds.set(at, new Set(lg.taskLine(graphOfTips().bySha, at).map(({ sha }) => sha)));
    return /** @type {Set<string>} */ (tipHolds.get(at));
  };
  /** Whether the task `other`'s work lands with the task `id`'s branch, its chain: `other`'s branch's tip on the first-parent line of `id`'s, as a task cut from another's branch holds it. @param {string} id @param {string} other */
  const inChain = (id, other) => {
    const at = tips().get(other);
    return other !== id && at !== undefined && heldByTip(id).has(at);
  };
  /** @type {Set<string>} */
  const asking = new Set();
  /**
   * The task, landed, whose branch's tip holds this task's (the ancestor
   * rule): a chain landed whole lands every task in it, however the later
   * rewrote the earlier's lines — its id, null for none, and for a task
   * with no commit of its own, whose branch holds no work to land. Only a
   * task whose tip has moved against the revision (`lg.standings`) is
   * asked: one standing apart never landed, and one the revision holds
   * holds this task's tip there too, landing it by its own — so a chain
   * of tasks none of which landed by a copy is read with no call of its own.
   * @param {string} id @returns {string|null}
   */
  const landedWith = (id) => {
    if (asking.has(id) || !tips().has(id) || lastRead(id).last === null) return null;
    asking.add(id);
    try {
      return [...tips()].find(([other, at]) => placing(at) === 'moved' && inChain(other, id) && read(other).landed)?.[0] ?? null;
    } finally {
      asking.delete(id);
    }
  };
  /** @type {Map<string, TaskLanding>} */
  const tasks = new Map();
  /** @type {Set<string>} the tasks whose landing this read was asked of, read or placed */
  const asked = new Set();
  /** A task's read (`TaskLanding`), landed where its branch's tip has (`tipLanded`). @param {string} id */
  const read = (id) => {
    asked.add(id);
    if (!tasks.has(id)) {
      const record = recordOf(id);
      if (record !== null) {
        tasks.set(id, { own: own(id)?.sha ?? null, found: lasts().last.get(id)?.sha ?? record.tip, held: true, landed: !changedSince(id) });
        return /** @type {TaskLanding} */ (tasks.get(id));
      }
      const { mine, last, how } = lastRead(id);
      const landed = (last === null ? how.landed : tipLanded(id, last)) || landedWith(id) !== null;
      tasks.set(id, { own: mine?.sha ?? null, found: last?.sha ?? null, held: how.landed || last !== null, landed });
    }
    return /** @type {TaskLanding} */ (tasks.get(id));
  };
  /**
   * Whether the task `id` has landed and its last commit holds `sha` — read
   * as it stands, never kept as the task's read, as a quick-fix's close
   * asks it of the branch it then cuts again (fix-branch.cjs).
   * @param {string} sha @param {string} id
   */
  const inLandedTask = (sha, id) => {
    const last = own(id) ?? lasts().last.get(id) ?? null;
    return last !== null && landedBy(last, id).landed && (last.sha === sha || lg.isAncestor(root, sha, last.sha));
  };
  /**
   * Where the task landed by its branch's tip, its last commit not landed:
   * where the tip did, read by its change (`readWholes`); null where it has
   * not.
   * @param {string} id @returns {string|null}
   */
  const tipLanding = (id) => {
    const at = tipOf(id);
    return at === null || !read(id).landed ? null : wholeAt.get(wholeOf(id, at)) ?? null;
  };
  /** @param {string} id @returns {string|null} */
  const landingOf = (id) => {
    const record = recordOf(id);
    if (record !== null) return record.commit;
    const { how } = lastRead(id);
    const above = landedWith(id);
    if (!how.landed) return above !== null ? landingOf(above) : tipLanding(id);
    if ('held' in how) return lineOf().broughtIn.get(how.held) ?? null;
    if ('at' in how) return how.at;
    return lineOf().broughtIn.get(how.named) ?? null;
  };
  /** A task's landing (the header's), null where it has none. @param {TaskRef} ref @returns {string|null} */
  const landing = (ref) => {
    asked.add(taskId(ref));
    return landingOf(taskId(ref));
  };
  /** The unit's task a stamp names, as a ref; none for another unit's, or no stamp. @param {string|null} value @returns {TaskRef[]} */
  const unitTask = (value) => {
    const step = value === null ? null : stepOfId(value);
    return step?.prefix === unit ? [{ unit, phase: step.phase, n: step.n }] : [];
  };
  /** @type {Map<string, PathsCommit>} */
  const pastTip = new Map();
  /** @type {Set<string>} */
  const listedFrom = new Set();
  /**
   * The commits past the tip that each of `shas` holds, by their commits
   * (`lg.commitPaths`), each read once: those asked that no commit read
   * before holds, in a call of their own.
   * @param {string[]} shas @returns {Map<string, PathsCommit>}
   */
  const pastOf = (shas) => {
    const fresh = [...new Set(shas)].filter((sha) => !listedFrom.has(sha) && !pastTip.has(sha));
    if (fresh.length === 0) return pastTip;
    for (const commit of lg.commitPaths(root, [...fresh, '--not', tip], key)) pastTip.set(commit.sha, commit);
    for (const sha of fresh) listedFrom.add(sha);
    return pastTip;
  };
  /** The commits every task's branch's tip holds since the unit's work began, on the tip or past it, each after its parents, read once for every revision (`workIn`). */
  const graphOfTips = work.graph;
  /** @type {{lowest: Map<string, string>, firsts: Map<string, import('./landing-git.cjs').GraphCommit>}|undefined} */
  let byTips;
  /**
   * Each commit of a task's line past the oldest stamped with it
   * (`pastStamped`), by the task whose branch's tip is the lowest so holding
   * it — holding the fewest commits since the unit's work began, the
   * earlier task where two hold as many (`ownersOf`); and, by each task, that
   * oldest commit.
   */
  const ownedByTips = () => {
    if (byTips !== undefined) return byTips;
    const { bySha } = graphOfTips();
    const holding = [...tips()].map(([id, sha]) => ({ id, held: lg.heldIn(bySha, sha).size, ...pastStamped(bySha, sha, id) }))
      .sort((one, other) => one.held - other.held || byStep(one.id, other.id));
    /** @type {Map<string, string>} */
    const lowest = new Map();
    for (const { id, past } of holding) for (const sha of past) if (!lowest.has(sha)) lowest.set(sha, id);
    byTips = { lowest, firsts: new Map(holding.flatMap(({ id, first }) => (first === undefined ? [] : [[id, first]]))) };
    return byTips;
  };
  /** @type {Map<string, string[]>|undefined} */
  let namedBy;
  /** The tasks each commit on the tip names by its `Task:` lines, by the commit, read once. */
  const namesOn = () => {
    if (namedBy === undefined) {
      namedBy = new Map();
      for (const [id, commits] of marked().named) for (const { sha } of commits) namedBy.set(sha, [...(namedBy.get(sha) ?? []), id]);
    }
    return namedBy;
  };
  /**
   * Whose work the commit `sha` is, stamped with `stamps`, wherever it
   * stands since the unit's work began (the header's, R29, R31, R32): those
   * tasks; else those a commit on the tip names by its `Task:` lines, a
   * landing marking its tasks' landed copy; else the task whose branch's tip
   * is the lowest holding it on its line past the oldest commit stamped
   * with it (`pastStamped`), every tip read at once, at the first asked;
   * else no task's.
   * @param {string} sha @param {string[]} stamps @returns {string[]} by their internal ids
   */
  const ownersOf = (sha, stamps) => {
    if (stamps.length > 0) return stamps;
    const landedThere = landedByRecord().get(sha);
    if (landedThere !== undefined) return landedThere;
    const named = namesOn().get(sha);
    if (named !== undefined) return named;
    const id = ownedByTips().lowest.get(sha);
    return id === undefined ? [] : [id];
  };
  /** A commit `lg.stampedPast` lists, with the unit's tasks whose work it is (`ownersOf`), by their internal ids. @param {{sha: string, value: string|null}} commit */
  const owning = ({ sha, value }) => ({ sha, owners: ownersOf(sha, value === null ? [] : [value]).filter((id) => unitTask(id).length > 0) });
  /**
   * Each commit the commit `rev` holds past the tip and each of `past`, oldest
   * first, with the unit's tasks whose work it is (`owning`).
   * @param {string} rev @param {string[]} past @returns {{sha: string, owners: string[]}[]}
   */
  const ownedPast = (rev, past) => lg.stampedPast(root, rev, [tip, ...past], key).map(owning);
  /**
   * Each commit the commit `rev` holds since the unit's work began, on the
   * tip or past it, oldest first, with the unit's tasks whose work it is
   * (`owning`).
   * @param {string} rev @returns {{sha: string, owners: string[]}[]}
   */
  const ownedSince = (rev) => lg.stampedPast(root, rev, [], key, since).map(owning);
  /** The unit's tasks whose work the commits `rev` holds past the tip are (`ownersOf`), oldest first, each once. @param {string} rev @returns {TaskRef[]} */
  const ownersPast = (rev) => [...new Set(ownedPast(rev, []).flatMap(({ owners }) => owners))].flatMap(unitTask);
  /**
   * The unit's tasks whose work the commit `rev` holds past the tip and each
   * of `past` that has not landed (the header's, R31): each whose work a
   * commit there is (`ownedPast`), where one of those commits has not
   * landed, read as a commit inside its task (`landedCommit`), its newest
   * first — oldest first, each once.
   * @param {string} rev @param {string[]} past @returns {TaskRef[]}
   */
  const heldPast = (rev, past) => {
    /** @type {Map<string, string[]>} */
    const byTask = new Map();
    for (const { sha, owners } of ownedPast(rev, past)) for (const id of owners) byTask.set(id, [sha, ...(byTask.get(id) ?? [])]);
    return [...byTask].filter(([id, shas]) => shas.some((sha) => !landedCommit(sha, id))).flatMap(([id]) => unitTask(id));
  };
  /** Whether a commit past the tip is the task `id`'s work read whole (the header's): its, or no task's (`ownersOf`). @param {string} id @returns {(commit: PathsCommit) => boolean} */
  const wholeWorkOf = (id) => (commit) => {
    const owners = ownersOf(commit.sha, commit.values);
    return owners.length === 0 || owners.includes(id);
  };
  /** @type {Map<string, Set<string>>|undefined} */
  let ownCopies;
  /**
   * The copies on the tip of the commits past it that are each task's work
   * (`ownersOf`), read from where its branch stands (`tipOf`) — as a rebase
   * merged by a host, or cherry-picks, lay them, the person's own copies
   * carrying no stamp — every task's read at once, at the first asked
   * (`lg.copiesOf`).
   * @returns {Map<string, Set<string>>} by the copy, the tasks whose work its commit is, by their internal ids
   */
  const copiesOwned = () => {
    if (ownCopies !== undefined) return ownCopies;
    ownCopies = new Map();
    const standing = [...new Set([...tips().keys(), ...lasts().last.keys()])].flatMap((id) => {
      const at = tipOf(id);
      return at !== null && (placing(at) ?? (lg.isAncestor(root, at, tip) ? 'held' : 'moved')) === 'moved' ? [{ id, at }] : [];
    });
    if (standing.length === 0) return ownCopies;
    const listed = pastOf(standing.map(({ at }) => at));
    /** @type {Map<string, Set<string>>} each commit, by the tasks whose work it is */
    const owning = new Map();
    for (const { id, at } of standing) {
      const own = [...lg.heldIn(listed, at)].map((sha) => /** @type {PathsCommit} */ (listed.get(sha))).filter((commit) => !commit.merge && ownersOf(commit.sha, commit.values).includes(id));
      for (const commit of own) owning.set(commit.sha, new Set([...(owning.get(commit.sha) ?? []), id]));
    }
    const paths = [...new Set([...owning.keys()].flatMap((sha) => [.../** @type {PathsCommit} */ (listed.get(sha)).paths]))];
    for (const [sha, copies] of lg.copiesOf(root, tip, since, [...owning.keys()], paths)) {
      for (const copy of copies) ownCopies.set(copy, new Set([...(ownCopies.get(copy) ?? []), .../** @type {Set<string>} */ (owning.get(sha))]));
    }
    return ownCopies;
  };
  /**
   * The commits of the tip's line marking the task, each the one that
   * brought in a commit naming it or stamped with it — its landing's name,
   * its own commits and their copies — one that is its work there
   * (`ownersOf`), as a fast-forward or a merge commit lays it, or a copy
   * there of one past it (`copiesOwned`), the person's own among them.
   * @param {TaskRef} ref
   */
  const marking = (ref) => {
    const id = taskId(ref);
    const { named, stamped } = marked();
    const { broughtIn } = lineOf();
    const held = graphOfTips().order.filter(({ sha, values }) => broughtIn.has(sha) && ownersOf(sha, values).includes(id)).map(({ sha }) => sha);
    const copied = [...copiesOwned()].filter(([, ids]) => ids.has(id)).map(([sha]) => sha);
    return [...new Set([...[...(named.get(id) ?? []), ...(stamped.get(id) ?? [])].map(({ sha }) => sha), ...held, ...copied].map((sha) => broughtIn.get(sha) ?? sha))];
  };
  /** @type {Map<string, Scanned>|undefined} */
  let firstScanned;
  /**
   * Where the oldest commit stamped with the task that its branch's tip
   * holds landed, read from it as from a last commit: the commit of the
   * line that brought it in, where the tip holds it; else by its change
   * (`scanLasts`), every task's read at once, at the first asked — never
   * one whose first commit is its last, whose landing is the task's; null
   * where it has none, or none landed it.
   * @param {string} id
   */
  const firstLanding = (id) => {
    const { firsts } = ownedByTips();
    const first = firsts.get(id);
    if (first === undefined) return null;
    const { broughtIn } = lineOf();
    if (broughtIn.has(first.sha)) return broughtIn.get(first.sha) ?? null;
    firstScanned ??= scanLasts([...firsts].filter(([held, { sha }]) => !broughtIn.has(sha) && sha !== lastRead(held).last?.sha).map(([held, { sha }]) => ({ id: held, last: { sha } })));
    return firstScanned.get(id)?.at ?? null;
  };
  /**
   * A task's landings, where it has landed (the header's): its landing, and
   * where its first commit landed (`firstLanding`) — a task landed,
   * changed, and landed again has both, one whose first commit is its last
   * its landing alone.
   * @param {TaskRef} ref @returns {string[]}
   */
  const landings = (ref) => {
    const id = taskId(ref);
    asked.add(id);
    const record = recordOf(id);
    if (record !== null) return [...new Set([record.first, record.commit])];
    const at = landingOf(id);
    return at === null ? [] : [...new Set([firstLanding(id) ?? at, at])];
  };
  /**
   * Where the commit `sha` past the tip, the task's, landed (the header's),
   * read whole: the task's landing, where `sha` holds its last commit and
   * past that no commit but merges; else the oldest commit on the line made
   * since it that holds its change — its copy, a copy of each commit of its
   * work, or a squash of them (`scan`) — its work every commit it holds
   * past the tip of the task's or of no task's; null where none does, as
   * for a commit past its task's landing not landed again.
   * @param {TaskRef} ref @param {string} sha @returns {string|null}
   */
  const landedCopy = (ref, sha) => {
    const id = taskId(ref);
    const listed = pastOf([sha]);
    if (!listed.has(sha)) return null;
    const own = [...lg.heldIn(listed, sha)].map((at) => /** @type {PathsCommit} */ (listed.get(at))).filter(wholeWorkOf(id));
    if (standsAsLast(id, sha, listed, own)) return landingOf(id);
    return scan([{ id, last: { sha } }], new Map([[id, workOf(own)]])).get(id)?.at ?? null;
  };
  /**
   * Whether the commit `sha` past the tip stands for the task `id` as its
   * last commit does, that commit landed: `sha` holds it, and past it no
   * commit of `own` — the task's work `sha` holds past the tip, or no
   * task's (`wholeWorkOf`), its last among them where the tip lacks it —
   * but merges, as the default branch merged back leaves it, whether the
   * tip holds that last commit or not.
   * @param {string} id @param {string} sha @param {Map<string, PathsCommit>} listed the commits past the tip, `sha`'s among them @param {PathsCommit[]} own
   */
  const standsAsLast = (id, sha, listed, own) => {
    const { last, how } = lastRead(id);
    if (!how.landed || last === null) return false;
    const below = own.some((commit) => commit.sha === last.sha) ? lg.heldIn(listed, last.sha) : 'held' in how && lg.isAncestor(root, last.sha, sha) ? new Set() : null;
    return below !== null && own.every((commit) => commit.merge || below.has(commit.sha));
  };
  /** @type {Map<string, boolean>} by the task's internal id and the commit read for it */
  const wholes = new Map();
  /** @type {Map<string, string>} where each read by its change landed, by the task's internal id and the commit read for it */
  const wholeAt = new Map();
  /** @param {string} id @param {string} sha */
  const wholeOf = (id, sha) => `${id} ${sha}`;
  /**
   * Whether each task of `asked` has landed, read whole from `sha` (the
   * header's, `landedAs`) — every one's questions at once, each kept: held
   * by the tip; never where laid on it; as its task has, read from its last
   * commit, where `sha` is that commit, or stands for it, landed
   * (`standsAsLast`); else by its change (`scan`) — as the default branch
   * merged back settling a conflict with later work leaves it — its work
   * every commit `sha` holds past the tip of the task's or of no task's
   * (`ownersOf`).
   * @param {{id: string, sha: string}[]} asked
   */
  const readWholes = (asked) => {
    const fresh = asked.filter(({ id, sha }) => !wholes.has(wholeOf(id, sha)));
    const unplaced = fresh.filter(({ sha }) => placing(sha) === undefined).map(({ sha }) => sha);
    const placed = unplaced.length === 0 ? new Map() : lg.standings(root, tip, unplaced);
    /** @type {{id: string, sha: string}[]} */
    const past = [];
    for (const { id, sha } of fresh) {
      const at = placing(sha) ?? placed.get(sha);
      if (sha === lastRead(id).last?.sha) wholes.set(wholeOf(id, sha), lastRead(id).how.landed);
      else if (at !== 'moved') wholes.set(wholeOf(id, sha), at === 'held');
      else past.push({ id, sha });
    }
    if (past.length === 0) return;
    const listed = pastOf(past.map(({ sha }) => sha));
    /** @type {{id: string, last: ReadFrom}[]} */
    const searched = [];
    /** @type {Map<string, Work>} */
    const work = new Map();
    for (const { id, sha } of past) {
      const own = [...lg.heldIn(listed, sha)].map((at) => /** @type {PathsCommit} */ (listed.get(at))).filter(wholeWorkOf(id));
      if (standsAsLast(id, sha, listed, own)) wholes.set(wholeOf(id, sha), true);
      else {
        searched.push({ id, last: { sha } });
        work.set(id, workOf(own));
      }
    }
    if (searched.length === 0) return;
    const found = scan(searched, work);
    for (const { id, last } of searched) {
      const { at } = /** @type {Scanned} */ (found.get(id));
      wholes.set(wholeOf(id, last.sha), at !== null);
      if (at !== null) wholeAt.set(wholeOf(id, last.sha), at);
    }
  };
  /** @param {string} id @param {string} sha */
  const wholeLanded = (id, sha) => {
    readWholes([{ id, sha }]);
    return /** @type {boolean} */ (wholes.get(wholeOf(id, sha)));
  };
  /**
   * Whether the task has landed, `sha` taken for its last commit — a commit
   * standing for the task whole, as the one its branch opened at, its pull
   * request's head or its branch's tip: a task's read, never a commit's
   * (`readWholes`).
   * @param {TaskRef} ref @param {string} sha
   */
  const landedAs = (ref, sha) => {
    const id = taskId(ref);
    const record = recordOf(id);
    return (record !== null && (sha === record.tip || lg.isAncestor(root, sha, record.tip))) || wholeLanded(id, sha);
  };
  /** Where each task's branch stands: its branch here, else its last commit, null for neither. @param {string} id */
  const tipOf = (id) => tips().get(id) ?? lastRead(id).last?.sha ?? null;
  const readTips = once(() => readWholes([...tips()].flatMap(([id, sha]) => {
    if (recordOf(id) !== null) return [];
    const { last } = lastRead(id);
    return last === null || last.sha === sha ? [] : [{ id, sha }];
  })));
  /**
   * Whether the task, its last commit `last`, has landed where its branch's
   * tip has (`landedAs`): every task's tip standing past its last commit
   * read at once, at the first asked.
   * @param {string} id @param {TimedCommit} last
   */
  const tipLanded = (id, last) => {
    const at = /** @type {string} */ (tipOf(id));
    if (at !== last.sha) readTips();
    return wholeLanded(id, at);
  };
  const readTaken = once(() => readWholes([...taken()].flatMap(([id, sha]) => (sha === tipOf(id) || read(id).landed ? [] : [{ id, sha }]))));
  /**
   * Where the task stands against its landing (the header's, R29): landed
   * where its branch's tip has (`read`); changed after its landing where
   * that tip has not and the commit its driver took it at has, whatever its
   * branch gained since; else never landed — every task the driver took
   * read at once, at the first asked.
   * @param {TaskRef} ref @returns {Standing}
   */
  const stands = (ref) => {
    const id = taskId(ref);
    if (recordOf(id) !== null) return changedSince(id) ? 'changed' : 'landed';
    if (read(id).landed) return 'landed';
    const at = taken().get(id);
    if (at === undefined || at === tipOf(id)) return 'unlanded';
    readTaken();
    return wholeLanded(id, at) ? 'changed' : 'unlanded';
  };
  /**
   * Where an unrecorded task landed on the tip, for a verb acting on its
   * landing to record (landing-record.cjs): its landing and the tip that
   * landed — its branch's tip where that has landed, else the commit its
   * driver took where the task changed after its landing, as `took` reads
   * it; null for a recorded task, or one not landed.
   * @param {string} id @param {() => Map<string, string>} took @returns {{commit: string, tip: string}|null}
   */
  const unrecorded = (id, took) => {
    if (recordOf(id) !== null) return null;
    if (read(id).landed) {
      const commit = landingOf(id);
      return commit === null ? null : { commit, tip: tipOf(id) ?? commit };
    }
    const at = took().get(id);
    const ref = unitTask(id);
    if (at === undefined || ref.length === 0 || stands(ref[0]) !== 'changed') return null;
    const commit = wholeAt.get(wholeOf(id, at)) ?? landingOf(id);
    return commit === null ? null : { commit, tip: at };
  };
  /**
   * The landings of the tasks this read was asked of, read or placed, that
   * no record names (`unrecorded`), in their order, by their internal ids —
   * a task changed after its landing found only where `took` reads the
   * commit its driver took it at, the driver's own read where none is given.
   * @param {() => Map<string, string>} [took]
   */
  const found = (took = taken) => [...asked].sort(byStep).flatMap((id) => {
    const at = unrecorded(id, took);
    return at === null ? [] : [{ id, ...at }];
  });
  /**
   * Where an unrecorded task landed here before a land verb lands it again
   * (R30): its landing, as `found` reads it, else the oldest commit naming
   * it; null where it had none.
   * @param {TaskRef} ref @param {() => Map<string, string>} took
   */
  const earlier = (ref, took) => unrecorded(taskId(ref), took)?.commit ?? naming(taskId(ref)).at(-1)?.sha ?? null;
  /**
   * Where the task's branch here was rewritten after its work landed by
   * hand, no verb having recorded it (the stated edge, F1): the newest
   * commit stamped with it anywhere the repository holds it that its
   * branch's tip does not hold, landed as a last commit lands
   * (`landedBy`), with its landing; null for a task recorded, landed, or
   * with no branch here, where no commit its branch dropped landed, where
   * its branch holds nothing past the revision, where a commit stamped
   * with it that its branch holds landed too — its copies landed by a
   * rebase, its branch never rewritten — or where its branch never stood
   * at that commit, as its reflog says, as a commit stamped with it made
   * elsewhere and merged by hand leaves it, never its landing (R28;
   * `lg.heldOnce`, read last). The branch is named with them.
   * @param {TaskRef} ref @returns {{branch: string, sha: string, landing: string|null}|null}
   */
  const rewritten = (ref) => {
    const id = taskId(ref);
    const at = tips().get(id);
    if (at === undefined || recordOf(id) !== null) return null;
    const held = lg.heldIn(graphOfTips().bySha, at);
    const stamped = anywhere().get(id) ?? [];
    const off = stamped.find(({ sha }) => !held.has(sha));
    if (off === undefined || read(id).landed) return null;
    const how = landedBy(off, id);
    if (!how.landed || lg.isAncestor(root, at, tip) || stamped.some((commit) => held.has(commit.sha) && landedBy(commit, id).landed)) return null;
    const branch = /** @type {string} */ (work.names().get(id));
    if (!lg.heldOnce(root, branch, off.sha)) return null;
    const landing = 'at' in how ? how.at : lineOf().broughtIn.get('held' in how ? how.held : how.named) ?? null;
    return { branch, sha: off.sha, landing };
  };
  /** The unit's tasks the repository holds work of — stamped, on a branch of theirs, or named on the tip — by their refs. @returns {TaskRef[]} */
  const known = () => [...new Set([...lasts().last.keys(), ...tips().keys(), ...marked().named.keys()])].sort(byStep).flatMap(unitTask);
  /** The unit's tasks with a branch here, by their refs: those whose branch `rewritten` reads. @returns {TaskRef[]} */
  const branched = () => [...tips().keys()].sort(byStep).flatMap(unitTask);
  /**
   * Where the task's own work starts on its branch (R32): the first parent
   * of the oldest commit stamped with it on its branch's line
   * (`pastStamped`), each commit below that no work of its; null where its
   * branch here holds none.
   * @param {TaskRef} ref @returns {string|null}
   */
  const ownStart = (ref) => ownedByTips().firsts.get(taskId(ref))?.parents[0] ?? null;
  return {
    task: (/** @type {TaskRef} */ ref) => read(taskId(ref)),
    landedCommit,
    landedAs,
    stands,
    heldPast,
    marking,
    line: () => lineOf().line,
    landing,
    landings,
    landedCopy,
    ownedSince,
    ownersPast,
    ownStart,
    rewritten,
    found,
    earlier,
    known,
    branched,
    asked: () => [...asked],
    taskTip: (/** @type {TaskRef} */ ref) => tipOf(taskId(ref)),
  };
}

/** One repository's read of what has landed (`repoLanded`). @typedef {ReturnType<typeof repoLanded>} RepoLanded */

/**
 * What has landed on each revision of one repository asked, by its commit
 * or a ref nothing moves while the read is kept (`repoLanded`): each read
 * once, every task's last commit and branch's tip read once for all of
 * them (`work`, where the caller reads them too) — and the commit a driver
 * took each task at, where `taken` reads it, and the repository's landing
 * records (landing-record.cjs), a recorded task's change read against the
 * default branch's tip `trunk` reads, where it reads one.
 * @param {string} root @param {string} unit @param {string|null} since @param {() => Map<string, string>} [taken] by the task's internal id
 * @param {Map<string, LandingRecord>} [recorded] by the task's internal id @param {ReturnType<typeof workIn>} [work] @param {() => string|null|undefined} [trunk]
 * @returns {LandedIn}
 */
function landedIn(root, unit, since, taken, recorded, work = workIn(root, unit, since), trunk) {
  /** @type {Map<string, RepoLanded>} */
  const revisions = new Map();
  /** @param {string} tip */
  const read = (tip) => {
    if (!revisions.has(tip)) revisions.set(tip, repoLanded(root, unit, tip, { since, work, taken, recorded, ...(trunk === undefined ? {} : { trunk: () => trunk() ?? tip }) }));
    return /** @type {RepoLanded} */ (revisions.get(tip));
  };
  return Object.assign(read, { made: () => [...revisions.values()] });
}

/** What has landed on each revision of one repository asked (`landedIn`), and the reads made so far, in the order asked (`made`). @typedef {((tip: string) => RepoLanded) & {made: () => RepoLanded[]}} LandedIn */

/**
 * A task's landing across repositories, from each one's read of it: where
 * it holds work, whether that work has landed in every one, one at least,
 * and in any.
 * @template R @param {{read: R, task: TaskLanding}[]} reads
 */
function landedAcross(reads) {
  const each = reads.filter(({ task }) => task.held);
  return { held: each.length > 0, landed: each.length > 0 && each.every(({ task }) => task.landed), landedAny: each.some(({ task }) => task.landed), each };
}

/**
 * What has landed of a feature's, an epic's or a bugfix's tasks, from
 * `since` (the header's): each repository read on its default branch here,
 * as first asked — a repository with no default branch to land on holds
 * none — or on another revision (`on`), each task's last commit there read
 * once for every revision, each recorded landing read from its record
 * (landing-record.cjs); and where each task no record names that the reads
 * of the default branches were asked of landed (`found`), for a verb acting
 * on its landing to record — no task read for it that was not asked.
 * @param {string} cwd @param {string} unit @param {Repo[]} repos the project's @param {string|null} since
 * @param {Record<string, any>|null} [manifest] the unit's, its landing records read from it
 * @returns {{landed: (ref: TaskRef) => boolean, inRepo: (repo: Repo) => RepoLanded|null, on: (repo: Repo, tip: string) => RepoLanded, found: () => import('./landing-record.cjs').Landing[]}}
 */
function unitLanded(cwd, unit, repos, since, manifest = loadWorkUnitManifest(cwd, unit)) {
  /** @type {Map<string, (tip: string) => RepoLanded>} */
  const byRepo = new Map();
  /** @param {Repo} repo @param {string} tip */
  const on = (repo, tip) => {
    if (!byRepo.has(repo.path)) byRepo.set(repo.path, landedIn(repo.path, unit, since, undefined, recordsIn(manifest, repoName(repo)), undefined, () => onBranch(cwd, repo, (at) => at)));
    return /** @type {(tip: string) => RepoLanded} */ (byRepo.get(repo.path))(tip);
  };
  /** @type {Map<Repo, RepoLanded|null>} */
  const reads = new Map();
  /** @param {Repo} repo */
  const inRepo = (repo) => {
    if (!reads.has(repo)) reads.set(repo, onBranch(cwd, repo, (tip) => on(repo, tip)));
    return /** @type {RepoLanded|null} */ (reads.get(repo));
  };
  /** @type {Map<string, boolean>} */
  const landed = new Map();
  return {
    landed: (ref) => {
      const shown = shownTask(ref);
      if (!landed.has(shown)) {
        landed.set(shown, landedAcross(repos.flatMap((repo) => {
          const read = inRepo(repo);
          return read === null ? [] : [{ read, task: read.task(ref) }];
        })).landed);
      }
      return /** @type {boolean} */ (landed.get(shown));
    },
    inRepo,
    on,
    found: () => repos.flatMap((repo) => {
      const read = byRepo.has(repo.path) ? onBranch(cwd, repo, (tip) => on(repo, tip)) : null;
      return read === null ? [] : foundIn(read, repo);
    }),
  };
}

/**
 * The landings a read of a repository's default branch found of the tasks
 * it was asked of that no record names (`found`, a task changed since
 * found at the commit `took` reads), as `recordLandings` takes them.
 * @param {RepoLanded} read @param {Repo} repo @param {() => Map<string, string>} [took]
 * @returns {import('./landing-record.cjs').Landing[]}
 */
function foundIn(read, repo, took) {
  return read.found(took).map((at) => ({ ...at, repo: repoName(repo), root: repo.path, by: /** @type {const} */ ('read') }));
}

/** A unit's read of what has landed (`unitLanded`). @typedef {ReturnType<typeof unitLanded>} UnitLanded */

/**
 * What `read` makes of a repository's default branch here, null where it
 * has none to land on.
 * @template T @param {string} cwd @param {Repo} repo @param {(tip: string) => T} read @returns {T|null}
 */
function onBranch(cwd, repo, read) {
  let branch;
  try {
    branch = lg.landingBranch(cwd, repo);
  } catch {
    return null;
  }
  return read(`refs/heads/${branch}`);
}

module.exports = { repoLanded, landedIn, landedAcross, unitLanded, foundIn, workIn };
