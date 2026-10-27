'use strict';

// ---------------------------------------------------------------------------
// Domain ring: one state path merged from three versions, and a whole tree
// (4.7). A version is git's entry for the path, a mode and an object id; the
// merge writes blobs and nothing else, and its caller builds the tree or
// writes the files.
//
// - A path only one side changed takes that side's version whole.
// - A path both sides changed goes to its rule. The ledger, the migrations
//   record and the manifests merge by state-merge-rules.cjs, whatever their
//   size: the ledger and the migrations record are read a line at a time,
//   and a manifest is read whole, since its fields must merge. Any other
//   text goes through git's three-way merge, the remote's copy the one
//   merged into; where both changed the same lines, both versions' lines are
//   kept, the remote's first. A file that is not text, a JSON file that is
//   none of the above, and any other file over the read budget is kept
//   whole, the last never read: the remote's copy at the path and this
//   machine's beside it, named by its blob's id. A file deleted on one side
//   and changed on the other keeps the changed copy.
// - The versions a whole tree's merge reads whole are read together, before
//   any path is merged.
// - A file on one side where the other side has a folder cannot sit in one
//   tree: the remote's stays at the path, and this machine's is set beside
//   it, a file named by its blob's id and a folder by its tree's.
// - Every merge that is not clean carries a note saying what was kept where.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  MergeError, ruleOf, linesToAdd, entryId, migrationId, mergeManifest, conflictLabel,
} = require('./state-merge-rules.cjs');
const {
  withScratch, readBlobs, blobOf, blobToFile, fileLines, endsWithNewline,
} = require('./state-merge-blobs.cjs');

/** @typedef {import('../kernel/isolated-git.cjs').IsolatedGit} IsolatedGit */
/** @typedef {import('./state-merge-rules.cjs').Choice} Choice */
/** @typedef {import('./state-merge-rules.cjs').KeyOf} KeyOf */
/** @typedef {import('./projections/state-merge.cjs').Conflict} Conflict */
/** @typedef {{mode: string, oid: string}} Entry */
/** @typedef {Map<string, Entry>} Entries */
/** @typedef {{base: Entry|undefined, local: Entry|undefined, remote: Entry|undefined}} Versions */

/**
 * What a merge works with: what reading blobs takes (state-merge-blobs.cjs),
 * the read budget in bytes, the private index it may use, in the worktree's
 * git dir, and the project's name for the screen's labels.
 * @typedef {import('./state-merge-blobs.cjs').BlobContext & {budget: number, index: string, project: string}} MergeContext
 */

/** @typedef {(manifest: string, choice: Choice) => 'local'|'remote'|null} PickOf */

/** A conflict as a path's merge finds it, before the caller says where. @typedef {Omit<Conflict, 'uncommitted'>} PathConflict */

/**
 * One path merged: the entry at the path (none where it goes), this
 * machine's copy where it is set beside, the manifest fields left to a pick,
 * and a note where the merge was not clean.
 * @typedef {{
 *   entry: Entry|undefined,
 *   beside?: {path: string, entry: Entry},
 *   conflicts?: PathConflict[],
 *   note?: string,
 * }} PathMerge
 */

/** @param {Entry|undefined} a @param {Entry|undefined} b */
function sameEntry(a, b) {
  return a === b || (a !== undefined && b !== undefined && a.mode === b.mode && a.oid === b.oid);
}

/** The paths whose entries differ between two trees, sorted. @param {Entries} a @param {Entries} b */
function changedPaths(a, b) {
  return [...new Set([...a.keys(), ...b.keys()])].filter((file) => !sameEntry(a.get(file), b.get(file))).sort();
}

/** @param {string} text @param {(fields: string[]) => [string, Entry]} parse @returns {Entries} */
function parseEntries(text, parse) {
  return new Map(text.split('\0').filter((record) => record !== '').map((record) => {
    const tab = record.indexOf('\t');
    return parse([...record.slice(0, tab).split(' '), record.slice(tab + 1)]);
  }));
}

/** A commit's or tree's files. @param {IsolatedGit} git @param {string} treeish @returns {Entries} */
function entriesOf(git, treeish) {
  return parseEntries(git.run(['ls-tree', '-r', '-z', '--full-tree', treeish]), ([mode, , oid, file]) => [file, { mode, oid }]);
}

/** An index's files. @param {IsolatedGit} git @param {Record<string, string>} env @returns {Entries} */
function indexEntries(git, env) {
  return parseEntries(git.run(['ls-files', '-s', '-z'], { env }), ([mode, oid, , file]) => [file, { mode, oid }]);
}

/**
 * Run `fn` with git pointed at the private index at `index`, cleared before
 * and after — the merge's, and the state commit's.
 * @template T @param {string} index @param {(env: Record<string, string>) => T} fn @returns {T}
 */
function withPrivateIndex(index, fn) {
  const clear = () => {
    for (const file of [index, `${index}.lock`]) fs.rmSync(file, { force: true });
  };
  clear();
  try {
    return fn({ GIT_INDEX_FILE: index });
  } finally {
    clear();
  }
}

/** Fill an index with entries. @param {MergeContext} ctx @param {Entries} entries @param {Record<string, string>} env */
function fillIndex(ctx, entries, env) {
  const info = [...entries].map(([file, { mode, oid }]) => `${mode} ${oid}\t${file}\0`).join('');
  if (info !== '') ctx.git.run(['update-index', '-z', '--index-info'], { env, input: info });
}

/** @param {MergeContext} ctx @param {Entries} entries @returns {string} the tree's id */
function writeTree(ctx, entries) {
  return withPrivateIndex(ctx.index, (env) => {
    fillIndex(ctx, entries, env);
    return ctx.git.run(['write-tree'], { env }).trim();
  });
}

/** @param {MergeContext} ctx @param {string} text @param {string} mode @returns {Entry} */
function blob(ctx, text, mode) {
  return { mode, oid: ctx.git.run(['hash-object', '-w', '--stdin'], { input: text }).trim() };
}

/** A file's bytes written to the object store as they are, whatever filters the config names. @param {MergeContext} ctx @param {string} file @param {string} mode @returns {Entry} */
function fileBlob(ctx, file, mode) {
  return { mode, oid: ctx.git.run(['hash-object', '-w', '--no-filters', '--', file]).trim() };
}

/** @param {Versions} versions @returns {string} the merged file's mode: the remote's, else this machine's */
function modeOf({ local, remote }) {
  return /** @type {Entry} */ (remote ?? local).mode;
}

const TEXT_MODES = ['100644', '100755'];

/**
 * The most bytes of a version its rule reads whole: a manifest all of it,
 * since its fields must merge, and any other file the read budget; null
 * where the rule reads none whole.
 * @param {MergeContext} ctx @param {import('./state-merge-rules.cjs').MergeRule} rule @returns {number|null}
 */
function readLimit(ctx, rule) {
  if (rule === 'manifest') return Infinity;
  return rule === 'file' ? ctx.budget : null;
}

/**
 * A file's text, or null where it is not text the merge can take whole: a
 * link or a submodule, over the read budget, a NUL in it, or bytes that do
 * not come back the same when read as UTF-8.
 * @param {MergeContext} ctx @param {Entry|undefined} entry @returns {string|null}
 */
function textOf(ctx, entry) {
  if (entry === undefined) return '';
  if (!TEXT_MODES.includes(entry.mode)) return null;
  const { bytes } = blobOf(ctx, entry.oid, /** @type {number} */ (readLimit(ctx, 'file')));
  if (bytes === null || bytes.includes(0)) return null;
  const text = bytes.toString('utf8');
  return Buffer.from(text).equals(bytes) ? text : null;
}

// --- one path both sides changed --------------------------------------------

/** @param {string} file */
function changedCopyKept(file) {
  return `${file} was deleted on one machine and changed on the other: the changed copy is kept`;
}

/** @param {string} file @param {Versions} versions @returns {PathMerge} */
function keepChanged(file, { local, remote }) {
  return { entry: local ?? remote, note: changedCopyKept(file) };
}

/** Where this machine's copy of a path is set beside the remote's. @param {string} file @param {string} oid */
function besidePath(file, oid) {
  const ext = path.posix.extname(file);
  return `${ext === '' ? file : file.slice(0, -ext.length)}.${oid.slice(0, 8)}${ext}`;
}

/** @param {string} file @param {Versions} versions @returns {PathMerge} */
function keepBoth(file, versions) {
  const local = /** @type {Entry} */ (versions.local);
  const beside = besidePath(file, local.oid);
  return {
    entry: versions.remote,
    beside: { path: beside, entry: local },
    note: `${file} was changed on both machines and is not merged line by line: the remote's copy stays at ${file}, and this machine's is kept beside it as ${beside}`,
  };
}

/** @param {string} file @param {Versions} versions @returns {PathMerge} */
function keepWhole(file, versions) {
  return versions.local === undefined || versions.remote === undefined ? keepChanged(file, versions) : keepBoth(file, versions);
}

/**
 * A text file both sides changed, through git's three-way merge with the
 * remote's copy as the one merged into, which git writes the result over;
 * where both changed the same lines, the union of both, the remote's lines
 * first.
 * @param {MergeContext} ctx @param {string} file @param {Versions} versions @param {string[]} texts  base, local, remote
 * @returns {PathMerge}
 */
function mergeText(ctx, file, versions, [base, local, remote]) {
  return withScratch(ctx, (dir) => {
    const [remoteFile, baseFile, localFile] = ['remote', 'base', 'local'].map((name) => path.join(dir, name));
    fs.writeFileSync(remoteFile, remote);
    fs.writeFileSync(baseFile, base);
    fs.writeFileSync(localFile, local);
    if (ctx.git.tryRun(['merge-file', remoteFile, baseFile, localFile]) !== null) return { entry: fileBlob(ctx, remoteFile, modeOf(versions)) };
    fs.writeFileSync(remoteFile, remote);
    ctx.git.run(['merge-file', '--union', remoteFile, baseFile, localFile]);
    return {
      entry: fileBlob(ctx, remoteFile, modeOf(versions)),
      note: `${file} was changed in the same place on both machines: both machines' lines are kept there, the remote's first — read it through`,
    };
  });
}

/** @param {MergeContext} ctx @param {string} file @param {Versions} versions @returns {PathMerge} */
function mergeOtherFile(ctx, file, versions) {
  if (versions.local === undefined || versions.remote === undefined) return keepChanged(file, versions);
  const texts = [versions.base, versions.local, versions.remote].map((entry) => textOf(ctx, entry));
  if (texts.some((text) => text === null)) return keepBoth(file, versions);
  return mergeText(ctx, file, versions, /** @type {string[]} */ (texts));
}

/**
 * One side's manifest, parsed. Refuses one that is not a JSON object: a
 * manifest the engine cannot read is not one the merge can take apart.
 * @param {MergeContext} ctx @param {string} file @param {Entry} entry @param {string} whose
 * @returns {Record<string, unknown>}
 */
function manifestOf(ctx, file, entry, whose) {
  let value;
  try {
    value = JSON.parse(/** @type {Buffer} */ (blobOf(ctx, entry.oid, /** @type {number} */ (readLimit(ctx, 'manifest'))).bytes).toString('utf8'));
  } catch {
    value = null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MergeError(`cannot merge ${file}: ${whose} copy is not a JSON object`);
  }
  return value;
}

/** @param {MergeContext} ctx @param {string} file @param {Versions} versions @param {PickOf} pickOf @returns {PathMerge} */
function mergeManifestFile(ctx, file, versions, pickOf) {
  if (versions.local === undefined || versions.remote === undefined) return keepChanged(file, versions);
  const base = versions.base === undefined ? undefined : manifestOf(ctx, file, versions.base, "the common ancestor's");
  const merged = mergeManifest(
    base,
    manifestOf(ctx, file, versions.local, "this machine's"),
    manifestOf(ctx, file, versions.remote, "the remote's"),
    (choice) => pickOf(file, choice),
  );
  return {
    entry: blob(ctx, `${JSON.stringify(merged.value, null, 2)}\n`, modeOf(versions)),
    conflicts: merged.conflicts.map((c) => ({ manifest: file, ...c, label: conflictLabel(file, c.field, ctx.project) })),
  };
}

/**
 * The ledger or the migrations record merged as lines, at any size: each
 * side's copy written to a file by git, then the remote's copied as it is
 * and this clone's lines whose keys the remote's lack added, each file read
 * a chunk at a time. The remote's copy itself where nothing is added.
 * @param {MergeContext} ctx @param {Versions} versions @param {KeyOf} keyOf @returns {PathMerge}
 */
function unionLines(ctx, versions, keyOf) {
  return withScratch(ctx, (dir) => {
    const [remote, local, union] = ['remote', 'local', 'union'].map((name) => path.join(dir, name));
    blobToFile(ctx, versions.remote?.oid, remote);
    blobToFile(ctx, versions.local?.oid, local);
    const added = linesToAdd(fileLines(remote), fileLines(local), keyOf);
    try {
      let line = added.next();
      if (line.done && versions.remote !== undefined) return { entry: versions.remote };
      fs.copyFileSync(remote, union);
      const fd = fs.openSync(union, 'a');
      try {
        if (!endsWithNewline(remote)) fs.writeSync(fd, '\n');
        for (; !line.done; line = added.next()) fs.writeSync(fd, `${line.value}\n`);
      } finally {
        fs.closeSync(fd);
      }
      return { entry: fileBlob(ctx, union, modeOf(versions)) };
    } finally {
      added.return(undefined);
    }
  });
}

/** @type {Record<import('./state-merge-rules.cjs').MergeRule, (ctx: MergeContext, file: string, versions: Versions, pickOf: PickOf) => PathMerge>} */
const MERGERS = {
  ledger: (ctx, file, versions) => unionLines(ctx, versions, entryId),
  migrations: (ctx, file, versions) => unionLines(ctx, versions, migrationId),
  manifest: mergeManifestFile,
  whole: (ctx, file, versions) => keepWhole(file, versions),
  file: (ctx, file, versions) => mergeOtherFile(ctx, file, versions),
};

/**
 * A path at most one side changed, merged: that side's version; null where
 * both changed it.
 * @param {Versions} versions @returns {PathMerge|null}
 */
function oneSided({ base, local, remote }) {
  if (sameEntry(local, remote) || sameEntry(local, base)) return { entry: remote };
  if (sameEntry(remote, base)) return { entry: local };
  return null;
}

/**
 * One path merged: a side only one machine changed is taken whole, and a
 * path both changed goes to its rule.
 * @param {MergeContext} ctx @param {string} file @param {Versions} versions @param {PickOf} pickOf
 * @returns {PathMerge}
 */
function mergePath(ctx, file, versions, pickOf) {
  return oneSided(versions) ?? MERGERS[ruleOf(file)](ctx, file, versions, pickOf);
}

/**
 * Read together the versions of each path both sides changed whose rule
 * reads them whole, each to its rule's limit, so each path's merge finds its
 * bytes in hand.
 * @param {MergeContext} ctx @param {[string, Versions][]} paths
 */
function readContested(ctx, paths) {
  readBlobs(ctx, paths.flatMap(([file, { base, local, remote }]) => {
    const limit = readLimit(ctx, ruleOf(file));
    if (limit === null || oneSided({ base, local, remote }) !== null) return [];
    return [base, local, remote].flatMap((entry) => (entry !== undefined && TEXT_MODES.includes(entry.mode)
      ? [/** @type {[string, number]} */ ([entry.oid, limit])]
      : []));
  }));
}

// --- a file against a folder ------------------------------------------------

/** Every folder above a path. @param {string} file @returns {string[]} */
function foldersAbove(file) {
  const parts = file.split('/');
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join('/'));
}

/** @param {string} folder @param {string} file */
function isUnder(folder, file) {
  return file.startsWith(`${folder}/`);
}

/**
 * Set this machine's side of each file-against-folder clash beside the
 * remote's: where the remote's file holds the path, this machine's folder
 * moves beside it, named by its tree's id; where this machine's file does,
 * the file moves, named by its blob's id.
 * @param {MergeContext} ctx
 * @param {Entries} entries  the merged layout
 * @param {Entries} remote  the side that keeps the path
 * @returns {{entries: Entries, moves: {from: string, to: string}[], notes: string[]}}
 */
function separateClashes(ctx, entries, remote) {
  const folders = new Set([...entries.keys()].flatMap(foldersAbove));
  const separated = new Map(entries);
  /** @type {{from: string, to: string}[]} */
  const moves = [];
  /** @type {string[]} */
  const notes = [];
  for (const file of [...entries.keys()].filter((f) => folders.has(f)).sort()) {
    const entry = /** @type {Entry} */ (separated.get(file));
    if (sameEntry(entry, remote.get(file))) {
      const under = [...separated].filter(([f]) => isUnder(file, f));
      const beside = besidePath(file, writeTree(ctx, new Map(under.map(([f, e]) => [f.slice(file.length + 1), e]))));
      for (const [f, e] of under) {
        separated.delete(f);
        separated.set(`${beside}${f.slice(file.length)}`, e);
      }
      moves.push({ from: file, to: beside });
      notes.push(`${file} is a file on the remote and a folder on this machine: the remote's file stays at ${file}, and this machine's folder is kept beside it as ${beside}`);
    } else {
      const beside = besidePath(file, entry.oid);
      separated.delete(file);
      separated.set(beside, entry);
      moves.push({ from: file, to: beside });
      notes.push(`${file} is a folder on the remote and a file on this machine: the remote's folder stays at ${file}, and this machine's file is kept beside it as ${beside}`);
    }
  }
  return { entries: separated, moves, notes };
}

/**
 * Three trees merged path by path, then each file-against-folder clash
 * separated, the remote's side kept at the path.
 * @param {MergeContext} ctx @param {Entries} base @param {Entries} local @param {Entries} remote @param {PickOf} pickOf
 * @returns {{entries: Entries, conflicts: PathConflict[], notes: string[]}}
 */
function mergeTrees(ctx, base, local, remote, pickOf) {
  /** @type {Entries} */
  const merged = new Map();
  /** @type {PathConflict[]} */
  const conflicts = [];
  /** @type {string[]} */
  const notes = [];
  /** @type {[string, Versions][]} */
  const paths = [...new Set([...base.keys(), ...local.keys(), ...remote.keys()])]
    .map((file) => [file, { base: base.get(file), local: local.get(file), remote: remote.get(file) }]);
  readContested(ctx, paths);
  for (const [file, versions] of paths) {
    const result = mergePath(ctx, file, versions, pickOf);
    if (result.entry !== undefined) merged.set(file, result.entry);
    if (result.beside !== undefined) merged.set(result.beside.path, result.beside.entry);
    conflicts.push(...(result.conflicts ?? []));
    if (result.note !== undefined) notes.push(result.note);
  }
  const separated = separateClashes(ctx, merged, remote);
  return { entries: separated.entries, conflicts, notes: [...notes, ...separated.notes] };
}

module.exports = {
  sameEntry,
  changedPaths,
  entriesOf,
  indexEntries,
  withPrivateIndex,
  fillIndex,
  writeTree,
  mergePath,
  readContested,
  mergeTrees,
  separateClashes,
  besidePath,
  changedCopyKept,
  isUnder,
};
