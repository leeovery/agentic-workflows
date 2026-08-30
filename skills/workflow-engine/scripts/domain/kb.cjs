'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the knowledge-base door — the ONLY place the engine spawns the
// knowledge CLI. `spawnKnowledge` is the raw spawn for callers that branch on
// the result themselves (boot's check/compact); `knowledge` layers the
// warn-don't-block contract every engine transaction shares. The knowledge
// base is a derived index: its failures are recorded as warnings on the
// caller's result, never thrown.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Resolved against this file so it works wherever the skill tree is installed.
const KNOWLEDGE_CLI = path.resolve(__dirname, '..', '..', '..', 'workflow-knowledge', 'scripts', 'knowledge.cjs');

/**
 * Phases whose completed artifact is knowledge-base indexed, with the artifact
 * path per topic. One table for every engine transaction that indexes or
 * re-indexes phase artifacts. Experiment is indexed too but multi-file (a
 * series of record directories, each a design plus a report), so it has no
 * single-path row here — experimentArtifactPaths enumerates it from the
 * manifest's series, and INDEXED_PHASES carries the full indexed set.
 * @type {Record<string, (wu: string, topic: string) => string>}
 */
const INDEXED_ARTIFACTS = {
  research: (wu, topic) => `.workflows/${wu}/research/${topic}.md`,
  discussion: (wu, topic) => `.workflows/${wu}/discussion/${topic}.md`,
  investigation: (wu, topic) => `.workflows/${wu}/investigation/${topic}.md`,
  specification: (wu, topic) => `.workflows/${wu}/specification/${topic}/specification.md`,
};

/** Every phase the knowledge base indexes per topic. */
const INDEXED_PHASES = [...Object.keys(INDEXED_ARTIFACTS), 'experiment'];

/**
 * A topic's indexable experiment files, project-relative and on disk: every
 * series record's `design.md` and `report.md` that exists (a record abandoned
 * before running may have no report). The series comes from the manifest —
 * `phases.experiment.items.{topic}.experiments.{Eid}.slug` — the register
 * the engine itself writes. Used wherever an engine transaction re-indexes
 * experiment artifacts (topic reactivate, absorb); the topic's conclude prose
 * indexes the same set per file.
 * @param {string} cwd project root
 * @param {object} manifest the work-unit manifest
 * @param {string} workUnit
 * @param {string} topic
 * @returns {string[]}
 */
function experimentArtifactPaths(cwd, manifest, workUnit, topic) {
  const phases = manifest && typeof manifest === 'object' ? /** @type {Record<string, any>} */ (manifest).phases : undefined;
  const ph = phases && typeof phases === 'object' ? phases.experiment : undefined;
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  const item = items && typeof items === 'object' ? items[topic] : undefined;
  const records = item && typeof item === 'object' && item.experiments && typeof item.experiments === 'object'
    ? item.experiments : {};
  /** @type {string[]} */
  const out = [];
  for (const [id, record] of Object.entries(records)) {
    const slug = record && typeof record === 'object' ? record.slug : null;
    if (typeof slug !== 'string' || slug === '') continue;
    for (const doc of ['design', 'report']) {
      const rel = `.workflows/${workUnit}/experiment/${topic}/${id}-${slug}/${doc}.md`;
      if (fs.existsSync(path.join(cwd, rel))) out.push(rel);
    }
  }
  return out;
}

/**
 * Spawn the knowledge CLI and return the raw result — for callers that
 * branch on it themselves.
 * @param {string} cwd @param {string[]} args
 */
function spawnKnowledge(cwd, args) {
  return spawnSync('node', [KNOWLEDGE_CLI, ...args], { cwd, encoding: 'utf8' });
}

/**
 * Spawn the knowledge CLI; on failure push a warning instead of throwing.
 * @param {string} cwd @param {string[]} args @param {string} label @param {string[]} warnings
 */
function knowledge(cwd, args, label, warnings) {
  const res = spawnKnowledge(cwd, args);
  const failed = res.error || res.status !== 0;
  if (failed) {
    const detail = res.error
      ? res.error.message
      : (res.stderr || res.stdout || `exit ${res.status}`).trim();
    warnings.push(`${label} failed: ${detail}`);
  }
}

module.exports = { knowledge, spawnKnowledge, INDEXED_ARTIFACTS, INDEXED_PHASES, experimentArtifactPaths };
