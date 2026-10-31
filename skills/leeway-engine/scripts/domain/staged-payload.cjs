'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a gate's payload staged in the cache — Claude's JSON read from
// `--file`, its shape checked, written where the gate's yes reads it back, so
// the yes writes from the staged copy and never from its arguments; and the
// refusals each opening on the command that refused.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');

/** A non-empty string. @param {unknown} v @returns {v is string} */
function filled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Refuses an object whose keys are not `keys`, with any of `optional`.
 * @param {unknown} v @param {string} what @param {string[]} keys @param {string[]} [optional]
 * @returns {Record<string, unknown>}
 */
function shaped(v, what, keys, optional = []) {
  const given = isObject(v) ? Object.keys(v) : null;
  if (given === null || !keys.every((key) => given.includes(key)) || !given.every((key) => keys.includes(key) || optional.includes(key))) {
    throw new Error(`${what} must be {${[...keys, ...optional.map((key) => `${key}?`)].join(', ')}}`);
  }
  return /** @type {Record<string, unknown>} */ (v);
}

/** Refuses anything but a list, naming it as `what`. @param {unknown} v @param {string} what @returns {unknown[]} */
function listed(v, what) {
  if (!Array.isArray(v)) throw new Error(`${what} is a list`);
  return v;
}

/** Claude's payload read from `file`. @param {string} cwd @param {string} file @returns {unknown} */
function readPayload(cwd, file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  } catch (err) {
    throw new Error(`the payload ${file} cannot be read as JSON — ${messageOf(err)}`);
  }
}

/** Write `staged` where the gate's yes reads it back. @template T @param {string} file absolute @param {T} staged @returns {T} */
function stage(file, staged) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, staged);
  return staged;
}

/** What is staged at `file`, refused with `none` where nothing is. @param {string} file absolute @param {string} none @returns {unknown} */
function stagedAt(file, none) {
  if (!fs.existsSync(file)) throw new Error(none);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** A refusal opening on the command that refused, what it carries kept. @param {string} said @param {unknown} err */
function refusedAs(said, err) {
  const refused = err instanceof Error ? err : new Error(messageOf(err));
  if (!refused.message.startsWith(`${said}: `)) refused.message = `${said}: ${refused.message}`;
  return refused;
}

/** `answer`'s answer, its refusal opening on `said`. @template T @param {string} said @param {() => T} answer @returns {T} */
function refusing(said, answer) {
  try {
    return answer();
  } catch (err) {
    throw refusedAs(said, err);
  }
}

module.exports = { filled, shaped, listed, readPayload, stage, stagedAt, refusedAs, refusing };
