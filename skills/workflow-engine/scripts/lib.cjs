'use strict';

// ---------------------------------------------------------------------------
// Engine library entry — the single require() for adapters and skills' scripts.
//
//   const engine = require('../../workflow-engine/scripts/lib.cjs');
//
// Rings:
//   engine.render       kernel — pure layout (no workflow vocabulary)
//   engine.manifest     kernel — work-unit manifest IO (load / atomic save)
//   engine.conventions  domain — workflow glyphs, tags, title composition
//   engine.map          domain — discussion-map transitions + queries
//   engine.detail       domain — detail builders (the one structured object per work unit)
//   engine.project      domain — projections (dashboard / key / menu / map views)
//   engine.gateway      adapter harness — verb dispatch + output sections
//
// Domain queries, projections, and transitions grow here as call sites
// migrate — added when a real consumer lands, never speculatively.
// ---------------------------------------------------------------------------

const render = require('./kernel/render.cjs');
const manifest = require('./kernel/manifest.cjs');
const conventions = require('./domain/conventions.cjs');
const gateway = require('./gateway.cjs');
const epic = require('./domain/epic.cjs');
const start = require('./domain/start.cjs');
const workunit = require('./domain/workunit.cjs');
const map = require('./domain/map.cjs');
const epicProjections = require('./domain/projections/epic.cjs');
const discussionProjections = require('./domain/projections/discussion.cjs');
const startProjections = require('./domain/projections/start.cjs');
const workunitProjections = require('./domain/projections/workunit.cjs');

module.exports = {
  render,
  manifest,
  conventions,
  gateway,
  map: {
    addSubtopic: map.addSubtopic,
    setSubtopicState: map.setSubtopicState,
    mapState: map.mapState,
    SUBTOPIC_STATES: map.SUBTOPIC_STATES,
  },
  detail: {
    epicDetail: epic.epicDetail,
    EPIC_PHASES: epic.EPIC_PHASES,
    startDetail: start.startDetail,
    workUnitDetail: workunit.workUnitDetail,
    workUnitIndex: workunit.workUnitIndex,
    WORK_UNIT_TYPES: workunit.WORK_UNIT_TYPES,
  },
  project: {
    epicDashboard: epicProjections.epicDashboard,
    epicKey: epicProjections.epicKey,
    epicMenu: epicProjections.epicMenu,
    discussionMap: discussionProjections.discussionMap,
    startOverview: startProjections.startOverview,
    startMenu: startProjections.startMenu,
    workUnitStatus: workunitProjections.workUnitStatus,
    workUnitMenu: workunitProjections.workUnitMenu,
    workUnitData: workunitProjections.workUnitData,
  },
};
