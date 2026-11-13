'use strict';

//
// Migration 075: The legacy split's detection
//
// Step 2 of the reshape's sequence opens (21.2, 21.4): broad research that
// migration 038 seeded onto an epic's map, still in progress, is cut into
// topic-sized research files and map items, the person interviewed per file
// (076, the directive) and each plan applied by code (077). Written against
// today's shape, the shape the chain up to 072 leaves, it walks every epic
// in `.workflows/` in the project's folder in the main checkout — its
// working tree, which holds what the chain changed there — and finds the
// sources that qualify, as the split found them when it was a skill run on
// opening an epic: in an epic in progress, an item of its map that 038
// seeded (its `source` naming `migration-seeded`), routed to research, whose
// research item is in progress and whose file, `research/{name}.md`, is
// there, its name one a topic can take.
//
// It writes the sources to the split's staging in the state
// (reshape/split.cjs), whole, and nothing else. Where none qualifies it
// writes nothing: the directive's check then answers no piece, and the
// runner records the directive unrun, the person seeing no interview
// (21.4.3). A project in no repository, with no `.workflows/`, or whose
// `leeway-state` has a commit has nothing to detect.
//
// Known edges, not built:
//   - a source a split of today's skill left part-way, `legacy_split_state`
//     set on its map item, qualifies for nothing and moves as it stands;
//   - a source whose name a topic cannot take qualifies for nothing and
//     moves whole, as today's split could not process it either.
//

const fs = require('fs');
const path = require('path');
const { writeWhole } = require('./reshape/shared.cjs');
const { NAME, isObject, itemsOf, isFile, jsonText, sourcesFile, stampOf, splitting } = require('./reshape/split.cjs');

/** @param {string} file @returns {Record<string, any>} */
function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the legacy split cannot read ${file} — fix it, then run again: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * The epic's sources that qualify, sorted; none for any other unit.
 * @param {string} unitDir @param {Record<string, any>} manifest @returns {string[]}
 */
function qualifying(unitDir, manifest) {
  if (manifest.work_type !== 'epic' || manifest.status !== 'in-progress') return [];
  const research = itemsOf(manifest.phases?.research);
  return Object.entries(itemsOf(manifest.phases?.discovery))
    .filter(([name, item]) => isObject(item)
      && !item.legacy_split_state
      && typeof item.source === 'string' && item.source.includes('migration-seeded')
      && item.routing === 'research'
      && research[name]?.status === 'in-progress'
      && isFile(path.join(unitDir, 'research', `${name}.md`))
      && NAME.test(name))
    .map(([name]) => name)
    .sort();
}

/**
 * Each epic's sources that qualify, by the epic's name, sorted; an epic
 * with none left out.
 * @param {string} from the project's `.workflows/` @returns {Record<string, string[]>}
 */
function sourcesIn(from) {
  const units = fs.readdirSync(from, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && isFile(path.join(from, entry.name, 'manifest.json')))
    .map((entry) => entry.name)
    .sort();
  return Object.fromEntries(units.map((unit) => [unit, qualifying(path.join(from, unit), readManifest(path.join(from, unit, 'manifest.json')))])
    .filter(([, sources]) => sources.length > 0));
}

module.exports = {
  id: '075',
  description: 'detect the legacy split\'s sources: in each epic in progress, broad research migration 038 seeded onto its map and still in progress, written to the split\'s staging in the state',
  /** @param {{projectDir: string, reportUpdate: () => void, reportSkip: () => void}} ctx */
  run({ projectDir, reportUpdate, reportSkip }) {
    const where = splitting(projectDir);
    const epics = where === null ? {} : sourcesIn(where.from);
    if (where === null || Object.keys(epics).length === 0) {
      reportSkip();
      return;
    }
    writeWhole(path.join(where.state, '.cache'), sourcesFile(where.state), jsonText({ at: stampOf(new Date()), epics }));
    reportUpdate();
  },
};
