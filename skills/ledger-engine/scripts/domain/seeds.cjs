'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery's seeds — what it is handed, comma-joined, by the
// handoff into it and its entry alike. In the product's conversation they
// start new work: live inbox paths and waiting roadmap items,
// `roadmap:{item}` (8.1.8). Into an epic's discovery they are waiting
// roadmap ideas joining it as topics (18.8.4), refused where the pull would
// refuse them: a bug or a quick-fix, which starts work of its own, and an
// epic past its spec, whose map is closed (18.4.19). Both are checked here
// once, so nothing travels that the entry would refuse.
//
// What the entry names to read of them (18.8.15): each inbox seed, and each
// roadmap seed's note and the logs its other sources point at — and only
// those, no session log beside them — or, into an epic, each item to take
// in.
// ---------------------------------------------------------------------------

const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { readProjectManifest, loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { parseInboxPaths, ROADMAP_SEED } = require('./inbox.cjs');
const { roadmapSeedRefusal, roadmapItems } = require('./derivations.cjs');
const { becomesTopic, isNote } = require('./roadmap.cjs');
const { assertBeforeSpec } = require('./spec-standing.cjs');

/** @typedef {import('./enter.cjs').Line} Line */

/**
 * The seeds, split: the inbox paths, and the roadmap items by name.
 * @param {string} seeds comma-joined @returns {{inbox: string[], roadmap: string[]}}
 */
function splitSeeds(seeds) {
  const all = seeds.split(',');
  return {
    inbox: all.filter((seed) => !seed.startsWith(ROADMAP_SEED)),
    roadmap: all.filter((seed) => seed.startsWith(ROADMAP_SEED)).map((seed) => seed.slice(ROADMAP_SEED.length)),
  };
}

/**
 * Refuses seeds discovery could not take at `home`, `product` or an epic in
 * progress: a quote, which seeds cannot travel with; for new work, an inbox
 * path not live or a roadmap item not waiting; into an epic, anything but a
 * waiting roadmap idea, or an epic past its spec.
 * @param {string} cwd @param {string} home @param {string} seeds comma-joined
 */
function assertSeeds(cwd, home, seeds) {
  if (seeds.includes('"')) throw new Error(`seeds travel quoted — a seed cannot hold a double quote: ${seeds}`);
  const { inbox, roadmap } = splitSeeds(seeds);
  if (home !== PRODUCT && inbox.length > 0) {
    throw new Error(`an inbox item starts new work, never joins an existing epic — only a waiting roadmap idea joins "${home}": got "${inbox[0]}"`);
  }
  if (inbox.length > 0) parseInboxPaths(cwd, inbox, { archived: false });
  const project = readProjectManifest(cwd);
  const refusal = roadmapSeedRefusal(project, roadmap);
  if (refusal !== null) throw new Error(refusal);
  if (home === PRODUCT) return;
  const items = roadmapItems(project);
  const work = roadmap.find((name) => !becomesTopic(items[name]));
  if (work !== undefined) {
    throw new Error(`roadmap item "${work}" is a ${items[work].kind} — only an idea joins an epic; a bug or a quick-fix starts work of its own, through w on the roadmap`);
  }
  assertBeforeSpec(cwd, loadWorkUnitManifest(cwd, home), 'pull');
}

/**
 * What the entry names to read of the seeds at `home`: for new work, each
 * inbox seed, and each roadmap seed by name with its note and the logs its
 * other sources point at; into an epic, each item to take in.
 * @param {string} cwd @param {string} home @param {string} seeds comma-joined
 * @returns {Line[]}
 */
function seedReads(cwd, home, seeds) {
  const { inbox, roadmap } = splitSeeds(seeds);
  if (home !== PRODUCT) return roadmap.map((name) => ['take in', name]);
  const items = roadmapItems(readProjectManifest(cwd));
  return [
    ...parseInboxPaths(cwd, inbox, { archived: false }).map(({ rel }) => /** @type {Line} */ (['seed', statePath(cwd, rel)])),
    ...roadmap.flatMap((name) => /** @type {Line[]} */ ([
      ['roadmap seed', name],
      ...(items[name].sources ?? []).map((/** @type {string} */ source) => [isNote(source) ? 'note' : 'source', statePath(cwd, source)]),
    ])),
  ];
}

module.exports = { assertSeeds, seedReads };
