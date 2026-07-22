'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DOTS, section, dotFrame, menu, callout, subDetail, treeList } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface } = require('../../skills/workflow-engine/scripts/domain/render.cjs');
const { selectionSections } = require('../../skills/workflow-engine/scripts/domain/projections/selection.cjs');

function setup() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'render-surfaces-'));
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function writeManifest(dir, name, data) {
  const mdir = path.join(dir, '.workflows', name);
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

describe('surfaces primitives', () => {
  it('menu renders dot frame, label, blank line, options', () => {
    assert.strictEqual(
      menu('Approve?', ['- **`y`/`yes`**', '- **`n`/`no`**']),
      [DOTS, 'Approve?', '', '- **`y`/`yes`**', '- **`n`/`no`**', DOTS].join('\n'),
    );
  });

  it('menu appends an optional trailing prompt after a blank line', () => {
    const out = menu('Pick one:', ['- **`1`** — A'], { prompt: 'Select an option:' });
    assert.ok(out.endsWith(['- **`1`** — A', '', 'Select an option:', DOTS].join('\n')));
  });

  it('section wraps body in a named, instruction-carrying marker and strips trailing newlines', () => {
    assert.strictEqual(section('MENU: x', 'emit verbatim', 'body\n\n'), '=== MENU: x (emit verbatim) ===\nbody\n');
  });

  it('callout flags the first line and aligns continuations', () => {
    assert.strictEqual(callout(['first line', 'second line']), '  ⚑ first line\n    second line');
  });

  it('dotFrame wraps arbitrary lines in the canonical dot rules', () => {
    assert.strictEqual(dotFrame(['a', '', 'b']), [DOTS, 'a', '', 'b', DOTS].join('\n'));
  });

  it('callout wraps a string to the width with the flag gutter subtracted', () => {
    const out = callout('word '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('  ⚑ ') && lines[1].startsWith('    '));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('subDetail glyphs the first line and aligns continuations under the text', () => {
    const out = subDetail('alpha '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('   · alpha') && lines[1].startsWith('     alpha'));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('treeList branches each item, gutters continuations, blanks under the last', () => {
    const out = treeList(['one '.repeat(12).trim(), 'two '.repeat(12).trim()], { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('     ├─ one'));
    assert.ok(lines[1].startsWith('     │  one'), 'non-last continuation carries the gutter');
    const lastBranch = lines.findIndex((l) => l.startsWith('     └─ two'));
    assert.ok(lastBranch > 0);
    assert.ok(lines[lastBranch + 1].startsWith('        two'), 'last continuation is blank-guttered');
  });

});

describe('render resume-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the menu byte-exactly, artifact from the phase segment, topic titlecased', () => {
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow' });
    assert.strictEqual(out, [
      "=== MENU: resume gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Found existing discussion for **Auth Flow**.',
      '',
      '- **`c`/`continue`** — Pick up where you left off',
      '- **`r`/`restart`** — Delete the discussion and start fresh',
      DOTS,
      '',
    ].join('\n'));
  });

  it('prepends the triage warning display when --triage is passed', () => {
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', triage: '3' });
    assert.ok(out.startsWith([
      '=== DISPLAY: triage warning (emit verbatim as a code block, directly above the menu) ===',
      '  ⚑ 3 rerouted concern(s) from other topics sit undrained in this',
      "    file's Triage section. Restarting deletes them permanently.",
      '',
    ].join('\n')));
    assert.ok(out.includes('=== MENU: resume gate'));
  });

  it('rejects a non-positive or non-integer triage count', () => {
    for (const bad of ['0', '-1', 'two', '']) {
      assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', triage: bad }), /--triage must be a positive integer/);
    }
  });

  it('rejects a malformed address and an unknown work unit', () => {
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion' }), /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'nope.discussion.x' }), /work unit "nope" not found/);
  });
});

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
      '=== DISPLAY: task list (emit verbatim as a code block) ===',
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
      "=== MENU: task list gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Approve this task list?',
      '',
      '- **`y`/`yes`** — Proceed to authoring',
      '- **`a`/`auto`** — Approve this and all remaining task list gates automatically',
      '- **Tell me what to change** — which tasks to reorder, split, merge, add, edit, or remove',
      '- **Navigate** — Tell me where to go: a different phase or task, or the leading edge',
      DOTS,
      '',
    ].join('\n'));
  });

  it('singular "1 task." and the auto-proceed line when the gate mode is auto', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'tl.json', { ...payload, tasks: [payload.tasks[0]] });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('Phase 1: Adapter Wrapper — 1 task.'));
    assert.ok(out.includes('=== DISPLAY: task list auto-approved (emit verbatim as a code block, then proceed without a gate) ==='));
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

describe('render findings-summary', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the numbered overview with subDetail summaries byte-exactly', () => {
    const file = writePayload(dir, 's.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor — add-to-task', summary: 'Task 1-1 lacks the required Outcome field.' },
        { title: 'Orphaned dependency', tag: 'Important — update-task', summary: 'Task 2-3 depends on a removed task.' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as a code block) ===',
      'Integrity Review — 2 items found',
      '',
      '1. Missing Outcome field (Minor — add-to-task)',
      '   · Task 1-1 lacks the required Outcome field.',
      '',
      '2. Orphaned dependency (Important — update-task)',
      '   · Task 2-3 depends on a removed task.',
      '',
      "Let's work through these one at a time, starting with #1.",
      '',
    ].join('\n'));
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { review_label: 'X', items: [] }) }), /"items" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { review_label: 'X', items: [{ title: 't', tag: 'g' }] }) }), /item 1 is missing "summary"/);
  });
});

describe('render finding', () => {
  let dir;
  const base = {
    n: 1, total: 2, title: 'Missing Outcome field',
    meta: [['Severity', 'Minor'], ['Change Type', 'add-to-task']],
    details: 'The canonical template requires Outcome.',
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders meta, the diff as one fenced section, and the gate menu when gated', () => {
    const file = writePayload(dir, 'f.json', {
      ...base,
      diff: { context_above: ['**Solution**: shared adapter.'], current: [], proposed: ['**Outcome**: lands at a live shell.'], context_below: ['**Do**:'] },
      apply_label: 'Apply to the plan verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.startsWith([
      '=== DISPLAY: finding (emit verbatim as markdown) ===',
      '**Finding 1 of 2: Missing Outcome field**',
      '',
      '- **Severity**: Minor',
      '- **Change Type**: add-to-task',
      '',
      '**Details**: The canonical template requires Outcome.',
      '',
    ].join('\n')));
    assert.ok(out.includes('=== DISPLAY: diff (emit verbatim as a diff code block (```diff fence)) ===\n **Solution**: shared adapter.\n+**Outcome**: lands at a live shell.\n **Do**:'));
    assert.ok(!/frame|╭|╰/.test(out), 'the fence is the frame — no drawn borders, no frame sections');
    assert.ok(out.includes('=== MENU: finding gate'));
    assert.ok(out.includes('- **`v`/`view full`** — Show full Current and Proposed content'), 'diff findings offer view full');
    assert.ok(out.includes('- **`y`/`yes`** — Apply to the plan verbatim'));
    assert.ok(out.includes('- **Provide feedback** — Tell me what to change before approving'));
  });

  it('wide diff lines pass through untouched — no border, no wrap', () => {
    const long = 'x'.repeat(150);
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: [long] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes(`\n+${long}\n`), 'the fence re-flows in the host; the engine never wraps diff lines');
  });

  it('content variant renders as a code block without view full; auto mode returns the applied line', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...base,
      content: { label: 'Proposed Addition', lines: ['New spec section body.'] },
      applied_label: 'approved. Added to specification.',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding content (emit verbatim as a code block) ===\nProposed Addition:\n\nNew spec section body.'));
    assert.ok(out.includes('=== DISPLAY: finding auto-approved (emit verbatim as a code block after applying the fix) ===\nFinding 1 of 2: Missing Outcome field — approved. Added to specification.'));
    assert.ok(!out.includes('MENU: finding gate'));
    assert.ok(!out.includes('view full'));
  });

  it('validates loudly: shape, exclusivity, and empty diff', () => {
    const cases = [
      [{ ...base, n: 0 }, /"n" must be a positive integer/],
      [{ ...base, total: 0 }, /"total" must be an integer/],
      [{ ...base, meta: [['x']] }, /"meta" must be an array of \[label, value\] pairs/],
      [{ ...base, details: ' ' }, /"details" must be a non-empty string/],
      [{ ...base, diff: { current: [], proposed: [] }, content: { label: 'X', lines: ['y'] } }, /pass "diff" or "content", not both/],
      [{ ...base, diff: { current: [], proposed: [] } }, /"diff" must carry at least one/],
      [{ ...base, content: { label: 'X', lines: [] } }, /"content.lines" must be non-empty/],
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
    tests: ['- detach closes the adapter'],
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
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**Task 2/3: Fix adapter leak** (Important)',
      'Sources: reviewer cycle 1',
      '',
      '**Problem**: The adapter never closes.',
      '**Solution**: Close on detach.',
      '**Outcome**: No leaked handles.',
      '',
      '**Do**:',
      '1. Add Close()',
      '2. Call it on detach',
      '',
      '**Acceptance Criteria**:',
      '- no leaked handles after detach',
      '',
      '**Tests**:',
      '- detach closes the adapter',
      '',
      "=== MENU: task approval (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Approve this task?',
      '',
      '- **`y`/`yes`** — Approve this task',
      '- **`a`/`auto`** — Approve this and all remaining tasks automatically',
      '- **`s`/`skip`** — Skip this task',
      '- **Comment** — Tell me what to change',
      DOTS,
      '',
    ].join('\n'));
  });

  it('honours a custom comment hint and the auto gate', () => {
    const file = writePayload(dir, 'p.json', payload);
    const gated = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(gated.includes('- **Comment** — Provide feedback to adjust'));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('=== DISPLAY: task auto-approved (emit verbatim as a code block after recording the approval) ===\nTask 2 of 3: Fix adapter leak — approved [auto].'));
    assert.ok(!auto.includes('MENU: task approval'));
  });

  it('requires --gate and validates the payload loudly', () => {
    const file = writePayload(dir, 'p.json', payload);
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file }), /--gate must be "gated" or "auto"/);
    const noTests = writePayload(dir, 'bad.json', { ...payload, tests: [] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noTests, gate: 'gated' }), /"tests" must be non-empty/);
    const noProblem = writePayload(dir, 'bad2.json', { ...payload, problem: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }), /"problem" must be a non-empty string/);
  });
});

describe('render tasks-overview', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the cycle overview byte-exactly', () => {
    const file = writePayload(dir, 'o.json', { label: 'Analysis cycle 2', tasks: [{ title: 'Fix leak', severity: 'Important' }, { title: 'Add test', severity: 'Minor' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as a code block) ===',
      'Analysis cycle 2: 2 proposed tasks',
      '',
      '  1. Fix leak (Important)',
      '  2. Add test (Minor)',
      '',
    ].join('\n'));
  });

  it('validates loudly', () => {
    const file = writePayload(dir, 'o.json', { label: 'X', tasks: [{ title: 't' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file }), /task 1 needs "title" and "severity"/);
  });
});

describe('render author-task-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the authoring menu byte-exactly', () => {
    const out = renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '5', title: 'Wrap command' });
    assert.strictEqual(out, [
      "=== MENU: author task gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**Task 2 of 5: Wrap command**',
      '',
      '- **`y`/`yes`** — Write it to the plan',
      '- **`a`/`auto`** — Approve this and all remaining tasks automatically',
      '- **Tell me what to change** — what to revise in this task',
      '- **Navigate** — Tell me where to go: a different phase or task, or the leading edge',
      DOTS,
      '',
    ].join('\n'));
  });

  it('validates the scalars loudly', () => {
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '0', total: '5', title: 'X' }), /--m must be a positive integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '1', title: 'X' }), /--total must be an integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2' }), /--title is required/);
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
      '=== DISPLAY: phase tree (emit verbatim as a code block) ===',
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
    assert.ok(out.includes('- **`y`/`yes`** — Proceed to task breakdown'));
    const lines = out.split('\n');
    const goalIdx = lines.findIndex((l) => l.startsWith('   ├─ Goal:'));
    assert.ok(lines[goalIdx + 1].startsWith('   │  goal'), 'wrapped detail carries the gutter');
  });

  it('validates loudly', () => {
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
    assert.ok(gated.includes('- **Tell me what to change** — which tasks to revise in this phase'));
    assert.ok(!gated.includes('`a`/`auto`'), 'existing variant offers no auto opt-in');

    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const auto = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(auto.includes('Phase 1: X — task list confirmed. Proceeding to authoring.'));
  });
});

describe('selection projection', () => {
  it('renders the bugfix pick list byte-exactly', () => {
    const out = selectionSections('bugfix',
      [{ name: 'crash', phase_label: 'specification (in-progress)' }, { name: 'leak', phase_label: 'investigation (in-progress)' }],
      { completed: 1, cancelled: 1 });
    assert.strictEqual(out, [
      '=== DISPLAY: selection (emit verbatim as a code block only at the select step) ===',
      '2 bugfix(es) in progress:',
      '',
      '  1. Crash',
      '     └─ Specification (In-Progress)',
      '',
      '  2. Leak',
      '     └─ Investigation (In-Progress)',
      '',
      '1 completed, 1 cancelled.',
      '',
      "=== MENU: selection (emit verbatim as markdown only at the select step, then STOP for the user's response) ===",
      DOTS,
      'Which bugfix would you like to continue?',
      '',
      '- **`1`** — Continue "Crash" — specification (in-progress)',
      '- **`2`** — Continue "Leak" — investigation (in-progress)',
      '',
      '- **`3`** — View completed & cancelled bugfixes',
      "- **`m`/`manage`** — Manage a bugfix's lifecycle",
      '',
      'Select an option:',
      DOTS,
      '',
    ].join('\n'));
  });

  it('epic variant sub-rows active phases and drops the phase label from options', () => {
    const out = selectionSections('epic', [{ name: 'payments', active_phases: ['discussion', 'specification'] }], { completed: 0, cancelled: 0 });
    assert.ok(out.includes('     └─ Discussion, Specification'));
    assert.ok(out.includes('- **`1`** — Continue "Payments"'));
    assert.ok(!out.includes('Continue "Payments" —'));
    assert.ok(!out.includes('View completed'), 'no closed units, no view option');
  });

  it('empty units render nothing; unknown type throws', () => {
    assert.strictEqual(selectionSections('feature', [], { completed: 3, cancelled: 0 }), '');
    assert.throws(() => selectionSections('nope', [{ name: 'x' }], { completed: 0, cancelled: 0 }), /unknown type "nope"/);
  });
});

describe('bridge continuation surfaces', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { work_type: 'feature' });
  });
  afterEach(() => teardown(dir));

  it('gates render byte-stable menus', () => {
    const early = renderSurface(dir, 'early-completion-gate', { dotpath: 'pay' });
    assert.ok(early.includes('Implementation completed for "Pay".'));
    assert.ok(early.includes('- **`d`/`done`** — Complete without review'));

    const revisit = renderSurface(dir, 'revisit-gate', { dotpath: 'pay', prev: 'specification', next: 'planning' });
    assert.ok(revisit.includes('Specification completed for "Pay".'));
    assert.ok(revisit.includes('- **`y`/`yes`** — Proceed to planning'));

    const allDone = renderSurface(dir, 'epic-all-done-gate', { dotpath: 'pay' });
    assert.ok(allDone.includes('All topics have completed review for "Pay".'));

    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'discussion' });
    assert.ok(note.includes('Discussion completed for "Pay".'));
  });

  it('work-unit addressing is loud on dotted paths, unknown units, and missing flags', () => {
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay.review.pay', phase: 'review' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'nope', phase: 'review' }), /work unit "nope" not found/);
    assert.throws(() => renderSurface(dir, 'revisit-gate', { dotpath: 'pay', next: 'planning' }), /--prev is required/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay' }), /--phase is required/);
  });
});

describe('review fixes — gap coverage', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } }, specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
  });
  afterEach(() => teardown(dir));

  const base = { n: 1, total: 1, title: 'T', meta: [['Severity', 'Minor']], details: 'D' };

  it('finding content × gated renders the menu WITHOUT view full', () => {
    const file = writePayload(dir, 'f.json', { ...base, content: { label: 'Proposed Addition', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!out.includes('view full'), 'content findings offer no view-full option');
  });

  it('finding diff × auto renders the diff fence plus the applied line, no menu', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!/frame/.test(out), 'no frame sections survive the D8 retirement');
    assert.ok(out.includes('DISPLAY: finding auto-approved'));
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
    assert.ok(out.includes('- **`v`/`view full`** — Show the full phase structure — goals, ordering rationale, acceptance criteria'));
  });
});

describe('titlecaseLabel', () => {
  const { titlecaseLabel } = require('../../skills/workflow-engine/scripts/domain/conventions.cjs');
  it('capitalises runs in place, preserving punctuation', () => {
    assert.strictEqual(titlecaseLabel('discussion (in-progress)'), 'Discussion (In-Progress)');
    assert.strictEqual(titlecaseLabel('finalising — quick-fix'), 'Finalising — Quick-Fix');
    assert.strictEqual(titlecaseLabel('phase 2 (done)'), 'Phase 2 (Done)');
  });
});

describe('CLI boundary — engine render via subprocess', () => {
  const { execFileSync, spawnSync } = require('child_process');
  const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'in-progress' } } },
        planning: { items: { pay: { status: 'in-progress', task_list_gate_mode: 'auto' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  function run(args) {
    return execFileSync('node', [ENGINE, 'render', ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('flags survive argv: --triage, --variant, --approve, --gate, scalar flags', () => {
    assert.ok(run(['resume-gate', 'pay.discussion.pay', '--triage', '2']).includes('2 rerouted concern(s)'));
    const tl = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 's' }] });
    assert.ok(run(['task-list', 'pay.planning.pay', '--file', tl, '--variant', 'existing']).includes('task list confirmed'));
    const pt = writePayload(dir, 'pt.json', { phases: [{ name: 'P' }] });
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--file', pt, '--approve']).includes('MENU: phase structure gate'));
    const task = writePayload(dir, 'task.json', { current: 1, total: 1, title: 'T', severity: 'Minor', sources: 's', problem: 'p', solution: 's', outcome: 'o', steps: ['1'], criteria: ['c'], tests: ['t'] });
    assert.ok(run(['proposed-task', 'pay.planning.pay', '--file', task, '--gate', 'auto']).includes('approved [auto]'));
    assert.ok(run(['author-task-gate', 'pay.planning.pay', '--m', '1', '--total', '2', '--title', 'T']).includes('**Task 1 of 2: T**'));
    assert.ok(run(['revisit-gate', 'pay', '--prev', 'discussion', '--next', 'specification']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['phase-completed', 'pay', '--phase', 'discussion']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['early-completion-gate', 'pay']).includes('Complete without review'));
    assert.ok(run(['epic-all-done-gate', 'pay']).includes('Mark this epic as completed'));
  });

  it('surface errors surface as failJson on stderr with exit 1', () => {
    const res = spawnSync('node', [ENGINE, 'render', 'proposed-task', 'pay.planning.pay', '--file', 'missing.json', '--gate', 'nope'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.match(JSON.parse(res.stderr.trim()).error, /--gate must be "gated" or "auto"/);
  });
});

describe('render phase-note', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { 'auth-flow': { status: 'completed' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the one-liner with the phase noun by default and an override when given', () => {
    assert.strictEqual(renderSurface(dir, 'phase-note', { dotpath: 'pay.research.auth-flow', verb: 'Resuming' }),
      '=== DISPLAY: phase note (emit verbatim as a code block) ===\nResuming research: Auth Flow\n');
    assert.ok(renderSurface(dir, 'phase-note', { dotpath: 'pay.planning.auth-flow', verb: 'Reopening', noun: 'plan' })
      .includes('Reopening plan: Auth Flow'));
    assert.throws(() => renderSurface(dir, 'phase-note', { dotpath: 'pay.research.auth-flow' }), /--verb is required/);
  });
});

describe('render entry-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  function manifestWith(phases, workType = 'feature') {
    writeManifest(dir, 'pay', { work_type: workType, phases });
  }

  it('planning: every specification state maps to its blocker; completed is clear', () => {
    manifestWith({});
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /Specification Missing\n\nNo specification found for "Auth"\./);
    manifestWith({ specification: { items: { auth: { status: 'in-progress' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /Specification In Progress/);
    manifestWith({ specification: { items: { auth: { status: 'proposed' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /Specification Not Started[\s\S]*proposed grouping/);
    manifestWith({ specification: { items: { auth: { status: 'superseded', superseded_by: 'core-auth' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /Specification Superseded[\s\S]*"Core Auth"/);
    manifestWith({ specification: { items: { auth: { status: 'promoted', promoted_to: 'cc-auth' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /Specification Promoted[\s\S]*"cc-auth"/);
    manifestWith({ specification: { items: { auth: { status: 'completed' } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), '');
  });

  it('implementation and review derive their plan/implementation blockers', () => {
    manifestWith({});
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.implementation.auth' }), /Plan Missing[\s\S]*A completed plan is required for implementation\./);
    manifestWith({ planning: { items: { auth: { status: 'in-progress' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.implementation.auth' }), /Plan Not Completed/);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.implementation.auth' }), '');

    manifestWith({});
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), /Plan Missing[\s\S]*plan and completed implementation are required for review\./);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), /Implementation Missing/);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } }, implementation: { items: { auth: { status: 'in-progress' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), /Implementation Not Complete/);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } }, implementation: { items: { auth: { status: 'completed' } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), '');
  });

  it('specification is work-type-aware: feature discussion, bugfix investigation, epic any-completed', () => {
    manifestWith({}, 'feature');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /Source Material Missing\n\nNo discussion found for "Pay"\./);
    manifestWith({ discussion: { items: { auth: { status: 'in-progress' } } } }, 'feature');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /Discussion In Progress/);
    manifestWith({ discussion: { items: { auth: { status: 'completed' } } } }, 'feature');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');

    manifestWith({}, 'bugfix');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /No investigation found/);
    manifestWith({ investigation: { items: { auth: { status: 'in-progress' } } } }, 'bugfix');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /Investigation In Progress/);

    manifestWith({}, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /No discussions found/);
    manifestWith({ discussion: { items: { a: { status: 'in-progress' }, b: { status: 'in-progress' } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /No Completed Discussions[\s\S]*continue an in-progress discussion/);
    manifestWith({ discussion: { items: { a: { status: 'completed' } } } }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');
  });

  it('an unsupported phase is a loud error', () => {
    manifestWith({});
    assert.throws(() => renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }), /no prerequisite rules for phase "discussion"/);
  });
});

describe('selection not-found display', () => {
  const { selectionNotFound } = require('../../skills/workflow-engine/scripts/domain/projections/selection.cjs');
  it('renders the per-type terminal byte-exactly', () => {
    assert.strictEqual(selectionNotFound('cross-cutting', 'ghost'), [
      '=== DISPLAY: not found (emit verbatim as a code block, then STOP — terminal condition) ===',
      'No active cross-cutting concern named "ghost" found.',
      '',
      'Run /workflow-start to see available concerns or begin a new one.',
      '',
    ].join('\n'));
    assert.ok(selectionNotFound('quick-fix', 'x').includes('available quick-fixes'));
  });
});

describe('catalogue dispatch', () => {
  it('unknown surface errors with the catalogue listing', () => {
    assert.throws(() => renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' }), /unknown surface "nope" \(surfaces: resume-gate, task-list, findings-summary, finding, proposed-task, tasks-overview, author-task-gate, phase-tree, phase-completed, phase-note, entry-gate, early-completion-gate, revisit-gate, epic-all-done-gate\)/);
  });
});

describe('single-source invariants', () => {
  it('the menu dot rule literal exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && fs.readFileSync(p, 'utf8').includes('· · · · · · · · · · · ·')) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'menus must frame through surfaces.dotFrame — inline dot rules reintroduce the pre-consolidation drift class');
  });

  it('the option-line grammar exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && /- \*\*`/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'option lines must build through cmdOption/rangeOption — hand-formatted options reintroduce the drift class');
  });

  // No equivalent invariant for the ⚑ callout: the glyph legitimately appears
  // in inline one-line display headers (arrivals lines, not-ready blocks), so
  // a content grep cannot isolate the wrapped-callout idiom without false
  // positives. Single-sourcing there is enforced structurally — flaggedCallout
  // delegates to surfaces.callout — and guarded by review.

  it('box-glyph frames are retired everywhere — the fence is the frame (D8)', () => {
    const skillsRoot = path.join(__dirname, '..', '..', 'skills');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && (p.endsWith('.cjs') || p.endsWith('.md')) && /[╭╰]/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(skillsRoot, p));
        }
      }
    })(skillsRoot);
    assert.deepStrictEqual(offenders, [],
      'artefact content is framed by its emission fence, never drawn borders — a box glyph reintroduces a fixed-width commitment the terminal cannot honour');
  });
});
