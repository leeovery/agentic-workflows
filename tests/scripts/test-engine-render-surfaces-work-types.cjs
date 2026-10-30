'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the bugfix's
// investigation and the quick-fix's scoping. They go with the work types
// phase (29.15), which removes their callers.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DOTS } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, unwrap, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('render hypothesis-board', () => {
  let dir;
  const dot = 'hooks.investigation.resume-hooks-silently-lost';
  // One long evidence line — the bug this surface exists to kill was a
  // hand-wrapped board, so the pins below check it survives as one line.
  const EVIDENCE = "The cleanup interval is 10s on the daemon's IDLE branch — exactly when a user is rearranging panes, so a moved pane is reaped within ~10s of the move.";
  const confirmed = {
    id: 'H2', claim: "Coordinate drift orphans a live pane's hook", status: 'confirmed',
    rows: [['Evidence', EVIDENCE], ['Measured', '`grep hookCleanupInterval daemon/reaper.go` → 10s, IDLE branch']],
  };
  const tracing = { id: 'H3', claim: 'Identity design half-finished is the root cause', status: 'tracing', rows: [['Basis', 'Half the key was fixed in July.']] };
  const ruledOut = { id: 'H1', claim: 'Restore races the daemon', status: 'ruled-out', rows: [['Evidence', 'Restore completes before the first prune pass.']] };

  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { 'resume-hooks-silently-lost': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (variant, payload) => renderSurface(dir, 'hypothesis-board', {
    dotpath: dot, variant, file: writePayload(dir, `${variant}.json`, payload),
  });

  it('check-in names what resolved, counts the board, and gates', () => {
    const out = render('check-in', { hypotheses: [ruledOut, confirmed, tracing], resolved_now: ['H1', 'H2'], next: 'Synthesise the root cause' });
    assert.ok(out.includes('=== DISPLAY: hypothesis board (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Hypothesis board — Resume Hooks Silently Lost** (3 tracked, 1 confirmed, 1 ruled out, 1 open)'));
    assert.ok(out.includes('Resolved this check-in: H1, H2'));
    assert.ok(out.includes("**H2 — Coordinate drift orphans a live pane's hook** — *confirmed*"));
    assert.ok(out.includes('- **Measured**: `grep hookCleanupInterval daemon/reaper.go` → 10s, IDLE branch'));
    assert.ok(out.includes('**Next**: Synthesise the root cause'));
    assert.ok(out.includes('=== MENU: check-in gate'));
    assert.ok(out.includes('**`◆ Continue as planned?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue with the next trace line/.test(out));
    assert.ok(/\*\*Steer\*\* +→ Tell me what to look at instead, or what this changes/.test(out));
  });

  it('never hand-wraps: an evidence row is one authored line whatever its length', () => {
    const out = render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'x' });
    assert.ok(out.includes(`- **Evidence**: ${EVIDENCE}`), 'the evidence survives as a single line for the renderer to reflow');
    const display = out.split('=== MENU')[0];
    assert.ok(!/\n {2,}\S/.test(display), 'no drawn indentation — the display is markdown, not a laid-out block');
  });

  it('plan carries trace lines and the depth, with the plan gate', () => {
    const out = render('plan', {
      hypotheses: [{ ...tracing, status: 'suspected' }],
      trace_lines: ['daemon/reaper.go — the prune pass', 'hooks/key.go — the key-producing sites'],
      depth: 'check-ins', depth_reasoning: 'two systems and an intermittent symptom',
    });
    assert.ok(out.includes('=== DISPLAY: investigation plan (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Investigation plan — Resume Hooks Silently Lost**'));
    assert.ok(out.includes('**Trace lines**\n- daemon/reaper.go — the prune pass\n- hooks/key.go — the key-producing sites'));
    assert.ok(out.includes('**Depth**: check-ins — two systems and an intermittent symptom'));
    assert.ok(out.includes('**`◆ Does this plan look right?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed with the analysis as planned/.test(out));
    assert.ok(unwrap(out).includes('**Adjust** → Tell me what to change: hypotheses, trace lines, or depth'));
    assert.ok(!out.includes('Resolved this check-in'), 'a plan resolves nothing');
  });

  it('resume re-renders the ledger with what is left', () => {
    const out = render('resume', { hypotheses: [ruledOut, tracing], depth: 'check-ins', remaining: 'H3 is mid-trace' });
    assert.ok(out.includes('=== DISPLAY: resumed plan (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Investigation plan — Resume Hooks Silently Lost · resumed** (2 tracked, 1 ruled out, 1 open)'));
    assert.ok(out.includes('**Depth**: check-ins\n**Remaining**: H3 is mid-trace'));
    assert.ok(out.includes('**`◆ Picking up where we left off — still good?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue as agreed/.test(out));
  });

  it('pivot leads with what changed, then the replacement direction', () => {
    const out = render('pivot', {
      changed: 'The key format itself is malformed.',
      hypotheses: [{ ...tracing, status: 'suspected' }],
      trace_lines: ['hooks/key.go — the four key-producing sites'],
    });
    assert.ok(out.includes('=== DISPLAY: plan pivot (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Plan pivot — Resume Hooks Silently Lost**'));
    assert.ok(out.includes('**What changed**: The key format itself is malformed.'));
    assert.ok(out.includes('**Proposed direction**'));
    assert.ok(out.includes('**`◆ Proceed on the new direction?`**'));
    assert.ok(!out.includes('**Depth**'), 'a pivot proposes a direction, never a new checkpoint depth');
  });

  it('validates the variant, the address, and the ledger', () => {
    const file = writePayload(dir, 'v.json', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'x' });
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, file }), /--variant must be one of plan\/resume\/check-in\/pivot/);
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, variant: 'board' }), /--variant must be one of/);
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, variant: 'check-in' }), /--file <payload\.json> is required/);
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { discussion: { items: { hooks: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'hypothesis-board', { dotpath: 'hooks.discussion.hooks', variant: 'check-in', file }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/,
    );
  });

  it('validates the ledger entries', () => {
    const bad = (h) => () => render('check-in', { hypotheses: h, resolved_now: ['H2'], next: 'x' });
    assert.throws(bad([]), /"hypotheses" must be a non-empty array/);
    assert.throws(bad([{ ...confirmed, id: ' ' }]), /hypotheses\[0\] is missing "id"/);
    assert.throws(bad([confirmed, confirmed]), /duplicate hypothesis id "H2"/);
    assert.throws(bad([{ ...confirmed, claim: '' }]), /hypotheses\[0\] is missing "claim"/);
    assert.throws(bad([{ ...confirmed, status: 'proven' }]), /unknown status "proven" \(expected suspected\/tracing\/confirmed\/ruled-out\)/);
    assert.throws(bad([{ ...confirmed, rows: [] }]), /needs "rows"/);
    assert.throws(bad([{ ...confirmed, rows: [['Evidence']] }]), /row 1 must be a \[label, value\] pair/);
  });

  it('refuses a field that runs to more than one line — it would break the markdown around it', () => {
    const bad = (h) => () => render('check-in', { hypotheses: [h], resolved_now: ['H2'], next: 'x' });
    assert.throws(bad({ ...confirmed, claim: 'Coordinate drift\norphans a hook' }), /hypotheses\[0\] claim runs to more than one line — split it across rows, or leave the detail in the investigation file/);
    assert.throws(bad({ ...confirmed, rows: [['Evidence', 'line one\nline two']] }), /hypotheses\[0\] row 1 value runs to more than one line/);
    assert.throws(bad({ ...confirmed, rows: [['Ev\nidence', 'x']] }), /hypotheses\[0\] row 1 label runs to more than one line/);
    assert.throws(
      () => render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'Trace the reaper\nthen the doctor' }),
      /"next" runs to more than one line/,
    );
    assert.throws(
      () => render('plan', { hypotheses: [confirmed], trace_lines: ['daemon/reaper.go\nhooks/key.go'], depth: 'check-ins', depth_reasoning: 'x' }),
      /trace_lines\[0\] runs to more than one line/,
    );
  });

  it('carries any ledger shape — free row labels, however many a hypothesis needs', () => {
    const out = render('check-in', {
      hypotheses: [
        { id: 'A', claim: 'One line of basis is enough', status: 'ruled-out', rows: [['Ruled out by', 'The sampled runs disagree with it.']] },
        {
          id: 'B',
          claim: 'This one earned six rows',
          status: 'confirmed',
          rows: [['Evidence', 'a'], ['Measured', 'b'], ['Reproduced', 'c'], ['Blast radius', 'd'], ['Why it hid', 'e'], ['Owner', 'f']],
        },
      ],
      resolved_now: ['A', 'B'],
      next: 'x',
    });
    assert.ok(out.includes('**A — One line of basis is enough** — *ruled-out*'));
    assert.ok(out.includes('- **Ruled out by**: The sampled runs disagree with it.'));
    assert.ok(out.includes('- **Why it hid**: e'), 'a label the surface has never seen renders like any other');
    assert.ok(out.includes('(2 tracked, 1 confirmed, 1 ruled out, 0 open)'));
  });

  it('validates each variant against what it must carry', () => {
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: [], next: 'x' }), /"resolved_now" must be a non-empty array/);
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: ['H9'], next: 'x' }), /"resolved_now" names "H9", which is not on the board/);
    assert.throws(
      () => render('check-in', { hypotheses: [tracing], resolved_now: ['H3'], next: 'x' }),
      /"H3" is named in "resolved_now" but its status is "tracing" — a resolved hypothesis is confirmed or ruled-out/,
    );
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'] }), /"next" must be a non-empty string/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: [], depth: 'check-ins', depth_reasoning: 'x' }), /"trace_lines" must be a non-empty array/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: ['t'] }), /"depth_reasoning" must be a non-empty string/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: ['t'], depth: 'deep', depth_reasoning: 'x' }), /"depth" must be one of straight-through\/check-ins/);
    assert.throws(() => render('resume', { hypotheses: [confirmed], depth: 'check-ins' }), /"remaining" must be a non-empty string/);
    assert.throws(() => render('pivot', { hypotheses: [confirmed], trace_lines: ['t'] }), /"changed" must be a non-empty string/);
  });
});

describe('render findings-signoff-gate', () => {
  let dir;
  const dot = 'hooks.investigation.crash';
  const record = () => {
    const p = path.join(dir, '.leeway', 'hooks', 'investigation', 'crash.md');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '# Investigation — crash\n');
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('asks the sign-off over the retelling, the technical lens and the record itself', () => {
    record();
    assert.strictEqual(renderSurface(dir, 'findings-signoff-gate', { dotpath: dot }), [
      "=== MENU: findings sign-off gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Do these findings match your understanding?`**',
      '',
      '**`y/yes`**            → Findings are correct, move to fix exploration',
      "**`t/technical`**      → Retell the findings from the code's",
      `${NB(19)}perspective`,
      '**`v/view`**           → Show the full investigation file',
      "**Provide feedback** → Tell me what's off or unclear",
      '',
    ].join('\n'));
  });

  it('refuses another phase, an unknown unit, and a topic with no investigation file', () => {
    record();
    assert.throws(() => renderSurface(dir, 'findings-signoff-gate', { dotpath: 'hooks.discussion.crash' }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'findings-signoff-gate', { dotpath: 'ghost.investigation.crash' }),
      /work unit "ghost" not found/);
    assert.throws(() => renderSurface(dir, 'findings-signoff-gate', { dotpath: 'hooks.investigation.other' }),
      /no investigation file for "other" — the sign-off is read from the record/);
  });
});

describe('render validation-gate / validation-report', () => {
  let dir;
  const inv = 'hooks.investigation.crash';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const report = (variant, payload) => renderSurface(dir, 'validation-report', {
    dotpath: inv, variant, file: writePayload(dir, `v-${variant}.json`, payload),
  });

  const RC_CHECKS = [['Symptom coverage', 'all three trace to the same call'], ['Blast radius', 'two further callers share the path']];
  const FX_CHECKS = [['Root cause coverage', 'every symptom resolved'], ['Side effects', 'none identified']];
  const rcClean = {
    status: 'validated', confidence: 'high', checks: RC_CHECKS,
    summary: 'The diagnosis holds against a fresh trace.',
    analysis_path: '.leeway/.cache/hooks/investigation/crash/agents/002.md',
  };
  const fxClean = {
    status: 'validated', confidence: 'medium', direction: 'Make the address optional', checks: FX_CHECKS,
    summary: 'The direction breaks the causal chain and no caller depends on the throw.',
    analysis_path: 'p.md',
  };

  it('offers the root cause validation in its own words, payload-less', () => {
    const rc = renderSurface(dir, 'validation-gate', { dotpath: inv, variant: 'root-cause' });
    assert.ok(rc.includes('=== MENU: root-cause validation offer'));
    assert.ok(rc.includes('**`◆ Root cause documented. Run validation?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Run root cause validation/.test(rc));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip straight to findings sign-off/.test(rc));
  });

  it('never offers the fix validation — an agreed direction is always pressure-tested', () => {
    assert.throws(
      () => renderSurface(dir, 'validation-gate', { dotpath: inv, variant: 'fix' }),
      /--variant must be root-cause — the fix direction is always pressure-tested/,
    );
    assert.throws(() => renderSurface(dir, 'validation-gate', { dotpath: inv }), /--variant must be root-cause/);
  });

  it('a clean pass carries the same readout as a failing one, and no menu', () => {
    const out = report('root-cause', rcClean);
    assert.ok(out.includes('**Root cause validation · high confidence** — validated, no gaps found'));
    assert.ok(out.includes('- **Symptom coverage**: all three trace to the same call'));
    assert.ok(out.includes('The diagnosis holds against a fresh trace.'));
    assert.ok(out.includes('*Full analysis: `.leeway/.cache/hooks/investigation/crash/agents/002.md`*'));
    assert.ok(!out.includes('=== MENU'), 'a validated verdict asks nothing');
    const fx = report('fix', fxClean);
    assert.ok(fx.includes('**Fix validation · "Make the address optional" · medium confidence** — confirmed, no unaddressed risks'));
    assert.ok(fx.includes('- **Root cause coverage**: every symptom resolved'));
  });

  it('findings list under the confidence, with the checks, the analysis path and the handling gate', () => {
    const long = 'The trace stops at the tax context, but nothing checks whether the billing address is reliably present on a digital-only order.';
    const out = report('root-cause', {
      ...rcClean, status: 'gaps_found', confidence: 'medium',
      items: [long, 'Empty-string addresses were never exercised.'],
      analysis_path: '.leeway/.cache/hooks/investigation/crash/agents/003.md',
    });
    assert.ok(out.includes('**Root cause validation · medium confidence** — 2 gaps'));
    assert.ok(out.includes('1\\. The trace stops at the tax context'), 'a batch list numbers its rows and never walks them');
    assert.ok(!out.includes('○ 1.'), 'nothing here is walked, so no state glyph');
    assert.ok(out.includes('- **Blast radius**: two further callers share the path'), 'the findings say what was examined too');
    assert.ok(out.includes('*Full analysis: `.leeway/.cache/hooks/investigation/crash/agents/003.md`*'));
    assert.ok(out.includes('**`◆ How should these gaps be handled?`**'));
    assert.ok(unwrap(out).includes('**`a/address`** → Work through them and fold the answers into the investigation'));
    const fx = report('fix', { ...fxClean, status: 'risks_found', confidence: 'low', items: ['x'] });
    assert.ok(fx.includes('**Fix validation · "Make the address optional" · low confidence** — 1 risk'));
    assert.ok(unwrap(fx).includes('**`a/address`** → Work through them and fold the outcome into the fix direction'));
  });

  it('refuses a verdict that disagrees with its own findings', () => {
    assert.throws(
      () => report('root-cause', { ...rcClean, items: ['a gap'] }),
      /"status" is "validated" but 1 gap\(s\) are listed — the verdict and the findings must agree/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, status: 'gaps_found', items: [] }),
      /"status" is "gaps_found" but no gaps are listed/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, status: 'risks_found', items: ['x'] }),
      /"status" must be "validated" or "gaps_found" for the root-cause variant/,
    );
    assert.throws(
      () => report('fix', { ...fxClean, confidence: 'certain' }),
      /"confidence" must be one of high\/medium\/low/,
    );
  });

  it('holds every verdict to naming what it checked, concluded and confirmed', () => {
    assert.throws(
      () => report('fix', { ...fxClean, direction: undefined }),
      /"direction" must name the agreed approach/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, direction: 'Make the address optional' }),
      /"direction" belongs to the fix variant — root-cause validation has no chosen approach to name/,
    );
    assert.throws(() => report('fix', { ...fxClean, checks: [] }), /"checks" must be a non-empty array/);
    assert.throws(() => report('fix', { ...fxClean, checks: [['Testing']] }), /checks\[0\] must be a \[label, outcome\] pair/);
    assert.throws(() => report('fix', { ...fxClean, summary: undefined }), /"summary" must be a non-empty string/);
    assert.throws(() => report('fix', { ...fxClean, analysis_path: undefined }), /"analysis_path" must be a non-empty string/);
  });

  it('holds the address to the investigation phase', () => {
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { discussion: { items: { crash: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'validation-gate', { dotpath: 'hooks.discussion.crash', variant: 'root-cause' }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/,
    );
  });
});

describe('render fix-direction', () => {
  let dir;
  const dot = 'hooks.investigation.checkout-crash';
  const rows = [['Changes', 'The constructor takes an optional address.'], ['Risk', 'A caller relying on the throw would start succeeding.']];
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { 'checkout-crash': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (payload) => renderSurface(dir, 'fix-direction', { dotpath: dot, file: writePayload(dir, 'fd.json', payload) });

  it('a lone option is unlettered and uncounted', () => {
    const out = render({ options: [{ name: 'Make the address optional', rows }] });
    assert.ok(out.includes('=== DISPLAY: fix direction (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Fix direction — Checkout Crash**\n'));
    assert.ok(!out.includes('approaches)'), 'one approach is not a comparison');
    assert.ok(out.includes('**Make the address optional**\n'), 'no letter where there is nothing to compare against');
    assert.ok(out.includes('- **Changes**: The constructor takes an optional address.'));
    assert.ok(out.includes('=== MENU: fix direction gate'));
    assert.ok(out.includes('**`◆ What are your thoughts?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Agree with this direction and pressure-test it/.test(out), 'agreement commissions the validation');
    assert.ok(unwrap(out).includes('**Provide feedback** → Tell me your thoughts: discuss, challenge, or suggest alternatives'));
  });

  it('several options letter themselves, count themselves, and carry the mark', () => {
    const out = render({
      options: [
        { name: 'Make the address optional', recommended: true, rows },
        { name: 'Guard at the call site', rows },
        { name: 'Backfill the address', rows },
      ],
      recommendation: 'A — it fixes the assumption rather than working around it.',
      open_question: 'Whether the empty-string case is the same bug.',
    });
    assert.ok(out.includes('**Fix direction — Checkout Crash** (3 approaches)'));
    assert.ok(out.includes('**A — Make the address optional** — *recommended*'));
    assert.ok(out.includes('**B — Guard at the call site**\n'));
    assert.ok(out.includes('**C — Backfill the address**\n'));
    assert.ok(out.includes('**Recommendation**: A — it fixes the assumption rather than working around it.'));
    assert.ok(out.includes('**Open question**: Whether the empty-string case is the same bug.'));
  });

  it('a recommendation must say which and why, and only where there is a comparison', () => {
    assert.throws(
      () => render({ options: [{ name: 'a', rows }, { name: 'b', recommended: true, rows }] }),
      /a recommended option needs "recommendation" — the deciding factor, not just the mark/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', rows }, { name: 'b', rows }], recommendation: 'b is better' }),
      /"recommendation" was given but no option is marked "recommended"/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', recommended: true, rows }], recommendation: 'x' }),
      /a lone option cannot be "recommended" — there is nothing to recommend it over/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', recommended: true, rows }, { name: 'b', recommended: true, rows }], recommendation: 'x' }),
      /only one option can be "recommended"/,
    );
  });

  it('validates the options, their rows, and the address', () => {
    assert.throws(() => renderSurface(dir, 'fix-direction', { dotpath: dot }), /--file <payload\.json> is required/);
    assert.throws(() => render({ options: [] }), /"options" must be a non-empty array .* one obvious fix is a valid outcome, none is not/);
    assert.throws(() => render({ options: [{ rows }] }), /options\[0\] is missing "name"/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [] }] }), /options\[0\] needs "rows"/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [['Changes']] }] }), /options\[0\] row 1 must be a \[label, value\] pair/);
    assert.throws(() => render({ options: [{ name: 'a\nb', rows }] }), /options\[0\] name runs to more than one line/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [['Changes', 'one\ntwo']] }] }), /options\[0\] row 1 value runs to more than one line/);
    assert.throws(
      () => render({ options: Array.from({ length: 9 }, (_, i) => ({ name: `o${i}`, rows })) }),
      /9 options is past comparing — this surface letters at most 8/,
    );
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { specification: { items: { 'checkout-crash': { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'fix-direction', { dotpath: 'hooks.specification.checkout-crash', file: writePayload(dir, 'fd2.json', { options: [{ name: 'a', rows }] }) }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "specification"/,
    );
  });
});

describe('render scoping-questions', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'support-email', { work_type: 'quick-fix' });
    writeManifest(dir, 'billing', { work_type: 'feature' });
  });
  afterEach(() => teardown(dir));

  it('asks the four scoping questions in their fixed order, an ask that ends the turn', () => {
    assert.strictEqual(renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: 'exclusions,why,where,what' }), [
      "=== DISPLAY: scoping questions (emit verbatim as a text code block (```text fence), then STOP for the user's response) ===",
      'Scoping: Support Email',
      '',
      'A few questions to scope this change:',
      '',
      '- What exactly is being changed? (pattern, syntax, API)',
      '- Where in the codebase? (files, directories, packages)',
      '- Why? (deprecation, consistency, modernisation)',
      '- Any exceptions or areas to exclude?',
      '',
    ].join('\n'));
  });

  it('asks only the questions the carrier leaves open', () => {
    const out = renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: 'where, exclusions' });
    assert.match(out, /A few questions to scope this change:\n\n- Where in the codebase\? \(files, directories, packages\)\n- Any exceptions or areas to exclude\?\n$/);
    assert.doesNotMatch(out, /What exactly|Why\?/);
  });

  it('scoping-questions refuses no open question, an unknown key, and a unit that is not a quick-fix', () => {
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email' }), /--open <what,where,why,exclusions> is required/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: ' , ' }), /--open <what,where,why,exclusions> is required/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: 'what,how' }), /unknown question "how" — one of what, where, why, exclusions/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'billing', open: 'what' }), /"billing" is a feature — scoping is the quick-fix's own/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email.scoping.support-email', open: 'what' }), /address must be a bare <work_unit>/);
  });
});

describe('render complexity-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'support-email', { work_type: 'quick-fix' });
  });
  afterEach(() => teardown(dir));

  it('names the criteria the payload judged failed, above the continue-or-promote ask', () => {
    const file = writePayload(dir, 'concerns.json', {
      concerns: ['Requires design decisions about the new API surface', 'Three call sites need new behaviour'],
    });
    assert.strictEqual(renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file }), [
      '=== DISPLAY: complexity check (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Complexity Check',
      '',
      'This change may be more involved than a quick-fix:',
      '',
      '  • Requires design decisions about the new API surface',
      '  • Three call sites need new behaviour',
      '',
      "=== MENU: complexity gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`c/continue`** → Continue as quick-fix anyway',
      '**`f/feature`**  → Promote to feature (full pipeline)',
      '**`b/bugfix`**   → Promote to bugfix (investigation pipeline)',
      '',
    ].join('\n'));
  });

  it('complexity-gate refuses a missing payload, an empty or malformed list, and a unit already promoted', () => {
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email' }),
      /--file <payload\.json> is required/);
    const empty = writePayload(dir, 'empty.json', { concerns: [] });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file: empty }),
      /"concerns" must be a non-empty array of non-empty strings/);
    const blank = writePayload(dir, 'blank.json', { concerns: ['  '] });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file: blank }),
      /"concerns" must be a non-empty array of non-empty strings/);
    const wrong = writePayload(dir, 'wrong.json', { concerns: 'too big' });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file: wrong }),
      /"concerns" must be an array of strings/);
    writeManifest(dir, 'support-email', { work_type: 'feature' });
    const file = writePayload(dir, 'concerns.json', { concerns: ['Requires design decisions'] });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file }),
      /"support-email" is a feature — the complexity check is the quick-fix's own/);
  });
});
