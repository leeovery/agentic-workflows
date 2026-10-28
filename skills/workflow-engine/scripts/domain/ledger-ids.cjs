'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's ids (5.2). Every entry is named by a nanoid —
// random, never a sequence, so two writers appending at once never collide
// (5.2.2) — and shown by a short form of it, the way git shows a short hash
// (5.2.1):
//
// - An id is 21 characters of the 62 letters and digits, drawn from Node's
//   crypto without bias: 125 bits. Letters and digits alone, so a short id
//   is one word in prose and never reads as a command's option.
// - Its short form is its shortest prefix no other id in the ledger shares,
//   and never shorter than 6 characters.
// - A prefix given back resolves as git resolves a short hash: to the one id
//   it begins, refused where it begins none, or several, or is shorter than
//   4 characters.
// ---------------------------------------------------------------------------

const crypto = require('crypto');

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 21;
const ID_PATTERN = new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`);
const SHORT_MIN = 6;
const PREFIX_MIN = 4;

// The largest multiple of the alphabet's size a byte can hold: a byte at or
// above it is drawn again, so every character is as likely as every other.
const UNBIASED_BELOW = 256 - (256 % ID_ALPHABET.length);

/** A new entry's id. @returns {string} */
function newId() {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.randomBytes(ID_LENGTH * 2)) {
      if (byte >= UNBIASED_BELOW) continue;
      id += ID_ALPHABET[byte % ID_ALPHABET.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

/** @param {unknown} value @returns {value is string} */
function isId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/** How many characters two ids share at their start. @param {string} a @param {string} b */
function sharedStart(a, b) {
  let n = 0;
  while (n < a.length && a[n] === b[n]) n += 1;
  return n;
}

/** An id cut one character past the longest start it shares with another, never under `SHORT_MIN`. @param {string} id @param {number} shared */
function cut(id, shared) {
  return id.slice(0, Math.max(SHORT_MIN, shared + 1));
}

/**
 * Every id's short form: one character past the longest start it shares
 * with any other id, and never under `SHORT_MIN`. Ids next to each other in
 * sorted order share the longest starts, so only neighbours are compared.
 * @param {Iterable<string>} ids
 * @returns {Map<string, string>}
 */
function shortIds(ids) {
  const sorted = [...new Set(ids)].sort();
  /** @type {Map<string, string>} */
  const shorts = new Map();
  sorted.forEach((id, i) => {
    const shared = Math.max(i > 0 ? sharedStart(id, sorted[i - 1]) : 0, i + 1 < sorted.length ? sharedStart(id, sorted[i + 1]) : 0);
    shorts.set(id, cut(id, shared));
  });
  return shorts;
}

/**
 * One id's short form among `ids`, as `shortIds` gives it, the ids read once
 * and none held.
 * @param {string} id @param {Iterable<string>} ids
 * @returns {string}
 */
function shortId(id, ids) {
  let shared = 0;
  for (const other of ids) if (other !== id) shared = Math.max(shared, sharedStart(id, other));
  return cut(id, shared);
}

/**
 * The id `prefix` names among `ids`. Refuses a prefix shorter than
 * `PREFIX_MIN`, one no id begins, and one several begin.
 * @param {string} prefix @param {Iterable<string>} ids
 * @returns {string}
 */
function resolveId(prefix, ids) {
  if (prefix.length < PREFIX_MIN) throw new Error(`"${prefix}" is too short to name a ledger entry — give at least ${PREFIX_MIN} characters of its id`);
  const named = new Set();
  for (const id of ids) if (id.startsWith(prefix)) named.add(id);
  if (named.size === 0) throw new Error(`no ledger entry's id begins "${prefix}"`);
  if (named.size > 1) throw new Error(`"${prefix}" is ambiguous: ${named.size} ledger entries' ids begin with it — give more of the id`);
  return /** @type {string} */ (named.values().next().value);
}

module.exports = { ID_LENGTH, newId, isId, shortIds, shortId, resolveId };
