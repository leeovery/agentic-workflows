'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadManifest,
  phaseItems,
  computeTopicLifecycle,
  computeMapSummary,
  computeSourceProvenance,
  computeAnalysisCacheStatus,
  compareMapRows,
  computeNeedsSequencing,
} = require('../../workflow-shared/scripts/discovery-utils.cjs');

function buildDiscoveryMap(manifest) {
  const discoveryItems = phaseItems(manifest, 'discovery');
  if (discoveryItems.length === 0) return { map: [], summary: { total: 0, decided: 0, in_flight: 0, ready: 0, fresh: 0, cancelled: 0 }, needs_sequencing: false };
  const map = discoveryItems.map(item => {
    const { lifecycle, tier, current_phase } = computeTopicLifecycle(manifest, item.name);
    return {
      name: item.name,
      summary: item.summary || null,
      description: item.description || null,
      routing: item.routing || null,
      source: item.source || 'discovery',
      source_provenance: computeSourceProvenance(item.source),
      order: item.order ?? null,
      lifecycle,
      tier,
      current_phase,
    };
  });
  map.sort(compareMapRows);
  return { map, summary: computeMapSummary(map), needs_sequencing: computeNeedsSequencing(map) };
}

function findLatestSessionLog(cwd, workUnit) {
  const dir = path.join(cwd, '.workflows', workUnit, 'discovery');
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => /^session-\d+\.md$/.test(f)).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  const filename = files[files.length - 1];
  const m = filename.match(/^session-(\d+)\.md$/);
  const number = parseInt(m[1], 10);
  return { number };
}

function discover(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) {
    return { error: `Work unit "${workUnit}" not found` };
  }
  const discoveryPhase = (manifest.phases || {}).discovery || {};
  const dismissed = Array.isArray(discoveryPhase.dismissed) ? discoveryPhase.dismissed.slice() : [];
  const activeSession = (typeof discoveryPhase.active_session === 'string' && discoveryPhase.active_session !== '')
    ? discoveryPhase.active_session
    : null;
  const { map, summary, needs_sequencing } = buildDiscoveryMap(manifest);
  const latestSession = findLatestSessionLog(cwd, workUnit);
  const nextSessionNumber = latestSession ? latestSession.number + 1 : 1;
  const workflowsDir = path.join(cwd, '.workflows');
  const analysisCaches = {
    research_analysis: computeAnalysisCacheStatus(manifest, workflowsDir, 'research-analysis'),
    gap_analysis: computeAnalysisCacheStatus(manifest, workflowsDir, 'gap-analysis'),
  };
  return {
    work_unit: workUnit,
    discovery_map: map,
    map_summary: summary,
    needs_sequencing,
    dismissed,
    active_session: activeSession,
    analysis_caches: analysisCaches,
    next_session_number: nextSessionNumber,
  };
}

function format(result) {
  if (result.error) {
    return `error: ${result.error}\n`;
  }
  const lines = [];
  lines.push(`=== DISCOVERY DISCOVERY: ${result.work_unit} ===`);

  const s = result.map_summary;
  lines.push(`map_summary: ${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.ready} ready, ${s.fresh} fresh, ${s.cancelled} cancelled`);
  lines.push(`needs_sequencing: ${result.needs_sequencing}`);
  lines.push('');

  lines.push(`discovery_map (${result.discovery_map.length}):`);
  if (result.discovery_map.length === 0) {
    lines.push('  (empty)');
  } else {
    for (const t of result.discovery_map) {
      let line = `  - ${t.tier} ${t.name} [${t.lifecycle}]`;
      if (t.routing) line += ` routing=${t.routing}`;
      if (t.source && t.source !== 'discovery') line += ` source=${t.source}`;
      if (t.current_phase) line += ` phase=${t.current_phase}`;
      if (t.summary) line += ` — ${t.summary}`;
      lines.push(line);
    }
  }
  lines.push('');

  lines.push(`dismissed (${result.dismissed.length}):`);
  if (result.dismissed.length === 0) {
    lines.push('  (none)');
  } else {
    for (const name of result.dismissed) {
      lines.push(`  - ${name}`);
    }
  }
  lines.push('');

  lines.push(`active_session: ${result.active_session || '(none)'}`);
  lines.push('');

  lines.push('analysis_caches:');
  const caches = result.analysis_caches || {};
  for (const kind of ['research_analysis', 'gap_analysis']) {
    const c = caches[kind] || { status: 'absent' };
    let line = `  ${kind}: ${c.status}`;
    if (c.generated) line += ` (generated ${c.generated})`;
    if (c.reason) line += ` — ${c.reason}`;
    lines.push(line);
  }
  lines.push('');

  lines.push(`next_session_number: ${String(result.next_session_number).padStart(3, '0')}`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2];
  if (!workUnit) {
    process.stderr.write('Error: work unit name required\nUsage: discovery.cjs <work_unit>\n');
    process.exit(1);
  }
  const result = discover(process.cwd(), workUnit);
  process.stdout.write(format(result));
  if (result.error) {
    process.exit(2);
  }
}

module.exports = { discover, format };
