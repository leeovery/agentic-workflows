'use strict';

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, phaseStatus, phaseItems, phaseData, listFiles, listDirs, filesChecksum, readFrontmatterField, fileExists } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const workflowsDir = path.join(cwd, '.workflows');

  // --- Discussions ---
  const discussions = [];
  let discCount = 0, concludedCount = 0, inProgressCount = 0;

  for (const m of manifests) {
    const dp = (m.phases || {}).discussion;
    if (!dp) continue;
    const specPhase = phaseData(m, 'specification');

    if (m.work_type === 'epic') {
      const items = phaseItems(m, 'discussion');
      for (const item of items) {
        discCount++;
        if (item.status === 'concluded') concludedCount++;
        else if (item.status === 'in-progress') inProgressCount++;

        // Check if this discussion has an individual spec via sources
        let hasIndividualSpec = false;
        let specStatus = '';
        if (specPhase.sources && specPhase.sources[item.name]) {
          hasIndividualSpec = true;
          specStatus = specPhase.status || '';
        }

        discussions.push({
          name: item.name, work_unit: m.name, status: item.status || 'unknown',
          work_type: m.work_type, has_individual_spec: hasIndividualSpec,
          ...(hasIndividualSpec && { spec_status: specStatus }),
        });
      }
    } else if (dp.status) {
      discCount++;
      if (dp.status === 'concluded') concludedCount++;
      else if (dp.status === 'in-progress') inProgressCount++;

      let hasIndividualSpec = false;
      let specStatus = '';
      if (specPhase.status) {
        hasIndividualSpec = true;
        specStatus = specPhase.status;
      }

      discussions.push({
        name: m.name, work_unit: m.name, status: dp.status,
        work_type: m.work_type, has_individual_spec: hasIndividualSpec,
        ...(hasIndividualSpec && { spec_status: specStatus }),
      });
    }
  }

  // --- Specifications ---
  const specifications = [];
  let specCount = 0;

  for (const m of manifests) {
    const specFile = path.join(workflowsDir, m.name, 'specification', m.name, 'specification.md');
    if (!fileExists(specFile)) continue;

    const sp = phaseData(m, 'specification');
    const status = sp.status || 'in-progress';
    if (status === 'superseded') continue;

    specCount++;
    const spec = {
      name: m.name, work_unit: m.name, status,
      work_type: m.work_type,
    };

    if (sp.superseded_by) spec.superseded_by = sp.superseded_by;

    // Sources from manifest
    if (sp.sources && typeof sp.sources === 'object') {
      spec.sources = Object.entries(sp.sources).map(([srcName, srcData]) => {
        const srcStatus = (typeof srcData === 'object') ? (srcData.status || 'incorporated') : 'incorporated';
        // Look up discussion status
        let discStatus = 'unknown';
        if (m.work_type === 'epic') {
          const items = ((m.phases || {}).discussion || {}).items || {};
          discStatus = (items[srcName] || {}).status || 'unknown';
        } else {
          discStatus = phaseStatus(m, 'discussion') || 'unknown';
        }
        return { name: srcName, status: srcStatus, discussion_status: discStatus };
      });
    }

    specifications.push(spec);
  }

  // --- Cache (discussion-consolidation-analysis) ---
  const cacheEntries = [];

  for (const m of manifests) {
    const cacheFile = path.join(workflowsDir, m.name, '.state', 'discussion-consolidation-analysis.md');
    const cachedChecksum = readFrontmatterField(cacheFile, 'checksum');
    if (!cachedChecksum) continue;

    const cachedDate = readFrontmatterField(cacheFile, 'generated');
    const discDir = path.join(workflowsDir, m.name, 'discussion');
    const discFiles = listFiles(discDir, '.md').sort();

    let status = 'stale';
    let reason = 'discussions have changed since cache was generated';

    if (discFiles.length > 0) {
      const currentChecksum = filesChecksum(discFiles.map(f => path.join(discDir, f)));
      if (cachedChecksum === currentChecksum) {
        status = 'valid';
        reason = 'checksums match';
      }
    } else {
      reason = 'no discussions to compare';
    }

    // Extract anchored names (grouping headings with existing specs)
    const anchoredNames = [];
    try {
      const content = fs.readFileSync(cacheFile, 'utf8');
      const headings = content.match(/^### .+$/gm) || [];
      for (const h of headings) {
        const cleanName = h.replace(/^### /, '').replace(/\s*\(.*\)/, '').toLowerCase().replace(/\s+/g, '-');
        const specDir = path.join(workflowsDir, cleanName, 'specification');
        if (listDirs(specDir).some(d => fileExists(path.join(specDir, d, 'specification.md')))) {
          anchoredNames.push(cleanName);
        }
      }
    } catch {}

    cacheEntries.push({
      work_unit: m.name, status, reason,
      checksum: cachedChecksum, generated: cachedDate || 'unknown',
      anchored_names: anchoredNames,
    });
  }

  // --- Discussions checksum ---
  const allDiscFiles = [];
  for (const m of manifests) {
    const discDir = path.join(workflowsDir, m.name, 'discussion');
    for (const f of listFiles(discDir, '.md')) {
      allDiscFiles.push(path.join(discDir, f));
    }
  }
  allDiscFiles.sort();
  const discussionsChecksum = allDiscFiles.length > 0 ? filesChecksum(allDiscFiles) : null;

  return {
    discussions: discussions,
    specifications: specifications,
    cache: cacheEntries.length > 0
      ? { entries: cacheEntries }
      : { status: 'none', reason: 'no cache exists', entries: [] },
    current_state: {
      discussions_checksum: discussionsChecksum,
      discussion_count: discCount,
      concluded_count: concludedCount,
      in_progress_count: inProgressCount,
      spec_count: specCount,
      has_discussions: discCount > 0,
      has_concluded: concludedCount > 0,
      has_specs: specCount > 0,
    },
  };
}

function format(result) {
  const lines = [];

  lines.push('=== DISCUSSIONS ===');
  if (result.discussions.length === 0) {
    lines.push('  (none)');
  } else {
    for (const d of result.discussions) {
      let extra = d.has_individual_spec ? `, spec: ${d.spec_status}` : '';
      lines.push(`  ${d.work_unit}/${d.name} (${d.work_type}): ${d.status}${extra}`);
    }
  }
  lines.push('');

  lines.push('=== SPECIFICATIONS ===');
  if (result.specifications.length === 0) {
    lines.push('  (none)');
  } else {
    for (const s of result.specifications) {
      lines.push(`  ${s.name}: ${s.status}, type=${s.work_type}`);
      if (s.sources) {
        for (const src of s.sources) {
          lines.push(`    source: ${src.name} (${src.status}, discussion: ${src.discussion_status})`);
        }
      }
    }
  }
  lines.push('');

  lines.push('=== CACHE ===');
  if (result.cache.entries.length === 0) {
    lines.push(`  status: ${result.cache.status}`);
  } else {
    for (const c of result.cache.entries) {
      lines.push(`  ${c.work_unit}: ${c.status} (${c.reason})`);
      if (c.anchored_names.length > 0) {
        lines.push(`    anchored: ${c.anchored_names.join(', ')}`);
      }
    }
  }
  lines.push('');

  lines.push('=== STATE ===');
  const cs = result.current_state;
  lines.push(`discussions: ${cs.discussion_count} (${cs.concluded_count} concluded, ${cs.in_progress_count} in-progress)`);
  lines.push(`specs: ${cs.spec_count}, has_discussions: ${cs.has_discussions}, has_concluded: ${cs.has_concluded}`);
  if (cs.discussions_checksum) lines.push(`checksum: ${cs.discussions_checksum}`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };
