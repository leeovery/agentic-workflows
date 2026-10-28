'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for specification and
// planning's entry. They go with the specification phase (29.13), which
// removes their callers.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('render spec-review-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('continue variant renders the escape-hatch menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'continue' });
    assert.ok(out.includes('=== MENU: spec review continue gate'));
    assert.ok(out.includes('**`◆ Continue with review?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue review/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip review, proceed to completion/.test(out));
  });

  it('reloop variant renders the another-cycle menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'reloop' });
    assert.ok(out.includes('=== MENU: spec review reloop gate'));
    assert.ok(out.includes('**`◆ Run another review cycle?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Run another review cycle \(all three phases\)/.test(out));
    assert.ok(/\*\*`p\/proceed`\*\* +→ Proceed to completion/.test(out));
  });

  it('rejects a missing or unknown variant and a non-specification address', () => {
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal' }), /--variant must be "continue" or "reloop"/);
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'again' }), /--variant must be "continue" or "reloop"/);
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.planning.portal', variant: 'reloop' }), /address must be <work_unit>\.specification\.<topic>/);
  });
});

describe('render spec-completion-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const ASSESSMENT_MENU = [
    "=== MENU: spec assessment gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
    DOTS,
    '**`◆ Confirm this assessment?`**',
    '',
    '**`y/yes`**   → Confirm assessment',
    '**Comment** → Suggest a different classification',
    '',
  ];
  const assess = (payload) => renderSurface(dir, 'spec-completion-gate', {
    dotpath: 'pay.specification.portal', variant: 'assessment', file: writePayload(dir, 'assessment.json', payload),
  });

  it('assessment variant renders a cross-cutting verdict and its wrapped rationale above the confirm menu', () => {
    assert.strictEqual(assess({
      cross_cutting: true,
      rationale: 'It defines a caching strategy that will inform how multiple features handle data retrieval, rather than being a standalone piece of functionality to build.',
    }), [
      '=== DISPLAY: cross-cutting assessment (emit verbatim as a text code block (```text fence)) ===',
      'Cross-Cutting Assessment',
      '',
      'This specification appears to be cross-cutting.',
      '',
      'It defines a caching strategy that will inform how multiple',
      'features handle data retrieval, rather than being a standalone',
      'piece of functionality to build.',
      '',
      ...ASSESSMENT_MENU,
    ].join('\n'));
  });

  it('assessment variant renders the directly plannable verdict', () => {
    const out = assess({ cross_cutting: false, rationale: 'It builds the refund endpoint.' });
    assert.match(out, /^Cross-Cutting Assessment\n\nThis specification is directly plannable — no cross-cutting promotion needed\.\n\nIt builds the refund endpoint\.\n$/m);
    assert.ok(out.endsWith(ASSESSMENT_MENU.join('\n')));
  });

  it('assessment variant refuses a missing payload, a verdict that is not a boolean, and an empty rationale; signoff takes no payload', () => {
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'assessment' }),
      /--variant assessment takes --file <payload\.json>/);
    assert.throws(() => assess({ cross_cutting: 'yes', rationale: 'r' }), /"cross_cutting" must be true or false/);
    assert.throws(() => assess({ rationale: 'r' }), /"cross_cutting" must be true or false/);
    assert.throws(() => assess({ cross_cutting: true, rationale: '  ' }), /"rationale" must be a non-empty string/);
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', {
      dotpath: 'pay.specification.portal', variant: 'signoff', file: writePayload(dir, 'assessment.json', { cross_cutting: true, rationale: 'r' }),
    }), /--variant signoff takes no --file/);
  });

  it('signoff variant renders the conclude consent', () => {
    const out = renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'signoff' });
    assert.ok(out.includes('=== MENU: spec signoff gate'));
    assert.ok(out.includes('**`◆ Ready to conclude?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Conclude specification and mark as completed/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Add context before concluding/.test(out));
  });

  it('rejects a missing or unknown variant and a non-specification address', () => {
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal' }), /--variant must be "assessment" or "signoff"/);
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'sign-off' }), /--variant must be "assessment" or "signoff"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.discussion.portal', variant: 'signoff' }), /address must be <work_unit>\.specification\.<topic>/);
  });
});

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
