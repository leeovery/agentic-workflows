'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the task, finding,
// validation and review. They go with the build and review phase (29.14),
// which replaces them.
//
// Layer: unit, the domain's renderSurface called in process, every gate
// payload audited against its menu (gate-audit.cjs). World: the project world
// (setupFixture), its manifests and payloads written per test; the change-set
// tree's, a git project (setupGitFixture).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, unwrap, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('render task-list', () => {
  let dir;
  const payload = {
    phase: 1,
    phase_name: 'Adapter Wrapper',
    tasks: [
      { name: 'Wrap command', summary: 'Wrap the argv in a shell fallback', edge_cases: ['quotes', 'attach passthrough'] },
      { name: 'Drop wait', summary: 'Remove wait-after-command' },
    ],
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the canonical display plus the gate menu when gated', () => {
    const file = writePayload(dir, 'tl.json', payload);
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: task list (emit verbatim as a text code block (```text fence)) ===',
      'Phase 1: Adapter Wrapper — 2 tasks.',
      '',
      '1. Wrap command',
      '   · Wrap the argv in a shell fallback',
      '   · Edge cases',
      '     ├─ quotes',
      '     └─ attach passthrough',
      '',
      '2. Drop wait',
      '   · Remove wait-after-command',
      '   · Edge cases: none',
      '',
      '=== MENU: task list gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task list?`**',
      '',
      '**`y/yes`**                  → Proceed to authoring',
      '**`a/auto`**                 → Approve this and all remaining task list',
      `${NB(25)}gates automatically`,
      '**Tell me what to change** → which tasks to reorder, split, merge,',
      `${NB(25)}add, edit, or remove`,
      '**Navigate**               → Tell me where to go: a different phase',
      `${NB(25)}or task, or the leading edge`,
      '',
    ].join('\n'));
  });

  it('singular "1 task." and the auto-proceed line when the gate mode is auto', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'tl.json', { ...payload, tasks: [payload.tasks[0]] });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('Phase 1: Adapter Wrapper — 1 task.'));
    assert.ok(out.includes('=== DISPLAY: task list auto-approved (emit verbatim as a text code block (```text fence) — the user set this gate to auto: do not stop; continue as the workflow instructs) ==='));
    assert.ok(out.includes('Phase 1: Adapter Wrapper — task list approved. Proceeding to authoring.'));
    assert.ok(!out.includes('MENU: task list gate'));
  });

  it('defaults to gated when the topic carries no gate mode', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: {} } } });
    const file = writePayload(dir, 'tl.json', payload);
    assert.ok(renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file }).includes('MENU: task list gate'));
  });

  it('validates the payload loudly, naming the field', () => {
    const cases = [
      ['missing.json', 'nope', /payload file not found/],
      [writePayload(dir, 'a.json', 'not json'), null, /not valid JSON/],
      [writePayload(dir, 'b.json', []), null, /must be an object/],
      [writePayload(dir, 'c.json', { phase: 0, phase_name: 'x', tasks: [{ name: 'a', summary: 'b' }] }), null, /"phase" must be a positive integer/],
      [writePayload(dir, 'd.json', { phase: 1, phase_name: ' ', tasks: [{ name: 'a', summary: 'b' }] }), null, /"phase_name" must be a non-empty string/],
      [writePayload(dir, 'e.json', { phase: 1, phase_name: 'x', tasks: [] }), null, /"tasks" must be a non-empty array/],
      [writePayload(dir, 'f.json', { phase: 1, phase_name: 'x', tasks: [{ name: 'a' }] }), null, /task 1 is missing "summary"/],
      [writePayload(dir, 'g.json', { phase: 1, phase_name: 'x', tasks: [{ name: 'a', summary: 'b', edge_cases: [''] }] }), null, /"edge_cases" must be an array of non-empty strings/],
    ];
    for (const [file, , re] of cases) {
      assert.throws(() => renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file }), re);
    }
  });

  it('requires --file', () => {
    assert.throws(() => renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal' }), /--file <payload\.json> is required/);
  });

  it('wraps long summaries and edge cases with hanging indents — nothing lands at column zero', () => {
    const file = writePayload(dir, 'tl.json', {
      phase: 1,
      phase_name: 'X',
      tasks: [{
        name: 'Long task',
        summary: 'wrap '.repeat(40).trim(),
        edge_cases: ['edge '.repeat(30).trim()],
      }],
    });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    const display = out.split('=== MENU')[0].split('\n').slice(1);
    for (const line of display) {
      if (line === '' || line.startsWith('Phase 1:') || /^\d+\. /.test(line)) continue;
      assert.match(line, /^ {3,}/, `display line must be indented, got: "${line}"`);
      assert.ok([...line].length <= 72, `display line must fit the wrap width, got ${[...line].length}`);
    }
  });
});

describe('render plan-progress', () => {
  let dir;
  const CONTINUE_MD = '(emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs)';
  // Phase 1 authored in full, phase 2 half-way; the phase keys `portal-1` and
  // `portal-2` are phases, never tasks. A topic ending in digits keeps the
  // prefix honest: `portal-2` must not read as task 2 of a phase.
  const item = {
    status: 'in-progress',
    task_map: { 'portal-1': 'p1', 'portal-1-1': 'a', 'portal-1-2': 'b', 'portal-1-3': 'c', 'portal-2': 'p2', 'portal-2-1': 'd' },
  };
  const render = (/** @type {Record<string, string>} */ args) => renderSurface(dir, 'plan-progress', { dotpath: 'pay.planning.portal', ...args });
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: item } } } });
  });
  afterEach(() => teardown(dir));

  it('construction-complete and concluded count the plan\'s phases and tasks off task_map', () => {
    assert.strictEqual(render({ variant: 'construction-complete' }), [
      `=== DISPLAY: plan constructed ${CONTINUE_MD} ===`,
      'All phases are complete. The plan has **2 phases** with **4 tasks** total.',
      '',
    ].join('\n'));
    assert.strictEqual(render({ variant: 'concluded' }), [
      `=== DISPLAY: plan concluded ${CONTINUE_MD} ===`,
      'Planning is complete for **pay**.',
      '',
      'The plan contains **2 phases** with **4 tasks** total, reviewed for traceability against the specification and structural integrity.',
      '',
      'Status has been marked as `completed`. The plan is ready for implementation.',
      '',
    ].join('\n'));
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_map: { 'portal-1': 'p1', 'portal-1-1': 'a' } } } } } });
    assert.ok(render({ variant: 'construction-complete' }).includes('The plan has **1 phase** with **1 task** total.'));
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_map: { 'portal-1': 'p1' } } } } } });
    assert.throws(() => render({ variant: 'concluded' }), /"portal" has no authored tasks in task_map/);
  });

  it('a topic ending in digits never reads its phase keys as tasks', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { 'auth-2': {
      status: 'in-progress',
      task_map: { 'auth-2-1': 'p1', 'auth-2-1-1': 'a', 'auth-2-1-2': 'b', 'auth-2-2': 'p2', 'auth-2-2-1': 'c' },
    } } } } });
    assert.ok(renderSurface(dir, 'plan-progress', { dotpath: 'pay.planning.auth-2', variant: 'construction-complete' })
      .includes('The plan has **2 phases** with **3 tasks** total.'));
  });

  it('refuses an unknown variant and a non-planning address', () => {
    assert.throws(() => render({}), /--variant must be one of construction-complete, concluded, got "undefined"/);
    assert.throws(() => render({ variant: 'done' }), /--variant must be one of .*, got "done"/);
    assert.throws(() => renderSurface(dir, 'plan-progress', { dotpath: 'pay.discussion.portal', variant: 'concluded' }), /address must be <work_unit>\.planning\.<topic>/);
  });
});

describe('render findings-summary', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the worklist overview byte-exactly — glyphs, tags, notes', () => {
    const file = writePayload(dir, 's.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'add-to-task — Task 1-1 lacks the Outcome field.' },
        { title: 'Orphaned dependency', tag: 'Important', summary: 'update-task — Task 2-3 depends on a removed task.' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Integrity Review** — 2 findings',
      '',
      '○ 1. Missing Outcome field `[Minor]`',
      `${NB(7)}↳ add-to-task — Task 1-1 lacks the Outcome field.`,
      '○ 2. Orphaned dependency `[Important]`',
      `${NB(7)}↳ update-task — Task 2-3 depends on a removed task.`,
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('renders a resumed review — decided rows struck and note-shed, remaining counted', () => {
    const file = writePayload(dir, 'r.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'Task 1-1 lacks the Outcome field.', status: 'approved' },
        { title: 'Orphaned dependency', tag: 'Important', summary: 'Task 2-3 depends on a removed task.', status: 'skipped' },
        { title: 'Duplicated criteria', tag: 'Minor', summary: 'Two tasks share one criterion.', status: 'pending' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Integrity Review** — 3 findings · 1 remaining',
      '',
      '✓ 1. ~~Missing Outcome field~~ `[Minor]`',
      '⊘ 2. ~~Orphaned dependency~~ `[Important]`',
      '○ 3. Duplicated criteria `[Minor]`',
      `${NB(7)}↳ Two tasks share one criterion.`,
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { review_label: 'X', items: [] }) }), /"items" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { review_label: 'X', items: [{ title: 't', tag: 'g' }] }) }), /item 1 is missing "summary"/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'c.json', { review_label: 'X', items: [{ title: 't', tag: 'g', summary: 's', status: 'Fixed' }] }) }), /render findings-summary: item 1 carries unknown status "Fixed"/);
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

describe('render project-skills / linters', () => {
  let dir;
  const imp = 'hooks.implementation.crash';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { implementation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (surface, variant, payload) => renderSurface(dir, surface, {
    dotpath: imp, variant, file: payload && writePayload(dir, `${surface}-${variant}.json`, payload),
  });

  it('project skills: a stored set confirms compact, a fresh scan is chosen from the full list', () => {
    const c = render('project-skills', 'confirm', { skills: ['laravel-conventions', 'laravel-testing'] });
    assert.ok(c.includes('**Project skills** — 2 from the project default'));
    assert.ok(c.includes('laravel-conventions, laravel-testing'));
    assert.ok(!c.includes('1\\.'), 'a confirm is a comma run, not a numbered worklist');
    assert.ok(c.includes('**`◆ Use these project skills?`**'));
    const d = render('project-skills', 'discovery', { skills: [{ name: 'a', detail: 'x' }, { name: 'b', detail: 'y' }] });
    assert.ok(d.includes('**Project skills** — 2 skills'));
    assert.ok(d.includes('1\\. a — x'));
    assert.ok(d.includes('**`◆ Which project skills should be used?`**'));
    assert.ok(unwrap(d).includes('**List the ones you want** → Name them — e.g. "golang-pro, react-patterns"'));
  });

  it('linters: a discovery carries installed state as the row tag and its recommendations beneath', () => {
    const out = render('linters', 'discovery', {
      linters: [{ name: 'pint', detail: 'vendor/bin/pint', installed: true }, { name: 'phpstan', detail: 'vendor/bin/phpstan', installed: false }],
      recommendations: 'phpstan is not installed — `composer require --dev phpstan/phpstan`.',
    });
    assert.ok(out.includes('**Linter discovery** — 2 linters'));
    assert.ok(out.includes('1\\. pint — vendor/bin/pint `[installed]`'));
    assert.ok(out.includes('2\\. phpstan — vendor/bin/phpstan `[missing]`'));
    assert.ok(out.includes('**Recommended**: phpstan is not installed'));
    assert.ok(out.includes('**`◆ Approve these linters?`**'));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip linter setup \(no linting during TDD\)/.test(out));
  });

  it('linters: a stored set confirms compact with no installed state and no recommendations', () => {
    const out = render('linters', 'confirm', { linters: ['pint', 'phpstan'] });
    assert.ok(out.includes('**Linters** — 2 from the project default'));
    assert.ok(out.includes('pint, phpstan'));
    assert.ok(!out.includes('`[installed]`'), 'an approved set was already checked');
    assert.ok(out.includes('**`◆ Use these linters?`**'));
    assert.throws(
      () => render('linters', 'discovery', { linters: [{ name: 'pint', detail: 'vendor/bin/pint' }] }),
      /every row of a discovery needs "installed"/,
    );
  });

  it('the skipped variants ask again without a payload', () => {
    const s = render('project-skills', 'skipped');
    assert.ok(s.includes('Previous implementations used no project skills.'));
    assert.ok(s.includes('**`◆ Skip project skills again?`**'));
    assert.ok(/\*\*`n\/no`\*\* +→ Analyse for project skills/.test(s));
    const l = render('linters', 'skipped');
    assert.ok(l.includes('Previous implementations skipped linters.'));
    assert.ok(l.includes('**`◆ Skip linters again?`**'));
    assert.ok(/\*\*`n\/no`\*\* +→ Run full linter discovery/.test(l));
  });

  it('validates the variant, the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'linters', { dotpath: imp }), /--variant must be one of confirm\/discovery\/skipped/);
    assert.throws(() => renderSurface(dir, 'linters', { dotpath: imp, variant: 'confirm' }), /--file <payload\.json> is required/);
    assert.throws(() => render('linters', 'confirm', { linters: [] }), /"linters" must be a non-empty array/);
    assert.throws(() => render('project-skills', 'confirm', { skills: [{ name: 'a', detail: 'b' }] }), /skills\[0\] must be a non-empty string/);
    assert.throws(() => render('project-skills', 'discovery', { skills: [{ name: 'a' }] }), /skills\[0\] is missing "detail"/);
    assert.throws(() => render('project-skills', 'discovery', { skills: [{ detail: 'a' }] }), /skills\[0\] is missing "name"/);
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { planning: { items: { crash: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'project-skills', { dotpath: 'hooks.planning.crash', variant: 'skipped' }),
      /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/,
    );
  });
});

describe('render finding', () => {
  let dir;
  const base = {
    n: 1, total: 2, title: 'Missing Outcome field',
    meta: [['Severity', 'Minor'], ['Change Type', 'add-to-task']],
    problem: 'A task with no Outcome leaves the builder guessing what done looks like.',
  };
  const settled = { ...base, move: 'settled', proposal: 'The template fixes this — I would add the Outcome line the other tasks carry.' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('leads with the problem and the call, renders the diff in place, and gates on a question', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      diff: { context_above: ['**Solution**: shared adapter.'], current: [], proposed: ['**Outcome**: lands at a live shell.'], context_below: ['**Do**:'] },
      apply_label: 'Apply to the plan verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.startsWith([
      '=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ===',
      '**Finding 1 of 2: Missing Outcome field**',
      '',
      '- **Severity**: Minor',
      '- **Change Type**: add-to-task',
      '',
      'A task with no Outcome leaves the builder guessing what done looks like.',
      '',
      'The template fixes this — I would add the Outcome line the other tasks carry.',
      '',
    ].join('\n')));
    assert.ok(out.includes('=== DISPLAY: diff (emit verbatim as a diff code block (```diff fence)) ===\n **Solution**: shared adapter.\n+**Outcome**: lands at a live shell.\n **Do**:'));
    assert.ok(!/frame|╭|╰/.test(out), 'drawn borders never frame content — no drawn borders, no frame sections');
    assert.ok(out.includes('=== MENU: finding gate'));
    assert.ok(/\*\*`◆ Apply this\?`\*\*/.test(out), 'the menu opens with a question, never a second copy of the heading');
    assert.strictEqual(out.match(/\*\*Finding 1 of 2: Missing Outcome field\*\*/g).length, 1, 'the heading renders exactly once');
    assert.ok(/\*\*`y\/yes`\*\* +→ Apply to the plan verbatim/.test(out));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining settled findings automatically/.test(unwrap(out)));
    assert.ok(/\*\*Discuss\*\* +→ Challenge it, adjust it, or decline it/.test(unwrap(out)));
  });

  it('never offers skip — a found problem is settled, chosen, or routed, never waved past', () => {
    const file = writePayload(dir, 'f.json', { ...settled, content: { label: 'Proposed Addition', lines: ['New spec section body.'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!/skip/i.test(out), 'no skip option at any gate');
  });

  it('holds whole proposed content behind v/view instead of dumping it as source', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', '> Retries are bounded at four attempts.'] },
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!out.includes('DISPLAY: finding content'), 'the proposed section is not rendered at the gate');
    assert.ok(!out.includes('## Delivery'), 'artifact source never reaches the presentation');
    assert.ok(/\*\*`v\/view`\*\* +→ Show the exact wording/.test(out), 'the wording is reachable, not imposed');
    assert.ok(!out.includes('view full'), 'view full is gone — there is no full copy to re-show');
  });

  it('--view full answers the v/view row: the wording and the gate again, the report not repeated', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', 'Retries are bounded at four attempts.'] },
      apply_label: 'Apply to the specification verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file, view: 'full' });
    assert.ok(out.startsWith('=== DISPLAY: finding wording (emit verbatim as markdown (not a code block)) ===\n**Proposed Addition**\n\n## Delivery'));
    assert.ok(!out.includes('DISPLAY: finding ('), 'the report is not re-rendered — one finding never fills a screen twice');
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!/`v\/view`/.test(out), 'the view row is spent');
    assert.ok(/\*\*`y\/yes`\*\* +→ Apply to the specification verbatim/.test(out));
    assert.ok(/\*\*Discuss\*\*/.test(out), 'the view menu is the gate menu minus the view row');
  });

  it('--view full validates the wording it shows — malformed content refuses in the surface vocabulary', () => {
    const noLabel = writePayload(dir, 'v1.json', { ...settled, content: { lines: ['x'] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: noLabel, view: 'full' }),
      /"content.label" must be a non-empty string/);
    const noLines = writePayload(dir, 'v2.json', { ...settled, content: { label: 'L' } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: noLines, view: 'full' }),
      /"content.lines" must be an array of strings/);
    const emptyLines = writePayload(dir, 'v3.json', { ...settled, content: { label: 'L', lines: [] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: emptyLines, view: 'full' }),
      /"content.lines" must be non-empty/);
  });

  it('--view full over an auto address offers no a/auto row — the mode is already set', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'va.json', { ...settled, content: { label: 'L', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file, view: 'full' });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!/`a\/auto`/.test(out));
  });

  it('--view full is refused where there is no wording to show, and on a choice', () => {
    const diffFile = writePayload(dir, 'd.json', { ...settled, diff: { current: [], proposed: ['x'] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: diffFile, view: 'full' }),
      /--view needs "content" — a diff finding shows its change in place/);
    const choiceFile = writePayload(dir, 'c.json', { ...base, move: 'choice', options: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: choiceFile, view: 'full' }),
      /--view serves a settled finding's wording; a choice proposes none/);
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: diffFile, view: 'part' }),
      /--view only accepts "full"/);
  });

  it('a diff finding offers no view — the change is already visible in place', () => {
    const file = writePayload(dir, 'f.json', { ...settled, diff: { current: ['old'], proposed: ['new'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!/`v\/view`/.test(out));
  });

  it('wide diff lines pass through untouched — no border, no wrap', () => {
    const long = 'x'.repeat(150);
    const file = writePayload(dir, 'f.json', { ...settled, diff: { current: [], proposed: [long] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes(`\n+${long}\n`), 'the fence re-flows in the host; the engine never wraps diff lines');
  });

  it('a settled finding rides auto: the report renders, the gate does not', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['New plan section body.'] },
      applied_label: 'approved. Added to the plan.',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ==='), 'auto drops the stop, never the showing');
    assert.ok(out.includes('=== DISPLAY: finding auto-approved (emit verbatim as a text code block (```text fence) after applying the fix — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nFinding 1 of 2: Missing Outcome field — approved. Added to the plan.'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('a settled finding at the specification is display-only — its batch screen is the gate', () => {
    for (const mode of ['gated', 'auto']) {
      writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: mode } } } } });
      const file = writePayload(dir, `sb-${mode}.json`, {
        ...settled,
        diff: { current: ['old'], proposed: ['new'] },
      });
      const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
      assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ==='), `${mode}: the expansion still shows the report`);
      assert.ok(out.includes('=== DISPLAY: diff ('), `${mode}: the diff rides along — the expansion is problem, call, and change`);
      assert.ok(!out.includes('DISPLAY: finding wording'), `${mode}: a diff finding has no wording to show`);
      assert.ok(!out.includes('MENU: finding'), `${mode}: the batch already asked`);
      assert.ok(!out.includes('finding auto-approved'), `${mode}: the batch already said what landed`);
    }
  });

  it('a settled finding at the specification shows its whole wording — the expansion is the ask', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'sw.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', 'Retries are bounded at four attempts.'] },
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ==='), 'the report leads');
    assert.ok(out.endsWith('=== DISPLAY: finding wording (emit verbatim as markdown (not a code block)) ===\n**Proposed Addition**\n\n## Delivery\n\nRetries are bounded at four attempts.\n'),
      `the wording closes the expansion: ${out}`);
    assert.ok(!out.includes('MENU: finding'), 'the batch screen is the gate — the expansion asks nothing');
    assert.ok(!/`v\/view`/.test(out), 'there is no row left to ask the wording with');
  });

  it('--view full at the specification returns the wording alone', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'sv.json', { ...settled, content: { label: 'Proposed Addition', lines: ['Retries are bounded at four attempts.'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file, view: 'full' });
    assert.strictEqual(out, '=== DISPLAY: finding wording (emit verbatim as markdown (not a code block)) ===\n**Proposed Addition**\n\nRetries are bounded at four attempts.\n');
  });

  it('a choice stops over auto, numbers its options recommended-first, and offers no a/auto row', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...base,
      move: 'choice',
      options: [{ summary: 'Hold the queue slot and keep retrying' }, { summary: 'Bound retries at four, then dead-letter', recommended: true }],
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== MENU: finding choice'), 'auto never decides what only the user can');
    assert.ok(!out.includes('finding auto-approved'));
    assert.ok(unwrap(out).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'a stop over auto announces itself in the engine\'s one voice');
    assert.ok(/\*\*`◆ Which way\?`\*\*/.test(out));
    assert.ok(/\*\*`1`\*\* +→ Bound retries at four, then dead-letter \(recommended\)/.test(out), 'the recommendation sorts first');
    assert.ok(/\*\*`2`\*\* +→ Hold the queue slot and keep retrying/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what you're thinking/.test(out));
    assert.ok(!/`a\/auto`/.test(out), 'a choice never offers the auto opt-in');
    assert.ok(!/skip/i.test(out));
  });

  it('a gated choice carries no auto-override line — there is nothing being overridden', () => {
    const file = writePayload(dir, 'cg.json', {
      ...base,
      move: 'choice',
      options: [{ summary: 'a' }, { summary: 'b', recommended: true }],
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding choice'));
    assert.ok(!out.includes('Auto is on'));
  });

  it('contradiction is a legal category token — cosmetic, deciding nothing', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'ct.json', { ...settled, category: 'contradiction' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('finding auto-approved'), 'the move rides auto whatever the category reads');
  });

  it('the category no longer picks the shape — a gap rides auto when the record settles it', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', { ...settled, category: 'gap' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('finding auto-approved'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('validates loudly: move, shape, exclusivity, and empty diff', () => {
    const cases = [
      [{ ...settled, n: 0 }, /"n" must be a positive integer/],
      [{ ...settled, total: 0 }, /"total" must be an integer/],
      [{ ...settled, meta: [['x']] }, /"meta" must be an array of \[label, value\] pairs/],
      [{ ...settled, problem: ' ' }, /"problem" must be a non-empty string/],
      [{ ...base, move: 'route' }, /a "route" finding goes to resolve-source-incoherence and never renders at the gate/],
      [{ ...base }, /"move" must be one of settled\/choice/],
      [{ ...base, move: 'apply' }, /"move" must be one of settled\/choice/],
      [{ ...base, move: 'decide' }, /"move" must be one of settled\/choice/],
      [{ ...settled, category: 'source-defect' }, /"source-defect" findings route via resolve-source-incoherence and never render at the gate/],
      [{ ...settled, category: 'unsourced-decision' }, /"unsourced-decision" findings route via resolve-source-incoherence/],
      [{ ...settled, category: 'severity' }, /unknown category "severity"/],
      [{ ...base, move: 'settled' }, /a "settled" finding must carry a "proposal"/],
      [{ ...settled, options: [{ summary: 'a' }, { summary: 'b' }] }, /a "settled" finding carries no "options"/],
      [{ ...settled, diff: { current: [], proposed: ['x'] }, content: { label: 'X', lines: ['y'] } }, /pass "diff" or "content", not both/],
      [{ ...settled, diff: { current: [], proposed: [] } }, /"diff" must carry at least one/],
      [{ ...settled, content: { label: 'X', lines: [] } }, /"content.lines" must be non-empty/],
      [{ ...settled, content: { lines: ['x'] } }, /"content.label" must be a non-empty string/],
      [{ ...settled, content: { label: 'X', lines: 'not an array' } }, /"content.lines" must be an array of strings/],
      [{ ...base, move: 'choice', options: [{ summary: 'only one' }] }, /a "choice" finding must carry at least 2 "options"/],
      [{ ...base, move: 'choice', options: [{ summary: 'a' }, { notASummary: true }] }, /options\[1\]\.summary must be a non-empty string/],
      [{ ...base, move: 'choice', options: [{ summary: 'a' }, { summary: 'b\nfake row' }] }, /a side is one menu row — sides\[1\]\.summary must be a single line/],
      [{ ...base, move: 'choice', options: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] }, /at most one option may be recommended/],
      [{ ...base, move: 'choice', proposal: 'already decided', options: [{ summary: 'a' }, { summary: 'b' }] }, /a "choice" finding carries no "proposal"/],
      [{ ...base, move: 'choice', content: { label: 'X', lines: ['y'] }, options: [{ summary: 'a' }, { summary: 'b' }] }, /a "choice" finding carries no "content"/],
    ];
    cases.forEach(([payload, re], i) => {
      const file = writePayload(dir, `bad-${i}.json`, payload);
      assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file }), re);
    });
  });
});

describe('render proposed-task', () => {
  let dir;
  const payload = {
    current: 2, total: 3, title: 'Fix adapter leak', severity: 'Important',
    sources: 'reviewer cycle 1',
    problem: 'The adapter never closes.', solution: 'Close on detach.', outcome: 'No leaked handles.',
    steps: ['1. Add Close()', '2. Call it on detach'],
    criteria: ['- no leaked handles after detach'],
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the task detail plus the approval menu when gated, byte-exactly', () => {
    const file = writePayload(dir, 'p.json', payload);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Fix adapter leak (2 of 3)`** (Important)',
      'Sources: reviewer cycle 1',
      '',
      '**Problem**: The adapter never closes.',
      '',
      '**Solution**: Close on detach.',
      '',
      '**Outcome**: No leaked handles.',
      '',
      '**Acceptance Criteria**:',
      '- no leaked handles after detach',
      '',
      '**Do**:',
      '1. Add Close()',
      '2. Call it on detach',
      '',
      '=== MENU: task approval (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**     → Approve this task',
      '**`a/auto`**    → Approve this and all remaining tasks automatically',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
    assert.ok(!out.includes('t/technical'), 'the technical arm belongs to the decision menu alone');
  });

  it('honours a custom comment hint and the auto gate', () => {
    const file = writePayload(dir, 'p.json', payload);
    const gated = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(gated));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('=== DISPLAY: task auto-approved (emit verbatim as a text code block (```text fence) after recording the approval — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nTask 2 of 3: Fix adapter leak — approved [auto].'));
    assert.ok(!auto.includes('MENU: task approval'));
  });

  it('requires --gate and validates the payload loudly', () => {
    const file = writePayload(dir, 'p.json', payload);
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file }), /--gate must be "gated" or "auto"/);
    const noCriteria = writePayload(dir, 'bad.json', { ...payload, criteria: [] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noCriteria, gate: 'gated' }), /"criteria" must be non-empty/);
    const noProblem = writePayload(dir, 'bad2.json', { ...payload, problem: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }), /"problem" must be a non-empty string/);
    const emptySeverity = writePayload(dir, 'bad3.json', { ...payload, severity: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptySeverity, gate: 'gated' }), /"severity" must be a non-empty string when present/);
  });

  // Proposal altitude — the judge's output, before any authoring: problem and
  // solution alone, both blocks and outcome absent.
  const proposal = {
    current: 1, total: 4, title: 'Merge the near-miss helpers', severity: 'near-miss',
    placement: 'phase 3',
    problem: 'Two helpers differ only in their error text.',
    solution: 'Fold them into one and take the caller-supplied message.',
  };

  it('renders a proposal — no blocks, no outcome, the approval menu unchanged, byte-exactly', () => {
    const file = writePayload(dir, 'pr.json', proposal);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Merge the near-miss helpers (1 of 4)`** (near-miss)',
      'Placement: phase 3',
      '',
      '**Problem**: Two helpers differ only in their error text.',
      '',
      '**Solution**: Fold them into one and take the caller-supplied message.',
      '',
      '=== MENU: task approval (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**     → Approve this task',
      '**`a/auto`**    → Approve this and all remaining tasks automatically',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
  });

  it('mixes present and absent blocks — each renders under its own heading, none leaves a hole', () => {
    const file = writePayload(dir, 'mx.json', {
      current: 2, total: 4, title: 'Drop the dead formatter', severity: 'dead-code',
      problem: 'Nothing calls it.', solution: 'Delete it.', outcome: 'One fewer surface to keep true.',
      criteria: ['- the suite stays green'],
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.startsWith([
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Drop the dead formatter (2 of 4)`** (dead-code)',
      '',
      '**Problem**: Nothing calls it.',
      '',
      '**Solution**: Delete it.',
      '',
      '**Outcome**: One fewer surface to keep true.',
      '',
      '**Acceptance Criteria**:',
      '- the suite stays green',
      '',
      '=== MENU: task approval',
    ].join('\n')), out);
    assert.ok(!out.includes('**Do**:'), 'an absent block leaves no heading behind');
    assert.ok(!/\n\n\n/.test(out), 'an omitted block leaves no doubled blank line');
    const withTests = writePayload(dir, 'mt.json', {
      current: 2, total: 4, title: 'Drop the dead formatter', severity: 'dead-code',
      problem: 'Nothing calls it.', solution: 'Delete it.', criteria: ['- the suite stays green'], tests: ['- it is gone'],
    });
    const rendered = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withTests, gate: 'gated' });
    assert.ok(!rendered.includes('**Tests**') && !rendered.includes('it is gone'), 'a tests key is no block the surface renders');
  });

  it('outcome is optional both ways, and the detail blocks stay non-empty when present', () => {
    const withOutcome = writePayload(dir, 'o1.json', { ...proposal, outcome: 'One helper, one message path.' });
    assert.ok(renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' })
      .includes('**Solution**: Fold them into one and take the caller-supplied message.\n\n**Outcome**: One helper, one message path.\n'));
    const without = writePayload(dir, 'o2.json', proposal);
    assert.ok(!renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: without, gate: 'gated' }).includes('**Outcome**'));
    const emptyOutcome = writePayload(dir, 'o3.json', { ...proposal, outcome: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptyOutcome, gate: 'gated' }), /"outcome" must be a non-empty string when present/);
    for (const field of ['steps', 'criteria']) {
      const empty = writePayload(dir, `e-${field}.json`, { ...proposal, [field]: [] });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }), new RegExp(`"${field}" must be non-empty`));
      const notLines = writePayload(dir, `n-${field}.json`, { ...proposal, [field]: 'one long string' });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notLines, gate: 'gated' }), new RegExp(`"${field}" must be an array of strings`));
    }
  });

  it('a decision emits its slim header and the sides as the menu — the record stays staged — byte-exactly', () => {
    const file = writePayload(dir, 'dc.json', {
      current: 3, total: 4, title: 'Settle the page size', severity: 'behaviour',
      sources: 'finder cycle 1', placement: 'phase 1',
      problem: 'Two page sizes are configured at once.', solution: 'Pick one and record it.',
      stakes: 'A4 fixes print output; preferCssPageSize hands it to themes. No measurement picks between them.',
      decision: { question: 'Which page size stands?', options: ['A4 on the PDF renderer', 'preferCssPageSize from the stylesheet'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Settle the page size (3 of 4)`** (behaviour)',
      'Sources: finder cycle 1',
      'Placement: phase 1',
      '',
      '=== MENU: task decision (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Decision**: Which page size stands?',
      '',
      '**`◆ Which way?`**',
      '',
      '**`1`**           → A4 on the PDF renderer',
      '**`2`**           → preferCssPageSize from the stylesheet',
      "**`t/technical`** → Retell the fork from the code's perspective",
      '**`d/decline`**   → Decline this task — it will not be built',
      '**Comment**     → Tell me what to change',
      '',
    ].join('\n'));
    const display = out.slice(0, out.indexOf('=== MENU'));
    for (const line of ['**Problem**', '**Solution**', '**Stakes**', '**Decision**']) {
      assert.ok(!display.includes(line), `the slim header carries no ${line} line — the record stays in the staging file`);
    }
    assert.ok(out.includes('**Decision**: Which page size stands?'), 'the menu carries the question as its statement label');
    assert.ok(!out.includes('a/auto'), 'an open decision is never one of the calls auto makes');
    assert.ok(!out.includes('Auto is on'), 'a gated decision carries no auto-override line — there is nothing being overridden');
  });

  it('a recommended side orders first with its suffix; plain strings mix in unchanged', () => {
    const file = writePayload(dir, 'dr.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's',
      stakes: 'Each side changes what ships; nothing measurable breaks the tie.',
      decision: { question: 'Which page size stands?', options: [
        'A4 on the PDF renderer',
        { summary: 'preferCssPageSize from the stylesheet', recommended: true },
        { summary: 'Neither — leave it configurable' },
      ] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.includes([
      '**`1`**           → preferCssPageSize from the stylesheet (recommended)',
      '**`2`**           → A4 on the PDF renderer',
      '**`3`**           → Neither — leave it configurable',
      "**`t/technical`** → Retell the fork from the code's perspective",
      '**`d/decline`**   → Decline this task — it will not be built',
    ].join('\n')), out);
  });

  it('a decision requires its stakes — absent, empty, or orphaned stakes refuse by name', () => {
    const decision = { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize'] };
    const missing = writePayload(dir, 'st1.json', { ...proposal, decision });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: missing, gate: 'gated' }),
      /"stakes" must be a non-empty string when "decision" is present/);
    const empty = writePayload(dir, 'st2.json', { ...proposal, decision, stakes: '  ' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }),
      /"stakes" must be a non-empty string when "decision" is present/);
    const orphan = writePayload(dir, 'st3.json', { ...proposal, stakes: 'each side matters' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: orphan, gate: 'gated' }),
      /"stakes" requires "decision"/);
  });

  it('a decision stops under --gate auto — and takes the comment hint', () => {
    const file = writePayload(dir, 'dc2.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's', stakes: 'the fork is product-shaped',
      decision: { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize', 'Neither — leave it configurable'] },
    });
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(auto.includes('MENU: task decision'), 'a decision item always stops');
    assert.ok(!auto.includes('DISPLAY: task auto-approved'));
    assert.ok(!auto.includes('MENU: task approval'));
    assert.ok(auto.includes('**Decision**: Which page size stands?\n\n**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'the question is the menu\'s statement label, the auto-override line beneath it — never the glyphed chrome');
    assert.ok(/\*\*`3`\*\* +→ Neither — leave it configurable/.test(auto));
    assert.ok(/\*\*`t\/technical`\*\* +→ Retell the fork from the code's perspective/.test(auto), 'the technical arm rides the decision menu');
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(auto));
  });

  it('a decision excludes authored blocks, and the malformed shapes are refused by name', () => {
    for (const [field, value] of [['steps', ['1. x']], ['criteria', ['- c']]]) {
      const file = writePayload(dir, `dx-${field}.json`, {
        ...proposal, [field]: value, stakes: 'the fork is product-shaped',
        decision: { question: 'Which way?', options: ['a', 'b'] },
      });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" excludes steps\/criteria/);
    }
    for (const [name, decision] of [['null', null], ['a bare string', 'yes']]) {
      const file = writePayload(dir, `dshape-${name.replace(/ /g, '-')}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" must be an object carrying "question" and "options"/, `decision as ${name} is refused`);
    }
    const withOutcome = writePayload(dir, 'dx-outcome.json', {
      ...proposal, outcome: 'One page size everywhere.', stakes: 'the fork is product-shaped',
      decision: { question: 'Which way?', options: ['a', 'b'] },
    });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' }),
      /"decision" excludes outcome/, 'a decision payload never carries a field the path would silently drop');
    const noProblem = writePayload(dir, 'dx-problem.json', {
      current: 1, total: 1, title: 'T', solution: 's', stakes: 'the fork is product-shaped',
      decision: { question: 'Which way?', options: ['a', 'b'] },
    });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }),
      /"problem" must be a non-empty string/, 'the payload mirrors its staging row — a decision with no record behind it is refused');
  });

  it('the question is head chrome — an option-shaped question never captures the arrow column', () => {
    const file = writePayload(dir, 'dq.json', {
      ...proposal, stakes: 'the fork is product-shaped',
      decision: { question: 'Ship **now** → later?', options: ['A4 on the PDF renderer', 'preferCssPageSize'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.includes('**Decision**: Ship **now** → later?'), 'the label passes through untouched');
    assert.ok(out.includes('**`1`**           → A4 on the PDF renderer'),
      'the arrow column is measured from the option rows alone — t/technical, at 11, stays the widest key');
  });

  it('a long end-state side wraps under its own row, the recommendation suffix riding the last segment', () => {
    const side = 'Unmatched captures land on an operator-visible record and a person resolves each one — nothing redelivers, nothing vanishes';
    const file = writePayload(dir, 'dw.json', {
      ...proposal, stakes: 'the fork is product-shaped',
      decision: { question: 'Where does an unmatched capture surface?', options: [{ summary: side, recommended: true }, 'Refused — the gateway redelivers'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    const lines = out.split('\n');
    const row = lines.findIndex((l) => l.startsWith('**`1`**'));
    assert.ok(row > 0, out);
    // NB(14) = the 11-wide t/technical key column + the three arrow columns.
    assert.ok(lines[row + 1].startsWith(NB(14)), 'continuations align under the label column in non-breaking spaces');
    const last = [lines[row], lines[row + 1], lines[row + 2] ?? ''].filter((l) => l.startsWith('**`1`**') || l.startsWith(NB(14))).pop();
    assert.ok(last && last.endsWith('(recommended)'), 'the suffix rides the wrapped row\'s last segment');
  });

  it('a malformed decision is refused by name', () => {
    const cases = [
      [{ options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: '  ', options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: 'Which?\nAnd how?', options: ['a', 'b'] }, /"decision\.question" must be a single line/],
      [{ question: 'Which?', options: ['a', 'b\nfake row'] }, /a side is one menu row — sides\[1\]\.summary must be a single line/],
      [{ question: 'Which?' }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['only one'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', 'b', 'c', 'd', 'e'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', ''] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', { summary: '  ' }] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', { recommended: true }] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', 7] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] }, /at most one option may be recommended/],
    ];
    cases.forEach(([decision, re], i) => {
      const file = writePayload(dir, `dbad-${i}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }), re);
    });
    const notObject = writePayload(dir, 'dbad-shape.json', { ...proposal, decision: ['a', 'b'] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notObject, gate: 'gated' }),
      /"decision" must be an object carrying "question" and "options"/);
  });

  it('incoherence-gate conflict: payload-driven display then the menu, recommended side first, byte-exact', () => {
    const file = writePayload(dir, 'ig.json', {
      doc: 'synonym-handling',
      lane: 'review',
      title: 'Expansion freshness rests on a stream that will not be built',
      context: 'The two decisions cannot both be implemented.',
      quotes: [
        { doc: 'behavioural-ranking', section: 'Signal Ingestion · Decision', quote: 'No live signal stream will be built.' },
        { doc: 'synonym-handling', section: 'Expansion Source · Decision', quote: 'Reading the live click-signal stream at query time.' },
      ],
      stakes: 'A spec extracting both sides describes a panel the record cannot produce.',
      sides: [
        { summary: 'Live click-signal stream at query time' },
        { summary: 'Batch-derived expansion, daily refresh', recommended: true },
      ],
    });
    const out = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'conflict' });
    assert.strictEqual(out, [
      '=== DISPLAY: incoherence conflict (emit verbatim as markdown (not a code block)) ===',
      '**Conflict — Expansion freshness rests on a stream that will not be built**',
      '',
      '- **behavioural-ranking · Signal Ingestion · Decision**: "No live signal stream will be built."',
      '- **synonym-handling · Expansion Source · Decision**: "Reading the live click-signal stream at query time."',
      '',
      '**Details**: The two decisions cannot both be implemented.',
      '',
      'A spec extracting both sides describes a panel the record cannot produce.',
      '',
      "=== MENU: incoherence conflict (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which decision stands?`**',
      '',
      '**`1`**       → Batch-derived expansion, daily refresh (recommended)',
      '**`2`**       → Live click-signal stream at query time',
      "**Comment** → Tell me what you're thinking; we'll work it through",
      '',
    ].join('\n'));
  });

  it('incoherence-gate gap-route: the raise plus its acknowledgement gate, byte-exact; held-doc keeps its menu', () => {
    const file = writePayload(dir, 'ig2.json', {
      lane: 'review',
      doc: 'synonym-handling',
      title: 'Ranking interaction is undecided',
      context: 'Neither source decides how expanded matches rank.',
      quotes: [{ doc: 'behavioural-ranking', section: 'Scoring · Decision', quote: 'Score blending is out of scope.' }],
      stakes: 'The ranking chapter cannot be written until this is decided.',
    });
    const gap = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'gap-route' });
    assert.strictEqual(gap, [
      '=== DISPLAY: incoherence gap (emit verbatim as markdown (not a code block)) ===',
      '**Gap — Ranking interaction is undecided**',
      '',
      '- **behavioural-ranking · Scoring · Decision**: "Score blending is out of scope."',
      '',
      '**Details**: Neither source decides how expanded matches rank.',
      '',
      'The ranking chapter cannot be written until this is decided.',
      '',
      "=== MENU: incoherence gap (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'The gap needs the room. Reopening "synonym-handling" with it pauses this specification until the answer lands; the map offers two other homes.',
      '',
      '**`◆ Reopen it?`**',
      '',
      '**`y/yes`**     → Reopen "synonym-handling" with the gap and pause here',
      '**`t/topic`**   → Open a new topic on the map for it — this',
      `${NB(12)}specification waits for it to conclude`,
      "**`r/roadmap`** → Park it on the roadmap — outside this specification's",
      `${NB(12)}scope`,
      "**Comment**   → Tell me what you're thinking before it moves",
      '',
    ].join('\n'));
    const docOnly = writePayload(dir, 'ig2b.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: docOnly, variant: 'held-doc' });
    assert.ok(held.includes('MENU: incoherence held doc'));
    assert.ok(held.includes('**`◆ How do you want to continue?`**'));
    assert.ok(/\*\*`n\/next`\*\* +→ Send the resolution to its mailbox and carry on here/.test(unwrap(held)), held);
    assert.ok(/\*\*`s\/stop`\*\* +→ Stop here/.test(held));
    assert.ok(unwrap(held).includes('"synonym-handling" is open in another session, so the fix belongs there; this topic waits for it.'),
      `no holder found at render time — the gate names no age: ${held}`);
  });

  it('incoherence-gate gap-route: the map destinations are the epic\'s — a linear work unit keeps the reopen alone', () => {
    writeManifest(dir, 'solo', {
      work_type: 'feature',
      phases: { implementation: { items: { solo: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'ig3.json', { lane: 'review', doc: 'solo', title: 't', context: 'c' });
    const linear = unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'solo.implementation.solo', file, variant: 'gap-route' }));
    assert.ok(linear.includes('Routing this to "solo" — it reopens with the gap, and this specification pauses until the answer lands.'),
      'one home is a statement, not a fork');
    assert.ok(/\*\*`◆ Proceed\?`\*\*/.test(linear));
    assert.ok(/\*\*`y\/yes`\*\* +→ Land the gap and pause here/.test(linear));
    assert.ok(!linear.includes('`t/topic`'), 'a feature has no map to open a topic on');
    assert.ok(!linear.includes('`r/roadmap`'), 'the park is the map\'s neighbour, offered where the map is');
    const epic = unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'gap-route' }));
    assert.ok(epic.includes('The gap needs the room. Reopening "solo" with it pauses this specification until the answer lands; the map offers two other homes.'),
      'three homes make it a fork — and the reopen names its cost');
    assert.ok(/\*\*`◆ Reopen it\?`\*\*/.test(epic));
    assert.ok(epic.includes('**`y/yes`**     → Reopen "solo" with the gap and pause here'));
    assert.ok(epic.includes('**`t/topic`**   → Open a new topic on the map for it — this specification waits for it to conclude'));
    assert.ok(epic.includes('**`r/roadmap`** → Park it on the roadmap — outside this specification\'s scope'));
  });

  it('incoherence-gate held-doc names the holder\'s last-active age, however long idle', () => {
    const peer = path.join(dir, '.leeway', '.cache', 'pay', 'discussion', 'synonym-handling', 'presence');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');
    const idle = new Date(Date.now() - 3 * 3600 * 1000);
    fs.utimesSync(peer, idle, idle);
    const file = writePayload(dir, 'ig2c.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'held-doc' });
    assert.ok(unwrap(held).includes('"synonym-handling" is open in another session — last active 3h ago — so the fix belongs there; this topic waits for it.'), held);
  });

  it('the incoherence stops announce over their own lane\'s auto — and stay silent over the other lane\'s', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'auto', construction_gate_mode: 'gated',
    } } } } });
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const conflict = writePayload(dir, 'al1.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    const out = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: conflict, variant: 'conflict' });
    assert.ok(unwrap(out).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'));
    // The same stop called from the construction lane is not overriding anything.
    const conflictC = writePayload(dir, 'al2.json', { doc: 'x', lane: 'construction', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    const outC = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: conflictC, variant: 'conflict' });
    assert.ok(!outC.includes('Auto is on'), 'a construction-lane stop does not announce the findings walk\'s auto');
    const gap = writePayload(dir, 'al3.json', { doc: 'x', lane: 'review', title: 't', context: 'c' });
    assert.ok(unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: gap, variant: 'gap-route' })).includes('Auto is on — stopping anyway'));
    const held = writePayload(dir, 'al4.json', { doc: 'x', lane: 'review' });
    assert.ok(unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: held, variant: 'held-doc' })).includes('Auto is on — stopping anyway'));
  });

  it('resurface-gate announces over construction auto only — it is construction-lane machinery', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'auto', construction_gate_mode: 'gated',
    } } } } });
    const payload = { section: 'S', diff: { current: ['old'], proposed: ['new'] } };
    const quiet = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.specification.portal', file: writePayload(dir, 'rs1.json', payload) });
    assert.ok(!quiet.includes('Auto is on'), 'findings auto is not resurface-gate\'s lane');
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'gated', construction_gate_mode: 'auto',
    } } } } });
    const loud = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.specification.portal', file: writePayload(dir, 'rs2.json', payload) });
    assert.ok(unwrap(loud).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'));
  });

  it('a payload without a legal lane is refused by name', () => {
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const badLane = writePayload(dir, 'al5.json', { doc: 'x', lane: 'planning', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: badLane, variant: 'conflict' }),
      /"lane" must be "construction" or "review"/);
    const noLane = writePayload(dir, 'al6.json', { doc: 'x', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noLane, variant: 'conflict' }),
      /"lane" must be "construction" or "review"/);
  });

  it('a conflict must quote the documents it collides — composed sides are refused', () => {
    const noQuotes = writePayload(dir, 'igq.json', { doc: 'x', lane: 'review', title: 't', context: 'c', sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(
      () => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noQuotes, variant: 'conflict' }),
      /a conflict must quote the sides it collides — sides you would compose yourself are not documented, and belong in a conversation, not this gate/,
    );
    const empty = writePayload(dir, 'igq2.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: [], sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: empty, variant: 'conflict' }), /"quotes" must be a non-empty array when present/);
    // gap-route keeps quotes optional: a gap has no collision to cite.
    const gap = writePayload(dir, 'igq3.json', { doc: 'x', lane: 'review', title: 't', context: 'c' });
    assert.ok(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: gap, variant: 'gap-route' }).includes('MENU: incoherence gap'));
  });

  it('incoherence-gate validates loudly: variant, doc, sides floor, single recommended', () => {
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const file = writePayload(dir, 'ig3.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file }), /--variant must be/);
    const noDoc = writePayload(dir, 'ig4.json', { lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noDoc, variant: 'conflict' }), /"doc" must be a non-empty string/);
    const oneSide = writePayload(dir, 'ig5.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: oneSide, variant: 'conflict' }), /at least 2 entries/);
    const twoRec = writePayload(dir, 'ig6.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: twoRec, variant: 'conflict' }), /at most one side/);
    const nlSide = writePayload(dir, 'ig6b.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b\nfake row' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: nlSide, variant: 'conflict' }), /a side is one menu row — sides\[1\]\.summary must be a single line/);
    const noTitle = writePayload(dir, 'ig7.json', { doc: 'x', lane: 'review', context: 'c', sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noTitle, variant: 'gap-route' }), /"title" must be a non-empty string/);
    const badQuote = writePayload(dir, 'ig8.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: [{ doc: 'a', section: 's' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: badQuote, variant: 'gap-route' }), /quotes\[0\] must carry doc, section, and quote/);
  });

  it('resurface-gate: header, diff fence, and the always-gated menu; --view full swaps the body and drops the view option', () => {
    const file = writePayload(dir, 'rs.json', {
      section: 'Expansion Source',
      diff: { context_above: ['ctx above'], current: ['old line'], proposed: ['new line'], context_below: ['ctx below'] },
      full: ['Full updated section body'],
    });
    const out = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('=== DISPLAY: resurfacing (emit verbatim as markdown (not a code block)) ===\n**Resurfacing: Expansion Source**'));
    assert.ok(out.includes('=== DISPLAY: resurfacing diff (emit verbatim as a diff code block (```diff fence)) ===\n ctx above\n-old line\n+new line\n ctx below'));
    assert.ok(out.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`v\/view full`\*\* +→ Show the full updated section/.test(out));
    const full = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file, view: 'full' });
    assert.ok(full.includes('**Resurfacing: Expansion Source** — full updated section\n\nFull updated section body'));
    assert.ok(!full.includes('view full'), 'the full view drops the view option');
    const noDiff = writePayload(dir, 'rs2.json', { section: 'X' });
    assert.throws(() => renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file: noDiff }), /"diff" is required/);
    const emptyDiff = writePayload(dir, 'rs3.json', { section: 'X', diff: { current: [], proposed: [] } });
    assert.throws(() => renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file: emptyDiff }), /at least one current\/proposed line/);
  });

  it('construction-gate: reads the manifest gate mode — menu when gated, announcement when auto', () => {
    const gated = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' });
    assert.ok(gated.includes('MENU: construction gate'));
    assert.ok(gated.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining topics automatically/.test(unwrap(gated)));
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'pay', 'manifest.json'), 'utf8'));
    m.phases.implementation.items.portal.construction_gate_mode = 'auto';
    fs.writeFileSync(path.join(dir, '.leeway', 'pay', 'manifest.json'), JSON.stringify(m, null, 2));
    const auto = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' });
    assert.ok(auto.includes('DISPLAY: construction auto-approved'));
    assert.ok(auto.includes('Portal — auto-approved. Recording to the specification.'));
    assert.ok(!auto.includes('MENU:'));
  });

  it('renders the ad hoc shape: no severity/sources, placement lines present', () => {
    const adhoc = {
      current: 1, total: 1, title: 'Fix login redirect',
      problem: 'Redirect loops on expired session.', solution: 'Clear the cookie first.', outcome: 'Login lands on the dashboard.',
      placement: 'phase 2', priority: '1', depends_on: 'portal-2-3',
      steps: ['1. Clear cookie', '2. Redirect'],
      criteria: ['- no loop on expired session'],
    };
    const file = writePayload(dir, 'a.json', adhoc);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    const lines = out.split('\n');
    assert.strictEqual(lines[1], '**`▪ Fix login redirect`**');
    assert.strictEqual(lines[2], 'Placement: phase 2');
    assert.strictEqual(lines[3], 'Priority: 1');
    assert.strictEqual(lines[4], 'Depends on: portal-2-3');
    assert.strictEqual(lines[5], '');
    assert.ok(!out.includes('Sources:'));
    assert.ok(out.includes('MENU: task approval'));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('Fix login redirect — approved [auto].'));
    assert.ok(!auto.includes('Task 1 of 1'));
  });
});

describe('render tasks-overview', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders a fresh cycle byte-exactly — all rows pending, no remaining count', () => {
    const file = writePayload(dir, 'o.json', { label: 'Analysis cycle 2', tasks: [{ title: 'Fix leak', severity: 'Important' }, { title: 'Add test', severity: 'Minor' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Analysis cycle 2** — 2 proposed tasks',
      '',
      '○ 1. Fix leak `[Important]`',
      '○ 2. Add test `[Minor]`',
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('renders a mid-walk resume — decided rows struck, remaining counted', () => {
    const file = writePayload(dir, 'r.json', { label: 'Analysis cycle 1', tasks: [
      { title: 'Fix leak', severity: 'Important', status: 'approved' },
      { title: 'Add test', severity: 'Minor', status: 'skipped' },
      { title: 'Type the selector', severity: 'Minor', status: 'pending' },
    ] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Analysis cycle 1** — 3 proposed tasks · 1 remaining',
      '',
      '✓ 1. ~~Fix leak~~ `[Important]`',
      '⊘ 2. ~~Add test~~ `[Minor]`',
      '○ 3. Type the selector `[Minor]`',
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('escapes markdown-active title text', () => {
    const file = writePayload(dir, 'e.json', { label: 'Cycle', tasks: [{ title: 'Collapse *both* fakes', severity: 'low' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.match(out, /○ 1\. Collapse \\\*both\\\* fakes `\[low\]`/);
  });

  it('validates loudly', () => {
    const file = writePayload(dir, 'o.json', { label: 'X', tasks: [{ title: 't' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file }), /task 1 needs "title" and "severity"/);
    const bad = writePayload(dir, 'b.json', { label: 'X', tasks: [{ title: 't', severity: 's', status: 'done' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: bad }), /render tasks-overview: task 1 carries unknown status "done" \(expected pending\/approved\/skipped\)/);
    const empty = writePayload(dir, 'empty.json', { label: 'X', tasks: [] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: empty }), /"tasks" must be a non-empty array/, 'an empty overview refuses — the zero-proposal branches route around this surface');
  });
});

describe('render author-task-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the task\'s detail above the authoring menu byte-exactly', () => {
    const file = writePayload(dir, 'at.json', { content: '## portal-1-2\n\n### Task 2: Wrap command\n\n**Problem**: the argv runs bare.' });
    const out = renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '5', title: 'Wrap command', file });
    assert.strictEqual(out, [
      '=== DISPLAY: authored task (emit verbatim as markdown (not a code block)) ===',
      '## portal-1-2',
      '',
      '### Task 2: Wrap command',
      '',
      '**Problem**: the argv runs bare.',
      '',
      '=== MENU: author task gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Task 2 of 5: Wrap command**',
      '',
      '**`◆ Write it to the plan?`**',
      '',
      '**`y/yes`**                  → Write it to the plan',
      '**`a/auto`**                 → Approve this and all remaining tasks',
      `${NB(25)}automatically`,
      '**Tell me what to change** → what to revise in this task',
      '**Navigate**               → Tell me where to go: a different phase',
      `${NB(25)}or task, or the leading edge`,
      '',
    ].join('\n'));
  });

  it('validates the scalars and the payload loudly', () => {
    const file = writePayload(dir, 'at.json', { content: 'x' });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '0', total: '5', title: 'X', file }), /--m must be a positive integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '1', title: 'X', file }), /--total must be an integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', file }), /--title is required/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', title: 'X' }), /--file <payload\.json> is required — the task's detail/);
    const blank = writePayload(dir, 'blank.json', { content: '  ' });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', title: 'X', file: blank }), /"content" must be the task's full detail, a non-empty string/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.implementation.portal', m: '1', total: '2', title: 'X', file }), /address must be <work_unit>\.planning\.<topic>/);
  });

  it('--phase is the gate-mode check: the auto line counts the phase\'s rows, gated answers empty', () => {
    const rows = { 'portal-1-1': 'pending', 'portal-1-2': 'approved', 'portal-1-3': 'rejected' };
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', author_gate_mode: 'auto', staging: { 'author-p1': { tasks: rows } } } } } } });
    assert.strictEqual(renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), [
      '=== DISPLAY: author tasks auto-approved (emit verbatim as a text code block (```text fence) after recording the approvals — the user set this gate to auto: do not stop; continue as the workflow instructs) ===',
      'Phase 1: 3 tasks authored. Auto-approved. Writing to plan.',
      '',
    ].join('\n'));

    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', author_gate_mode: 'gated', staging: { 'author-p1': { tasks: rows } } } } } } });
    assert.strictEqual(renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), '');
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', staging: { 'author-p1': { tasks: rows } } } } } } });
    assert.strictEqual(renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), '', 'no recorded mode reads gated');
  });

  it('--phase refuses a phase with no authoring rows, a bad number, and the task flags beside it', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', author_gate_mode: 'auto' } } } } });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), /phase 1 has no authoring rows — register them before the check/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: 'one' }), /--phase must be a positive integer/);
    const file = writePayload(dir, 'at.json', { content: 'x' });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1', file }), /--phase is the phase's gate-mode check — it takes no task flags/);
  });
});

describe('render phase-tree', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders numbered phase nodes with wrapped tree detail, byte-exactly', () => {
    const file = writePayload(dir, 'ph.json', {
      phases: [
        { name: 'Adapter Wrapper', detail: [['Goal', 'burst windows land at a live shell'], ['Criteria', 'no dead-end prompt']] },
        { name: 'Regression Net', detail: [['Goal', 'attach flows pinned by tests']] },
      ],
    });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: phase tree (emit verbatim as a text code block (```text fence)) ===',
      'Phase structure — 2 phases.',
      '',
      '1. Adapter Wrapper',
      '   ├─ Goal: burst windows land at a live shell',
      '   └─ Criteria: no dead-end prompt',
      '',
      '2. Regression Net',
      '   └─ Goal: attach flows pinned by tests',
      '',
    ].join('\n'));
  });

  it('appends the structure gate with --approve; long detail wraps with the gutter', () => {
    const file = writePayload(dir, 'ph.json', {
      phases: [{ name: 'X', detail: [['Goal', 'goal '.repeat(30).trim()], ['Criteria', 'done']] }],
    });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    assert.ok(out.includes('MENU: phase structure gate'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed to task breakdown/.test(out));
    const lines = out.split('\n');
    const goalIdx = lines.findIndex((l) => l.startsWith('   ├─ Goal:'));
    assert.ok(lines[goalIdx + 1].startsWith('   │  goal'), 'wrapped detail carries the gutter');
  });

  it('--menu-only is the structure gate alone — byte-identical to the one --approve appends, no payload read', () => {
    const file = writePayload(dir, 'ph.json', { phases: [{ name: 'X', detail: [['Goal', 'g']] }] });
    const approve = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    const gate = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', 'menu-only': '1' });
    assert.ok(gate.startsWith('=== MENU: phase structure gate'), gate);
    assert.strictEqual(approve.slice(approve.indexOf('=== MENU: phase structure gate')), gate);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning', 'menu-only': '1' }), /address must be <work_unit>\.<phase>\.<topic>/);
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { phases: [] }) }), /"phases" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { phases: [{ name: 'X', detail: [] }] }) }), /"detail" must be a non-empty array/);
  });
});

describe('render task-list --variant existing', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('gated menu drops the auto option; auto mode says confirmed', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 'b' }] });
    const gated = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(/\*\*Tell me what to change\*\* +→ which tasks to revise in this phase/.test(gated));
    assert.ok(!gated.includes('`a/auto`'), 'existing variant offers no auto opt-in');

    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const auto = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(auto.includes('Phase 1: X — task list confirmed. Proceeding to authoring.'));
  });
});

describe('pipeline continuation surfaces', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    // A feature with everything before review completed — the
    // implementation → review hop, every way forward on offer.
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'completed' } } },
        specification: { items: { pay: { status: 'completed' } } },
        planning: { items: { pay: { status: 'completed' } } },
        implementation: { items: { pay: { status: 'completed' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('next-phase-gate: the review hop offers proceed, complete without review, and revisit — byte-stable', () => {
    assert.strictEqual(renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'review' }), [
      "=== MENU: next phase gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Implementation completed for "Pay".',
      '',
      '**`◆ Proceed to review?`**',
      '',
      '**`y/yes`**     → Proceed to review',
      '**`d/done`**    → Complete without review',
      '**`r/revisit`** → Revisit an earlier phase',
      '',
    ].join('\n'));
  });

  it('next-phase-gate: a non-review hop carries no d/done — proceed or revisit', () => {
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'specification', next: 'planning' });
    assert.ok(out.includes('Specification completed for "Pay".'), out);
    assert.match(out, /`◆ Proceed to planning\?`/);
    assert.match(out, /\*\*`y\/yes`\*\* +→ Proceed to planning/);
    assert.match(out, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!out.includes('d/done'), 'skip-review belongs to the review hop alone');
  });

  it('next-phase-gate: no r/revisit while no earlier phase is completed — the review hop still offers d/done', () => {
    writeManifest(dir, 'fresh', {
      work_type: 'feature',
      phases: { implementation: { items: { fresh: { status: 'in-progress' } } } },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'fresh', prev: 'implementation', next: 'review' });
    assert.match(out, /\*\*`y\/yes`\*\*  → Proceed to review/);
    assert.match(out, /\*\*`d\/done`\*\* → Complete without review/);
    assert.ok(!out.includes('r/revisit'), out);
  });

  it('next-phase-gate: empty when continuing is the only way forward — nothing to skip, nothing to revisit', () => {
    writeManifest(dir, 'lab', {
      work_type: 'feature',
      phases: { discussion: { items: { lab: { status: 'in-progress' } } } },
    });
    assert.strictEqual(renderSurface(dir, 'next-phase-gate', { dotpath: 'lab', prev: 'experiment', next: 'discussion' }), '');
  });

  it('next-phase-gate: the review hop names a live reconcile flag — skipping review is an informed choice', () => {
    writeManifest(dir, 'moved', {
      work_type: 'feature',
      phases: {
        specification: { items: { moved: { status: 'completed' } } },
        implementation: { items: { moved: { status: 'completed' } } },
        review: { items: { moved: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved', prev: 'implementation', next: 'review' });
    assert.ok(out.includes('Implementation completed for "Moved". ⚑ Input moved beneath review/moved (implementation) — completing without review carries the pending reconcile unresolved.'), out);
    // The cue informs the skip — a hop with no d/done carries none, flag or not.
    const planning = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved', prev: 'specification', next: 'planning' });
    assert.ok(planning.includes('Specification completed for "Moved".') && !planning.includes('⚑'), planning);
    // No flag, no cue.
    assert.ok(!renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'review' }).includes('⚑'));
  });

  it('a derived phase says the session is complete, never the phase — sibling records may still live', () => {
    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'experiment' });
    assert.ok(note.includes('Experiment session complete for "Pay".'), note);
    assert.ok(!note.includes('Experiment completed'), 'never claims the phase completed');

    writeManifest(dir, 'lab', {
      work_type: 'feature',
      phases: { research: { items: { lab: { status: 'completed' } } } },
    });
    const gate = renderSurface(dir, 'next-phase-gate', { dotpath: 'lab', prev: 'experiment', next: 'discussion' });
    assert.ok(gate.includes('Experiment session complete for "Lab".'), gate);
    assert.match(gate, /\*\*`y\/yes`\*\* +→ Proceed to discussion/);
  });

  it('epic-all-done-gate and phase-completed carry their statements', () => {
    const allDone = renderSurface(dir, 'epic-all-done-gate', { dotpath: 'pay' });
    assert.ok(allDone.includes('All topics have completed review for "Pay".'));

    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'discussion' });
    assert.ok(note.includes('Discussion completed for "Pay".'));
  });

  it('work-unit addressing is loud on dotted paths, unknown units, missing flags, and an epic', () => {
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay.review.pay', phase: 'review' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'nope', phase: 'review' }), /work unit "nope" not found/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', next: 'planning' }), /--prev is required/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'specification' }), /--next is required/);
    writeManifest(dir, 'big', { work_type: 'epic' });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'big', prev: 'implementation', next: 'review' }), /"big" is typed "epic" — the gate serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'revisit-phases', { dotpath: 'big' }), /"big" is typed "epic" — the revisit menu serves the linear work types/);
    writeManifest(dir, 'raw', { work_type: undefined });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'raw', prev: 'implementation', next: 'review' }), /"raw" is untyped — the gate serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay' }), /--phase is required/);
  });

  it('next-phase-gate: refuses a phase outside the type\'s pipeline — a typo, done, or review on a type that has none', () => {
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'reveiw' }),
      /unknown --next "reveiw" for a feature \(pipeline: research, experiment, discussion, specification, planning, implementation, review\)/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'review', next: 'done' }), /unknown --next "done" for a feature/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'banana', next: 'review' }), /unknown --prev "banana" for a feature/);
    // Cross-cutting ends at specification: a review hop is a relay slip, and
    // the skip-review row it would render has no arm in that continuation.
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { discussion: { items: { xc: { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'xc', prev: 'discussion', next: 'review' }),
      /unknown --next "review" for a cross-cutting \(pipeline: research, experiment, discussion, specification\)/);
    const hop = renderSurface(dir, 'next-phase-gate', { dotpath: 'xc', prev: 'discussion', next: 'specification' });
    assert.match(hop, /\*\*`y\/yes`\*\* +→ Proceed to specification/);
    assert.match(hop, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!hop.includes('d/done'), hop);
  });

  it('next-phase-gate: several live reconcile flags join into one cue', () => {
    writeManifest(dir, 'moved2', {
      work_type: 'feature',
      phases: {
        specification: { items: { moved2: { status: 'completed', reconcile_needed: 'discussion' } } },
        implementation: { items: { moved2: { status: 'completed' } } },
        review: { items: { moved2: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved2', prev: 'implementation', next: 'review' });
    assert.ok(out.includes('⚑ Input moved beneath specification/moved2 (discussion), review/moved2 (implementation) — completing without review carries the pending reconcile unresolved.'), out);
  });
});

describe('review fixes — gap coverage', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: {
      planning: { items: {
        portal: { status: 'in-progress', finding_gate_mode: 'gated' },
        live: { status: 'in-progress', finding_gate_mode: 'auto' },
      } },
      specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } },
    } });
  });
  afterEach(() => teardown(dir));

  const base = {
    n: 1, total: 1, title: 'T', meta: [['Severity', 'Minor']],
    move: 'settled', problem: 'P', proposal: 'Q',
  };

  it('finding content × gated offers v/view, never view full', () => {
    const file = writePayload(dir, 'f.json', { ...base, content: { label: 'Proposed Addition', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!out.includes('view full'), 'there is no full copy to re-show');
    assert.ok(/`v\/view`/.test(out), 'the wording stays reachable');
  });

  it('finding diff × auto renders the diff fence plus the applied line, no menu', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.live', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!/frame/.test(out), 'no frame sections survive the D8 retirement');
    assert.ok(out.includes('DISPLAY: finding auto-approved'));
    assert.ok(!out.includes('MENU: finding gate'));
  });

  it('finding diff × a batched address renders the fence and stops there', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!out.includes('DISPLAY: finding auto-approved'));
    assert.ok(!out.includes('MENU: finding gate'));
  });

  it('null payload is a loud named error, not a TypeError', () => {
    const file = writePayload(dir, 'n.json', 'null');
    for (const surface of ['finding', 'findings-summary', 'proposed-task', 'tasks-overview', 'phase-tree']) {
      assert.throws(
        () => renderSurface(dir, surface, { dotpath: 'pay.planning.portal', file, gate: 'gated' }),
        /payload must be a JSON object or array/,
        surface,
      );
    }
  });

  it('a context-only diff is refused loudly', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { context_above: ['ctx'], current: [], proposed: [] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file }), /"diff" must carry at least one current\/proposed line/);
  });

  it('null meta values and null phase-tree detail values are refused', () => {
    const bad = writePayload(dir, 'm.json', { ...base, meta: [['Severity', null]] });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: bad }), /"meta" must be an array of \[label, value\] pairs/);
    const badTree = writePayload(dir, 'pt.json', { phases: [{ name: 'X', detail: [['Goal', null]] }] });
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: badTree }), /"detail" must be a non-empty array of \[label, value\] pairs/);
  });

  it('phase-tree --approve menu offers view full', () => {
    const file = writePayload(dir, 'pt.json', { phases: [{ name: 'X' }] });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    assert.ok(/\*\*`v\/view full`\*\* +→ Show the full phase structure — goals, ordering rationale, acceptance criteria/.test(unwrap(out)));
  });
});

describe('render review-findings-gate', () => {
  let dir;
  const store = (phase, row) => writePayload(dir, `.leeway/.cache/pay/${phase}/checkout/state.json`, { agents: { 'review-001': {
    id: 'review-001', kind: 'review', phase, topic: 'checkout', set: 1, announced: false, created: '2026-09-11T10:00:00.000Z', ...row,
  } } });
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress' } } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('counts the acknowledged row\'s unsurfaced findings and names no pass — byte-exact', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1', 'F2', 'F3'], surfaced: ['F2'] });
    const out = renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' });
    assert.strictEqual(out, [
      "=== MENU: review findings gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'The review left 2 findings still to walk.',
      '',
      '**`◆ Walk them now?`**',
      '',
      '**`y/yes`**  → Work through them now',
      '**`s/skip`** → Acknowledge and conclude the topic',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /final review/i);
  });

  it('a lone finding takes the singular', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 1 finding still to walk\.\n\n\*\*`◆ Walk them now\?`\*\*/);
  });

  it('a research address is refused whatever its store holds — the gate is the discussion close\'s', () => {
    store('research', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.research.checkout' }),
      /render review-findings-gate: address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "research"/);
  });

  it('refuses every state the calling prose never renders it from', () => {
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /render review-findings-gate: no review has been dispatched on this topic/);
    store('discussion', { status: 'pending', findings: [], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /the latest review row "review-001" is pending — the gate follows an acknowledged report/);
    store('discussion', { status: 'incorporated', findings: ['F1'], surfaced: ['F1'] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /"review-001" is incorporated/);
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.planning.checkout' }),
      /address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "planning"/);
  });

  it('anchors on the latest review row, not an earlier drained one', () => {
    writePayload(dir, '.leeway/.cache/pay/discussion/checkout/state.json', { agents: {
      'review-001': { id: 'review-001', kind: 'review', phase: 'discussion', topic: 'checkout', set: 1, status: 'incorporated', announced: true, findings: ['F1'], surfaced: ['F1'], created: '2026-09-11T09:00:00.000Z' },
      'review-002': { id: 'review-002', kind: 'review', phase: 'discussion', topic: 'checkout', set: 2, status: 'acknowledged', announced: false, findings: ['F1', 'F2'], surfaced: [], created: '2026-09-11T10:00:00.000Z' },
    } });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 2 findings still to walk\./);
  });
});

describe('render review-presentation', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (payload) => {
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(payload));
    return renderSurface(dir, 'review-presentation', { dotpath: 'pay.review.checkout', file: 'p.json' });
  };

  it('a fail carries full chrome: title anchor, red verdict tier, then the list', () => {
    const out = render({
      topic: 'checkout', verdict: 'fail',
      corrected: { applied: 180, reverted: 2, suite: 'green' }, discarded: 45, out_of_scope: 2,
      replan: [
        { summary: 'the badge key collides for two row shapes', ref: 'union.go:190', fails: 'both rows render the badge' },
        { summary: 'the guard scans comments only', fails: 'ten retired names pass green' },
      ],
    });
    assert.match(out, /=== TITLE \(emit verbatim as markdown \(not a code block\) — the view's chrome heading\) ===\n# \*\*`■ Review — Checkout`\*\*/);
    assert.match(out, /DISPLAY: review verdict \(emit verbatim as a properties code block/);
    assert.match(out, /⚑ Failed — 2 findings must be planned and built before this work is delivered/);
    assert.match(out, /\*\*Needs planning\*\* — 2 findings/);
    assert.match(out, /1\\\. the badge key collides/);
    assert.match(out, /↳ union\.go:190 — both rows render the badge/);
    assert.match(out, /↳ ten retired names pass green/);
    assert.match(out, /Corrected in this session: 180 applied · suite green · 2 reverted, still owed\./);
    assert.match(out, /Outside this spec: 2 findings — held until the review closes\./);
    assert.match(out, /Discarded: 45 — reasons in the report\./);
    const vi = out.indexOf('⚑ Failed');
    assert.ok(out.indexOf('■ Review') < vi && vi < out.indexOf('Needs planning'), 'verdict sits between the title and the list');
  });

  it('a pass keeps the chrome and stays calm — no red, nothing listed', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', corrected: { applied: 180, suite: 'green' }, discarded: 45 });
    assert.match(out, /# \*\*`■ Review — Checkout`\*\*/);
    assert.match(out, /\*\*Passed\*\* — nothing needs planning\./);
    assert.ok(!out.includes('⚑'), 'red is the fail register only');
    assert.match(out, /180 applied · suite green\./);
    assert.ok(!out.includes('Needs planning'));
    assert.ok(!/^\d+\\\. /m.test(out), 'nothing is listed on a pass');
  });

  it('a clean pass is the title and the verdict alone', () => {
    const out = render({ topic: 'checkout', verdict: 'pass' });
    assert.match(out, /\*\*Passed\*\*/);
    assert.ok(!out.includes('DISPLAY: review findings'), 'no findings section when there is nothing to say');
    assert.ok(!out.includes('Corrected'));
    assert.ok(!out.includes('Discarded'));
  });

  it('names the criteria the review could not measure, singular at one', () => {
    const three = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 3 });
    assert.match(three, /Not measured: 3 criteria — named in the report\./);
    const one = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 1 });
    assert.match(one, /Not measured: 1 criterion — named in the report\./);
  });

  it('says nothing about measurement when every criterion was measured', () => {
    const zero = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 0 });
    assert.ok(!zero.includes('Not measured'), 'zero renders nothing');
    const absent = render({ topic: 'checkout', verdict: 'pass', discarded: 45 });
    assert.ok(!absent.includes('Not measured'), 'absent renders nothing');
  });

  it('the out-of-scope line says what happens to the set: decided at a pass, held at a fail', () => {
    const pass = render({ topic: 'checkout', verdict: 'pass', out_of_scope: 1 });
    assert.match(pass, /Outside this spec: 1 finding — each decided below\./);
    const fail = render({
      topic: 'checkout', verdict: 'fail', out_of_scope: 3,
      replan: [{ summary: 'the guard scans comments only', fails: 'ten retired names pass green' }],
    });
    assert.match(fail, /Outside this spec: 3 findings — held until the review closes\./);
  });

  it('the not-measured line closes the tail, after the held and discarded counts', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', corrected: { applied: 4, suite: 'green' }, out_of_scope: 2, discarded: 45, not_measured: 3 });
    const oi = out.indexOf('Outside this spec: 2');
    const di = out.indexOf('Discarded: 45');
    const ni = out.indexOf('Not measured: 3');
    assert.ok(out.indexOf('Corrected in this session') < oi && oi < di && di < ni, 'the tail keeps its order');
  });

  it('a pass with nothing but unmeasured criteria still opens the findings section', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', not_measured: 3 });
    assert.match(out, /DISPLAY: review findings/);
    assert.match(out, /Not measured: 3 criteria — named in the report\./);
    assert.ok(!out.includes('Corrected'));
    assert.ok(!out.includes('Discarded'));
  });

  it('refuses a not-measured count that is not a non-negative integer', () => {
    const message = /render review-presentation: "not_measured" must be a non-negative integer/;
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: -1 }), message);
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: 1.5 }), message);
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: '3' }), message);
  });

  it('refuses a verdict that disagrees with the list', () => {
    assert.throws(() => render({ topic: 'checkout', verdict: 'fail' }), /a fail must carry at least one "replan" finding/);
    assert.throws(
      () => render({ topic: 'checkout', verdict: 'pass', replan: [{ summary: 'x', fails: 'y' }] }),
      /a pass cannot carry "replan" findings/,
    );
  });

  it('refuses a bad payload and a bad address', () => {
    assert.throws(() => render({ topic: 'checkout', verdict: 'ship-it' }), /"verdict" must be "pass" or "fail"/);
    assert.throws(() => render({ verdict: 'pass' }), /"topic" must be a non-empty string/);
    writeManifest(dir, 'pay2', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify({ topic: 'x', verdict: 'pass' }));
    assert.throws(
      () => renderSurface(dir, 'review-presentation', { dotpath: 'pay2.discussion.checkout', file: 'p.json' }),
      /address must be <work_unit>\.review\.<topic>/,
    );
  });
});

describe('render review-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('a fail routes to planning and offers nothing else', () => {
    const out = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'fail', replan: '9' });
    assert.match(out, /\*\*`◆ What next\?`\*\*/);
    assert.match(out, /\*\*`p\/plan`\*\* → Plan the 9 failures and reopen implementation/);
    assert.match(out, /\*\*Ask\*\*/);
    assert.ok(!out.includes('c/complete'), 'a failing review cannot be completed');
  });

  it('the completion names where it lands — an epic returns, every other type finishes', () => {
    const landing = (workType) => {
      writeManifest(dir, 'pay', { work_type: workType, phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
      return renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    };
    assert.match(landing('epic'), /\*\*`c\/complete`\*\* → Complete the review and return to the epic/);
    assert.match(landing('feature'), /\*\*`c\/complete`\*\* → Complete the review and finish the feature/);
    assert.match(landing('bugfix'), /\*\*`c\/complete`\*\* → Complete the review and finish the bugfix/);
    assert.match(landing('quick-fix'), /\*\*`c\/complete`\*\* → Complete the review and finish the quick-fix/);
  });

  it('an unknown or absent work type still names a landing', () => {
    writeManifest(dir, 'pay', { work_type: 'rebuild', phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
    assert.match(renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' }),
      /\*\*`c\/complete`\*\* → Complete the review and finish the work/);
    writeManifest(dir, 'pay', { work_type: undefined, phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
    assert.match(renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' }),
      /\*\*`c\/complete`\*\* → Complete the review and finish the work/);
  });

  it('the banked set is decided before the gate, so the gate never offers it', () => {
    const clean = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    assert.ok(!clean.includes('i/inbox'), 'the out-of-scope decision is not a gate option');
    assert.ok(!clean.includes('p/plan'));
    const flagged = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass', 'out-of-scope': '2' });
    assert.strictEqual(flagged, clean, 'the surface no longer reads --out-of-scope');
  });

  it('refuses a fail with no replan count, a bad verdict, and a bad address', () => {
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'fail' }),
      /a fail needs --replan <count>/,
    );
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'maybe' }),
      /--verdict must be "pass" or "fail"/,
    );
    writeManifest(dir, 'pay2', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay2.discussion.checkout', verdict: 'pass' }),
      /address must be <work_unit>\.review\.<topic>/,
    );
  });
});

describe('render off-topic-offer', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const feature = () => writeManifest(dir, 'pay', {
    work_type: 'feature',
    phases: { research: { items: { pay: { status: 'in-progress' } } } },
  });

  it('offers the pivot for a feature, aligned across three rows', () => {
    feature();
    const file = writePayload(dir, 'o.json', { title: 'Rate limiting on the public API' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Rate limiting on the public API** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`p/pivot`**  → Convert this work to an epic so it can hold it as its',
      `${NB(11)}own topic`,
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('drops the pivot for a non-feature and re-aligns the pair', () => {
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { research: { items: { xc: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { title: 'Audit logging' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'xc.research.xc', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Audit logging** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload and an empty title', () => {
    feature();
    assert.throws(() => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay' }), /--file <payload\.json> is required/);
    const blank = writePayload(dir, 'b.json', { title: '  ' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file: blank }),
      /"title" must be a non-empty string/,
    );
  });

  it('the discussion variant adds the roadmap park and speaks the Summary register', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: { discussion: { items: { pay: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { title: 'Gift cards' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.discussion.pay', file, variant: 'discussion' });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Gift cards** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**     → Capture it as an idea in the inbox for later',
      '**`r/roadmap`** → Put it on the product roadmap for a later release',
      '**`p/pivot`**   → Convert this work to an epic so it can hold it as its',
      `${NB(12)}own topic`,
      '**`i/ignore`**  → Note it in the Summary and move on',
      '',
    ].join('\n'));
  });

  it('refuses an unknown variant', () => {
    feature();
    const file = writePayload(dir, 'o.json', { title: 'X' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file, variant: 'nope' }),
      /--variant takes "discussion"/,
    );
  });
});

describe('render change-set-tree', () => {
  const { git, initRepo, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => cleanupFixture(dir));

  it('is empty while the code tree is clean — the review\'s own artifacts sit uncommitted in the state', () => {
    writePayload(dir, '.leeway/pay/review/checkout/change-set-c1-auth.md', '# Section\n');
    assert.strictEqual(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }), '');
  });

  it('names every modified or untracked path in the code tree in the terminal blocker', () => {
    writePayload(dir, 'src/probe.js', 'x\n');
    writePayload(dir, 'notes.txt', 'y\n');
    assert.strictEqual(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }), [
      '=== DISPLAY: entry blocker (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The change-set verification left the working tree dirty',
      '',
      '=== DISPLAY: blocker guidance (emit verbatim as markdown (not a code block), then STOP — terminal condition) ===',
      '> The pass must leave the tree as it found it — these paths are modified or untracked: `notes.txt`, `src/probe.js`. Once the tree is clean, re-enter the review; it resumes at this step, keeping the section files already written.',
      '',
    ].join('\n'));
  });

  it('refuses an address outside the review', () => {
    assert.throws(() => renderSurface(dir, 'change-set-tree', { dotpath: 'pay.implementation.checkout' }),
      /address must be <work_unit>\.<review>\.<topic>/);
  });

  it('reads every repo in the project — a nested repo\'s change blocks, its folder in the parent never does', () => {
    const web = initRepo(path.join(dir, 'web'));
    writePayload(dir, 'web/index.js', 'x\n');
    git(web, ['add', '-A']);
    git(web, ['commit', '-q', '-m', 'init']);
    assert.strictEqual(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }), '',
      'a clean nested repo is no dirt, though the parent\'s git names its folder');

    writePayload(dir, 'web/index.js', 'y\n');
    assert.match(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }),
      /these paths are modified or untracked: `web\/index\.js`\. Once the tree is clean/);
  });

  it('in a project nested in a larger repository, reads only the project\'s own folder of it', () => {
    const repo = setupGitFixture('render-nested-');
    try {
      const project = path.join(repo, 'apps/web');
      fs.mkdirSync(project, { recursive: true });
      writeManifest(repo, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
      writePayload(repo, 'other/x.js', 'x\n');
      git(repo, ['add', '-A']);
      git(repo, ['commit', '-q', '-m', 'init']);
      writePayload(repo, 'other/x.js', 'y\n');
      writePayload(repo, '.leeway/pay/review/checkout/change-set-c1-auth.md', '# Section\n');
      assert.strictEqual(renderSurface(project, 'change-set-tree', { dotpath: 'pay.review.checkout' }), '',
        'a sibling folder\'s dirt and the repository\'s state are not the project\'s code');

      writePayload(project, 'src/probe.js', 'x\n');
      assert.match(renderSurface(project, 'change-set-tree', { dotpath: 'pay.review.checkout' }),
        /these paths are modified or untracked: `src\/probe\.js`\. Once the tree is clean/);
    } finally {
      cleanupFixture(repo);
    }
  });
});
