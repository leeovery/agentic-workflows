'use strict';

// ---------------------------------------------------------------------------
// The start skill's projections (leeway-engine/scripts/domain/projections/
// start.cjs): the completed and cancelled action menu, a golden of the
// screen whole.
//
// Layer: verb, the projection called in process over the state the start
// reads. World: the project world (`setupFixture`), copied for each test,
// its manifests written by hand in the shapes the discovery suites produce.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');

const DOTS = '· · · · · · · · · · · ·';

describe('start projections: the completed and cancelled action menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function closedFixture(d) {
    createManifest(d, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(d, 'done-cc', { work_type: 'cross-cutting', status: 'completed', phases: { specification: { items: { 'done-cc': { status: 'completed' } } } } });
    createManifest(d, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
  }

  it('the action menu renders over the selected unit, and refuses one the list never holds', () => {
    const { renderSurface } = require('../../skills/leeway-engine/scripts/domain/render.cjs');
    closedFixture(dir);

    assert.strictEqual(renderSurface(dir, 'completed-actions', { dotpath: 'done-feat' }), [
      "=== MENU: completed actions (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**Done Feat** (completed)',
      '',
      '**`◆ What would you like to do?`**',
      '',
      '**`r/reactivate`** → Set status back to in-progress',
      '**`b/back`**       → Return to the list',
      '**Ask**          → Ask a question about this work unit',
      '',
    ].join('\n'));

    assert.match(renderSurface(dir, 'completed-actions', { dotpath: 'dropped' }), /\*\*Dropped\*\* \(cancelled\)/);
    createManifest(dir, 'live-one', {});
    assert.throws(() => renderSurface(dir, 'completed-actions', { dotpath: 'live-one' }),
      /render completed-actions: "live-one" is not completed or cancelled \(status: in-progress\)/);
    assert.throws(() => renderSurface(dir, 'completed-actions', { dotpath: 'ghost' }),
      /render completed-actions: work unit "ghost" not found/);
  });
});
