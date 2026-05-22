'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadManifest,
  phaseItems,
  computeTopicLifecycle,
  computeMapSummary,
  computeSourceProvenance,
  TIER_RANK,
} = require('../../workflow-shared/scripts/discovery-utils.cjs');

function buildDiscoveryMap(manifest) {
  const inceptionItems = phaseItems(manifest, 'inception');
  if (inceptionItems.length === 0) return { map: [], summary: { total: 0, decided: 0, in_flight: 0, ready: 0, fresh: 0, cancelled: 0 } };
  const map = inceptionItems.map(item => {
    const { lifecycle, tier, current_phase } = computeTopicLifecycle(manifest, item.name);
    return {
      name: item.name,
      summary: item.summary || null,
      routing: item.routing || null,
      source: item.source || 'inception',
      source_provenance: computeSourceProvenance(item.source),
      lifecycle,
      tier,
      current_phase,
    };
  });
  map.sort((a, b) => {
    const ra = TIER_RANK[a.tier] != null ? TIER_RANK[a.tier] : 99;
    const rb = TIER_RANK[b.tier] != null ? TIER_RANK[b.tier] : 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  return { map, summary: computeMapSummary(map) };
}

function findLatestSessionLog(cwd, workUnit) {
  const dir = path.join(cwd, '.workflows', workUnit, 'inception');
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => /^session-\d+\.md$/.test(f)).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  const filename = files[files.length - 1];
  const fullPath = path.join(dir, filename);
  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
  const m = filename.match(/^session-(\d+)\.md$/);
  const number = parseInt(m[1], 10);

  // Detect Conclusion section status (placeholder = "(none)" on the first
  // non-empty line after the heading). An in-progress refinement log is the
  // resume signal used by refinement-session.md B. Resume Check.
  let conclusionText = '';
  const conclusionMatch = content.match(/##\s+Conclusion\s*\n([\s\S]*?)(?:\n##\s|$)/);
  if (conclusionMatch) {
    const body = conclusionMatch[1].trim();
    conclusionText = body.split('\n')[0].trim();
  }
  const isInProgress = conclusionText === '(none)';

  return {
    filename,
    relative_path: path.posix.join('.workflows', workUnit, 'inception', filename),
    number,
    is_refinement: number > 1,
    is_in_progress: isInProgress,
    conclusion_text: conclusionText,
  };
}

function discover(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) {
    return { error: `Work unit "${workUnit}" not found` };
  }
  const inceptionPhase = (manifest.phases || {}).inception || {};
  const dismissed = Array.isArray(inceptionPhase.dismissed) ? inceptionPhase.dismissed.slice() : [];
  const { map, summary } = buildDiscoveryMap(manifest);
  const latestSession = findLatestSessionLog(cwd, workUnit);
  const nextSessionNumber = latestSession ? latestSession.number + 1 : 1;
  return {
    work_unit: workUnit,
    discovery_map: map,
    map_summary: summary,
    dismissed,
    latest_session: latestSession,
    next_session_number: nextSessionNumber,
  };
}

function format(result) {
  if (result.error) {
    return `error: ${result.error}\n`;
  }
  const lines = [];
  lines.push(`=== INCEPTION DISCOVERY: ${result.work_unit} ===`);

  const s = result.map_summary;
  lines.push(`map_summary: ${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.ready} ready, ${s.fresh} fresh, ${s.cancelled} cancelled`);
  lines.push('');

  lines.push(`discovery_map (${result.discovery_map.length}):`);
  if (result.discovery_map.length === 0) {
    lines.push('  (empty)');
  } else {
    for (const t of result.discovery_map) {
      let line = `  - ${t.tier} ${t.name} [${t.lifecycle}]`;
      if (t.routing) line += ` routing=${t.routing}`;
      if (t.source && t.source !== 'inception') line += ` source=${t.source}`;
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

  lines.push('latest_session:');
  if (!result.latest_session) {
    lines.push('  (no session logs on disk)');
  } else {
    const ls = result.latest_session;
    lines.push(`  filename: ${ls.filename}`);
    lines.push(`  relative_path: ${ls.relative_path}`);
    lines.push(`  number: ${ls.number}`);
    lines.push(`  is_refinement: ${ls.is_refinement}`);
    lines.push(`  is_in_progress: ${ls.is_in_progress}`);
    lines.push(`  conclusion: ${ls.conclusion_text || '(empty)'}`);
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
