'use strict';

const path = require('path');
const { loadActiveManifests, phaseItems, phaseData, listFiles, filesChecksum, fileExists } = require('../../workflow-shared/scripts/discovery-utils.cjs');

// Actionable-first ordering rank for the spec menu. Lower sorts earlier:
// proposed → in-progress → completed-with-pending → concluded → other/promoted.
function specSortRank(spec) {
  if (spec.status === 'proposed') return 0;
  if (spec.status === 'in-progress') return 1;
  if (spec.status === 'completed') return spec.has_pending_sources ? 2 : 3;
  return 4;
}

function discover(cwd, workUnit) {
  const allManifests = loadActiveManifests(cwd);
  const manifests = workUnit
    ? allManifests.filter(m => m.name === workUnit)
    : allManifests;
  const workflowsDir = path.join(cwd, '.workflows');

  // --- Discussions ---
  const discussions = [];
  let discCount = 0, completedCount = 0, inProgressCount = 0;

  for (const m of manifests) {
    const discItemsList = phaseItems(m, 'discussion');
    const specItemsList = phaseItems(m, 'specification');

    for (const item of discItemsList) {
      if (item.status === 'cancelled') continue;
      discCount++;
      if (item.status === 'completed') completedCount++;
      else if (item.status === 'in-progress') inProgressCount++;

      // Check if this discussion has an individual spec via sources. Proposed
      // groupings are not individual specs — ignore them so the single-discussion
      // path and grouping "matching spec" logic stay correct.
      let hasIndividualSpec = false;
      let specStatus = '';
      for (const si of specItemsList) {
        if (si.status === 'proposed') continue;
        if (si.sources && si.sources[item.name]) {
          hasIndividualSpec = true;
          specStatus = si.status || '';
          break;
        }
      }

      discussions.push({
        name: item.name, work_unit: m.name, status: item.status || 'unknown',
        work_type: m.work_type, has_individual_spec: hasIndividualSpec,
        ...(hasIndividualSpec && { spec_status: specStatus }),
      });
    }
  }

  // --- Specifications ---
  // Classify by status, not file presence. Materialized specs
  // (in-progress/completed/promoted) are file-backed and count toward spec_count.
  // Proposed groupings live only in the manifest — no file on disk — and count
  // toward proposed_count. Both land in specifications[].
  const specifications = [];
  let specCount = 0;
  let proposedCount = 0;

  for (const m of manifests) {
    const specItemsList = phaseItems(m, 'specification');
    const discItemsList = phaseItems(m, 'discussion');

    for (const item of specItemsList) {
      const status = item.status || 'in-progress';
      if (status === 'superseded' || status === 'cancelled') continue;

      const isProposed = status === 'proposed';
      if (isProposed) {
        proposedCount++;
      } else {
        const specFile = path.join(workflowsDir, m.name, 'specification', item.name, 'specification.md');
        if (!fileExists(specFile)) continue;
        specCount++;
      }

      const spec = {
        name: item.name, work_unit: m.name, status,
        work_type: m.work_type,
      };

      if (item.superseded_by) spec.superseded_by = item.superseded_by;

      if (item.sources && typeof item.sources === 'object') {
        spec.sources = Object.entries(item.sources).map(([srcName, srcData]) => {
          const srcStatus = (typeof srcData === 'object') ? (srcData.status || 'incorporated') : 'incorporated';
          const match = discItemsList.find(i => i.name === srcName);
          const discStatus = match ? (match.status || 'unknown') : 'unknown';
          return { name: srcName, status: srcStatus, discussion_status: discStatus };
        });
      }

      if (item.consult_references && typeof item.consult_references === 'object') {
        spec.consult_references = Object.entries(item.consult_references).map(([refName, refData]) => {
          const refStatus = (typeof refData === 'object') ? (refData.status || 'pending') : 'pending';
          return { name: refName, status: refStatus };
        });
      }

      spec.has_pending_sources = (spec.sources || []).some(s => s.status === 'pending');

      specifications.push(spec);
    }
  }

  // Actionable specs first, concluded specs last. Stable within each tier
  // (insertion order preserved), so the menu reads work-first.
  specifications.sort((a, b) => specSortRank(a) - specSortRank(b));

  // Concluded = completed with every source extracted. Drives the
  // "Manage completed specifications" submenu gate.
  const concludedCount = specifications.filter(
    s => s.status === 'completed' && !s.has_pending_sources
  ).length;

  // --- Cache (discussion-consolidation-analysis from manifest) ---
  const cacheEntries = [];

  for (const m of manifests) {
    const discPhase = phaseData(m, 'discussion');
    const cache = discPhase.analysis_cache;
    if (!cache || !cache.checksum) continue;

    const discDir = path.join(workflowsDir, m.name, 'discussion');
    const discFiles = listFiles(discDir, '.md');

    let status = 'stale';
    let reason = 'discussions have changed since cache was generated';

    if (discFiles.length > 0) {
      const currentChecksum = filesChecksum(discFiles.map(f => path.join(discDir, f)));
      if (cache.checksum === currentChecksum) {
        status = 'valid';
        reason = 'checksums match';
      }
    } else {
      reason = 'no discussions to compare';
    }

    cacheEntries.push({
      work_unit: m.name, status, reason,
      checksum: cache.checksum, generated: cache.generated || 'unknown',
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
    cache: { entries: cacheEntries },
    current_state: {
      discussions_checksum: discussionsChecksum,
      discussion_count: discCount,
      completed_count: completedCount,
      in_progress_count: inProgressCount,
      spec_count: specCount,
      proposed_count: proposedCount,
      concluded_count: concludedCount,
      has_discussions: discCount > 0,
      has_completed: completedCount > 0,
      has_specs: specCount > 0,
      has_proposed: proposedCount > 0,
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
      lines.push(`  ${s.name}: ${s.status}, type=${s.work_type}, has_pending_sources=${s.has_pending_sources}`);
      if (s.sources) {
        for (const src of s.sources) {
          lines.push(`    source: ${src.name} (${src.status}, discussion: ${src.discussion_status})`);
        }
      }
      if (s.consult_references) {
        for (const ref of s.consult_references) {
          lines.push(`    consult: ${ref.name} (${ref.status})`);
        }
      }
    }
  }
  lines.push('');

  lines.push('=== CACHE ===');
  if (result.cache.entries.length === 0) {
    lines.push('  (none)');
  } else {
    for (const c of result.cache.entries) {
      lines.push(`  ${c.work_unit}: ${c.status} (${c.reason})`);
    }
  }
  lines.push('');

  lines.push('=== STATE ===');
  const cs = result.current_state;
  lines.push(`discussions: ${cs.discussion_count} (${cs.completed_count} completed, ${cs.in_progress_count} in-progress)`);
  lines.push(`specs: ${cs.spec_count}, proposed: ${cs.proposed_count}, concluded: ${cs.concluded_count}, has_discussions: ${cs.has_discussions}, has_completed: ${cs.has_completed}`);
  if (cs.discussions_checksum) lines.push(`checksum: ${cs.discussions_checksum}`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2] || null;
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover, format };
