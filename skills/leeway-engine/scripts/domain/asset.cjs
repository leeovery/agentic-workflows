'use strict';

// ---------------------------------------------------------------------------
// Domain ring: spikes and assets (9.10, 6.1.11) — `asset spike`, a spike's
// folder, and `asset add|status|lift`, the links from the ledger's entries
// to the files that inform them. The verb never moves a file: Claude writes
// it where it lives, and the verb records where that is.
//
// - A spike (9.10.10, 4.11.13): `spike <unit> <slug>` numbers the unit's
//   next spike in the order spikes start, one past the highest of its
//   `spikes/NNN-{slug}/`, makes its folder and its twin at the same path
//   under the gitignored cache, where its dependencies, builds and run
//   output go, and answers both. Nothing is committed: the folder holds
//   nothing yet. A slug one of the unit's spikes has already is refused, so
//   a spike carried on is never started twice.
// - A link is the ledger's `asset` event (ledger-events.cjs): an entry, a
//   file's path from the state root, and the status the link gives the
//   file, the lift it records, or both.
//   - `add` is the first link of an entry and a path, and gives its status
//     (9.10.7). The path names something on disk below a home: the unit's
//     `assets/` or one of its spikes, or the product's (9.10.5, 9.10.11);
//     a path naming nothing is refused, to be corrected or skipped
//     (9.10.22). A file in a spike is reference unless the status is said,
//     as draft code is (9.10.6); anywhere else it is said. An entry already
//     linking the path is refused, its status changed through `status`.
//   - `status` changes the status (9.10.7): every current entry of the
//     unit linking the path takes it, or the one entry named.
//   - `lift` records a linked file lifted into the project, at a path from
//     the project's root that is there (9.10.16): a link giving no status,
//     so a status after it leaves the lift standing (ledger-fold.cjs).
//   Each link names a current entry made in the unit (5.8.17), and `status`
//   and `lift` an entry linking the path already. An entry the link would
//   give nothing new is passed over, and a call giving none anything writes
//   nothing.
// - Each link is tagged as its entry is — its unit, topic and phase — so it
//   stands while the entry's place does, and carries the conversation's
//   session; with none the link is refused.
// - Each path is stored as the file system spells what of it exists, so one
//   file is one path where the file system ignores case; a lift's is read
//   from the call's folder, so a call from a subfolder of the project reads
//   it from there.
// - What a link commits: the ledger and the path it names, a folder with
//   its files, in one commit — so a file a decision rests on is tracked
//   with its link (9.10.4), and an edit to it since its last link lands
//   with the next. A file no entry links stays untracked (9.S38): two clones
//   can start the same spike number for spikes nothing links yet.
// - A link belongs to its entry: a replacement carries none forward, so a
//   file the replaced entry linked is linked from the new one through `add`.
//   A link to a question is tagged at the topic the question was written
//   on, so it goes dead where that topic is set aside after the question
//   moved.
// - When: the argv, the unit and the paths are refused before the writer
//   lock; under it the ledger is folded, the entry resolved and checked, the
//   links appended and committed (`ledger({unit}): asset {id} …`) — held
//   while the migration runs, the files with the line, as every state commit
//   is (commit.cjs).
//   Then, the lock released, the knowledge base's copies, which show each
//   entry's files, are rendered and indexed (ledger-copies.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { KEBAB_SLUG, KEBAB_SLUG_PATTERN, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, stateRelative, resolvedPath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { appendEntry, carrying } = require('./ledger.cjs');
const { LEDGER, ASSET_STATUSES, isPlainPath } = require('./ledger-events.cjs');
const { shortIds, resolveId } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, factsOf, isLive, notCurrent, assetsOf } = require('./ledger-fold.cjs');
const { manifestOf, liveness } = require('./ledger-units.cjs');
const { ledgerMessage, staleness } = require('./ledger-write.cjs');
const { refreshLedgerCopies } = require('./ledger-copies.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail, HELD_NOTE } = require('./commit.cjs');
const { layoutPlace } = require('./layout.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger.cjs').EntryPlace} EntryPlace */
/** @typedef {(place: EntryPlace) => Record<string, any>} EntryAt */

/** The layout's places a linked file sits below (4.11.5, 4.11.12). */
const HOMES = Object.freeze(['{unit}/assets', '{unit}/spikes/{NNN}-{slug}', '.product/assets', '.product/spikes/{NNN}-{slug}']);

/** The homes whose files are a spike's, reference unless said (9.10.6). */
const SPIKE_HOMES = Object.freeze(['{unit}/spikes/{NNN}-{slug}', '.product/spikes/{NNN}-{slug}']);

/** A spike's folder name, its number and its slug. */
const SPIKE_FOLDER = new RegExp(`^([0-9]{3,})-(${KEBAB_SLUG})$`);

/**
 * A verb's argv: its positionals as its usage shows them, and each flag it
 * takes, by name, whether it must be given.
 * @typedef {{args: string[], flags: Record<string, boolean>}} Takes
 */

/** @type {Readonly<Record<string, Takes>>} */
const VERBS = Object.freeze({
  spike: { args: ['<work-unit>', '<slug>'], flags: {} },
  add: { args: ['<work-unit>', '<path>'], flags: { entry: true, status: false } },
  status: { args: ['<work-unit>', '<path>', `<${ASSET_STATUSES.join('|')}>`], flags: { entry: false } },
  lift: { args: ['<work-unit>', '<path>'], flags: { into: true, entry: true } },
});

/** How each flag's value is shown. @type {Readonly<Record<string, string>>} */
const SHOWN = Object.freeze({ entry: '<id>', status: `<${ASSET_STATUSES.join('|')}>`, into: '<path-in-project>' });

/** @param {string} verb */
function verbUsage(verb) {
  const { args, flags } = VERBS[verb];
  const shown = Object.entries(flags).map(([flag, required]) => (required ? `--${flag} ${SHOWN[flag]}` : `[--${flag} ${SHOWN[flag]}]`));
  return ['asset', verb, ...args, ...shown].join(' ');
}

const ASSET_USAGE = Object.keys(VERBS).map(verbUsage).join('\n');

/**
 * A verb's argv read: its positionals and its flags by name. Refuses a
 * flag the verb does not take, one given twice or with no value, a missing
 * one it needs, and positionals of another count, each with its usage.
 * @param {string} verb @param {string[]} argv
 * @returns {{positional: string[], flags: Record<string, string>}}
 */
function readArgs(verb, argv) {
  const usage = `Usage: engine ${verbUsage(verb)}`;
  const { args, flags: takes } = VERBS[verb];
  /** @type {string[]} */
  const positional = [];
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) {
      positional.push(argv[i]);
      continue;
    }
    const flag = argv[i].slice(2);
    const value = argv[i + 1];
    if (!Object.hasOwn(takes, flag) || Object.hasOwn(flags, flag) || value === undefined || value === '' || value.startsWith('--')) throw new Error(usage);
    flags[flag] = value;
    i += 1;
  }
  if (positional.length !== args.length || Object.entries(takes).some(([flag, required]) => required && !Object.hasOwn(flags, flag))) throw new Error(usage);
  return { positional, flags };
}

/**
 * The state root, `unit` checked: a unit the project has, and for a spike,
 * live (5.8.17).
 * @param {string} cwd @param {string} said @param {string} unit @param {{live?: boolean}} [opts]
 * @returns {string}
 */
function unitRoot(cwd, said, unit, { live = false } = {}) {
  const root = stateRoot(cwd);
  if (workUnitNameRefusal(unit) !== null || manifestOf(root, unit) === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  const dead = live ? liveness(root)(unit, null) : null;
  if (dead !== null) throw new Error(`${said}: ${unit} takes no spike — ${dead}`);
  return root;
}

/** The unit's spikes' folder names, in the order they started. @param {string} root @param {string} unit @returns {string[]} */
function spikesOf(root, unit) {
  const dir = path.join(root, unit, 'spikes');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => SPIKE_FOLDER.test(name)).sort() : [];
}

/**
 * `asset spike`: the unit's next spike, its folder and its twin under the
 * cache made, under the writer lock so two starts never take one number.
 * @param {string} cwd @param {string[]} positional
 */
function startSpike(cwd, [unit, slug]) {
  const said = 'asset spike';
  if (!KEBAB_SLUG_PATTERN.test(slug)) throw new Error(`${said}: "${slug}" is no slug — lowercase letters and digits, joined by single hyphens`);
  const root = unitRoot(cwd, said, unit, { live: true });
  return withStateLock(root, () => {
    const spikes = spikesOf(root, unit);
    const same = spikes.find((name) => /** @type {RegExpExecArray} */ (SPIKE_FOLDER.exec(name))[2] === slug);
    if (same !== undefined) throw new Error(`${said}: ${unit} has a spike "${slug}" already, spikes/${same} — carry on in it, or name the new one apart`);
    const number = Math.max(0, ...spikes.map((name) => Number(/** @type {RegExpExecArray} */ (SPIKE_FOLDER.exec(name))[1]))) + 1;
    const spike = `${String(number).padStart(3, '0')}-${slug}`;
    const rel = `${unit}/spikes/${spike}`;
    const folder = path.join(root, rel);
    const cache = path.join(root, '.cache', rel);
    fs.mkdirSync(folder, { recursive: true });
    fs.mkdirSync(cache, { recursive: true });
    return { spike, path: rel, folder, cache };
  });
}

/**
 * The home a linked file sits below, or null: one of `HOMES`, a unit's
 * being `unit`'s own.
 * @param {string} unit @param {string} rel
 * @returns {string|null}
 */
function homeOf(unit, rel) {
  const at = layoutPlace(rel);
  if (at === null || !HOMES.includes(at.path)) return null;
  return at.path.startsWith('{unit}/') && rel.split('/')[0] !== unit ? null : at.path;
}

/**
 * A path from the state root, written plain, as the file system spells what
 * of it exists — so one file is one path where the file system ignores case.
 * Refuses one not written plain, or leading out of the state.
 * @param {string} said @param {string} cwd @param {string} given
 * @returns {string}
 */
function spelledInState(said, cwd, given) {
  const plain = `${said}: "${given}" is no path from the state root written plain — no part of it empty, . or ..`;
  if (!isPlainPath(given)) throw new Error(plain);
  const rel = stateRelative(cwd, path.join(stateRoot(cwd), given));
  if (rel === null) throw new Error(plain);
  return rel;
}

/**
 * The status a first link gives the file at `rel`, checked: below one of
 * the unit's homes, or the product's, and there on disk; the status said,
 * or for a spike's file reference.
 * @param {string} said @param {string} root @param {string} unit @param {string} rel @param {string|undefined} status
 * @returns {string}
 */
function firstStatus(said, root, unit, rel, status) {
  const home = homeOf(unit, rel);
  if (home === null) {
    throw new Error(`${said}: ${rel} is not where an asset lives — ${unit}/assets/, a spike of ${unit}'s, ${unit}/spikes/NNN-{slug}/, `
      + 'or the product\'s .product/assets/ or .product/spikes/NNN-{slug}/');
  }
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`${said}: ${rel} names no file — save it there first, or correct the path`);
  if (status !== undefined) return checkedStatus(said, status);
  if (!SPIKE_HOMES.includes(home)) throw new Error(`${said}: a first link gives the file its status — --status <${ASSET_STATUSES.join('|')}>`);
  return 'reference';
}

/** A status the link may give. @param {string} said @param {string} status */
function checkedStatus(said, status) {
  if (!ASSET_STATUSES.includes(status)) throw new Error(`${said}: "${status}" is no status — ${ASSET_STATUSES.join(' or ')}`);
  return status;
}

/**
 * The project path a lift names, checked — written plain, and there in the
 * project, read from the call's folder — as the file system spells it.
 * @param {string} said @param {string} cwd @param {string} into
 */
function checkedLift(said, cwd, into) {
  if (!isPlainPath(into)) throw new Error(`${said}: --into "${into}" is no path in the project from its root written plain — no part of it empty, . or ..`);
  const project = resolvedPath(codeRoot(cwd), '.');
  const at = resolvedPath(project, into);
  const rel = path.relative(project, at);
  if (!fs.existsSync(at) || rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`${said}: --into ${into} names nothing in the project — a lift is recorded once the code is there`);
  }
  return rel.split(path.sep).join('/');
}

/**
 * What a link gives a file: its status, or null for a lift alone, and the
 * project path it was lifted into, or null.
 * @typedef {{status: string|null, into: string|null}} Gives
 */

/**
 * The ledger as one link verb reads it under the lock: folded, read against
 * liveness, each entry's line read again, and an id in its short form.
 * @typedef {{read: Folded, entryAt: EntryAt, short: (id: string) => string}} Reading
 */

/** An entry a link names: its full id and its line. @typedef {{id: string, line: Record<string, any>}} Named */

/**
 * The entry `prefix` names, checked: an entry, current, made in `unit`.
 * @param {string} said @param {Reading} reading @param {string} unit @param {string} prefix
 * @returns {Named}
 */
function entryNamed(said, { read, entryAt, short }, unit, prefix) {
  let id;
  try {
    id = resolveId(prefix, read.facts.keys());
  } catch (err) {
    throw new Error(`${said} --entry: ${err instanceof Error ? err.message : String(err)}`);
  }
  const facts = factsOf(read, id);
  const where = `${said} --entry names ${short(id)}`;
  if (facts.kind === null) throw new Error(`${where}, a ${facts.event} event — it must name an entry`);
  const stale = notCurrent(read, id);
  if (stale !== null) throw new Error(`${where}, ${staleness(read, id, stale, short)}`);
  const line = entryAt(facts.place);
  if (line.unit !== unit) throw new Error(`${where}, an entry of ${line.unit} — an asset of ${unit}'s is linked from ${unit}'s own entries`);
  return { id, line };
}

/**
 * What the entry's live links give the file at `rel`: its standing status
 * and lift, or null where none links it.
 * @param {Reading} reading @param {string} id @param {string} rel
 * @returns {Gives|null}
 */
function standing({ read, entryAt }, id, rel) {
  const file = assetsOf(read, id).find((asset) => asset.path === rel);
  if (file === undefined) return null;
  const given = (/** @type {string|null} */ link, /** @type {'status'|'into'} */ field) => (link === null ? null : entryAt(factsOf(read, link).place)[field]);
  return { status: given(file.status, 'status'), into: given(file.lift, 'into') };
}

/**
 * The current entries made in `unit` that a live link ties to the file at
 * `rel`, in the order each first linked it.
 * @param {Reading} reading @param {string} unit @param {string} rel
 * @returns {Named[]}
 */
function entriesLinking({ read, entryAt }, unit, rel) {
  /** @type {Set<string>} */
  const entries = new Set();
  for (const [id, facts] of read.facts) {
    if (facts.event === 'asset' && facts.path === rel && isLive(read, id)) entries.add(/** @type {string} */ (facts.entry));
  }
  return [...entries].filter((id) => notCurrent(read, id) === null).map((id) => ({ id, line: entryAt(factsOf(read, id).place) }))
    .filter(({ line }) => line.unit === unit);
}

/**
 * A link an entry is to append: the entry it names, and what it gives.
 * @typedef {{entry: Named, gives: Gives}} Link
 */

/**
 * The links a verb appends, worked out from the ledger under the lock:
 * refused in the words of the command asking.
 * @typedef {(reading: Reading) => Link[]} Plan
 */

/**
 * The note a call that wrote nothing answers, or the one a commit's outcome
 * gives.
 * @param {Outcome|null} outcome
 * @returns {string|undefined}
 */
function noteOf(outcome) {
  if (outcome === null) return 'nothing written — every entry named already gives the file that';
  if (outcome.held) return HELD_NOTE;
  return outcome.failed ? 'commit pending — the link is in the ledger, and the next ledger write or boot commits it' : undefined;
}

/**
 * A commit's outcome, as the state's commit door answers it.
 * @typedef {{committed: string|null, failed: boolean, held?: true}} Outcome
 */

/**
 * Under the writer lock: the ledger folded, the links `plan` works out
 * appended, each tagged as its entry is and carrying `session`, and the
 * ledger committed with the file the links name where any was. Answers each
 * link's short id and the entry's, and the commit's outcome, or null where
 * nothing was appended.
 * @param {string} cwd @param {string} root @param {string} unit @param {string} rel @param {string} session @param {Plan} plan @param {string[]} warnings
 * @returns {{links: {id: string, entry: string}[], outcome: Outcome|null}}
 */
function landLinks(cwd, root, unit, rel, session, plan, warnings) {
  return withStateLock(root, () => {
    const { planned, ids } = readFolded(root, ID_FACTS, warnings, (facts, entryAt) => {
      const read = { facts, live: liveness(root) };
      const shorts = shortIds(facts.keys());
      return { planned: plan({ read, entryAt, short: (id) => /** @type {string} */ (shorts.get(id)) }), ids: [...facts.keys()] };
    });
    const appended = planned.map(({ entry: { id, line }, gives }) => appendEntry(root, {
      event: 'asset', unit: line.unit, topic: line.topic, phase: line.phase, session, entry: id, path: rel, ...gives,
    }, warnings));
    const shorts = shortIds([...ids, ...appended.map((link) => /** @type {string} */ (link.id))]);
    const short = (/** @type {unknown} */ id) => /** @type {string} */ (shorts.get(/** @type {string} */ (id)));
    const topics = new Set(appended.map((link) => /** @type {string|null} */ (link.topic)));
    const message = ledgerMessage(unit, 'asset', appended.map((link) => short(link.id)).join(' '), topics.size === 1 ? [...topics][0] : null);
    return {
      links: appended.map((link) => ({ id: short(link.id), entry: short(link.entry) })),
      outcome: appended.length === 0 ? null : commitStateTail(cwd, [LEDGER, rel], message, warnings),
    };
  });
}

/**
 * The links `plan` works out landed (`landLinks`), then the knowledge
 * base's copies rendered and indexed. Answers the path, each link's id and
 * the entry it names, and the commit.
 * @param {string} cwd @param {string} said @param {string} root @param {string} unit @param {string} rel @param {Plan} plan
 */
function linkFile(cwd, said, root, unit, rel, plan) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const session = handedSession();
    if (session === null) throw new Error(`${said}: no session to tag the link with — CLAUDE_CODE_SESSION_ID is not set`);
    const { links, outcome } = landLinks(cwd, root, unit, rel, session, plan, warnings);
    if (outcome !== null) refreshLedgerCopies(cwd, warnings);
    const note = noteOf(outcome);
    return {
      path: rel, links, committed: outcome?.committed ?? null,
      ...(note === undefined ? {} : { note }),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `asset add`: the first link of an entry and a file, giving its status.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} flags
 */
function addAsset(cwd, [unit, given], flags) {
  const said = 'asset add';
  const root = unitRoot(cwd, said, unit);
  const rel = spelledInState(said, cwd, given);
  const status = firstStatus(said, root, unit, rel, flags.status);
  return linkFile(cwd, said, root, unit, rel, (reading) => {
    const entry = entryNamed(said, reading, unit, flags.entry);
    const was = standing(reading, entry.id, rel);
    if (was !== null) {
      throw new Error(`${said}: ${reading.short(entry.id)} links ${rel} already${was.status === null ? '' : `, ${was.status}`} — its status changes through asset status`);
    }
    return [{ entry, gives: { status, into: null } }];
  });
}

/**
 * `asset status`: the file's status changed, on every current entry of the
 * unit linking it, or the one named.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} flags
 */
function changeStatus(cwd, [unit, given, asked], flags) {
  const said = 'asset status';
  const status = checkedStatus(said, asked);
  const root = unitRoot(cwd, said, unit);
  const rel = spelledInState(said, cwd, given);
  return linkFile(cwd, said, root, unit, rel, (reading) => {
    const entries = flags.entry === undefined ? entriesLinking(reading, unit, rel) : [linking(said, reading, unit, rel, flags.entry)];
    if (entries.length === 0) throw new Error(`${said}: no current entry of ${unit} links ${rel} — asset add links it first, giving its status`);
    return entries.filter(({ id }) => standing(reading, id, rel)?.status !== status).map((entry) => ({ entry, gives: { status, into: null } }));
  });
}

/**
 * `asset lift`: a linked file recorded lifted into the project.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} flags
 */
function liftAsset(cwd, [unit, given], flags) {
  const said = 'asset lift';
  const into = checkedLift(said, cwd, flags.into);
  const root = unitRoot(cwd, said, unit);
  const rel = spelledInState(said, cwd, given);
  return linkFile(cwd, said, root, unit, rel, (reading) => {
    const entry = linking(said, reading, unit, rel, flags.entry);
    return standing(reading, entry.id, rel)?.into === into ? [] : [{ entry, gives: { status: null, into } }];
  });
}

/**
 * The entry `prefix` names, checked as `entryNamed` checks it, and linking
 * the file at `rel` already: a first link gives its status (9.10.7).
 * @param {string} said @param {Reading} reading @param {string} unit @param {string} rel @param {string} prefix
 * @returns {Named}
 */
function linking(said, reading, unit, rel, prefix) {
  const entry = entryNamed(said, reading, unit, prefix);
  if (standing(reading, entry.id, rel) === null) {
    throw new Error(`${said}: ${reading.short(entry.id)} does not link ${rel} — a first link gives its status, through asset add`);
  }
  return entry;
}

/** What each verb does with its argv read. @type {Readonly<Record<string, (cwd: string, positional: string[], flags: Record<string, string>) => Record<string, unknown>>>} */
const RUNS = Object.freeze({ spike: startSpike, add: addAsset, status: changeStatus, lift: liftAsset });

/**
 * `asset <spike|add|status|lift>`: the verb's argv read, then run.
 * @param {string} cwd @param {string} verb @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runAssetVerb(cwd, verb, argv) {
  if (!Object.hasOwn(RUNS, verb)) throw new Error(`Usage: engine asset <${Object.keys(RUNS).join('|')}> …\n${ASSET_USAGE}`);
  const { positional, flags } = readArgs(verb, argv);
  return RUNS[verb](cwd, positional, flags);
}

module.exports = { ASSET_USAGE, runAssetVerb };
