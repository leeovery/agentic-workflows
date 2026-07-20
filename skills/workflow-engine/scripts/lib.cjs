'use strict';

// ---------------------------------------------------------------------------
// Engine library entry — the single require() for adapters and skills' scripts.
//
//   const engine = require('../../workflow-engine/scripts/lib.cjs');
//
// Rings:
//   engine.render         kernel — pure layout (no workflow vocabulary)
//   engine.manifest       kernel — work-unit manifest IO (load / atomic save)
//   engine.conventions    domain — workflow glyphs, tags, title composition
//   engine.reads          domain — generic manifest/file reads (no phase semantics)
//   engine.derivations    domain — shared derivations (phase joins, lifecycle, cache status)
//   engine.discussionMap  domain — discussion-map transitions + queries
//   engine.detail         domain — detail builders (the one structured object per work unit)
//   engine.project        domain — projections (dashboard / key / menu / map views)
//   engine.gateway        adapter harness — verb dispatch + output sections
//
// Domain queries, projections, and transitions grow here as call sites
// migrate — added when a real consumer lands, never speculatively.
// ---------------------------------------------------------------------------

const render = require('./kernel/render.cjs');
const manifest = require('./kernel/manifest.cjs');
const conventions = require('./domain/conventions.cjs');
const reads = require('./domain/reads.cjs');
const derivations = require('./domain/derivations.cjs');
const gateway = require('./gateway.cjs');
const epic = require('./domain/epic-detail.cjs');
const start = require('./domain/start.cjs');
const inboxSet = require('./domain/inbox-set.cjs');
const workunit = require('./domain/workunit-detail.cjs');
const workunitManage = require('./domain/workunit-manage.cjs');
const specification = require('./domain/specification.cjs');
const discussionMap = require('./domain/discussion-map.cjs');
const epicProjections = require('./domain/projections/epic.cjs');
const discoveryProjections = require('./domain/projections/discovery-map.cjs');
const discussionProjections = require('./domain/projections/discussion-map.cjs');
const startProjections = require('./domain/projections/start.cjs');
const workunitProjections = require('./domain/projections/workunit.cjs');
const specificationProjections = require('./domain/projections/specification.cjs');

module.exports = {
  render,
  manifest,
  conventions,
  gateway,
  reads: {
    listFiles: reads.listFiles,
    listDirs: reads.listDirs,
    fileExists: reads.fileExists,
    loadManifest: reads.loadManifest,
    filesChecksum: reads.filesChecksum,
    loadActiveManifests: reads.loadActiveManifests,
    loadAllManifests: reads.loadAllManifests,
  },
  derivations: {
    phaseData: derivations.phaseData,
    phaseItems: derivations.phaseItems,
    phaseStatus: derivations.phaseStatus,
    computeNextPhase: derivations.computeNextPhase,
    lastCompletedPhase: derivations.lastCompletedPhase,
    computeAnalysisCacheStatus: derivations.computeAnalysisCacheStatus,
    computeTopicLifecycle: derivations.computeTopicLifecycle,
    computeMapSummary: derivations.computeMapSummary,
    computeSourceProvenance: derivations.computeSourceProvenance,
    compareMapRows: derivations.compareMapRows,
    computeNeedsSequencing: derivations.computeNeedsSequencing,
    buildDiscoveryMap: derivations.buildDiscoveryMap,
  },
  discussionMap: {
    addSubtopic: discussionMap.addSubtopic,
    setSubtopicState: discussionMap.setSubtopicState,
    mapState: discussionMap.mapState,
    SUBTOPIC_STATES: discussionMap.SUBTOPIC_STATES,
  },
  detail: {
    epicDetail: epic.epicDetail,
    EPIC_DETAIL_PHASES: epic.EPIC_DETAIL_PHASES,
    startDetail: start.startDetail,
    combinedInbox: inboxSet.combinedInbox,
    workingSetDetail: inboxSet.workingSetDetail,
    manageDetail: workunitManage.manageDetail,
    workUnitDetail: workunit.workUnitDetail,
    workUnitIndex: workunit.workUnitIndex,
    WORK_UNIT_TYPES: workunit.WORK_UNIT_TYPES,
    specificationDetail: specification.specificationDetail,
  },
  project: {
    epicDashboard: epicProjections.epicDashboard,
    epicKey: epicProjections.epicKey,
    epicMenu: epicProjections.epicMenu,
    epicCompletedMenu: epicProjections.epicCompletedMenu,
    epicCancelMenu: epicProjections.epicCancelMenu,
    epicReactivateMenu: epicProjections.epicReactivateMenu,
    discoveryMapView: discoveryProjections.discoveryMapView,
    discoverySynthesisView: discoveryProjections.discoverySynthesisView,
    discussionMap: discussionProjections.discussionMap,
    startOverview: startProjections.startOverview,
    startMenu: startProjections.startMenu,
    emptyOverview: startProjections.emptyOverview,
    emptyMenu: startProjections.emptyMenu,
    inboxPickupView: startProjections.inboxPickupView,
    archivedView: startProjections.archivedView,
    workingSetView: startProjections.workingSetView,
    manageListView: startProjections.manageListView,
    manageUnitView: startProjections.manageUnitView,
    completedView: startProjections.completedView,
    workUnitStatus: workunitProjections.workUnitStatus,
    workUnitMenu: workunitProjections.workUnitMenu,
    workUnitData: workunitProjections.workUnitData,
    revisitablePhases: workunitProjections.revisitablePhases,
    revisitPhasesSection: workunitProjections.revisitPhasesSection,
    specificationDisplay: specificationProjections.specificationDisplay,
    specificationMenu: specificationProjections.specificationMenu,
    specificationCompletedMenu: specificationProjections.specificationCompletedMenu,
  },
};
