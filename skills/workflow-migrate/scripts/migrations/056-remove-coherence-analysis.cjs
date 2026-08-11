'use strict';

//
// Migration 056: Remove coherence-analysis residue
//
// The epic coherence analysis was removed — incoherence between sources is
// now met and resolved during specification construction. Installs that ran
// the analysis carry its state: manifest fields under phases.discovery
// (coherence_analysis_cache, dismissed_findings, and the coherence-analysis
// key inside the shared analysis_staging container), the two .state files
// (the cache and any deferred staging), and the cache file's chunks in the
// knowledge base. Delete all of it, per work unit. The analysis_staging
// container itself survives whenever other analyses hold keys in it, and
// the discovery map's separate `dismissed` list is untouched.
//
// The KB purge shells out to the committed knowledge CLI; a project with no
// initialised store (or a store the CLI cannot open) degrades silently —
// stale chunks decay, they never block a migration run.
//

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = {
  id: '056',
  description: 'remove coherence-analysis manifest fields, .state files, and knowledge-base chunks',
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
      const discovery = (manifest.phases || {}).discovery;
      if (discovery && typeof discovery === 'object') {
        for (const field of ['coherence_analysis_cache', 'dismissed_findings']) {
          if (field in discovery) {
            delete discovery[field];
            changed = true;
          }
        }
        const staging = discovery.analysis_staging;
        if (staging && typeof staging === 'object' && 'coherence-analysis' in staging) {
          delete staging['coherence-analysis'];
          if (Object.keys(staging).length === 0) delete discovery.analysis_staging;
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      }

      for (const file of ['coherence-analysis.md', 'coherence-analysis-candidates.md']) {
        const p = path.join(workflowsDir, workUnit, '.state', file);
        if (fs.existsSync(p)) {
          fs.rmSync(p, { force: true });
          changed = true;
        }
      }

      if (changed && storeExists) {
        try {
          execFileSync('node', [knowledgeCli, 'remove', '--work-unit', workUnit, '--phase', 'analysis', '--topic', 'coherence-analysis'], {
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
      }
    }
    if (!touched) reportSkip();
  },
};
