'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for planning's entry:
// the plan-context gate and the cross-cutting gate and references.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { DOTS } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('render plan-context-gate', () => {
  let dir;
  const dot = 'checkout.planning.checkout';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'checkout', { work_type: 'feature' });
  });
  afterEach(() => teardown(dir));

  it('offers the specification as-is beside the chance to add what changed', () => {
    assert.strictEqual(renderSurface(dir, 'plan-context-gate', { dotpath: dot }), [
      "=== MENU: plan context gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Any new context since the specification was completed?`**',
      '',
      '**`c/continue`**  → Continue with the specification as-is',
      '**Add context** → Tell me the priorities, constraints, or new',
      `${NB(14)}considerations`,
      '',
    ].join('\n'));
  });

  it('refuses another phase, an unknown unit, and a plan already under way', () => {
    assert.throws(() => renderSurface(dir, 'plan-context-gate', { dotpath: 'checkout.specification.checkout' }),
      /address must be <work_unit>\.planning\.<topic>, got phase "specification"/);
    assert.throws(() => renderSurface(dir, 'plan-context-gate', { dotpath: 'ghost.planning.checkout' }),
      /work unit "ghost" not found/);
    writeManifest(dir, 'checkout', {
      work_type: 'feature',
      phases: { planning: { items: { checkout: { status: 'in-progress' } } } },
    });
    assert.throws(() => renderSurface(dir, 'plan-context-gate', { dotpath: dot }),
      /planning item "checkout" is in-progress — the context offer opens a fresh plan/);
  });

  it('a planning item restored to never-attempted still opens the offer', () => {
    writeManifest(dir, 'checkout', {
      work_type: 'feature',
      phases: { planning: { items: { checkout: { status: null } } } },
    });
    assert.match(renderSurface(dir, 'plan-context-gate', { dotpath: dot }),
      /◆ Any new context since the specification was completed\?/);
  });
});

describe('render cross-cutting-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'cache-policy', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'cache-policy': { status: 'in-progress' } } } },
    });
  });
  afterEach(() => teardown(dir));

  it('names the specs the payload judged relevant, above the continue-or-stop ask', () => {
    writeManifest(dir, 'error-shape', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'error-shape': { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'units.json', { units: ['cache-policy', 'error-shape'] });
    assert.strictEqual(renderSurface(dir, 'cross-cutting-gate', { file }), [
      '=== DISPLAY: cross-cutting in progress (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Cross-cutting specifications still in progress:',
      '  These may contain architectural decisions relevant to this',
      '  plan.',
      '',
      '  • cache-policy',
      '  • error-shape',
      '',
      "=== MENU: cross-cutting gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Proceed without these, or complete them first?`**',
      '',
      '**`c/continue`** → Plan without them',
      '**`s/stop`**     → Complete them first',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload, an empty or malformed list, and a name the record does not hold', () => {
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', {}),
      /--file <payload\.json> is required/);
    const empty = writePayload(dir, 'empty.json', { units: [] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file: empty }),
      /"units" is empty — the gate renders over the specs this plan must know about/);
    const wrong = writePayload(dir, 'wrong.json', { units: 'cache-policy' });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file: wrong }),
      /"units" must be an array of strings/);
    const ghost = writePayload(dir, 'ghost.json', { units: ['ghost'] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file: ghost }),
      /"ghost" is not a cross-cutting work unit with a specification in progress/);
  });

  it('refuses a finished cross-cutting spec and a unit of another type', () => {
    const file = writePayload(dir, 'units.json', { units: ['cache-policy'] });
    writeManifest(dir, 'cache-policy', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'cache-policy': { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file }),
      /"cache-policy" is not a cross-cutting work unit with a specification in progress/);
    writeManifest(dir, 'cache-policy', {
      work_type: 'feature',
      phases: { specification: { items: { 'cache-policy': { status: 'in-progress' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file }),
      /"cache-policy" is not a cross-cutting work unit with a specification in progress/);
  });
});

describe('render cross-cutting-references', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    for (const name of ['cache-policy', 'error-shape']) {
      writeManifest(dir, name, {
        work_type: 'cross-cutting',
        status: 'completed',
        phases: { specification: { items: { [name]: { status: 'completed' } } } },
      });
    }
  });
  afterEach(() => teardown(dir));

  it('lists each spec the payload judged relevant with its summary, wrapped under the text', () => {
    const file = writePayload(dir, 'refs.json', {
      units: [
        { name: 'cache-policy', summary: 'Reads go through a per-request cache keyed by tenant; writes invalidate the key they touch.' },
        { name: 'error-shape', summary: 'One error envelope.' },
      ],
    });
    assert.strictEqual(renderSurface(dir, 'cross-cutting-references', { file }), [
      '=== DISPLAY: cross-cutting references (emit verbatim as a text code block (```text fence)) ===',
      'Cross-cutting specifications to reference:',
      '  • cache-policy: Reads go through a per-request cache keyed by',
      '    tenant; writes invalidate the key they touch.',
      '  • error-shape: One error envelope.',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload, an empty or malformed list, and a row without a name or summary', () => {
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', {}),
      /--file <payload\.json> is required/);
    const empty = writePayload(dir, 'empty.json', { units: [] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: empty }),
      /"units" must be a non-empty array of \{name, summary\}/);
    const flat = writePayload(dir, 'flat.json', { units: ['cache-policy'] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: flat }),
      /every unit needs a non-empty "name" and "summary"/);
    const summaryless = writePayload(dir, 'summaryless.json', { units: [{ name: 'cache-policy', summary: ' ' }] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: summaryless }),
      /every unit needs a non-empty "name" and "summary"/);
  });

  it('refuses a name the record does not hold, a spec still being written, and a unit of another type', () => {
    const ghost = writePayload(dir, 'ghost.json', { units: [{ name: 'ghost', summary: 'Nothing.' }] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: ghost }),
      /"ghost" is not a cross-cutting work unit with a completed specification/);
    const file = writePayload(dir, 'refs.json', { units: [{ name: 'cache-policy', summary: 'Per-request cache.' }] });
    writeManifest(dir, 'cache-policy', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'cache-policy': { status: 'in-progress' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file }),
      /"cache-policy" is not a cross-cutting work unit with a completed specification/);
    writeManifest(dir, 'cache-policy', {
      work_type: 'feature',
      phases: { specification: { items: { 'cache-policy': { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file }),
      /"cache-policy" is not a cross-cutting work unit with a completed specification/);
  });
});
