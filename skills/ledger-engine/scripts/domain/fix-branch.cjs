'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a quick-fix's tasks are built — its fixes, and the fix
// tasks of a review asked for at its close — on the quick-fix's one branch,
// `fix/{unit}` (landing-names.cjs), in each repository of the project it
// touches (7.2.24): each task its own commits through the door, stamped
// with its task (commit-task.cjs), and the quick-fix landing as that
// branch's one pull request in each (landing.cjs). Its tasks are built in a
// worktree of its own, one at a time (task-verbs.cjs, `checkoutHold`), so
// the person's checkout never moves while they are built.
//
// - The quick-fix's worktree (`fixWorktree`) is the engine's own layout
//   beside the builders' isolation worktrees, named for the unit alone,
//   `.claude/worktrees/ledger-{unit}` of the main checkout
//   (project-layout.cjs, `scratchTop`). A task's start readies every
//   repository's branch, then lays the worktree out where it is not
//   (`layOutFix`): every repository of the project on the branch, laid out
//   as the project is and prepared as Claude Code prepares an isolation
//   worktree (project-layout.cjs, `layOut`) — the branch checked out as it
//   stands, or, in a nested repository lacking it, made at the tip of the
//   branch it lands on as it stands here, no host asked, so a clone the
//   quick-fix never touches never has its host called (R18; `tipsHere`,
//   landing.cjs), the landing taking a branch cut from an older tip as it
//   takes any — and the start then runs the environment setup's steps for each
//   worktree there (task-verbs.cjs). It stays until the close, a cancel or
//   a move takes it apart (`takeFixApart`); a park leaves it as it is. The
//   close then deletes the branch in each repository where it holds no
//   commit past the branch it lands on — a clone the quick-fix never
//   touched among them — or stands where it landed, at a tip the unit's
//   landing records there hold (landing-record.cjs) — every commit past
//   that branch it holds, or its reflog alone keeps, a task's, stamped by
//   the door — and keeps it where a commit came after, or one of the
//   person's sits below that tip or was left off by a readying, so its
//   deletion leaves no commit of theirs on no ref (`fixClosed`, `spent`).
// - The holder's done and close are refused while the worktree holds
//   changes not committed, a fix leaving it clean as it stops holding it
//   (`refuseDirtyEnd`): done commits them, a close puts them back. The
//   quick-fix's close is refused before anything lands while it holds any
//   (`refuseDirtyClose`), as a cancel and a move are once the holder's work
//   is set aside (`refuseDirtyLeave`, fix-leave.cjs), since each takes the
//   worktree apart.
// - A repository nested in the project is laid out on the branch with the
//   rest, the branch made where it lacks one — one the quick-fix touched
//   already has it taken from the host's copy at the task's start — and a
//   branch holding no work is no repository the quick-fix touched
//   (landing.cjs). At the first commit of a task's there the door, once the
//   checks pass and before it commits, records it in the unit's state,
//   `fixes.repos` on the manifest, committed to the state branch
//   (`recordRepos`), so every clone reads it as one.
// - The host's copy of the branch is the truth for what the pull request
//   holds (`quickFixPull`, landing.cjs). A task's start, its opening and
//   the quick-fix's landing each first ready every repository's branch,
//   refused before anything moves where a repository's host holds a branch
//   by its name holding no commit of a fix of the unit's and none made since
//   the unit was — another's, made before it (landing.cjs) — naming it, its
//   repository and the way on, its deletion or renaming there
//   (`refuseForeign`), so it is never taken, brought in or pushed over.
//   Then, in turn: taken from the host where the repository lacks it — at
//   the first start, in the project's own, cut from the branch it lands on
//   as the host has it where the host has none either, never otherwise;
//   then the host's head brought in where it holds a commit not landed — a
//   pull request's head left after its merge by hand is never brought in —
//   fast-forwarded to where the branch is behind it, else merged with it
//   where it holds a change the branch
//   lacks, refused naming the way on where the two conflict: the merge the
//   hook before Bash passes, in the repository that conflicts, finished
//   through the door under the task of the unit's in flight in the
//   conversation, else under a one-line task of its own (shell-guard.cjs;
//   landing-names.cjs) — so no push drops a commit of the host's; then
//   cut again where a person's merge of the pull request by hand, by any
//   method, left the branch holding commits that have landed past the
//   branch it lands on as the host has it (`quickFixLanding`): cut from that
//   branch's tip, every commit past it not landed replayed onto it in order
//   under its own message — a task's, its stamp kept, and one the engine
//   did not write, a review's suggestion or the person's own, which is the
//   person's, kept where it holds a change that branch lacks — merges
//   aside. A task's commit that does not apply there is left off, with
//   every later commit of its task's, the answer warning of each task left
//   off and the way on: its change made again on the branch through the
//   door, a task done among them (commit-task.cjs); a commit of the
//   person's left off alone, warned of as theirs to make again. Where a
//   worktree has the branch out it moves there, refused first, nothing
//   moved, while that worktree holds changes not committed, naming each.
//   Nothing else rewrites the branch; a push after it is leased against the
//   host's copy as it was read (landing.cjs).
// - The door takes a commit of a quick-fix's task on the branch alone
//   (commit-task.cjs), a commit on any other naming the worktree it is made
//   from and the start that lays it out (`branchWayOn`).
// - A move, once the holder's work is set aside and the worktree taken
//   apart (fix-leave.cjs), sets each repository's branch aside
//   (`setBranchAside`): holding commits past the branch it lands on, it is
//   kept, its commits unlanded, renamed to `moved/fix/{unit}`, a name no
//   landing reads as the unit's (landing-names.cjs), so the new type's build
//   never meets it; holding none, it is deleted. The kept names are what the
//   topic's first opening names (`keptBranches`). A cancel keeps each branch
//   under its own name, which a reactivate carries on from, a start laying
//   the worktree out again, and the cancel's receipt names.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit, git } = require('../kernel/git.cjs');
const { projectRepos, repoName, childrenFirst, folderUnder } = require('../kernel/repos.cjs');
const { withWorkUnitLock, loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { codeStatus } = require('./code.cjs');
const { commitStateTail } = require('./commit.cjs');
const { recordLandings, recordsIn } = require('./landing-record.cjs');
const { scratchTop, layOut, takeApart } = require('./project-layout.cjs');
const lg = require('./landing-git.cjs');
const { quickFixBranch, mergedThrough, quickFixMerged } = require('./landing-names.cjs');
const { parseTaskId, shownTask, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./landing.cjs').RepoLanding} RepoLanding */
/** @typedef {import('./landing.cjs').QuickFixLanding} QuickFixLanding */

/** The landing, read when asked: it reads the task verbs, which read this module. */
const landing = () => require('./landing.cjs');
/** The build's entry, read when asked, for the calling conversation's tasks in flight: it reads the task verbs too. */
const buildEntry = () => require('./build-entry.cjs');
/** The trailer the door stamps a task's commit with, read when asked: the door reads this module. */
const stamp = () => require('./commit-task.cjs').TRAILER;

/**
 * The quick-fix's worktree (the header's): the project's folder in its own
 * checkout and its repositories there; the worktree's top, named for the
 * unit beside the builders' isolation worktrees; and the project's folder
 * in the worktree, where its tasks are built.
 * @param {string} cwd @param {string} unit
 * @returns {{project: string, repos: Repo[], top: string, root: string}}
 */
function fixWorktree(cwd, unit) {
  const project = lg.projectCheckout(fs.realpathSync(codeRoot(cwd)));
  const repos = projectRepos(project);
  const top = scratchTop(repos[0], unit);
  return { project, repos, top, root: folderUnder(repos[0], top) };
}

/**
 * Refuse, in the words `refusal` gives what it holds, while the quick-fix's
 * worktree holds changes not committed.
 * @param {string} cwd @param {string} unit @param {(dirty: string) => string} refusal
 */
function refuseFixDirt(cwd, unit, refusal) {
  const { root } = fixWorktree(cwd, unit);
  const dirty = fs.existsSync(root) ? codeStatus(root).files.map(({ path: at }) => at) : [];
  if (dirty.length > 0) throw new Error(refusal(dirty.join(', ')));
}

/** The way on from each end of a fix that left the worktree holding changes: done commits them, a close gives them up. */
const LEFT = Object.freeze({
  done: 'commit them through the door',
  close: 'a fix closed gives its work up with it, so put them back as they were',
});

/**
 * Refuse, in the words of `said`, ending the fix that holds a quick-fix's
 * worktree by `end` while the worktree holds changes not committed: it
 * leaves the worktree clean as it stops holding it (R27).
 * @param {string} cwd @param {TaskRef} ref @param {'done'|'close'} end @param {string} said
 */
function refuseDirtyEnd(cwd, ref, end, said) {
  refuseFixDirt(cwd, ref.unit, (dirty) => `${said}: ${taskName(ref)} holds ${ref.unit}'s worktree, which holds changes not committed — ${dirty} — and a fix leaves it clean as it stops holding it: ${LEFT[end]}, then run it again`);
}

/** Refuse a quick-fix's close, before anything lands, while its worktree holds changes not committed: the close takes it apart. @param {string} cwd @param {string} unit */
function refuseDirtyClose(cwd, unit) {
  refuseFixDirt(cwd, unit, (dirty) => `${unit}'s worktree holds changes not committed — ${dirty} — so nothing was landed: what is ${unit}'s goes in a fix of its own, and the rest is put back as it was; then close it again`);
}

/** Refuse a quick-fix's move or cancel, once its holder's work is set aside, while its worktree still holds changes not committed: each takes it apart. @param {string} cwd @param {string} unit */
function refuseDirtyLeave(cwd, unit) {
  refuseFixDirt(cwd, unit, (dirty) => `${unit}'s worktree holds changes not committed that no fix holding it set aside — ${dirty} — so it was not taken apart: put them back as they were, then say yes again`);
}

/**
 * Every repository's branch readied (the header's), the project's own cut
 * at the first start where neither it nor the host has one — each landing
 * the readying's read found that no record names recorded first
 * (landing-record.cjs), so a task landed by hand stays landed as its branch
 * is cut again — then the quick-fix's worktree laid out where it is not,
 * every repository there on the branch, a nested one lacking it made at the
 * tip of the branch it lands on as it stands here. Answers the branch, the
 * project's folder in the worktree, and each repository the readying cut
 * again, with its warnings, where it did.
 * @param {string} cwd @param {string} unit
 * @returns {{branch: string, worktree: string, cut_again?: Record<string, unknown>[], warnings?: string[]}}
 */
function layOutFix(cwd, unit) {
  const branch = quickFixBranch(unit);
  const read = landing().quickFixLanding(cwd, unit);
  const { cut, remakes, warnings } = readied(read, true);
  recordLandings(cwd, unit, read.found(), warnings);
  const { project, repos, top, root } = fixWorktree(cwd, unit);
  if (!fs.existsSync(top)) {
    const lacking = repos.filter((repo) => !lg.branches(repo.path).has(branch));
    const tips = lacking.length === 0 ? new Map() : landing().tipsHere(project, unit, repos, lacking);
    layOut(repos.map((repo) => ({ repo, at: path.join(root, repo.dir), make: { inPlace: false, start: tips.get(repo.dir) ?? null } })), branch, project);
  }
  const said = [...remakes, ...warnings];
  return { branch, worktree: root, ...(cut.length > 0 ? { cut_again: cut } : {}), ...(said.length > 0 ? { warnings: said } : {}) };
}

/**
 * The quick-fix's worktree taken apart, deepest first, each repository's
 * registration of it with it (`takeApart`), where it is laid out.
 * @param {string} cwd @param {string} unit
 */
function takeFixApart(cwd, unit) {
  const { repos, top } = fixWorktree(cwd, unit);
  if (fs.existsSync(top)) takeApart(repos, top);
}

/**
 * Every repository's branch readied (the header's), refused first, nothing
 * moved, where the host's copy is another's (`refuseForeign`): taken from
 * the host where the repository lacks it — `fresh`, at the first start, cut
 * in the project's own from the branch it lands on as the host has it
 * where the host has none — the host's head brought in, then cut again
 * where it holds work landed. Answers each repository cut again, the
 * warning of each task left off — its change to make again through the
 * door — and every other warning that gave.
 * @param {QuickFixLanding} read @param {boolean} [fresh]
 * @returns {{cut: Record<string, unknown>[], remakes: string[], warnings: string[]}}
 */
function readied(read, fresh = false) {
  read.repos.forEach(refuseForeign);
  /** @type {Record<string, unknown>[]} */
  const cut = [];
  /** @type {string[]} */
  const remakes = [];
  /** @type {string[]} */
  const warnings = [];
  for (const held of read.repos) {
    const here = held.at();
    const at = here ?? taken(held, fresh && held.ctx.repo === '.');
    if (at === null) continue;
    broughtIn(held, at);
    const again = cutAgain(held);
    if (again === null) continue;
    cut.push(again.answer);
    remakes.push(...again.remakes.map((warning) => lg.saidIn(held.ctx.repo, warning)));
    warnings.push(...again.theirs.map((warning) => lg.saidIn(held.ctx.repo, warning)));
  }
  return { cut, remakes, warnings };
}

/**
 * Refuse, nothing moved, where a repository's host holds a branch by the
 * quick-fix's name that is another's (the header's), naming it, its
 * repository, and the way on.
 * @param {RepoLanding} held
 */
function refuseForeign(held) {
  if (!held.foreign()) return;
  const { unit, repo } = held.ctx;
  const host = repo === '.' ? 'the project\'s host' : `${lg.plain(repo)}'s host`;
  throw new Error(`land: ${host} holds a branch ${held.branch} that is not ${unit}'s — none of its commits is a fix of ${unit}'s or was made since ${unit} was — and nothing moved: delete it there, or rename it, then try again`);
}

/**
 * The branch made where the repository lacks it: at the host's copy, else,
 * where `fresh`, at the tip of the branch it lands on as the host has it.
 * Answers where it was made, null where it was not.
 * @param {RepoLanding} held @param {boolean} fresh
 * @returns {string|null}
 */
function taken(held, fresh) {
  const from = held.pull().head ?? (fresh ? held.tip : null);
  if (from === null) return null;
  git(held.ctx.root, ['branch', '--no-track', held.branch, from]);
  return from;
}

/**
 * The host's copy of the branch brought in (the header's), where it holds a
 * commit not landed: the branch fast-forwarded to it where it is behind,
 * else, where it holds a change the branch here lacks, a merge of it made
 * on the branch — refused, nothing moved, where the two conflict, naming
 * the way on (`mergeWayOn`).
 * @param {RepoLanding} held @param {string} at the branch's tip here
 */
function broughtIn(held, at) {
  const { root, repo } = held.ctx;
  const head = held.pull().head;
  if (head === null || lg.isAncestor(root, head, at) || !held.holdsUnlanded(head)) return;
  const why = `takes the commits its pull request holds${lg.inRepoWords(repo)}`;
  if (lg.isAncestor(root, at, head)) {
    moveBranch(root, held.branch, at, head, why);
    return;
  }
  if (lg.holdsChange(root, at, head)) return;
  const merged = lg.mergeTree(root, lg.mergeBase(root, at, head), at, head);
  if ('conflicts' in merged) {
    throw new Error(`land: ${held.branch}${lg.inRepoWords(repo)} and its pull request's head, ${lg.short(head)}, each hold commits the other lacks, conflicting at ${merged.conflicts.map(lg.plain).join(', ')}, so nothing moved — `
      + `${mergeWayOn(held, head)}, and try again`);
  }
  const message = `Merge ${lg.short(head)}, ${held.ctx.unit}'s pull request's head, into ${held.branch}\n`;
  const commit = lg.commitTree(root, { tree: merged.tree, parent: [at, head], message, signed: lg.signs(root) }, `the merge of its pull request's head into ${held.branch}`, 'try again');
  moveBranch(root, held.branch, at, commit, why);
}

/**
 * The way on for the host's head conflicting with the branch (the
 * header's): merged into the branch in the quick-fix's worktree, with the
 * merge the hook before Bash passes, finished through the door — under the
 * task of the unit's in flight in the calling conversation, else under a
 * one-line task of its own (landing-names.cjs).
 * @param {RepoLanding} held @param {string} head
 */
function mergeWayOn(held, head) {
  const { unit, repo } = held.ctx;
  const [task] = buildEntry().ownInFlight(unit);
  const [theirs, folder] = [lg.short(head), lg.quoted(repo)];
  return task === undefined ? quickFixMerged(unit, theirs, folder) : `merge it into ${held.branch} in ${unit}'s worktree with ${mergedThrough(unit, task.task, theirs, folder)}`;
}

/** A commit replayed, or left off, and the task it is stamped with, null for none. @typedef {import('./landing.cjs').QuickFixCommit} Commit */

/**
 * The commits replayed onto `onto`, in order, each under its own message
 * (the header's): a task's that conflicts there left off, with every later
 * commit of its task's; one of no task's that conflicts left off alone;
 * one that changes nothing there passed over. The tip they make, each task
 * left off, with the commit that did not apply and the paths it conflicts
 * at, and each commit of no task's left off, likewise.
 * @param {string} root @param {Commit[]} commits @param {string} onto
 * @returns {{tip: string, off: Map<string, {sha: string, paths: string[]}>, theirs: {sha: string, message: string, paths: string[]}[]}}
 */
function replayed(root, commits, onto) {
  let tip = onto;
  /** @type {Map<string, {sha: string, paths: string[]}>} */
  const off = new Map();
  /** @type {{sha: string, message: string, paths: string[]}[]} */
  const theirs = [];
  const signed = lg.signs(root);
  for (const { sha, message, id } of commits) {
    if (id !== null && off.has(id)) continue;
    const merged = lg.mergeTree(root, `${sha}^`, tip, sha);
    if ('conflicts' in merged) {
      if (id === null) theirs.push({ sha, message, paths: merged.conflicts });
      else off.set(id, { sha, paths: merged.conflicts });
      continue;
    }
    if (merged.tree === git(root, ['rev-parse', `${tip}^{tree}`]).trim()) continue;
    tip = lg.commitTree(root, { tree: merged.tree, parent: tip, message, signed }, `${lg.short(sha)}'s replay`, 'try again');
  }
  return { tip, off, theirs };
}

/**
 * The quick-fix's branch moved from `from` to `to` — in the checkout that
 * has it out, refused first, nothing moved, while that checkout holds
 * changes not committed, naming them.
 * @param {string} root @param {string} branch @param {string} from @param {string} to @param {string} why what the move is, as the refusal names it
 */
function moveBranch(root, branch, from, to, why) {
  const holder = lg.holderOf(root, branch);
  if (holder === undefined) {
    git(root, ['update-ref', '-m', `${branch} ${why}`, `refs/heads/${branch}`, to, from]);
    return;
  }
  const dirty = lg.changesAt(holder.path);
  if (dirty.length > 0) {
    throw new Error(`${branch} ${why}, and it is checked out at ${holder.path} with changes not committed — ${dirty.map(lg.plain).join(', ')} — so nothing moved: commit them or set them aside, then try again`);
  }
  // A file touched but unchanged leaves its index entry stale, which reset --keep refuses as "not uptodate".
  tryGit(holder.path, ['update-index', '-q', '--refresh']);
  git(holder.path, ['reset', '-q', '--keep', to]);
}

/**
 * A task's change made again on the quick-fix's branch through the door,
 * from its commit `sha` where the repository holds one, as a task left off
 * it takes it (the header's).
 * @param {TaskRef} ref @param {string|null} sha
 */
function remade(ref, sha) {
  const commit = `\`engine commit --paths <file>… --task ${ref.unit} ${shownTask(ref)} -m "<message>"\``;
  if (sha === null) return commit;
  return `\`git cherry-pick --no-commit ${lg.short(sha)}\`, settling any conflict and ending the pick with \`git cherry-pick --quit\`, which keeps its change, then ${commit}`;
}

/**
 * The warning of a task left off the branch cut again (the header's): its
 * change made again there through the door.
 * @param {string} branch @param {string} onto @param {string} id @param {{sha: string, paths: string[]}} left
 */
function leftOff(branch, onto, id, { sha, paths }) {
  const ref = parseTaskId(id);
  return `task ${shownTask(ref)}'s commit ${lg.short(sha)} does not apply on ${onto} as it stands, at ${paths.map(lg.plain).join(', ')}, so ${branch} was cut again without it and its commits after it — make its change again there through the door: ${remade(ref, sha)}`;
}

/**
 * The warning of a commit of no task's left off the branch cut again (the
 * header's): the person's, to make again there.
 * @param {string} branch @param {string} onto @param {{sha: string, message: string, paths: string[]}} left
 */
function theirsLeftOff(branch, onto, { sha, message, paths }) {
  return `the commit ${lg.short(sha)} "${lg.plain(message.split('\n')[0])}", stamped with no task, does not apply on ${onto} as it stands, at ${paths.map(lg.plain).join(', ')}, so ${branch} was cut again without it — the engine never wrote it, so it is the person's to make again there`;
}

/**
 * A repository's branch cut again (the header's), where it holds commits
 * past the branch it lands on as the host has it that have landed: what
 * that did — the repository, where the branch moved from and to, the tasks
 * replayed, those left off — and a warning for each task, and each commit
 * of the person's, left off; null where it holds none, or the repository
 * lacks it. Each task whose commits it drops has its landing read in
 * reading them (`landedCommit`), so the read's record holds it (`found`).
 * @param {RepoLanding} held
 * @returns {{answer: Record<string, unknown>, remakes: string[], theirs: string[]}|null}
 */
function cutAgain(held) {
  const { ctx, branch, tip } = held;
  const at = held.at();
  if (at === undefined) return null;
  const past = held.commits();
  const left = past.filter(({ sha, id }) => !held.landedCommit(sha, id));
  if (left.length === past.length) return null;
  const { tip: cut, off, theirs } = replayed(ctx.root, left, tip);
  moveBranch(ctx.root, branch, at, cut, `holds work landed on ${ctx.into} by hand${lg.inRepoWords(ctx.repo)}, so it is cut again from there`);
  const tasks = (/** @type {Commit[]} */ commits) => [...new Set(commits.flatMap(({ id }) => (id === null ? [] : [shownTask(parseTaskId(id))])))];
  const answer = {
    repo: ctx.repo,
    from: lg.short(at),
    to: lg.short(cut),
    replayed: tasks(left.filter(({ id }) => id !== null && !off.has(id))),
    ...(off.size > 0 ? { left_off: tasks(left.filter(({ id }) => id !== null && off.has(id))) } : {}),
  };
  return { answer, remakes: [...off].map(([id, missed]) => leftOff(branch, ctx.into, id, missed)), theirs: theirs.map((missed) => theirsLeftOff(branch, ctx.into, missed)) };
}

/**
 * The way on for a quick-fix's task's commit made on another branch: the
 * quick-fix's worktree, on its own branch, and the start that lays it out.
 * @param {string} cwd @param {TaskRef} ref
 */
function branchWayOn(cwd, ref) {
  return `a quick-fix's task is built in its worktree, on ${quickFixBranch(ref.unit)}: commit from ${fixWorktree(cwd, ref.unit).root}, which \`engine task start ${ref.unit} ${shownTask(ref)}\` lays out`;
}

/**
 * The nested repositories the quick-fix's record names (the header's),
 * each by its folder in the project: those its tasks committed in.
 * @param {Record<string, any>|null} manifest the unit's
 * @returns {string[]}
 */
const recordedRepos = (manifest) => manifest?.fixes?.repos ?? [];

/**
 * Each nested repository a quick-fix's task is about to commit in recorded
 * in the unit's state (the header's), where the record does not name it
 * already, the manifest committed to the state branch: what that commit
 * warned of.
 * @param {string} cwd @param {string} unit @param {Repo[]} repos those the commit commits in
 * @returns {string[]}
 */
function recordRepos(cwd, unit, repos) {
  const nested = repos.filter((repo) => repo.dir !== '').map((repo) => repo.dir);
  if (nested.length === 0) return [];
  return withWorkUnitLock(cwd, unit, () => {
    const manifest = loadWorkUnitManifest(cwd, unit);
    const held = recordedRepos(manifest);
    const added = nested.filter((dir) => !held.includes(dir));
    if (added.length === 0) return [];
    manifest.fixes = { ...manifest.fixes, repos: [...held, ...added] };
    saveWorkUnitManifest(cwd, unit, manifest);
    /** @type {string[]} */
    const warnings = [];
    commitStateTail(cwd, [`${unit}/manifest.json`], `quick-fix(${unit}): record its work in ${added.map(lg.plain).join(', ')}`, warnings);
    return warnings;
  });
}

/** The project's repositories holding the quick-fix's branch, or `name`, children first. @param {string} cwd @param {string} name */
const holding = (cwd, name) => childrenFirst(projectRepos(codeRoot(cwd))).filter((repo) => lg.branches(repo.path).has(name));

/**
 * The quick-fix's branches' tips, as a run names the code it ran
 * (runs.cjs): each repository's holding it — null where none does.
 * @param {string} cwd @param {string} unit
 * @returns {{repo: string, commit: string}[]|null}
 */
function branchHead(cwd, unit) {
  const branch = quickFixBranch(unit);
  const heads = holding(cwd, branch).map((repo) => ({ repo: repoName(repo), commit: /** @type {string} */ (lg.branches(repo.path).get(branch)) }));
  return heads.length === 0 ? null : heads;
}

const MOVED = 'moved/';

/** The name a move keeps the quick-fix's branch under (the header's). @param {string} unit */
const movedBranch = (unit) => `${MOVED}${quickFixBranch(unit)}`;

/** A kept branch as a move, a cancel and the first opening name it: with its repository, where it is nested. @param {Repo} repo @param {string} branch */
const keptName = (repo, branch) => `${branch}${repo.dir === '' ? '' : ` in ${lg.plain(repo.dir)}`}`;

/** Whether a repository's quick-fix branch holds commits past the branch it lands on. @param {string} cwd @param {Repo} repo @param {string} unit */
const branchHolds = (cwd, repo, unit) => lg.holdsBeyond(repo.path, [quickFixBranch(unit)], [lg.landingBranch(cwd, repo, unit)]);

/**
 * The names the quick-fix's branches holding commits past the branch each
 * lands on are kept under: those a move has kept already, and those it
 * keeps.
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptUnder(cwd, unit) {
  return childrenFirst(projectRepos(codeRoot(cwd))).filter((repo) => {
    const held = lg.branches(repo.path);
    return held.has(movedBranch(unit)) || (held.has(quickFixBranch(unit)) && branchHolds(cwd, repo, unit));
  }).map((repo) => keptName(repo, movedBranch(unit)));
}

/**
 * The quick-fix's code as its close leaves it (the header's): its worktree
 * taken apart, then the branch deleted in each repository where it is spent
 * (`spent`) — one still checked out somewhere left as it is.
 * @param {string} cwd @param {string} unit
 */
function fixClosed(cwd, unit) {
  takeFixApart(cwd, unit);
  const branch = quickFixBranch(unit);
  const manifest = loadWorkUnitManifest(cwd, unit);
  for (const repo of holding(cwd, branch)) if (spent(cwd, repo, unit, manifest)) tryGit(repo.path, ['branch', '-D', branch]);
}

/**
 * Whether a repository's quick-fix branch is spent at the close (the
 * header's): it holds no commit past the branch it lands on, or stands at a
 * tip the unit's landing records there hold, nothing added since it landed;
 * and every commit past that branch, here or as last fetched, that it holds
 * or its reflog alone keeps is a task's, stamped by the door — none of the
 * person's, below a landed tip or left off by a readying, which its
 * deletion would leave on no ref.
 * @param {string} cwd @param {Repo} repo @param {string} unit @param {Record<string, any>|null} manifest the unit's
 */
function spent(cwd, repo, unit, manifest) {
  const branch = quickFixBranch(unit);
  const at = lg.branches(repo.path).get(branch);
  const landed = !branchHolds(cwd, repo, unit) || [...recordsIn(manifest, repoName(repo)).values()].some(({ tip }) => tip === at);
  return landed && lg.tasksAlone(repo.path, branch, lg.landingBranchTips(cwd, repo, unit), stamp(), unit);
}

/**
 * Each repository's quick-fix branch set aside for its move (the header's):
 * renamed to the name it is kept under where it holds commits past the
 * branch it lands on, else deleted. Answers the names this call kept.
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function setBranchAside(cwd, unit) {
  const branch = quickFixBranch(unit);
  return holding(cwd, branch).flatMap((repo) => {
    const holds = branchHolds(cwd, repo, unit);
    git(repo.path, holds ? ['branch', '-m', branch, movedBranch(unit)] : ['branch', '-D', branch]);
    return holds ? [keptName(repo, movedBranch(unit))] : [];
  });
}

/**
 * The names the quick-fix's branches a move kept are under, where it kept
 * them: what its topic's first opening names (enter.cjs).
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptBranches(cwd, unit) {
  return holding(cwd, movedBranch(unit)).map((repo) => keptName(repo, movedBranch(unit)));
}

/**
 * The quick-fix's branches a cancel keeps under their own names that hold
 * commits past the branch each lands on, the project's first: what its
 * receipt names (render.cjs).
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function cancelKept(cwd, unit) {
  const branch = quickFixBranch(unit);
  const kept = holding(cwd, branch).filter((repo) => branchHolds(cwd, repo, unit));
  return [...kept.filter((repo) => repo.dir === ''), ...kept.filter((repo) => repo.dir !== '')].map((repo) => keptName(repo, branch));
}

module.exports = { fixWorktree, layOutFix, takeFixApart, fixClosed, refuseDirtyEnd, refuseDirtyClose, refuseDirtyLeave, readied, remade, branchWayOn, recordedRepos, recordRepos, branchHead, keptUnder, setBranchAside, keptBranches, cancelKept };
