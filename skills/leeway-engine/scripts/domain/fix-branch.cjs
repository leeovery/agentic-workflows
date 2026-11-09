'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a quick-fix's tasks are built — its fixes, and the fix
// tasks of a review asked for at its close — on the quick-fix's one branch,
// `fix/{unit}` (landing-names.cjs), in each repository of the project it
// touches (7.2.24): each task its own commits through the door, stamped
// with its task (commit-task.cjs), and the quick-fix landing as that
// branch's one pull request in each (landing.cjs). The project's own
// checkout, which a build, the review phase and a quick-fix's work take
// turns in (12.7.8, 19.5.18), has the branch out while a task is built
// there.
//
// - A task's start puts the project's checkout on the branch
//   (`checkOutBranch`) — refused first, before the tracker moves, while the
//   checkout holds changes not committed outside the state, naming each
//   (`codeStatus`, code.cjs) — once the branches are readied (`readied`),
//   and each nested checkout whose branch the readying made, as a branch
//   gone here or a second clone leaves it, on it too.
// - A repository nested in the project gets its branch at the first commit
//   of a task's there: the door puts it on the branch, where it lacks one
//   cut from the branch that repository lands on as the host has it
//   (`putOnBranch`) — one the quick-fix touched already has it taken from
//   the host's copy at the task's start — and, once the checks pass and
//   before it commits, records it in the unit's state, `fixes.repos` on the
//   manifest, committed to the state branch (`recordRepos`), so every
//   clone reads it as a repository the quick-fix touched (landing.cjs).
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
//   lacks, refused naming the way on where the two conflict, which, while a
//   task of the unit's is in flight in the conversation, is the merge the
//   hook before Bash passes, finished through the door (shell-guard.cjs) —
//   so no push drops a commit of the host's; then
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
//   checkout has the branch out it moves there, refused first, nothing
//   moved, while that checkout holds changes not committed, naming each.
//   Nothing else rewrites the branch; a push after it is leased against the
//   host's copy as it was read (landing.cjs).
// - The door takes a commit of a quick-fix's task in the project's own
//   checkout on the branch alone (commit-task.cjs), a commit on any other
//   naming it and the start that puts the checkout there (`branchWayOn`).
// - The close, once the quick-fix has landed, puts each checkout back on
//   the branch its repository lands on (finish.cjs), as a move that leaves
//   the quick-fix does (workunit-move.cjs), where it has the branch out —
//   refused, nothing moved, while it holds changes not committed outside
//   the state, naming each (`checkOutLanding`). The move then sets each
//   repository's branch aside (`setBranchAside`): holding commits past the
//   branch it lands on, it is kept, its commits unlanded, renamed to
//   `moved/fix/{unit}`, a name no landing reads as the unit's
//   (landing-names.cjs), so the new type's build never meets it; holding
//   none, it is deleted. The kept names are what the topic's first opening
//   names (`keptBranches`).
// ---------------------------------------------------------------------------

const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit, git } = require('../kernel/git.cjs');
const { projectRepos, repoName, childrenFirst } = require('../kernel/repos.cjs');
const { withWorkUnitLock, loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { codeStatus } = require('./code.cjs');
const { commitStateTail } = require('./commit.cjs');
const lg = require('./landing-git.cjs');
const { quickFixBranch } = require('./landing-names.cjs');
const { parseTaskId, shownTask, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./landing.cjs').RepoLanding} RepoLanding */
/** @typedef {import('./landing.cjs').QuickFixLanding} QuickFixLanding */

/** The landing, read when asked: it reads the task verbs, which read this module. */
const landing = () => require('./landing.cjs');
/** The build's entry, read when asked, for the calling conversation's tasks in flight: it reads the task verbs too. */
const buildEntry = () => require('./build-entry.cjs');

/** The branch the checkout has out, or null where it is detached. @param {string} root */
const branchOut = (root) => tryGit(root, ['symbolic-ref', '-q', '--short', 'HEAD'])?.trim() ?? null;

/** The changes the project's checkout holds not committed outside the state. @param {string} cwd */
const dirtOf = (cwd) => codeStatus(cwd).files.map(({ path }) => path);

/** A repository as a line names it: its folder, or nothing for the project's own. @param {string} repo as answers name it */
const inWords = (repo) => (repo === '.' ? '' : ` in ${lg.plain(repo)}`);

/** A warning of a repository's, as the verb gives it: one in a nested repository naming it. @param {string} repo @param {string} warning */
const saidIn = (repo, warning) => (repo === '.' ? warning : `in ${lg.plain(repo)}, ${warning}`);

/**
 * Refuse a move of the project's checkout while it holds changes not
 * committed outside the state, the refusal naming them.
 * @param {string} cwd @param {(dirty: string) => string} refusal
 */
function refuseDirt(cwd, refusal) {
  const dirty = dirtOf(cwd);
  if (dirty.length > 0) throw new Error(refusal(dirty.join(', ')));
}

/** Refuse to start a quick-fix's task while the project's checkout holds changes not committed. @param {string} cwd @param {TaskRef} ref */
function refuseDirty(cwd, ref) {
  refuseDirt(cwd, (dirty) => `${taskName(ref)} is built in the project's own checkout, which holds changes not committed — ${dirty} — so it was not put on ${ref.unit}'s branch: commit them or set them aside, then start the task again`);
}

/** Refuse a quick-fix's close while the project's checkout holds changes not committed. @param {string} cwd @param {string} unit */
function refuseDirtyClose(cwd, unit) {
  refuseDirt(cwd, (dirty) => `${unit}'s tasks were built in the project's own checkout, which holds changes not committed — ${dirty} — so nothing was landed: commit them or set them aside, then close it again`);
}

/**
 * The project's checkout put on the quick-fix's branch once every
 * repository's is readied (the header's), the project's own cut at the
 * first start where neither it nor the host has one, and each nested
 * checkout whose branch the readying made put on it too. Answers the
 * branch, and each repository the readying cut again, with its warnings,
 * where it did.
 * @param {string} cwd @param {string} unit
 * @returns {{branch: string, cut_again?: Record<string, unknown>[], warnings?: string[]}}
 */
function checkOutBranch(cwd, unit) {
  const root = codeRoot(cwd);
  const branch = quickFixBranch(unit);
  const { cut, remakes, warnings, made } = readied(landing().quickFixLanding(cwd, unit), true);
  for (const nested of made.filter((ctx) => ctx.repo !== '.')) lg.switchTo(nested.root, branch);
  if (branchOut(root) !== branch) lg.switchTo(root, branch);
  const said = [...remakes, ...warnings];
  return { branch, ...(cut.length > 0 ? { cut_again: cut } : {}), ...(said.length > 0 ? { warnings: said } : {}) };
}

/**
 * Every repository's branch readied (the header's), refused first, nothing
 * moved, where the host's copy is another's (`refuseForeign`): taken from
 * the host where the repository lacks it — `fresh`, at the first start, cut
 * in the project's own from the branch it lands on as the host has it
 * where the host has none — the host's head brought in, then cut again
 * where it holds work landed. Answers each repository cut again, the
 * warning of each task left off — its change to make again through the
 * door — every other warning that gave, and the context of each repository
 * whose branch it made.
 * @param {QuickFixLanding} read @param {boolean} [fresh]
 * @returns {{cut: Record<string, unknown>[], remakes: string[], warnings: string[], made: RepoLanding['ctx'][]}}
 */
function readied(read, fresh = false) {
  read.repos.forEach(refuseForeign);
  /** @type {Record<string, unknown>[]} */
  const cut = [];
  /** @type {string[]} */
  const remakes = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {RepoLanding['ctx'][]} */
  const made = [];
  for (const held of read.repos) {
    const here = held.at();
    const at = here ?? taken(held, fresh && held.ctx.repo === '.');
    if (at === null) continue;
    if (here === undefined) made.push(held.ctx);
    broughtIn(held, at);
    const again = cutAgain(held);
    if (again === null) continue;
    cut.push(again.answer);
    remakes.push(...again.remakes.map((warning) => saidIn(held.ctx.repo, warning)));
    warnings.push(...again.theirs.map((warning) => saidIn(held.ctx.repo, warning)));
  }
  return { cut, remakes, warnings, made };
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
  const why = `takes the commits its pull request holds${inWords(repo)}`;
  if (lg.isAncestor(root, at, head)) {
    moveBranch(root, held.branch, at, head, why);
    return;
  }
  if (lg.holdsChange(root, at, head)) return;
  const merged = lg.mergeTree(root, lg.mergeBase(root, at, head), at, head);
  if ('conflicts' in merged) {
    throw new Error(`land: ${held.branch}${inWords(repo)} and its pull request's head, ${lg.short(head)}, each hold commits the other lacks, conflicting at ${merged.conflicts.map(lg.plain).join(', ')}, so nothing moved — `
      + `${mergeWayOn(held, head)}, and try again`);
  }
  const message = `Merge ${lg.short(head)}, ${held.ctx.unit}'s pull request's head, into ${held.branch}\n`;
  const commit = lg.commitTree(root, { tree: merged.tree, parent: [at, head], message, signed: lg.signs(root) }, `the merge of its pull request's head into ${held.branch}`, 'try again');
  moveBranch(root, held.branch, at, commit, why);
}

/**
 * The way on for the host's head conflicting with the branch (the
 * header's): merged into the branch there, settling the conflict — while a
 * task of the unit's is in flight in the calling conversation, with the
 * merge the hook before Bash passes, finished through the door under it.
 * @param {RepoLanding} held @param {string} head
 */
function mergeWayOn(held, head) {
  const { unit, repo } = held.ctx;
  const [task] = buildEntry().ownInFlight(unit);
  if (task === undefined) return `merge ${lg.short(head)} into ${held.branch} there, settling the conflict`;
  const gitIn = repo === '.' ? 'git' : `git -C ${lg.quoted(repo)}`;
  return `merge it into ${held.branch} there with \`${gitIn} merge --no-ff --no-commit ${lg.short(head)}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
    + `\`engine commit --paths <file>… --task ${unit} ${task.task} -m "<message>"\``;
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
 * lacks it.
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
  moveBranch(ctx.root, branch, at, cut, `holds work landed on ${ctx.into} by hand${inWords(ctx.repo)}, so it is cut again from there`);
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
 * quick-fix's own, and the start that puts the checkout there.
 * @param {TaskRef} ref
 */
function branchWayOn(ref) {
  return `a quick-fix's task is built in the project's own checkout, on ${quickFixBranch(ref.unit)} — \`engine task start ${ref.unit} ${shownTask(ref)}\` puts the checkout on it`;
}

/**
 * Each nested repository a quick-fix's task commits in put on the
 * quick-fix's branch (the header's): made where it lacks one, from the tip
 * of the branch it lands on as the host has it (`landingTips`,
 * landing.cjs), its changes not committed carried there — refused where git
 * cannot carry them, naming the repository.
 * @param {string} cwd @param {string} unit @param {Repo[]} repos those the commit commits in
 */
function putOnBranch(cwd, unit, repos) {
  const branch = quickFixBranch(unit);
  const nested = repos.filter((repo) => repo.dir !== '' && branchOut(repo.path) !== branch);
  if (nested.length === 0) return;
  const all = projectRepos(codeRoot(cwd));
  for (const repo of nested) {
    if (!lg.branches(repo.path).has(branch)) git(repo.path, ['branch', '--no-track', branch, /** @type {string} */ (landing().landingTips(cwd, unit, all, [repo]).get(repo.dir))]);
    try {
      lg.switchTo(repo.path, branch);
    } catch (err) {
      throw new Error(`commit --task: ${repoName(repo)} takes ${unit}'s work on ${branch}, and git could not put it there with its changes (${lg.gitSaid(/** @type {import('../kernel/git.cjs').GitError} */ (err))}) — commit or set aside what stands in the way there, then commit again`);
    }
  }
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

/** A kept branch as the move and the first opening name it: with its repository, where it is nested. @param {Repo} repo @param {string} unit */
const keptName = (repo, unit) => `${movedBranch(unit)}${repo.dir === '' ? '' : ` in ${lg.plain(repo.dir)}`}`;

/** The branch a repository lands on, read off git here. @param {string} cwd @param {Repo} repo */
const landsHere = (cwd, repo) => lg.landsOn(cwd, repo);

/** Whether a repository's quick-fix branch holds commits past the branch it lands on. @param {string} cwd @param {Repo} repo @param {string} unit */
const branchHolds = (cwd, repo, unit) => lg.holdsBeyond(repo.path, [quickFixBranch(unit)], [landsHere(cwd, repo)]);

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
  }).map((repo) => keptName(repo, unit));
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
    return holds ? [keptName(repo, unit)] : [];
  });
}

/**
 * The names the quick-fix's branches a move kept are under, where it kept
 * them: what its topic's first opening names (enter.cjs).
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptBranches(cwd, unit) {
  return holding(cwd, movedBranch(unit)).map((repo) => keptName(repo, unit));
}

/**
 * Each checkout taken back to the branch its repository lands on, where it
 * has the quick-fix's branch out — refused first, nothing moved, while the
 * project's holds changes not committed outside the state, naming each,
 * and while a nested one holds any. Answers the branch it took the
 * project's checkout to, or null where it had another out.
 * @param {string} cwd @param {string} unit
 * @returns {string|null}
 */
function checkOutLanding(cwd, unit) {
  const branch = quickFixBranch(unit);
  const out = childrenFirst(projectRepos(codeRoot(cwd))).filter((repo) => branchOut(repo.path) === branch);
  for (const repo of out) {
    const lands = landsHere(cwd, repo);
    const back = `${unit}'s tasks leave ${repo.dir === '' ? 'the project\'s checkout' : `${repoName(repo)}'s checkout`}, which holds changes not committed`;
    const way = (/** @type {string} */ dirty) => `${back} — ${dirty} — so it was not taken back to ${lands}: commit them on ${branch} or set them aside, then say yes again`;
    if (repo.dir === '') refuseDirt(cwd, way);
    else if (lg.changesAt(repo.path).length > 0) throw new Error(way(lg.changesAt(repo.path).map(lg.plain).join(', ')));
  }
  let own = null;
  for (const repo of out) {
    const lands = landsHere(cwd, repo);
    lg.switchTo(repo.path, lands);
    if (repo.dir === '') own = lands;
  }
  return own;
}

module.exports = { refuseDirty, refuseDirtyClose, checkOutBranch, readied, remade, checkOutLanding, branchWayOn, putOnBranch, recordedRepos, recordRepos, branchHead, movedBranch, keptUnder, setBranchAside, keptBranches };
