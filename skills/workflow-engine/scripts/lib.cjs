'use strict';

// ---------------------------------------------------------------------------
// Engine library entry — the single require() for adapters and skills' scripts.
//
//   const engine = require('../../workflow-engine/scripts/lib.cjs');
//
// Rings:
//   engine.render       kernel — pure layout (no workflow vocabulary)
//   engine.conventions  domain — workflow glyphs, tags, title composition
//   engine.detail       domain — detail builders (the one structured object per work unit)
//   engine.project      domain — projections (dashboard / key / menu views over a detail)
//   engine.gateway      adapter harness — verb dispatch + output sections
//
// Domain queries, projections, and transitions grow here as call sites
// migrate — added when a real consumer lands, never speculatively.
// ---------------------------------------------------------------------------

const render = require('./kernel/render.cjs');
const conventions = require('./domain/conventions.cjs');
const gateway = require('./gateway.cjs');
const epic = require('./domain/epic.cjs');
const epicProjections = require('./domain/projections/epic.cjs');

module.exports = {
  render,
  conventions,
  gateway,
  detail: { epicDetail: epic.epicDetail, EPIC_PHASES: epic.EPIC_PHASES },
  project: {
    epicDashboard: epicProjections.epicDashboard,
    epicKey: epicProjections.epicKey,
    epicMenu: epicProjections.epicMenu,
  },
};
