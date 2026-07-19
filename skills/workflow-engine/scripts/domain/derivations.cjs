'use strict';

// ---------------------------------------------------------------------------
// Domain ring: shared derivations — phase joins, topic lifecycle, next-phase
// computation, map ordering, and analysis-cache status. Pure over loaded
// manifests: same input, same answer. Generic loads come from domain/reads —
// derivations may require reads; never the reverse.
// ---------------------------------------------------------------------------

const path = require('path');
const { fileExists, filesChecksum } = require('./reads.cjs');

function phaseStatus(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (p.items && typeof p.items === 'object') {
    const keys = Object.keys(p.items);
    if (keys.length === 0) return null;
    if (keys.length === 1) {
      const status = (p.items[keys[0]] || {}).status || null;
      return (status === 'cancelled' || status === 'superseded' || status === 'proposed') ? null : status;
    }
    const statuses = keys.map(k => (p.items[k] || {}).status).filter(s => s && s !== 'cancelled' && s !== 'superseded' && s !== 'proposed');
    if (statuses.length === 0) return null;
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'in-progress')) return 'in-progress';
    return statuses[0];
  }
  return null;
}

function phaseItems(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (!p.items || typeof p.items !== 'object') return [];
  return Object.entries(p.items).map(([name, data]) => ({ name, ...data }));
}

function phaseData(manifest, phase) {
  return (manifest.phases || {})[phase] || {};
}

function computeNextPhase(manifest) {
  const wt = manifest.work_type;

  const ps = (phase) => phaseStatus(manifest, phase);

  // Quick-fix has its own short pipeline: scoping → implementation → review
  if (wt === 'quick-fix') {
    if (ps('review') === 'completed') return { next_phase: 'done', phase_label: 'pipeline complete' };
    if (ps('review') === 'in-progress') return { next_phase: 'review', phase_label: 'review (in-progress)' };
    if (ps('implementation') === 'completed') return { next_phase: 'review', phase_label: 'ready for review' };
    if (ps('implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
    if (ps('scoping') === 'completed') return { next_phase: 'implementation', phase_label: 'ready for implementation' };
    if (ps('scoping') === 'in-progress') return { next_phase: 'scoping', phase_label: 'scoping (in-progress)' };
    return { next_phase: 'scoping', phase_label: 'ready for scoping' };
  }

  if (ps('review') === 'completed') {
    // Phase aggregation only covers topics that have reached the phase. For
    // an epic, one topic completing review must not mark the whole epic done
    // — completion is the explicit status flip, never derived.
    if (wt === 'epic') {
      return { next_phase: 'review', phase_label: 'review completed for current topics' };
    }
    return { next_phase: 'done', phase_label: 'pipeline complete' };
  }
  if (ps('review') === 'in-progress') {
    return { next_phase: 'review', phase_label: 'review (in-progress)' };
  }
  if (ps('implementation') === 'completed') {
    return { next_phase: 'review', phase_label: 'ready for review' };
  }
  if (ps('implementation') === 'in-progress') {
    return {
      next_phase: 'implementation',
      phase_label: 'implementation (in-progress)',
    };
  }
  if (ps('planning') === 'completed') {
    return { next_phase: 'implementation', phase_label: 'ready for implementation' };
  }
  if (ps('planning') === 'in-progress') {
    return { next_phase: 'planning', phase_label: 'planning (in-progress)' };
  }
  if (ps('specification') === 'completed') {
    if (wt === 'cross-cutting') {
      return { next_phase: 'done', phase_label: 'pipeline complete' };
    }
    return { next_phase: 'planning', phase_label: 'ready for planning' };
  }
  if (ps('specification') === 'in-progress') {
    return {
      next_phase: 'specification',
      phase_label: 'specification (in-progress)',
    };
  }

  if (wt === 'bugfix') {
    if (ps('investigation') === 'completed') {
      return {
        next_phase: 'specification',
        phase_label: 'ready for specification',
      };
    }
    if (ps('investigation') === 'in-progress') {
      return {
        next_phase: 'investigation',
        phase_label: 'investigation (in-progress)',
      };
    }
    return { next_phase: 'investigation', phase_label: 'ready for investigation' };
  }

  if (ps('discussion') === 'completed') {
    return { next_phase: 'specification', phase_label: 'ready for specification' };
  }
  if (ps('discussion') === 'in-progress') {
    return { next_phase: 'discussion', phase_label: 'discussion (in-progress)' };
  }

  // Research is optional for both epic and feature (not bugfix)
  if (wt !== 'bugfix') {
    if (ps('research') === 'in-progress') {
      return { next_phase: 'research', phase_label: 'research (in-progress)' };
    }
    if (ps('research') === 'completed') {
      return { next_phase: 'discussion', phase_label: 'ready for discussion' };
    }
  }

  return { next_phase: 'discussion', phase_label: 'ready for discussion' };
}

// Pipeline phases whose aggregate status is in-progress, in pipeline order.
// Feeds the finalising derivation: computeNextPhase short-circuits on a
// completed review, so a reopened earlier phase (mid-revisit) would otherwise
// masquerade as a finished pipeline.
function computeInProgressPhases(manifest, pipeline) {
  return pipeline.filter((phase) => phaseStatus(manifest, phase) === 'in-progress');
}

/**
 * The sorted set of existing completed input files for one analysis kind —
 * completed research files for `research-analysis`, completed research plus
 * completed discussion files for `gap-analysis`. The one collection both
 * cache sides use: the read (computeAnalysisCacheStatus) and the write
 * (engine cache stamp) checksum the same list, so they can never drift.
 * Returns absolute paths, sorted.
 */
function collectAnalysisInputs(manifest, workflowsDir, kind) {
  if (!manifest || !manifest.name) return [];
  const wuDir = path.join(workflowsDir, manifest.name);
  const completedFiles = (phase) => phaseItems(manifest, phase)
    .filter(it => it.status === 'completed')
    .map(it => path.join(wuDir, phase, `${it.name}.md`))
    .filter(p => fileExists(p));

  if (kind === 'research-analysis') {
    return completedFiles('research').sort();
  }
  if (kind === 'gap-analysis') {
    return [...completedFiles('research'), ...completedFiles('discussion')].sort();
  }
  return [];
}

function computeAnalysisCacheStatus(manifest, workflowsDir, kind) {
  if (!manifest || !manifest.name) return { status: 'absent', generated: null, files: [] };

  if (kind === 'research-analysis') {
    const cache = ((manifest.phases || {}).research || {}).analysis_cache;
    const completedFiles = collectAnalysisInputs(manifest, workflowsDir, kind);

    if (!cache || !cache.checksum) {
      return completedFiles.length > 0
        ? { status: 'stale', generated: null, files: [], reason: 'no cache exists' }
        : { status: 'absent', generated: null, files: [] };
    }

    if (completedFiles.length === 0) {
      return { status: 'absent', generated: cache.generated || null, files: Array.isArray(cache.files) ? cache.files : [], reason: 'no completed research files' };
    }

    const currentChecksum = filesChecksum(completedFiles);
    const status = cache.checksum === currentChecksum ? 'valid' : 'stale';
    return {
      status,
      generated: cache.generated || null,
      files: Array.isArray(cache.files) ? cache.files : [],
      reason: status === 'valid' ? 'checksums match' : 'completed research has changed since cache was generated',
    };
  }

  if (kind === 'gap-analysis') {
    const cache = ((manifest.phases || {}).discovery || {}).gap_analysis_cache;
    const inputPaths = collectAnalysisInputs(manifest, workflowsDir, kind);

    if (!cache || !cache.checksum) {
      return inputPaths.length > 0
        ? { status: 'stale', generated: null, files: [], reason: 'no cache exists' }
        : { status: 'absent', generated: null, files: [] };
    }

    if (inputPaths.length === 0) {
      return { status: 'absent', generated: cache.generated || null, files: Array.isArray(cache.input_files) ? cache.input_files : [], reason: 'no completed research or discussion files' };
    }

    const currentChecksum = filesChecksum(inputPaths);
    const status = cache.checksum === currentChecksum ? 'valid' : 'stale';
    return {
      status,
      generated: cache.generated || null,
      files: Array.isArray(cache.input_files) ? cache.input_files : [],
      reason: status === 'valid' ? 'checksums match' : 'completed research/discussion has changed since gap analysis was generated',
    };
  }

  return { status: 'absent', generated: null, files: [] };
}

const TIER_RANK = { '→': 0, '◐': 1, '✓': 2, '○': 3, '⊙': 4, '⊘': 5 };

// Shared row comparator for the discovery map: tier rank first, then suggested
// execution order ascending (null orders sort last), then name as final fallback.
function compareMapRows(a, b) {
  const ra = TIER_RANK[a.tier] != null ? TIER_RANK[a.tier] : 99;
  const rb = TIER_RANK[b.tier] != null ? TIER_RANK[b.tier] : 99;
  if (ra !== rb) return ra - rb;
  const oa = a.order == null ? Infinity : a.order;
  const ob = b.order == null ? Infinity : b.order;
  if (oa !== ob) return oa - ob;
  return a.name.localeCompare(b.name);
}

// True when any live (non-cancelled, non-handled) map item lacks a suggested
// execution order. Handled topics are non-actionable — they get no order, the
// same as cancelled. Programmatic detection — the assignment of order values
// stays with Claude.
function computeNeedsSequencing(mapItems) {
  return mapItems.some(it => it.tier !== '⊘' && it.tier !== '⊙' && it.order == null);
}

// `research_state` rides along on every result — the research item's raw
// status (null when no research item exists), so labels can be derived from
// the actual per-phase state (a handled topic without research, superseded
// research) rather than assumed from the lifecycle alone.
function computeTopicLifecycle(manifest, topicName) {
  const discovery = phaseItems(manifest, 'discovery').find(i => i.name === topicName);
  const research = phaseItems(manifest, 'research').find(i => i.name === topicName);
  const discussion = phaseItems(manifest, 'discussion').find(i => i.name === topicName);

  const rs = research ? research.status ?? null : null;
  const ds = discussion ? discussion.status : null;

  // Stored marker wins over name-matching: a research topic that fanned out
  // into differently-named discussions is terminal, with no next action. Read
  // only the item's own field — never inspect siblings or provenance.
  if (discovery && discovery.handled === true) {
    return { lifecycle: 'handled', tier: '⊙', current_phase: null, research_state: rs };
  }

  if (ds === 'completed') {
    return { lifecycle: 'decided', tier: '✓', current_phase: 'discussion', research_state: rs };
  }
  if (ds === 'in-progress') {
    return { lifecycle: 'discussing', tier: '◐', current_phase: 'discussion', research_state: rs };
  }
  if (rs === 'completed') {
    return { lifecycle: 'ready_for_discussion', tier: '→', current_phase: 'research', research_state: rs };
  }
  if (rs === 'in-progress') {
    return { lifecycle: 'researching', tier: '◐', current_phase: 'research', research_state: rs };
  }
  // All attempted phase items are cancelled (both research and discussion items exist
  // and are cancelled). Single-cancelled (only research, or only discussion) falls
  // through to fresh — the alternate path remains open.
  if (rs === 'cancelled' && ds === 'cancelled') {
    return { lifecycle: 'cancelled', tier: '⊘', current_phase: null, research_state: rs };
  }
  // Superseded research with no discussion: the topic's research lineage is
  // closed but a discussion path remains open. Render as ready-for-discussion
  // — the next available action is to discuss.
  if (rs === 'superseded' && !ds) {
    return { lifecycle: 'ready_for_discussion', tier: '→', current_phase: 'research', research_state: rs };
  }
  return { lifecycle: 'fresh', tier: '○', current_phase: null, research_state: rs };
}

function computeNextAction(routing, lifecycle) {
  switch (lifecycle) {
    case 'fresh':
      return routing === 'research' ? 'start_research' : 'start_discussion';
    case 'researching':
      return 'continue_research';
    case 'ready_for_discussion':
      return 'start_discussion_after_research';
    case 'discussing':
      return 'continue_discussion';
    case 'decided':
    case 'cancelled':
    case 'handled':
    default:
      return null;
  }
}

function computeMapSummary(items) {
  const counts = { total: items.length, decided: 0, in_flight: 0, ready: 0, fresh: 0, handled: 0, cancelled: 0 };
  for (const it of items) {
    switch (it.tier) {
      case '✓': counts.decided++; break;
      case '◐': counts.in_flight++; break;
      case '→': counts.ready++; break;
      case '○': counts.fresh++; break;
      case '⊙': counts.handled++; break;
      case '⊘': counts.cancelled++; break;
    }
  }
  return counts;
}

function computeSourceProvenance(source) {
  if (!source || source === 'discovery') return null;
  const parts = source.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const labels = parts.map(p => {
    const colonIdx = p.indexOf(':');
    return colonIdx > 0 ? p.slice(colonIdx + 1) : p;
  });
  return `from ${labels.join(' + ')}`;
}

module.exports = {
  phaseData,
  phaseItems,
  phaseStatus,
  computeNextPhase,
  computeInProgressPhases,
  collectAnalysisInputs,
  computeAnalysisCacheStatus,
  computeTopicLifecycle,
  computeNextAction,
  computeMapSummary,
  computeSourceProvenance,
  compareMapRows,
  computeNeedsSequencing,
  TIER_RANK,
};
