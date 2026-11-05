'use strict';

// ---------------------------------------------------------------------------
// What the board's suites share (test-engine-board*.cjs and the pipeline
// simulations) to hold the mod's fixtures to the engine's answers: a
// fixture by its name (`fixture`), a value's shape (`shapeOf`), and where
// two shapes part (`misfits`). A fixture compared is one holding at least
// one of each list, and so is the world's answer, each suite asserting it
// (`emptyLists`), since an empty list fits any shape. And where a unit
// stands on every view that reads it (`standingOn`).
// ---------------------------------------------------------------------------

const path = require('path');
const { pathToFileURL } = require('url');

/** The mod's fixtures, which its tests import and which can import nothing outside the mod's folder or named other than as code. */
const FIXTURES = path.join(__dirname, '../../skills/leeway-gates/tests/fixtures');

/** A fixture module of the mod's, by its file's name. @param {string} name @returns {Promise<any>} */
async function fixtureModule(name) {
  return import(pathToFileURL(path.join(FIXTURES, name)).href);
}

/** A fixture of the mod's, its default export, by its file's name. @param {string} name @returns {Promise<any>} */
async function fixture(name) {
  return (await fixtureModule(name)).default;
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

/**
 * Each list a value's shape holds with no entry, by its path: where every
 * one of them is empty, a shape compared there compares nothing.
 * @param {unknown} value @returns {string[]}
 */
function emptyLists(value) {
  /** @param {any} shape @param {string} at @returns {string[]} */
  const empty = (shape, at) => {
    if (Array.isArray(shape)) return shape.length === 0 ? [at] : empty(shape[0], `${at}[]`);
    if (shape !== null && typeof shape === 'object') return Object.entries(shape).flatMap(([key, held]) => empty(held, `${at}.${key}`));
    return [];
  };
  return empty(shapeOf(value), '');
}

/**
 * Where a unit stands on every view that reads it, from `board`, a suite's
 * read of the board for its args: on its tab, the phase it is in — an
 * epic's page its two stages — and what waits on the person there, each by
 * its kind and id and the page it opens; its row on All work and the total
 * waiting there; and the banner's state and what it says waits, flagged or
 * not.
 * @param {(args: string[]) => any} board @param {string} unit
 */
function standingOn(board, unit) {
  const { view: tab, banner } = board(['--tab', 'unit', '--unit', unit]);
  const all = board(['--tab', 'all']).view;
  const { phase, standing, waiting } = all.units.find((/** @type {{unit: string}} */ line) => line.unit === unit);
  const now = tab.kind === 'epic'
    ? { spec: tab.spec.state, build: tab.build.state }
    : (({ state, words }) => ({ state, words }))(tab.phases.find((/** @type {{phase: string}} */ held) => held.phase === tab.now.phase));
  return {
    tab: { now: tab.now.phase, ...now, waiting: tab.waiting.map((/** @type {{kind: string, id: string, page: string|null}} */ { kind, id, page }) => `${kind} ${id}${page === null ? '' : ` → ${page}`}`) },
    all: { phase, standing, waiting, total: all.waiting },
    banner: { state: banner.state, waits: banner.facts.filter((/** @type {{needs: boolean, waits?: true}} */ fact) => fact.needs || fact.waits).map((/** @type {{text: string, needs: boolean}} */ fact) => `${fact.needs ? '⚑ ' : ''}${fact.text}`) },
  };
}

module.exports = { fixture, fixtureModule, shapeOf, misfits, emptyLists, standingOn };
