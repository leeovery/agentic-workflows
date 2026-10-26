'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state's catch-up, and the merge between two clones (4.7).
// The person works on one machine at a time, so the state branch diverges
// only where a push failed. Boot runs the catch-up before anything writes
// state (4.7.8); it loses nothing, and never rewrites what was pushed.
//
// - Catching up: fetch `leeway-state` from the state's remote. Where only the
//   remote moved, the local branch and the worktree fast-forward to it with
//   no commit; where only this clone moved, it pushes what a failed push left
//   behind; where both moved, it merges. No remote, or a remote holding no
//   state branch, leaves nothing to do. A fetch that fails is a warning, and
//   the session works on the state it has.
// - The merge: one new commit whose parent is the remote's tip, its tree
//   merged path by path from the common ancestor, this clone's tip and the
//   remote's. The ledger, the migrations record and the manifests merge by
//   state-merge-rules.cjs. This clone's unpushed commits are replaced by the
//   merge: they were never pushed. It is pushed with a lease on the tip it
//   was merged onto; a remote that moved meanwhile is fetched and merged
//   again, a bounded number of times. No git merge, and no merge driver.
// - Any other file changed on both sides goes through git's three-way text
//   merge. Where both sides changed the same lines, both versions' lines are
//   kept, the remote's first, and a warning names the file to read through.
//   A file that is not text keeps the remote's copy at its path and this
//   clone's beside it, named by its blob id. A file deleted on one side and
//   changed on the other keeps the changed copy. Nothing is dropped, and
//   nothing is merged without a warning saying so.
// - The worktree's uncommitted state is never discarded, and never swept into
//   a commit it is not part of, since it may be a live session's work in
//   progress. An uncommitted path the catch-up does not write stays exactly
//   as it is. A path it would write is one the remote changed, or a path
//   above or below such a path. Its uncommitted content joins this clone's
//   side of the merge as the working tree holds it, so the rules above merge
//   it instead of the update overwriting it.
// - The stop: a manifest field both sides changed to different values stops
//   the merge (4.7.6), with nothing written: no commit, and the branch and
//   the worktree untouched. The stop is kept in the state worktree's git
//   directory, beside its private index. There it survives the session and
//   is never on the branch. It holds the sides it was worked out from: this
//   clone's tip, the remote's as fetched, and the uncommitted content the
//   merge took. A stop whose sides have moved is dropped, and the merge is
//   worked out again. Picks are recorded one at a time, and the last one
//   finishes the merge with the picked values (4.7.11).
//
// The working tree is written before the branch moves. A catch-up killed
// between the two leaves the merged files as uncommitted changes, which the
// next catch-up merges again, so no stale file waits for a later commit.
//
// Every git call goes through kernel/isolated-git, under the state's writer
// lock.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { GitError } = require('../kernel/git.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { STATE_BRANCH, stateRoot, inspectState, withStateLock, pushState } = require('./state-worktree.cjs');
const { ruleOf, unionLedger, unionMigrations, mergeManifest, conflictLabel } = require('./state-merge-rules.cjs');
const { stateMergeGate } = require('./projections/state-merge.cjs');
const { titlecase } = require('./conventions.cjs');

const BRANCH_REF = `refs/heads/${STATE_BRANCH}`;
// Beside the state commit's own private index, in the worktree's git dir.
const MERGE_INDEX = 'leeway-merge.index';
const KEPT_STOP = 'leeway-merge.json';
const SCRATCH = 'leeway-merge-files';

const MERGE_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15000;
const PUSH_TIMEOUT_MS = 15000;
const NETWORK_ENV = { GIT_TERMINAL_PROMPT: '0' };
const MERGE_MESSAGE = `state: merge onto the remote's ${STATE_BRANCH}`;

/** @type {Record<string, 'local'|'remote'>} */
const PICK_KEYS = { 1: 'local', 2: 'remote' };

const SIDES_MOVED = 'the state merge\'s sides moved since it stopped, so the merge was worked out again';

/** @typedef {import('../kernel/isolated-git.cjs').IsolatedGit} IsolatedGit */
/** @typedef {import('./projections/state-merge.cjs').Conflict} Conflict */
/** @typedef {{mode: string, oid: string}} Entry */
/** @typedef {Map<string, Entry>} Entries */
/** @typedef {{base: Entry|undefined, local: Entry|undefined, remote: Entry|undefined}} Versions */

/**
 * The state worktree opened for a catch-up: runners bound to it and to the
 * main checkout, the state's remote, the project's name, and the files the
 * merge keeps in the worktree's git dir.
 * @typedef {{
 *   root: string,
 *   remote: string|null,
 *   remotes: string[],
 *   project: string,
 *   git: IsolatedGit,
 *   main: IsolatedGit,
 *   index: string,
 *   stopFile: string,
 *   scratch: string,
 * }} State
 */

/** @typedef {{local: string, remote: string, base: string|null}} Sides */

/** @typedef {{fetchMs: number, pushMs: number}} Timeouts */

/**
 * What a catch-up did. `reason` says why there was nothing to do; `commit`
 * is the local branch's tip after; `uncommitted` names the worktree's
 * uncommitted paths the catch-up left as they were and those it merged.
 * @typedef {{
 *   action: 'nothing'|'unreachable'|'pushed'|'fast-forwarded'|'merged'|'stopped',
 *   reason: 'no-remote'|'no-remote-branch'|'current'|null,
 *   remote: string|null,
 *   commit: string,
 *   pushed: boolean,
 *   uncommitted: {kept: string[], merged: string[]},
 *   conflicts: Conflict[],
 *   warnings: string[],
 * }} CatchUpOutcome
 */

/**
 * A stop kept between its screen and the person's picks.
 * @typedef {{local: string, remote: string, taken: string, conflicts: Conflict[]}} KeptStop
 */

/**
 * A step whose push did not land: where the remote stood, the outcome if the
 * remote has not moved since, and what the step merged.
 * @typedef {{onto: string, outcome: CatchUpOutcome, notes: string[], merged: string[]}} Retry
 */

/**
 * The merge worked out: the merged tree's entries, every conflicted field
 * with its pick, the notes on files merged, and the uncommitted paths it
 * took and left.
 * @typedef {{
 *   local: Entries,
 *   entries: Entries,
 *   conflicts: Conflict[],
 *   notes: string[],
 *   taken: string[],
 *   kept: string[],
 *   fingerprint: string,
 *   superseded: boolean,
 * }} Plan
 */

/** @param {string} remote @returns {string} */
function trackingRef(remote) {
  return `refs/remotes/${remote}/${STATE_BRANCH}`;
}

/** @param {string[]} files @returns {string} */
function nulJoined(files) {
  return files.map((file) => `${file}\0`).join('');
}

/** @param {IsolatedGit} git @param {string} ref @returns {string} */
function tipOf(git, ref) {
  return git.run(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
}

/**
 * Open the state worktree for a catch-up. Refuses where git cannot open it
 * as this repository's, or where it has anything but `leeway-state`
 * checked out: boot's checks put it right first.
 * @param {string} root
 * @returns {State}
 */
function openState(root) {
  const seen = inspectState(root);
  if (seen.folder !== 'linked' || seen.worktree === null || seen.worktree.branch !== STATE_BRANCH) {
    throw new Error(`the state worktree at ${root} is not checked out on ${STATE_BRANCH} — it cannot catch up until boot's checks put it right`);
  }
  const git = isolatedGit(root);
  const [index, stopFile, scratch] = git.run(['rev-parse', '--git-path', MERGE_INDEX, '--git-path', KEPT_STOP, '--git-path', SCRATCH])
    .trim().split('\n').map((file) => path.resolve(root, file));
  return {
    root,
    remote: seen.remote,
    remotes: seen.remotes,
    project: titlecase(path.basename(seen.main)),
    git,
    main: isolatedGit(seen.main),
    index,
    stopFile,
    scratch,
  };
}

/**
 * A catch-up's outcome, the local tip read as it now stands.
 * @param {State} state @param {CatchUpOutcome['action']} action @param {Partial<CatchUpOutcome>} [details]
 * @returns {CatchUpOutcome}
 */
function outcome(state, action, details = {}) {
  return {
    action,
    reason: null,
    remote: state.remote,
    commit: tipOf(state.git, BRANCH_REF),
    pushed: false,
    uncommitted: { kept: [], merged: [] },
    conflicts: [],
    warnings: [],
    ...details,
  };
}

// --- the stop kept between its screen and the picks ------------------------

/** @param {State} state @returns {KeptStop|null} */
function readKeptStop(state) {
  try {
    return JSON.parse(fs.readFileSync(state.stopFile, 'utf8'));
  } catch {
    return null;
  }
}

/** @param {State} state @param {KeptStop} stop */
function keepStop(state, stop) {
  writeJsonAtomic(state.stopFile, stop);
}

/** @param {State} state */
function dropKeptStop(state) {
  fs.rmSync(state.stopFile, { force: true });
}

/** @param {string[]} a @param {string[]} b */
function sameField(a, b) {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}

/**
 * The picks a kept stop holds, for a merge of the sides it was worked out
 * from; none for any other.
 * @param {KeptStop|null} stop
 * @returns {(manifest: string, field: string[]) => 'local'|'remote'|null}
 */
function picksOf(stop) {
  return (manifest, field) => stop?.conflicts.find((c) => c.manifest === manifest && sameField(c.field, field))?.pick ?? null;
}

// --- git's view of the trees ----------------------------------------------

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

/**
 * Run `fn` with the merge's private index, cleared before and after.
 * @template T @param {State} state @param {(env: Record<string, string>) => T} fn @returns {T}
 */
function withPrivateIndex(state, fn) {
  const clear = () => {
    for (const file of [state.index, `${state.index}.lock`]) fs.rmSync(file, { force: true });
  };
  clear();
  try {
    return fn({ GIT_INDEX_FILE: state.index });
  } finally {
    clear();
  }
}

/**
 * The working tree's files as they stand, read through the private index
 * from this clone's tip — never through the worktree's own index, whatever
 * it holds staged.
 * @param {State} state @param {string} local @returns {Entries}
 */
function workingEntries(state, local) {
  return withPrivateIndex(state, (env) => {
    state.git.run(['read-tree', local], { env });
    state.git.run(['add', '--all'], { env });
    return parseEntries(state.git.run(['ls-files', '-s', '-z'], { env }), ([mode, oid, , file]) => [file, { mode, oid }]);
  });
}

/** @param {State} state @param {Entries} entries @returns {string} the tree's id */
function writeTree(state, entries) {
  return withPrivateIndex(state, (env) => {
    const info = [...entries].map(([file, { mode, oid }]) => `${mode} ${oid}\t${file}\0`).join('');
    if (info !== '') state.git.run(['update-index', '-z', '--index-info'], { env, input: info });
    return state.git.run(['write-tree'], { env }).trim();
  });
}

/** @param {State} state @param {string} text @param {Versions} versions @returns {Entry} */
function blob(state, text, versions) {
  const { mode } = /** @type {Entry} */ (versions.remote ?? versions.local);
  return { mode, oid: state.git.run(['hash-object', '-w', '--stdin'], { input: text }).trim() };
}

/** @param {State} state @param {Entry|undefined} entry @returns {string} */
function contentOf(state, entry) {
  return entry === undefined ? '' : state.git.run(['cat-file', 'blob', entry.oid]);
}

const TEXT_MODES = ['100644', '100755'];

/**
 * A file's text, or null where it is not text the merge can take whole: a
 * link or a submodule, a NUL in it, or bytes that do not come back the same
 * when read as UTF-8.
 * @param {State} state @param {Entry|undefined} entry @returns {string|null}
 */
function textOf(state, entry) {
  if (entry === undefined) return '';
  if (!TEXT_MODES.includes(entry.mode)) return null;
  const text = contentOf(state, entry);
  if (text.includes('\0')) return null;
  return state.git.run(['hash-object', '--stdin'], { input: text }).trim() === entry.oid ? text : null;
}

// --- merging one path -------------------------------------------------------

/**
 * @typedef {{
 *   entry: Entry|undefined,
 *   beside?: {path: string, entry: Entry},
 *   conflicts?: Conflict[],
 *   note?: string,
 * }} PathMerge
 */

/** @typedef {(manifest: string, field: string[]) => 'local'|'remote'|null} PickOf */

/** @param {string} file @param {Versions} versions @returns {PathMerge} */
function keepChanged(file, { local, remote }) {
  return { entry: local ?? remote, note: `${file} was deleted on one machine and changed on the other: the changed copy is kept` };
}

/** Where this clone's copy of a file the merge cannot join is kept. @param {string} file @param {string} oid */
function besidePath(file, oid) {
  const ext = path.posix.extname(file);
  return `${ext === '' ? file : file.slice(0, -ext.length)}.${oid.slice(0, 8)}${ext}`;
}

/** @param {string} file @param {Versions} versions @returns {PathMerge} */
function keepBoth(file, { local, remote }) {
  const beside = besidePath(file, /** @type {Entry} */ (local).oid);
  return {
    entry: remote,
    beside: { path: beside, entry: /** @type {Entry} */ (local) },
    note: `${file} was changed on both machines and is not text to merge: the remote's copy stays at ${file}, and this machine's is kept beside it as ${beside}`,
  };
}

/**
 * A text file both sides changed, through git's three-way merge with the
 * remote's copy as the one merged into; where both changed the same lines,
 * the union of both, the remote's lines first.
 * @param {State} state @param {string} file @param {Versions} versions @param {string[]} texts  base, local, remote
 * @returns {PathMerge}
 */
function mergeText(state, file, versions, [base, local, remote]) {
  fs.rmSync(state.scratch, { recursive: true, force: true });
  fs.mkdirSync(state.scratch, { recursive: true });
  try {
    const [remoteFile, baseFile, localFile] = [['remote', remote], ['base', base], ['local', local]].map(([name, text]) => {
      const at = path.join(state.scratch, name);
      fs.writeFileSync(at, text);
      return at;
    });
    const merge = (/** @type {string[]} */ how) => ['merge-file', '-p', ...how, remoteFile, baseFile, localFile];
    const clean = state.git.tryRun(merge([]));
    if (clean !== null) return { entry: blob(state, clean, versions) };
    return {
      entry: blob(state, state.git.run(merge(['--union'])), versions),
      note: `${file} was changed in the same place on both machines: both machines' lines are kept there, the remote's first — read it through`,
    };
  } finally {
    fs.rmSync(state.scratch, { recursive: true, force: true });
  }
}

/** @param {State} state @param {string} file @param {Versions} versions @returns {PathMerge} */
function mergeOtherFile(state, file, versions) {
  if (versions.local === undefined || versions.remote === undefined) return keepChanged(file, versions);
  const texts = [versions.base, versions.local, versions.remote].map((entry) => textOf(state, entry));
  if (texts.some((text) => text === null)) return keepBoth(file, versions);
  return mergeText(state, file, versions, /** @type {string[]} */ (texts));
}

/**
 * One side's manifest, parsed. Refuses one that is not a JSON object: a
 * manifest the engine cannot read is not one the merge can take apart.
 * @param {State} state @param {string} file @param {Entry} entry @param {string} whose
 * @returns {Record<string, unknown>}
 */
function manifestOf(state, file, entry, whose) {
  let value;
  try {
    value = JSON.parse(contentOf(state, entry));
  } catch {
    value = null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`cannot merge ${file}: ${whose} copy is not a JSON object`);
  }
  return value;
}

/** @param {State} state @param {string} file @param {Versions} versions @param {PickOf} pickOf @returns {PathMerge} */
function mergeManifestFile(state, file, versions, pickOf) {
  if (versions.local === undefined || versions.remote === undefined) return keepChanged(file, versions);
  const base = versions.base === undefined ? undefined : manifestOf(state, file, versions.base, "the common ancestor's");
  const merged = mergeManifest(
    base,
    manifestOf(state, file, versions.local, "this machine's"),
    manifestOf(state, file, versions.remote, "the remote's"),
    (field) => pickOf(file, field),
  );
  return {
    entry: blob(state, `${JSON.stringify(merged.value, null, 2)}\n`, versions),
    conflicts: merged.conflicts.map((c) => ({ manifest: file, ...c, label: conflictLabel(file, c.field, state.project) })),
  };
}

/** @type {Record<import('./state-merge-rules.cjs').MergeRule, (state: State, file: string, versions: Versions, pickOf: PickOf) => PathMerge>} */
const MERGERS = {
  ledger: (state, file, versions) => ({ entry: blob(state, unionLedger(contentOf(state, versions.remote), contentOf(state, versions.local)), versions) }),
  migrations: (state, file, versions) => ({ entry: blob(state, unionMigrations(contentOf(state, versions.remote), contentOf(state, versions.local)), versions) }),
  manifest: mergeManifestFile,
  file: (state, file, versions) => mergeOtherFile(state, file, versions),
};

/**
 * One path merged: a side that only one machine changed is taken whole, and
 * a path both changed goes to its rule.
 * @param {State} state @param {string} file @param {Versions} versions @param {PickOf} pickOf
 * @returns {PathMerge}
 */
function mergePath(state, file, versions, pickOf) {
  const { base, local, remote } = versions;
  if (sameEntry(local, remote) || sameEntry(local, base)) return { entry: remote };
  if (sameEntry(remote, base)) return { entry: local };
  return MERGERS[ruleOf(file)](state, file, versions, pickOf);
}

/**
 * The three trees merged path by path.
 * @param {State} state @param {Entries} base @param {Entries} ours @param {Entries} theirs @param {PickOf} pickOf
 * @returns {{entries: Entries, conflicts: Conflict[], notes: string[]}}
 */
function mergeEntries(state, base, ours, theirs, pickOf) {
  /** @type {Entries} */
  const entries = new Map();
  /** @type {Conflict[]} */
  const conflicts = [];
  /** @type {string[]} */
  const notes = [];
  for (const file of new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])) {
    const merged = mergePath(state, file, { base: base.get(file), local: ours.get(file), remote: theirs.get(file) }, pickOf);
    if (merged.entry !== undefined) entries.set(file, merged.entry);
    if (merged.beside !== undefined) entries.set(merged.beside.path, merged.beside.entry);
    conflicts.push(...(merged.conflicts ?? []));
    if (merged.note !== undefined) notes.push(merged.note);
  }
  return { entries, conflicts, notes };
}

// --- the merge, worked out and landed ---------------------------------------

/** Every folder above a path. @param {string} file @returns {string[]} */
function foldersAbove(file) {
  const parts = file.split('/');
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join('/'));
}

/**
 * The worktree's uncommitted paths, split between those the merge takes into
 * this clone's side — the remote changed the path, or one above or below it
 * — and those it leaves as they are; this clone's side with the taken ones
 * in; and a fingerprint of what was taken, which a kept stop is checked by.
 * @param {State} state @param {Sides} sides @param {Entries} base @param {Entries} local @param {Entries} remote
 */
function uncommittedSide(state, sides, base, local, remote) {
  const working = workingEntries(state, sides.local);
  const remoteChanged = new Set(changedPaths(base, remote));
  const near = new Set([...remoteChanged, ...[...remoteChanged].flatMap(foldersAbove)]);
  const dirty = changedPaths(local, working);
  const taken = dirty.filter((file) => near.has(file) || foldersAbove(file).some((folder) => remoteChanged.has(folder)));
  const takenSet = new Set(taken);
  const ours = new Map(local);
  for (const file of taken) {
    const entry = working.get(file);
    if (entry === undefined) ours.delete(file);
    else ours.set(file, entry);
  }
  return {
    ours,
    taken,
    kept: dirty.filter((file) => !takenSet.has(file)),
    fingerprint: JSON.stringify(taken.map((file) => [file, working.get(file) ?? null])),
  };
}

/** @param {State} state @param {string} remote @returns {Sides} */
function sidesOf(state, remote) {
  const local = tipOf(state.git, BRANCH_REF);
  if (local === remote) return { local, remote, base: local };
  const base = state.git.tryRun(['merge-base', local, remote]);
  return { local, remote, base: base === null ? null : base.trim() };
}

/**
 * The merge of the two sides worked out, nothing written but blobs. A kept
 * stop worked out from these very sides lends its picks; one from any other
 * sides is superseded.
 * @param {State} state @param {Sides} sides
 * @returns {Plan}
 */
function planMerge(state, sides) {
  const base = sides.base === null ? new Map() : entriesOf(state.git, sides.base);
  const local = entriesOf(state.git, sides.local);
  const remote = entriesOf(state.git, sides.remote);
  const side = uncommittedSide(state, sides, base, local, remote);
  const stop = readKeptStop(state);
  const holds = stop !== null && stop.local === sides.local && stop.remote === sides.remote && stop.taken === side.fingerprint;
  const merged = mergeEntries(state, base, side.ours, remote, picksOf(holds ? stop : null));
  return { local, ...merged, taken: side.taken, kept: side.kept, fingerprint: side.fingerprint, superseded: stop !== null && !holds };
}

/** @param {string} root @param {string} file */
function removeFile(root, file) {
  const at = path.join(root, file);
  let stat;
  try {
    stat = fs.lstatSync(at);
  } catch {
    return;
  }
  // A folder where the tree had a file holds uncommitted files of its own.
  if (stat.isDirectory()) return;
  fs.unlinkSync(at);
  for (let folder = path.dirname(at); folder !== root; folder = path.dirname(folder)) {
    try {
      fs.rmdirSync(folder);
    } catch {
      return;
    }
  }
}

/**
 * Bring the worktree's own index into line with the branch under the paths
 * the catch-up wrote, so `git status` reads them as committed. Nothing reads
 * that index, so a failure here is a warning.
 * @param {State} state @param {string[]} files @returns {string[]} warnings
 */
function alignIndex(state, files) {
  if (files.length === 0) return [];
  try {
    state.git.run(['reset', '--quiet', '--pathspec-from-file=-', '--pathspec-file-nul'], {
      input: nulJoined(files), env: { GIT_LITERAL_PATHSPECS: '1' },
    });
    return [];
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return [`the state worktree's index was not brought into line with ${STATE_BRANCH}: ${err.message}`];
  }
}

/**
 * Move the worktree and the branch from this clone's tip to `target`: the
 * files the move changes are written first, then the branch moves, only
 * from the tip the merge was worked out from.
 * @param {State} state @param {Sides} sides @param {string} target @param {Plan} plan
 * @returns {string[]} warnings
 */
function moveWorktree(state, sides, target, plan) {
  const touched = [...new Set([...changedPaths(plan.local, plan.entries), ...plan.taken])];
  for (const file of touched.filter((f) => !plan.entries.has(f))) removeFile(state.root, file);
  const written = touched.filter((file) => plan.entries.has(file));
  if (written.length > 0) {
    withPrivateIndex(state, (env) => {
      state.git.run(['read-tree', target], { env });
      state.git.run(['checkout-index', '-f', '-z', '--stdin'], { env, input: nulJoined(written) });
    });
  }
  state.git.run(['update-ref', '-m', `catch up: ${target}`, BRANCH_REF, target, sides.local]);
  return alignIndex(state, touched);
}

/**
 * Land the plan: the remote's tip itself where the merged tree is the
 * remote's, else a new commit whose one parent is the remote's tip.
 * @param {State} state @param {Sides} sides @param {Plan} plan
 * @returns {{target: string, warnings: string[]}}
 */
function land(state, sides, plan) {
  const tree = writeTree(state, plan.entries);
  const remoteTree = state.git.run(['rev-parse', `${sides.remote}^{tree}`]).trim();
  const target = tree === remoteTree ? sides.remote : state.git.run(['commit-tree', tree, '-p', sides.remote, '-m', MERGE_MESSAGE]).trim();
  return { target, warnings: moveWorktree(state, sides, target, plan) };
}

/**
 * Push the merge, leased on the remote tip it was merged onto: a remote that
 * moved since refuses it.
 * @param {State} state @param {string} onto @param {number} timeoutMs
 * @returns {{pushed: boolean, warnings: string[]}}
 */
function pushWithLease(state, onto, timeoutMs) {
  const remote = /** @type {string} */ (state.remote);
  try {
    state.main.run(['push', '--quiet', `--force-with-lease=${BRANCH_REF}:${onto}`, remote, `${BRANCH_REF}:${BRANCH_REF}`], { timeoutMs, env: NETWORK_ENV });
    return { pushed: true, warnings: [] };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { pushed: false, warnings: [`${STATE_BRANCH} is merged here but was not pushed to ${remote}: ${err.message}`] };
  }
}

// --- one catch-up step, and the bounded loop -------------------------------

/**
 * Fetch the remote's state branch, answering its tip, or the outcome where
 * there is nothing to fetch or the fetch failed.
 * @param {State} state @param {number} timeoutMs
 * @returns {{tip: string}|{outcome: CatchUpOutcome}}
 */
function fetchState(state, timeoutMs) {
  const { remote, remotes } = state;
  if (remote === null) {
    const warnings = remotes.length === 0 ? [] : [
      `${STATE_BRANCH} was not fetched: the project has several remotes (${remotes.join(', ')}), and none is named origin or tracked by the main checkout's branch`,
    ];
    return { outcome: outcome(state, 'nothing', { reason: 'no-remote', warnings }) };
  }
  try {
    state.main.run(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, `+${BRANCH_REF}:${trackingRef(remote)}`], { timeoutMs, env: NETWORK_ENV });
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { outcome: unfetched(state, remote, err, timeoutMs) };
  }
  return { tip: tipOf(state.main, trackingRef(remote)) };
}

/**
 * Why a fetch failed: a remote that holds no state branch leaves nothing to
 * catch up with, and its stale remote-tracking branch goes; any other
 * failure is a warning.
 * @param {State} state @param {string} remote @param {Error} err @param {number} timeoutMs
 * @returns {CatchUpOutcome}
 */
function unfetched(state, remote, err, timeoutMs) {
  if (state.main.tryRun(['ls-remote', remote, BRANCH_REF], { timeoutMs, env: NETWORK_ENV }) === '') {
    state.main.tryRun(['update-ref', '-d', trackingRef(remote)]);
    return outcome(state, 'nothing', { reason: 'no-remote-branch' });
  }
  return outcome(state, 'unreachable', {
    warnings: [`${STATE_BRANCH} could not be fetched from ${remote}, so this session works on the state it has: ${err.message}`],
  });
}

/**
 * Only this clone moved: push what a failed push left behind.
 * @param {State} state @param {Sides} sides @param {Timeouts} timeouts
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function pushAhead(state, sides, timeouts) {
  const { pushed, warnings } = pushState(state.root, { timeoutMs: timeouts.pushMs });
  const done = outcome(state, 'pushed', { pushed, warnings });
  return pushed ? { outcome: done } : { retry: { onto: sides.remote, outcome: done, notes: [], merged: [] } };
}

/**
 * The remote moved: merge, stop on a conflict not yet picked, or land and
 * push.
 * @param {State} state @param {Sides} sides @param {Timeouts} timeouts
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function mergeSides(state, sides, timeouts) {
  const plan = planMerge(state, sides);
  const notes = plan.superseded ? [SIDES_MOVED, ...plan.notes] : plan.notes;
  if (plan.conflicts.some((c) => c.pick === null)) {
    keepStop(state, { local: sides.local, remote: sides.remote, taken: plan.fingerprint, conflicts: plan.conflicts });
    return { outcome: outcome(state, 'stopped', { conflicts: plan.conflicts, warnings: plan.superseded ? [SIDES_MOVED] : [] }) };
  }
  const landed = land(state, sides, plan);
  dropKeptStop(state);
  const uncommitted = { kept: plan.kept, merged: plan.taken };
  if (landed.target === sides.remote) {
    return { outcome: outcome(state, 'fast-forwarded', { uncommitted, warnings: [...notes, ...landed.warnings] }) };
  }
  const { pushed, warnings } = pushWithLease(state, sides.remote, timeouts.pushMs);
  const done = outcome(state, 'merged', { pushed, uncommitted, warnings: [...notes, ...landed.warnings, ...warnings] });
  if (pushed) return { outcome: done };
  return { retry: { onto: sides.remote, outcome: { ...done, warnings }, notes: [...notes, ...landed.warnings], merged: plan.taken } };
}

/**
 * One step: fetch, then act on where the two sides stand. After a push that
 * failed, a remote that has not moved since ends the loop with that failure.
 * @param {State} state @param {Timeouts} timeouts @param {Retry|null} retry
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function step(state, timeouts, retry) {
  const fetched = fetchState(state, timeouts.fetchMs);
  if ('outcome' in fetched) {
    return { outcome: retry === null ? fetched.outcome : { ...retry.outcome, warnings: [...retry.outcome.warnings, ...fetched.outcome.warnings] } };
  }
  if (retry !== null && fetched.tip === retry.onto) return { outcome: retry.outcome };
  const sides = sidesOf(state, fetched.tip);
  if (sides.local === sides.remote) return { outcome: outcome(state, 'nothing', { reason: 'current' }) };
  if (sides.base === sides.remote) return pushAhead(state, sides, timeouts);
  return mergeSides(state, sides, timeouts);
}

/**
 * Catch up, retrying while the remote moves under the push. What earlier
 * steps merged rides on the outcome the last one answers. A stop kept from
 * sides that no longer stand goes once the catch-up settles.
 * @param {State} state @param {Timeouts} timeouts
 * @returns {CatchUpOutcome}
 */
function converge(state, timeouts) {
  const carried = { notes: /** @type {string[]} */ ([]), merged: /** @type {string[]} */ ([]) };
  /** @type {Retry|null} */
  let retry = null;
  /** @type {CatchUpOutcome|null} */
  let settled = null;
  for (let attempt = 1; attempt <= MERGE_ATTEMPTS && settled === null; attempt++) {
    const next = step(state, timeouts, retry);
    if ('outcome' in next) {
      settled = next.outcome;
    } else {
      retry = next.retry;
      carried.notes.push(...retry.notes);
      carried.merged.push(...retry.merged);
    }
  }
  const last = settled ?? {
    ...(/** @type {Retry} */ (retry)).outcome,
    warnings: [...(/** @type {Retry} */ (retry)).outcome.warnings, `the remote kept moving: ${STATE_BRANCH} is not pushed after ${MERGE_ATTEMPTS} attempts, and the next catch-up carries on`],
  };
  if (!['stopped', 'unreachable'].includes(last.action)) dropKeptStop(state);
  return {
    ...last,
    uncommitted: { kept: last.uncommitted.kept, merged: [...new Set([...carried.merged, ...last.uncommitted.merged])] },
    warnings: [...new Set([...carried.notes, ...last.warnings])],
  };
}

/** @param {{fetchTimeoutMs?: number, pushTimeoutMs?: number}} opts @returns {Timeouts} */
function timeoutsOf({ fetchTimeoutMs = FETCH_TIMEOUT_MS, pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  return { fetchMs: fetchTimeoutMs, pushMs: pushTimeoutMs };
}

// --- the API ----------------------------------------------------------------

/**
 * Bring the state up to date with the remote's (4.7.8), under the writer
 * lock: fast-forward, push what a failed push left behind, or merge. Boot
 * runs it before anything writes state.
 * @param {string} root  the state root
 * @param {{fetchTimeoutMs?: number, pushTimeoutMs?: number}} [opts]
 * @returns {CatchUpOutcome}
 */
function catchUpState(root, opts = {}) {
  return withStateLock(root, () => converge(openState(root), timeoutsOf(opts)));
}

/**
 * Whether the kept stop still stands: this clone's tip, the remote's as
 * last fetched, and the uncommitted content the merge took, all as they
 * were when it stopped.
 * @param {State} state @param {KeptStop} stop
 */
function stillStands(state, stop) {
  if (state.remote === null) return false;
  const remote = state.main.tryRun(['rev-parse', '--verify', '--quiet', `${trackingRef(state.remote)}^{commit}`]);
  if (remote === null || remote.trim() !== stop.remote) return false;
  const sides = sidesOf(state, stop.remote);
  if (sides.local !== stop.local) return false;
  const base = sides.base === null ? new Map() : entriesOf(state.git, sides.base);
  return uncommittedSide(state, sides, base, entriesOf(state.git, sides.local), entriesOf(state.git, sides.remote)).fingerprint === stop.taken;
}

/**
 * The state merge waiting on the person's picks, or null where none waits or
 * the one kept no longer stands.
 * @param {string} root  the state root
 * @returns {{conflicts: Conflict[]}|null}
 */
function pendingStateMerge(root) {
  return withStateLock(root, () => {
    const state = openState(root);
    const stop = readKeptStop(state);
    return stop !== null && stillStands(state, stop) ? { conflicts: stop.conflicts } : null;
  });
}

/**
 * Record the person's pick for the first conflict still open — `1` keeps
 * this machine's value, `2` the remote's — and, once every conflict is
 * picked, finish the merge with the picks (4.7.11). A stop whose sides have
 * moved takes no pick: it is dropped and the catch-up runs again.
 * @param {string} root  the state root
 * @param {string} key
 * @param {{fetchTimeoutMs?: number, pushTimeoutMs?: number}} [opts]
 * @returns {CatchUpOutcome}
 */
function pickStateMerge(root, key, opts = {}) {
  const side = Object.hasOwn(PICK_KEYS, key) ? PICK_KEYS[key] : undefined;
  if (side === undefined) throw new Error(`a state merge pick is 1 (this machine's value) or 2 (the remote's), got "${key}"`);
  return withStateLock(root, () => {
    const state = openState(root);
    const stop = readKeptStop(state);
    if (stop === null) throw new Error('no state merge is waiting on a pick');
    if (!stillStands(state, stop)) {
      dropKeptStop(state);
      const again = converge(state, timeoutsOf(opts));
      return { ...again, warnings: [SIDES_MOVED, ...again.warnings] };
    }
    const open = stop.conflicts.find((c) => c.pick === null);
    if (open !== undefined) open.pick = side;
    keepStop(state, stop);
    if (stop.conflicts.some((c) => c.pick === null)) return outcome(state, 'stopped', { conflicts: stop.conflicts });
    return converge(state, timeoutsOf(opts));
  });
}

/**
 * `render state-merge-gate`: the screen of the stop waiting on a pick.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function stateMergeGateSurface(cwd, _args) {
  const pending = pendingStateMerge(stateRoot(cwd));
  if (pending === null) throw new Error('render state-merge-gate: no state merge is waiting on a pick');
  return stateMergeGate(pending);
}

/**
 * `state-merge pick <1|2>`: the person's pick at the stop's screen.
 * @param {string} cwd @param {string[]} argv
 * @returns {CatchUpOutcome}
 */
function stateMergeCommand(cwd, argv) {
  const [command, ...rest] = argv;
  if (command !== 'pick' || rest.length !== 1) throw new Error('Usage: engine state-merge pick <1|2>');
  return pickStateMerge(stateRoot(cwd), rest[0]);
}

module.exports = {
  catchUpState,
  pendingStateMerge,
  pickStateMerge,
  stateMergeGateSurface,
  stateMergeCommand,
};
