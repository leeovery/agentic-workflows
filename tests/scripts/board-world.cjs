'use strict';

// ---------------------------------------------------------------------------
// What the board's suites share (test-engine-board.cjs,
// test-engine-board-review.cjs) to hold the mod's fixtures to the engine's
// answers: a fixture by its name (`fixture`), a value's shape (`shapeOf`),
// and where two shapes part (`misfits`). A fixture compared is one holding
// at least one of each list, and so is the world's answer, each suite
// asserting it, since an empty list fits any shape.
// ---------------------------------------------------------------------------

const path = require('path');
const { pathToFileURL } = require('url');

/** The mod's fixtures, which its tests import and which can import nothing outside the mod's folder or named other than as code. */
const FIXTURES = path.join(__dirname, '../../skills/leeway-gates/tests/fixtures');

/** A fixture of the mod's, by its file's name. @param {string} name @returns {Promise<any>} */
async function fixture(name) {
  return (await import(pathToFileURL(path.join(FIXTURES, name)).href)).default;
}

/** Two shapes as one: an object's keys from both, an empty list or a null taking the other's. @param {any} a @param {any} b @returns {any} */
function merged(a, b) {
  if (a === 'null' || (Array.isArray(a) && a.length === 0)) return b;
  if (b === 'null' || (Array.isArray(b) && b.length === 0)) return a;
  if (Array.isArray(a)) return [merged(a[0], b[0])];
  if (typeof a === 'object') return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((key) => [key, merged(a[key] ?? 'null', b[key] ?? 'null')]));
  return a;
}

/** A value's shape: each object's keys, every element of a list as one, each leaf's type. @param {unknown} value @returns {unknown} */
function shapeOf(value) {
  if (Array.isArray(value)) return value.length === 0 ? [] : [value.map(shapeOf).reduce(merged)];
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, held]) => [key, shapeOf(held)]));
  return value === null ? 'null' : typeof value;
}

/**
 * Where two values' shapes part, each by its path: a key one holds and the
 * other lacks, or a leaf of another type. A null or an empty list fits
 * whatever the other holds, for a fixture draws a state the engine's world
 * may hold none of.
 * @param {unknown} a @param {unknown} b @returns {string[]}
 */
function misfits(a, b) {
  /** @param {any} x @param {any} y @param {string} at @returns {string[]} */
  const apart = (x, y, at) => {
    if (x === 'null' || y === 'null' || (Array.isArray(x) && x.length === 0) || (Array.isArray(y) && y.length === 0)) return [];
    if (Array.isArray(x) && Array.isArray(y)) return apart(x[0], y[0], `${at}[]`);
    if (typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      return [...new Set([...Object.keys(x), ...Object.keys(y)])].sort().flatMap((key) => (key in x && key in y ? apart(x[key], y[key], `${at}.${key}`) : [`${at}.${key}`]));
    }
    return JSON.stringify(x) === JSON.stringify(y) ? [] : [at];
  };

  return apart(shapeOf(a), shapeOf(b), '');
}

module.exports = { fixture, shapeOf, misfits };
