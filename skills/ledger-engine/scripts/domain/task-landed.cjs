'use strict';

// ---------------------------------------------------------------------------
// Domain ring: whether a task has landed (7.2.22), one read for every work
// type — a feature's, an epic's and a bugfix's tasks, a quick-fix's fixes,
// and the fix tasks of every review phase — and every driver's question of
// it (landing.cjs gives each its repository's read, `landedOn`).
//
// A task's landing point in a repository (`pointOf`, L) is the one source
// of every read of its landing and every merge of its work, by every
// driver: the commit of its work that landed most recently, and the commit
// of the revision's first-parent line that landed it. It is its landing
// record's tip (landing-record.cjs), while git holds it; or, newer than
// that, the newest landing of its line — its branch's tip's first-parent
// line down to the oldest commit there stamped with it — each commit of it
// landed where the revision holds it, at the commit that brought it in, or
// where a commit of the line past where it was cut, changing a path its work
// changes, is its copy — merging it into that commit's parent over the
// commit below it on its line giving that commit's tree — where the commits
// below it on its line landed, as a rebase's copies lay it and a cherry-pick
// of one commit of several never does (`linePlacesOf`), or a squash of its
// work as it then stood, merging it there over their merge base giving that
// tree — or, no commit of the line giving it so, giving it but at paths no
// commit of the task's changes, on its branch or dropped from it, as a
// squash carrying a change of the person's own, or other tasks' work,
// beside its own leaves it — or over where its own work starts on its line,
// as the engine squashes a task cut from another's branch — read so only
// where no landing of the line stands before that commit (`linesLanded`),
// the merges straight past it on its line with it, what a merge brings in
// never its work (R32); or, for a task with a branch of its own — never a quick-fix's
// fix, its fixes sharing one — the newest commit of its line a commit of
// another task's line holds that a squash of that task's work over their
// merge base landed, a chain landed whole landing every task in it — never
// through copies, or a squash of that task's own work alone — where newer
// on its line than its own landing's, else whichever landed first
// (`readLines`); else, a task no record names, the commit its driver took
// it at, where its line landed up to it — that commit alone where none of
// it is stamped with the task (`driverPoints`) — read before any read of
// its tip; else, the last fallback, its tip read whole over where it was
// cut (`landedWhole`), never for a task whose line lies on the revision
// past none of it; else, for a task a later task's branch is cut from
// whose tip that fallback found landed, that landing, the whole read there holding its
// work (`beneath`, S2); else none, the task never landed. A point of a
// task whose own work starts on work the revision lacks — cut from another
// task's branch — is judged by its own change (`ownJudged`, S3): where
// the commit that landed it lacks the change from there to its tip, as a
// squash by hand of its branch over its parent's squash leaves it, the
// point's tip is where its own work starts; its record holds the point as
// its read set it, judged again at every read. A task has
// landed where its work — its branch's tip; a quick-fix's task's, its
// newest own commit on the quick-fix's branch; its branch gone, its newest
// stamped commit anywhere — holds no change past that point: merging it
// into the revision over the point's tip changes nothing; it has changed
// after its landing (R29) where that merge changes something
// (`changedSince`): what a branch gains after its landing is read in one
// shape, plain new commits on its landing point's tip, or that work brought
// onto the revision since — as `git rebase --onto` lays it, or the
// engine's own merge bringing it up — and a branch that tip holds, behind
// it, has gained nothing. Its work to land is the change from that point to
// its tip, landed over it (`landedTip`) — over their merge base where its
// branch holds the landing since, its work brought onto the revision
// (`landingBase`). A task recorded has landed wherever the
// revision's first-parent line holds its record's commit; its landings are
// its record's first and last, and its record's commit is its work alone
// (R32). A task no record names — landed by hand and not yet read, or by the
// engine before the record — is read once, at the first verb acting on its
// landing, which records each such task it was asked of that it finds
// landed, its landing point's commit its first (`found`); a read for
// display records nothing. Anything else a branch does after its landing
// `open`, `phase` and `finish` refuse before anything moves, `open`
// before it reads the task landed (landing.cjs): its branch apart from its
// landing point (`apart`) — holding neither its tip nor the commit that
// landed it, nor held by that tip — rewritten or behind it, its way on the
// branch's work laid on that tip, never taking landed work off the default
// branch; and a merge on its branch past that tip as its record or read set
// it, never the lower one its own change judges it by, the engine's own
// aside (`mergedPast`), its way on the branch's own commits since that tip
// made again on the default branch. Known edges: a task landed by hand
// that no verb read, then rewritten by hand, is read by its content; a
// merge straight past such a landing carrying no change of its own is read
// as part of it, as one made before it is.
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
// (`lg.lastStamped`) — where that line holds none, the newest its tip holds,
// as its branch fast-forwarded onto a default branch a merge commit landed
// it on leaves it; else, its branch gone, the newest anywhere the repository
// holds it, on any ref or reflog, so a branch deleted loses none — never on
// a branch the engine kept a moved branch's work aside on, a task of its
// own, nor a commit dropped from a branch that stands; a quick-fix's task's
// merge only by the one rule its own commits are read by everywhere, as its
// landing's reads give it (`lg.quickFixMerges`). Only content decides
// a landing (R28), and never when a commit was made: two made in one second
// read as they do a second apart, or a clock set wrong. The one name of one
// read is a `Task:` line, which the engine's squash writes, and the door's
// stamp, which every commit of a task and every copy of one carries, never
// names one. Where it has a last commit, the task has landed where the
// revision holds that commit; or where a commit on the revision's
// first-parent line past where that commit was cut, changing a path its work
// changes, held its change — merging its last commit there, over the commit
// below its own work, would have changed nothing, so a task undoing work
// below it, landed or not, is change still to land (S3) (`lg.holdChanges`);
// and the line held the change its work is laid on there (`holdsTaskChange`)
// — or a copy of each of its own commits was there (`holdsCopy`) — as the
// engine's squash, a rebase's copies, git's own squash, a squash under the
// person's own message, the person's duplicate work by hand, and a
// cherry-pick of every commit of it land it, a cherry-pick of some of them
// never; or where its work changes nothing past the revision; or, its change
// gone from the line, as a later fix reverting it in a pull request leaves
// it, where a pull request the host merged holds that commit, landed as one
// whose work changes nothing (`pulledAt`). One laid on the revision,
// changing something there, has not landed. Where it has none, it has landed
// where a commit on the revision names it by its `Task:` line. A task holds
// work in a repository where it has such a commit there, or has landed
// there; across the project's repositories, it has landed where it has in
// every one holding its work, one at least (`landedAcross`). A commit alone
// — one of a quick-fix's on its branch, stamped or the person's own — has
// landed where the revision holds it, its change, or a copy of it, or a pull
// request the host merged there holds it; one stamped with a task, where
// that task has landed and its last commit holds it, as a fix of two commits
// squashed by hand lands its first. Whose work a commit since the unit's
// work began is, past the revision or on it, has one answer (`ownersOf`,
// R32): the tasks it is stamped with; else those a commit on the revision
// names by its `Task:` lines, a landing's copy of its tasks' work, never
// another's; else, the person's own or the engine's — its commit bringing a
// branch up to date — the task whose branch's tip holds it on its line past
// the oldest commit there stamped with that task — a copy, where the branch
// holds the task's commits copied — never one a merge brought in, the
// default branch merged back or another task's; the lowest such tip, holding
// the fewest commits since the unit's work began, the earlier task where two
// hold as many; else no task's. So the person's own commit between a task's
// own on its branch, or past its last, is its work, a copy of it among those
// a landing by copies needs — one the default branch gained, fast-forwarded
// into a task's branch past its first commit, among them; one on the
// revision a task's branch does not hold so, or on a task's branch below
// that task's first commit, is no task's, landing with the branch it is on
// all the same; and the change a task's branch is laid on lies below its own
// commits and no task's. A task's work on the revision — fast-forwarded
// there, or copied, as a rebase merged by a host lays it — marks the task
// beside the commits naming or stamped with it, so the review's change draws
// it (`marking`). A commit standing for a task whole — its pull request's
// head — is never read as a commit alone: it has landed where the task has a
// landing point holding it or past which it holds no change (`landedAs`), so
// later work rewriting a line of it never takes it back.
//
// Every reader of a task's landing — the build's checks, the close, a
// commit's read and the drivers alike — reads it from its landing point,
// one answer (R29), whichever driver took the task and however it landed
// (`stands`): landed where its work holds no change past the point; changed
// after its landing where it does — commits of its own or the person's on
// that point's tip, or that work brought onto the default branch since;
// never landed where it has none. A branch holds another task's work not
// landed where a commit it holds past a revision, that task's
// (`ownersOf`), has not landed there, read as a commit inside its task
// (R31, `heldPast`): a task cut from another's branch holds the person's
// own commit there as that task's work.
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
// one commit made again over its landing by hand — its later alone.
//
// A feature's, an epic's or a bugfix's tasks are read on the branch each
// repository lands the unit's work on — the unit's own, where it has one
// (landing-git.cjs, `landingBranch`) — here, else as last fetched
// (`unitLanded`), as the build's checks, the review's
// change and a bugfix's door read them; a quick-fix's on each default branch
// as the host has it (landing.cjs, `quickFixLanding`). Each read is made once
// a call, writing nothing. Every task's last commit, its branch's tip and
// the oldest commit stamped with it there, where those commits stand
// against the revision, the commits on it naming a task or stamped with
// one, its line, and the paths each commit of the line changes are each
// read for every task at once (`lg.branches`, `lg.lastStamped`,
// `lg.standingsOn`, `lg.tasksMarkedOn`, `lg.lineSince`, `lg.commitPaths`):
// a task the revision holds, or one whose line lies on it (`laidOnTip`),
// costs no read of its own, and nor does its landing. The commits every
// task's branch's tip holds past the revision are read in one call, at the
// first commit read whole or asked whose work it is, with the commits read
// whole then (`lg.commitPaths`) — one no tip holds read later in a call
// with the rest of its kind. Every task's landing point is read with the
// rest of its kind, at the first asked — every recorded task's together,
// else every task's no record names — each commit of their lines against
// the line in one merge (`landingsOf`) — the paths at which a squash
// differs from what a merge gives read in one call more, and the commits
// stamped with a task anywhere in one more, only where those paths all lie
// outside that task's work on its branch — the commits each driver took
// read so with the rest (`driverPoints`). Every tip past its task's last commit
// is read whole with the rest of its kind, at the first asked, a recorded
// task's never; every other task's last commit no record names, and every
// such commit standing for its task whole, is read by its change with the
// rest, at the first asked (`scan`): the paths their work changes; whether
// each commit of the line past where each was cut changing one of them
// holds its change, every such pair in one merge (`lg.holdChanges`), with
// the change below each where the line lacks it (`lg.belowOwn`); and the
// copies of their own commits (`lg.copiesOf`). So a chain of tasks below
// one, a phase landed by a squash, by merge commits or under the person's
// own message, tasks not landed while the revision moves on past their
// paths, or tasks changed after their landing, cost the git calls one task
// does, however many tasks and commits (12.14); only a task read from a
// last commit of its own, a quick-fix's on its branch, other than the one
// read for every task, is scanned alone. Whose
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
/** Where a commit of a task's line landed past where it was cut (`landingsOf`), each a place on the revision's line: its copy, and each squash of its work with every commit it holds, and of its own work alone. @typedef {{copy: number|undefined, whole: number[], own: number[]}} Landings */

/** What the scan read of a task (`scan`): the last commit read from, the oldest commit of the line holding its change, null where none did, and whether that was read by its change. @typedef {{sha: string, at: string|null, byChange: boolean}} Scanned */
/** A commit a scan reads a task from, standing for its last. @typedef {{sha: string}} ReadFrom */
/** A task the scan reads by its change: the commit read from, the paths its work changes, its own commits but merges, and the commits of the line past where it was cut changing one. @typedef {{id: string, last: ReadFrom, own: Set<string>, commits: string[], touching: import('./landing-git.cjs').LineCommit[]}} Searched */
/** A task's work past a revision: the paths it changes, and its commits but merges. @typedef {{paths: Set<string>, commits: string[]}} Work */
/** A task's landing point (the header's, L): its tip at its landing, null where git no longer holds a recorded one; the commit of the line that landed it, null where none reads; and that commit's place on the line, -1 for none. @typedef {{tip: string|null, commit: string|null, at: number}} Point */

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
 * each one's last commit — of a task a work branch here stands for, every
 * such task's (`lg.lastStamped`), `stamps`; of one none does, the newest
 * stamped with it anywhere (`strays`), read only where such a task is
 * asked of (`last`), and every task's together (`lasts`) — the tip of its
 * branch here, and every commit stamped with it anywhere the repository
 * holds it (`lg.stampedAnywhere`), newest first; of each task a work
 * branch here holds the last commit of, the oldest commit stamped with it
 * on that branch's line, with its tip (`oldest`); each task's branch here,
 * by its name; and the
 * commits every task's branch's tip holds since the unit's work began, on
 * any revision or past it, each after its parents (`lg.commitGraph`). A
 * merge stamped with a task is its work where `merges` takes it — a
 * quick-fix's by the one rule its tasks' own commits are read by
 * (`lg.quickFixMerges`) — and every one where none is given.
 * @param {string} root @param {string} unit @param {string|null} since @param {Map<string, string>} [local] the branches here, where the caller read them @param {import('./landing-git.cjs').MergeRule} [merges]
 * @returns {{stamps: () => Map<string, TimedCommit>, oldest: () => Map<string, import('./landing-git.cjs').OldestOn>, strays: () => Map<string, TimedCommit>, straysRead: () => boolean, last: (id: string) => TimedCommit|undefined, lasts: () => Map<string, TimedCommit>, tips: () => Map<string, string>, anywhere: () => Map<string, TimedCommit[]>, names: () => Map<string, string>, graph: () => TipGraph}}
 */
function workIn(root, unit, since, local, merges) {
  /** @type {Map<string, string>|undefined} */
  let refs = local;
  /** @type {TipGraph|undefined} */
  let tipGraph;
  /** @type {ReturnType<typeof lg.lastStamped>|undefined} */
  let onBranches;
  /** @type {Map<string, TimedCommit>|undefined} */
  let strayLasts;
  /** @type {Map<string, string>|undefined} */
  let tips;
  /** @type {Map<string, string>|undefined} */
  let named;
  /** @type {Map<string, TimedCommit[]>|undefined} */
  let all;
  const branches = () => (refs ??= lg.branches(root));
  const anywhere = () => (all ??= lg.stampedAnywhere(root, stamp(), unit, since, branches(), merges));
  const owned = () => (onBranches ??= lg.lastStamped(root, stamp(), unit, since, branches(), merges));
  const strays = () => (strayLasts ??= new Map([...anywhere()].flatMap(([id, [commit]]) => (owned().owned.has(id) ? [] : [[id, commit]]))));
  /** Each task's branch here, by the task's internal id. */
  const branchNames = () => (named ??= new Map([...branches().keys()].flatMap((name) => {
    const ref = names.taskOfBranch(unit, name);
    return ref === null ? [] : [[taskId(ref), name]];
  })));
  const tipsHere = () => (tips ??= new Map([...branchNames()].map(([id, name]) => [id, /** @type {string} */ (branches().get(name))])));
  return {
    anywhere,
    stamps: () => owned().newest,
    oldest: () => owned().oldest,
    strays,
    straysRead: () => strayLasts !== undefined,
    last: (id) => owned().newest.get(id) ?? (owned().owned.has(id) ? undefined : strays().get(id)),
    lasts: () => new Map([...owned().newest, ...strays()]),
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
 * Where on the revision's line each commit of a task's line, oldest first,
 * landed with every commit below it on that line (the header's): held, at
 * the commit that brought it in; its copy, where the commits below it
 * landed, at the later of the two, as a rebase's copies land a line and a
 * cherry-pick of one commit never does; or a squash of it that `counts`,
 * which lands every commit below it — a merge on the line landing nothing
 * itself, the line below it carried past it. -1 where it has not landed.
 * @param {{held: number|undefined, copy: number|undefined, whole: number[]}[]} read each commit's places on the line @param {(n: number) => boolean} merged @param {(at: number) => boolean} counts
 * @returns {number[]}
 */
function linePlacesOf(read, merged, counts) {
  let below = -1;
  let landed = true;
  return read.map(({ held, copy, whole }, n) => {
    if (held !== undefined) {
      [below, landed] = [held, true];
      return held;
    }
    if (merged(n)) return -1;
    const at = Math.max(landed && copy !== undefined ? Math.max(copy, below) : -1, ...whole.filter(counts));
    [below, landed] = [at, at >= 0];
    return at;
  });
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
  const { stamps, tips, anywhere, last: lastOf } = work;
  const key = stamp();
  /** @type {ReturnType<typeof lg.tasksMarkedOn>|undefined} */
  let marks;
  /** @type {ReturnType<typeof lg.standingsOn>|undefined} */
  let placed;
  /** @type {ReturnType<typeof lg.lineSince>|undefined} */
  let region;
  /** @type {Map<string, Set<string>>|undefined} */
  let changed;
  const marked = () => (marks ??= lg.tasksMarkedOn(root, tip, unit, key, since));
  /** The commits on the tip naming the task by a `Task:` line, newest first: the only name a landing is read by (R28). @param {string} id */
  const naming = (id) => marked().named.get(id) ?? [];
  /** Each task's last commit a work branch here holds, and where those, its branch's tip and its oldest commit there stand against the tip, read together, so a read costs the same whichever tasks it is asked of. */
  const lasts = () => {
    const last = stamps();
    placed ??= lg.standingsOn(root, tip, [...[...last.values(), ...work.oldest().values()].map((commit) => commit.sha), ...tips().values()]);
    return { last, placed: placed.standing, onTip: placed.onTip };
  };
  /** @type {Map<string, import('./landing-git.cjs').Standing>|undefined} */
  let straysPlaced;
  /**
   * Where a commit stands against the tip, of those `lasts` place, and of
   * the last commits of the tasks no work branch here stands for, every one
   * placed at once once those are read (`workIn`); undefined for any other.
   * @param {string} sha
   */
  const placing = (sha) => lasts().placed.get(sha) ?? (work.straysRead() ? (straysPlaced ??= lg.standings(root, tip, [...work.strays().values()].map((commit) => commit.sha))).get(sha) : undefined);
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
  /**
   * Where a task's work stands, as its change after its landing is read:
   * its branch's tip — a quick-fix's task's, its newest own commit on the
   * quick-fix's branch; its branch gone, its newest stamped commit anywhere.
   * @param {string} id
   */
  const workTip = (id) => tips().get(id) ?? own(id)?.sha ?? lastOf(id)?.sha;
  /** @type {Set<string>|undefined} */
  let heldTips;
  /** Whether git still holds the recorded tip `kept`: every recorded tip asked at once, at the first. @param {string} kept */
  const tipHeld = (kept) => (heldTips ??= lg.commitsIn(root, [...recorded.values()].map(({ tip: each }) => each))).has(kept);
  /** @type {Set<string>|undefined} */
  let recordedTips;
  const recordTips = () => (recordedTips ??= new Set([...recorded.values()].map(({ tip: each }) => each)));
  /**
   * The task's tip at its landing `point` where git still holds it, null
   * where it does not, as an expired reflog leaves a recorded one — asked of
   * git (`tipHeld`) only as a merge or a read takes it.
   * @param {Point} point
   */
  const heldTip = (point) => (point.tip === null || !recordTips().has(point.tip) || tipHeld(point.tip) ? point.tip : null);
  /** @type {Map<string, Set<string>>} */
  const holdingAt = new Map();
  /**
   * Whether the work at `at` holds the commit `commit`: read off a graph of
   * the commits read (`graphOf`), with no call, where one holds `at`; else
   * asked of git.
   * @param {string} at @param {string} commit
   */
  const holdsCommit = (at, commit) => {
    if (at === commit) return true;
    const bySha = [graphOfTips().bySha, looseGraph?.bySha].find((graph) => graph?.has(at));
    if (bySha === undefined) return lg.isAncestor(root, commit, at);
    if (!holdingAt.has(at)) holdingAt.set(at, lg.heldIn(bySha, at));
    return /** @type {Set<string>} */ (holdingAt.get(at)).has(commit);
  };
  /**
   * The commit a task's change after its landing lands over again, its work
   * at `at`: its landing point's tip (`pointOf`). Null — its change then
   * landed over its merge base with the default branch — where `at` holds
   * that landing, its work brought onto the default branch since, rebased
   * onto it or by the engine's own merge bringing it up, so their merge base
   * holds what the default branch gained since; where git no longer holds a
   * recorded tip, as an expired reflog leaves it; and for a task with no
   * landing.
   * @param {string} id @param {string} at
   */
  const landingBase = (id, at) => {
    const point = pointOf(id);
    if (point === null || point.tip === null || (point.commit !== null && holdsCommit(at, point.commit))) return null;
    return heldTip(point);
  };
  /** @type {Map<string, number>|undefined} */
  let placesOnLine;
  /** The line's commits, by their places on it. */
  const linePlaces = () => (placesOnLine ??= new Map(lineOf().line.map(({ sha }, at) => [sha, at])));
  /** Where on the line the commit that brought `sha` in stands, -1 where the line never did. @param {string} sha */
  const placeOf = (sha) => linePlaces().get(lineOf().broughtIn.get(sha) ?? '') ?? -1;
  /** The landing `commit` made of the task's commit `at`, where the line stands it (`placeOf`). @param {string|null} at @param {string|null} commit @returns {Point} */
  const pointAt = (at, commit) => ({ tip: at, commit, at: commit === null ? -1 : placeOf(commit) });
  /** The newer of two landings on the line, the first where they stand at one. @param {Point|null} one @param {Point|null} other */
  const newer = (one, other) => (one === null || (other !== null && other.at > one.at) ? other : one);
  /**
   * Of two landings of a task, the one whose tip is the newer on its line
   * `line`, newest first — a tip off it, its record's, older than all of it
   * — and of two landing one tip, the earlier, where that tip first landed:
   * a chain landing the commits of its line that its own landing had
   * already landed never moves that landing later.
   * @param {string[]} line
   */
  const newerOn = (line) => {
    const age = (/** @type {Point} */ point) => {
      const at = point.tip === null ? -1 : line.indexOf(point.tip);
      return at < 0 ? line.length : at;
    };
    return (/** @type {Point|null} */ one, /** @type {Point|null} */ other) => {
      if (one === null || other === null) return one ?? other;
      return age(other) < age(one) || (age(other) === age(one) && other.at < one.at) ? other : one;
    };
  };
  /** @type {TipGraph|undefined} */
  let looseGraph;
  /** @type {string[]} */
  const looseTips = [];
  /**
   * The commits the line of a task's work at `at` is read from: every
   * branch's tip's (`graphOfTips`), where they hold it; else those the work
   * of each task with no branch here holds, read at once, at the first asked
   * (`lg.commitGraph`).
   * @param {string} at
   */
  const graphOf = (at) => {
    const tipsGraph = graphOfTips();
    if (tipsGraph.bySha.has(at)) return tipsGraph;
    if (looseGraph === undefined || !looseGraph.bySha.has(at)) {
      const order = lg.commitGraph(root, [...new Set([...looseTips, at])], since, key);
      looseGraph = { order, bySha: new Map(order.map((commit) => [commit.sha, commit])) };
    }
    return looseGraph;
  };
  /**
   * Where each of `asks` — a commit of a task's line past the tip — landed,
   * at the commits of the line past where it was cut and past `floor` that
   * change a path of `paths`: `copy`, the oldest whose own change is the
   * commit's own — merging it into that one's parent over `base`, the
   * commit below it on its line, gives that one's tree — as a rebase's copy
   * or a cherry-pick lays it; `whole`, each changing a path of `mine`, the
   * paths of the task's own commits, merging it into whose parent over their
   * merge base gives its tree — a squash of the task's work as it then
   * stood, with every commit it holds, its own among them, never a landing
   * of the work below its own alone, which a task undoing that work matches
   * read over their merge base — or, where no commit of its line gives
   * that one's tree so, gives it but at the paths `beside` takes, as a
   * squash carrying a change of the person's own, or another task's work,
   * beside the task's leaves it (`lg.pathsApart`); and `own`, each merging
   * it there over `start`, where the task's own work starts on its line,
   * gives — a squash of the task's own work alone, as the engine squashes a
   * task cut from another's branch over that task's tip (`lg.mergeTrees`).
   * Every pair at once.
   * @param {{key: string, line: string, sha: string, base: string|undefined, start: string|undefined, floor: number, paths: Set<string>, mine: Set<string>, beside: (apart: string[]) => boolean}[]} asks
   * @returns {Map<string, Landings>} by the ask's key
   */
  const landingsOf = (asks) => {
    /** @type {Map<string, Landings>} */
    const found = new Map(asks.map(({ key: ask }) => [ask, { copy: undefined, whole: [], own: [] }]));
    if (asks.length === 0) return found;
    const { line } = lineOf();
    const places = linePlaces();
    pastOf(asks.map(({ sha }) => sha));
    const spans = asks.map((ask) => ({ ...ask, from: Math.max(cutAt(ask.sha, places), ask.floor) + 1 })).filter(({ from }) => from < line.length);
    if (spans.length === 0) return found;
    const byLine = lineChanges();
    const pairs = spans.flatMap(({ key: ask, line: of, sha, base, start, from, paths, mine, beside }) => line.slice(from).flatMap((commit, n) => {
      const [parent] = commit.parents;
      const changed = [...(byLine.get(commit.sha) ?? [])];
      if (parent === undefined || !changed.some((path) => paths.has(path))) return [];
      const pair = { ask, of, at: from + n, ours: parent, tree: commit.tree, theirs: sha, beside };
      const own = start === undefined || start === base ? [] : [{ ...pair, kind: /** @type {const} */ ('own'), base: start }];
      const whole = changed.some((path) => mine.has(path)) ? [{ ...pair, kind: /** @type {const} */ ('whole') }] : [];
      return [...(base === undefined ? [] : [{ ...pair, kind: /** @type {const} */ ('copy'), base }]), ...whole, ...own];
    }));
    const merges = lg.mergeTrees(root, pairs);
    const held = lg.heldMerges(merges);
    const given = new Set(pairs.filter(({ kind }, n) => kind === 'whole' && held[n]).map(({ of, at }) => `${of} ${at}`));
    const near = pairs.flatMap(({ kind, of, at }, n) => (kind === 'whole' && !held[n] && merges[n].clean && !given.has(`${of} ${at}`) ? [n] : []));
    const apart = lg.pathsApart(root, near.map((n) => merges[n]));
    for (const n of near) held[n] = pairs[n].beside(/** @type {string[]} */ (apart.get(merges[n])));
    pairs.forEach((pair, n) => {
      const landed = /** @type {Landings} */ (found.get(pair.ask));
      if (!held[n]) return;
      if (pair.kind !== 'copy') landed[pair.kind].push(pair.at);
      else if (landed.copy === undefined) landed.copy = pair.at;
    });
    return found;
  };
  /** The paths the commits `shas` change, of those `sha` holds past the tip, merges aside. @param {string} sha @param {Iterable<string>} [shas] every commit it holds there */
  const pathsOf = (sha, shas) => {
    const listed = pastOf([sha]);
    return new Set([...(shas ?? lg.heldIn(listed, sha))].flatMap((at) => {
      const commit = listed.get(at);
      return commit === undefined || commit.merge ? [] : [...commit.paths];
    }));
  };
  /**
   * The paths changed by the commits stamped with the task `id` anywhere
   * the repository holds them that `top` does not hold — its work a branch
   * folded or amended dropped, landed or not — read once a task, in one
   * call where it has any.
   * @param {string} id @param {Map<string, import('./landing-git.cjs').GraphCommit>} bySha `top`'s graph @param {string} top
   */
  const pathsDropped = (id, bySha, top) => {
    if (!droppedPaths.has(id)) {
      const held = lg.heldIn(bySha, top);
      const offs = (anywhere().get(id) ?? []).filter(({ sha }) => !held.has(sha)).map(({ sha }) => sha);
      droppedPaths.set(id, new Set(offs.length === 0 ? [] : lg.commitPaths(root, ['--no-walk', ...offs], key).flatMap(({ paths }) => [...paths])));
    }
    return /** @type {Set<string>} */ (droppedPaths.get(id));
  };
  /** @type {Map<string, Set<string>>} */
  const droppedPaths = new Map();
  /** @type {Map<string, string[]>} each subject's line `linesLanded` read, oldest first, by its key */
  const linesRead = new Map();
  /** @type {Map<string, Point[]>} the commits of each subject's line a squash of its work landed with every commit they hold, each where it first did, by its key */
  const squashesRead = new Map();
  /**
   * Of each of `subjects`, the commit of its line — the task `id`'s, from
   * `top` down to the oldest commit there stamped with it (`pastStamped`),
   * past its tip at its `known` landing — that landed most recently, the
   * newest of those that landed together: held by the tip, at the commit
   * that brought it in; its copy, where the commits below it landed, or a
   * squash of its work as it then stood (`landingsOf`, `linePlacesOf`) — a
   * squash only where no landing of the line, held,
   * copied or known, stands before it, as a rebase's copies leave the work
   * of commits below one, which a squash read over their merge base never
   * sees taken back; and a squash or a copy never past where the revision
   * first brought in a commit stamped with the task that `top` neither
   * holds nor has a copy of there, as a branch folded or amended past a
   * fast-forward leaves one, its take-back never read landed — with the
   * merges straight past it on its line that
   * carry no change of their own, their trees their parents' merge, what a
   * merge brings in never the task's work (R32), as the default branch
   * merged back or another task's branch merged in leave it, while a
   * conflict settled with new work in one is change still to land
   * (`plainMerges`); the newer of that and `known`. Where `whole`, its line landed at `top` alone, `top`
   * its line where none of it is stamped with the task. Each commit of its
   * line a squash over their merge base landed so is kept (`squashesRead`).
   * Every subject read at once.
   * @param {{key: string, id: string, top: string, known: Point|null, whole: boolean}[]} subjects
   * @returns {Map<string, Point|null>} by the subject's key
   */
  const linesLanded = (subjects) => {
    if (subjects.length === 0) return new Map();
    const { line: main, broughtIn } = lineOf();
    pastOf(subjects.map(({ top }) => top));
    const lines = subjects.map((subject) => {
      const { bySha } = graphOf(subject.top);
      const { known } = subject;
      const before = known === null || known.tip === null || !bySha.has(known.tip) ? new Set() : lg.heldIn(bySha, known.tip);
      const { past, first } = pastStamped(bySha, subject.top, subject.id);
      const line = [...(past.size === 0 && subject.whole ? [subject.top] : past)].filter((sha) => !before.has(sha)).reverse();
      linesRead.set(subject.key, line);
      return { ...subject, line, start: first?.parents[0], bySha, merges: (/** @type {string} */ sha) => (bySha.get(sha)?.parents.length ?? 0) > 1, below: (/** @type {string} */ sha) => bySha.get(sha)?.parents[0] };
    });
    const found = landingsOf(lines.flatMap(({ key, id, top, known, line, start, merges, below, bySha }) => {
      const paths = pathsOf(top);
      const mine = pathsOf(top, line);
      const beside = (/** @type {string[]} */ apart) => apart.every((path) => !paths.has(path)) && apart.every((path) => !pathsDropped(id, bySha, top).has(path));
      return line.filter((sha) => !broughtIn.has(sha) && !merges(sha)).map((sha) => ({ key: `${key} ${sha}`, line: key, sha, base: below(sha), start, floor: known?.at ?? -1, paths, mine, beside }));
    }));
    const placed = lines.map(({ key, id, top, known, line, merges, bySha }) => {
      const all = line.map((sha) => found.get(`${key} ${sha}`) ?? { copy: undefined, whole: [], own: [] });
      const kept = lg.heldIn(bySha, top);
      const copied = new Set(all.map(({ copy }) => copy));
      /** @type {number|undefined} */
      let dropped;
      const beforeDropped = (/** @type {number} */ at) => at <= (dropped ??= Math.min(...(marked().stamped.get(id) ?? []).filter(({ sha }) => !kept.has(sha)).map(({ sha }) => placeOf(sha)).filter((place) => place >= 0 && !copied.has(place))));
      const landings = all.map(({ copy, whole, own }) => ({ copy: copy !== undefined && beforeDropped(copy) ? copy : undefined, whole: whole.filter(beforeDropped), own }));
      const read = line.map((sha, n) => (broughtIn.has(sha) ? { held: placeOf(sha), copy: undefined, whole: [] } : { held: undefined, copy: landings[n].copy, whole: [...landings[n].whole, ...landings[n].own] }));
      const merged = (/** @type {number} */ n) => merges(line[n]);
      const first = Math.min(known?.at ?? Infinity, ...linePlacesOf(read, merged, () => false).filter((at) => at >= 0));
      const counts = (/** @type {number} */ at) => at <= first;
      squashesRead.set(key, line.flatMap((sha, n) => {
        const at = Math.min(...landings[n].whole.filter(counts));
        return at === Infinity ? [] : [{ tip: sha, commit: main[at].sha, at }];
      }));
      const places = linePlacesOf(read, merged, counts);
      const newest = places.reduce((best, at, n) => (at >= 0 && at >= (places[best] ?? -1) ? n : best), -1);
      const past = [];
      for (let at = newest + 1; newest >= 0 && at < line.length && merges(line[at]); at += 1) past.push(line[at]);
      return { places, newest, past };
    });
    const plain = plainMerges(lines.flatMap(({ bySha }, n) => placed[n].past.map((sha) => /** @type {import('./landing-git.cjs').GraphCommit} */ (bySha.get(sha)))));
    return new Map(lines.map(({ key, top, known, whole, line }, n) => {
      const { places, newest } = placed[n];
      if (newest < 0) return [key, known];
      let last = newest;
      while (last + 1 < line.length && plain.has(line[last + 1])) last += 1;
      const landed = whole && line[last] !== top ? null : { tip: line[last], commit: main[places[newest]].sha, at: places[newest] };
      return [key, newer(known, landed)];
    }));
  };
  /**
   * Those of the merges `commits` that carry no change of their own: each
   * of two parents whose tree is its parents' merge, a conflict settled
   * there with work of its own never one — read at once, none asked where
   * there are none.
   * @param {import('./landing-git.cjs').GraphCommit[]} commits
   * @returns {Set<string>}
   */
  const plainMerges = (commits) => {
    const asked = commits.filter(({ parents }) => parents.length === 2);
    const held = lg.holdChanges(root, asked.map(({ parents, tree }) => ({ ours: parents[0], theirs: parents[1], tree })));
    return new Set(asked.filter((_, at) => held[at]).map(({ sha }) => sha));
  };
  /** @type {Map<string, Point|null>} */
  const byLine = new Map();
  /** @type {Set<string>} the tasks whose landing was read off their line */
  const lined = new Set();
  /** @type {Set<string>} the tasks whose line lies on the tip (`laidOnTip`) */
  const laid = new Set();
  /**
   * Whether the task's line, from its work at `at` down to the oldest
   * commit there stamped with it (`workIn`), lies on the tip, past none of
   * it: the tip then holds none of that line, nor any copy or squash of it,
   * the line cut at the tip, and no other task's landing holds it, made
   * before it.
   * @param {string} id @param {string} at
   */
  const laidOnTip = (id, at) => {
    const oldest = work.oldest().get(id);
    return oldest !== undefined && oldest.tip === at && lasts().onTip.has(oldest.sha);
  };
  /**
   * The landing point each of `ids` has by its record and its line (the
   * header's, L): its tip at its recorded landing, where it has one, or a
   * newer landing of its line read past that (`linesLanded`), or of the
   * newest commit of its line that a commit of another task's line holds,
   * for a task with a branch of its own, so never a quick-fix's fix, its
   * fixes sharing one — landed by a squash of its work with every commit it
   * holds (`squashesRead`) — a chain landed whole lands every task in it,
   * however the later undid the earlier's work, which a rebase's copies or
   * a squash of that task's own work alone never do — where that commit is
   * newer on its line than the one its own landing reads, else whichever
   * landed first (`newerOn`); a task whose work the tip holds landed at
   * that work, as one laid on the tip reads the tip's own commits of its
   * line, a fast-forward by hand leaving them; one with no work, or whose
   * line lies on the tip past none of it (`laidOnTip`), has none but its
   * record's. Every task asked read at once.
   * @param {string[]} ids
   */
  const readLines = (ids) => {
    const fresh = [...new Set(ids)].filter((id) => !byLine.has(id));
    if (fresh.length === 0) return;
    const asked = fresh.map((id) => {
      const record = recordOf(id);
      const at = workTip(id);
      const worked = at !== undefined && at !== record?.tip && (own(id) !== null || lastOf(id) !== undefined);
      return { id, at: worked ? at : undefined, known: record === null ? null : pointAt(record.tip, record.commit) };
    });
    const unplaced = asked.flatMap(({ at }) => (at === undefined || placing(at) !== undefined ? [] : [at]));
    const placed = unplaced.length === 0 ? new Map() : lg.standings(root, tip, unplaced);
    /** @type {{key: string, id: string, top: string, known: Point|null, whole: boolean}[]} */
    const moving = [];
    for (const { id, at, known } of asked) {
      const standing = at === undefined ? undefined : placing(at) ?? placed.get(at);
      if (at !== undefined && standing !== 'held') lined.add(id);
      if (at !== undefined && laidOnTip(id, at)) laid.add(id);
      if (at === undefined || (known !== null && standing === 'held') || laid.has(id)) byLine.set(id, known);
      else if (standing === 'held') byLine.set(id, pointAt(at, lineOf().broughtIn.get(at) ?? null));
      else moving.push({ key: id, id, top: at, known, whole: false });
    }
    for (const { id, top } of moving) if (!tips().has(id)) looseTips.push(top);
    if (moving.length === 0) return;
    for (const [id, point] of linesLanded(moving)) byLine.set(id, point);
    const holders = moving.flatMap(({ id, top }) => {
      const { bySha } = graphOf(top);
      return (squashesRead.get(id) ?? []).map((point) => ({ id, point, held: lg.heldIn(bySha, /** @type {string} */ (point.tip)) }));
    });
    for (const { id } of moving.filter((task) => tips().has(task.id))) {
      const line = [...(linesRead.get(id) ?? [])].reverse();
      const chained = holders.filter((holder) => holder.id !== id).map(({ point, held }) => {
        const sha = line.find((each) => held.has(each));
        return sha === undefined ? null : { ...point, tip: sha };
      });
      byLine.set(id, chained.reduce(newerOn(line), byLine.get(id) ?? null));
    }
  };
  /** @type {Map<() => Map<string, string>, Map<string, Point|null>>} */
  const byDriver = new Map();
  /**
   * Where the commit `took` reads each task's driver took it at landed, for
   * the tasks no record names whose line (`readLines`) did not reach it:
   * one whose line was read where that commit is not on it, as a branch
   * rebased or rewritten since leaves it; and one whose line read found no
   * landing — its work stamped with none, as the person's own commits leave
   * it, or its branch gone — that commit, where its line landed up to it
   * (`linesLanded`): every such task read at once, for each reading of the
   * driver's.
   * @param {() => Map<string, string>} took
   */
  const driverPoints = (took) => {
    if (!byDriver.has(took)) {
      const unreached = (/** @type {string} */ id, /** @type {string} */ sha) => (lined.has(id) ? !holdsCommit(/** @type {string} */ (workTip(id)), sha) : (byLine.get(id) ?? null) === null);
      const asked = [...took()].filter(([id, sha]) => recordOf(id) === null && unreached(id, sha));
      for (const [, sha] of asked) looseTips.push(sha);
      byDriver.set(took, linesLanded(asked.map(([id, sha]) => ({ key: id, id, top: sha, known: null, whole: true }))));
    }
    return /** @type {Map<string, Point|null>} */ (byDriver.get(took));
  };
  /**
   * The tasks whose landing points are read with `id`'s at once: every task
   * recorded, where it is; else every one no record names with a branch here
   * or a last commit read (`workIn`), and itself.
   * @param {string} id
   */
  const readWith = (id) => {
    if (recordOf(id) !== null) return [...recorded.keys()].filter((each) => recordOf(each) !== null);
    workTip(id);
    const strays = work.straysRead() ? [...work.strays().keys()] : [];
    return [...new Set([...tips().keys(), ...stamps().keys(), ...strays, id])].filter((each) => recordOf(each) === null);
  };
  /**
   * A task's landing point as its record, its line and its driver's commit
   * read it (`readLines`, `driverPoints`), the newest of them — null where
   * none does.
   * @param {string} id @param {() => Map<string, string>} took
   */
  const directPoint = (id, took) => {
    readLines(readWith(id));
    const line = byLine.get(id) ?? null;
    return ownJudged(id, recordOf(id) !== null ? line : newer(line, driverPoints(took).get(id) ?? null));
  };
  /** @type {Map<string, Point>} */
  const judged = new Map();
  /** @type {WeakMap<Point, Point>} each point judged by its task's own change, by the one its record or read set */
  const judgedFrom = new WeakMap();
  /** A landing point as its record or read set it, before its task's own change judged it (`ownJudged`). @param {Point} point */
  const setBy = (point) => judgedFrom.get(point) ?? point;
  /**
   * A task's landing point, judged by its own change (S3): where its own
   * work starts on work the tip does not hold — cut from another task's
   * branch, that task landed by a squash or not at all — and the commit
   * that landed it lacks the change from there to its tip then, as a squash
   * by hand of its branch over its parent's squash leaves it, its own work
   * has not wholly landed: the point's tip is where its own work starts, so
   * it reads changed after its landing, and lands again over the work
   * beneath it. Any other point stands.
   * @param {string} id @param {Point|null} point
   * @returns {Point|null}
   */
  const ownJudged = (id, point) => {
    if (point === null || point.tip === null || point.commit === null) return point;
    const start = ownedByTips().firsts.get(id)?.parents[0];
    if (start === undefined || start === point.tip || lineOf().broughtIn.has(start) || !holdsCommit(point.tip, start)) return point;
    const asked = `${point.tip} ${point.commit} ${start}`;
    if (!judged.has(asked)) {
      const held = lg.holdChanges(root, [{ ours: point.commit, tree: lg.treesOf(root, [point.commit])[0], theirs: point.tip, base: start }])[0];
      const own = held ? point : { ...point, tip: start };
      judgedFrom.set(own, point);
      judged.set(asked, own);
    }
    return /** @type {Point} */ (judged.get(asked));
  };
  /**
   * Whether the task has landed by its branch's tip read whole over where it
   * was cut (the header's, `tipLanded`): the last fallback, for a landing no
   * record, line or driver's commit reads.
   * @param {string} id
   */
  const landedWhole = (id) => {
    const { last, how } = lastRead(id);
    return last === null ? how.landed : tipLanded(id, last);
  };
  /** @type {Map<() => Map<string, string>, Map<string, Point|null>>} */
  const points = new Map();
  /** @type {Set<Point>} the landing points read by a task's tip read whole (`landedWhole`) */
  const wholePoints = new Set();
  /**
   * Where a task with a branch of its own, no landing of its own read,
   * landed with a later task whose branch's tip landed read whole: a task
   * cut from its branch, its tip's first-parent line holding a commit of
   * this one's line, as a chain squashed by hand in the person's own words
   * at the later task's paths, then worded back in a commit of their own,
   * leaves it, no one commit holding its work — that landing, at the
   * newest commit of its line that tip holds, its work part of the whole
   * read there (S2); a later task's own work squashed alone never lands
   * so, its tip whole, the work below its own among it, not landed (R28).
   * Null where none.
   * @param {string} id @param {() => Map<string, string>} took
   * @returns {Point|null}
   */
  const beneath = (id, took) => {
    const line = linesRead.get(id);
    if (line === undefined || !tips().has(id)) return null;
    const newest = [...line].reverse();
    return [...tips().keys()].filter((other) => other !== id).reduce((best, other) => {
      const held = heldByTip(other);
      const sha = newest.find((each) => held.has(each));
      const point = sha === undefined ? null : pointOf(other, took);
      return point === null || !wholePoints.has(point) ? best : newer(best, { ...point, tip: /** @type {string} */ (sha) });
    }, /** @type {Point|null} */ (null));
  };
  /**
   * The task's landing point (the header's, L), the one source every read
   * of its landing and every merge of its work takes: its newest landing
   * by its record, its line and its driver's commit (`directPoint`); else,
   * its branch's tip read whole landed (`landedWhole`) — never for one
   * whose line lies on the tip, which no landing holds (`laidOnTip`) — that
   * tip, which then holds no change past it; else, a later task's tip so
   * read holding its line, that landing (`beneath`); else null, the task
   * never landed.
   * @param {string} id @param {() => Map<string, string>} [took] the commit the task's driver took it at, by its internal id
   * @returns {Point|null}
   */
  const pointOf = (id, took = taken) => {
    if (!points.has(took)) points.set(took, new Map());
    const known = /** @type {Map<string, Point|null>} */ (points.get(took));
    if (!known.has(id)) {
      known.set(id, null);
      const point = directPoint(id, took);
      if (point !== null || laid.has(id)) known.set(id, point);
      else if (landedWhole(id)) {
        const whole = pointAt(tipOf(id), readLanding(id));
        wholePoints.add(whole);
        known.set(id, whole);
      } else known.set(id, beneath(id, took));
    }
    return /** @type {Point|null} */ (known.get(id));
  };
  /** @type {Map<string, boolean>} */
  const movedOn = new Map();
  /** @type {Map<string, string|undefined>} each task's work as `changedSince` read it */
  const readAt = new Map();
  /**
   * Whether a task has changed after its landing (R29), the one rule: its
   * work (`workTip`, kept as read, `readAt`) holds a commit neither its tip
   * at its landing (`pointOf`) nor the default branch holds, and carries a
   * change the default branch lacks: merging it there over that tip changes
   * something, a conflict among them (`lg.holdChanges`). A branch given
   * plain commits on its landing, or brought onto the default branch since,
   * is read so — over that tip all the same, since a branch brought up whose
   * own work the default branch then holds has that work read landed, its
   * landing point moved onto it; one apart from its landing or merged into
   * past it is refused before a verb reads it (`apart`, `mergedPast`); a
   * task landed only by its branch's tip read whole never changed. Every
   * task read with it (`readWith`) read at once, at the first asked; the
   * change read only of those whose branch moved off that tip.
   * @param {string} id
   */
  const changedSince = (id) => {
    if (!movedOn.has(id)) {
      const asked = readWith(id).filter((task) => !movedOn.has(task)).flatMap((task) => {
        movedOn.set(task, false);
        const point = directPoint(task, taken);
        const at = workTip(task);
        readAt.set(task, at);
        return point === null || at === undefined || at === point.tip ? [] : [{ task, at, from: heldTip(point) }];
      });
      if (asked.length > 0) {
        const into = trunk();
        const shas = [...asked.map(({ at }) => at), ...asked.flatMap(({ from }) => (from === null ? [] : [from]))];
        const listed = into === tip ? pastOf(shas) : new Map(lg.commitPaths(root, [...new Set(shas), '--not', into], key).map((commit) => [commit.sha, commit]));
        const moved = asked.filter(({ at, from }) => {
          const before = from === null ? new Set() : lg.heldIn(listed, from);
          return [...lg.heldIn(listed, at)].some((sha) => !before.has(sha));
        });
        if (moved.length > 0) {
          const [tree] = lg.treesOf(root, [into]);
          const held = lg.holdChanges(root, moved.map(({ at, from }) => ({ ours: into, tree, theirs: at, ...(from === null ? {} : { base: from }) })));
          moved.forEach(({ task }, n) => movedOn.set(task, !held[n]));
        }
      }
    }
    return /** @type {boolean} */ (movedOn.get(id));
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
   * commit, a work branch's or one read anywhere (`workIn`), the tip does
   * not hold at once, at the first asked; a last commit read from elsewhere,
   * or a recorded task's, on its own.
   * @param {TimedCommit} last @param {string} id @returns {Scanned}
   */
  const heldSince = (last, id) => {
    const each = [...lasts().last, ...(work.straysRead() ? work.strays() : [])];
    scanned ??= scanLasts(each.filter(([held, commit]) => recordOf(held) === null && placing(commit.sha) === 'moved').map(([held, commit]) => ({ id: held, last: commit })));
    const read = scanned.get(id);
    return read !== undefined && read.sha === last.sha ? read : /** @type {Scanned} */ (scanLasts([{ id, last }]).get(id));
  };
  /**
   * Whether a commit stamped with the task `id`, or with none, has landed
   * (the header's): one of its task's work, where that task has a landing
   * point, as far as its landing reaches (`byPoint`), else a copy of it, or
   * a pull request the host merged holding it; else its change or a copy
   * held. A commit inside a task, never one standing for it whole
   * (`landedAs`).
   * @param {string} sha @param {string|null} id
   */
  const landedCommit = (sha, id) => {
    const at = placing(sha) ?? (lg.isAncestor(root, sha, tip) ? 'held' : 'moved');
    if (at !== 'moved') return at === 'held';
    const pulled = () => merged().some((head) => lg.isAncestor(root, sha, head));
    const reached = id === null ? undefined : byPoint(sha, id);
    if (reached !== undefined) return reached || lg.holdsCopy(root, tip, sha) || pulled();
    return holdsAt(sha, id) || pulled();
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
      const last = mine ?? lastOf(id) ?? null;
      const oldest = last === null ? naming(id).at(-1) : undefined;
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
  /**
   * Whether the task `other`'s work lands with the task `id`'s branch, its
   * chain: `other`'s branch's tip on the first-parent line of `id`'s, as a
   * task cut from another's branch holds it — so the change `id`'s work is
   * laid on starts below `other`'s commits (`lg.belowOwn`), and `id`'s last
   * commit, read over it, reads landed where the chain landed whole however
   * `id` undid or rewrote `other`'s work.
   * @param {string} id @param {string} other
   */
  const inChain = (id, other) => {
    const at = tips().get(other);
    return other !== id && at !== undefined && heldByTip(id).has(at);
  };
  /** @type {Map<string, TaskLanding>} */
  const tasks = new Map();
  /** @type {Set<string>} the tasks whose landing this read was asked of, read or placed */
  const asked = new Set();
  /**
   * A task's read (`TaskLanding`): landed where it has a landing point
   * (`pointOf`) and has not changed after it (`changedSince`).
   * @param {string} id
   */
  const read = (id) => {
    asked.add(id);
    if (!tasks.has(id)) {
      const record = recordOf(id);
      const mine = own(id);
      const point = pointOf(id);
      const landed = point !== null && !changedSince(id);
      if (record !== null) tasks.set(id, { own: mine?.sha ?? null, found: lastOf(id)?.sha ?? record.tip, held: true, landed });
      else {
        const last = mine ?? lastOf(id) ?? null;
        tasks.set(id, { own: mine?.sha ?? null, found: last?.sha ?? null, held: point !== null || last !== null || naming(id).length > 0, landed });
      }
    }
    return /** @type {TaskLanding} */ (tasks.get(id));
  };
  /**
   * How far a task's work has landed, for a commit of it to be read as
   * landed: its work as read landed (`read`, `readAt`) — never as it moved
   * since within the call, as a quick-fix's branch brought up to the host's
   * moves it; else its tip at its landing; null where it has none
   * (`pointOf`).
   * @param {string} id @returns {string|null}
   */
  const landedTo = (id) => {
    const point = pointOf(id);
    if (point === null) return null;
    return read(id).landed ? readAt.get(id) ?? heldTip(point) : heldTip(point);
  };
  /**
   * Whether the commit `sha` of the task `id`'s work has landed by its
   * landing point: its tip at that landing holds it, or the work its landing
   * reaches does (`landedTo`) — so a commit of its work past that landing,
   * as one taking back the task's own work, has not, however the default
   * branch's work holds its change. Read as it stands, as a quick-fix's
   * close asks it of the branch it then cuts again (fix-branch.cjs).
   * Undefined for any other commit, or a task with no landing point, read as
   * a commit alone.
   * @param {string} sha @param {string} id @returns {boolean|undefined}
   */
  const byPoint = (sha, id) => {
    const point = pointOf(id);
    if (point === null) return undefined;
    const reach = landedTo(id);
    const landed = heldTip(point);
    if ((landed !== null && holdsCommit(landed, sha)) || (reach !== null && holdsCommit(reach, sha))) return true;
    const at = workTip(id);
    return at !== undefined && holdsCommit(at, sha) ? false : undefined;
  };
  /**
   * Where the task landed by its branch's tip read whole: where the tip
   * did, read by its change (`readWholes`); null where it has not.
   * @param {string} id @returns {string|null}
   */
  const tipLanding = (id) => {
    const at = tipOf(id);
    return at === null || !wholeLanded(id, at) ? null : wholeAt.get(wholeOf(id, at)) ?? null;
  };
  /**
   * Where a task no record names landed, read from its last commit — held
   * by the tip, its change held, or named — else from its branch's tip read
   * whole: the landing of the last fallback (`pointOf`).
   * @param {string} id @returns {string|null}
   */
  const readLanding = (id) => {
    const { how } = lastRead(id);
    if (!how.landed) return tipLanding(id);
    if ('held' in how) return lineOf().broughtIn.get(how.held) ?? null;
    if ('at' in how) return how.at;
    return lineOf().broughtIn.get(how.named) ?? null;
  };
  /** A task's landing, its landing point's (`pointOf`), null where it has none. @param {string} id @returns {string|null} */
  const landingOf = (id) => pointOf(id)?.commit ?? null;
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
    const standing = [...new Set([...tips().keys(), ...work.lasts().keys()])].flatMap((id) => {
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
   * Whether the task has landed, `sha` taken for its branch's tip — a
   * commit standing for the task whole, as its pull request's head: a
   * task's read, never a commit's — where it has a landing point
   * (`pointOf`) and `sha` holds no change past it, as `changedSince` reads
   * one: its tip at that landing holds `sha`, or merging `sha` into the
   * default branch over that landing, or past it (`landingBase`), changes
   * nothing — over what `sha` and that tip share where `sha` does not hold
   * it, as a head its branch was restacked off since leaves it, whose
   * change past that tip would take back the work the restack laid below it.
   * @param {TaskRef} ref @param {string} sha
   */
  const landedAs = (ref, sha) => {
    const id = taskId(ref);
    const point = pointOf(id);
    if (point === null) return false;
    const landed = heldTip(point);
    if (landed !== null && holdsCommit(landed, sha)) return true;
    const into = trunk();
    const base = landingBase(id, sha);
    const over = base === null || holdsCommit(sha, base) ? base : lg.mergeBase(root, sha, base);
    return lg.holdChanges(root, [{ ours: into, tree: lg.treesOf(root, [into])[0], theirs: sha, ...(over === null ? {} : { base: over }) }])[0];
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
  /**
   * Where the task stands against its landing (the header's, R29), as its
   * landing point reads it (`pointOf`): landed where its work holds no
   * change past that landing; changed after its landing where it does
   * (`changedSince`); never landed where it has none.
   * @param {TaskRef} ref @returns {Standing}
   */
  const stands = (ref) => {
    const id = taskId(ref);
    if (pointOf(id) === null) return 'unlanded';
    return changedSince(id) ? 'changed' : 'landed';
  };
  /**
   * Where a task changed after its landing landed — its tip then
   * (`landingBase`) — the base its change lands over again, as its change
   * was read over, so a landing again lands just that change, what it takes
   * back of its own work among it (R29); null for a task not changed after
   * its landing, or one whose change lands over its merge base.
   * @param {TaskRef} ref @returns {string|null}
   */
  const landedTip = (ref) => {
    const id = taskId(ref);
    const at = workTip(id);
    return at !== undefined && stands(ref) === 'changed' ? landingBase(id, at) : null;
  };
  /**
   * Where an unrecorded task landed on the tip, for a verb acting on its
   * landing to record (landing-record.cjs): its landing point (`pointOf`),
   * its driver's commit as `took` reads it — its landing, and its tip as
   * its read set it (`setBy`); null for a recorded task, or one with none.
   * @param {string} id @param {() => Map<string, string>} took @returns {{commit: string, tip: string}|null}
   */
  const unrecorded = (id, took) => {
    if (recordOf(id) !== null) return null;
    const point = pointOf(id, took);
    return point === null || point.commit === null ? null : { commit: point.commit, tip: setBy(point).tip ?? point.commit };
  };
  /**
   * The landings of the tasks this read was asked of, read or placed, that
   * no record names (`unrecorded`), in their order, by their internal ids,
   * the commit each task's driver took it at as `took` reads it, the
   * driver's own read where none is given.
   * @param {() => Map<string, string>} [took]
   */
  const found = (took = taken) => [...asked].sort(byStep).flatMap((id) => {
    const at = unrecorded(id, took);
    return at === null ? [] : [{ id, ...at }];
  });
  /**
   * Where an unrecorded task landed here before a land verb lands it again
   * (R30): its landing, as `found` reads it; null where it had none.
   * @param {TaskRef} ref @param {() => Map<string, string>} took
   */
  const earlier = (ref, took) => unrecorded(taskId(ref), took)?.commit ?? null;
  /**
   * Where the task's branch here stands against its landing point
   * (`pointOf`, L), for the refusals of what a branch does after its
   * landing: with the branch, that point, its tip and the commit that
   * landed it; null for a task with no branch here or no landing point.
   * @param {string} id
   */
  const pointHere = (id) => {
    const at = tips().get(id);
    const point = at === undefined ? null : pointOf(id);
    return at === undefined || point === null || point.tip === null ? null : { at, branch: /** @type {string} */ (work.names().get(id)), point, landed: point.tip, landing: point.commit };
  };
  /** @type {Map<string, {branch: string, sha: string, landing: string|null}|null>} */
  const apartRead = new Map();
  /**
   * Where the task's branch here stands apart from its landing point
   * (`pointOf`, L): holding neither its tip nor the commit that landed it,
   * nor held by that tip — rewritten since, or behind it with work of its
   * own, as a clone stale behind it or the host's copy moved past the
   * branch here before its landing leaves it; a branch behind that tip
   * alone has nothing new, and has landed — with that tip, named `sha`, its
   * landing and the branch; null where it stands otherwise, or git no
   * longer holds a recorded tip (`heldTip`). A task landed by hand that no
   * verb read, then rewritten, has no point to stand apart from, and is
   * read by its content.
   * @param {TaskRef} ref @returns {{branch: string, sha: string, landing: string|null}|null}
   */
  const apart = (ref) => {
    const id = taskId(ref);
    if (!apartRead.has(id)) {
      const here = pointHere(id);
      const off = here !== null && !holdsCommit(here.at, here.landed) && !(here.landing !== null && holdsCommit(here.at, here.landing)) && heldTip(here.point) !== null && !holdsCommit(here.landed, here.at);
      apartRead.set(id, here === null || !off ? null : { branch: here.branch, sha: here.landed, landing: here.landing });
    }
    return /** @type {{branch: string, sha: string, landing: string|null}|null} */ (apartRead.get(id));
  };
  /**
   * A merge on the task's branch past its landing point (`pointOf`, L) as
   * its record or read set it — never past the tip a task judged by its own
   * change lands again over (`ownJudged`), below which a merge made before
   * its landing stands — the default branch merged in by hand, refused
   * before a verb reads it: the newest merge on its tip's first-parent line
   * down to that point's tip that the default branch does not hold, nor the
   * commit its driver took it at, as the engine's own merge of a pull
   * request's base into it leaves one; with the branch, that tip and the
   * landing. Null where none stands there, or its branch does not hold that
   * tip (`apart`).
   * @param {TaskRef} ref @returns {{branch: string, merge: string, sha: string, landing: string|null}|null}
   */
  const mergedPast = (ref) => {
    const id = taskId(ref);
    const here = pointHere(id);
    const landed = here === null ? null : setBy(here.point).tip;
    if (here === null || landed === null || here.at === landed || !holdsCommit(here.at, landed)) return null;
    const { bySha } = graphOf(here.at);
    for (let sha = here.at; sha !== landed;) {
      const commit = bySha.get(sha);
      if (commit === undefined || lineOf().broughtIn.has(sha)) return null;
      if (commit.parents.length > 1) {
        const head = taken().get(id);
        if (head === undefined || !holdsCommit(head, sha)) return { branch: here.branch, merge: sha, sha: landed, landing: here.landing };
      }
      [sha] = commit.parents;
    }
    return null;
  };
  /** The unit's tasks the repository holds work of — stamped, on a branch of theirs, or named on the tip — by their refs. @returns {TaskRef[]} */
  const known = () => [...new Set([...work.lasts().keys(), ...tips().keys(), ...marked().named.keys()])].sort(byStep).flatMap(unitTask);
  /** The unit's tasks with a branch here, by their refs: those whose branch `apart` reads. @returns {TaskRef[]} */
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
    revision: tip,
    task: (/** @type {TaskRef} */ ref) => read(taskId(ref)),
    landedCommit,
    landedAs,
    landedTip,
    stands,
    heldPast,
    marking,
    line: () => lineOf().line,
    landing,
    landings,
    ownedSince,
    ownStart,
    apart,
    mergedPast,
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
 * `since` (the header's): each repository read on its landing branch,
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
    if (!byRepo.has(repo.path)) byRepo.set(repo.path, landedIn(repo.path, unit, since, undefined, recordsIn(manifest, repoName(repo)), undefined, () => onBranch(cwd, repo, unit, (at) => at)));
    return /** @type {(tip: string) => RepoLanded} */ (byRepo.get(repo.path))(tip);
  };
  /** @type {Map<Repo, RepoLanded|null>} */
  const reads = new Map();
  /** @param {Repo} repo */
  const inRepo = (repo) => {
    if (!reads.has(repo)) reads.set(repo, onBranch(cwd, repo, unit, (tip) => on(repo, tip)));
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
      const read = byRepo.has(repo.path) ? onBranch(cwd, repo, unit, (tip) => on(repo, tip)) : null;
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
 * What `read` makes of the branch a repository lands the unit's work on,
 * as last fetched (landing-git.cjs, `landingRev`), null where it has none
 * to land on.
 * @template T @param {string} cwd @param {Repo} repo @param {string} unit @param {(tip: string) => T} read @returns {T|null}
 */
function onBranch(cwd, repo, unit, read) {
  let rev;
  try {
    rev = lg.landingRev(cwd, repo, unit);
  } catch {
    return null;
  }
  return read(rev);
}

module.exports = { repoLanded, landedIn, landedAcross, unitLanded, foundIn, workIn };
