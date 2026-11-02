'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how each file on the state branch merges when two clones have
// both moved (4.7). Pure: the line rules take the remote's lines and this
// clone's, a line at a time, and answer the lines to add; the manifests take
// the common ancestor's too, and answer the merged result, or the fields a
// person has to pick.
//
// - The ledger (`.ledger.jsonl`): the remote's lines exactly as they are,
//   then this clone's lines whose ids the remote lacks, in this clone's
//   order. The result starts byte for byte with the remote's ledger, so the
//   append-only check holds on both clones afterwards (4.7.2, 5.4.3). Read a
//   line at a time, it merges at any size.
// - The migrations record (`.state/migrations`): the remote's lines, then
//   this clone's ids the remote lacks, so a migration applied on both
//   clones keeps one line (4.7.4).
// - Every manifest, field by field against the common ancestor (4.7.5): a
//   field only one side changed takes that side's value, and one both set
//   alike takes it. Nested objects recurse, key by key. A key absent on a
//   side is that side's value: removed on one side and left alone on the
//   other, it goes; removed on one and changed on the other, it is a
//   conflict. An array is one field's value, never merged element by
//   element, since a manifest's lists carry no identity to match elements
//   by; but where the ancestor held the list and both sides only appended
//   to it, the result is the remote's list, then this clone's appended
//   elements, less one for each the remote appended too, in order — the
//   ledger's rule, so independent appends never stop the merge. Any other
//   divergence on one field, two lists both sides created among them, is a
//   conflict (4.7.6), resolved by a pick. A pick answers one choice: the
//   field, and the two values it was between. One field is never a choice:
//   the project manifest's `project_id`, which each clone mints as it sets
//   the state up, so two set up before either pushed hold one each; where
//   the sides differ the remote's stands, with or without an ancestor
//   (4.7.12, 16.13.5).
// - The tracker's store: each file a task driver names (`storeFiles`) is
//   merged by that driver (`mergeStore`), which reads the tracker's own
//   records (7.5, 29.14.9); the fields both sides changed differently are
//   choices like a manifest's, and engine names both sides made are a
//   notice the person acknowledges.
// - A build's run (`{unit}/build/runs/{n}.S{m}/run-{NNN}.json`) is an
//   append-only fact, read here by its number; where both machines wrote
//   runs under the same numbers, this machine's are renumbered before the
//   tree merges (state-merge-paths.cjs).
// - Any other JSON file is kept whole, never merged line by line: a text
//   merge of JSON can leave neither side's data.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { isObject } = require('../kernel/manifest-io.cjs');
const { titlecase } = require('./conventions.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { STATE_DIR_NAME } = require('../kernel/state-root.cjs');

const MIGRATIONS = '.state/migrations';
// The project's manifest and each unit's; a unit's name never starts with
// a dot, so a hidden folder's file is never a unit's manifest.
const MANIFEST = /^(?:[^./][^/]*\/)?manifest\.json$/;
const JSON_FILE = /\.jsonl?$/;
const RUN = /^[^./][^/]*\/build\/runs\/[^/]+\/run-([0-9]{3,})\.json$/;
const PROJECT_KEY = ['manifest.json', 'project_id'];

/** @typedef {'ledger'|'migrations'|'manifest'|'store'|'whole'|'file'} MergeRule */
/** @typedef {import('./drivers.cjs').TaskDriver} TaskDriver */

/** A side's copy is not what its rule reads, so the merge cannot take it apart. */
class MergeError extends Error {}

/** A state path as the merge's notes and refusals name it, from the project root. @param {string} file */
function fromRoot(file) {
  return `${STATE_DIR_NAME}/${file}`;
}

/**
 * One side of a conflicted field: its value, or that it was removed.
 * @typedef {{set: true, value: unknown}|{set: false}} Side
 */

/**
 * A choice a field leaves the person: its path from the manifest's root,
 * and each side's value.
 * @typedef {{field: string[], local: Side, remote: Side}} Choice
 */

/**
 * A notice the person acknowledges rather than picks between: the engine
 * names both sides made in the tracker's store, and this machine's tasks set
 * aside for them (drivers.cjs, MadeTwice).
 * @typedef {import('./drivers.cjs').MadeTwice} Notice
 */

/**
 * A field both sides changed to different values: the choice, and the
 * person's pick once made.
 * @typedef {Choice & {pick: 'local'|'remote'|null}} FieldConflict
 */

/**
 * What a conflicted field is called on the screen: whose manifest it is in,
 * the entry it belongs to where one can be read (with that entry's name),
 * the field by its meaning, and its path.
 * @typedef {{owner: string, subject: string|null, name: string|null, field: string|null, path: string}} ConflictLabel
 */

/** @type {Map<string, TaskDriver>|undefined} */
let stores;

/**
 * The task driver whose store holds a file, by the files each shipped one
 * names; undefined where none does.
 * @param {string} file  from the state root
 * @returns {TaskDriver|undefined}
 */
function storeDriverOf(file) {
  // Loaded here, not with the module: the stop's screen reads this module
  // and needs no driver.
  stores ??= new Map(/** @type {TaskDriver[]} */ (require('./drivers.cjs').listDrivers('task'))
    .flatMap((driver) => driver.storeFiles().map((held) => /** @type {[string, TaskDriver]} */ ([held, driver]))));
  return stores.get(file);
}

/**
 * The rule a state file merges by.
 * @param {string} file  from the state root
 * @returns {MergeRule}
 */
function ruleOf(file) {
  if (file === LEDGER) return 'ledger';
  if (file === MIGRATIONS) return 'migrations';
  if (MANIFEST.test(file)) return 'manifest';
  if (storeDriverOf(file) !== undefined) return 'store';
  return JSON_FILE.test(file) ? 'whole' : 'file';
}

/** A build's run's number, or null where the path is no run's. @param {string} file @returns {number|null} */
function runNumber(file) {
  const run = RUN.exec(file);
  return run === null ? null : Number(run[1]);
}

/** A run's path under another number, in its folder. @param {string} file @param {number} number @returns {string} */
function runRenumbered(file, number) {
  return `${file.slice(0, file.lastIndexOf('/') + 1)}run-${String(number).padStart(3, '0')}.json`;
}

/**
 * A line's key. Its side, and its number among that side's lines that are
 * not blank, name a line that cannot be read.
 * @typedef {(line: string, side: 'local'|'remote', number: number) => string} KeyOf
 */

/**
 * This clone's lines to add after the remote's: each whose key the remote's
 * lines lack, once each, in this clone's order. Blank lines are neither
 * keyed nor added.
 * @param {Iterable<string>} remote @param {Iterable<string>} local @param {KeyOf} keyOf
 * @returns {Generator<string>}
 */
function* linesToAdd(remote, local, keyOf) {
  const held = new Set();
  let number = 0;
  for (const line of remote) {
    if (line.trim() !== '') held.add(keyOf(line, 'remote', ++number));
  }
  number = 0;
  for (const line of local) {
    if (line.trim() === '') continue;
    const key = keyOf(line, 'local', ++number);
    if (held.has(key)) continue;
    held.add(key);
    yield line;
  }
}

/**
 * A ledger line's key, its id. Refuses a line that is not a JSON object
 * with a string id: a ledger holding one is not a ledger the merge can
 * union.
 * @type {KeyOf}
 */
function entryId(line, side, number) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    entry = null;
  }
  if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') {
    const where = side === 'local' ? "this machine's" : "the remote's";
    throw new MergeError(`cannot merge ${fromRoot(LEDGER)}: line ${number} of ${where} is not an entry with an id: ${line.slice(0, 80)}`);
  }
  return entry.id;
}

/** A migrations record line's key, the migration's id. @type {KeyOf} */
function migrationId(line) {
  return line.trim();
}

/** A key's value, or undefined where the key is not the object's own. @param {unknown} object @param {string} key */
function own(object, key) {
  return isObject(object) && Object.hasOwn(object, key) ? object[key] : undefined;
}

// A key such as `__proto__` is written as data, never as the prototype.
/** @param {Record<string, unknown>} object @param {string} key @param {unknown} value */
function put(object, key, value) {
  Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * Whether two JSON values are the same: arrays in order, objects whatever
 * their keys' order. Undefined is an absent key, the same only as itself.
 * @param {unknown} a @param {unknown} b
 * @returns {boolean}
 */
function same(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => same(item, b[i]));
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}

/** @param {unknown[]} list @param {unknown[]} prefix */
function startsWith(list, prefix) {
  return list.length >= prefix.length && prefix.every((item, i) => same(item, list[i]));
}

/**
 * Two lists that each only appended to the ancestor's, joined: the
 * remote's, then this clone's appended elements, less one for each element
 * the remote appended too, in order. Undefined where the ancestor held no
 * list, or where either side did anything but append.
 * @param {unknown} base @param {unknown} local @param {unknown} remote
 * @returns {unknown[]|undefined}
 */
function bothAppended(base, local, remote) {
  if (!Array.isArray(base) || !Array.isArray(local) || !Array.isArray(remote)) return undefined;
  if (!startsWith(local, base) || !startsWith(remote, base)) return undefined;
  const theirs = remote.slice(base.length);
  const mine = local.slice(base.length).filter((item) => {
    const held = theirs.findIndex((other) => same(other, item));
    if (held !== -1) theirs.splice(held, 1);
    return held === -1;
  });
  return [...remote, ...mine];
}

/** @param {unknown} value @returns {Side} */
function sideOf(value) {
  return value === undefined ? { set: false } : { set: true, value };
}

/** A JSON value with every object's keys in order, so equal values write alike. @param {unknown} value @returns {unknown} */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

/**
 * A choice's identity: the file it is in, whether it is on the branch or
 * between the working tree and the update, and what it asks — the field and
 * the two values, whatever order their keys came in, or the notice's names
 * and tasks. A pick answers the choice with its identity, and the screen
 * carries it to the pick.
 * @param {(Choice|Notice) & {file: string, uncommitted: boolean}} choice
 * @returns {string}
 */
function choiceId(choice) {
  const { file, uncommitted } = choice;
  const asked = 'madeTwice' in choice ? [choice.madeTwice, choice.again] : [choice.field, choice.local, choice.remote];
  const named = JSON.stringify(canonical([file, uncommitted, ...asked]));
  return crypto.createHash('sha1').update(named).digest('hex').slice(0, 12);
}

/** @typedef {(choice: Choice) => 'local'|'remote'|null} PickOf */

/** @typedef {{conflicts: FieldConflict[], pickOf: PickOf, remoteStands: (field: string[]) => boolean}} FieldMerge */

/**
 * One field merged, recursing into objects both sides hold.
 * @param {unknown} base @param {unknown} local @param {unknown} remote
 * @param {string[]} field @param {FieldMerge} merge
 * @returns {unknown}
 */
function mergeValue(base, local, remote, field, merge) {
  if (same(local, remote) || same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (merge.remoteStands(field)) return remote;
  if (isObject(local) && isObject(remote)) return mergeObject(base, local, remote, field, merge);
  const appended = bothAppended(base, local, remote);
  if (appended !== undefined) return appended;
  const choice = { field, local: sideOf(local), remote: sideOf(remote) };
  const pick = merge.pickOf(choice);
  merge.conflicts.push({ ...choice, pick });
  return pick === 'local' ? local : remote;
}

/**
 * An object both sides hold, merged key by key: the remote's keys in its
 * order, then this clone's new ones in its.
 * @param {unknown} base @param {Record<string, unknown>} local @param {Record<string, unknown>} remote
 * @param {string[]} field @param {FieldMerge} merge
 * @returns {Record<string, unknown>}
 */
function mergeObject(base, local, remote, field, merge) {
  /** @type {Record<string, unknown>} */
  const merged = {};
  const keys = [...Object.keys(remote), ...Object.keys(local).filter((key) => !Object.hasOwn(remote, key))];
  for (const key of keys) {
    const value = mergeValue(own(base, key), own(local, key), own(remote, key), [...field, key], merge);
    if (value !== undefined) put(merged, key, value);
  }
  return merged;
}

/**
 * Two JSON values merged field by field against their common ancestor
 * (undefined where it held none). Each conflict carries the pick `pickOf`
 * names for its choice, and takes it; a conflict with no pick takes the
 * remote's value for now. A field `remoteStands` names is the remote's
 * wherever the sides differ.
 * @param {unknown} base @param {unknown} local @param {unknown} remote
 * @param {PickOf} [pickOf] @param {(field: string[]) => boolean} [remoteStands]
 * @returns {{value: unknown, conflicts: FieldConflict[]}}
 */
function mergeFields(base, local, remote, pickOf = () => null, remoteStands = () => false) {
  /** @type {FieldMerge} */
  const merge = { conflicts: [], pickOf, remoteStands };
  const value = mergeValue(base, local, remote, [], merge);
  return { value, conflicts: merge.conflicts };
}

/**
 * The manifest `file` merged field by field against the common ancestor
 * (undefined where the manifest is new on both sides); a conflict with no
 * pick stops the merge.
 * @param {string} file  from the state root
 * @param {unknown} base @param {Record<string, unknown>} local @param {Record<string, unknown>} remote
 * @param {PickOf} [pickOf]
 * @returns {{value: unknown, conflicts: FieldConflict[]}}
 */
function mergeManifest(file, base, local, remote, pickOf) {
  return mergeFields(base, local, remote, pickOf, (field) => same([file, ...field], PROJECT_KEY));
}

// The entries a field can belong to, by where they sit in a manifest: the
// screen names the entry and the field rather than the path (4.7.6).
const SUBJECTS = [
  { manifest: 'project', at: ['roadmap', 'items'], noun: 'roadmap item' },
];

/** A key as words: `plan_format` → `plan format`. @param {string} key */
function words(key) {
  return key.replace(/[-_]+/g, ' ').trim();
}

/** A name as a phrase: `a-lifetime-tier` → `A lifetime tier`. @param {string} name */
function phrase(name) {
  const text = words(name);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a conflicted field is called: the manifest by its owner, the entry
 * it belongs to by name where a subject's place matches, and the field by
 * its meaning — its last key as words.
 * @param {string} manifest  from the state root
 * @param {string[]} field
 * @param {string} project  the project's name
 * @returns {ConflictLabel}
 */
function conflictLabel(manifest, field, project) {
  const unit = manifest.includes('/') ? manifest.slice(0, manifest.indexOf('/')) : null;
  const owner = unit === null ? `${project}'s project manifest` : `${titlecase(unit)}'s manifest`;
  const kind = unit === null ? 'project' : 'unit';
  const path = field.join('.');
  const subject = SUBJECTS.find((s) => s.manifest === kind && field.length > s.at.length && startsWith(field, s.at));
  const last = field[field.length - 1];
  if (subject === undefined) return { owner, subject: null, name: null, field: words(last), path };
  const name = phrase(field[subject.at.length]);
  const rest = field.slice(subject.at.length + 1);
  return { owner, subject: `the ${subject.noun} "${name}"`, name, field: rest.length > 0 ? words(last) : null, path };
}

/**
 * The conflict a stop asks about: the first not yet picked; where every one
 * is picked, which the next catch-up finishes, the last.
 * @param {{pick: string|null}[]} conflicts
 * @returns {number}
 */
function askedAt(conflicts) {
  const open = conflicts.findIndex((c) => c.pick === null);
  return open === -1 ? conflicts.length - 1 : open;
}

module.exports = {
  MIGRATIONS,
  MergeError,
  fromRoot,
  ruleOf,
  storeDriverOf,
  runNumber,
  runRenumbered,
  linesToAdd,
  entryId,
  migrationId,
  same,
  mergeFields,
  mergeManifest,
  choiceId,
  askedAt,
  conflictLabel,
};
