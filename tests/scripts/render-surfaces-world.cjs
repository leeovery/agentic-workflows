'use strict';

// ---------------------------------------------------------------------------
// What the render-surface suites share (test-render-surfaces-kernel.cjs and
// test-engine-render-surfaces*.cjs): the domain's renderSurface with every
// gate payload audited against its menu, the project world they render over
// (`setup`, `teardown`), a unit's manifest and a payload written into it,
// and the readings their goldens and wording asserts take (`NB`, `unwrap`,
// `esc`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');

const { auditingRender } = require('./gate-audit.cjs');
const { setupFixture, cleanupFixture } = require('./discovery-test-utils.cjs');

const renderSurface = auditingRender(require('../../skills/workflow-engine/scripts/domain/render.cjs').renderSurface);

// Worklist leading indents are non-breaking spaces (a 4-space lead is a code
// block to a markdown renderer) — goldens spell them explicitly.
const NB = (n) => ' '.repeat(n);

// Reverse the menu label wrap for wording asserts: a continuation joins its
// previous line with the single space the break replaced. Exact only for
// labels with no markup spanning the break — layout itself is covered by
// the byte-exact pins.
const unwrap = (s) => s.replace(/\n +/g, ' ');

/** A string matched literally inside a regular expression. */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function setup() {
  return setupFixture('render-surfaces-');
}
function teardown(dir) {
  cleanupFixture(dir);
}
function writeManifest(dir, name, data) {
  const mdir = path.join(dir, '.leeway', name);
  fs.mkdirSync(mdir, { recursive: true });
  fs.writeFileSync(path.join(mdir, 'manifest.json'), JSON.stringify({
    name, work_type: 'epic', status: 'in-progress', description: 'Test', phases: {}, ...data,
  }, null, 2));
}
function writePayload(dir, rel, obj) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return rel;
}

module.exports = { renderSurface, NB, unwrap, esc, setup, teardown, writeManifest, writePayload };
