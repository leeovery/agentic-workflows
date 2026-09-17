'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the mid-session import — a file the user shares after the
// opener, landing in the work unit's one imports home with the origin of the
// session that took it. The roadmap's shape with the origin added: validate,
// copy, record, index what embeds, one confined commit. No gate — the
// session lands the file, links it, and carries on.
//
// Validation is complete before any mutation: a missing path fails the whole
// call with `missing_imports` riding on the error so the calling flow can
// re-prompt and re-run — nothing is on disk until every input is legal. The
// manifest write is the source of truth; the knowledge base is a derived
// index (warn-don't-block); the confined commit comes last.
// ---------------------------------------------------------------------------

const path = require('path');
const {
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
} = require('../kernel/manifest.cjs');
const { commitTailWithKb, noteCommitOutcome } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');
const {
  planImports,
  copyImports,
  importEntry,
  isIndexableImport,
  importArtifact,
  unlandableSources,
} = require('./import-landing.cjs');
const { IMPORT_PHASES, isImportOrigin } = require('../kernel/manifest-schema.cjs');

/**
 * @typedef {object} WorkUnitImportResult
 * @property {'import'} op
 * @property {{path: string, origin: string}[]} imports  landed entries (work-unit-relative)
 * @property {string[]} skipped_imports  source paths rejected by filename normalisation
 * @property {string[]} [warnings]  non-blocking failures (knowledge-base indexing, the commit)
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]  set when committed is null
 */

/**
 * Land user-shared files in a work unit's `imports/`, stamped with the origin
 * of the place that took them. Refuses a work unit that is missing or not
 * in-progress, an origin outside the vocabulary or naming a phase item the
 * work unit does not have, any source that is not an existing regular file
 * (the whole call, nothing copied), and a call whose every source is dropped
 * by filename normalisation — "imported" must mean something landed. In one lock
 * hold: plan and dedupe against the directory and the batch, copy, record.
 * After it: index each markdown landing (warn-don't-block) and commit the
 * imports directory and the manifest, confined.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string[]} paths source paths to copy in
 * @param {{origin: string}} opts  `discovery` | `{phase}/{topic}`
 * @returns {WorkUnitImportResult}
 */
function importWorkUnitFiles(cwd, workUnit, paths, { origin }) {
  // -- validate everything before any mutation --------------------------------
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('import: at least one path is required');
  }
  // The schema's vocabulary covers every entry anywhere; a work unit's own is
  // narrower — `roadmap` belongs to the product layer, which has its own verb.
  if (!isImportOrigin(origin) || origin === 'roadmap') {
    throw new Error(`"${origin}" is not a work-unit import origin — discovery, or {phase}/{topic} with phase one of ${IMPORT_PHASES.join(', ')} (roadmap is the product layer's own — engine roadmap import)`);
  }
  const missing = unlandableSources(cwd, paths);
  if (missing.length > 0) {
    const err = /** @type {Error & {payload: Record<string, unknown>}} */ (
      new Error(`import path(s) not found or not a file: ${missing.join(', ')}`)
    );
    err.payload = { missing_imports: missing };
    throw err;
  }

  // Plan, copy, and record inside one lock hold — a refusal leaves no orphan
  // copies, and two sessions importing the same basename cannot dedupe
  // against one snapshot (create's discipline: the copies land beside the
  // write that records them).
  const importsDir = path.join(cwd, '.workflows', workUnit, 'imports');
  const { moves, skipped } = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.status !== 'in-progress') {
      throw new Error(`work unit "${workUnit}" is not in-progress (status: ${manifest.status ?? 'none'}) — imports land in active work`);
    }
    if (manifest.imports !== undefined && !Array.isArray(manifest.imports)) {
      throw new Error(`"${workUnit}" imports is malformed — expected an array`);
    }
    // The origin must name a session that exists. A mistyped topic would
    // record a provenance nothing can resolve and mint a presence hold no
    // session owns and nothing clears.
    const [phase, topic] = origin.split('/');
    if (topic !== undefined) {
      const item = manifest.phases?.[phase]?.items?.[topic];
      if (!item || typeof item !== 'object') {
        throw new Error(`no ${phase} item "${topic}" in "${workUnit}" — check the --from origin`);
      }
    }

    const { planned, skipped: dropped } = planImports(paths, importsDir);
    if (planned.length === 0) {
      throw new Error(`import: nothing to land — every source was skipped by filename normalisation (${dropped.join(', ')})`);
    }

    copyImports(cwd, importsDir, planned);
    if (manifest.imports === undefined) manifest.imports = [];
    for (const move of planned) {
      manifest.imports.push(importEntry(move.dest, origin));
    }
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { moves: planned, skipped: dropped };
  });

  /** @type {string[]} */
  const warnings = [];
  for (const move of moves.filter((m) => isIndexableImport(m.dest))) {
    knowledge(cwd, ['index', importArtifact(workUnit, move.dest)], `knowledge index (imports/${move.dest})`, warnings);
  }

  const outcome = commitTailWithKb(
    cwd,
    [`.workflows/${workUnit}/imports`, `.workflows/${workUnit}/manifest.json`],
    `workflow(${workUnit}): import ${moves.length} file(s) for ${origin}`,
    warnings);

  /** @type {WorkUnitImportResult} */
  const result = {
    op: 'import',
    imports: moves.map((move) => ({ path: `imports/${move.dest}`, origin })),
    skipped_imports: skipped,
    committed: outcome.committed,
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { importWorkUnitFiles };
