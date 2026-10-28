'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for specification,
// planning's entry and the cross-cutting references. They go with the
// specification phase (29.13), which replaces them.
//
// Layer: unit, the domain's renderSurface called in process, every gate
// payload audited against its menu (gate-audit.cjs). World: the project world
// (setupFixture), its manifests and payloads written per test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DOTS, bulletRow } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
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

describe('render convergence-diagnostic', () => {
  let dir;
  const base = {
    loop_type: 'spec-review', latest_cycle: 5, trend: 'converging',
    resolved: [{ title: 'Marker semantics restated twice', last_seen_cycle: 4 }],
    recurring: [{ title: 'Guard scope drifts per section', cycles: '3, 4, 5', hypothesis: 'Each fix re-words the guard where it lands instead of at its home.' }],
    new: [{ title: 'Sweep table omits the two below-the-line files' }],
    stream_counts: [{ label: 'claims', count: 0 }, { label: 'input review', count: 1 }, { label: 'gap analysis', count: 1 }],
    review_baseline_words: 6835, live_words: 13637,
  };
  const flagText = (s) => s.slice(s.indexOf('⚑')).replace(/\n\s+/g, ' ').trim();
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the head, streams, signed growth, finding sections, and the growth note', () => {
    const file = writePayload(dir, 'c.json', base);
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: convergence diagnostic (emit verbatim as a text code block (```text fence)) ==='));
    assert.ok(out.includes('===\n── Spec Review — cycle 5 diagnostic ─'), 'the heading is the drawn in-fence divider');
    assert.strictEqual([...out.split('\n')[1]].length, 65, 'the divider fills the display width');
    assert.ok(out.includes('  Trend: converging'));
    assert.ok(out.includes('  Latest cycle: 2 findings (1 new, 1 recurring)'), 'counts derive from the arrays');
    assert.ok(out.includes('  Per stream: claims 0 · input review 1 · gap analysis 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.ok(out.includes('    • Marker semantics restated twice (fixed in cycle 4)'));
    assert.ok(out.includes('    • Guard scope drifts per section (cycles 3, 4, 5)\n      · Each fix re-words the guard where it lands instead of at\n        its home.'), 'the hypothesis is a sub-detail under the bullet text, wrapped under its own marker');
    assert.ok(out.includes('  ⚑ Resolved findings outnumber new ones — the cycles are closing\n    ground.'));
    assert.ok(out.includes('⚑ Review has added 6802 words to a 6835-word construction.'), 'the >25% growth note fires and names the spec loop\'s document');
    assert.match(flagText(out), /growth from review-authored rules is the review deciding for the user\./, 'the growth note names review-authored growth');
    assert.ok(!flagText(out).includes('writing rules the record never decided'), 'the churn warning stays quiet on a converging trend');
  });

  it('churning with growth fires both spec flags; negative growth renders signed and quiets the note', () => {
    const churn = writePayload(dir, 'c2.json', { ...base, trend: 'churning' });
    let out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: churn });
    assert.match(flagText(out), /the review is writing rules the record never decided/, 'the churn-growth warning fires');
    assert.match(flagText(out), /anything else is a decision nobody made/, 'the warning names the bar a finding clears');
    assert.ok(!flagText(out).includes('before running another cycle'), 'the warning describes the churn, it never orders the next cycle');
    assert.ok(out.includes('⚑ Review has added 6802 words'));
    const shrink = writePayload(dir, 'c3.json', { ...base, live_words: 6500 });
    out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: shrink });
    assert.ok(out.includes('(-335 net across review)'), 'shrink renders a signed value, never +-');
    assert.ok(!out.includes('Review has added'), 'no growth note on a shrinking document');
  });

  it('the churn trend is loop-neutral — a fix loop carries the same sentence, alone', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'ch.json', { loop_type: 'fix', latest_cycle: 2, trend: 'churning', resolved: [{ title: 'Off-by-one', last_seen_cycle: 1 }], recurring: [], new: [{ title: 'Missing guard' }] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(flagText(out), '⚑ Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.');
  });

  it('planning-review carries growth too — the flags name the plan and the mechanism', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'pr.json', {
      ...base, loop_type: 'planning-review', trend: 'churning',
      stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 1 }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('── Plan Review — cycle 5 diagnostic ─'));
    assert.ok(out.includes('  Per stream: traceability 1 · integrity 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.match(flagText(out), /the review is writing mechanism the specification never decided/, 'the churn-growth warning reads for the plan');
    assert.match(flagText(out), /a corrected mechanism is the builder's\./, 'the warning leaves mechanism to the builder');
    assert.match(flagText(out), /Review has added 6802 words to a 6835-word plan\./, 'the growth note names the plan, never a construction');
    assert.match(flagText(out), /growth from review-authored mechanism is the review deciding for the builder\./);
    assert.ok(!flagText(out).includes('writing rules the record never decided'), 'the spec loop\'s wording stays with the spec loop');
  });

  it('every trend callout describes what the cycles show — none prescribes a next move', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const lines = {
      churning: '⚑ Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.',
      converging: '⚑ Resolved findings outnumber new ones — the cycles are closing ground.',
      stable: '⚑ Resolved and new findings match cycle for cycle — the loop is holding where it is.',
      diverging: '⚑ New findings outnumber resolved ones — the fixes are introducing new issues.',
    };
    for (const [trend, line] of Object.entries(lines)) {
      const file = writePayload(dir, `t-${trend}.json`, { loop_type: 'fix', latest_cycle: 2, trend, resolved: [], recurring: [], new: [{ title: 'Missing guard' }] });
      const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
      assert.strictEqual(flagText(out), line, `the ${trend} callout states the reading and stops there`);
    }
  });

  it('single-stream loops skip streams and growth; a fix-loop shape renders lean', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'f.json', { loop_type: 'fix', latest_cycle: 3, trend: 'stable', resolved: [], recurring: [{ title: 'Assertion drifts', cycles: '2, 3', hypothesis: 'The fixture regenerates with a shifting seed.' }], new: [] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('── Fix Loop — cycle 3 diagnostic ─'));
    assert.ok(!out.includes('Per stream'));
    assert.ok(!out.includes('Document growth'));
    assert.ok(!out.includes('Resolved:'), 'empty sections are skipped');
    assert.ok(out.includes('  ⚑ Resolved and new findings match cycle for cycle — the loop is\n    holding where it is.'), 'the stable flag wraps via the callout');
  });

  it('a long finding wraps with its continuation under the text, never at column 0', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'w.json', {
      loop_type: 'fix', latest_cycle: 3, trend: 'converging',
      resolved: [{ title: 'Detached-element mute is a no-op — a re-parented <style> goes live in the app document', last_seen_cycle: 1 }],
      recurring: [{ title: 'A hostile document stylesheet still reaches the application chrome (criterion 3)', cycles: '1, 2, 3', hypothesis: 'Containment rests on two mechanisms of unequal strength — the engine\'s own @scope matching, which has held under every probe, and a fallback the tests never reach.' }],
      new: [{ title: 'Nothing verifies the composed stylesheet\'s structure before it is published' }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    const body = out.split('\n').slice(1).filter((l) => l !== '' && !l.startsWith('==='));
    assert.ok(body.every((l) => [...l].length <= 65), 'every line fits the pinned width');
    assert.ok(body.every((l) => l === body[0] || l.startsWith('  ')), 'only the heading sits at column 0');
    assert.ok(out.includes('    • Detached-element mute is a no-op — a re-parented <style>\n      goes live in the app document (fixed in cycle 1)'), 'a resolved row wraps under its text');
    assert.ok(out.includes('    • A hostile document stylesheet still reaches the application\n      chrome (criterion 3) (cycles 1, 2, 3)\n      · Containment rests on two mechanisms of unequal strength —\n        the engine\'s own @scope matching, which has held under\n        every probe, and a fallback the tests never reach.'), 'the hypothesis wraps under its own marker at the bullet-text column');
    assert.ok(out.includes('    • Nothing verifies the composed stylesheet\'s structure before\n      it is published'), 'a new row wraps under its text');
  });

  it('short content renders one line per item, unchanged', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 's.json', {
      loop_type: 'fix', latest_cycle: 2, trend: 'converging',
      resolved: [{ title: 'Off-by-one', last_seen_cycle: 1 }],
      recurring: [{ title: 'Flaky seed', cycles: '1, 2', hypothesis: 'The fixture reseeds.' }],
      new: [{ title: 'Missing guard' }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: convergence diagnostic (emit verbatim as a text code block (```text fence)) ===',
      `── Fix Loop — cycle 2 diagnostic ${'─'.repeat(32)}`,
      '',
      '  Trend: converging',
      '  Latest cycle: 2 findings (1 new, 1 recurring)',
      '',
      '  Resolved:',
      '    • Off-by-one (fixed in cycle 1)',
      '',
      '  Recurring:',
      '    • Flaky seed (cycles 1, 2)',
      '      · The fixture reseeds.',
      '',
      '  New this cycle:',
      '    • Missing guard',
      '',
      '  ⚑ Resolved findings outnumber new ones — the cycles are closing',
      '    ground.',
      '',
    ].join('\n'));
  });

  it('a head line past the budget wraps beneath its indent', () => {
    const file = writePayload(dir, 'g.json', { ...base, review_baseline_words: 123456, live_words: 234567 });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('  Document growth: 123456 → 234567 words (+111111 net across\n  review)'), 'the growth line wraps at the head indent');
  });

  it('validates loudly: enums, cycle floor, shapes, stream and growth pairing', () => {
    const cases = [
      [{ ...base, loop_type: 'review' }, /"loop_type" must be one of fix\/analysis\/planning-review\/spec-review/],
      [{ ...base, trend: 'oscillating' }, /"trend" must be one of/],
      [{ ...base, latest_cycle: 1 }, /"latest_cycle" must be an integer ≥ 2/],
      [{ ...base, recurring: [{ title: 'x', cycles: '2, 3' }] }, /recurring\[0\] is missing "hypothesis"/],
      [{ ...base, stream_counts: undefined }, /"spec-review" carries "stream_counts"/],
      [{ ...base, loop_type: 'fix', review_baseline_words: undefined, live_words: undefined, stream_counts: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }] }, /"fix" is single-stream/],
      [{ ...base, loop_type: 'analysis', stream_counts: undefined }, /document growth belongs to spec-review and planning-review/],
      [{ ...base, live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
      [{ ...base, loop_type: 'planning-review', stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 0 }], live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
    ];
    cases.forEach(([payload, re], i) => {
      const file = writePayload(dir, `bad-${i}.json`, payload);
      assert.throws(() => renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file }), re);
    });
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

describe('render carry-note-gate', () => {
  let dir;
  const payload = { note: ['→ search-cache: the eviction rule this session settled invalidates its TTL note.'], target: 'search-cache', landing_phase: 'discussion' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { research: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the note, the addressed-to line, and the landing menu', () => {
    const file = writePayload(dir, 'n.json', payload);
    const out = renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file });
    assert.ok(out.includes('=== DISPLAY: carry note'));
    assert.ok(out.includes(payload.note[0]));
    assert.ok(out.includes('*Addressed to: search-cache — lands in its discussion mailbox*'));
    assert.ok(out.includes('=== MENU: carry note gate'));
    assert.ok(out.includes('This note lands in "search-cache"\'s mailbox; if "search-cache" is completed, landing reopens it.'));
    assert.ok(out.includes('**`◆ Land it there?`**'), 'a consent gate carries its glyphed question');
    assert.ok(/\*\*`y\/yes`\*\* +→ Land it there; this document keeps a record of the send/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Leave it as prose in this document/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what to change \(target, phase, or content\)/.test(out));
  });

  it('validates the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal' }), /--file <payload\.json> is required/);
    const bad = writePayload(dir, 'bad.json', { ...payload, note: [] });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: bad }), /"note" must be non-empty/);
    const noTarget = writePayload(dir, 'bad2.json', { ...payload, target: ' ' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: noTarget }), /"target" must be a non-empty string/);
    const badPhase = writePayload(dir, 'bad3.json', { ...payload, landing_phase: 'specification' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: badPhase }), /"landing_phase" must be "research" or "discussion", got "specification"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', payload);
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.discussion.portal', file }), /address must be <work_unit>\.research\.<topic>/);
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

describe('render spec-confirm-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const DISPLAY_HEAD = '=== DISPLAY: spec confirmation (emit verbatim as a text code block (```text fence), directly above the menu) ===';
  const MENU_HEAD = "=== MENU: spec confirm gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===";
  const ASK = [DOTS, '**`◆ Proceed?`**', '', '**`y/yes`**', '**`n/no`**', ''];
  const completed = { status: 'completed' };
  const unit = (specification, discussion = { 'auth-flow': completed, billing: completed, refunds: completed }) =>
    writeManifest(dir, 'pay', { phases: { discussion: { items: discussion }, specification: { items: specification } } });
  const render = (topic) => renderSurface(dir, 'spec-confirm-gate', { dotpath: `pay.specification.${topic}` });
  const single = (topic) => renderSurface(dir, 'spec-confirm-gate', { dotpath: `pay.specification.${topic}`, single: '1' });
  const unify = (topic) => renderSurface(dir, 'spec-confirm-gate', { dotpath: `pay.specification.${topic}`, unify: '1' });

  it('a start that incorporates a started specification: the covered source marked, the supersession', () => {
    unit({
      payments: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } },
      'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } },
    });
    assert.strictEqual(render('payments'), [
      DISPLAY_HEAD,
      'Creating specification: Payments',
      '',
      'Sources:',
      '  • auth-flow (has individual spec — will be incorporated)',
      '  • billing',
      '',
      `Output: ${dir}/.leeway/pay/specification/payments/specification.md`,
      '',
      'After completion:',
      `  ${dir}/.leeway/pay/specification/auth-flow/specification.md → marked as superseded`,
      '',
      MENU_HEAD,
      ...ASK,
    ].join('\n'));
  });

  it('a plain start answers empty — the pick showed everything it does', () => {
    unit({
      payments: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } },
      gone: { status: 'superseded', superseded_by: 'payments', sources: { billing: { status: 'incorporated' } } },
    });
    assert.strictEqual(render('payments'), '');
  });

  it('a continue or a refine answers empty — even one whose start incorporated a specification still live', () => {
    unit({
      core: { status: 'in-progress', incorporates: ['old'], sources: { 'auth-flow': { status: 'incorporated' }, billing: { status: 'pending' } } },
      old: { status: 'completed', sources: { billing: { status: 'incorporated' } } },
      done: { status: 'completed', sources: { refunds: { status: 'incorporated' } } },
      moved: { status: 'completed', sources: { refunds: { status: 'stale' } } },
    });
    for (const topic of ['core', 'old', 'done', 'moved']) assert.strictEqual(render(topic), '', topic);
  });

  it('a proposed grouping keeps every source it names, a gone discussion included', () => {
    unit({
      payments: { status: 'proposed', sources: { phantom: { status: 'pending' }, billing: { status: 'pending' } } },
      billing: { status: 'in-progress', sources: { billing: { status: 'pending' } } },
    });
    assert.match(render('payments'), /Sources:\n {2}• phantom\n {2}• billing \(has individual spec — will be incorporated\)\n/);
  });

  it('--unify: the unify always confirms, listing every started specification it incorporates — or none', () => {
    unit({
      unified: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } },
      'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } },
      billing: { status: 'in-progress', sources: { billing: { status: 'pending' } } },
    });
    assert.strictEqual(unify('unified'), [
      DISPLAY_HEAD,
      'Creating specification: Unified',
      '',
      'Sources:',
      '  • auth-flow',
      '  • billing',
      '',
      'Existing specifications to incorporate:',
      // An absolute path wraps wherever the fixture's temp folder puts the
      // break: the bullet's own wrap lays the rows out.
      ...bulletRow(`${dir}/.leeway/pay/specification/auth-flow/specification.md → will be superseded`),
      ...bulletRow(`${dir}/.leeway/pay/specification/billing/specification.md → will be superseded`),
      '',
      `Output: ${dir}/.leeway/pay/specification/unified/specification.md`,
      '',
      MENU_HEAD,
      ...ASK,
    ].join('\n'));
    unit({ unified: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' } } } });
    const alone = unify('unified');
    assert.match(alone, /Creating specification: Unified\n\nSources:\n {2}• auth-flow\n\nOutput: /);
    assert.doesNotMatch(alone, /Existing specifications to incorporate/);
  });

  it('a grouping named `unified` started plainly is a plain start — empty', () => {
    unit({ unified: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } } });
    assert.strictEqual(render('unified'), '');
  });

  it('a started `unified` is a continue like any other — empty', () => {
    unit({ unified: { status: 'in-progress', sources: { 'auth-flow': { status: 'pending' } } } });
    assert.strictEqual(render('unified'), '');
  });

  describe('--single: the single-discussion path picks nothing, so the confirm is always drawn', () => {
    it('with no item yet, a create of the lone completed discussion', () => {
      unit({}, { 'auth-flow': completed, billing: { status: 'in-progress' }, refunds: { status: 'cancelled' } });
      assert.strictEqual(single('pay'), [
        DISPLAY_HEAD,
        'Creating specification: Pay',
        '',
        'Sources:',
        '  • auth-flow',
        '',
        `Output: ${dir}/.leeway/pay/specification/pay/specification.md`,
        '',
        MENU_HEAD,
        ...ASK,
      ].join('\n'));
      unit({});
      assert.throws(() => single('pay'),
        /no specification "pay" — the single-discussion confirm reads the lone completed discussion, and "pay" has 3/);
    });

    it('a plain start the bare call answers empty for', () => {
      unit({ payments: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' } } } });
      assert.strictEqual(render('payments'), '');
      assert.match(single('payments'), /^=== DISPLAY: spec confirmation .*\nCreating specification: Payments\n\nSources:\n {2}• auth-flow\n\nOutput: /);
    });

    it('a continue: each extraction state its own block', () => {
      unit({
        core: {
          status: 'in-progress',
          sources: { 'auth-flow': { status: 'incorporated' }, billing: { status: 'pending' }, refunds: { status: 'stale' } },
        },
      });
      assert.strictEqual(single('core'), [
        DISPLAY_HEAD,
        'Continuing specification: Core',
        '',
        `Existing: ${dir}/.leeway/pay/specification/core/specification.md [in-progress]`,
        '',
        'Sources to extract:',
        '  • billing [pending]',
        '',
        'Sources re-decided since extraction (reconcile):',
        '  • refunds [stale]',
        '',
        'Previously extracted (for reference):',
        '  • auth-flow',
        '',
        MENU_HEAD,
        ...ASK,
      ].join('\n'));
    });

    it('a continue leaves out a block with nothing in it, and lists every source when all are extracted', () => {
      unit({ core: { status: 'in-progress', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } } });
      const pending = single('core');
      assert.match(pending, /Sources to extract:\n {2}• auth-flow \[pending\]\n {2}• billing \[pending\]\n\n=== MENU/);
      assert.doesNotMatch(pending, /re-decided|Previously extracted/);
      unit({ core: { status: 'in-progress', sources: { 'auth-flow': { status: 'incorporated' }, ghost: { status: 'pending' } } } });
      const extracted = single('core');
      assert.ok(extracted.includes(`Existing: ${dir}/.leeway/pay/specification/core/specification.md [in-progress]\n\nAll sources extracted:\n  • auth-flow\n\n=== MENU`), extracted);
      assert.doesNotMatch(extracted, /ghost/, 'a started specification leaves out a source whose discussion item is gone');
    });

    it('a completed specification with sources left to extract is a continue that names them as new', () => {
      unit({ core: { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' }, refunds: { status: 'pending' } } } });
      const out = single('core');
      assert.ok(out.includes(`Continuing specification: Core\n\nExisting: ${dir}/.leeway/pay/specification/core/specification.md [completed]`), out);
      assert.match(out, /New sources to extract:\n {2}• refunds \[pending\]\n\nPreviously extracted \(for reference\):\n {2}• auth-flow/);
    });

    it('a refine: every source extracted, and the menu opens on where a change of decision belongs', () => {
      unit({ core: { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } } });
      assert.strictEqual(single('core'), [
        DISPLAY_HEAD,
        'Refining specification: Core',
        '',
        `Existing: ${dir}/.leeway/pay/specification/core/specification.md [completed]`,
        '',
        'All sources extracted:',
        '  • auth-flow',
        '',
        MENU_HEAD,
        DOTS,
        'A refinement is for factual corrections and sharpening. A change of decision belongs in the source discussion — reopen that discussion instead; the moment it reopens, this specification is flagged to reconcile against the re-decision.',
        '',
        ...ASK.slice(1),
      ].join('\n'));
    });

    it('refuses a closed specification as the bare call does', () => {
      unit({ old: { status: 'superseded', superseded_by: 'core', sources: { refunds: { status: 'incorporated' } } } });
      assert.throws(() => single('old'), /"old" is superseded — there is nothing to confirm/);
    });
  });

  it('refuses an item it cannot confirm, and an address that is not a specification topic', () => {
    unit({
      old: { status: 'superseded', superseded_by: 'core', sources: { refunds: { status: 'incorporated' } } },
      parked: { status: 'cancelled', sources: { refunds: { status: 'incorporated' } } },
    });
    assert.throws(() => render('old'), /"old" is superseded — there is nothing to confirm/);
    assert.throws(() => render('parked'), /"parked" is cancelled — there is nothing to confirm/);
    assert.throws(() => render('ghost'), /no specification "ghost" — the confirm reads the item the pick names/);
    assert.throws(() => renderSurface(dir, 'spec-confirm-gate', { dotpath: 'pay.planning.core' }),
      /address must be <work_unit>\.specification\.<topic>, got phase "planning"/);
    assert.throws(() => renderSurface(dir, 'spec-confirm-gate', { dotpath: 'pay' }),
      /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'spec-confirm-gate', { dotpath: 'ghost.specification.core' }),
      /work unit "ghost" not found/);
  });
});

describe('render direct-entry-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            alpha: { routing: 'research', source: 'discovery' },
            beta: { routing: 'discussion', source: 'discovery' },
            gamma: { routing: 'discussion', source: 'discovery' },
            delta: { routing: 'research', source: 'discovery' },
            sigma: { routing: 'discussion', source: 'discovery', cancelled: true },
            tau: { routing: 'discussion', source: 'discovery', postponed: true },
          },
        },
        research: { items: { gamma: { status: 'unstarted' }, delta: { status: 'in-progress' } } },
        discussion: { items: { gamma: { status: 'in-progress' } } },
      },
    });
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: { discovery: { items: { feat: { routing: 'research', source: 'discovery' } } } },
    });
  });
  afterEach(() => { teardown(dir); });

  it('a name already on the map answers the red pair naming where the topic stands and its way in — never terminal', () => {
    const out = renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.alpha' });
    assert.strictEqual(out, [
      '=== DISPLAY: direct entry gate (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ "Alpha" is already on the map — it is routed to research and nothing has started',
      '',
      '=== DISPLAY: direct entry guidance (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '> Its row on the menu names the next step.',
      '',
    ].join('\n'));
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.beta' }), /routed to discussion and nothing has started/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.delta' }), /research is in flight on it/);
    // Outstanding research names itself at either door — its row is the topic's own.
    const parked = renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.gamma' });
    assert.match(parked, /⚑ "Gamma" is already on the map — research is parked on it \(mail waiting\)/);
    assert.match(parked, /> Its research row is the way in\./);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.delta' }), /research is in flight on it[\s\S]*Its research row is the way in/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.gamma' }), /research is parked on it \(mail waiting\)[\s\S]*Its research row is the way in/);
  });

  it('a marker-only cancelled row points at the reactivate — it carries no menu row to return to', () => {
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.sigma` });
      assert.match(out, /⚑ "Sigma" is already on the map — it is cancelled and stays on the map as record/, phase);
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Reactivate it from the menu \(`e\/reactivate`\) — a cancelled topic carries no row\./, phase);
      assert.ok(!out.includes('names the next step'), phase);
    }
  });

  /** The project's roadmap, holding tau's item — `pulled_to` another epic when `taken`. */
  function writeRoadmap(taken) {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        tau: {
          horizon: 'next', summary: 's', origin: 'postpone:pay', postponed_from: { work_unit: 'pay', topic: 'tau' },
          ...(taken ? { pulled_to: { work_unit: 'other', topic: 'tau' } } : {}),
        },
      } },
    }, null, 2));
  }

  it('a postponed row points at the pull forward while its roadmap item waits — it carries no menu row either', () => {
    writeRoadmap(false);
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.tau` });
      assert.match(out, /⚑ "Tau" is already on the map — it is postponed and waits on the roadmap/, phase);
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Pull it forward from the menu \(`f\/forward`\) — a postponed topic carries no row\./, phase);
      assert.ok(!out.includes('names the next step'), phase);
    }
  });

  it('a postponed row whose roadmap item another epic took names no way back — the menu has no pull-forward row for it', () => {
    writeRoadmap(true);
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.tau` });
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Its roadmap item has gone to another epic — the topic stays postponed here, with no way back\./, phase);
      assert.ok(!out.includes('f/forward'), phase);
    }
  });

  it('a fresh discussion-routed topic with a parked stub names the research first at either door', () => {
    writeManifest(dir, 'stub', {
      work_type: 'epic',
      phases: {
        discovery: { items: { eta: { routing: 'discussion', source: 'discovery' } } },
        research: { items: { eta: { status: 'unstarted' } } },
      },
    });
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'stub.discussion.eta' }), /research is parked on it \(mail waiting\)[\s\S]*Its research row is the way in/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'stub.research.eta' }), /research is parked on it \(mail waiting\)/);
  });

  it('a closed topic names its closure at either door, research reopened beneath it notwithstanding — a dead end points at discovery\'s reopen', () => {
    writeManifest(dir, 'closed', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          dead: { routing: 'research', source: 'discovery', handled: true },
          gone: { routing: 'research', source: 'discovery' },
        } },
        research: { items: { dead: { status: 'in-progress' }, gone: { status: 'cancelled', previous_status: 'in-progress' } } },
        discussion: { items: { dead: { status: 'completed' }, gone: { status: 'cancelled', previous_status: 'in-progress' } } },
      },
    });
    for (const phase of ['discussion', 'research']) {
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `closed.${phase}.dead` }),
        /⚑ "Dead" is already on the map — it is closed as a dead end and stays on the map as record[\s\S]*> Reopen it in discovery \(`i\/discovery`\) — a dead-ended topic carries no row\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `closed.${phase}.gone` }),
        /it is cancelled and stays on the map as record/);
    }
  });

  it('a decided topic points at the resume — it carries no row of its own; research parked beneath it names its research row instead', () => {
    writeManifest(dir, 'settled', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          done: { routing: 'discussion', source: 'discovery' },
          forwarded: { routing: 'discussion', source: 'discovery' },
        } },
        research: { items: { forwarded: { status: 'unstarted' } } },
        discussion: { items: { done: { status: 'completed' }, forwarded: { status: 'completed' } } },
      },
    });
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `settled.${phase}.done` });
      assert.match(out, /⚑ "Done" is already on the map — discussion has concluded/, phase);
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Resume it from the menu \(`c\/completed`\) — a decided topic carries no row\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `settled.${phase}.forwarded` }),
        /research is parked on it \(mail waiting\)[\s\S]*> Its research row is the way in\./, phase);
    }
  });

  it('a topic whose row is on the menu points at that row — fresh, discussing, and ready for discussion alike', () => {
    writeManifest(dir, 'live', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          talking: { routing: 'discussion', source: 'discovery' },
          researched: { routing: 'research', source: 'discovery' },
        } },
        research: { items: { researched: { status: 'completed' } } },
        discussion: { items: { talking: { status: 'in-progress' } } },
      },
    });
    for (const phase of ['discussion', 'research']) {
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.beta` }),
        /it is routed to discussion and nothing has started[\s\S]*> Its row on the menu names the next step\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `live.${phase}.talking` }),
        /discussion is in flight on it[\s\S]*> Its row on the menu names the next step\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `live.${phase}.researched` }),
        /research has completed and discussion is queued[\s\S]*> Its row on the menu names the next step\./, phase);
    }
  });

  it('empty for a new name, for a feature, and refuses a phase outside research|discussion', () => {
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.omega' }), '');
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.omega' }), '');
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'feat.discussion.feat' }), '');
    assert.throws(() => renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.planning.alpha' }), /phase must be research or discussion/);
  });
});
