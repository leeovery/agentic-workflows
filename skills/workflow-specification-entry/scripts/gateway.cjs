'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-specification-entry. Thin by design:
// scenario derivation and rendering live in the engine's domain ring; this
// script builds the discovery result, parses the consult-hint doc (its one
// piece of file IO the engine stays blind to), and sections the output.
//
//   gateway.cjs                        → minimal state line, all work units
//   gateway.cjs {work_unit}            → DATA only, one work unit — the entry's routing read
//   gateway.cjs view {work_unit}       → DATA (+ TITLE + DISPLAY + MENU) snapshot
//   gateway.cjs completed-menu {work_unit} → concluded-specs sub-view
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const engine = require('../../workflow-engine/scripts/lib.cjs');
const { loadActiveManifests, listFiles, filesChecksum, fileExists } = engine.reads;
const { phaseItems, phaseData, sourceRows, specGroupsSources, lockingSpecs } = engine.derivations;
const { discoverySpec } = engine.detail;

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
      // Cancelled is closed and postponed has left for the roadmap; triaged
      // is pre-live (a stub of parked rerouted concerns, never discussed) —
      // none of the three is a discussion to count.
      if (item.status === 'cancelled' || item.status === 'postponed' || item.status === 'triaged') continue;
      discCount++;
      if (item.status === 'completed') completedCount++;
      else if (item.status === 'in-progress') inProgressCount++;

      // The discussion's individual spec — the first started specification
      // sourcing it; a proposed grouping is never one.
      const [covering] = lockingSpecs(m, item.name);
      const individual = covering && specItemsList.find(s => s.name === covering);

      discussions.push({
        name: item.name, work_unit: m.name, status: item.status || 'unknown',
        work_type: m.work_type, has_individual_spec: Boolean(individual),
        ...(individual && { spec_status: individual.status }),
      });
    }
  }

  // --- Specifications ---
  // Classify by status, not file presence. Materialized specs
  // (in-progress/completed/promoted) are file-backed and count toward spec_count.
  // Proposed groupings live only in the manifest — no file on disk — and count
  // toward proposed_count. Both land in specifications[]. A cancelled
  // specification groups nothing and lands in cancelled_specifications[]
  // instead — its key stays reserved, and its sources name what it grouped.
  const specifications = [];
  const cancelledSpecifications = [];
  let specCount = 0;
  let proposedCount = 0;

  for (const m of manifests) {
    for (const item of phaseItems(m, 'specification')) {
      if (item.status === 'cancelled') {
        cancelledSpecifications.push({ name: item.name, work_unit: m.name, sources: sourceRows(item.sources).map(([name]) => name) });
      }
      if (!specGroupsSources(item)) continue;
      const spec = { ...discoverySpec(m, item.name, item), work_unit: m.name, work_type: m.work_type };

      if (spec.status === 'proposed') {
        proposedCount++;
      } else {
        const specFile = path.join(workflowsDir, m.name, 'specification', item.name, 'specification.md');
        if (!fileExists(specFile)) continue;
        specCount++;
      }

      if (Number.isInteger(item.order)) spec.order = item.order;
      if (item.superseded_by) spec.superseded_by = item.superseded_by;

      specifications.push(spec);
    }
  }

  // Actionable specs first, concluded specs last. The build order breaks
  // ties within each tier; unordered specs keep insertion order behind the
  // ordered ones, so the menu reads work-first, then build-first.
  const orderOf = (spec) => (Number.isInteger(spec.order) ? spec.order : Infinity);
  specifications.sort((a, b) => (specSortRank(a) - specSortRank(b))
    || (orderOf(a) === orderOf(b) ? 0 : orderOf(a) - orderOf(b)));

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
    cancelled_specifications: cancelledSpecifications,
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

// The bare invocation has no prose consumer: it answers with the one
// decision-ready counts line, in the view DATA's vocabulary.
function format(result) {
  const cs = result.current_state;
  return [
    '=== STATE ===',
    `counts: discussions=${cs.discussion_count} completed=${cs.completed_count} in_progress=${cs.in_progress_count} specs=${cs.spec_count} proposed=${cs.proposed_count} concluded=${cs.concluded_count}`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// View verbs — the scenario snapshot and the concluded-specs sub-view.
// ---------------------------------------------------------------------------

// Consult-slice hints from the work unit's consolidation-analysis doc: each
// `### {Grouping}` section's `**Consult**: {ref} — {hint}` lines, keyed by
// the grouping's kebab-case name. The manifest holds the authoritative
// grouping→source mapping; this doc only enriches consult rows.
function consultHints(cwd, workUnit) {
  const file = path.join(cwd, '.workflows', workUnit, '.state', 'discussion-consolidation-analysis.md');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return {}; }
  const hints = {};
  let current = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) { current = engine.conventions.kebabcase(heading[1]); continue; }
    const consult = current && line.match(/^\*\*Consult\*\*:\s*(.+)$/);
    if (consult) {
      const [ref, ...rest] = consult[1].split('—');
      const name = ref.trim();
      if (name) (hints[current] = hints[current] || []).push({ name, hint: rest.join('—').trim() });
    }
  }
  return hints;
}

function buildDetail(cwd, workUnit) {
  if (!workUnit) throw new Error('Usage: gateway.cjs [view|completed-menu] {work_unit}');
  const result = discover(cwd, workUnit);
  return { result, detail: engine.detail.specificationDetail(workUnit, result, { consultHints: consultHints(cwd, workUnit) }) };
}

// The DATA body: scenario + flags, the discussion/spec detail the downstream
// confirmations reason from, and the ACTIONS key table when a menu exists.
function viewData(result, detail, keys) {
  const cs = result.current_state;
  const lines = [];
  lines.push(`scenario: ${detail.scenario}`);
  lines.push(`work_unit: ${detail.work_unit}`);
  lines.push(`counts: discussions=${cs.discussion_count} completed=${cs.completed_count} in_progress=${cs.in_progress_count} specs=${cs.spec_count} proposed=${cs.proposed_count} concluded=${cs.concluded_count}`);
  lines.push(`cache_status: ${detail.cache_status}`);
  lines.push(`discussions_checksum: ${cs.discussions_checksum || '(none)'}`);
  if (detail.single) {
    lines.push(`single_variant: ${detail.single.variant}`);
    lines.push(`verb: ${detail.single.verb}`);
    lines.push(`proceed_name: ${detail.single.proceed_name}`);
  }
  lines.push('discussions:');
  if (result.discussions.length === 0) lines.push('  (none)');
  for (const d of result.discussions) {
    lines.push(`  ${d.name}: ${d.status}${d.has_individual_spec ? `, individual spec: ${d.spec_status}` : ''}`);
  }
  lines.push('specifications:');
  if (result.specifications.length === 0) lines.push('  (none)');
  const hintRows = new Map();
  for (const row of [...detail.actionable, ...detail.concluded]) hintRows.set(row.name, row);
  for (const s of result.specifications) {
    const row = hintRows.get(s.name);
    const blockedBy = row && row.blocked ? `, blocked_by=${row.open_sources.join(',')}` : '';
    lines.push(`  ${s.name}: ${s.status}, has_pending_sources=${s.has_pending_sources}${blockedBy}`);
    for (const src of s.sources || []) {
      lines.push(`    source: ${src.name} (${src.status}, discussion: ${src.discussion_status})`);
    }
    for (const c of (row && row.consult) || []) {
      lines.push(`    consult: ${c.name} (${c.status}${c.hint ? ` — ${c.hint}` : ''})`);
    }
  }
  lines.push('cancelled_specifications:');
  if (result.cancelled_specifications.length === 0) lines.push('  (none)');
  for (const s of result.cancelled_specifications) {
    lines.push(`  ${s.name}: sources ${s.sources.join(', ') || '(none)'}`);
  }
  lines.push(`unassigned_discussions: ${detail.unassigned.join(', ') || '(none)'}`);
  lines.push(`in_progress_discussions: ${detail.in_progress_discussions.join(', ') || '(none)'}`);
  if (keys.length > 0) {
    lines.push('ACTIONS (key  action  topic  verb):');
    for (const k of keys) {
      lines.push(`  ${k.key}  ${k.action}  ${k.topic || '—'}  ${k.verb || '—'}`);
    }
  }
  return lines.join('\n');
}

// The entry's routing read: the scenario and the detail the confirmations
// reason from, with no menu — a display a scenario routes to fetches its own
// snapshot where it shows it. A name with no active work unit behind it is
// refused, never read as a unit with nothing in it.
function scoped(cwd, workUnit) {
  if (!loadActiveManifests(cwd).some((m) => m.name === workUnit)) {
    throw new Error(`no active work unit "${workUnit}"`);
  }
  const { result, detail } = buildDetail(cwd, workUnit);
  return engine.gateway.dataBlock(viewData(result, detail, []));
}

// One snapshot: reasoning DATA always; DISPLAY and MENU when the scenario
// renders them (analysis-rerun routes without either).
function view(workUnit) {
  const { result, detail } = buildDetail(process.cwd(), workUnit);
  const menu = engine.project.specificationMenu(detail);
  const display = engine.project.specificationDisplay(detail);
  const parts = [engine.gateway.dataBlock(viewData(result, detail, menu.keys))];
  if (display) {
    parts.push(engine.gateway.titleBlock(engine.project.SPEC_TITLE));
    parts.push(engine.gateway.displayBlock(display));
  }
  if (menu.rendered) parts.push(engine.gateway.menuBlock(menu.rendered));
  return parts.join('\n');
}

// The concluded-specs sub-view: keys table as DATA, the view's heading as
// TITLE, the spec list as DISPLAY, the Refine pick menu as MENU.
function completedMenu(workUnit) {
  const { detail } = buildDetail(process.cwd(), workUnit);
  const sub = engine.project.specificationCompletedMenu(detail);
  const dataLines = [`work_unit: ${detail.work_unit}`, 'ACTIONS (key  action  topic  verb):'];
  for (const k of sub.keys) {
    dataLines.push(`  ${k.key}  ${k.action}  ${k.topic || '—'}  ${k.verb || '—'}`);
  }
  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.titleBlock(sub.title),
    engine.gateway.displayBlock(sub.display),
    engine.gateway.menuBlock(sub.rendered),
  ].join('\n');
}

const USAGE = 'Usage: gateway.cjs | gateway.cjs {work_unit} | gateway.cjs view {work_unit} | gateway.cjs completed-menu {work_unit}';

/** Reject the call: the reason to stderr, exit 1. @param {string} message @returns {string} */
function reject(message) {
  process.stderr.write(`gateway: ${message}\n`);
  process.exit(1);
  return ''; // unreachable; keeps the handler's return type uniform
}

/** The routing read, refused loudly on excess arguments or an unknown unit. @param {string} workUnit @param {...string} rest @returns {string} */
function routingRead(workUnit, ...rest) {
  if (rest.length > 0) return reject(`unknown verb "${workUnit}"\n${USAGE}`);
  try {
    return scoped(process.cwd(), workUnit);
  } catch (err) {
    return reject(err instanceof Error ? err.message : String(err));
  }
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => format(discover(process.cwd())),
    view,
    'completed-menu': completedMenu,
    fallback: routingRead,
  });
}

module.exports = { discover, format, scoped };
