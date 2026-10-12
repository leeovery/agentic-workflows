'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the legacy research split's source scan — which of an epic's
// migration-seeded broad research files qualify for decomposition, which
// would qualify but carry a name the split cannot process, and which a
// crashed apply left mid-split. Pure over the work unit's manifest and its
// research files: the split skill's detector and the engine's display of
// its findings read the one derivation.
// ---------------------------------------------------------------------------

const path = require('path');
const { fileExists } = require('./reads.cjs');
const { phaseItems } = require('./derivations.cjs');

// Theme/source names become engine dot-path segments and research filenames.
// The engine rejects dots/slashes; the canonical map name is kebab. A source
// whose name breaks this can never be split (apply fails at the sentinel set),
// so it surfaces as unsplittable rather than re-offering it every epic open.
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * @typedef {object} LegacySources
 * @property {string[]} qualifying_sources  in-progress, migration-seeded, research-routed sources, sorted
 * @property {{name: string, reason: string}[]} unsplittable  would qualify, but the name breaks dot-path addressing
 * @property {string[]} stranded_sentinels  map items a crashed apply left carrying `legacy_split_state`
 */

/**
 * One discovery item's place in the scan, or null when it is not a candidate.
 * @param {string} cwd @param {string} workUnit @param {Map<string, {status?: string}>} researchByName
 * @param {{name: string, source?: string, routing?: string, legacy_split_state?: string}} item
 * @returns {'stranded'|'unsplittable'|'qualifying'|null}
 */
function classify(cwd, workUnit, researchByName, item) {
  // A set sentinel means a prior apply set it and never cleared it (only
  // possible via a hard crash between the sentinel write and the source-item
  // delete) — otherwise the item is invisible: excluded here and its
  // file/research already renamed away.
  if (item.legacy_split_state) return 'stranded';
  if (!(item.source || '').includes('migration-seeded') || item.routing !== 'research') return null;
  const research = researchByName.get(item.name);
  if (!research || research.status !== 'in-progress') return null;
  if (!fileExists(path.join(cwd, '.workflows', workUnit, 'research', `${item.name}.md`))) return null;
  return NAME_RE.test(item.name) ? 'qualifying' : 'unsplittable';
}

/**
 * The split's source scan over one epic manifest.
 * @param {string} cwd  project root
 * @param {object} manifest  the epic's manifest
 * @returns {LegacySources}
 */
function legacySources(cwd, manifest) {
  const researchByName = new Map(phaseItems(manifest, 'research').map((it) => [it.name, it]));
  /** @type {LegacySources} */
  const found = { qualifying_sources: [], unsplittable: [], stranded_sentinels: [] };
  for (const item of phaseItems(manifest, 'discovery')) {
    const place = classify(cwd, manifest.name, researchByName, item);
    if (place === 'stranded') found.stranded_sentinels.push(item.name);
    if (place === 'qualifying') found.qualifying_sources.push(item.name);
    if (place === 'unsplittable') {
      found.unsplittable.push({ name: item.name, reason: `name must match ${NAME_RE.source} (engine dot-paths reject dots/slashes)` });
    }
  }
  found.qualifying_sources.sort();
  found.unsplittable.sort((a, b) => a.name.localeCompare(b.name));
  found.stranded_sentinels.sort();
  return found;
}

module.exports = { legacySources };
