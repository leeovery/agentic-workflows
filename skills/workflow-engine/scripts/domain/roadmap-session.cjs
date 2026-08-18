'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the product-road session lifecycle — the roadmap's project-
// level sibling of discovery-session. Sessions live at
// `.workflows/.roadmap/sessions/session-NNN.md`, the active marker at the
// project manifest's `roadmap.active_session`, imports at
// `.workflows/.roadmap/imports/` tracked under `roadmap.imports[]`.
//
// open starts a session at the log's first write: allocate the next number
// from the on-disk logs, move the model-drafted log into place, set the
// marker — one project-manifest write, NO commit (the session is live; the
// calling flow's cadence — `engine commit --roadmap` — picks it up).
//
// close finalises as ONE transaction: clear the marker, index the log into
// the knowledge base (warn-don't-block; identity `roadmap`, phase `roadmap`),
// commit scoped to the roadmap dir + project manifest with the caller's
// message.
//
// import lands user-shared reference files at the product altitude — the
// project-level imports home (design decision 26): create's normalise/dedupe
// discipline, `roadmap.imports[]` entries, KB indexing, one self commit.
// The log content is model-authored — the engine never writes prose.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
  ensureContainer,
} = require('../kernel/manifest.cjs');
const { commitTailPathspec, noteCommitOutcome } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');
const { nextSessionNumber } = require('./discovery-session.cjs');
const { dedupe, normaliseBasename } = require('./workunit-create.cjs');

const ROADMAP_DIR = '.workflows/.roadmap';
const PROJECT_MANIFEST_SPEC = '.workflows/manifest.json';

/** ISO-8601 UTC to the second (`2026-07-15T09:30:00Z`). */
function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The roadmap node on a project manifest for the session verbs — created
 * just-in-time (the genesis session predates any item or horizon).
 * @param {Record<string, any>} manifest
 * @returns {Record<string, any>}
 */
function ensureRoadmapNode(manifest) {
  const roadmap = ensureContainer(manifest, 'roadmap', 'roadmap');
  if (roadmap.horizons === undefined) roadmap.horizons = [];
  ensureContainer(roadmap, 'items', 'roadmap.items');
  return roadmap;
}

/**
 * Open a product-road session: allocate the next session number from the
 * on-disk logs, install the model-drafted log (moved, not copied), set
 * `roadmap.active_session` — one project-manifest write. No commit and no
 * knowledge index: the session is live; close indexes the finalised log.
 * Validation completes before any mutation.
 * @param {string} cwd project root
 * @param {{sessionLogFile: string}} opts
 * @returns {{session: string, path: string}}
 */
function openRoadmapSession(cwd, { sessionLogFile }) {
  return withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const rm = manifest.roadmap;
    const active = rm && typeof rm === 'object' && !Array.isArray(rm) ? rm.active_session : undefined;
    if (typeof active === 'string' && active !== '') {
      throw new Error(`a roadmap session ("${active}") is already open — close it before opening another`);
    }
    const draftPath = path.resolve(cwd, sessionLogFile);
    /** @type {string} */
    let draft;
    try {
      draft = fs.readFileSync(draftPath, 'utf8');
    } catch {
      throw new Error(`session log draft not found: ${sessionLogFile}`);
    }
    if (draft.trim() === '') {
      throw new Error(`session log draft is empty: ${sessionLogFile} — draft the log before opening the session`);
    }

    const sessionsDir = path.join(cwd, ROADMAP_DIR, 'sessions');
    const session = String(nextSessionNumber(sessionsDir)).padStart(3, '0');
    const rel = `${ROADMAP_DIR}/sessions/session-${session}.md`;

    // Log first, marker second: a failure between the two leaves a log
    // without a marker (a closed-looking session — recoverable), never a
    // marker naming a missing log (corrupt state).
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.renameSync(draftPath, path.join(cwd, rel));
    ensureRoadmapNode(manifest).active_session = session;
    writeProjectManifestAtomic(cwd, manifest);
    return { session, path: rel };
  });
}

/**
 * Close the active product-road session: delete `roadmap.active_session`,
 * index the marker's log (warn-don't-block), commit scoped to the roadmap
 * dir + project manifest with the caller's message.
 * @param {string} cwd project root
 * @param {{message: string}} opts
 * @returns {Record<string, any>}
 */
function closeRoadmapSession(cwd, { message }) {
  const session = withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const rm = manifest.roadmap;
    const active = rm && typeof rm === 'object' && !Array.isArray(rm) ? rm.active_session : undefined;
    if (typeof active !== 'string' || active === '') {
      throw new Error('no active roadmap session — roadmap.active_session is not set (a browse-only session never sets it; nothing to close)');
    }
    const rel = `${ROADMAP_DIR}/sessions/session-${active}.md`;
    if (!fs.existsSync(path.join(cwd, rel))) {
      throw new Error(`session log missing on disk: ${rel} — the active-session marker names a session with no log`);
    }
    delete rm.active_session;
    writeProjectManifestAtomic(cwd, manifest);
    return { number: active, rel };
  });

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['index', session.rel], `knowledge index (roadmap/sessions/session-${session.number}.md)`, warnings);

  const outcome = commitTailPathspec(cwd, [ROADMAP_DIR, PROJECT_MANIFEST_SPEC], message, warnings);
  /** @type {Record<string, any>} */
  const result = { session: session.number, session_log: session.rel, committed: outcome.committed, warnings };
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Land reference files at the product altitude — the project-level imports
 * home. Validation completes before any mutation (a missing path fails the
 * whole call with `missing_imports` so the calling flow can re-prompt);
 * filenames take create's normalise/dedupe discipline (dotfile-normalising
 * sources are skipped and reported); every landing gets a
 * `roadmap.imports[]` entry and a knowledge index (warn-don't-block); one
 * commit stages the files and the manifest.
 * @param {string} cwd project root
 * @param {string[]} paths source paths to copy in
 * @returns {Record<string, any>}
 */
function importRoadmapFiles(cwd, paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('import: at least one path is required');
  }
  const missing = paths.filter((p) => !fs.existsSync(path.resolve(cwd, p)));
  if (missing.length > 0) {
    const err = /** @type {Error & {payload: Record<string, unknown>}} */ (
      new Error(`import path(s) not found: ${missing.join(', ')}`)
    );
    err.payload = { missing_imports: missing };
    throw err;
  }

  const destDir = path.join(cwd, ROADMAP_DIR, 'imports');
  fs.mkdirSync(destDir, { recursive: true });
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {{src: string, dest: string}[]} */
  const moves = [];
  /** @type {string[]} */
  const skipped = [];
  for (const src of paths) {
    const name = normaliseBasename(path.basename(src));
    if (name === null) {
      skipped.push(src);
      continue;
    }
    const dest = dedupe(name, destDir, taken);
    taken.add(dest);
    moves.push({ src, dest });
  }

  for (const move of moves) {
    fs.copyFileSync(path.resolve(cwd, move.src), path.join(destDir, move.dest));
  }
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const roadmap = ensureRoadmapNode(manifest);
    if (roadmap.imports === undefined) roadmap.imports = [];
    if (!Array.isArray(roadmap.imports)) throw new Error('roadmap.imports is malformed — expected an array');
    for (const move of moves) {
      roadmap.imports.push({ path: `imports/${move.dest}`, imported_at: isoNow() });
    }
    writeProjectManifestAtomic(cwd, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  for (const move of moves) {
    knowledge(cwd, ['index', `${ROADMAP_DIR}/imports/${move.dest}`], `knowledge index (roadmap/imports/${move.dest})`, warnings);
  }

  /** @type {Record<string, any>} */
  const result = {
    op: 'import',
    imports: moves.map((m) => ({ path: `imports/${m.dest}` })),
    skipped_imports: skipped,
  };
  const outcome = commitTailPathspec(
    cwd,
    [ROADMAP_DIR, PROJECT_MANIFEST_SPEC],
    `roadmap: import ${moves.length} file${moves.length === 1 ? '' : 's'}`,
    warnings,
  );
  result.committed = outcome.committed;
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { openRoadmapSession, closeRoadmapSession, importRoadmapFiles, ROADMAP_DIR };
