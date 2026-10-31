'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a work unit's creation — discovery's durability boundary as
// one transaction, in steps start this work composes with its own writes
// (start-this-work.cjs) and `workunit create` runs alone: check everything,
// write the unit (its manifest, imports, seeds — inbox items and roadmap
// items' notes — and first discovery log), register it, index what landed, commit. The engine never authors
// prose — `workunit create` installs the model-authored log verbatim.
//
// Validation is complete before any mutation: a missing import fails the
// whole call with `missing_imports` riding on the error so the calling flow
// can re-prompt and re-run, and a name already taken refuses outright —
// nothing is on disk until every input is legal. A write that fails
// part-way is undone: each seed back in the inbox, the unit's folder gone.
// The manifest write is the source of truth; the knowledge base is a derived
// index (warn-don't-block); the scoped commit comes last.
//
// The created manifest and its project-manifest registration reproduce the
// canonical work-unit document field-for-field — one on-disk shape.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  saveWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
  ensureContainer,
} = require('../kernel/manifest.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
const { parseInboxPaths, INBOX, SEED_SOURCES, ROADMAP_SEED } = require('./inbox.cjs');
const {
  normaliseBasename,
  dedupe,
  planImports,
  copyImports,
  importEntry,
  isIndexableImport,
  importArtifact,
  assertLandableSources,
} = require('./import-landing.cjs');
const { todayStamp, isoNow } = require('./dates.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const {
  VALID_WORK_TYPES,
  workUnitNameRefusal,
} = require('../kernel/manifest-schema.cjs');

/** A unit's first discovery log, unit-relative (8.1.4). */
const FIRST_LOG = 'discovery/session-001.md';

/**
 * Refuse a name `workUnitNameRefusal` refuses, for every verb that mints a
 * work unit (create, promote).
 * @param {string} workUnit
 */
function assertLegalWorkUnitName(workUnit) {
  const refusal = workUnitNameRefusal(workUnit);
  if (refusal !== null) throw new Error(refusal);
}

/**
 * @typedef {object} WorkUnitCreateResult
 * @property {string} work_unit
 * @property {string} work_type
 * @property {{path: string}[]} imports  landed imports (absolute)
 * @property {{path: string, source: string}[]} seeds  landed seeds (absolute)
 * @property {string[]} skipped_imports  source paths rejected by filename normalisation
 * @property {string} session_log  the installed log (absolute)
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]  set when committed is null
 * @property {string[]} warnings  non-blocking failures (knowledge-base indexing)
 */

/**
 * A roadmap item's note the unit starts from: the item's name and its note,
 * state-relative (4.11.16).
 * @typedef {{name: string, note: string}} NoteSeed
 */

/**
 * A seed as the unit's write landed it: its file name in `seeds/`, its
 * source, and the inbox path it moved from where it moved — a roadmap
 * item's note is copied, its item still naming it.
 * @typedef {{dest: string, source: string, back?: string}} SeedLanding
 */

/**
 * What a unit's write landed: its imports as copied, its seeds, and the
 * imports filename normalisation skipped.
 * @typedef {{importMoves: {src: string, dest: string}[], seeds: SeedLanding[], skippedImports: string[]}} Landed
 */

/**
 * Push onto a top-level manifest array field, creating it when absent — loud
 * when the field exists but is not an array (mirrors `engine manifest push`).
 * @param {Record<string, any>} manifest @param {string} field @param {unknown} value
 */
function pushEntry(manifest, field, value) {
  if (manifest[field] === undefined) manifest[field] = [];
  if (!Array.isArray(manifest[field])) throw new Error(`"${field}" is not an array`);
  manifest[field].push(value);
}

/** Whether a unit of the name exists. @param {string} cwd @param {string} workUnit */
function workUnitTaken(cwd, workUnit) {
  return fs.existsSync(path.join(stateRoot(cwd), workUnit, 'manifest.json'));
}

/**
 * Refuse, before anything is written, a unit that cannot be created: an
 * illegal type or name, a name a unit has already, an import that cannot
 * land, and a seed that is no live inbox item. Answers the seeds as inbox
 * items.
 * @param {string} cwd @param {string} workUnit @param {string} workType
 * @param {{imports?: string[], seeds?: string[]}} [landing]
 * @returns {import('./inbox.cjs').InboxItem[]}
 */
function checkWorkUnit(cwd, workUnit, workType, { imports = [], seeds = [] } = {}) {
  if (!VALID_WORK_TYPES.includes(workType)) {
    throw new Error(`Invalid work_type "${workType}". Must be one of: ${VALID_WORK_TYPES.join(', ')}`);
  }
  assertLegalWorkUnitName(workUnit);
  if (workUnitTaken(cwd, workUnit)) throw new Error(`work unit "${workUnit}" already exists — pick a different name`);
  assertLandableSources(cwd, imports);
  // Layout-validated live inbox paths; the folder carries the provenance tag.
  const seedItems = parseInboxPaths(cwd, seeds, { archived: false });
  // Read (and refuse corrupt JSON) before anything mutates; the registration
  // re-reads under the project lock after the work unit lands.
  readProjectManifest(cwd);
  return seedItems;
}

/**
 * Undo a unit's write: each seed that moved out of the inbox moved back,
 * then the unit's folder gone.
 * @param {string} cwd @param {string} workUnit @param {SeedLanding[]} seeds
 */
function unwriteWorkUnit(cwd, workUnit, seeds) {
  for (const { dest, back } of seeds) if (back !== undefined) fs.renameSync(statePath(cwd, workUnit, 'seeds', dest), statePath(cwd, back));
  fs.rmSync(path.join(stateRoot(cwd), workUnit), { recursive: true, force: true });
}

/**
 * Write a new unit, checked by `checkWorkUnit`, under its lock: its folder
 * and manifest, its imports copied into `imports/`, its inbox seeds moved
 * into `seeds/` and each roadmap item's note copied there, each recorded with
 * its source, so a cancel can put it back, and its first discovery log
 * holding `firstLog`, an epic's marked open — the sole work type with a
 * resumable discovery session. No
 * registration and no commit. A write that fails part-way is undone.
 * @param {string} cwd @param {string} workUnit @param {string} workType
 * @param {{description: string, firstLog: string, imports?: string[], seedItems?: import('./inbox.cjs').InboxItem[], noteSeeds?: NoteSeed[]}} unit
 * @returns {Landed}
 */
function writeWorkUnit(cwd, workUnit, workType, { description, firstLog, imports = [], seedItems = [], noteSeeds = [] }) {
  const wuDir = path.join(stateRoot(cwd), workUnit);
  /** @type {SeedLanding[]} */
  const seeds = [];
  fs.mkdirSync(wuDir, { recursive: true });
  try {
    return withWorkUnitLock(cwd, workUnit, () => {
      /** @type {Record<string, any>} */
      const manifest = {
        name: workUnit,
        work_type: workType,
        status: 'in-progress',
        created: todayStamp(),
        description,
        phases: {},
      };

      // Destination names, deduped against each directory and within the batch.
      const importsDir = path.join(wuDir, 'imports');
      const { planned: importPlan, skipped } = planImports(imports, importsDir);
      const seedsDir = path.join(wuDir, 'seeds');
      const takenSeeds = new Set();
      const seedPlan = [
        ...seedItems.map((item) => ({ from: item.rel, moves: true, source: SEED_SOURCES[item.folder] })),
        ...noteSeeds.map(({ name, note }) => ({ from: note, moves: false, source: `${ROADMAP_SEED}${name}` })),
      ].map((seed) => {
        const dest = dedupe(normaliseBasename(path.posix.basename(seed.from)) ?? 'seed.md', seedsDir, takenSeeds);
        takenSeeds.add(dest);
        return { ...seed, dest };
      });

      copyImports(cwd, importsDir, importPlan);
      // A new unit's files come in through discovery — every file it lands says so.
      for (const move of importPlan) pushEntry(manifest, 'imports', importEntry(move.dest, 'discovery'));

      if (seedPlan.length > 0) fs.mkdirSync(seedsDir, { recursive: true });
      for (const { from, moves, source, dest } of seedPlan) {
        if (moves) fs.renameSync(statePath(cwd, from), path.join(seedsDir, dest));
        else fs.copyFileSync(statePath(cwd, from), path.join(seedsDir, dest));
        seeds.push({ dest, source, ...(moves ? { back: from } : {}) });
        pushEntry(manifest, 'seeds', { path: `seeds/${dest}`, source, seeded_at: isoNow() });
      }

      fs.mkdirSync(path.join(wuDir, 'discovery'), { recursive: true });
      fs.writeFileSync(path.join(wuDir, FIRST_LOG), firstLog);
      if (workType === 'epic') {
        ensureContainer(ensureContainer(manifest, 'phases', 'phases'), 'discovery', 'phases.discovery').active_session = '001';
      }

      saveWorkUnitManifest(cwd, workUnit, manifest);
      return { importMoves: importPlan, seeds, skippedImports: skipped };
    });
  } catch (err) {
    unwriteWorkUnit(cwd, workUnit, seeds);
    throw err;
  }
}

/** The unit registered on the project manifest given. @param {Record<string, any>} project @param {string} workUnit @param {string} workType */
function registerWorkUnit(project, workUnit, workType) {
  ensureContainer(project, 'work_units', 'work_units')[workUnit] = { work_type: workType };
}

/**
 * The unit's imports and seeds indexed into the knowledge base,
 * warn-don't-block.
 * @param {string} cwd @param {string} workUnit @param {Landed} landed @param {string[]} warnings
 */
function indexLanded(cwd, workUnit, { importMoves, seeds }, warnings) {
  syncKnowledge(cwd, [
    ...importMoves.filter((m) => isIndexableImport(m.dest))
      .map((move) => ({ index: importArtifact(workUnit, move.dest), label: `knowledge index (imports/${move.dest})` })),
    ...seeds.map(({ dest }) => ({ index: `${workUnit}/seeds/${dest}`, label: `knowledge index (seeds/${dest})` })),
  ], warnings);
}

/**
 * What a commit of the new unit takes: the unit and the project manifest,
 * and the inbox where seeds moved out of it — their removal rides with their
 * new home.
 * @param {string} workUnit @param {Landed} landed @returns {string[]}
 */
function createdPaths(workUnit, { seeds }) {
  return [workUnit, PROJECT_MANIFEST_SPEC, ...(seeds.some(({ back }) => back !== undefined) ? [INBOX] : [])];
}

/** The landed seeds as a response names them. @param {string} cwd @param {string} workUnit @param {Landed} landed */
function landedSeeds(cwd, workUnit, { seeds }) {
  return seeds.map(({ dest, source }) => ({ path: statePath(cwd, workUnit, 'seeds', dest), source }));
}

/**
 * `workunit create`: the unit created from Claude's arguments — checked,
 * written, registered, indexed and committed, the session log installed
 * verbatim from `sessionLogFile`.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} workType
 * @param {object} opts
 * @param {string} opts.description       one-line intent, recorded at creation
 * @param {string} opts.sessionLogFile    model-authored log content, installed verbatim
 * @param {string[]} [opts.imports]       source paths to copy in
 * @param {string[]} [opts.seeds]         live inbox paths to move in
 * @returns {WorkUnitCreateResult}
 */
function createWorkUnit(cwd, workUnit, workType, { description, sessionLogFile, imports = [], seeds = [] }) {
  const seedItems = checkWorkUnit(cwd, workUnit, workType, { imports, seeds });
  /** @type {string} */
  let firstLog;
  try {
    firstLog = fs.readFileSync(path.resolve(cwd, sessionLogFile), 'utf8');
  } catch {
    throw new Error(`session log file not found: ${sessionLogFile}`);
  }

  const landed = writeWorkUnit(cwd, workUnit, workType, { description, firstLog, imports, seedItems });
  try {
    withProjectLock(cwd, () => {
      const project = readProjectManifest(cwd);
      registerWorkUnit(project, workUnit, workType);
      writeProjectManifestAtomic(cwd, project);
    });
  } catch (err) {
    unwriteWorkUnit(cwd, workUnit, landed.seeds);
    throw err;
  }

  /** @type {string[]} */
  const warnings = [];
  indexLanded(cwd, workUnit, landed, warnings);
  const outcome = commitStateTail(cwd, createdPaths(workUnit, landed), `discovery(${workUnit}): create work unit (${workType})`, warnings);

  /** @type {WorkUnitCreateResult} */
  const result = {
    work_unit: workUnit,
    work_type: workType,
    imports: landed.importMoves.map((move) => ({ path: statePath(cwd, workUnit, 'imports', move.dest) })),
    seeds: landedSeeds(cwd, workUnit, landed),
    skipped_imports: landed.skippedImports,
    session_log: statePath(cwd, workUnit, FIRST_LOG),
    committed: outcome.committed,
    warnings,
  };
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = {
  FIRST_LOG, createWorkUnit, assertLegalWorkUnitName, workUnitTaken, checkWorkUnit, writeWorkUnit, unwriteWorkUnit, registerWorkUnit, indexLanded, createdPaths, landedSeeds,
};
