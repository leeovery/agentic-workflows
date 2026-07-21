'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DOTS, section, menu, callout, boxedFrame } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface } = require('../../skills/workflow-engine/scripts/domain/render.cjs');

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

  it('boxedFrame borders reach the widest content line', () => {
    const long = 'x'.repeat(90);
    const out = boxedFrame('Finding 1: Title', ['short', long]);
    const [top, ...rest] = out.split('\n');
    const bottom = rest[rest.length - 1];
    assert.strictEqual([...top].length, 90, 'top border must span the widest content line');
    assert.strictEqual([...bottom].length, 90, 'bottom border must match');
    assert.ok(top.startsWith('╭─ Finding 1: Title ') && top.endsWith('╮'));
    assert.ok(bottom.startsWith('╰') && bottom.endsWith('╯'));
  });

  it('boxedFrame never renders below the minimum width', () => {
    const out = boxedFrame('T', ['x']);
    assert.strictEqual([...out.split('\n')[0]].length, 53);
  });

  it('boxedFrame widens for a long title even with short content', () => {
    const title = 'Finding 12: A very long finding title that outruns the minimum frame width';
    const top = boxedFrame(title, ['x']).split('\n')[0];
    assert.ok(top.includes(title) && top.endsWith('╮'));
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
      '1. Wrap command — Wrap the argv in a shell fallback',
      '   └─ Edge cases: quotes, attach passthrough',
      '',
      '2. Drop wait — Remove wait-after-command',
      '   └─ Edge cases: none',
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
});

describe('catalogue dispatch', () => {
  it('unknown surface errors with the catalogue listing', () => {
    assert.throws(() => renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' }), /unknown surface "nope" \(surfaces: resume-gate, task-list\)/);
  });
});
