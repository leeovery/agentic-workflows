'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the work-type commit — discovery's durability boundary as one
// transaction: create the work unit, land imports, land the inbox seeds,
// install the model-authored session log, commit. The engine never authors
// prose — the session log's content arrives finished via a file and is
// installed verbatim.
//
// Validation is complete before any mutation: a missing import fails the
// whole call with `missing_imports` riding on the error so the calling flow
// can re-prompt and re-run, and a name already taken refuses outright —
// nothing is on disk until every input is legal.
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
const { commitTailPathspec, noteCommitOutcome } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');
const { parseInboxPath } = require('./inbox.cjs');
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
const {
  VALID_WORK_TYPES,
  VALID_PHASES,
  RESERVED_WORK_UNIT_NAMES,
} = require('../kernel/manifest-schema.cjs');

/** Seed provenance tag per inbox folder. */
const SEED_SOURCES = { ideas: 'inbox:idea', bugs: 'inbox:bug', quickfixes: 'inbox:quickfix' };

/**
 * Refuse an illegal work-unit name — dots and slashes break manifest
 * addressing, phase names collide with dot-path segments, and reserved names
 * route to the project manifest. One rule for every verb that mints a work
 * unit (create, promote).
 * @param {string} workUnit
 */
function assertLegalWorkUnitName(workUnit) {
  if (workUnit.includes('.') || workUnit.includes('/')) {
    throw new Error(`Work unit name "${workUnit}" must not contain dots or slashes`);
  }
  if (VALID_PHASES.includes(workUnit)) {
    throw new Error(`Work unit name "${workUnit}" conflicts with a phase name`);
  }
  if (RESERVED_WORK_UNIT_NAMES.includes(workUnit)) {
    throw new Error(`Work unit name "${workUnit}" is reserved`);
  }
}

/**
 * @typedef {object} WorkUnitCreateResult
 * @property {string} work_unit
 * @property {string} work_type
 * @property {{path: string}[]} imports  landed import entries (work-unit-relative)
 * @property {{path: string, source: string}[]} seeds  landed seed entries (work-unit-relative)
 * @property {string[]} skipped_imports  source paths rejected by filename normalisation
 * @property {string|null} session_log  the installed log's project-relative path (null when no log was given)
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]  set when committed is null
 * @property {string[]} warnings  non-blocking failures (knowledge-base indexing)
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

/**
 * The work-type commit: create the work unit (manifest + project-manifest
 * registration; a name already taken refuses), copy imports into `imports/`,
 * move inbox seeds into `seeds/` (both manifest-tracked and KB-indexed,
 * warn-don't-block), install the session log verbatim as `session-001.md`
 * (epic also gets the `active_session` marker), and commit scoped to the work
 * unit and the project manifest, plus the inbox when seeds moved out of it.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} workType
 * @param {object} opts
 * @param {string} opts.description       one-line intent, recorded at creation
 * @param {string} [opts.sessionLogFile]  model-authored log content, installed verbatim;
 *                                        omitted for creations outside discovery (e.g. spec promotion)
 * @param {string[]} [opts.imports]       source paths to copy in
 * @param {string[]} [opts.seeds]         live inbox paths to move in
 * @returns {WorkUnitCreateResult}
 */
function createWorkUnit(cwd, workUnit, workType, { description, sessionLogFile, imports = [], seeds = [] }) {
  // -- validate everything before any mutation --------------------------------
  if (!VALID_WORK_TYPES.includes(workType)) {
    throw new Error(`Invalid work_type "${workType}". Must be one of: ${VALID_WORK_TYPES.join(', ')}`);
  }
  assertLegalWorkUnitName(workUnit);

  const wuDir = path.join(cwd, '.workflows', workUnit);
  if (fs.existsSync(path.join(wuDir, 'manifest.json'))) {
    throw new Error(`work unit "${workUnit}" already exists — pick a different name`);
  }

  /** @type {string|null} */
  let sessionLog = null;
  if (sessionLogFile !== undefined) {
    try {
      sessionLog = fs.readFileSync(path.resolve(cwd, sessionLogFile), 'utf8');
    } catch {
      throw new Error(`session log file not found: ${sessionLogFile}`);
    }
  }

  assertLandableSources(cwd, imports);

  // Layout-validated live inbox paths; the folder carries the provenance tag.
  const seedItems = seeds.map((p) => {
    const item = parseInboxPath(p, { archived: false });
    if (!fs.existsSync(path.join(cwd, item.given))) {
      throw new Error(`inbox file not found: "${item.given}"`);
    }
    return item;
  });

  // Read (and refuse corrupt JSON) before anything mutates; the registration
  // itself re-reads under the project lock after the work unit lands.
  readProjectManifest(cwd);

  // -- mutate: files + one manifest save under the work unit's lock, then the
  // -- project registration under its own lock, then KB, then the commit -----
  fs.mkdirSync(wuDir, { recursive: true });
  const { importMoves, seedMoves, skippedImports } = withWorkUnitLock(cwd, workUnit, () => {
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
    /** @type {{item: import('./inbox.cjs').InboxItem, dest: string}[]} */
    const seedPlan = [];
    const takenSeeds = new Set();
    for (const item of seedItems) {
      const name = normaliseBasename(item.file) ?? 'seed.md';
      const dest = dedupe(name, seedsDir, takenSeeds);
      takenSeeds.add(dest);
      seedPlan.push({ item, dest });
    }

    copyImports(cwd, importsDir, importPlan);
    // The opener is discovery's own door — every file it lands says so.
    for (const move of importPlan) {
      pushEntry(manifest, 'imports', importEntry(move.dest, 'discovery'));
    }

    if (seedPlan.length > 0) fs.mkdirSync(seedsDir, { recursive: true });
    for (const move of seedPlan) {
      fs.renameSync(path.join(cwd, move.item.given), path.join(seedsDir, move.dest));
      pushEntry(manifest, 'seeds', {
        path: `seeds/${move.dest}`,
        source: SEED_SOURCES[/** @type {keyof typeof SEED_SOURCES} */ (move.item.folder)],
        seeded_at: isoNow(),
      });
    }

    if (sessionLog !== null) {
      const sessionsDir = path.join(wuDir, 'discovery', 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(path.join(sessionsDir, 'session-001.md'), sessionLog);

      // Epic is the sole work type with a resumable discovery session loop.
      if (workType === 'epic') {
        const phases = ensureContainer(manifest, 'phases', 'phases');
        ensureContainer(phases, 'discovery', 'phases.discovery').active_session = '001';
      }
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { importMoves: importPlan, seedMoves: seedPlan, skippedImports: skipped };
  });
  const sessionLogPath = sessionLog !== null ? `.workflows/${workUnit}/discovery/sessions/session-001.md` : null;

  withProjectLock(cwd, () => {
    const projectManifest = readProjectManifest(cwd);
    ensureContainer(projectManifest, 'work_units', 'work_units')[workUnit] = { work_type: workType };
    writeProjectManifestAtomic(cwd, projectManifest);
  });

  /** @type {string[]} */
  const warnings = [];
  for (const move of importMoves.filter((m) => isIndexableImport(m.dest))) {
    knowledge(cwd, ['index', importArtifact(workUnit, move.dest)], `knowledge index (imports/${move.dest})`, warnings);
  }
  for (const move of seedMoves) {
    knowledge(cwd, ['index', `.workflows/${workUnit}/seeds/${move.dest}`], `knowledge index (seeds/${move.dest})`, warnings);
  }

  // Seed removals ride along in the same commit as their new home, and the
  // project-manifest registration lands with it too.
  const pathspecs = [`.workflows/${workUnit}`, '.workflows/manifest.json'];
  if (seedMoves.length > 0) pathspecs.push('.workflows/.inbox');
  const outcome = commitTailPathspec(cwd, pathspecs, `discovery(${workUnit}): create work unit (${workType})`, warnings);

  /** @type {WorkUnitCreateResult} */
  const result = {
    work_unit: workUnit,
    work_type: workType,
    imports: importMoves.map((move) => ({ path: `imports/${move.dest}` })),
    seeds: seedMoves.map((move) => ({
      path: `seeds/${move.dest}`,
      source: SEED_SOURCES[/** @type {keyof typeof SEED_SOURCES} */ (move.item.folder)],
    })),
    skipped_imports: skippedImports,
    session_log: sessionLogPath,
    committed: outcome.committed,
    warnings,
  };
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { createWorkUnit, assertLegalWorkUnitName };
