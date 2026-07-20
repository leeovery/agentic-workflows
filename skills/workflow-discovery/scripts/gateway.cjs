'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-discovery. Thin by design: the scoped
// discovery dump plus the map-view projection over one epic's discovery map.
//
//   gateway.cjs {work_unit}            → labelled dump (thin reasoning surface)
//   gateway.cjs map-view {work_unit}   → DATA + DISPLAY map snapshot
//   gateway.cjs map-view {work_unit} --proposed-file {path}
//                                        → synthesis overlay: the harvest's
//                                          proposed set (model-authored JSON)
//                                          rendered over the existing map
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const engine = require('../../workflow-engine/scripts/lib.cjs');
const { loadManifest } = engine.reads;
const {
  phaseItems,
  computeTopicLifecycle,
  computeMapSummary,
  computeSourceProvenance,
  computeAnalysisCacheStatus,
  compareMapRows,
  computeNeedsSequencing,
} = engine.derivations;

function buildDiscoveryMap(manifest) {
  const discoveryItems = phaseItems(manifest, 'discovery');
  if (discoveryItems.length === 0) return { map: [], summary: { total: 0, decided: 0, in_flight: 0, ready: 0, fresh: 0, handled: 0, cancelled: 0 }, needs_sequencing: false };
  const map = discoveryItems.map(item => {
    const { lifecycle, tier, current_phase, research_state } = computeTopicLifecycle(manifest, item.name);
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
      research_state,
    };
  });
  map.sort(compareMapRows);
  return { map, summary: computeMapSummary(map), needs_sequencing: computeNeedsSequencing(map) };
}

function listSessionLogs(cwd, workUnit) {
  const dir = path.join(cwd, '.workflows', workUnit, 'discovery', 'sessions');
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => /^session-\d+\.md$/.test(f)).sort();
  } catch {
    return [];
  }
  return files.map(filename => ({
    number: parseInt(filename.match(/^session-(\d+)\.md$/)[1], 10),
    path: path.posix.join('.workflows', workUnit, 'discovery', 'sessions', filename),
  }));
}

function findLatestSessionLog(cwd, workUnit) {
  const logs = listSessionLogs(cwd, workUnit);
  return logs.length === 0 ? null : { number: logs[logs.length - 1].number };
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
    session_logs: listSessionLogs(cwd, workUnit),
    analysis_caches: analysisCaches,
    next_session_number: nextSessionNumber,
  };
}

// The thin scoped dump: the map (rows + counts), the dismissed list, the
// session-log index, analysis-cache statuses, and the next session number —
// exactly what the session loop, map operations, continuity load, and the
// shared topic-discovery dispatch read. Rendering is map-view's concern.
function format(result) {
  if (result.error) {
    return `error: ${result.error}\n`;
  }
  const lines = [];
  lines.push(`=== DISCOVERY: ${result.work_unit} ===`);

  const s = result.map_summary;
  lines.push(`map_summary: ${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.ready} ready, ${s.fresh} fresh, ${s.handled} handled, ${s.cancelled} cancelled`);

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

  lines.push(`dismissed (${result.dismissed.length}):`);
  if (result.dismissed.length === 0) {
    lines.push('  (none)');
  } else {
    for (const name of result.dismissed) {
      lines.push(`  - ${name}`);
    }
  }

  const sessionLogs = result.session_logs || [];
  lines.push(`session_logs (${sessionLogs.length}):`);
  if (sessionLogs.length === 0) {
    lines.push('  (none)');
  } else {
    for (const log of sessionLogs) {
      lines.push(`  - ${String(log.number).padStart(3, '0')} ${log.path}`);
    }
  }

  const caches = result.analysis_caches || {};
  const cacheStatus = (kind) => ((caches[kind] || { status: 'absent' }).status);
  lines.push(`analysis_caches: research_analysis=${cacheStatus('research_analysis')}, gap_analysis=${cacheStatus('gap_analysis')}`);

  lines.push(`next_session_number: ${String(result.next_session_number).padStart(3, '0')}`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// map-view — the Discovery Map snapshot: DATA (counts, rows, and — with a
// proposed set — the per-name flags the persist step routes on) + DISPLAY
// (the projection). No MENU: the confirm gate is static prose in the skill.
// ---------------------------------------------------------------------------

/**
 * Parse and validate the harvest's proposed-topics JSON: a non-empty array of
 * `{name, routing, summary}`. Model-authored judgment; shape errors are loud.
 * @param {string} cwd @param {string} file
 * @returns {{name: string, routing: string, summary: string}[]}
 */
function readProposedFile(cwd, file) {
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch {
    throw new Error(`proposed-topics file not found: ${file}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`proposed-topics file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('proposed-topics file must be a non-empty JSON array of {name, routing, summary}');
  }
  for (const [i, t] of parsed.entries()) {
    for (const field of ['name', 'routing', 'summary']) {
      if (!t || typeof t[field] !== 'string' || t[field].trim() === '') {
        throw new Error(`proposed topic ${i} is missing "${field}" (each entry needs name, routing, summary)`);
      }
    }
  }
  return parsed;
}

function mapView(workUnit, ...rest) {
  if (!workUnit || workUnit.startsWith('--')) {
    throw new Error('Usage: gateway.cjs map-view <work_unit> [--proposed-file <path>]');
  }
  const cwd = process.cwd();
  let proposedFile = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--proposed-file' && rest[i + 1]) proposedFile = rest[++i];
    else throw new Error(`map-view: unexpected argument "${rest[i]}"`);
  }

  const result = discover(cwd, workUnit);
  if (result.error) throw new Error(result.error);
  const map = { rows: result.discovery_map, summary: result.map_summary };

  const dataLines = [`work_unit: ${workUnit}`, `mode: ${proposedFile ? 'synthesis' : 'map'}`];
  const s = result.map_summary;
  dataLines.push(`map: ${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.ready} ready, ${s.fresh} fresh, ${s.handled} handled, ${s.cancelled} cancelled`);

  let display;
  if (proposedFile) {
    const proposed = readProposedFile(cwd, proposedFile);
    // Per-name flags the flow routes on: an active collision must be resolved
    // before the gate; a dismissed match needs --force-dismissed at persist.
    dataLines.push(`proposed (${proposed.length}):`);
    for (const t of proposed) {
      const flags = [
        `routing=${t.routing}`,
        `exists_on_map=${result.discovery_map.some((r) => r.name === t.name)}`,
        `matches_dismissed=${result.dismissed.includes(t.name)}`,
        `legal_name=${!/[./]/.test(t.name)}`,
      ];
      dataLines.push(`  ${t.name} ${flags.join(' ')}`);
    }
    display = engine.project.discoverySynthesisView(workUnit, map, proposed);
  } else {
    display = engine.project.discoveryMapView(workUnit, map);
  }

  return engine.gateway.dataBlock(dataLines.join('\n')) + '\n' + engine.gateway.displayBlock(display);
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => {
      process.stderr.write('Error: work unit name required\nUsage: gateway.cjs <work_unit> | gateway.cjs map-view <work_unit> [--proposed-file <path>]\n');
      process.exit(1);
      return ''; // unreachable; keeps the handler's return type uniform
    },
    'map-view': (workUnit, ...rest) => {
      try {
        return mapView(workUnit, ...rest);
      } catch (err) {
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
        return ''; // unreachable
      }
    },
    // Scoped dump form: `gateway.cjs {work_unit}` — exit 2 on an unknown
    // work unit so calling flows fail loudly.
    fallback: (workUnit) => {
      const result = discover(process.cwd(), workUnit);
      if (result.error) {
        process.stdout.write(format(result));
        process.exit(2);
      }
      return format(result);
    },
  });
}

module.exports = { discover, format, listSessionLogs };
