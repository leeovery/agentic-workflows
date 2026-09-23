'use strict';

require('./hermetic-env.cjs');

// The GATE payload: each gate stated as data beside the MENU that displays
// it, for a surface that draws the gate itself. Announced by the environment
// and by nothing else — the first suite here is the proof that a session
// without the announcement sees the bytes it always saw.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { output } = require('./engine-harness.cjs');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { GATE_MARKER, announced, auditGate } = require('./gate-audit.cjs');
const { openGate, gateBlock, section, menu, menuFrame, cmdOption, promptOption, optionDetail } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { menuBlock } = require('../../skills/workflow-engine/scripts/gateway.cjs');

const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' };

/** The GATE payload in a response, held whole against its MENU; null when it carries no menu. @param {string} out */
function gateOf(out) {
  return auditGate(out, 'gate payload');
}

/** The same response with its GATE block cut out. @param {string} out */
function withoutGate(out) {
  const lines = out.split('\n');
  const i = lines.indexOf(GATE_MARKER);
  if (i === -1) return out;
  lines.splice(i, 2);
  return lines.join('\n');
}

/** The section markers of a response, in order. @param {string} out */
function markers(out) {
  return out.split('\n').filter((l) => l.startsWith('=== '));
}

/** A skill adapter driven as the process it is. @param {string} dir @param {string} gateway @param {string[]} args @param {Record<string,string>} [env] */
function runGateway(dir, gateway, args, env = {}) {
  const script = path.resolve(__dirname, '../../skills', gateway, 'scripts/gateway.cjs');
  const res = spawnSync('node', [script, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.strictEqual(res.status, 0, `${gateway} ${args.join(' ')} failed\n${res.stderr}`);
  return res.stdout;
}

/**
 * One menu composed through the builders with the surface announced — the
 * door to a shape no render surface produces today.
 * @param {() => string} compose  the menu body @returns {object}
 */
function collect(compose) {
  return announced(() => {
    openGate();
    return gateOf(section('MENU: builder', 'emit verbatim as markdown', compose()));
  });
}

/** An implementation topic sitting at its task gate. @param {string} dir @param {object} [item] */
function seedTaskGate(dir, item = {}) {
  createManifest(dir, 'auth', {
    phases: {
      planning: { items: { 'auth-flow': { status: 'completed' } } },
      implementation: {
        items: {
          'auth-flow': { status: 'in-progress', task_gate_mode: 'gated', current_task: 'auth-flow-1-1', ...item },
        },
      },
    },
  });
}

/** An epic whose discussion a peer session holds while its research runs. @param {string} dir */
function seedHeldEpic(dir) {
  createManifest(dir, 'v1', {
    work_type: 'epic',
    phases: {
      discovery: { items: { auth: { routing: 'discussion', source: 'discovery', order: 1 } } },
      research: { items: { auth: { status: 'in-progress' } } },
      discussion: { items: { auth: { status: 'in-progress' } } },
    },
  });
  const presence = createFile(dir, '.workflows/.cache/v1/discussion/auth/presence',
    JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
  const past = new Date(Date.now() - 240 * 1000);
  fs.utimesSync(presence, past, past);
}

describe('gate payload — the announce switch', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a render surface says nothing extra unannounced, and the announced bytes differ only by the GATE block', () => {
    seedTaskGate(dir);
    const plain = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow']);
    const announced = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.ok(!plain.includes('=== GATE'), plain);
    assert.notStrictEqual(plain, announced);
    assert.strictEqual(withoutGate(announced), plain);
  });

  it('a gateway view says nothing extra unannounced, and the announced bytes differ only by the GATE block', () => {
    seedHeldEpic(dir);
    const plain = runGateway(dir, 'workflow-continue-epic', ['view', 'v1']);
    const announced = runGateway(dir, 'workflow-continue-epic', ['view', 'v1'], ANNOUNCED);

    assert.ok(!plain.includes('=== GATE'), plain);
    assert.strictEqual(withoutGate(announced), plain);
  });

  it('a value other than 1 is not an announcement', () => {
    seedTaskGate(dir);
    const plain = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow']);
    for (const value of ['', '0', 'true', 'yes']) {
      const out = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'],
        { env: { WORKFLOWS_GATE_SURFACE: value } });
      assert.strictEqual(out, plain, `WORKFLOWS_GATE_SURFACE=${value} announced a gate`);
    }
  });
});

describe('gate payload — a render surface', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the task gate states its question, no statement, its pressable rows and its typed rows', () => {
    seedTaskGate(dir);
    const out = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.deepStrictEqual(gateOf(out), {
      gate: 'task gate',
      question: 'Approve this task?',
      statement: '',
      options: [
        { key: 'y', word: 'yes', head: 'Commit and continue to next task', tail: null, detail: null, struck: false, recommended: false },
        { key: 'a', word: 'auto', head: 'Approve this and all remaining tasks automatically', tail: null, detail: null, struck: false, recommended: false },
        { key: 'b', word: 'bounded', head: 'Approve this and the remaining tasks in this phase automatically', tail: null, detail: null, struck: false, recommended: false },
        { key: 't', word: 'technical', head: "Retell the result from the code's perspective", tail: null, detail: null, struck: false, recommended: false },
        { key: 's', word: 'show', head: 'Show the result as diagrams', tail: null, detail: null, struck: false, recommended: false },
      ],
      typed: [
        { label: 'Ask', description: "Ask questions about the implementation (doesn't approve or reject)", detail: null },
        { label: 'Comment', description: 'Request changes (triggers a fix round)', detail: null },
      ],
    });
  });

  it('an auto task gate arms nothing — its DISPLAY is not a gate', () => {
    seedTaskGate(dir, { task_gate_mode: 'auto' });
    const out = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: task gate auto-approved/);
    assert.strictEqual(gateOf(out), null);
  });

  it('a display-only surface carries no gate', () => {
    seedTaskGate(dir, { analysis_cycle_total: 4 });
    const out = output(dir, ['render', 'cycle-limit', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: cycle limit/);
    assert.strictEqual(gateOf(out), null);
  });

  it('a labelled key row states its label as its head', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { routing: 'discussion', source: 'discovery' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'cancel-gate', 'pay.discovery.data-export'], { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'cancel gate');
    assert.strictEqual(gate.question, 'Cancel it?');
    assert.deepStrictEqual(gate.options[0], { key: 'y', word: 'yes', head: 'Confirm cancellation', tail: null, detail: null, struck: false, recommended: false });
  });

  it('a bare key row states no label — its word is the key the person presses, never a head', () => {
    createManifest(dir, 'auth', {});
    const gate = gateOf(output(dir, ['render', 'analysis-proceed-gate', 'auth'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Proceed with analysis?');
    assert.deepStrictEqual(gate.options, [
      { key: 'y', word: 'yes', head: '', tail: null, detail: null, struck: false, recommended: false },
      { key: 'n', word: 'no', head: '', tail: null, detail: null, struck: false, recommended: false },
    ]);
  });

  it('a metadata tail is stated apart from the head, its italics gone', () => {
    createManifest(dir, 'auth', {
      next_phase: 'planning',
      completed_phases: ['discovery', 'discussion', 'specification'],
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
      },
    });
    const gate = gateOf(output(dir, ['render', 'revisit-phases', 'auth'], { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'revisit phases');
    assert.deepStrictEqual(gate.options[0], { key: '1', word: null, head: 'Discussion', tail: 'completed', detail: null, struck: false, recommended: false });
    assert.deepStrictEqual(gate.options.at(-1), { key: 'b', word: 'back', head: 'Return to the previous menu', tail: null, detail: null, struck: false, recommended: false });
  });

  it('each render starts from nothing — neither a menu before it nor a menu-less one leaks rows in', () => {
    seedTaskGate(dir, { analysis_cycle_total: 4 });
    const first = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });
    output(dir, ['render', 'cycle-gate'], { env: ANNOUNCED });
    output(dir, ['render', 'cycle-limit', 'auth.implementation.auth-flow'], { env: ANNOUNCED });
    const last = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.deepStrictEqual(gateOf(last), gateOf(first));
  });

  it('the GATE sits directly above the MENU and after every other section', () => {
    const out = output(dir, ['render', 'walkthrough-screen', '--screen', '2', '--from', 'help'], { env: ANNOUNCED });
    const seen = markers(out);

    assert.strictEqual(seen.at(-2), GATE_MARKER);
    assert.match(seen.at(-1), /^=== MENU: walkthrough screen /);
    assert.ok(seen.slice(0, -2).every((m) => !m.startsWith('=== GATE') && !m.startsWith('=== MENU')), seen.join('\n'));
  });

  it('a menu drawn as a sample inside a display is not the gate — the payload is the screen\'s own menu', () => {
    const gate = gateOf(output(dir, ['render', 'walkthrough-screen', '--screen', '2', '--from', 'help'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'What next?');
    assert.strictEqual(gate.statement, '');
    assert.deepStrictEqual(gate.options.map((/** @type {{key: string}} */ o) => o.key), ['n', 'b', 's']);
  });
});

describe('gate payload — the statement', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a statement label over an explicit question is the statement, its markup gone', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { routing: 'discussion', source: 'discovery' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'cancel-gate', 'pay.discovery.data-export'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Cancel it?');
    assert.strictEqual(gate.statement,
      'Cancelling Data Export takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later.');
  });

  it('an unglyphed label is the statement, never the question', () => {
    createManifest(dir, 'auth', { phases: { planning: { items: { auth: { status: 'in-progress', phase: 2, task: 3 } } } } });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const gate = gateOf(output(dir, ['render', 'resume-gate', 'auth.planning.auth', '--variant', 'plan'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, '');
    assert.strictEqual(gate.statement, 'Found existing plan for Auth (previously reached phase 2, task 3).');
  });

  it('a multi-line statement keeps its lines', () => {
    createManifest(dir, 'auth', {
      phases: {
        implementation: { items: { auth: { status: 'completed', completed_tasks: ['a', 'b', 'c', 'd', 'e'] } } },
        review: { items: { auth: { status: 'in-progress', reviewed_tasks: ['a', 'b'] } } },
      },
    });
    const gate = gateOf(output(dir, ['render', 'resume-gate', 'auth.review.auth', '--variant', 'review'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, '');
    assert.strictEqual(gate.statement, 'Found existing review for Auth.\nReview covered 2 of 5 tasks. 3 task(s) not yet reviewed.');
  });

  it('a glyph-off frame\'s head is the statement', () => {
    createManifest(dir, 'auth', { phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const gate = gateOf(output(dir, ['render', 'in-flight-agents-gate', 'auth.discussion.auth', '--count', '2'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, '');
    assert.strictEqual(gate.statement, 'There are still 2 background agents working.');
  });

  it('a question the frame glyphs by hand is the question, and every head line above it is statement', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'in-progress' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'epic-soft-gate', 'v1', '--action', 'start_specification'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Proceed anyway?');
    assert.strictEqual(gate.statement, [
      '1 of 2 discussions still in-progress. Later conclusions may reshape this grouping.',
      'The system will re-analyse if you revisit later — proceeding now is safe, but may require rework.',
    ].join('\n'));
  });

  it('lines beneath a glyphed label are statement too', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createFile(dir, '.workflows/.cache/v1/names.json', JSON.stringify({ names: ['billing-core', 'auth'] }));
    const gate = gateOf(output(dir, ['render', 'summary-backfill-gate', 'v1', '--variant', 'unsourced',
      '--file', '.workflows/.cache/v1/names.json'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, '2 topic(s) have no source file to draft from:');
    assert.strictEqual(gate.statement, '- Billing Core\n- Auth');
  });

  it('a label-less menu asks in its trailing prompt, and carries no statement', () => {
    const gate = collect(() => menu('', [cmdOption('1', null, 'The first one'), cmdOption('2', null, 'The second')],
      { prompt: 'Select an option (enter number):' }));

    assert.strictEqual(gate.question, 'Select an option (enter number):');
    assert.strictEqual(gate.statement, '');
    assert.deepStrictEqual(gate.options.map((/** @type {{key: string}} */ o) => o.key), ['1', '2']);
  });

  it('a picker whose one line is its ask asks on that line', () => {
    const gate = collect(() => menuFrame(['Which doc? (enter the area name, or **`b/back`**)']));

    assert.strictEqual(gate.question, 'Which doc? (enter the area name, or b/back)');
    assert.strictEqual(gate.statement, '');
  });

  it('a glyphed question outranks the trailing prompt, which becomes statement', () => {
    const labelled = collect(() => menu('Which one?', [cmdOption('1', null, 'One')], { prompt: 'Reply with the number.' }));
    assert.strictEqual(labelled.question, 'Which one?');
    assert.strictEqual(labelled.statement, 'Reply with the number.');

    const asked = collect(() => menu('A long statement about the state of things.', [cmdOption('1', null, 'One')],
      { question: 'Proceed?', prompt: 'Select an option:' }));
    assert.strictEqual(asked.question, 'Proceed?');
    assert.strictEqual(asked.statement, 'A long statement about the state of things.\nSelect an option:');
  });

  it('an unglyphable label over a trailing prompt is statement, and the prompt asks', () => {
    const gate = collect(() => menu(`Where should "${'a concern worded at length '.repeat(3).trim()}" land?`,
      [cmdOption('1', null, 'One'), promptOption('Comment', 'Tell me more')], { prompt: 'Reply with an option.' }));

    assert.strictEqual(gate.question, 'Reply with an option.');
    assert.strictEqual(gate.statement, `Where should "${'a concern worded at length '.repeat(3).trim()}" land?`);
  });
});

describe('gate payload — a gateway menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the unnamed MENU is the "menu" gate, and its range row is typed rather than pressable', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry\n\nContent.');
    createFile(dir, '.workflows/.inbox/bugs/2026-03-20--bad-thing.md', '# Bad Thing\n\nContent.');
    const out = runGateway(dir, 'workflow-start', ['inbox'], ANNOUNCED);

    assert.deepStrictEqual(gateOf(out), {
      gate: 'menu',
      question: 'What would you like to do?',
      statement: '',
      options: [
        { key: 'b', word: 'back', head: 'Return', tail: null, detail: null, struck: false, recommended: false },
      ],
      typed: [
        { label: '1–2', description: 'Select item(s) to work on (comma-separated for several)', detail: null },
      ],
    });
  });

  it("the start menu's numbered rows carry its question and their keys", () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const gate = gateOf(runGateway(dir, 'workflow-start', ['view'], ANNOUNCED));

    assert.strictEqual(gate.question, 'What would you like to do?');
    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Continue "Auth"', tail: 'feature, ready for discussion', detail: null, struck: false, recommended: false });
    assert.deepStrictEqual(gate.typed, []);
  });

  it('a struck row and a recommended row carry their flags, and neither marker survives into the text', () => {
    seedHeldEpic(dir);
    const gate = gateOf(runGateway(dir, 'workflow-continue-epic', ['view', 'v1'], ANNOUNCED));

    assert.strictEqual(gate.gate, 'menu');
    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Continue "Auth"', tail: 'research', detail: null, struck: false, recommended: true });
    assert.deepStrictEqual(gate.options[1],
      { key: '2', word: null, head: 'Continue "Auth"', tail: 'discussion · in session (last active 4m ago)', detail: null, struck: true, recommended: false });
    assert.ok(gate.options.every((o) => !`${o.head}${o.tail}`.includes('recommended')), JSON.stringify(gate.options));
    assert.ok(gate.options.every((o) => !`${o.head}${o.tail}`.includes('~~')), JSON.stringify(gate.options));
  });

  it('the GATE sits directly above the MENU and after every other section', () => {
    seedHeldEpic(dir);
    const seen = markers(runGateway(dir, 'workflow-continue-epic', ['view', 'v1'], ANNOUNCED));

    assert.deepStrictEqual(seen.slice(-2), [GATE_MARKER, '=== MENU (emit verbatim as markdown) ===']);
    assert.ok(seen.slice(0, -2).every((m) => !m.startsWith('=== GATE') && !m.startsWith('=== MENU')), seen.join('\n'));
  });

  it('the in-session gate is its own gate — the epic menu it reads its entry from stays out', () => {
    seedHeldEpic(dir);
    const gate = gateOf(runGateway(dir, 'workflow-continue-epic', ['in-session-gate', 'v1', '2'], ANNOUNCED));

    assert.strictEqual(gate.question, 'Proceed anyway?');
    assert.match(gate.statement, /^"Auth" is open in another session — last active 4m ago\. /);
    assert.deepStrictEqual(gate.options.map((/** @type {{key: string}} */ o) => o.key), ['b', 'y']);
  });

  it('a glyph-off statement over a hand-glyphed question', () => {
    createManifest(dir, 'auth', {
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
      completed_phases: ['discovery', 'discussion'],
      next_phase: 'specification',
    });
    const gate = gateOf(runGateway(dir, 'workflow-continue-feature', ['view', 'auth'], ANNOUNCED));

    assert.strictEqual(gate.question, 'Proceed?');
    assert.strictEqual(gate.statement, 'Continuing "Auth" — ready for specification.');
  });

  it('a meta option carries its description as its detail, unwrapped, never as statement', () => {
    createManifest(dir, 'v2', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: { items: { 'auth-spec': { status: 'in-progress', sources: { a: { status: 'incorporated' } } } } },
      },
    });
    createFile(dir, '.workflows/v2/specification/auth-spec/specification.md', '# A');
    const gate = gateOf(runGateway(dir, 'workflow-specification-entry', ['view', 'v2'], ANNOUNCED));

    assert.strictEqual(gate.question, 'Select an option:');
    assert.strictEqual(gate.statement, '');
    assert.deepStrictEqual(gate.options[0], {
      key: '1', word: null, head: 'Analyze for groupings', tail: null,
      detail: 'All discussions are analyzed for natural groupings. Existing specification names are preserved. You can provide guidance in the next step.',
      struck: false, recommended: true,
    });
    assert.ok(gate.options.slice(1).every((/** @type {{detail: string|null}} */ o) => o.detail === null), JSON.stringify(gate.options));
  });

  it('each grouping action carries its own description', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'auth-design': { status: 'completed' }, 'session-model': { status: 'completed' }, 'data-model': { status: 'completed' } } },
        specification: {
          items: {
            'done-spec': { status: 'completed', sources: { 'auth-design': { status: 'incorporated' } } },
            'auth-flow': { status: 'proposed', sources: { 'auth-design': { status: 'pending' }, 'session-model': { status: 'pending' } } },
            'data-spec': { status: 'in-progress', sources: { 'data-model': { status: 'pending' }, 'session-model': { status: 'incorporated' } } },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/done-spec/specification.md', '# Done');
    createFile(dir, '.workflows/v1/specification/data-spec/specification.md', '# Data');
    const gate = gateOf(runGateway(dir, 'workflow-specification-entry', ['view', 'v1'], ANNOUNCED));
    const detailOf = (/** @type {string} */ head) => gate.options.find((/** @type {{head: string}} */ o) => o.head === head).detail;

    assert.strictEqual(gate.statement, '');
    assert.strictEqual(detailOf('Unify all into single specification'),
      'All discussions are combined into one specification. Existing specifications are incorporated and superseded.');
    assert.strictEqual(detailOf('Re-analyze groupings'),
      'Current groupings are discarded and rebuilt. Existing specification names are preserved. You can provide guidance in the next step.');
    assert.strictEqual(detailOf('Start "Auth Flow"'), null);
  });
});

describe('gate payload — a row\'s detail', () => {
  it('lines directly beneath a row are its detail: separate lines keep their break, a wrapped description joins back', () => {
    const description = 'A description long enough that the engine has to wrap it across several lines.';
    const gate = collect(() => menuFrame([
      'Pick one.',
      '',
      cmdOption('1', null, 'First'),
      'A note on the first.',
      'A second note.',
      cmdOption('2', null, 'Second'),
      promptOption('Comment', 'Tell me more'),
      ...optionDetail(description, 30),
      '',
      'Reply with a number.',
    ]));

    assert.deepStrictEqual(gate.options.map((/** @type {{detail: string|null}} */ o) => o.detail), ['A note on the first.\nA second note.', null]);
    assert.strictEqual(gate.typed[0].detail, description);
    assert.strictEqual(gate.question, 'Pick one.');
    assert.strictEqual(gate.statement, 'Reply with a number.');
  });

  it('a prompt the rows close on after a blank is the question, never the last row\'s detail', () => {
    const gate = collect(() => menu('', [cmdOption('1', null, 'One'), ...optionDetail('What one does.', 40)],
      { prompt: 'Select an option:' }));

    assert.strictEqual(gate.options[0].detail, 'What one does.');
    assert.strictEqual(gate.question, 'Select an option:');
    assert.strictEqual(gate.statement, '');
  });
});

describe('gate payload — a row built from parts', () => {
  it('each part draws where the row always drew it; the payload keeps the head and the flags, and everything after the head as the tail', () => {
    /** @type {string[]} */
    let rows = [];
    const gate = collect(() => {
      rows = [
        cmdOption('1', null, { head: 'Continue "Auth"', tail: 'research', cue: 'triage waiting', recommended: true }),
        cmdOption('2', null, { head: 'Continue "Auth"', tail: 'discussion', held: 'in session (last active 4m ago)' }),
        cmdOption('3', null, { head: 'Start research for "Billing"', tail: 'triage waiting' }),
        cmdOption('s', 'spec', { head: 'Analyze / regroup discussions' }),
      ];
      return menu('Pick one.', rows);
    });

    assert.deepStrictEqual(rows, [
      '**`1`** → Continue "Auth" — *research* · triage waiting (recommended)',
      '**`2`** → ~~Continue "Auth" — *discussion*~~ · in session (last active 4m ago)',
      '**`3`** → Start research for "Billing" — *triage waiting*',
      '**`s/spec`** → Analyze / regroup discussions',
    ]);
    assert.deepStrictEqual(gate.options, [
      { key: '1', word: null, head: 'Continue "Auth"', tail: 'research · triage waiting', detail: null, struck: false, recommended: true },
      { key: '2', word: null, head: 'Continue "Auth"', tail: 'discussion · in session (last active 4m ago)', detail: null, struck: true, recommended: false },
      { key: '3', word: null, head: 'Start research for "Billing"', tail: 'triage waiting', detail: null, struck: false, recommended: false },
      { key: 's', word: 'spec', head: 'Analyze / regroup discussions', tail: null, detail: null, struck: false, recommended: false },
    ]);
  });

  it('a held row with no tail states its holder as what follows the head', () => {
    const gate = collect(() => menu('Pick one.', [cmdOption('1', null, { head: 'Start research for "Billing"', held: 'in session (last active 1m ago)' })]));

    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Start research for "Billing"', tail: 'in session (last active 1m ago)', detail: null, struck: true, recommended: false });
  });

  it('a string label drawing a part inline is refused — the parts are the only way in', () => {
    assert.throws(() => cmdOption('1', null, 'Continue "Auth" — *research*'), /draws "— \*" inline/);
    assert.throws(() => cmdOption('b', 'back', 'Return to menu (recommended)'), /draws "\(recommended\)" inline/);
    assert.throws(() => cmdOption('1', null, '~~Continue "Auth"~~ · in session'), /draws "~~" inline/);
  });

  it('a cue notes a tail, so a row without one is refused', () => {
    assert.throws(() => cmdOption('1', null, { head: 'Start research for "Billing"', cue: 'triage waiting' }), /a cue notes a tail/);
  });

  it('text the engine did not author passes as a head, whatever it contains', () => {
    const summary = 'Keep the old flow (recommended) — *for now*';
    const gate = collect(() => menu('Which one?', [cmdOption('1', null, { head: summary })]));

    assert.strictEqual(gate.options[0].head, summary);
    assert.strictEqual(gate.options[0].recommended, false);
  });
});

describe('gate payload — escaped text', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a title the engine escaped reads as its own characters, and its markup as text', () => {
    const archived = '.workflows/.inbox/.archived/ideas/2026-05-01--user-id.md';
    createFile(dir, archived, '# Fix user_id in *auth* [draft]\n');

    const actions = gateOf(output(dir, ['render', 'archived-actions', '--path', archived], { env: ANNOUNCED }));
    assert.strictEqual(actions.statement, 'Selected: Fix user_id in *auth* [draft] (idea, archived)');

    const remove = gateOf(output(dir, ['render', 'archived-delete-gate', '--path', archived], { env: ANNOUNCED }));
    assert.strictEqual(remove.statement, 'Permanently deleting "Fix user_id in *auth* [draft]" removes the file from the repo and cannot be undone.');
  });

  it('a code span keeps its content as written', () => {
    const gate = collect(() => menu('Run `a_b*c` to release it.', [cmdOption('1', null, 'One')], { question: 'Proceed?' }));

    assert.strictEqual(gate.statement, 'Run a_b*c to release it.');
  });
});

describe('gate payload — a menu that draws nothing', () => {
  it('states no gate', () => {
    const out = announced(() => {
      openGate();
      return menuBlock('');
    });

    assert.ok(!out.includes(GATE_MARKER), out);
    assert.strictEqual(auditGate(out, 'empty menu'), null);
  });

  it('a render that composed no frame and no row takes nothing', () => {
    assert.strictEqual(announced(() => {
      openGate();
      return gateBlock('menu');
    }), '');
  });
});
