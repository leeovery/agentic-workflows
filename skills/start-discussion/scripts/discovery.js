'use strict';

const path = require('path');
const { loadActiveManifests, phaseStatus, phaseItems, listFiles, listDirs, filesChecksum, readFrontmatterField } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const workflowsDir = path.join(cwd, '.workflows');

  // --- Research files ---
  const researchFiles = [];
  for (const m of manifests) {
    const researchDir = path.join(workflowsDir, m.name, 'research');
    for (const f of listFiles(researchDir, '.md')) {
      const name = f.replace(/\.md$/, '');
      researchFiles.push({
        name,
        topic: name,
        work_unit: m.name,
        status: phaseStatus(m, 'research') || 'in-progress',
      });
    }
  }
  const researchChecksum = researchFiles.length > 0
    ? filesChecksum(researchFiles.map(r => path.join(workflowsDir, r.work_unit, 'research', r.name + '.md')))
    : null;

  // --- Discussions from manifests ---
  const discussions = [];
  let inProgress = 0;
  let concluded = 0;

  for (const m of manifests) {
    const dp = (m.phases || {}).discussion;
    if (!dp) continue;

    if (m.work_type === 'epic') {
      const items = phaseItems(m, 'discussion');
      if (items.length > 0) {
        for (const item of items) {
          discussions.push({ name: item.name, work_unit: m.name, status: item.status || 'unknown', work_type: m.work_type });
          if (item.status === 'in-progress') inProgress++;
          else if (item.status === 'concluded') concluded++;
        }
      } else if (dp.status) {
        discussions.push({ name: m.name, work_unit: m.name, status: dp.status, work_type: m.work_type });
        if (dp.status === 'in-progress') inProgress++;
        else if (dp.status === 'concluded') concluded++;
      }
    } else if (dp.status) {
      discussions.push({ name: m.name, work_unit: m.name, status: dp.status, work_type: m.work_type });
      if (dp.status === 'in-progress') inProgress++;
      else if (dp.status === 'concluded') concluded++;
    }
  }

  // --- Cache state ---
  const cacheEntries = [];
  for (const m of manifests) {
    const cacheFile = path.join(workflowsDir, m.name, '.state', 'research-analysis.md');
    const cachedChecksum = readFrontmatterField(cacheFile, 'checksum');
    if (!cachedChecksum) continue;

    const cachedDate = readFrontmatterField(cacheFile, 'generated');
    const researchDir = path.join(workflowsDir, m.name, 'research');
    const rFiles = listFiles(researchDir, '.md');

    let status = 'stale';
    let reason = 'research has changed since cache was generated';

    if (rFiles.length > 0) {
      const currentChecksum = filesChecksum(rFiles.map(f => path.join(researchDir, f)));
      if (cachedChecksum === currentChecksum) {
        status = 'valid';
        reason = 'checksums match';
      }
    } else {
      reason = 'no research files to compare';
    }

    // Extract research_files list from cache body
    const researchFilesList = [];
    try {
      const fs = require('fs');
      const content = fs.readFileSync(cacheFile, 'utf8');
      const lines = content.split('\n');
      let inSection = false;
      for (const line of lines) {
        if (/^research_files:/.test(line)) { inSection = true; continue; }
        if (inSection && /^---$/.test(line)) break;
        if (inSection && /^\s*-\s+/.test(line)) {
          researchFilesList.push(line.replace(/^\s*-\s+/, '').trim());
        }
      }
    } catch {}

    cacheEntries.push({
      work_unit: m.name,
      status,
      reason,
      checksum: cachedChecksum,
      generated: cachedDate || 'unknown',
      research_files: researchFilesList,
    });
  }

  // --- State ---
  const hasResearch = researchFiles.length > 0;
  const hasDiscussions = discussions.length > 0;
  let scenario;
  if (!hasResearch && !hasDiscussions) scenario = 'fresh';
  else if (hasResearch && !hasDiscussions) scenario = 'research_only';
  else if (!hasResearch && hasDiscussions) scenario = 'discussions_only';
  else scenario = 'research_and_discussions';

  return {
    research: {
      exists: hasResearch,
      files: researchFiles,
      checksum: researchChecksum,
    },
    discussions: {
      exists: hasDiscussions,
      files: discussions,
      counts: { in_progress: inProgress, concluded },
    },
    cache: cacheEntries.length > 0
      ? { entries: cacheEntries }
      : { status: 'none', reason: 'no cache exists', entries: [] },
    state: { has_research: hasResearch, has_discussions: hasDiscussions, scenario },
  };
}

function format(result) {
  const lines = [];

  lines.push('=== RESEARCH ===');
  if (!result.research.exists) {
    lines.push('  (none)');
  } else {
    for (const r of result.research.files) {
      lines.push(`  ${r.work_unit}/${r.name}: ${r.status}`);
    }
    lines.push(`  checksum: ${result.research.checksum}`);
  }
  lines.push('');

  lines.push('=== DISCUSSIONS ===');
  if (!result.discussions.exists) {
    lines.push('  (none)');
  } else {
    for (const d of result.discussions.files) {
      lines.push(`  ${d.work_unit}/${d.name} (${d.work_type}): ${d.status}`);
    }
    lines.push(`  counts: ${result.discussions.counts.in_progress} in-progress, ${result.discussions.counts.concluded} concluded`);
  }
  lines.push('');

  lines.push('=== CACHE ===');
  if (result.cache.entries.length === 0) {
    lines.push(`  status: ${result.cache.status}, reason: ${result.cache.reason}`);
  } else {
    for (const c of result.cache.entries) {
      lines.push(`  ${c.work_unit}: ${c.status} (${c.reason})`);
    }
  }
  lines.push('');

  lines.push('=== STATE ===');
  lines.push(`scenario: ${result.state.scenario}`);
  lines.push(`has_research: ${result.state.has_research}, has_discussions: ${result.state.has_discussions}`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };
