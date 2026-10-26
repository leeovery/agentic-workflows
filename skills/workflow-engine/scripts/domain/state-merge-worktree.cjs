'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state worktree's files brought to a merge (4.7). The
// working tree holds the branch's files and what live sessions wrote and
// have not committed. A catch-up moves it from this clone's tip to the
// merge's tree, touching only the paths the move changes, and never commits,
// discards or writes over what was uncommitted:
//
// - A path the move changes that the working tree holds uncommitted is
//   merged there, three ways, by the rules the branch merges by
//   (state-merge-paths.cjs): this clone's committed copy is the ancestor,
//   the merge's copy the remote's side, and the working copy this
//   machine's. The result stays uncommitted. A manifest field the two
//   changed to different values stops the catch-up for the person's pick,
//   as one on the branch does. An uncommitted path the move leaves alone
//   stays byte for byte as it is.
// - No file is written, replaced or removed over bytes other than those it
//   was merged from: each is checked just before, with no git call between
//   the check and the write. One another session wrote meanwhile is merged
//   again from what it now holds, once; one that will not merge again
//   cleanly, or moved again, is left as it stands, with a warning naming it.
// - Every file lands whole by a rename, and every copy set beside moves
//   there by a rename, so a process killed at any point leaves each path at
//   its old bytes or its new ones, and no version only in memory.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { GitError } = require('../kernel/git.cjs');
const { STATE_BRANCH } = require('./state-worktree.cjs');
const { MergeError } = require('./state-merge-rules.cjs');
const {
  sameEntry, changedPaths, indexEntries, withPrivateIndex, fillIndex, mergePath, separateClashes, isUnder,
} = require('./state-merge-paths.cjs');

/** @typedef {import('./state-merge-paths.cjs').Entry} Entry */
/** @typedef {import('./state-merge-paths.cjs').Entries} Entries */
/** @typedef {import('./state-merge-paths.cjs').PathConflict} PathConflict */
/** @typedef {import('./state-merge-paths.cjs').PickOf} PickOf */

/**
 * A merge's context, with the state worktree's root, the hash its objects
 * are named by, and the folder new files are staged in before they land.
 * @typedef {import('./state-merge-paths.cjs').MergeContext & {root: string, objectFormat: string, staged: string}} WorktreeContext
 */

/** A path brought from the bytes `from` to `to`, none where it goes. @typedef {{file: string, from: Entry|undefined, to: Entry|undefined}} Write */
/** A copy set beside another, by a rename. @typedef {{from: string, to: string}} Move */
/** In this order: the files removed, the copies set beside, the files written. @typedef {{removes: Write[], moves: Move[], writes: Write[]}} Steps */

/**
 * The working tree's move worked out: its steps, the manifest fields left to
 * a pick, the notes on what was merged, and the uncommitted paths it merged
 * and those it leaves as they are.
 * @typedef {{steps: Steps, conflicts: PathConflict[], notes: string[], merged: string[], kept: string[]}} WorktreePlan
 */

/** @typedef {{notes: string[], warnings: string[]}} Report */

/** @param {string[]} files @returns {string} */
function nulJoined(files) {
  return files.map((file) => `${file}\0`).join('');
}

/**
 * The working tree's files as they stand, read through the private index
 * from this clone's tip, never through the worktree's own index, whatever it
 * holds staged.
 * @param {WorktreeContext} ctx @param {string} local @returns {Entries}
 */
function workingEntries(ctx, local) {
  return withPrivateIndex(ctx, (env) => {
    ctx.git.run(['read-tree', local], { env });
    ctx.git.run(['add', '--all'], { env });
    return indexEntries(ctx.git, env);
  });
}

/**
 * Work out the working tree's move from this clone's tip to the merge's
 * tree: each path the move changes merged with what the working tree holds,
 * then each file-against-folder clash with an uncommitted path separated.
 * @param {WorktreeContext} ctx @param {Entries} local @param {Entries} target @param {Entries} working @param {PickOf} pickOf
 * @returns {WorktreePlan}
 */
function planWorktree(ctx, local, target, working, pickOf) {
  const dirty = changedPaths(local, working);
  /** @type {Steps} */
  const steps = { removes: [], moves: [], writes: [] };
  /** @type {PathConflict[]} */
  const conflicts = [];
  /** @type {string[]} */
  const notes = [];
  const layout = new Map(working);
  const changed = changedPaths(local, target);
  for (const file of changed) {
    const result = mergePath(ctx, file, { base: local.get(file), local: working.get(file), remote: target.get(file) }, pickOf);
    conflicts.push(...(result.conflicts ?? []));
    if (result.note !== undefined) notes.push(result.note);
    let from = working.get(file);
    if (result.beside !== undefined) {
      steps.moves.push({ from: file, to: result.beside.path });
      layout.set(result.beside.path, result.beside.entry);
      from = undefined;
    }
    if (sameEntry(from, result.entry)) continue;
    if (result.entry === undefined) {
      steps.removes.push({ file, from, to: undefined });
      layout.delete(file);
    } else {
      steps.writes.push({ file, from, to: result.entry });
      layout.set(file, result.entry);
    }
  }
  const clashes = separateClashes(ctx, layout, target);
  steps.moves.push(...clashes.moves);
  const touched = new Set([...changed, ...dirty.filter((file) => clashes.moves.some((move) => file === move.from || isUnder(move.from, file)))]);
  return {
    steps,
    conflicts,
    notes: [...notes, ...clashes.notes],
    merged: dirty.filter((file) => touched.has(file)),
    kept: dirty.filter((file) => !touched.has(file)),
  };
}

// --- the move, made ----------------------------------------------------------

/** @param {string} at */
function exists(at) {
  try {
    fs.lstatSync(at);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the working tree holds exactly `entry`'s bytes at `file`, nothing
 * where it is undefined. Hashed here, as git names a blob, so no git call
 * stands between the check and the write it guards.
 * @param {WorktreeContext} ctx @param {string} file @param {Entry|undefined} entry
 */
function holds(ctx, file, entry) {
  const at = path.join(ctx.root, file);
  let stat;
  try {
    stat = fs.lstatSync(at);
  } catch {
    return entry === undefined;
  }
  if (entry === undefined || !(stat.isFile() || stat.isSymbolicLink())) return false;
  const bytes = stat.isSymbolicLink() ? fs.readlinkSync(at, { encoding: 'buffer' }) : fs.readFileSync(at);
  return crypto.createHash(ctx.objectFormat).update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === entry.oid;
}

/**
 * The file as it now stands, written to the object store; undefined where
 * nothing is there, null where something other than a file is.
 * @param {WorktreeContext} ctx @param {string} file @returns {Entry|undefined|null}
 */
function stored(ctx, file) {
  let stat;
  try {
    stat = fs.lstatSync(path.join(ctx.root, file));
  } catch {
    return undefined;
  }
  if (!stat.isFile()) return null;
  const oid = ctx.git.run(['hash-object', '-w', '--no-filters', '--', file]).trim();
  return { mode: stat.mode & 0o100 ? '100755' : '100644', oid };
}

/** @param {string} file */
function leftAsItStands(file) {
  return `${file} changed while the state caught up and was left as it stands, unmerged: the remote's side of it is the copy committed on ${STATE_BRANCH}`;
}

/**
 * One path merged, or null where its copies cannot be: one is not what its
 * rule reads, or git fails on it.
 * @param {WorktreeContext} ctx @param {string} file @param {import('./state-merge-paths.cjs').Versions} versions
 * @returns {import('./state-merge-paths.cjs').PathMerge|null}
 */
function tryMerge(ctx, file, versions) {
  try {
    return mergePath(ctx, file, versions, () => null);
  } catch (err) {
    if (err instanceof GitError || err instanceof MergeError) return null;
    throw err;
  }
}

/**
 * A file another session wrote after it was merged: the move's change to it
 * merged again into what it now holds. Null where nothing is left to write,
 * or where it will not merge cleanly, which leaves it as it stands.
 * @param {WorktreeContext} ctx @param {Write} write @param {Report} report
 * @returns {Write|null}
 */
function mergeAgain(ctx, write, report) {
  const now = stored(ctx, write.file);
  const result = now === null ? null : tryMerge(ctx, write.file, { base: write.from, local: now, remote: write.to });
  if (now === null || result === null || result.beside !== undefined || (result.conflicts ?? []).length > 0) {
    report.warnings.push(leftAsItStands(write.file));
    return null;
  }
  if (result.note !== undefined) report.notes.push(result.note);
  return sameEntry(result.entry, now) ? null : { file: write.file, from: now, to: result.entry };
}

/** @param {string} root @param {string} file */
function removeFile(root, file) {
  const at = path.join(root, file);
  fs.unlinkSync(at);
  for (let folder = path.dirname(at); folder !== root; folder = path.dirname(folder)) {
    try {
      fs.rmdirSync(folder);
    } catch {
      return;
    }
  }
}

/** Set a copy beside, never over anything already there. @param {WorktreeContext} ctx @param {Move} move @param {Report} report */
function moveBeside(ctx, move, report) {
  const from = path.join(ctx.root, move.from);
  const to = path.join(ctx.root, move.to);
  if (!exists(from)) return;
  if (exists(to)) {
    report.warnings.push(`${move.from} was left where it is, not set beside as ${move.to}: something is already there`);
    return;
  }
  fs.renameSync(from, to);
}

/**
 * Run `fn` with each write's new bytes checked out into the staging folder,
 * cleared before and after.
 * @param {WorktreeContext} ctx @param {Write[]} writes @param {() => void} fn
 */
function withStaged(ctx, writes, fn) {
  fs.rmSync(ctx.staged, { recursive: true, force: true });
  try {
    if (writes.length > 0) {
      withPrivateIndex(ctx, (env) => {
        fillIndex(ctx, new Map(writes.map((write) => [write.file, /** @type {Entry} */ (write.to)])), env);
        ctx.git.run(['checkout-index', '-f', '-z', '--stdin', `--prefix=${ctx.staged}/`], { env, input: nulJoined(writes.map((write) => write.file)) });
      });
    }
    fn();
  } finally {
    fs.rmSync(ctx.staged, { recursive: true, force: true });
  }
}

/** Put a staged file at its path by a rename. @param {WorktreeContext} ctx @param {Write} write @param {Report} report */
function placeStaged(ctx, write, report) {
  const at = path.join(ctx.root, write.file);
  try {
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.renameSync(path.join(ctx.staged, write.file), at);
  } catch (err) {
    if (!(err instanceof Error) || !('code' in err)) throw err;
    report.warnings.push(leftAsItStands(write.file));
  }
}

/**
 * Take the steps, each file checked just before it is touched. A file that
 * moved since is merged again into a step for the next round; on the last
 * round it is left as it stands.
 * @param {WorktreeContext} ctx @param {Steps} steps @param {Report} report @param {boolean} last
 * @returns {Steps} the next round's steps
 */
function takeSteps(ctx, steps, report, last) {
  /** @type {Steps} */
  const again = { removes: [], moves: [], writes: [] };
  const moved = (/** @type {Write} */ write) => {
    if (last) {
      report.warnings.push(leftAsItStands(write.file));
      return;
    }
    const next = mergeAgain(ctx, write, report);
    if (next !== null) (next.to === undefined ? again.removes : again.writes).push(next);
  };
  for (const write of steps.removes) {
    if (holds(ctx, write.file, write.from)) removeFile(ctx.root, write.file);
    else moved(write);
  }
  for (const move of steps.moves) moveBeside(ctx, move, report);
  withStaged(ctx, steps.writes, () => {
    for (const write of steps.writes) {
      if (holds(ctx, write.file, write.from)) placeStaged(ctx, write, report);
      else moved(write);
    }
  });
  return again;
}

/**
 * Make the working tree's move.
 * @param {WorktreeContext} ctx @param {Steps} steps
 * @returns {Report}
 */
function moveWorktree(ctx, steps) {
  /** @type {Report} */
  const report = { notes: [], warnings: [] };
  const again = takeSteps(ctx, steps, report, false);
  takeSteps(ctx, again, report, true);
  return report;
}

/**
 * Bring the worktree's own index into line with `target` under the paths
 * the move changed, so `git status` reads them against it. Nothing reads
 * that index, so a failure here is a warning.
 * @param {WorktreeContext} ctx @param {string} target @param {string[]} files @returns {string[]} warnings
 */
function alignIndex(ctx, target, files) {
  if (files.length === 0) return [];
  try {
    ctx.git.run(['reset', '--quiet', '--pathspec-from-file=-', '--pathspec-file-nul', target], {
      input: nulJoined(files), env: { GIT_LITERAL_PATHSPECS: '1' },
    });
    return [];
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return [`the state worktree's index was not brought into line with ${STATE_BRANCH}: ${err.message}`];
  }
}

module.exports = { workingEntries, planWorktree, moveWorktree, alignIndex };
