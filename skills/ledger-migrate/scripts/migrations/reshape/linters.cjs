'use strict';

//
// The linters' carry onto the project's environment, which the move (078)
// runs over the state it wrote (E4). Released with it, it is frozen with it.
//
// The linters are part of the project's environment setup, on the project
// manifest as `environment.linters`, each `{name, command}`, and `fix`
// where it has a command that mends what it finds, where a brief reads
// them. Before Ledger they were recorded twice over: the project's
// `defaults.linters`, and each implementation topic's own `linters`, both
// arrays, an empty one a confirmed none. Each entry is a name (a string, or
// `{name}`), or a linter with the command that checks the code: `{name,
// command}`, `{name, detail}` as discovery recorded it, or `{name,
// lint_command}` as a session recorded it beside its `fix_command`, carried
// as its `fix`; a name alone is its command too.
//
// Where any of them holds an array, the project manifest gains
// `environment.linters`: the project's default linters first, then each
// topic's not already there, by name, units and topics in name order — an
// empty list where every array is empty. A project whose environment already
// records its linters keeps them. The old fields go: `defaults.linters`, the
// `defaults` object with it once empty, and every implementation topic's
// `linters`. An entry whose command a linter carried already runs, under
// its name or another, is that linter, and its fix that linter's where it
// has none. Named in the note handed back, for the migration's review: an
// entry of no shape above, not carried; a linter whose name is carried
// already with another command, not carried; an entry carried as the
// linter running its command; and whatever an entry held beyond its name,
// its command and its fix command — a scope, or a fix other than the one
// its linter carries — which the environment's linter has no room for, so
// the person sees it when ready to build asks them to confirm the setup.
//
// Each manifest is written whole or not at all, through a temp file beside
// it the state ignores; a unit manifest that cannot be read is no unit's.
//

const fs = require('fs');
const path = require('path');

// The keys an entry held its check command under, in the order one is taken.
const COMMAND_KEYS = ['lint_command', 'command', 'detail'];

/** How to change the linters recorded, the whole list written with `those` among it. @param {string} those */
const commandHelp = (those) => `read the linters recorded with \`node .claude/skills/ledger-engine/scripts/engine.cjs environment show\`, then record the whole list, ${those}, with \`node .claude/skills/ledger-engine/scripts/engine.cjs environment set linters\`, its JSON on stdin`;

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @param {unknown} v @returns {v is string} */
function isFilled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * A manifest written whole or not at all: through a temp file beside it, as
 * the engine names one, renamed into place.
 * @param {string} file @param {unknown} data
 */
function writeManifest(file, data) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, file);
}

/** @typedef {{name: string, command: string, fix?: string}} Linter */

// The key a session recorded a linter's fix command under.
const FIX_KEY = 'fix_command';

/**
 * A linter as the environment records it, and what the entry held beyond
 * it, each as `{name}'s {key} ({value})`; null for an entry of no shape a
 * linter was recorded in.
 * @param {unknown} entry @returns {{linter: Linter, beyond: string[]}|null}
 */
function linterOf(entry) {
  if (isFilled(entry)) return { linter: { name: entry.trim(), command: entry.trim() }, beyond: [] };
  if (!isObject(entry) || !isFilled(entry.name)) return null;
  const name = entry.name.trim();
  const key = COMMAND_KEYS.find((k) => isFilled(entry[k]));
  const fix = isFilled(entry[FIX_KEY]) ? { fix: entry[FIX_KEY].trim() } : {};
  const taken = ['name', key, ...(fix.fix === undefined ? [] : [FIX_KEY])];
  const beyond = Object.keys(entry).filter((k) => !taken.includes(k)).map((k) => `${name}'s ${k} (${JSON.stringify(entry[k])})`);
  return { linter: { name, command: key === undefined ? name : entry[key].trim(), ...fix }, beyond };
}

/**
 * Each unit's manifest in the state: its file and what it holds, in name
 * order; one that cannot be read is no unit's.
 * @param {string} state @returns {{file: string, manifest: Record<string, any>}[]}
 */
function unitManifests(state) {
  return fs.readdirSync(state, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
    .flatMap((name) => {
      const file = path.join(state, name, 'manifest.json');
      try {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        return isObject(manifest) ? [{ file, manifest }] : [];
      } catch {
        return [];
      }
    });
}

/** A unit's implementation topics, by name. @param {Record<string, any>} manifest @returns {Record<string, any>[]} */
function implementationTopics(manifest) {
  const items = isObject(manifest.phases) && isObject(manifest.phases.implementation) ? manifest.phases.implementation.items : null;
  if (!isObject(items)) return [];
  return Object.keys(items).sort().map((topic) => items[topic]).filter(isObject);
}

/**
 * What the carry left out.
 * @typedef {{uncarried: string[], clashing: string[], same: string[], beyond: string[]}} LeftOut
 */

/**
 * The linters of every list, each name and each command once, and what was
 * not carried.
 * @param {unknown[][]} lists
 * @returns {LeftOut & {linters: Linter[]}}
 */
function merged(lists) {
  /** @type {Map<string, Linter>} */
  const linters = new Map();
  const uncarried = [];
  const clashing = new Set();
  const same = new Set();
  const beyond = new Set();
  for (const entry of lists.flat()) {
    const read = linterOf(entry);
    if (read === null) {
      uncarried.push(JSON.stringify(entry));
      continue;
    }
    const { linter } = read;
    const carried = linters.get(linter.name);
    const running = [...linters.values()].find(({ command }) => command === linter.command);
    if (carried !== undefined && carried.command !== linter.command) {
      clashing.add(`${linter.name} (${linter.command})`);
      continue;
    }
    const kept = carried ?? running;
    if (kept === undefined) linters.set(linter.name, linter);
    else {
      if (carried === undefined) same.add(`${linter.name} as ${kept.name}`);
      if (kept.fix === undefined && linter.fix !== undefined) kept.fix = linter.fix;
      else if (linter.fix !== undefined && linter.fix !== kept.fix) beyond.add(`${linter.name}'s ${FIX_KEY} (${JSON.stringify(linter.fix)})`);
    }
    for (const left of read.beyond) beyond.add(left);
  }
  return { linters: [...linters.values()], uncarried, clashing: [...clashing], same: [...same], beyond: [...beyond] };
}

/**
 * The note for the migration's review naming what the carry left out, or
 * null where it left nothing out.
 * @param {LeftOut} left
 * @returns {string|null}
 */
function noteOf({ uncarried, clashing, same, beyond }) {
  const dropped = [
    ...(uncarried.length === 0 ? [] : [`These linter entries were not carried into environment.linters, being of no shape a linter was recorded in: ${uncarried.join(', ')}.`]),
    ...(clashing.length === 0 ? [] : [`These linters were not carried into environment.linters, a linter of the same name being carried already with another command: ${clashing.join(', ')}.`]),
  ];
  const notes = [
    ...(dropped.length === 0 ? [] : [`${dropped.join(' ')} Add each still wanted: ${commandHelp('those added')}.`]),
    ...(same.length === 0 ? [] : [`These linters were carried into environment.linters as the linter carried already that runs their command, under its name: ${same.join(', ')}.`]),
    ...(beyond.length === 0 ? [] : [`The linters were carried into environment.linters as a name, a command and a fix command, which leaves out ${beyond.join(', ')}. Change a linter's command where any is still wanted, when ready to build asks to confirm the project's setup, or now: ${commandHelp('those changed')}.`]),
  ];
  return notes.length === 0 ? null : notes.join(' ');
}

/**
 * Carry the linters in the state at `state` onto the project's environment
 * (the header's).
 * @param {string} state
 * @returns {string|null} the note naming what was left out, for the migration's review
 */
function carryLinters(state) {
  const projectFile = path.join(state, 'manifest.json');
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));

  /** @type {unknown[][]} */
  const lists = [];
  const defaults = isObject(project.defaults) ? project.defaults : null;
  const projectChanged = defaults !== null && 'linters' in defaults;
  if (projectChanged) {
    if (Array.isArray(defaults.linters)) lists.push(defaults.linters);
    delete defaults.linters;
    if (Object.keys(defaults).length === 0) delete project.defaults;
  }
  const units = unitManifests(state).filter(({ manifest }) => {
    let changed = false;
    for (const item of implementationTopics(manifest)) {
      if (!('linters' in item)) continue;
      if (Array.isArray(item.linters)) lists.push(item.linters);
      delete item.linters;
      changed = true;
    }
    return changed;
  });

  const environment = isObject(project.environment) ? project.environment : {};
  const carries = lists.length > 0 && !('linters' in environment);
  const carried = carries ? merged(lists) : { linters: [], uncarried: [], clashing: [], same: [], beyond: [] };
  if (carries) project.environment = { ...environment, linters: carried.linters };

  if (projectChanged || carries) writeManifest(projectFile, project);
  for (const { file, manifest } of units) writeManifest(file, manifest);
  return noteOf(carried);
}

module.exports = { carryLinters };
