'use strict';

// ---------------------------------------------------------------------------
// Engine library entry — the single require() for adapters and skills' scripts.
//
//   const engine = require('../../workflow-engine/scripts/lib.cjs');
//
// Rings:
//   engine.render       kernel — pure layout (no workflow vocabulary)
//   engine.conventions  domain — workflow glyphs, tags, title composition
//   engine.gateway      adapter harness — verb dispatch + output sections
//
// Domain queries (`engine.detail.*`), projections (`engine.project.*`), and
// transitions grow here as call sites migrate — added when a real consumer
// lands, never speculatively.
// ---------------------------------------------------------------------------

const render = require('./kernel/render.cjs');
const conventions = require('./domain/conventions.cjs');
const gateway = require('./gateway.cjs');

module.exports = { render, conventions, gateway };
