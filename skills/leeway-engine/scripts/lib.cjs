'use strict';

// ---------------------------------------------------------------------------
// Engine library entry — the single require() for adapters and skills' scripts.
//
//   const engine = require('../../leeway-engine/scripts/lib.cjs');
//
// Rings:
//   engine.render         kernel — pure layout (no workflow vocabulary)
//   engine.manifest       kernel — work-unit manifest IO (load / atomic save)
//   engine.schema         kernel — manifest vocabulary (phases, per-type pipelines)
//   engine.state          kernel — where the workflows' state lives
//   engine.conventions    domain — workflow glyphs, tags, title composition
//   engine.reads          domain — generic manifest/file reads (no phase semantics)
//   engine.derivations    domain — shared derivations (phase joins, lifecycle, cache status)
//   engine.agents         domain — background-agent derivations (review cycles, arming)
//   engine.detail         domain — detail builders (the one structured object per work unit)
//   engine.project        domain — projections (dashboard / key / menu / map views)
//   engine.gateway        adapter harness — verb dispatch + output sections
//
// Domain queries, projections, and transitions grow here as call sites
// migrate — added when a real consumer lands, never speculatively.
// ---------------------------------------------------------------------------

const render = require('./kernel/render.cjs');
const manifest = require('./kernel/manifest.cjs');
const schema = require('./kernel/manifest-schema.cjs');
const state = require('./kernel/state-root.cjs');
const conventions = require('./domain/conventions.cjs');
const reads = require('./domain/reads.cjs');
const derivations = require('./domain/derivations.cjs');
const roadmapDomain = require('./domain/roadmap.cjs');
const roadmapProjections = require('./domain/projections/roadmap.cjs');
const presence = require('./domain/presence.cjs');
const gateway = require('./gateway.cjs');
const start = require('./domain/start.cjs');
const inboxSet = require('./domain/inbox-set.cjs');
const workunit = require('./domain/workunit-detail.cjs');
const agentState = require('./domain/agent-state.cjs');
const startProjections = require('./domain/projections/start.cjs');
const workunitProjections = require('./domain/projections/workunit.cjs');
const surfaces = require('./domain/projections/surfaces.cjs');

module.exports = {
  render,
  manifest,
  conventions,
  gateway,
  state: {
    stateRoot: state.stateRoot,
  },
  schema: {
    VALID_PHASES: schema.VALID_PHASES,
    WORK_TYPE_PIPELINES: schema.WORK_TYPE_PIPELINES,
  },
  reads: {
    listFiles: reads.listFiles,
    listDirs: reads.listDirs,
    fileExists: reads.fileExists,
    loadManifest: reads.loadManifest,
    filesChecksum: reads.filesChecksum,
    loadActiveManifests: reads.loadActiveManifests,
  },
  derivations: {
    phaseData: derivations.phaseData,
    phaseItems: derivations.phaseItems,
    phaseStatus: derivations.phaseStatus,
    computeNextPhase: derivations.computeNextPhase,
    computeTopicLifecycle: derivations.computeTopicLifecycle,
    computeMapSummary: derivations.computeMapSummary,
    computeSourceProvenance: derivations.computeSourceProvenance,
    compareMapRows: derivations.compareMapRows,
    computeNeedsSequencing: derivations.computeNeedsSequencing,
  },
  agents: {
    completedReviewCycles: agentState.completedReviewCycles,
    reviewArming: agentState.reviewArming,
    latestReview: agentState.latestReview,
  },
  roadmap: {
    roadmapState: roadmapDomain.roadmapState,
  },
  presence: {
    scanPresence: presence.scanPresence,
    scanProject: presence.scanProject,
    heldCodeSessions: presence.heldCodeSessions,
    heldDocument: presence.heldDocument,
    ownsRow: presence.ownsRow,
    fmtAge: presence.fmtAge,
  },
  detail: {
    startDetail: start.startDetail,
    combinedInbox: inboxSet.combinedInbox,
    workingSetDetail: inboxSet.workingSetDetail,
    phaseTargets: workunit.phaseTargets,
    WORK_UNIT_TYPES: workunit.WORK_UNIT_TYPES,
  },
  project: {
    titlecase: conventions.titlecase,
    actionsTable: surfaces.actionsTable,
    roadmapTitle: roadmapProjections.roadmapTitle,
    roadmapMapView: roadmapProjections.roadmapMapView,
    roadmapProposalView: roadmapProjections.roadmapProposalView,
    roadmapPullSetView: roadmapProjections.roadmapPullSetView,
    roadmapHomeMenu: roadmapProjections.roadmapHomeMenu,
    inboxPickupView: startProjections.inboxPickupView,
    archivedView: startProjections.archivedView,
    workingSetView: startProjections.workingSetView,
    workingSetAddGate: startProjections.workingSetAddGate,
    workingSetDropGate: startProjections.workingSetDropGate,
    revisitPhasesSection: workunitProjections.revisitPhasesSection,
  },
};
