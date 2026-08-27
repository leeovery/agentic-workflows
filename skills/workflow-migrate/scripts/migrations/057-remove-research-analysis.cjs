'use strict';

//
// Migration 057: Remove research-analysis residue
//
// The boot-time research analysis was removed — completed research now feeds
// the topics it belongs to without a separate spawning pass. Installs that
// ran the analysis carry its state: the manifest's phases.research
// analysis_cache, the research-analysis key inside the shared
// phases.discovery.analysis_staging container, the two .state files (the
// cache and any staged candidates), and the cache file's chunks in the
// knowledge base. Delete all of it, per work unit. The analysis_staging
// container itself survives whenever other analyses hold keys in it,
// phases.discovery.gap_analysis_cache is untouched, and the discovery map's
// `research-analysis:{parent}` source provenance stays as written — it
// records how a topic landed, which remains true.
//
// The KB purge shells out to the committed knowledge CLI; a project with no
// initialised store (or a store the CLI cannot open) degrades silently —
// stale chunks decay, they never block a migration run.
//

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = {
  id: '057',
  description: 'remove research-analysis manifest fields, .state files, and knowledge-base chunks',
  info: 'The boot-time research analysis was removed — completed research now feeds its topics by reference, and the gap analysis is the sole boot-time analysis. This migration deletes the retired analysis\'s residue per work unit: the phases.research.analysis_cache manifest field, the research-analysis key in the shared analysis_staging container (and the container when it empties), the .state/research-analysis.md and .state/research-analysis-candidates.md files, and the cache file\'s knowledge-base chunks.',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    let entries;
    try {
      entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
    } catch {
      reportSkip();
      return;
    }

    // Resolved against this file so it works wherever the skill tree is
    // installed (repo layout and .claude/skills installs alike).
    const knowledgeCli = path.resolve(__dirname, '..', '..', '..', 'workflow-knowledge', 'scripts', 'knowledge.cjs');
    const storeExists = fs.existsSync(path.join(workflowsDir, '.knowledge'));

    let touched = false;
    /** @type {string[]} */
    const purgedUnits = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const workUnit = entry.name;
      const manifestPath = path.join(workflowsDir, workUnit, 'manifest.json');
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        continue; // no manifest or unreadable — not a work unit, leave it
      }

      let changed = false;
      const phases = manifest.phases || {};
      const research = phases.research;
      if (research && typeof research === 'object' && 'analysis_cache' in research) {
        delete research.analysis_cache;
        changed = true;
      }
      const discovery = phases.discovery;
      if (discovery && typeof discovery === 'object') {
        const staging = discovery.analysis_staging;
        if (staging && typeof staging === 'object' && 'research-analysis' in staging) {
          delete staging['research-analysis'];
          if (Object.keys(staging).length === 0) delete discovery.analysis_staging;
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      }

      for (const file of ['research-analysis.md', 'research-analysis-candidates.md']) {
        const p = path.join(workflowsDir, workUnit, '.state', file);
        if (fs.existsSync(p)) {
          fs.rmSync(p, { force: true });
          changed = true;
        }
      }

      if (changed && storeExists) {
        try {
          execFileSync('node', [knowledgeCli, 'remove', '--work-unit', workUnit, '--phase', 'analysis', '--topic', 'research-analysis'], {
            cwd: projectDir,
            stdio: 'ignore',
          });
        } catch {
          // store unreadable or CLI absent — stale chunks decay, never block
        }
      }

      if (changed) {
        reportUpdate();
        touched = true;
        if (storeExists) purgedUnits.push(workUnit);
      }
    }
    if (!touched) {
      reportSkip();
      return;
    }
    if (purgedUnits.length === 0) return;
    // The KB purge is the one silent-failure path — the shell-out degrades
    // without reporting, so chunks can survive it. Hand the check over.
    return {
      verify: `The knowledge-base purge degrades silently, so confirm it landed for: ${purgedUnits.join(', ')}. Query the store for lingering analysis chunks (node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "research analysis" — any hit whose Source is .workflows/{wu}/.state/research-analysis.md is a straggler) and remove any with: node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {wu} --phase analysis --topic research-analysis.`,
    };
  },
};
