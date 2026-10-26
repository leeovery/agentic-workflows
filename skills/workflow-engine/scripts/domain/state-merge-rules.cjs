'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how each file on the state branch merges when two clones have
// both moved (4.7). Pure: each rule takes the remote's text and this clone's,
// and the manifests take the common ancestor's too, and answers the merged
// result, or the fields a person has to pick.
//
// - The ledger (`.ledger.jsonl`): the remote's lines exactly as they are,
//   then this clone's lines whose ids the remote lacks, in this clone's
//   order. The result starts byte for byte with the remote's ledger, so the
//   append-only check holds on both clones afterwards (4.7.2, 5.4.3).
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
//   elements the remote did not append too, in order — the ledger's rule,
//   so independent appends never stop the merge. Any other divergence on
//   one field, two lists both sides created among them, is a conflict
//   (4.7.6), resolved by a pick. A pick answers one choice: the field, and
//   the two values it was between.
// - Any other JSON file is kept whole, never merged line by line: a text
//   merge of JSON can leave neither side's data.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { titlecase } = require('./conventions.cjs');

const LEDGER = '.ledger.jsonl';
const MIGRATIONS = '.state/migrations';
// The project's manifest and each unit's; a unit's name never starts with
// a dot, so a hidden folder's file is never a unit's manifest.
const MANIFEST = /^(?:[^./][^/]*\/)?manifest\.json$/;
const JSON_FILE = /\.jsonl?$/;

/** @typedef {'ledger'|'migrations'|'manifest'|'whole'|'file'} MergeRule */

/** A side's copy is not what its rule reads, so the merge cannot take it apart. */
class MergeError extends Error {}

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

/**
 * The rule a state file merges by.
 * @param {string} file  from the state root
 * @returns {MergeRule}
 */
function ruleOf(file) {
  if (file === LEDGER) return 'ledger';
  if (file === MIGRATIONS) return 'migrations';
  if (MANIFEST.test(file)) return 'manifest';
  return JSON_FILE.test(file) ? 'whole' : 'file';
}

/** @param {string} text @returns {string[]} */
function linesOf(text) {
  return text.split('\n').filter((line) => line.trim() !== '');
}

/**
 * The remote's text as it is, then each of this clone's lines whose key the
 * remote's lines lack, once each, in this clone's order.
 * @param {string} remote @param {string} local
 * @param {(line: string, side: string, number: number) => string} keyOf
 * @returns {string}
 */
function unionLines(remote, local, keyOf) {
  const held = new Set(linesOf(remote).map((line, i) => keyOf(line, 'remote', i + 1)));
  const added = [];
  for (const [i, line] of linesOf(local).entries()) {
    const key = keyOf(line, 'local', i + 1);
    if (held.has(key)) continue;
    held.add(key);
    added.push(`${line}\n`);
  }
  if (added.length === 0) return remote;
  const head = remote === '' || remote.endsWith('\n') ? remote : `${remote}\n`;
  return head + added.join('');
}

/**
 * A ledger line's id. Refuses a line that is not a JSON object with a
 * string id: a ledger holding one is not a ledger the merge can union.
 * @param {string} line @param {string} side @param {number} number
 * @returns {string}
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
    throw new MergeError(`cannot merge ${LEDGER}: line ${number} of ${where} is not an entry with an id: ${line.slice(0, 80)}`);
  }
  return entry.id;
}

/**
 * The ledgers merged: the remote's lines first, as they are, then this
 * clone's lines whose ids the remote lacks, in this clone's order.
 * @param {string} remote @param {string} local
 * @returns {string}
 */
function unionLedger(remote, local) {
  return unionLines(remote, local, entryId);
}

/**
 * The migrations records merged: one line per migration id, the remote's
 * first.
 * @param {string} remote @param {string} local
 * @returns {string}
 */
function unionMigrations(remote, local) {
  return unionLines(remote, local, (line) => line.trim());
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
 * remote's, then this clone's appended elements the remote's appended ones
 * lack, in order. Undefined where the ancestor held no list, or where either
 * side did anything but append.
 * @param {unknown} base @param {unknown} local @param {unknown} remote
 * @returns {unknown[]|undefined}
 */
function bothAppended(base, local, remote) {
  if (!Array.isArray(base) || !Array.isArray(local) || !Array.isArray(remote)) return undefined;
  if (!startsWith(local, base) || !startsWith(remote, base)) return undefined;
  const theirs = remote.slice(base.length);
  return [...remote, ...local.slice(base.length).filter((item) => !theirs.some((held) => same(held, item)))];
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
 * A choice's identity: the manifest it is in, whether it is on the branch or
 * between the working tree and the update, the field, and the two values,
 * whatever order their keys came in. A pick answers the choice with its
 * identity, and the screen carries it to the pick.
 * @param {Choice & {manifest: string, uncommitted: boolean}} choice
 * @returns {string}
 */
function choiceId({ manifest, uncommitted, field, local, remote }) {
  const named = JSON.stringify(canonical([manifest, uncommitted, field, local, remote]));
  return crypto.createHash('sha1').update(named).digest('hex').slice(0, 12);
}

/** @typedef {(choice: Choice) => 'local'|'remote'|null} PickOf */

/** @typedef {{conflicts: FieldConflict[], pickOf: PickOf}} FieldMerge */

/**
 * One field merged, recursing into objects both sides hold.
 * @param {unknown} base @param {unknown} local @param {unknown} remote
 * @param {string[]} field @param {FieldMerge} merge
 * @returns {unknown}
 */
function mergeValue(base, local, remote, field, merge) {
  if (same(local, remote) || same(local, base)) return remote;
  if (same(remote, base)) return local;
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
 * A manifest merged field by field against the common ancestor (undefined
 * where the manifest is new on both sides). Each conflict carries the pick
 * `pickOf` names for its choice, and takes it; a conflict with no pick takes
 * the remote's value for now, and stops the merge.
 * @param {unknown} base @param {Record<string, unknown>} local @param {Record<string, unknown>} remote
 * @param {PickOf} [pickOf]
 * @returns {{value: unknown, conflicts: FieldConflict[]}}
 */
function mergeManifest(base, local, remote, pickOf = () => null) {
  /** @type {FieldMerge} */
  const merge = { conflicts: [], pickOf };
  const value = mergeValue(base, local, remote, [], merge);
  return { value, conflicts: merge.conflicts };
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
 * @param {{pick: 'local'|'remote'|null}[]} conflicts
 * @returns {number}
 */
function askedAt(conflicts) {
  const open = conflicts.findIndex((c) => c.pick === null);
  return open === -1 ? conflicts.length - 1 : open;
}

module.exports = {
  LEDGER,
  MIGRATIONS,
  MergeError,
  ruleOf,
  unionLedger,
  unionMigrations,
  mergeManifest,
  choiceId,
  askedAt,
  conflictLabel,
};
