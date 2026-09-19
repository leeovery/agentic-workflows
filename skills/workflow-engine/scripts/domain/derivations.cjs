'use strict';

// ---------------------------------------------------------------------------
// Domain ring: shared derivations — phase joins, topic lifecycle, next-phase
// computation, map ordering, and analysis-cache status. Pure over loaded
// manifests: same input, same answer. Generic loads come from domain/reads —
// derivations may require reads; never the reverse.
// ---------------------------------------------------------------------------

const path = require('path');
const { fileExists, filesChecksum, countFiles } = require('./reads.cjs');
const { WORK_TYPE_PIPELINES, DERIVED_PHASES, TERMINAL_STATUSES, EXPERIMENT_SPAWN_PHASES, EXPERIMENT_TERMINAL_STATUSES, VALID_PHASE_STATUSES, compareExperimentIds } = require('../kernel/manifest-schema.cjs');

function phaseStatus(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (p.items && typeof p.items === 'object') {
    const keys = Object.keys(p.items);
    if (keys.length === 0) return null;
    // Non-live statuses drop out of aggregation: cancelled/superseded/proposed
    // and promoted alike — a promoted spec continues in its cross-cutting unit
    // and must not mask the siblings' state (unfiltered, the label went
    // insertion-order-dependent). `triaged` is pre-live: a stub holding parked
    // concerns on a topic no session has started — it must not flip the
    // phase's aggregate label.
    const NON_LIVE = ['cancelled', 'superseded', 'proposed', 'promoted', 'triaged'];
    if (keys.length === 1) {
      const status = (p.items[keys[0]] || {}).status || null;
      return NON_LIVE.includes(status) ? null : status;
    }
    const statuses = keys.map(k => (p.items[k] || {}).status).filter(s => s && !NON_LIVE.includes(s));
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

/** @param {object} manifest @param {string} phase @param {string} topic @returns {Record<string, any>|undefined} */
function itemOf(manifest, phase, topic) {
  const item = (phaseData(manifest, phase).items || {})[topic];
  return item && typeof item === 'object' ? item : undefined;
}

/**
 * A spec item's `sources` as `[name, row]` entries — the one decoder of the
 * map form and the legacy array form. Rows that aren't objects are dropped.
 * @param {object|Array<{name?: string, status?: string}>|undefined} sources
 * @returns {[string, {status?: string}][]}
 */
function sourceRows(sources) {
  if (!sources || typeof sources !== 'object') return [];
  const entries = Array.isArray(sources)
    ? sources.map((r) => /** @type {[string, unknown]} */ ([r && typeof r === 'object' ? r.name || '' : '', r]))
    : Object.entries(sources);
  return /** @type {[string, {status?: string}][]} */ (entries.filter(([, r]) => r && typeof r === 'object'));
}

/**
 * The `topic`-named row of a spec item's `sources`, object or legacy array
 * form, or undefined.
 * @param {object|Array<{name?: string}>|undefined} sources
 * @param {string} topic
 * @returns {{status?: string}|undefined}
 */
function sourceRow(sources, topic) {
  const entry = sourceRows(sources).find(([name]) => name === topic);
  return entry ? entry[1] : undefined;
}

// Discussion statuses that hold shut every specification sourcing them: a
// source back in-progress (a gap routed into it), and a topic the gap exit
// opened and parked as a stub no session has drained. Either way the
// specification waits for a record that has not concluded.
const OPEN_SOURCE_STATUSES = ['in-progress', 'triaged'];

/**
 * The non-terminal specification items whose `sources` name `discussion`,
 * as `[name, item]` entries — proposed groupings included; callers filter
 * on status.
 * @param {object} manifest @param {string} discussion
 * @returns {[string, Record<string, any>][]}
 */
function sourcingSpecs(manifest, discussion) {
  return Object.entries(phaseData(manifest, 'specification').items || {})
    .filter(([, item]) => item && typeof item === 'object'
      && !TERMINAL_STATUSES.includes(item.status)
      && sourceRow(item.sources, discussion) !== undefined);
}

// The units cancel and reactivate act on — one per stage, keyed by the name
// the user sees. The Discovery unit is the map row with every conversation
// under its name (its experiment series rides along through its records,
// never a status); the Definition unit is the specification with its
// same-named plan. Delivery never cancels: an implementation or review item
// under a specification's name locks it.
const UNIT_PHASES = {
  discovery: ['research', 'discussion'],
  specification: ['specification', 'planning'],
};
const DELIVERY_PHASES = ['implementation', 'review'];

/**
 * The phase items a unit carries, in unit-phase order — only those that
 * exist.
 * @param {object} manifest @param {keyof typeof UNIT_PHASES} stage @param {string} name
 * @returns {{phase: string, item: Record<string, any>}[]}
 */
function unitItems(manifest, stage, name) {
  return UNIT_PHASES[stage].flatMap((phase) => {
    const item = itemOf(manifest, phase, name);
    return item ? [{ phase, item }] : [];
  });
}

/**
 * A unit's phase items a cancel would take — those carrying a live status.
 * An item with no status was never attempted; a terminal one is already
 * closed.
 * @param {object} manifest @param {keyof typeof UNIT_PHASES} stage @param {string} name
 * @returns {{phase: string, item: Record<string, any>}[]}
 */
function liveUnitItems(manifest, stage, name) {
  return unitItems(manifest, stage, name)
    .filter(({ item }) => typeof item.status === 'string' && !TERMINAL_STATUSES.includes(item.status));
}

/**
 * Whether a Discovery unit exists under the name — a map row, or a research
 * or discussion item for a legacy topic the map never carried.
 * @param {object} manifest @param {string} topic
 */
function discoveryUnitExists(manifest, topic) {
  return itemOf(manifest, 'discovery', topic) !== undefined || unitItems(manifest, 'discovery', topic).length > 0;
}

/**
 * Whether a specification has started — `in-progress` or `completed`. A
 * started specification locks its source topics and lists as cancellable;
 * a proposed grouping is a regenerable suggestion, a terminal one is
 * closed, and a status-less item (an augment against a mistyped key
 * creates one) is inert.
 * @param {{status?: string}} item
 */
function specIsStarted(item) {
  return item.status === 'in-progress' || item.status === 'completed';
}

/**
 * Whether a specification still groups its sources — every status but
 * `cancelled` and `superseded`. A promoted specification continues in its
 * cross-cutting unit, so its sources stay grouped; a proposed grouping
 * holds its sources until it is discarded.
 * @param {{status?: string}} item
 */
function specGroupsSources(item) {
  return item.status !== 'cancelled' && item.status !== 'superseded';
}

/**
 * The started specifications sourcing a topic's discussion — the ones that
 * lock its Discovery unit. A proposed grouping never locks: it is a
 * regenerable suggestion the analysis writes for every unaccounted
 * discussion, discarded with its source.
 * @param {object} manifest @param {string} topic
 * @returns {string[]}
 */
function lockingSpecs(manifest, topic) {
  return sourcingSpecs(manifest, topic)
    .filter(([, item]) => specIsStarted(item))
    .map(([name]) => name);
}

/**
 * A topic's experiment series unless a legacy per-series cancel closed it —
 * a cancelled series is left as found, its rows all terminal by
 * construction.
 * @param {object} manifest @param {string} topic
 * @returns {Record<string, any>|undefined}
 */
function liveSeries(manifest, topic) {
  const series = itemOf(manifest, 'experiment', topic);
  return series && series.status !== 'cancelled' ? series : undefined;
}

/**
 * @typedef {object} CancelPlan
 * @property {{phase: string, item: Record<string, any>}[]} items  the live phase items the cancel stashes
 * @property {string[]} records   every open experiment record, top-level and sub, in register order
 * @property {string[]} discards  the proposed groupings sourcing the discussion, deleted with it
 */

/**
 * What a cancel takes — the one reading the transactions execute and the
 * cancel gate renders. A Definition unit takes its items alone: its source
 * discussions are untouched, and nothing on the register is its own.
 * @param {object} manifest @param {keyof typeof UNIT_PHASES} stage @param {string} name
 * @returns {CancelPlan}
 */
function cancelPlan(manifest, stage, name) {
  const items = liveUnitItems(manifest, stage, name);
  if (stage !== 'discovery') return { items, records: [], discards: [] };
  const series = liveSeries(manifest, name);
  const records = Object.entries((series && series.experiments) || {})
    .filter(([, r]) => r && typeof r === 'object' && !EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (r.status)))
    .map(([id]) => id)
    .sort(compareExperimentIds);
  return { items, records, discards: proposedGroupings(manifest, name) };
}

/**
 * The proposed groupings sourcing a discussion — regenerable suggestions
 * the analysis writes for every unaccounted discussion, discarded whenever
 * the discussion stops being one: with its topic's cancel, or with the
 * reactivate of a specification that sources it.
 * @param {object} manifest @param {string} discussion
 * @returns {string[]}
 */
function proposedGroupings(manifest, discussion) {
  return sourcingSpecs(manifest, discussion)
    .filter(([, spec]) => spec.status === 'proposed')
    .map(([name]) => name);
}

/**
 * @typedef {{topic: string, reason: 'cancelled'} | {topic: string, reason: 'held', by: string}} ReactivateLock
 */

/**
 * What holds a cancelled specification's reactivate shut: a source topic
 * whose Discovery unit is cancelled (reactivate the topic first), or a
 * source another started specification has since taken (regroup at the
 * specification entry). One row per offending source, spec order for the
 * holds — the refusal and the reactivate menu's locked rows read the same
 * facts.
 * @param {object} manifest @param {string} spec
 * @returns {ReactivateLock[]}
 */
function specReactivateLocks(manifest, spec) {
  const item = itemOf(manifest, 'specification', spec);
  /** @type {ReactivateLock[]} */
  const locks = [];
  for (const [topic] of sourceRows(item && item.sources)) {
    if (computeTopicLifecycle(manifest, topic).lifecycle === 'cancelled') {
      locks.push({ topic, reason: 'cancelled' });
      continue;
    }
    for (const [other, holder] of sourcingSpecs(manifest, topic)) {
      if (other !== spec && specIsStarted(holder)) locks.push({ topic, reason: 'held', by: other });
    }
  }
  return locks;
}

/**
 * A reactivate lock set as one sentence's two halves — what holds the
 * specification and the way out — so the refusal and the menu row never
 * drift. `nameOf` casts each name for its surface; `now` marks the hold as
 * arisen since the cancel (`now sources`), the menu row's register.
 * @param {ReactivateLock[]} locks
 * @param {(name: string) => string} nameOf
 * @param {{now?: boolean}} [opts]
 * @returns {{holds: string, recovery: string}}
 */
function reactivateLockPhrases(locks, nameOf, { now = false } = {}) {
  const quote = (/** @type {string} */ n) => `"${nameOf(n)}"`;
  const unique = (/** @type {string[]} */ names) => [...new Set(names)].map(quote);
  const cancelled = unique(locks.filter((l) => l.reason === 'cancelled').map((l) => l.topic));
  const held = locks.filter((l) => l.reason === 'held');
  const holds = [];
  const recovery = [];
  if (cancelled.length > 0) {
    holds.push(cancelled.length === 1 ? `its source ${cancelled[0]} is cancelled` : `its sources ${cancelled.join(', ')} are cancelled`);
    recovery.push(cancelled.length === 1 ? 'reactivate the topic first' : 'reactivate the topics first');
  }
  if (held.length > 0) {
    const specs = unique(held.map((l) => /** @type {{by: string}} */ (l).by));
    const topics = unique(held.map((l) => l.topic));
    const verb = `${now ? 'now ' : ''}source${specs.length === 1 ? 's' : ''}`;
    holds.push(`the specification${specs.length === 1 ? '' : 's'} ${specs.join(', ')} ${verb} ${topics.join(', ')}`);
    recovery.push('regroup at the specification entry');
  }
  return { holds: holds.join(' and '), recovery: recovery.join(' and ') };
}

/**
 * Whether code work has started under a specification's name — an
 * implementation or review item exists, any status. A legacy cancelled one
 * counts: code may have landed before the cancel.
 * @param {object} manifest @param {string} spec
 * @returns {boolean}
 */
function deliveryStarted(manifest, spec) {
  return DELIVERY_PHASES.some((phase) => itemOf(manifest, phase, spec) !== undefined);
}

/**
 * One item's live evidence-wait ids (`awaiting_experiments` — the
 * engine-owned lock a spawn places on the spawning phase's own item) — empty
 * when the item or the field is absent.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {string[]}
 */
function awaitedExperiments(manifest, phase, topic) {
  const item = itemOf(manifest, phase, topic);
  return item && Array.isArray(item.awaiting_experiments) ? item.awaiting_experiments : [];
}

/**
 * @typedef {{kind: 'research', status: string} | {kind: 'experiment', id: string}} Wait
 */

// Research statuses that hold the same-named discussion shut — its entry and
// its conclusion alike — in flight, or parked as a stub of concerns no
// session has drained.
const OUTSTANDING_RESEARCH_STATUSES = ['in-progress', 'triaged'];

/**
 * The research still outstanding on a topic — its item's status while in
 * flight or parked — or null once it has landed or never existed. The one
 * read behind every surface that holds a discussion for its research: the
 * birth and reopen guards, the entry gates, the conclusion wait, the menu.
 * Work-type agnostic; the discussion item need not exist.
 * @param {object} manifest @param {string} topic
 * @returns {string|null}
 */
function outstandingResearch(manifest, topic) {
  const research = itemOf(manifest, 'research', topic);
  const status = research ? research.status : undefined;
  return OUTSTANDING_RESEARCH_STATUSES.includes(status ?? '') ? status : null;
}

// Where outstanding research stands, in the refusals' voice — the birth and
// reopen guards and the direct-entry door share it.
/** @param {string} status  an outstanding research status */
function outstandingResearchPhrase(status) {
  return status === 'triaged' ? 'research is parked on it (triage waiting)' : 'research is in flight on it';
}

/**
 * Every wait holding one item's conclusion shut, in presentation order: a
 * `research` wait when a discussion's same-named research is still
 * outstanding (research feeds discussion), then one `experiment` wait per
 * live awaited id. Derived from the items' statuses alone — never stored —
 * and work-type agnostic; an absent item holds nothing.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {Wait[]}
 */
function waits(manifest, phase, topic) {
  /** @type {Wait[]} */
  const out = [];
  if (!itemOf(manifest, phase, topic)) return out;
  const research = phase === 'discussion' ? outstandingResearch(manifest, topic) : null;
  if (research) out.push({ kind: 'research', status: research });
  for (const id of awaitedExperiments(manifest, phase, topic)) out.push({ kind: 'experiment', id });
  return out;
}

/**
 * The topic's live waits across its research and discussion items — every
 * wait an in-progress holder is blocked on, spawn-phase order. Only an
 * in-progress holder is trying to conclude: a completed discussion's
 * outstanding research is its reconcile flag's business, and a parked or
 * terminal holder waits on nothing.
 * @param {object} manifest @param {string} topic
 * @returns {Wait[]}
 */
function topicWaits(manifest, topic) {
  return EXPERIMENT_SPAWN_PHASES.flatMap((phase) => {
    const item = itemOf(manifest, phase, topic);
    return item && item.status === 'in-progress' ? waits(manifest, phase, topic) : [];
  });
}

/**
 * Settle a derived item's status over its records — `phaseStatus` one level
 * down: `completed` only when every record is terminal; an empty series is
 * still open (the spawn opened it). Mutates the item; returns the status.
 * @param {{status?: string, experiments?: Record<string, {status?: string}>}} item
 * @returns {string}
 */
function settleItemStatus(item) {
  const records = Object.values(item.experiments || {});
  item.status = records.length > 0 && records.every((r) => EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (r.status)))
    ? 'completed'
    : 'in-progress';
  return item.status;
}

// Non-terminal items of one spawn phase holding a live evidence wait — the
// state that blocks their conclusion and routes the linear pipeline to the
// experiment.
function waitingItems(manifest, phase) {
  return phaseItems(manifest, phase)
    .filter((i) => !TERMINAL_STATUSES.includes(i.status)
      && Array.isArray(i.awaiting_experiments) && i.awaiting_experiments.length > 0);
}

function computeNextPhase(manifest) {
  const wt = manifest.work_type;

  const ps = (phase) => phaseStatus(manifest, phase);

  // A completed phase whose item carries a reconcile flag routes BACK to that
  // phase for the linear types — routing forward past known-stale input is
  // the bug this override closes, and it keeps the bridge off its terminal
  // `done` branch while a flag is live. The walk stops at the first in-flight
  // phase: an upstream mid-revision owns the next action, and its conclusion
  // re-runs this. Epics are excluded — their next_phase is phase-coarse;
  // flagged epic items get per-item cues instead.
  if (wt !== 'epic') {
    const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (wt)] || [];
    for (const phase of pipeline) {
      // The earliest in-flight phase owns the next action — a spec paused by
      // a gap routed into its reopened source must route to that source, not
      // back into its own blocked entry. A research or discussion holding a
      // live evidence wait cannot act, and an in-flight experiment slot is
      // that wait's other side (a discussion's lock sits later in the
      // pipeline than the laboratory it waits on): both route to the
      // experiment. Linear types only — an epic's next_phase is
      // phase-coarse, and its topic-grain experiment rows carry the route
      // instead.
      if (ps(phase) === 'in-progress') {
        const awaiting = DERIVED_PHASES.includes(phase)
          ? EXPERIMENT_SPAWN_PHASES.some((p) => waitingItems(manifest, p).length > 0)
          : EXPERIMENT_SPAWN_PHASES.includes(phase) && waitingItems(manifest, phase).length > 0;
        if (awaiting) {
          return { next_phase: 'experiment', phase_label: 'experiment (awaiting evidence)' };
        }
        // Research feeds discussion: a stub parked beneath the live
        // discussion is invisible to the phase walk (pre-live), yet it holds
        // the discussion shut — at its door and its conclusion — so the way
        // in is the research.
        if (phase === 'discussion') {
          const live = phaseItems(manifest, phase).find((i) => i.status === 'in-progress');
          if (live && outstandingResearch(manifest, live.name)) {
            return { next_phase: 'research', phase_label: 'research (parked — feeds the discussion)' };
          }
        }
        return { next_phase: phase, phase_label: `${phase} (in-progress)` };
      }
      const flagged = phaseItems(manifest, phase)
        .some((i) => i.status === 'completed' && i.reconcile_needed !== undefined);
      if (flagged) {
        return { next_phase: phase, phase_label: `${phase} (input moved — reconcile)` };
      }
    }
  }

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

  // Research and experiment are the optional phases of the research-bearing
  // types (not bugfix). Research in-progress leads the checks: a research
  // whose experiment already concluded is still the earlier open
  // conversation, and "ready for discussion" would skip it.
  if (wt !== 'bugfix') {
    if (ps('research') === 'in-progress') {
      return { next_phase: 'research', phase_label: 'research (in-progress)' };
    }
    if (ps('experiment') === 'in-progress') {
      return { next_phase: 'experiment', phase_label: 'experiment (in-progress)' };
    }
    if (ps('experiment') === 'completed') {
      return { next_phase: 'discussion', phase_label: 'ready for discussion' };
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
 * The active work unit's next-phase state with the finalising / mid-revisit
 * override applied. computeNextPhase short-circuits on a completed review, so a
 * finished pipeline reports `next_phase: done` (finalising — the unit sat
 * between the last topic completion and `workunit complete`). But a reopened
 * earlier phase means the unit is mid-revisit, not finalising: the phase in
 * flight is the next action, and completing the unit now would abandon the
 * revisit. The one derivation both the start dashboard and the single-topic
 * work-unit detail read, so the two can never disagree.
 * @param {object} manifest
 * @param {string[]} pipeline  the work type's pipeline phases, in order
 * @returns {{next_phase: string, phase_label: string, finalising: boolean, in_progress_phases: string[]}}
 */
function computeUnitPhaseState(manifest, pipeline) {
  const state = computeNextPhase(manifest);
  const inProgress = computeInProgressPhases(manifest, pipeline);
  let nextPhase = state.next_phase;
  let phaseLabel = state.phase_label;
  if (nextPhase === 'done' && inProgress.length > 0) {
    nextPhase = inProgress[0];
    phaseLabel = `${inProgress[0]} (in-progress)`;
  }
  return {
    next_phase: nextPhase,
    phase_label: phaseLabel,
    finalising: nextPhase === 'done',
    in_progress_phases: inProgress,
  };
}

/**
 * The last phase, in the given pipeline order, with at least one completed
 * item — or null when nothing has completed. Single-topic phases carry one
 * item, so "an item completed" and "the phase aggregate is completed" coincide;
 * epics keep the per-item reading (one topic completing a phase is enough). The
 * one spelling every closed-unit surface reads (start dashboard, single-topic
 * detail, epic gateway) — each passes the pipeline its display walks.
 * @param {object} manifest
 * @param {string[]} pipeline  phases to scan, in order
 * @returns {string|null}
 */
function lastCompletedPhase(manifest, pipeline) {
  let last = null;
  for (const phase of pipeline) {
    const items = phaseItems(manifest, phase);
    if (items.length > 0 && items.some((i) => i.status === 'completed')) last = phase;
  }
  return last;
}

/**
 * The sorted set of existing completed input files for one analysis kind —
 * completed research plus completed discussion files for `gap-analysis`. The
 * one collection both cache sides use: the read (computeAnalysisCacheStatus)
 * and the write (engine cache stamp) checksum the same list, so they can never
 * drift. Returns absolute paths, sorted.
 */
function collectAnalysisInputs(manifest, workflowsDir, kind) {
  if (!manifest || !manifest.name) return [];
  const wuDir = path.join(workflowsDir, manifest.name);
  const completedFiles = (phase) => phaseItems(manifest, phase)
    .filter(it => it.status === 'completed')
    .map(it => path.join(wuDir, phase, `${it.name}.md`))
    .filter(p => fileExists(p));

  if (kind === 'gap-analysis') {
    return [...completedFiles('research'), ...completedFiles('discussion')].sort();
  }
  return [];
}

// Per-kind config for computeAnalysisCacheStatus: where the cache object
// lives, which field on it lists the cached file names, and the two kind-
// specific reason strings. The body is otherwise one path for every kind —
// the same read the write side checksums (collectAnalysisInputs).
const ANALYSIS_KINDS = {
  'gap-analysis': {
    cacheOf: (manifest) => ((manifest.phases || {}).discovery || {}).gap_analysis_cache,
    filesField: 'input_files',
    reasonNoInputs: 'no completed research or discussion files',
    reasonStale: 'completed research/discussion has changed since gap analysis was generated',
  },
};

function computeAnalysisCacheStatus(manifest, workflowsDir, kind) {
  if (!manifest || !manifest.name) return { status: 'absent', generated: null, files: [] };

  const cfg = ANALYSIS_KINDS[kind];
  if (!cfg) return { status: 'absent', generated: null, files: [] };

  const cache = cfg.cacheOf(manifest);
  const inputPaths = collectAnalysisInputs(manifest, workflowsDir, kind);
  const cachedFiles = () => (cache && Array.isArray(cache[cfg.filesField])) ? cache[cfg.filesField] : [];

  if (!cache || !cache.checksum) {
    return inputPaths.length > 0
      ? { status: 'stale', generated: null, files: [], reason: 'no cache exists' }
      : { status: 'absent', generated: null, files: [] };
  }

  if (inputPaths.length === 0) {
    return { status: 'absent', generated: cache.generated || null, files: cachedFiles(), reason: cfg.reasonNoInputs };
  }

  const currentChecksum = filesChecksum(inputPaths);
  const status = cache.checksum === currentChecksum ? 'valid' : 'stale';
  return {
    status,
    generated: cache.generated || null,
    files: cachedFiles(),
    reason: status === 'valid' ? 'checksums match' : cfg.reasonStale,
  };
}

const TIER_RANK = { '✓': 0, '→': 1, '◐': 2, '○': 3, '⊙': 4, '⊘': 5 };

// Shared row comparator for the discovery map: tier rank first — decided
// leads, then ready, in-flight, fresh, with handled/cancelled trailing — then
// suggested execution order ascending (null orders sort last), then name as
// final fallback.
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
// research) rather than assumed from the lifecycle alone. `triage_parked`
// rides along the same way: true when either phase item is a `triaged` stub
// (parked rerouted concerns, no session yet). It is a rider, not a lifecycle
// — a triaged stub renders as `fresh` by fall-through, and the rider survives
// on every branch (a `discussing` topic can still hold a parked research
// stub — the research is then the row's own next action, and the discussion
// is held until it lands). `reconcile_pending`
// is the third rider: either phase item carries a live reconcile flag, so
// the map row can cue `input moved` — with a map, phase-item rows never
// render for research/discussion, making this the topic's only surface.
function computeTopicLifecycle(manifest, topicName) {
  const discovery = phaseItems(manifest, 'discovery').find(i => i.name === topicName);
  const research = phaseItems(manifest, 'research').find(i => i.name === topicName);
  const discussion = phaseItems(manifest, 'discussion').find(i => i.name === topicName);

  const rs = research ? research.status ?? null : null;
  const ds = discussion ? discussion.status : null;
  const triage_parked = rs === 'triaged' || ds === 'triaged';
  // Terminal items keep their flag inertly (reactivation restores it live);
  // cueing them would light `input moved` with no entry flow to clear it.
  const flagLive = (/** @type {{status?: string, reconcile_needed?: unknown}|undefined} */ it) =>
    it !== undefined && it.reconcile_needed !== undefined
    && !TERMINAL_STATUSES.includes(/** @type {string} */ (it.status));
  const reconcile_pending = flagLive(research) || flagLive(discussion);

  // Stored markers win over name-matching, the cancel ahead of the dead end:
  // a cancelled topic is off the board whatever its items say, a dead-ended
  // one is terminal with no next action. Read only the item's own fields —
  // never inspect siblings or provenance.
  if (discovery && discovery.cancelled === true) {
    return { lifecycle: 'cancelled', tier: '⊘', current_phase: null, research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  if (discovery && discovery.handled === true) {
    return { lifecycle: 'handled', tier: '⊙', current_phase: null, research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }

  if (rs === 'in-progress' && ds === 'completed') {
    // Reopened research beneath a decided discussion — a triage landing
    // judged research-side. The topic is back in research; the discussion's
    // reconcile flag carries the downstream consequence.
    return { lifecycle: 'researching', tier: '◐', current_phase: 'research', research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  if (ds === 'completed') {
    return { lifecycle: 'decided', tier: '✓', current_phase: 'discussion', research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  if (ds === 'in-progress') {
    return { lifecycle: 'discussing', tier: '◐', current_phase: 'discussion', research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  if (rs === 'completed') {
    return { lifecycle: 'ready_for_discussion', tier: '→', current_phase: 'research', research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  if (rs === 'in-progress') {
    return { lifecycle: 'researching', tier: '◐', current_phase: 'research', research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  // Every attempted phase item is terminal and at least one is cancelled:
  // the topic is cancelled-tier — the reading a manifest cancelled per phase
  // before the map carried its own marker still gets, and the only one a
  // topic with no map row has. A dual-attempt topic with one live item never
  // reaches here — the live path's branches above already rendered it. A
  // single-routed topic whose only item is cancelled must NOT fall through to
  // fresh: its phase item blocks `topic start` (the "fresh" next action would
  // dead-end), and the recovery route is reactivate; a terminal sibling
  // (superseded research beside a cancelled discussion) never keeps a cancel
  // from reading. A `triaged` sibling is not an attempt — it keeps the topic
  // out of cancelled-tier via the every() check, falling through to fresh.
  const attempted = [rs, ds].filter((s) => s != null);
  if (attempted.includes('cancelled') && attempted.every((s) => TERMINAL_STATUSES.includes(s))) {
    return { lifecycle: 'cancelled', tier: '⊘', current_phase: null, research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  // Superseded research with no discussion: the topic's research lineage is
  // closed but a discussion path remains open. Render as ready-for-discussion
  // — the next available action is to discuss.
  if (rs === 'superseded' && !ds) {
    return { lifecycle: 'ready_for_discussion', tier: '→', current_phase: 'research', research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
  }
  return { lifecycle: 'fresh', tier: '○', current_phase: null, research_state: rs, discussion_state: ds, triage_parked, reconcile_pending };
}

// The lifecycles a topic leaves the board under — no row, no action, and
// research reopened beneath one names the closure, not the research.
const CLOSED_LIFECYCLES = ['cancelled', 'handled'];

// Why a lifecycle stands in the way of a move — the map ops' refusals and
// the phase-birth guard share it, so the engine and the epic menu's
// conversational rejections never drift. Derived from the actual research
// state: superseded research is named as such, never as completed.
/** @param {string} lifecycle @param {string|null} researchState @param {string} [routing] */
function lifecyclePhrase(lifecycle, researchState, routing) {
  switch (lifecycle) {
    case 'fresh':
      return routing ? `it is routed to ${routing} and nothing has started` : 'nothing has started on it';
    case 'researching': return outstandingResearchPhrase('in-progress');
    case 'discussing': return 'discussion is in flight on it';
    case 'ready_for_discussion':
      return researchState === 'superseded'
        ? 'its research was superseded and discussion is queued'
        : 'research has completed and discussion is queued';
    case 'decided': return 'discussion has concluded';
    case 'handled': return 'it is closed as a dead end and stays on the map as record';
    default: return 'it is cancelled and stays on the map as record'; // cancelled
  }
}

// The actions the map derives for its two conversation phases, keyed by the
// phase each enters — the one vocabulary the epic menu's rows, the birth
// guard, and the research row share.
const CONVERSATION_ACTIONS = {
  research: ['start_research', 'continue_research'],
  discussion: ['start_discussion', 'start_discussion_after_research', 'continue_discussion'],
};

/**
 * The map row's next action. Outstanding research is the row's own action
 * whatever the routing or the discussion says — research feeds discussion,
 * so a parked stub leads a fresh topic, and a discussing topic's row is its
 * research row until the research lands (the discussion is held shut).
 * @param {string|undefined} routing @param {string} lifecycle @param {string|null} [researchState]
 * @returns {string|null}
 */
function computeNextAction(routing, lifecycle, researchState) {
  const outstanding = OUTSTANDING_RESEARCH_STATUSES.includes(researchState ?? '');
  const researchAction = researchState === 'triaged' ? 'start_research' : 'continue_research';
  switch (lifecycle) {
    case 'fresh':
      if (outstanding) return researchAction;
      return routing === 'research' ? 'start_research' : 'start_discussion';
    case 'researching':
      return 'continue_research';
    case 'ready_for_discussion':
      return 'start_discussion_after_research';
    case 'discussing':
      return outstanding ? researchAction : 'continue_discussion';
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

// The phases that own a triage queue — those whose item vocabulary admits
// `triaged`, in schema order.
const TRIAGE_PHASES = Object.entries(VALID_PHASE_STATUSES)
  .filter(([, vocabulary]) => vocabulary.includes('triaged'))
  .map(([phase]) => phase);

// A topic's triage queue, counted from disk. The cue means "concerns wait
// here", and that is a fact about the queue directory, not the item's
// status: a landing on a concluded topic reopens it to `in-progress`, leaving
// no `triaged` stub to read, and the drain deletes queue files, so an empty
// directory is the released signal with nothing to clear.
/** @param {string} workflowsDir @param {object} manifest @param {string} phase @param {string} topic @returns {number} */
function triageQueueDepth(workflowsDir, manifest, phase, topic) {
  if (typeof manifest.name !== 'string') return 0;
  return countFiles(path.join(workflowsDir, manifest.name, phase, '.triage', topic), '.md');
}

// The epic map row's depths — the two conversation phases a map row joins.
/** @param {string} workflowsDir @param {object} manifest @param {string} topic @returns {{research: number, discussion: number}} */
function triageQueued(workflowsDir, manifest, topic) {
  return {
    research: triageQueueDepth(workflowsDir, manifest, 'research', topic),
    discussion: triageQueueDepth(workflowsDir, manifest, 'discussion', topic),
  };
}

/**
 * The phases whose queue holds concerns for one topic — the single-topic
 * surfaces' cue (the start rows, the continue dashboards, the pick lists),
 * where topic = work unit and any triage-legal phase may own the queue.
 * @param {string} workflowsDir @param {object} manifest @param {string} topic @returns {string[]}
 */
function triagePhases(workflowsDir, manifest, topic) {
  return TRIAGE_PHASES.filter((phase) => triageQueueDepth(workflowsDir, manifest, phase, topic) > 0);
}

/**
 * @typedef {object} DiscoveryMapRow
 * @property {string} name
 * @property {string|null} summary            normalised — whitespace-only / non-string reads as null
 * @property {boolean} summary_present
 * @property {string|null} description        raw value, for surfaces that render it in full
 * @property {boolean} description_present     normalised presence
 * @property {string|null} routing
 * @property {string} source
 * @property {string|null} source_provenance
 * @property {number|null} order
 * @property {string} lifecycle
 * @property {string} tier
 * @property {string|null} current_phase
 * @property {string|null} research_state
 * @property {string|null} discussion_state  the discussion item's raw status, null when none exists
 * @property {boolean} triage_parked       rerouted concerns wait on the topic — a `triaged` stub in either phase, or queue files on disk beneath a started or reopened item
 * @property {{research: number, discussion: number}} triage_queued  the topic's queue depth per phase, counted from disk
 * @property {boolean} reconcile_pending   a phase item beneath the row carries a live reconcile flag
 * @property {Wait[]} waits               the live waits of the topic's in-progress research and discussion items (empty when none)
 * @property {string|null} next_action
 */

/**
 * The discovery-map rows for one epic manifest: each discovery item joined to
 * its per-phase lifecycle, sorted by tier → order → name, with the map summary
 * and the sequencing flag. The single builder every discovery-map surface
 * reads — the epic detail and the discovery-session gateway consume the same
 * rows, so the two can never silently disagree.
 *
 * Each row carries the superset of fields any surface needs. `summary` and
 * `description_present` follow the normalised reading — a whitespace-only or
 * non-string value is treated as absent — so the presence booleans always
 * agree with the text; `description` carries the raw value for surfaces that
 * render it in full.
 * @param {object} manifest
 * @param {string} workflowsDir  the project's `.workflows` directory — the triage queues are read from disk
 * @returns {{map: DiscoveryMapRow[], summary: object, needs_sequencing: boolean}}
 */
function buildDiscoveryMap(manifest, workflowsDir) {
  const discoveryItems = phaseItems(manifest, 'discovery');
  const map = discoveryItems.map((item) => {
    const { lifecycle, tier, current_phase, research_state, discussion_state, triage_parked: stubParked, reconcile_pending } = computeTopicLifecycle(manifest, item.name);
    const triage_queued = triageQueued(workflowsDir, manifest, item.name);
    const summaryText = typeof item.summary === 'string' && item.summary.trim() ? item.summary : null;
    const descriptionText = typeof item.description === 'string' && item.description.trim() ? item.description : null;
    return {
      name: item.name,
      summary: summaryText,
      summary_present: summaryText !== null,
      description: item.description || null,
      description_present: descriptionText !== null,
      routing: item.routing || null,
      source: item.source || 'discovery',
      source_provenance: computeSourceProvenance(item.source),
      order: item.order ?? null,
      lifecycle,
      tier,
      current_phase,
      research_state,
      discussion_state,
      triage_parked: stubParked || triage_queued.research > 0 || triage_queued.discussion > 0,
      triage_queued,
      reconcile_pending,
      waits: topicWaits(manifest, item.name),
      next_action: computeNextAction(item.routing, lifecycle, research_state),
    };
  });
  map.sort(compareMapRows);
  return { map, summary: computeMapSummary(map), needs_sequencing: computeNeedsSequencing(map) };
}

module.exports = {
  phaseData,
  phaseItems,
  phaseStatus,
  sourceRows,
  sourceRow,
  OPEN_SOURCE_STATUSES,
  sourcingSpecs,
  UNIT_PHASES,
  unitItems,
  liveUnitItems,
  discoveryUnitExists,
  specIsStarted,
  specGroupsSources,
  lockingSpecs,
  liveSeries,
  cancelPlan,
  proposedGroupings,
  specReactivateLocks,
  reactivateLockPhrases,
  deliveryStarted,
  awaitedExperiments,
  waits,
  topicWaits,
  OUTSTANDING_RESEARCH_STATUSES,
  outstandingResearch,
  outstandingResearchPhrase,
  settleItemStatus,
  computeNextPhase,
  computeInProgressPhases,
  computeUnitPhaseState,
  lastCompletedPhase,
  collectAnalysisInputs,
  computeAnalysisCacheStatus,
  computeTopicLifecycle,
  computeNextAction,
  CONVERSATION_ACTIONS,
  CLOSED_LIFECYCLES,
  lifecyclePhrase,
  itemOf,
  computeMapSummary,
  computeSourceProvenance,
  compareMapRows,
  computeNeedsSequencing,
  buildDiscoveryMap,
  triagePhases,
  TIER_RANK,
};
