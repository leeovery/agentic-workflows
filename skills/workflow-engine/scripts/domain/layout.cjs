'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the layout on disk (4.11) — every place the workflows keep
// under `.leeway/`, one table with one reader, `layoutPlace`; `isLog` asks
// it for the logs. The layout hook refuses Claude's write to any path the
// table has no place for (layout-hook.cjs, 6.2.3), and it and the hook
// before Bash a write to a file only the engine writes (shell-guard.cjs),
// each for the reason `engineRefusal` gives.
//
// A place is a row: its path, state-relative, as 4.11.17's tree draws it,
// and its kind —
//   file    one file;
//   free    a folder whose contents are named by whoever fills it: the
//           assets, a spike, the seeds, an experiment's data, the cache;
//   engine  a file only the engine writes — the manifests, the ledger, the
//           record of the person's review of the spec — with what it is and
//           the verb that writes it, where one does;
//   log     a log a session writes to, which a state commit takes along
//           (6.3.2).
// A path's names are literal but for its placeholders: `{unit}` a unit's
// name, `{slug}` and `{area}`, each a kebab-case slug; `{topic}` a topic's
// name, which holds no dot; `{N}`, `{n}` and `{m}` a whole number from 1;
// `{NNN}` three digits or more; `{task}` a task as screens show it,
// `{phase}.{n}`; `{YYYY-MM-DD}` a date; and `{a,b}` one of the names listed.
// Whatever a placeholder matches, it matches in lower case too, and the
// literal names are spelled by `fold`, so a path matches as `fold` spells
// it: in lower case where the filesystem ignores case (`folding`).
//
// The tracker's store is the task driver's to name (7.1.10): its places are
// the files each shipped task driver keeps on the state branch.
//
// Today's places (`TODAY`) are the paths today's engine and prose still
// write, until step 2 moves each writer into 4.11's layout. Each names the
// phase whose rewrite retires it; 29.17 empties the list. None is a log:
// today's session logs keep their own commits.
// ---------------------------------------------------------------------------

const { ignoresCase } = require('../kernel/state-root.cjs');
const { KEBAB_SLUG } = require('../kernel/manifest-schema.cjs');

/** @typedef {'file'|'free'|'engine'|'log'} PlaceKind */

/**
 * A place in the layout. `sets` is the spec's line that sets one of 4.11's,
 * `retires` the phase that retires one of today's; an engine-only file has
 * `what` it is, and `verb`, the engine's verb that writes it, where one does.
 * @typedef {{kind: PlaceKind, path: string, sets?: string, retires?: string, what?: string, verb?: string}} Place
 */

/** @typedef {(name: string) => string} Fold */

const WHOLE = '[1-9][0-9]*';

/** What each placeholder in a path stands for. */
const PLACEHOLDERS = Object.freeze({
  unit: KEBAB_SLUG,
  slug: KEBAB_SLUG,
  area: KEBAB_SLUG,
  topic: '[^/.]+',
  N: WHOLE,
  n: WHOLE,
  m: WHOLE,
  NNN: '[0-9]{3,}',
  task: `${WHOLE}\\.${WHOLE}`,
  'YYYY-MM-DD': '[0-9]{4}-[0-9]{2}-[0-9]{2}',
});

/** @param {PlaceKind} kind @param {string} path @param {string} sets @returns {Place} */
const place = (kind, path, sets) => Object.freeze({ kind, path, sets });

/** @param {string} path @param {string} sets @param {string} what @param {string} [verb] @returns {Place} */
const engineFile = (path, sets, what, verb) => Object.freeze({ kind: 'engine', path, sets, what, ...(verb === undefined ? {} : { verb }) });

/** @param {string} retires @param {PlaceKind} kind @param {string} path @returns {Place} */
const todays = (retires, kind, path) => Object.freeze({ kind, path, retires });

/** 4.11's places, the tracker's store aside. @type {readonly Place[]} */
const LAYOUT = Object.freeze([
  place('file', '.git', '4.1.2'),
  place('file', '.gitignore', '4.11.3'),
  place('file', '.lock', '4.3.1'),
  engineFile('manifest.json', '4.11.3', 'the project manifest', 'manifest set|push|pull|delete'),
  engineFile('.ledger.jsonl', '5.7.1', 'the ledger', 'ledger ask|find|decide|replace|hold|move|merge'),
  place('file', '.inbox/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md', '4.11.16'),
  place('file', '.inbox/.archived/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md', '4.11.16'),
  place('log', '.product/sessions/session-{NNN}.md', '4.11.16'),
  place('file', '.product/notes/{YYYY-MM-DD}--{slug}.md', '4.11.16'),
  place('free', '.product/spikes/{NNN}-{slug}', '4.11.16'),
  place('free', '.product/assets', '4.11.16'),
  place('file', '.state/migrations', '4.7.4'),
  place('free', '.knowledge', '4.11.10'),
  place('free', '.cache', '4.11.3'),
  engineFile('{unit}/manifest.json', '4.11.5', 'a unit\'s manifest', 'manifest set|push|pull|delete|apply'),
  place('log', '{unit}/discovery/session-{NNN}.md', '4.11.5'),
  place('free', '{unit}/seeds', '4.11.16'),
  place('file', '{unit}/topics/{topic}/brief.md', '4.11.5'),
  place('log', '{unit}/topics/{topic}/log.md', '4.11.5'),
  place('file', '{unit}/topics/{topic}/mail/{NNN}-{slug}.md', '4.11.5'),
  place('file', '{unit}/topics/{topic}/experiments/E{n}-{slug}/{problem,design,report}.md', '4.11.15'),
  place('free', '{unit}/topics/{topic}/experiments/E{n}-{slug}/data', '4.11.15'),
  place('file', '{unit}/topics/{topic}/experiments/E{n}-{slug}/E{n}.{m}-{slug}/{problem,design,report}.md', '4.11.15'),
  place('free', '{unit}/topics/{topic}/experiments/E{n}-{slug}/E{n}.{m}-{slug}/data', '4.11.15'),
  place('free', '{unit}/assets', '4.11.5'),
  place('free', '{unit}/spikes/{NNN}-{slug}', '9.10.10'),
  place('file', '{unit}/spec.md', '4.11.5'),
  engineFile('{unit}/spec-review.json', '4.11.5', 'a unit\'s record of the person\'s review of its spec'),
  place('file', '{unit}/summary.md', '4.11.6'),
  place('log', '{unit}/build/log.md', '4.11.5'),
  place('file', '{unit}/build/notes.md', '4.11.5'),
  place('file', '{unit}/build/tasks/{task}.md', '4.11.5'),
  place('file', '{unit}/build/tasks/{task}/round-{N}-{a,b}.md', '4.11.5'),
  place('file', '{unit}/build/phases/phase-{N}/review-{a,b}.md', '4.11.5'),
  place('file', '{unit}/build/phases/phase-{N}/{area}-{a,b}.md', '4.11.5'),
  place('file', '{unit}/build/runs/{n}.S{m}/run-{NNN}.json', '4.11.15'),
  place('file', '{unit}/review/round-{N}.md', '4.11.5'),
  place('file', '{unit}/review/round-{N}-checks.md', '4.11.5'),
]);

/** Today's places, each with the phase that retires it. @type {readonly Place[]} */
const TODAY = Object.freeze([
  todays('29.11', 'file', '{unit}/research/{topic}.md'),
  todays('29.11', 'file', '{unit}/discussion/{topic}.md'),
  todays('29.11', 'file', '{unit}/{research,discussion,investigation}/.mailbox/{topic}/{NNN}-{slug}.md'),
  todays('29.11', 'free', '{unit}/experiment/{topic}'),
  todays('29.12', 'file', '{unit}/discovery/sessions/session-{NNN}.md'),
  todays('29.12', 'file', '{unit}/discovery/briefs/{topic}.md'),
  todays('29.12', 'file', '.roadmap/sessions/session-{NNN}.md'),
  todays('29.12', 'free', '.roadmap/imports'),
  todays('29.12', 'free', '.baseline'),
  todays('29.13', 'free', '{unit}/.state'),
  todays('29.14', 'free', '{unit}/implementation/{topic}'),
  todays('29.14', 'free', '{unit}/review/{topic}'),
  todays('29.14', 'file', '.state/environment-setup.md'),
  todays('29.15', 'file', '{unit}/investigation/{topic}.md'),
  todays('29.15', 'free', '{unit}/specification/{topic}'),
  todays('29.15', 'free', '{unit}/planning/{topic}'),
  todays('29.15', 'free', '{unit}/imports'),
  todays('29.16', 'file', '.roadmap/notes/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md'),
]);

/** A name spelled as written. @type {Fold} */
const AS_WRITTEN = (name) => name;

/** A name spelled as a filesystem that ignores case reads it. @type {Fold} */
const IN_LOWER_CASE = (name) => name.toLowerCase();

/**
 * How names are spelled on the filesystem the existing `folder` is on: in
 * lower case where it ignores case.
 * @param {string} folder @returns {Fold}
 */
function folding(folder) {
  return ignoresCase(folder) ? IN_LOWER_CASE : AS_WRITTEN;
}

/** @type {Place[]|null} */
let places = null;

/** Every place: 4.11's, the tracker's store's, then today's. */
function everyPlace() {
  if (places === null) places = [...LAYOUT, ...storePlaces(), ...TODAY];
  return places;
}

/** The files each shipped task driver keeps on the state branch. @returns {Place[]} */
function storePlaces() {
  // Loaded at the first read, not with the module: the loader reads every
  // shipped driver from disk.
  const { listDrivers } = require('./drivers.cjs');
  const drivers = /** @type {import('./drivers.cjs').TaskDriver[]} */ (listDrivers('task'));
  return drivers.flatMap((driver) => driver.storeFiles().map((file) => place('file', file, '7.5.2')));
}

/** @param {string} text */
const escaped = (text) => text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');

/**
 * The pattern one part of a path stands for: a placeholder's, a list's
 * names, or the literal names, spelled by `fold`.
 * @param {string} part @param {Fold} fold
 */
function partPattern(part, fold) {
  if (!part.startsWith('{')) return escaped(fold(part));
  const inner = part.slice(1, -1);
  if (inner.includes(',')) return `(?:${inner.split(',').map((name) => escaped(fold(name))).join('|')})`;
  if (!Object.hasOwn(PLACEHOLDERS, inner)) throw new Error(`layout: no placeholder {${inner}}`);
  return `(?:${PLACEHOLDERS[/** @type {keyof typeof PLACEHOLDERS} */ (inner)]})`;
}

/**
 * What a place matches, its names spelled by `fold`: the path itself, or
 * for a free folder, any path below it.
 * @param {Place} at @param {Fold} fold @returns {RegExp}
 */
function placePattern({ kind, path }, fold) {
  const named = path.split(/(\{[^}]*\})/).filter((part) => part !== '').map((part) => partPattern(part, fold)).join('');
  return new RegExp(`^${named}${kind === 'free' ? '(?:/[^/]+)+' : ''}$`);
}

/** @type {WeakMap<Fold, {at: Place, pattern: RegExp}[]>} */
const patterns = new WeakMap();

/** Every place with its pattern under `fold`. @param {Fold} fold */
function patternsFor(fold) {
  let made = patterns.get(fold);
  if (made === undefined) {
    made = everyPlace().map((at) => ({ at, pattern: placePattern(at, fold) }));
    patterns.set(fold, made);
  }
  return made;
}

/**
 * The place the state-relative path `rel` is in, or null where the layout
 * has none. Names are compared as `fold` spells them: as written, unless
 * the filesystem the path is on ignores case.
 * @param {string} rel @param {Fold} [fold]
 * @returns {Place|null}
 */
function layoutPlace(rel, fold = AS_WRITTEN) {
  const spelled = fold(rel);
  return patternsFor(fold).find(({ pattern }) => pattern.test(spelled))?.at ?? null;
}

/**
 * Whether the state-relative path `rel` is one of the layout's logs, its
 * names compared as `layoutPlace` compares them.
 * @param {string} rel @param {Fold} [fold]
 */
function isLog(rel, fold = AS_WRITTEN) {
  return layoutPlace(rel, fold)?.kind === 'log';
}

/**
 * Why a write to the state-relative `rel`, at the place `at`, is refused as
 * a file only the engine writes, naming the verb that writes it where one
 * does; null where `at` is no such file, or none.
 * @param {Place|null} at @param {string} rel
 * @returns {string|null}
 */
function engineRefusal(at, rel) {
  if (at?.kind !== 'engine') return null;
  return `${at.what} (${rel}) changes only through the engine's commands${at.verb === undefined ? '' : ` — engine ${at.verb}`}`;
}

module.exports = { LAYOUT, TODAY, AS_WRITTEN, IN_LOWER_CASE, folding, layoutPlace, isLog, engineRefusal };
