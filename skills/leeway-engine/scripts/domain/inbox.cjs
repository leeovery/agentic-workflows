'use strict';

// ---------------------------------------------------------------------------
// Domain ring: inbox transactions — archive, restore, delete as single
// transactions over one or more inbox items. Every path is validated against
// the exact inbox layout before anything moves; one scoped commit covers the
// whole set, with the message form the inbox history already uses
// (`archive {slug}` for one item, `archive {N} items` for several).
//
// In the state, state-relative:
//   live:     .inbox/{ideas|bugs|quickfixes}/{file}.md
//   archived: .inbox/.archived/{ideas|bugs|quickfixes}/{file}.md
//
// A path given is read from the caller's folder, absolute as the engine
// hands paths out; a path answered is absolute.
//
// `inbox file <unit> --file <item.json>` files an out-of-scope finding of
// the unit's review phase to the inbox (6.1.15, 14.3.5) — or a note for
// later a quick-fix's close answers, where no review was asked for (R24,
// `quick-fix notes`): Claude's item,
// `{kind, text, call}` — its kind, `idea`, `bug` or `quick-fix`; its text,
// markdown opening on its title, `# Title`; and the ledger's file-or-drop
// call that filed it, a current decision of Claude's own at `{unit}.review`
// — the close's at `{unit}.implementation` — (14.3.7, review-phase.cjs), so
// every filing is one engine call away.
// It is written at `.inbox/{folder}/{YYYY-MM-DD}--{slug}.md`, today's date
// and its title's slug, and committed. It refuses, writing nothing, a unit
// whose review phase cannot be entered (review-entry.cjs) but such a
// quick-fix, a payload of another shape, a text with no title, a call that
// is none of those, and an item already there.
//
// `inbox close <unit|none> <path> …` archives live items as `archive` does,
// and records who closed each on the project manifest (18.6.4, 18.6.6),
// `inbox_closed: {"{folder}/{file}": {unit, at}}` — the unit that resolved
// it, or null for one the person had fixed straight away (P4) — the files
// and the record one commit. `restore` and `delete` drop an item's record:
// a restored item is live again, and a deleted one is gone. Finish reads
// the record for the closures its screen lists (`closedBy`), and the
// build's log for the items its `Resolved: {path}` lines claim the work
// resolved, still live (`liveResolved`, 6.4.10).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { statePath, stateRelative, stateRoot } = require('../kernel/state-root.cjs');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { NO_ARGUMENT, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { filled, shaped, readPayload, refusing } = require('./staged-payload.cjs');
const { todayStamp, isoNow } = require('./dates.cjs');
const { slugOf } = require('./landing-names.cjs');
const { manifestOf } = require('./ledger-units.cjs');

const INBOX = '.inbox';
const ARCHIVED = `${INBOX}/.archived`;
const FOLDERS = ['ideas', 'bugs', 'quickfixes'];

/** Where a folder's declined items wait. @param {string} folder @returns {string} state-relative */
function archivedDir(folder) {
  return `${ARCHIVED}/${folder}`;
}

/** @typedef {'idea'|'bug'|'quick-fix'} ItemKind */

// Each folder's kind of item — the one home of the kind vocabulary, which
// the inbox lists and the roadmap's items share.
const FOLDER_KIND = /** @type {Record<string, ItemKind>} */ ({ ideas: 'idea', bugs: 'bug', quickfixes: 'quick-fix' });

/** The `source` tag a landed seed carries, per inbox folder. */
const SEED_SOURCES = /** @type {Record<string, string>} */ ({ ideas: 'inbox:idea', bugs: 'inbox:bug', quickfixes: 'inbox:quickfix' });

/** The `source` tag of a seed copied from a roadmap item's note, before the item's name. */
const ROADMAP_SEED = 'roadmap:';

/** The notes a unit was started from, as its manifest lists them. @param {Record<string, any>} manifest @returns {{path: string, source: string}[]} */
const seedsOf = (manifest) => (Array.isArray(manifest.seeds) ? manifest.seeds : []);

/** Whether a note a unit was started from is a roadmap item's. @param {{source: string}} seed */
const fromRoadmap = ({ source }) => String(source).startsWith(ROADMAP_SEED);

/** Where the note a unit began from came from: the inbox, the roadmap, or none. @param {Record<string, any>} manifest @returns {'inbox'|'roadmap'|null} */
function seedOrigin(manifest) {
  const [seed] = seedsOf(manifest);
  if (seed === undefined) return null;
  return fromRoadmap(seed) ? 'roadmap' : 'inbox';
}

/**
 * @typedef {object} InboxItem
 * @property {string} rel     the path in the state, state-relative
 * @property {string} folder  ideas | bugs | quickfixes
 * @property {string} file    file name
 * @property {string} slug    file name minus the date prefix and extension
 */

/**
 * Validate one inbox path against the expected layout. Loud on anything
 * outside it — outside the state, the wrong store, an unknown folder,
 * nesting.
 * @param {string} cwd
 * @param {string} given absolute, or from `cwd`
 * @param {{archived: boolean}} opts whether the path must be under `.archived/`
 * @returns {InboxItem}
 */
function parseInboxPath(cwd, given, { archived }) {
  const rel = stateRelative(cwd, given);
  const segs = rel === null ? [] : rel.split('/');
  const root = archived ? ARCHIVED : INBOX;
  const depth = root.split('/').length + 2;
  const ok =
    segs.length === depth &&
    segs.slice(0, depth - 2).join('/') === root &&
    FOLDERS.includes(segs[depth - 2]) &&
    segs[depth - 1].endsWith('.md');
  if (!ok) {
    const expected = statePath(cwd, `${root}/{${FOLDERS.join('|')}}/{file}.md`);
    throw new Error(`not ${archived ? 'an archived' : 'a live'} inbox path (expected ${expected}): "${given}"`);
  }
  const file = segs[depth - 1];
  return {
    rel: segs.join('/'),
    folder: segs[depth - 2],
    file,
    slug: file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}--/, ''),
  };
}

/**
 * Parse and existence-check every path before anything moves.
 * @param {string} cwd @param {string[]} paths @param {{archived: boolean}} opts
 * @returns {InboxItem[]}
 */
function parseInboxPaths(cwd, paths, opts) {
  const items = paths.map((p) => parseInboxPath(cwd, p, opts));
  // Refuse duplicates here, before anything moves: two paths naming the same
  // file both pass existence, then the second `renameSync` hits ENOENT after
  // the first move already applied — a half-done, uncommitted transaction.
  const seen = new Set();
  for (const item of items) {
    const at = statePath(cwd, item.rel);
    if (seen.has(item.rel)) {
      throw new Error(`duplicate inbox path: "${at}"`);
    }
    seen.add(item.rel);
    if (!fs.existsSync(at)) {
      throw new Error(`inbox file not found: "${at}"`);
    }
  }
  return items;
}

/** `archive {slug}` for one item, `archive {N} items` for several. @param {string} verb @param {InboxItem[]} items */
function commitMessage(verb, items) {
  const what = items.length === 1 ? items[0].slug : `${items.length} items`;
  return `workflow(inbox): ${verb} ${what}`;
}

/**
 * Refuse any move whose destination is already taken — run before the first
 * file moves, so a refusal leaves every file where it was.
 * @param {string} cwd @param {{from: string, to: string}[]} moves state-relative
 */
function refuseTakenDestinations(cwd, moves) {
  for (const { to } of moves) {
    if (fs.existsSync(statePath(cwd, to))) {
      throw new Error(`destination already exists: "${statePath(cwd, to)}"`);
    }
  }
}

/**
 * @typedef {object} StrandedMove
 * @property {string} from  where the file belongs
 * @property {string} to    where it was left
 * @property {unknown} error  why it could not be put back
 */

/**
 * Move each file to its destination, creating the destination's directory.
 * All or nothing: a move that throws puts every file already moved back
 * (`undoMoves`), then rethrows that move's error.
 * @param {string} cwd @param {{from: string, to: string}[]} moves state-relative
 */
function moveFiles(cwd, moves) {
  /** @type {{from: string, to: string}[]} */
  const done = [];
  try {
    for (const move of moves) {
      fs.mkdirSync(path.dirname(statePath(cwd, move.to)), { recursive: true });
      fs.renameSync(statePath(cwd, move.from), statePath(cwd, move.to));
      done.push(move);
    }
  } catch (err) {
    throw undoMoves(cwd, done, err);
  }
}

/**
 * Put moved files back where they were, last moved first, every reversal
 * attempted. Any that fail ride `err` as `stranded`, absolute, and are named
 * in its message, so the first failure is never lost. Returns `err`.
 * @param {string} cwd @param {{from: string, to: string}[]} done state-relative, as moved
 * @param {unknown} err the failure that called for the undo
 * @returns {unknown}
 */
function undoMoves(cwd, done, err) {
  /** @type {StrandedMove[]} */
  const stranded = [];
  for (const move of [...done].reverse()) {
    try {
      fs.renameSync(statePath(cwd, move.to), statePath(cwd, move.from));
    } catch (error) {
      stranded.push({ from: statePath(cwd, move.from), to: statePath(cwd, move.to), error });
    }
  }
  if (stranded.length > 0 && err instanceof Error) attachStranded(err, stranded);
  return err;
}

/** @param {Error & {stranded?: StrandedMove[]}} err @param {StrandedMove[]} stranded */
function attachStranded(err, stranded) {
  const named = stranded.map((s) => `"${s.to}" (belongs at "${s.from}")`).join(', ');
  err.message += ` — and ${stranded.length === 1 ? 'a file' : `${stranded.length} files`} could not be put back: ${named}`;
  err.stranded = stranded;
}

/**
 * Move every item to its destination (collision-checked first), then commit
 * the whole set scoped to the inbox, with the paths `record` wrote beside
 * the moves — every file put back where `record` fails.
 * @param {string} cwd @param {InboxItem[]} items
 * @param {(item: InboxItem) => string} destDir relative destination directory per item
 * @param {string} message
 * @param {() => string[]} [record] state-relative paths it wrote
 * @returns {{moved: string[], committed: string|null}}
 */
function moveAndCommit(cwd, items, destDir, message, record = () => []) {
  const moves = items.map((item) => ({ from: item.rel, to: `${destDir(item)}/${item.file}` }));
  refuseTakenDestinations(cwd, moves);
  moveFiles(cwd, moves);
  /** @type {string[]} */
  let recorded;
  try {
    recorded = record();
  } catch (err) {
    throw undoMoves(cwd, moves, err);
  }
  const moved = moves.map((m) => statePath(cwd, m.to));
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, [INBOX, ...recorded], message, warnings);
  return committedResult({ moved, committed: outcome.committed }, outcome, warnings);
}

/**
 * A transaction's result with its commit's outcome: the warnings where there
 * are any, and the note a failed commit leaves.
 * @template {{committed: string|null, note?: string, warnings?: string[]}} R
 * @param {R} result @param {{committed: string|null, failed: boolean}} outcome @param {string[]} warnings
 * @returns {R}
 */
function committedResult(result, outcome, warnings) {
  if (warnings.length > 0) result.warnings = warnings;
  if (outcome.failed) noteCommitOutcome(result, outcome);
  return result;
}

/** The project manifest's record of who closed each archived item (the header's). */
const CLOSED = 'inbox_closed';

/** @typedef {{unit: string|null, at: string}} Closure */

/** An item's key on the record. @param {InboxItem} item */
const closedKey = ({ folder, file }) => `${folder}/${file}`;

/**
 * The record rewritten as `change` answers it, or left where it answers
 * null; an emptied record goes from the manifest. Answers the paths a
 * commit takes: the project manifest, or none where nothing changed.
 * @param {string} cwd @param {(record: Record<string, Closure>) => Record<string, Closure>|null} change
 * @returns {string[]}
 */
function rewriteRecord(cwd, change) {
  return withProjectLock(cwd, () => {
    const { [CLOSED]: held, ...rest } = readProjectManifest(cwd);
    const changed = change(isObject(held) ? held : {});
    if (changed === null) return [];
    writeProjectManifestAtomic(cwd, Object.keys(changed).length === 0 ? rest : { ...rest, [CLOSED]: changed });
    return [PROJECT_MANIFEST_SPEC];
  });
}

/** Each item's record dropped, where it has one. @param {string} cwd @param {InboxItem[]} items @returns {string[]} */
function dropClosures(cwd, items) {
  const keys = new Set(items.map(closedKey));
  return rewriteRecord(cwd, (record) => {
    if (!Object.keys(record).some((key) => keys.has(key))) return null;
    return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
  });
}

/**
 * Archive live inbox items into `.archived/{folder}/`. One commit for the set.
 * @param {string} cwd project root
 * @param {string[]} paths live inbox paths
 * @returns {{archived: string[], committed: string|null}}
 */
function archiveItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: false });
  const { moved, ...rest } = moveAndCommit(cwd, items, (i) => archivedDir(i.folder), commitMessage('archive', items));
  return { archived: moved, ...rest };
}

/**
 * The unit a close names, null for `none`: one the project holds, of any
 * status.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function closerOf(cwd, unit) {
  if (unit === NO_ARGUMENT) return null;
  if (workUnitNameRefusal(unit) !== null || manifestOf(stateRoot(cwd), unit) === null) {
    throw new Error(`inbox close: there is no work unit "${unit}" — name the unit whose work resolved the items, or none`);
  }
  return unit;
}

/**
 * `inbox close`: live items archived, each recorded as closed by the unit,
 * or by none (the header's). One commit for the set and its record.
 * @param {string} cwd @param {string} unit a work unit, or `none`
 * @param {string[]} paths live inbox paths
 * @returns {{closed: string[], unit: string|null, committed: string|null}}
 */
function closeItems(cwd, unit, paths) {
  const closer = closerOf(cwd, unit);
  const items = parseInboxPaths(cwd, paths, { archived: false });
  const closure = { unit: closer, at: isoNow() };
  const record = () => rewriteRecord(cwd, (held) => ({ ...held, ...Object.fromEntries(items.map((item) => [closedKey(item), closure])) }));
  const message = `${commitMessage('close', items)}${closer === null ? '' : `, resolved by ${closer}`}`;
  const { moved, ...rest } = moveAndCommit(cwd, items, (i) => archivedDir(i.folder), message, record);
  return { closed: moved, unit: closer, ...rest };
}

/**
 * Restore archived items back to their live folders, each one's record of
 * its close dropped. One commit for the set.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{restored: string[], committed: string|null}}
 */
function restoreItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: true });
  const { moved, ...rest } = moveAndCommit(cwd, items, (i) => `${INBOX}/${i.folder}`, commitMessage('restore', items), () => dropClosures(cwd, items));
  return { restored: moved, ...rest };
}

/**
 * Permanently delete archived items, each one's record of its close
 * dropped first. One commit for the set. Live-folder paths are rejected —
 * delete only operates on `.archived/`.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{deleted: string[], committed: string|null}}
 */
function deleteItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: true });
  const recorded = dropClosures(cwd, items);
  const deleted = items.map((i) => statePath(cwd, i.rel));
  for (const file of deleted) fs.rmSync(file);
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, [INBOX, ...recorded], commitMessage('delete', items), warnings);
  return committedResult({ deleted, committed: outcome.committed }, outcome, warnings);
}

/**
 * The items the record says `unit` closed, in the order closed: each one's
 * title — its file's name where it has none — and kind.
 * @param {string} cwd @param {string} unit
 * @returns {{title: string, kind: ItemKind}[]}
 */
function closedBy(cwd, unit) {
  // Required here: the start's reads this module.
  const { titleOf } = require('./start.cjs');
  const record = readProjectManifest(cwd)[CLOSED];
  if (!isObject(record)) return [];
  return Object.entries(record).filter(([, closure]) => closure.unit === unit).map(([key]) => {
    const item = parseInboxPath(cwd, statePath(cwd, ARCHIVED, key), { archived: true });
    const file = statePath(cwd, item.rel);
    return { title: (fs.existsSync(file) ? titleOf(fs.readFileSync(file, 'utf8')) : null) ?? item.slug, kind: FOLDER_KIND[item.folder] };
  });
}

// A claim that the work resolved an item: a line of its own, `Resolved: {path}`.
const RESOLVED_LINE = /^Resolved:(.*)$/gm;

// A live item's path within the claim — absolute, from the project or from
// the state — read from `.inbox/` on; an archived item's runs on
// `.inbox/.archived/`, and never matches.
const NAMED_ITEM = new RegExp(`(?<![\\w.-])\\.inbox/(${FOLDERS.join('|')})/([\\w.-]+\\.md)`, 'g');

/**
 * The items `text`'s `Resolved:` lines claim, still live: each once,
 * absolute, in the order claimed.
 * @param {string} cwd @param {string} text
 * @returns {string[]}
 */
function liveResolved(cwd, text) {
  const claimed = [...text.matchAll(RESOLVED_LINE)].flatMap(([, claim]) => [...claim.matchAll(NAMED_ITEM)]);
  return [...new Set(claimed.map(([, folder, file]) => statePath(cwd, INBOX, folder, file)))].filter((file) => fs.existsSync(file));
}

/**
 * Where a slug's item lands in its folder today: the next free `-{n}`
 * where the inbox, its archive included, holds the name already.
 * @param {string} cwd @param {string} folder @param {string} slug
 * @returns {string} state-relative
 */
function freeItemPath(cwd, folder, slug) {
  const named = (/** @type {string} */ name) => `${todayStamp()}--${name}.md`;
  const taken = (/** @type {string} */ name) => [`${INBOX}/${folder}`, archivedDir(folder)].some((dir) => fs.existsSync(statePath(cwd, dir, named(name))));
  let name = slug;
  for (let n = 2; taken(name); n += 1) name = `${slug}-${n}`;
  return `${INBOX}/${folder}/${named(name)}`;
}

/** Each kind of item by the folder it is filed in. */
const KIND_FOLDER = Object.freeze(Object.fromEntries(Object.entries(FOLDER_KIND).map(([folder, kind]) => [kind, folder])));

/**
 * `inbox file`: an out-of-scope finding of the unit's review phase filed
 * to the inbox, and committed (the header's).
 * @param {string} cwd @param {string} unit @param {string} file
 * @returns {{filed: string, committed: string|null}}
 */
function fileItem(cwd, unit, file) {
  // Required here: the ledger's and the review phase's modules reach this
  // one through the handoff, and the start's reads it.
  const { reviewRefusal } = require('./review-entry.cjs');
  const { titleOf } = require('./start.cjs');
  const { reviewCallFault } = require('./review-phase.cjs');
  const { readShown } = require('./ledger-read.cjs');
  const { unitInProgress } = require('./topic-standing.cjs');
  const { reading } = require('./phase-checks.cjs');
  const { quickFixBuild, reviewAsked } = require('./derivations.cjs');
  const said = 'inbox file';
  const manifest = refusing(said, () => unitInProgress(cwd, unit));
  const atClose = quickFixBuild(manifest) && !reviewAsked(manifest);
  const refused = atClose ? null : refusing(said, () => reviewRefusal(reading(cwd, unit, manifest)));
  if (refused !== null) throw new Error(`${said}: ${refused}`);
  const item = refusing(said, () => shaped(readPayload(cwd, file), 'the item', ['kind', 'text', 'call']));
  const { kind, text, call } = item;
  /** @type {string[]} */
  const faults = [];
  if (typeof kind !== 'string' || !Object.hasOwn(KIND_FOLDER, kind)) faults.push(`its kind is one of ${Object.keys(KIND_FOLDER).join(', ')}, not ${JSON.stringify(kind)}`);
  const title = filled(text) ? titleOf(text) : null;
  if (title === null) faults.push('its text holds its title, `# Title`');
  /** @type {string[]} */
  const warnings = [];
  const fault = filled(call) ? readShown(stateRoot(cwd), warnings, (shower) => reviewCallFault(shower, unit, call, atClose ? 'implementation' : 'review')) : 'its call names the ledger\'s file-or-drop call';
  if (fault !== null) faults.push(fault);
  if (faults.length > 0) throw new Error(`${said}: ${faults.join('; ')}`);
  const rel = freeItemPath(cwd, KIND_FOLDER[/** @type {string} */ (kind)], slugOf(/** @type {string} */ (title)));
  fs.mkdirSync(path.dirname(statePath(cwd, rel)), { recursive: true });
  fs.writeFileSync(statePath(cwd, rel), `${String(text).replace(/\n*$/, '')}\n`);
  const outcome = commitStateTail(cwd, [rel], `workflow(inbox): file ${path.posix.basename(rel, '.md').replace(/^\d{4}-\d{2}-\d{2}--/, '')} from ${unit}'s ${atClose ? 'close' : 'review'}`, warnings);
  return committedResult({ filed: statePath(cwd, rel), committed: outcome.committed }, outcome, warnings);
}

module.exports = {
  fileItem,
  archiveItems,
  closeItems,
  restoreItems,
  deleteItems,
  closedBy,
  liveResolved,
  freeItemPath,
  KIND_FOLDER,
  parseInboxPath,
  parseInboxPaths,
  refuseTakenDestinations,
  moveFiles,
  undoMoves,
  archivedDir,
  INBOX,
  ARCHIVED,
  FOLDER_KIND,
  SEED_SOURCES,
  ROADMAP_SEED,
  seedsOf,
  fromRoadmap,
  seedOrigin,
};
