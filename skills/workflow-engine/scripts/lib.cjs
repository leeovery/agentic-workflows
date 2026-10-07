'use strict';

// ---------------------------------------------------------------------------
// Engine library entry — the single require() for adapters and skills' scripts.
//
//   const engine = require('../../workflow-engine/scripts/lib.cjs');
//
// Rings:
//   engine.render         kernel — pure layout (no workflow vocabulary)
//   engine.manifest       kernel — work-unit manifest IO (load / atomic save)
//   engine.schema         kernel — manifest vocabulary (phases, per-type pipelines)
//   engine.conventions    domain — workflow glyphs, tags, title composition
//   engine.reads          domain — generic manifest/file reads (no phase semantics)
//   engine.derivations    domain — shared derivations (phase joins, lifecycle, cache status)
//   engine.discussionMap  domain — discussion-map transitions + queries
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
const conventions = require('./domain/conventions.cjs');
const reads = require('./domain/reads.cjs');
const derivations = require('./domain/derivations.cjs');
const discoverySession = require('./domain/discovery-session.cjs');
const roadmapDomain = require('./domain/roadmap.cjs');
const roadmapProjections = require('./domain/projections/roadmap.cjs');
const presence = require('./domain/presence.cjs');
const gateway = require('./gateway.cjs');
const epic = require('./domain/epic-detail.cjs');
const start = require('./domain/start.cjs');
const inboxSet = require('./domain/inbox-set.cjs');
const workunit = require('./domain/workunit-detail.cjs');
const workunitManage = require('./domain/workunit-manage.cjs');
const specification = require('./domain/specification.cjs');
const discussionMap = require('./domain/discussion-map.cjs');
const agentState = require('./domain/agent-state.cjs');
const epicProjections = require('./domain/projections/epic.cjs');
const discoveryProjections = require('./domain/projections/discovery-map.cjs');
const discussionProjections = require('./domain/projections/discussion-map.cjs');
const startProjections = require('./domain/projections/start.cjs');
const workunitProjections = require('./domain/projections/workunit.cjs');
const specificationProjections = require('./domain/projections/specification.cjs');
const selectionProjections = require('./domain/projections/selection.cjs');
const surfaces = require('./domain/projections/surfaces.cjs');

module.exports = {
  render,
  manifest,
  conventions,
  gateway,
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
    computeAnalysisCacheStatus: derivations.computeAnalysisCacheStatus,
    computeTopicLifecycle: derivations.computeTopicLifecycle,
    computeMapSummary: derivations.computeMapSummary,
    computeSourceProvenance: derivations.computeSourceProvenance,
    compareMapRows: derivations.compareMapRows,
    computeNeedsSequencing: derivations.computeNeedsSequencing,
    buildDiscoveryMap: derivations.buildDiscoveryMap,
    inputMoved: derivations.inputMoved,
    movedFrom: derivations.movedFrom,
  },
  discussionMap: {
    addSubtopic: discussionMap.addSubtopic,
    setSubtopicState: discussionMap.setSubtopicState,
    mapState: discussionMap.mapState,
    SUBTOPIC_STATES: discussionMap.SUBTOPIC_STATES,
  },
  agents: {
    completedReviewCycles: agentState.completedReviewCycles,
    reviewArming: agentState.reviewArming,
    latestReview: agentState.latestReview,
  },
  session: {
    nextSessionNumber: discoverySession.nextSessionNumber,
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
    epicDetail: epic.epicDetail,
    startDetail: start.startDetail,
    combinedInbox: inboxSet.combinedInbox,
    workingSetDetail: inboxSet.workingSetDetail,
    manageDetail: workunitManage.manageDetail,
    activeWorkUnit: workunit.activeWorkUnit,
    WORK_UNIT_TYPES: workunit.WORK_UNIT_TYPES,
    specificationDiscovery: specification.specificationDiscovery,
    specificationDetail: specification.specificationDetail,
  },
  project: {
    titlecase: conventions.titlecase,
    actionsTable: surfaces.actionsTable,
    workUnitTitle: workunitProjections.workUnitTitle,
    discoveryTitle: discoveryProjections.discoveryTitle,
    SPEC_TITLE: specificationProjections.SPEC_TITLE,
    selectionNotFound: selectionProjections.selectionNotFound,
    epicDashboard: epicProjections.epicDashboard,
    epicKey: epicProjections.epicKey,
    epicMenu: epicProjections.epicMenu,
    epicMenuKeys: epicProjections.epicMenuKeys,
    epicInSessionGate: epicProjections.epicInSessionGate,
    epicCompletedMenu: epicProjections.epicCompletedMenu,
    epicCancelMenu: epicProjections.epicCancelMenu,
    epicReactivateMenu: epicProjections.epicReactivateMenu,
    epicPostponeMenu: epicProjections.epicPostponeMenu,
    epicPullForwardMenu: epicProjections.epicPullForwardMenu,
    epicUnblockMenu: epicProjections.epicUnblockMenu,
    discoveryMapView: discoveryProjections.discoveryMapView,
    discoverySynthesisView: discoveryProjections.discoverySynthesisView,
    roadmapTitle: roadmapProjections.roadmapTitle,
    roadmapMapView: roadmapProjections.roadmapMapView,
    roadmapProposalView: roadmapProjections.roadmapProposalView,
    roadmapPullSetView: roadmapProjections.roadmapPullSetView,
    roadmapHomeMenu: roadmapProjections.roadmapHomeMenu,
    discussionMap: discussionProjections.discussionMap,
    startOverview: startProjections.startOverview,
    startMenu: startProjections.startMenu,
    emptyOverview: startProjections.emptyOverview,
    emptyMenu: startProjections.emptyMenu,
    inboxPickupView: startProjections.inboxPickupView,
    archivedView: startProjections.archivedView,
    workingSetView: startProjections.workingSetView,
    workingSetAddGate: startProjections.workingSetAddGate,
    workingSetDropGate: startProjections.workingSetDropGate,
    manageListView: startProjections.manageListView,
    manageUnitView: startProjections.manageUnitView,
    completedView: startProjections.completedView,
    workUnitStatus: workunitProjections.workUnitStatus,
    workUnitMenu: workunitProjections.workUnitMenu,
    workUnitData: workunitProjections.workUnitData,
    revisitablePhases: workunitProjections.revisitablePhases,
    phaseRoute: workunitProjections.phaseRoute,
    revisitPhasesSection: workunitProjections.revisitPhasesSection,
    specificationDisplay: specificationProjections.specificationDisplay,
    specificationMenu: specificationProjections.specificationMenu,
    specificationCompletedMenu: specificationProjections.specificationCompletedMenu,
  },
};
