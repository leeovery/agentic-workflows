'use strict';

// ---------------------------------------------------------------------------
// Epic dashboard renderer.
//
// Assembles the epic state display — the box title, the three stage dividers
// (DISCOVERY / DEFINITION / DELIVERY), and one tree per phase — from a
// `buildEpicDetail`-shaped object. Layout comes from the generic renderer
// (render.cjs); content conventions from conventions.cjs; the epic-specific
// composition (lifecycle labels, count summaries, source/progress rows) lives
// here. The data-owner (discovery.cjs) calls this in-process and emits the
// finished block; nothing about the tree shape is left to the model.
// ---------------------------------------------------------------------------

const { box, signpost, renderTree } = require('../../workflow-render/scripts/render.cjs');
const { title, tag, derivedFrom, titlecase } = require('../../workflow-render/scripts/conventions.cjs');

// --- epic-specific content composition ---------------------------------------

// Discovery lifecycle → the `[label]` text, by lifecycle (tier supplies the glyph).
function lifecycleLabel(lifecycle, routing) {
  switch (lifecycle) {
    case 'ready_for_discussion': return 'research complete · ready for discussion';
    case 'researching': return 'researching';
    case 'discussing': return 'discussing';
    case 'decided': return 'decided';
    case 'handled': return 'handled · research fanned out';
    case 'cancelled': return 'cancelled';
    case 'fresh': return routing ? `fresh · routed to ${routing}` : 'fresh';
    default: return lifecycle;
  }
}

// The discovery header's count suffix, from map_summary + convergence_state.
function statusSuffix(detail) {
  if (detail.convergence_state === 'settled') return ' · all decided';
  const s = detail.map_summary || {};
  const buckets = [
    [s.decided, 'decided'], [s.in_flight, 'in flight'], [s.ready, 'ready'],
    [s.fresh, 'fresh'], [s.handled, 'handled'], [s.cancelled, 'cancelled'],
  ];
  const parts = buckets.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  return parts.length ? ' · ' + parts.join(' · ') : '';
}

// A build phase's `(N completed, M cancelled)` count summary; omits zero counts.
const STATUS_ORDER = ['completed', 'in-progress', 'cancelled', 'promoted'];
function countSummary(items) {
  const counts = {};
  for (const it of items) counts[it.status] = (counts[it.status] || 0) + 1;
  const ordered = [...STATUS_ORDER, ...Object.keys(counts).filter((k) => !STATUS_ORDER.includes(k))];
  const parts = ordered.filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`);
  return `(${parts.join(', ')})`;
}

// A specification source sub-row: `← Auth Flows [incorporated]`.
function sourceRow(src) {
  return `← ${titlecase(src.topic || src.name)} ${tag(src.status || 'pending')}`;
}

// An implementation progress sub-row.
function implProgress(item) {
  const n = Array.isArray(item.completed_tasks) ? item.completed_tasks.length : 0;
  if (item.current_phase != null) return `Phase ${item.current_phase}, ${n} task(s) completed`;
  if (n > 0) return `${n} task(s) completed`;
  return null;
}

// --- node builders -----------------------------------------------------------

function discoveryNodes(map) {
  return map.map((t) => {
    const body = [];
    if (t.summary) body.push(t.summary);
    if (t.source_provenance) body.push(derivedFrom(t.source_provenance));
    return {
      title: title({ glyph: t.tier, label: titlecase(t.name), tag: lifecycleLabel(t.lifecycle, t.routing) }),
      ...(body.length ? { body } : {}),
    };
  });
}

function buildNodes(items, phase) {
  return items.map((it) => {
    let line = title({ label: titlecase(it.name), tag: it.status });
    if (phase === 'planning' && it.format) line += ` · ${it.format}`;
    const node = { title: line };
    if (phase === 'specification' && Array.isArray(it.sources) && it.sources.length) {
      node.children = it.sources.map((src) => ({ title: sourceRow(src) }));
    }
    if (phase === 'implementation') {
      const prog = implProgress(it);
      if (prog) node.children = [{ title: prog }];
    }
    return node;
  });
}

// Stage-meta callout lines shown between the DISCOVERY divider and the header:
// seed / imports provenance (from the manifest) and new-arrival notices (passed
// in by the caller for the current boot-up).
function stageMetaCallouts(detail, newArrivals) {
  const lines = [];
  if (detail.seeds_count > 0) lines.push('· seeded from the inbox');
  const imp = detail.imports_count || 0;
  const mapLen = (detail.discovery_map || []).length;
  if (imp > 0 && imp !== mapLen) lines.push(`· ${imp} ${imp === 1 ? 'import' : 'imports'}`);
  const na = newArrivals || {};
  for (const [key, label] of [['research_analysis', 'research-analysis'], ['gap_analysis', 'gap-analysis']]) {
    if (Array.isArray(na[key]) && na[key].length) {
      lines.push(`⚑ ${na[key].length} new topic(s) added to the map from ${label}.`);
    }
  }
  return lines;
}

// --- assembly ----------------------------------------------------------------

// Append a stage's sub-header + tree blocks for each phase that has items.
function pushStage(out, detail, divider, phases, width) {
  const present = phases.filter((p) => detail.phases[p] && detail.phases[p].length);
  if (!present.length) return;
  out.push('', signpost(divider), '');
  present.forEach((phase, idx) => {
    out.push(`  ${phase.toUpperCase()} ${countSummary(detail.phases[phase])}`);
    out.push(renderTree(buildNodes(detail.phases[phase], phase), { width }).replace(/\n$/, ''));
    if (idx < present.length - 1) out.push('');
  });
}

// `epic` is a `discover()` epic entry: { name, detail }. Requires a non-empty
// discovery_map (the brand-new and no-map cases are handled by the caller).
function renderEpicDashboard(epic, { width = 72, newArrivals = {} } = {}) {
  const detail = epic.detail;
  const out = [];
  out.push(box(titlecase(epic.name)).replace(/\n+$/, ''));

  // DISCOVERY — always present here (the map is non-empty).
  out.push('', signpost('DISCOVERY'), '');
  const callouts = stageMetaCallouts(detail, newArrivals);
  if (callouts.length) {
    for (const c of callouts) out.push('  ' + c);
    out.push('');
  }
  out.push(`  RESEARCH & DISCUSSION (${detail.map_summary.total} topics${statusSuffix(detail)})`);
  out.push(renderTree(discoveryNodes(detail.discovery_map), { width }).replace(/\n$/, ''));

  pushStage(out, detail, 'DEFINITION', ['specification', 'planning'], width);
  pushStage(out, detail, 'DELIVERY', ['implementation', 'review'], width);

  return out.join('\n') + '\n';
}

module.exports = {
  renderEpicDashboard,
  lifecycleLabel, statusSuffix, countSummary, sourceRow, implProgress,
  stageMetaCallouts, discoveryNodes, buildNodes,
};
