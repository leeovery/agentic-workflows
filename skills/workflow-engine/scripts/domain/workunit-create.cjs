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
// can re-prompt and re-run — nothing is on disk until every input is legal.
// The manifest write is the source of truth; the knowledge base is a derived
// index (warn-don't-block); the scoped commit comes last.
//
// The created manifest and its project-manifest registration reproduce the
// manifest CLI's `init` field-for-field — one on-disk shape, two writers.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  saveWorkUnitManifest,
  loadWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
} = require('../kernel/manifest.cjs');
const { commitScopedWithKb } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');
const { parseInboxPath } = require('./inbox.cjs');
const {
  VALID_WORK_TYPES,
  VALID_PHASES,
  RESERVED_WORK_UNIT_NAMES,
} = require('../kernel/manifest-schema.cjs');

/** Seed provenance tag per inbox folder. */
const SEED_SOURCES = { ideas: 'inbox:idea', bugs: 'inbox:bug', quickfixes: 'inbox:quickfix' };

/**
 * @typedef {object} WorkUnitCreateResult
 * @property {string} work_unit
 * @property {string} work_type
 * @property {boolean} created  false when the manifest already existed (reused as-is, never overwritten)
 * @property {{path: string}[]} imports  landed import entries (work-unit-relative)
 * @property {{path: string, source: string}[]} seeds  landed seed entries (work-unit-relative)
 * @property {string[]} skipped_imports  source paths rejected by filename normalisation
 * @property {string|null} session_log  the installed log's project-relative path (null when no log was given)
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]  set when committed is null
 * @property {string[]} warnings  non-blocking failures (knowledge-base indexing)
 */

/** ISO-8601 UTC to the second (`2026-07-15T09:30:00Z`). */
function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Normalise a source basename into a landing filename: lowercase; runs of
 * whitespace and non-alphanumerics (other than `.` and `-`) to `-`; repeats
 * collapsed; leading/trailing `-` trimmed; `.md` ensured. Returns null when
 * the result is a dotfile (`.`, `..`, leading `.`) — the caller decides
 * whether that skips the file or falls back to a safe name.
 * @param {string} basename
 * @returns {string|null}
 */
function normaliseBasename(basename) {
  let name = basename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name.endsWith('.md')) name += '.md';
  if (name === '.' || name === '..' || name.startsWith('.')) return null;
  return name;
}

/**
 * A collision-free destination name: suffix the stem with `-2`, `-3`, … until
 * unique against both the destination directory and the batch so far. The
 * batch check keeps a source path given twice from silently overwriting.
 * @param {string} name normalised filename ending in `.md`
 * @param {string} destDir absolute destination directory
 * @param {Set<string>} taken names already chosen in this batch
 * @returns {string}
 */
function dedupe(name, destDir, taken) {
  /** @param {string} n */
  const clashes = (n) => taken.has(n) || fs.existsSync(path.join(destDir, n));
  if (!clashes(name)) return name;
  const stem = name.slice(0, -'.md'.length);
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}.md`;
    if (!clashes(candidate)) return candidate;
  }
}

/**
 * Push onto a top-level manifest array field, creating it when absent — loud
 * when the field exists but is not an array (mirrors manifest.cjs `push`).
 * @param {Record<string, any>} manifest @param {string} field @param {unknown} value
 */
function pushEntry(manifest, field, value) {
  if (manifest[field] === undefined) manifest[field] = [];
  if (!Array.isArray(manifest[field])) throw new Error(`"${field}" is not an array`);
  manifest[field].push(value);
}

/**
 * The work-type commit: create the work unit (manifest + project-manifest
 * registration, exactly as `manifest.cjs init` writes them — reused as-is
 * when it already exists), copy imports into `imports/`, move inbox seeds
 * into `seeds/` (both manifest-tracked and KB-indexed, warn-don't-block),
 * install the session log verbatim as `session-001.md` (epic also gets the
 * `active_session` marker), and commit scoped to the work unit plus the
 * inbox when seeds moved out of it.
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
  if (workUnit.includes('.') || workUnit.includes('/')) {
    throw new Error(`Work unit name "${workUnit}" must not contain dots or slashes`);
  }
  if (VALID_PHASES.includes(workUnit)) {
    throw new Error(`Work unit name "${workUnit}" conflicts with a phase name`);
  }
  if (RESERVED_WORK_UNIT_NAMES.includes(workUnit)) {
    throw new Error(`Work unit name "${workUnit}" is reserved`);
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

  const missing = imports.filter((p) => !fs.existsSync(path.resolve(cwd, p)));
  if (missing.length > 0) {
    const err = /** @type {Error & {payload: Record<string, unknown>}} */ (
      new Error(`import path(s) not found: ${missing.join(', ')}`)
    );
    err.payload = { missing_imports: missing };
    throw err;
  }

  // Layout-validated live inbox paths; the folder carries the provenance tag.
  const seedItems = seeds.map((p) => {
    const item = parseInboxPath(p, { archived: false });
    if (!fs.existsSync(path.join(cwd, item.given))) {
      throw new Error(`inbox file not found: "${item.given}"`);
    }
    return item;
  });

  const wuDir = path.join(cwd, '.workflows', workUnit);
  const created = !fs.existsSync(path.join(wuDir, 'manifest.json'));
  // Read (and refuse corrupt JSON) before anything mutates; the registration
  // itself re-reads under the project lock after the work unit lands.
  if (created) readProjectManifest(cwd);

  // -- mutate: files + one manifest save under the work unit's lock, then the
  // -- project registration under its own lock, then KB, then the commit -----
  fs.mkdirSync(wuDir, { recursive: true });
  const { importMoves, seedMoves, skippedImports } = withWorkUnitLock(cwd, workUnit, () => {
    /** @type {Record<string, any>} */
    const manifest = created
      ? {
          name: workUnit,
          work_type: workType,
          status: 'in-progress',
          created: new Date().toISOString().slice(0, 10),
          description,
          phases: {},
        }
      : loadWorkUnitManifest(cwd, workUnit);

    // Destination names, deduped against each directory and within the batch.
    const importsDir = path.join(wuDir, 'imports');
    /** @type {string[]} */
    const skipped = [];
    /** @type {{src: string, dest: string}[]} */
    const importPlan = [];
    const takenImports = new Set();
    for (const src of imports) {
      const name = normaliseBasename(path.basename(src));
      if (name === null) {
        skipped.push(src);
        continue;
      }
      const dest = dedupe(name, importsDir, takenImports);
      takenImports.add(dest);
      importPlan.push({ src, dest });
    }

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

    if (importPlan.length > 0) fs.mkdirSync(importsDir, { recursive: true });
    for (const move of importPlan) {
      fs.copyFileSync(path.resolve(cwd, move.src), path.join(importsDir, move.dest));
      pushEntry(manifest, 'imports', { path: `imports/${move.dest}`, imported_at: isoNow() });
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
        if (!manifest.phases || typeof manifest.phases !== 'object') manifest.phases = {};
        if (!manifest.phases.discovery || typeof manifest.phases.discovery !== 'object') manifest.phases.discovery = {};
        manifest.phases.discovery.active_session = '001';
      }
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { importMoves: importPlan, seedMoves: seedPlan, skippedImports: skipped };
  });
  const sessionLogPath = sessionLog !== null ? `.workflows/${workUnit}/discovery/sessions/session-001.md` : null;

  if (created) {
    withProjectLock(cwd, () => {
      const projectManifest = readProjectManifest(cwd);
      if (!projectManifest.work_units || typeof projectManifest.work_units !== 'object') projectManifest.work_units = {};
      projectManifest.work_units[workUnit] = { work_type: workType };
      writeProjectManifestAtomic(cwd, projectManifest);
    });
  }

  /** @type {string[]} */
  const warnings = [];
  for (const move of importMoves) {
    knowledge(cwd, ['index', `.workflows/${workUnit}/imports/${move.dest}`], `knowledge index (imports/${move.dest})`, warnings);
  }
  for (const move of seedMoves) {
    knowledge(cwd, ['index', `.workflows/${workUnit}/seeds/${move.dest}`], `knowledge index (seeds/${move.dest})`, warnings);
  }

  // Seed removals ride along in the same commit as their new home.
  const pathspecs = [`.workflows/${workUnit}`];
  if (seedMoves.length > 0) pathspecs.push('.workflows/.inbox');
  const committed = commitScopedWithKb(cwd, pathspecs, `discovery(${workUnit}): create work unit (${workType})`);

  /** @type {WorkUnitCreateResult} */
  const result = {
    work_unit: workUnit,
    work_type: workType,
    created,
    imports: importMoves.map((move) => ({ path: `imports/${move.dest}` })),
    seeds: seedMoves.map((move) => ({
      path: `seeds/${move.dest}`,
      source: SEED_SOURCES[/** @type {keyof typeof SEED_SOURCES} */ (move.item.folder)],
    })),
    skipped_imports: skippedImports,
    session_log: sessionLogPath,
    committed,
    warnings,
  };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { createWorkUnit, dedupe };
