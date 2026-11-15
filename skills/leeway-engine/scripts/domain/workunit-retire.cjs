'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a cross-cutting unit leaving the registry — `workunit retire
// <unit>`, the cut and the merges' (21.7.3, 21.7.5, 19.6.7).
//
// - When: only while the migration runs (state-worktree.cjs's
//   `migrationRuns`), so its commit is held for the migration's.
// - What: a unit of a type the reshape retires. Its folder moves whole to
//   `.product/assets/{unit}/` — its manifest, the specs the move kept as its
//   assets, its topics' logs — as reference, nothing of it deleted; it comes
//   off the registry, its name free for a unit made later; and each map row
//   and item of a topic an epic promoted to it go from that epic, the
//   topic's record being the unit's (P4). A source of the roadmap's under
//   its folder follows its file, and its cache is purged.
// - Its ledger lines stay: one `rehomed` line carries every line read in the
//   unit to the product's place (ledger-rehomed.cjs), each file they cite or
//   link at the path the move took it to. Every read takes them as the
//   product's from then on: the product record shows the unit's
//   product-wide entries — the records directive carries each finding and
//   decision of a cross-cutting unit's product-wide — and `ledger product`
//   its questions, open or answered, the product's (21.7.5); no unit's
//   record or copy shows any of them, so the knowledge base drops the
//   unit's copies as they go, and a unit made later under the name meets
//   none.
// - Once: each step is one a redo repeats or finds done — the carry, of the
//   lines the ledger still reads in the unit; the folder's move; each
//   epic's promoted topic; the registry and the roadmap's sources — so a
//   session killed part-way finishes on its next run, the unit found at
//   `.product/assets/{unit}/` once its folder has moved. Every run renders
//   the ledger's copies at its end, so a redo renders those a run killed
//   before them left behind.
// - It refuses, writing nothing: outside the migration; a name that is no
//   unit's, or a unit neither in the state nor moved; a unit of a type the
//   reshape keeps; `.product/assets/{unit}` held already beside the unit's
//   own folder; and lines to carry with no session to tag the carry with.
// - Known edges: a roadmap item joined to the unit keeps its join, which
//   names no unit once it has gone; and a folder the move left in the epic
//   for a topic it promoted stays where it is.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, readProjectManifest, writeProjectManifestAtomic, withProjectLock, listWorkUnitManifests,
} = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { LEGACY_WORK_TYPES, TOPIC_PHASES, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { withStateLock, assertMigrationRuns } = require('./state-worktree.cjs');
const { appendEntry, commitLedger, carrying } = require('./ledger.cjs');
const { PRODUCT } = require('./ledger-events.cjs');
const { linesOf, movedFiles } = require('./workunit-absorb.cjs');
const { roadmapItems } = require('./derivations.cjs');
const { carrySources } = require('./roadmap.cjs');
const { PRODUCT_DIR } = require('./layout.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { refreshLedgerCopies } = require('./ledger-copies.cjs');
const { purgeWorkUnitCache } = require('./cache.cjs');

const SAID = 'workunit retire';

/**
 * @typedef {object} WorkUnitRetireResult
 * @property {string} work_unit
 * @property {string} kept  where its folder is kept now (absolute)
 * @property {number} carried  how many of its ledger lines this run carried to the product's place
 * @property {{work_unit: string, topic: string}[]} promoted  each epic's topic promoted to it, gone from that epic
 * @property {{item: string, from: string, to: string}[]} [roadmap_sources_rewritten]  roadmap sources that followed its files
 * @property {string|null} committed  short commit sha, or null — held while the migration runs
 * @property {string} [note]
 * @property {string[]} warnings
 */

/** Where a retired unit's folder is kept, state-relative. @param {string} unit */
const keptAt = (unit) => path.posix.join(PRODUCT_DIR, 'assets', unit);

/** The manifest at `{folder}/manifest.json` in the state, or null where there is none. @param {string} root @param {string} folder */
function manifestIn(root, folder) {
  const file = path.join(root, folder, 'manifest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * The unit as the retire finds it: its manifest, in its own folder or, a
 * retire cut short, where its folder moved.
 * @param {string} root @param {string} unit @returns {Record<string, any>}
 */
function unitToRetire(root, unit) {
  const misnamed = workUnitNameRefusal(unit);
  if (misnamed !== null) throw new Error(`${SAID}: ${misnamed}`);
  const here = manifestIn(root, unit);
  if (here !== null && fs.existsSync(path.join(root, keptAt(unit)))) {
    throw new Error(`${SAID}: ${keptAt(unit)} is held already, so ${unit}'s folder has nowhere to go`);
  }
  const manifest = here ?? manifestIn(root, keptAt(unit));
  if (manifest === null) throw new Error(`${SAID}: there is no work unit "${unit}"`);
  if (!Object.hasOwn(LEGACY_WORK_TYPES, manifest.work_type)) {
    throw new Error(`${SAID}: ${unit}'s type, ${manifest.work_type}, is one the reshape keeps — only a unit of a type it retires leaves the registry`);
  }
  return manifest;
}

/**
 * The unit's lines the ledger still reads in it, carried to the product's
 * place, each file they name where the move takes it: how many.
 * @param {string} root @param {string} unit @param {string[]} warnings
 */
function carryToProduct(root, unit, warnings) {
  const { ids, files } = linesOf(root, unit, warnings);
  if (ids.length === 0) return 0;
  const session = handedSession();
  if (session === null) throw new Error(`${SAID}: ${unit} holds ledger entries, which the retire carries to the product's place in this conversation — Claude Code hands every command it runs a session id, and this one has none`);
  appendEntry(root, {
    event: 'rehomed', unit: PRODUCT, topic: null, phase: 'discovery', session, lines: ids, files: movedFiles(files, [[unit, keptAt(unit)]]),
  }, warnings);
  return ids.length;
}

/** The unit's folder moved whole to where it is kept, where it is still in the state. @param {string} root @param {string} unit */
function moveFolder(root, unit) {
  if (!fs.existsSync(path.join(root, unit))) return;
  fs.mkdirSync(path.join(root, PRODUCT_DIR, 'assets'), { recursive: true });
  fs.renameSync(path.join(root, unit), path.join(root, keptAt(unit)));
}

/** A phase's items on a manifest, or {}. @param {Record<string, any>} manifest @param {string} phase @returns {Record<string, any>} */
const itemsIn = (manifest, phase) => (isObject(manifest.phases?.[phase]?.items) ? manifest.phases[phase].items : {});

/** The topics a manifest's discussion promoted to `unit`. @param {Record<string, any>} manifest @param {string} unit */
const promotedTo = (manifest, unit) => Object.entries(itemsIn(manifest, 'discussion'))
  .filter(([, item]) => isObject(item) && item.status === 'promoted' && item.promoted_to === unit).map(([topic]) => topic);

/**
 * Each epic's topic promoted to the unit gone from it: its item in every
 * phase a topic holds one, its map row among them.
 * @param {string} cwd @param {string} unit @returns {{work_unit: string, topic: string}[]}
 */
function dropPromoted(cwd, unit) {
  return listWorkUnitManifests(cwd).filter((manifest) => promotedTo(manifest, unit).length > 0).flatMap(({ name }) => withWorkUnitLock(cwd, name, () => {
    const manifest = loadWorkUnitManifest(cwd, name);
    const topics = promotedTo(manifest, unit);
    for (const topic of topics) for (const phase of TOPIC_PHASES) delete itemsIn(manifest, phase)[topic];
    saveWorkUnitManifest(cwd, name, manifest);
    return topics.map((topic) => ({ work_unit: name, topic }));
  }));
}

/**
 * The unit off the registry, and each roadmap source under its folder
 * following its file, in one write where either changes: the sources
 * rewritten.
 * @param {string} cwd @param {string} unit
 */
function deregister(cwd, unit) {
  return withProjectLock(cwd, () => {
    const project = readProjectManifest(cwd);
    const registered = isObject(project.work_units) && Object.hasOwn(project.work_units, unit);
    if (registered) delete project.work_units[unit];
    const { rewritten } = carrySources(roadmapItems(project), [[unit, keptAt(unit)]]);
    if (registered || rewritten.length > 0) writeProjectManifestAtomic(cwd, project);
    return rewritten;
  });
}

/**
 * `workunit retire <unit>`: a cross-cutting unit's lines carried to the
 * product's place, its folder kept whole in the product's assets, each
 * epic's topic promoted to it gone, and the unit off the registry, the
 * commit held for the migration's (the header's).
 * @param {string} cwd @param {string} unit
 * @returns {WorkUnitRetireResult}
 */
function retireWorkUnit(cwd, unit) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    assertMigrationRuns(root, SAID, 'a unit leaves the registry');
    return withStateLock(root, () => {
      unitToRetire(root, unit);
      const carried = carryToProduct(root, unit, warnings);
      moveFolder(root, unit);
      const promoted = dropPromoted(cwd, unit);
      const rewritten = deregister(cwd, unit);
      purgeWorkUnitCache(cwd, unit);
      const paths = [unit, keptAt(unit), PROJECT_MANIFEST_SPEC, ...new Set(promoted.map(({ work_unit: epic }) => epic))];
      const message = `workflow(${unit}): retire to the product's assets`;
      const outcome = carried > 0 ? commitLedger(cwd, message, warnings, paths) : commitStateTail(cwd, paths, message, warnings);
      refreshLedgerCopies(cwd, warnings);
      /** @type {WorkUnitRetireResult} */
      const result = { work_unit: unit, kept: statePath(cwd, keptAt(unit)), carried, promoted, committed: outcome.committed, warnings };
      if (rewritten.length > 0) result.roadmap_sources_rewritten = rewritten;
      noteCommitOutcome(result, outcome);
      return result;
    });
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { retireWorkUnit, keptAt };
