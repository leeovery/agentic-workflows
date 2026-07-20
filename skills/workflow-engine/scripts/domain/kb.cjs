'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the knowledge-base door — spawn the knowledge CLI with the
// warn-don't-block contract every engine transaction shares. The knowledge
// base is a derived index: its failures are recorded as warnings on the
// caller's result, never thrown.
// ---------------------------------------------------------------------------

const path = require('path');
const { spawnSync } = require('child_process');

// Resolved against this file so it works wherever the skill tree is installed.
const KNOWLEDGE_CLI = path.resolve(__dirname, '..', '..', '..', 'workflow-knowledge', 'scripts', 'knowledge.cjs');

/**
 * Phases whose completed artifact is knowledge-base indexed, with the artifact
 * path per topic. One table for every engine transaction that indexes or
 * re-indexes phase artifacts.
 * @type {Record<string, (wu: string, topic: string) => string>}
 */
const INDEXED_ARTIFACTS = {
  research: (wu, topic) => `.workflows/${wu}/research/${topic}.md`,
  discussion: (wu, topic) => `.workflows/${wu}/discussion/${topic}.md`,
  investigation: (wu, topic) => `.workflows/${wu}/investigation/${topic}.md`,
  specification: (wu, topic) => `.workflows/${wu}/specification/${topic}/specification.md`,
};

/**
 * Spawn the knowledge CLI; on failure push a warning instead of throwing.
 * @param {string} cwd @param {string[]} args @param {string} label @param {string[]} warnings
 */
function knowledge(cwd, args, label, warnings) {
  const res = spawnSync('node', [KNOWLEDGE_CLI, ...args], { cwd, encoding: 'utf8' });
  const failed = res.error || res.status !== 0;
  if (failed) {
    const detail = res.error
      ? res.error.message
      : (res.stderr || res.stdout || `exit ${res.status}`).trim();
    warnings.push(`${label} failed: ${detail}`);
  }
}

module.exports = { knowledge, INDEXED_ARTIFACTS };
