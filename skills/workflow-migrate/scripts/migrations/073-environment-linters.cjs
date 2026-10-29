'use strict';

//
// Migration 073: The linters move to the project's environment
//
// The linters are part of the project's environment setup, on the project
// manifest as `environment.linters`, each `{name, command}`, where a brief
// reads them. Until now they were recorded twice over: the project's
// `defaults.linters`, and each implementation topic's own `linters`, both
// arrays, an empty one a confirmed none. Each entry is a name (a string, or
// `{name}`), or a linter with its command (`{name, command}`, or `{name,
// detail}` as discovery recorded it); a name alone is its command too.
//
// Where any of them holds an array, the project manifest gains
// `environment.linters`: the project's default linters first, then each
// topic's not already there, by name, units and topics in name order — an
// empty list where every array is empty. A project whose environment already
// records its linters keeps them. The old fields go: `defaults.linters`, the
// `defaults` object with it once empty, and every implementation topic's
// `linters`. An entry of no shape above is not carried, and named in the
// verification addendum.
//
// The state is `.leeway/` in the repository's main checkout, found through
// git's common directory, wherever in the repository the migration runs; a
// folder in no repository, or one with no state, has nothing to move.
//
// Idempotent: once moved, no old field is left to carry.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATE_DIR = '.leeway';

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @param {unknown} v @returns {v is string} */
function isFilled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** @param {unknown} data */
function jsonText(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * The state folder of the repository `projectDir` is in, or null where it
 * is in none, has no main checkout, or holds no state.
 * @param {string} projectDir @returns {string|null}
 */
function stateDir(projectDir) {
  const res = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: projectDir, encoding: 'utf8' });
  if (res.error || res.status !== 0) return null;
  let common;
  try {
    common = fs.realpathSync(path.resolve(projectDir, res.stdout.trim()));
  } catch {
    return null;
  }
  if (path.basename(common) !== '.git') return null;
  const state = path.join(path.dirname(common), STATE_DIR);
  return fs.existsSync(path.join(state, 'manifest.json')) ? state : null;
}

/**
 * A linter as the environment records it, or null for an entry of no shape
 * a linter was recorded in.
 * @param {unknown} entry @returns {{name: string, command: string}|null}
 */
function linterOf(entry) {
  if (isFilled(entry)) return { name: entry.trim(), command: entry.trim() };
  if (!isObject(entry) || !isFilled(entry.name)) return null;
  const command = [entry.command, entry.detail].find(isFilled) ?? entry.name;
  return { name: entry.name.trim(), command: command.trim() };
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

/** A unit's implementation topics, by name. @param {Record<string, any>} manifest @returns {[string, Record<string, any>][]} */
function implementationTopics(manifest) {
  const items = isObject(manifest.phases) && isObject(manifest.phases.implementation) ? manifest.phases.implementation.items : null;
  if (!isObject(items)) return [];
  return Object.keys(items).sort().filter((topic) => isObject(items[topic])).map((topic) => [topic, items[topic]]);
}

module.exports = {
  id: '073',
  description: 'move the linters onto the project\'s environment — environment.linters, each {name, command} — from the project default and each implementation topic',
  info: 'The linters were recorded as the project manifest\'s defaults.linters and as each implementation topic\'s linters. This migration writes them once, as environment.linters on the project manifest, each {name, command} — the project default first, then any linter a topic adds, by name; a name alone is its command too — unless the environment already records its linters, and removes both old fields. An entry of an unknown shape is not carried.',
  run({ projectDir, reportUpdate, reportSkip }) {
    const state = stateDir(projectDir);
    if (state === null) {
      reportSkip();
      return undefined;
    }
    const projectFile = path.join(state, 'manifest.json');
    let project;
    try {
      project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    } catch {
      reportSkip();
      return undefined;
    }
    if (!isObject(project)) {
      reportSkip();
      return undefined;
    }

    /** @type {unknown[][]} */
    const lists = [];
    /** @type {string[]} */
    const uncarried = [];
    const defaults = isObject(project.defaults) ? project.defaults : null;
    const projectChanged = defaults !== null && 'linters' in defaults;
    if (projectChanged) {
      if (Array.isArray(defaults.linters)) lists.push(defaults.linters);
      delete defaults.linters;
      if (Object.keys(defaults).length === 0) delete project.defaults;
    }
    const units = unitManifests(state).filter(({ manifest }) => {
      let changed = false;
      for (const [, item] of implementationTopics(manifest)) {
        if (!('linters' in item)) continue;
        if (Array.isArray(item.linters)) lists.push(item.linters);
        delete item.linters;
        changed = true;
      }
      return changed;
    });

    const environment = isObject(project.environment) ? project.environment : {};
    const carries = lists.length > 0 && !('linters' in environment);
    if (carries) {
      /** @type {Map<string, {name: string, command: string}>} */
      const linters = new Map();
      for (const entry of lists.flat()) {
        const linter = linterOf(entry);
        if (linter === null) uncarried.push(JSON.stringify(entry));
        else if (!linters.has(linter.name)) linters.set(linter.name, linter);
      }
      project.environment = { ...environment, linters: [...linters.values()] };
    }

    if (!projectChanged && !carries && units.length === 0) {
      reportSkip();
      return undefined;
    }
    if (projectChanged || carries) {
      fs.writeFileSync(projectFile, jsonText(project));
      reportUpdate();
    }
    for (const { file, manifest } of units) {
      fs.writeFileSync(file, jsonText(manifest));
      reportUpdate();
    }
    return uncarried.length === 0 ? undefined : {
      verify: `These linter entries were not carried into environment.linters, being of no shape a linter was recorded in: ${uncarried.join(', ')}. Add any still wanted to environment.linters as {name, command}.`,
    };
  },
};
